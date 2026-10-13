import { isAxiosError } from 'axios';
import { api } from './api';
import { unwrap } from './unwrap';
import { getErrorMessage } from './errors';
import { useAuthStore } from '../store/auth';
import { useConnectionStore } from '../store/connection';
import { useOfflineSales } from '../store/offlineSales';

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

/** Retries a sale the server refused, after fixing whatever it complained about. */
export function retryOfflineSale(clientId: string) {
  useOfflineSales.getState().update(clientId, sale => ({ ...sale, error: undefined }));
  void syncOfflineSales();
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
    const pending = useOfflineSales.getState().sales.some(s => !s.error);
    if (offline) await ping();
    if (pending && useConnectionStore.getState().online) await syncOfflineSales();
  };
  const timer = setInterval(tick, PING_EVERY_MS);
  const onBack = () => void tick();
  window.addEventListener('online', onBack);
  // The server answering anything means it is back: send right away
  const unsubscribe = useConnectionStore.subscribe((state, prev) => {
    if (state.online && !prev.online) void syncOfflineSales();
  });
  void tick();
  return () => {
    clearInterval(timer);
    window.removeEventListener('online', onBack);
    unsubscribe();
  };
}
