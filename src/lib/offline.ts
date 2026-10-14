import { isAxiosError } from 'axios';
import { api } from './api';
import { unwrap } from './unwrap';
import { getErrorMessage } from './errors';
import { useAuthStore } from '../store/auth';
import { useConnectionStore } from '../store/connection';
import { newClientId, useOfflineSales } from '../store/offlineSales';
import { useOfflineOps } from '../store/offlineOps';
import { isNativeApp } from './server';

/** How long to wait for the PC before treating it as off (a dead Tailscale peer never answers). */
export const QUICK_TIMEOUT_MS = 8000;
const PING_EVERY_MS = 15000;

/**
 * The server could not be reached: no answer, a timeout, or Tailscale/the
 * proxy saying the API behind it is down. Anything else is a real answer.
 */
export function isOfflineError(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  if (!err.response) return true;
  return [502, 503, 504].includes(err.response.status);
}

const cacheKey = (url: string) => `cache:${url}`;

/**
 * GET that remembers its last answer on the device, so the POS still shows
 * the menu, prices and options when the server is off.
 */
export async function cachedGet<T>(url: string): Promise<T> {
  try {
    const data = unwrap<T>(await api.get(url, { timeout: QUICK_TIMEOUT_MS }));
    try {
      localStorage.setItem(cacheKey(url), JSON.stringify(data));
    } catch {
      // Storage full: the screen still works online
    }
    return data;
  } catch (err) {
    if (isOfflineError(err)) {
      try {
        const saved = localStorage.getItem(cacheKey(url));
        if (saved) return JSON.parse(saved) as T;
      } catch {
        // Fall through to the original error
      }
    }
    throw err;
  }
}

let syncing = false;

/**
 * Sends the sales saved offline, oldest first. Stops at the first one that
 * can't reach the server; a sale the server refuses is kept with its reason.
 */
export async function syncOfflineSales(): Promise<void> {
  if (syncing || !useAuthStore.getState().accessToken) return;
  syncing = true;
  try {
    for (const { clientId } of useOfflineSales.getState().sales) {
      // Read it again: it may have been charged or delivered in Comandas meanwhile
      const sale = useOfflineSales.getState().sales.find(s => s.clientId === clientId);
      if (!sale || sale.error) continue;
      try {
        await api.post('/sales', { ...sale.payload, clientId, soldAt: sale.soldAt }, { timeout: QUICK_TIMEOUT_MS * 2 });
        useOfflineSales.getState().remove(clientId);
      } catch (err) {
        if (isOfflineError(err)) return;
        // Logged out (session expired): it is sent after the next login
        if (!useAuthStore.getState().accessToken) return;
        useOfflineSales.getState().update(clientId, s => ({ ...s, error: getErrorMessage(err) }));
      }
    }
  } finally {
    syncing = false;
  }
}

/**
 * The server is still recording an earlier copy of the same request: try
 * again later. Other 409s (a corte already saved…) are real refusals.
 */
const isStillRecording = (err: unknown) =>
  isAxiosError(err) && err.response?.status === 409 && getErrorMessage(err).includes('todavía se está registrando');

/** Someone else changed the same product meanwhile; the server says what it has now. */
export const isEditConflict = (err: unknown) => isAxiosError(err) && err.response?.status === 412;

/** Told to people when something was kept on the device instead of sent. */
export const QUEUED_MESSAGE = 'Sin conexión: quedó guardado en este dispositivo y se enviará solo.';

export type SendResult<T> = { queued: false; data: T } | { queued: true };

/**
 * POST that works with the server off: it is sent right away when the PC
 * answers, and otherwise kept on the device and sent later, dated with the
 * moment it was made. The same Idempotency-Key goes with both tries, so a
 * request that did arrive but whose answer was lost is not recorded twice.
 */
export async function sendOrQueue<T = unknown>(
  url: string,
  body: unknown,
  label: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST'
): Promise<SendResult<T>> {
  const key = newClientId();
  const occurredAt = new Date().toISOString();
  try {
    const res = await api.request({ url, method, data: body, timeout: QUICK_TIMEOUT_MS, headers: { 'Idempotency-Key': key } });
    return { queued: false, data: unwrap<T>(res) };
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    useOfflineOps.getState().add({ key, url, method, body, occurredAt, label, user: useAuthStore.getState().user?.name ?? '' });
    return { queued: true };
  }
}

/** Ops still waiting to be sent to this url (for showing them on screen meanwhile). */
export const queuedFor = (url: string) => useOfflineOps.getState().ops.filter(o => o.url === url && !o.error);

let syncingOps = false;

/** Sends what was registered offline, oldest first, after the sales. */
export async function syncOfflineOps(): Promise<void> {
  if (syncingOps || !useAuthStore.getState().accessToken) return;
  syncingOps = true;
  try {
    for (const { key } of useOfflineOps.getState().ops) {
      const op = useOfflineOps.getState().ops.find(o => o.key === key);
      if (!op || op.error) continue;
      try {
        await api.request({
          url: op.url,
          method: op.method ?? 'POST',
          data: op.body,
          timeout: QUICK_TIMEOUT_MS * 2,
          headers: { 'Idempotency-Key': op.key, 'X-Occurred-At': op.occurredAt },
        });
        useOfflineOps.getState().remove(key);
      } catch (err) {
        if (isOfflineError(err) || isStillRecording(err)) return;
        if (!useAuthStore.getState().accessToken) return;
        useOfflineOps.getState().update(key, o => ({ ...o, error: getErrorMessage(err) }));
      }
    }
  } finally {
    syncingOps = false;
  }
}

/** Sends sales first: what they used is already counted when purchases and counts arrive. */
export async function syncAll(): Promise<void> {
  await syncOfflineSales();
  // Still unreachable: the rest waits too
  if (useOfflineSales.getState().sales.some(s => !s.error)) return;
  await syncOfflineOps();
}

/**
 * Tries again something the server refused. For an edit that clashed with
 * someone else's change, retrying means "keep mine": the version it was based
 * on is dropped so the server applies it over the other one.
 */
export function retryOfflineOp(key: string) {
  useOfflineOps.getState().update(key, op => {
    const body = op.body && typeof op.body === 'object' && 'base' in op.body
      ? Object.fromEntries(Object.entries(op.body).filter(([k]) => k !== 'base'))
      : op.body;
    return { ...op, body, error: undefined };
  });
  void syncAll();
}

/** Retries a sale the server refused, after fixing whatever it complained about. */
export function retryOfflineSale(clientId: string) {
  useOfflineSales.getState().update(clientId, sale => ({ ...sale, error: undefined }));
  void syncAll();
}

const HEARTBEAT_EVERY_MS = 60000;
let lastHeartbeat = 0;
let lastReported = '';

/** This device's id, kept on it for good, so the corte can name who has things unsent. */
function deviceId(): string {
  try {
    let id = localStorage.getItem('device-id');
    if (!id) {
      id = newClientId();
      localStorage.setItem('device-id', id);
    }
    return id;
  } catch {
    return 'sin-almacenamiento';
  }
}

/**
 * Tells the server how much this device still has to send, so the corte can
 * warn "Mónica's phone has 3 sales not sent". Older servers answer 404: ignored.
 */
async function heartbeat() {
  const user = useAuthStore.getState().user;
  if (!user || !useAuthStore.getState().accessToken) return;
  const pendingSales = useOfflineSales.getState().sales.length;
  const pendingOps = useOfflineOps.getState().ops.length;
  // Right away when the counts change (e.g. just sent), otherwise once a minute
  const report = `${pendingSales}/${pendingOps}`;
  if (report === lastReported && Date.now() - lastHeartbeat < HEARTBEAT_EVERY_MS) return;
  lastHeartbeat = Date.now();
  lastReported = report;
  try {
    await api.post('/devices/heartbeat', {
      deviceId: deviceId(),
      name: `${user.name} · ${isNativeApp ? 'Android' : 'Web'}`.slice(0, 100),
      pendingSales,
      pendingOps,
    }, { timeout: QUICK_TIMEOUT_MS });
  } catch {
    // Not important enough to bother anyone
  }
}

async function ping() {
  try {
    await api.get('', { timeout: QUICK_TIMEOUT_MS });
  } catch {
    // The interceptor already marked the server offline
  }
}

/**
 * While logged in: checks every few seconds whether the server came back
 * (only when it is off or there is something to send) and sends the queue.
 */
export function startOfflineSync(): () => void {
  const tick = async () => {
    const offline = !useConnectionStore.getState().online;
    const pending = useOfflineSales.getState().sales.some(s => !s.error)
      || useOfflineOps.getState().ops.some(o => !o.error);
    if (offline) await ping();
    if (!useConnectionStore.getState().online) return;
    if (pending) await syncAll();
    await heartbeat();
  };
  const timer = setInterval(tick, PING_EVERY_MS);
  const onBack = () => void tick();
  window.addEventListener('online', onBack);
  // The server answering anything means it is back: send right away
  const unsubscribe = useConnectionStore.subscribe((state, prev) => {
    if (state.online && !prev.online) void syncAll();
  });
  void tick();
  return () => {
    clearInterval(timer);
    window.removeEventListener('online', onBack);
    unsubscribe();
  };
}

const PRODUCT_EDIT_URL = /^\/products\/(\d+)$/;

/**
 * Applies the product edits still waiting on this device over a list read
 * from the server or the cache, so the POS charges the new price right away.
 */
export function withQueuedProductEdits<T extends { id: number; sellingPrice: string }>(products: T[]): T[] {
  const edits = useOfflineOps.getState().ops.filter(o => o.method === 'PATCH' && !o.error && PRODUCT_EDIT_URL.test(o.url));
  if (edits.length === 0) return products;
  return products.map(p => edits.reduce((acc, op) => {
    if (Number(PRODUCT_EDIT_URL.exec(op.url)?.[1]) !== p.id) return acc;
    const body = op.body as { name?: string; categoryId?: number; sellingPrice?: number; isActive?: boolean };
    return {
      ...acc,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.sellingPrice !== undefined && { sellingPrice: String(body.sellingPrice) }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    };
  }, p));
}

/** The recipe this device saved offline for a product and hasn't sent yet. */
export function queuedRecipe(productId: number, ops = useOfflineOps.getState().ops): { ingredientId: number; quantityUsed: number }[] | undefined {
  const op = ops.filter(o => o.method === 'PUT' && !o.error && o.url === `/products/${productId}/recipe`).at(-1);
  return (op?.body as { ingredients?: { ingredientId: number; quantityUsed: number }[] } | undefined)?.ingredients;
}
