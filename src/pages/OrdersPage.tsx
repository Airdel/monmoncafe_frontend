import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Ban, Banknote, BellRing, Check, ChefHat, Loader2, MessageSquareText, RotateCcw, User } from 'lucide-react';
import * as motion from 'motion/react-client';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { unwrap } from '../lib/unwrap';
import { notifyError } from '../lib/dialogs';
import { formatMoney } from '../lib/format';
import { Modal } from '../components/ui/Modal';
import { CancelSaleDialog } from '../components/sales/CancelSaleDialog';
import { useAuthStore } from '../store/auth';

type OrderStatus = 'PENDING' | 'READY' | 'DELIVERED';

interface Order {
  id: number;
  createdAt: string;
  orderStatus: OrderStatus;
  isPaid: boolean;
  totalAmount: string;
  customerName: string | null;
  notes: string | null;
  user: { name: string };
  items: {
    id: number;
    quantity: number;
    product: { name: string };
    modifiers: { name: string }[];
  }[];
}

type Filter = 'all' | OrderStatus | 'UNPAID';

const REFRESH_MS = 8000;

function minutesAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)} h ${mins % 60} min`;
}

/** Short beep so the bar notices a new order without watching the screen. */
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio blocked until the user interacts with the page
  }
}

/** Comandas: what was ordered, with its options and notes, until it is handed out. */
export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  // Pay-later order being charged; deliver=true hands it out right after
  const [charging, setCharging] = useState<{ order: Order; deliver: boolean } | null>(null);
  const [payMethod, setPayMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [paying, setPaying] = useState(false);
  const seen = useRef<Set<number> | null>(null);
  // Voiding an order (cancelled or captured by mistake) is for admins and supervisors
  const role = useAuthStore(state => state.user?.role);
  const canCancel = role === 'ADMIN' || role === 'SUPERVISOR';
  const [cancelling, setCancelling] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const list = unwrap<Order[]>(await api.get('/sales/orders'));
      // Ring only for orders that arrived after the first load
      if (seen.current && list.some(o => !seen.current!.has(o.id))) beep();
      seen.current = new Set(list.map(o => o.id));
      setOrders(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const setStatus = async (order: Order, orderStatus: OrderStatus) => {
    setBusyId(order.id);
    try {
      await api.patch(`/sales/${order.id}/order-status`, { orderStatus });
      if (orderStatus === 'DELIVERED') setOrders(prev => prev.filter(o => o.id !== order.id));
      else setOrders(prev => prev.map(o => o.id === order.id ? { ...o, orderStatus } : o));
    } catch (err) {
      notifyError(err);
    } finally {
      setBusyId(null);
    }
  };

  const openCharge = (order: Order, deliver: boolean) => {
    setPayMethod('CASH');
    setCashReceived('');
    setCharging({ order, deliver });
  };

  const charge = async () => {
    if (!charging) return;
    const { order, deliver } = charging;
    setPaying(true);
    try {
      await api.post(`/sales/${order.id}/pay`, {
        paymentMethod: payMethod,
        ...(payMethod === 'CASH' && cashReceived && { cashReceived: Number(cashReceived) }),
      });
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isPaid: true } : o));
      setCharging(null);
      if (deliver) await setStatus({ ...order, isPaid: true }, 'DELIVERED');
    } catch (err) {
      notifyError(err);
    } finally {
      setPaying(false);
    }
  };

  const chargeTotal = charging ? Number(charging.order.totalAmount) : 0;
  const change = cashReceived ? Number(cashReceived) - chargeTotal : 0;

  const unpaidCount = orders.filter(o => !o.isPaid).length;
  const pendingCount =orders.filter(o => o.orderStatus === 'PENDING').length;
  const readyCount = orders.filter(o => o.orderStatus === 'READY').length;
  const visible = filter === 'all' ? orders
    : filter === 'UNPAID' ? orders.filter(o => !o.isPaid)
    : orders.filter(o => o.orderStatus === filter);

  const chips: [Filter, string][] = [
    ['all', `Todas (${orders.length})`],
    ['PENDING', `Preparando (${pendingCount})`],
    ['READY', `Listas (${readyCount})`],
    ...(unpaidCount > 0 ? [['UNPAID', `Por cobrar (${unpaidCount})`] as [Filter, string]] : []),
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-ink tracking-tight">Comandas</h1>
          <p className="text-ink/50 text-sm font-label uppercase tracking-wider mt-1">Pedidos por preparar y entregar</p>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          {chips.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0',
                filter === key ? 'bg-primary text-on-primary font-bold' : 'bg-ink/5 border border-ink/10 text-ink/60 hover:text-ink'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <div className="glass-panel p-10 text-center text-ink/40">
          <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-50" />
          {orders.length === 0 ? 'No hay pedidos pendientes' : 'Nada en este filtro'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
          {visible.map(order => {
            const ready = order.orderStatus === 'READY';
            const busy = busyId === order.id;
            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('glass-panel p-4 sm:p-5 border-t-4', ready ? 'border-t-secondary' : 'border-t-primary')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-headline text-2xl font-bold text-ink leading-none">#{order.id}</p>
                    {order.customerName && (
                      <p className="flex items-center gap-1.5 text-primary font-bold mt-1.5 truncate">
                        <User className="w-4 h-4 shrink-0" /> {order.customerName}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      'inline-block px-2 py-0.5 rounded text-[10px] font-label uppercase tracking-widest font-bold',
                      ready ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary'
                    )}>
                      {ready ? 'Lista' : 'Preparando'}
                    </span>
                    <p className="text-ink/40 text-xs mt-1">{minutesAgo(order.createdAt)}</p>
                    {canCancel && (
                      <button
                        onClick={() => setCancelling(order)}
                        className="mt-1 -mr-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-ink/40 text-xs hover:text-error hover:bg-error/10"
                        aria-label={`Anular comanda #${order.id}`}
                      >
                        <Ban className="w-3.5 h-3.5" /> Anular
                      </button>
                    )}
                  </div>
                </div>

                <ul className="mt-4 space-y-3">
                  {order.items.map(item => (
                    <li key={item.id}>
                      <p className="text-ink font-bold">
                        <span className="font-mono text-primary mr-1.5">{item.quantity}×</span>
                        {item.product.name}
                      </p>
                      {item.modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 ml-7">
                          {item.modifiers.map((m, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-accent/15 text-ink text-xs font-semibold">{m.name}</span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {order.notes && (
                  <p className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/30 text-ink text-sm flex gap-2">
                    <MessageSquareText className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line break-words min-w-0">{order.notes}</span>
                  </p>
                )}

                {order.isPaid ? (
                  <p className="text-ink/30 text-xs mt-4">Cobró {order.user.name}</p>
                ) : (
                  <div className="mt-4 flex items-center justify-between gap-2 p-3 rounded-xl bg-error/10 border border-error/25">
                    <span className="text-error text-xs font-label uppercase tracking-widest font-bold">Por cobrar</span>
                    <span className="font-mono font-bold text-ink">{formatMoney(order.totalAmount)}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {!order.isPaid && !ready && (
                    <button
                      onClick={() => openCharge(order, false)}
                      disabled={busy}
                      className="px-4 py-3 rounded-xl bg-ink/5 border border-ink/15 text-ink/80 font-bold flex items-center gap-2 hover:text-ink disabled:opacity-50"
                    >
                      <Banknote className="w-4 h-4" /> Cobrar
                    </button>
                  )}
                  {ready ? (
                    <>
                      <button
                        onClick={() => setStatus(order, 'PENDING')}
                        disabled={busy}
                        className="px-3 py-3 rounded-xl bg-ink/5 border border-ink/10 text-ink/60 hover:text-ink disabled:opacity-50"
                        aria-label={`Regresar #${order.id} a preparando`}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => order.isPaid ? setStatus(order, 'DELIVERED') : openCharge(order, true)}
                        disabled={busy}
                        className="flex-1 py-3 rounded-xl bg-cta-alt text-on-secondary font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-5 h-5 animate-spin" />
                          : order.isPaid ? <><Check className="w-5 h-5" /> Entregada</>
                          : <><Banknote className="w-5 h-5" /> Cobrar y entregar</>}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setStatus(order, 'READY')}
                      disabled={busy}
                      className="flex-1 py-3 rounded-xl bg-cta text-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><BellRing className="w-5 h-5" /> Lista</>}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {cancelling && (
        <CancelSaleDialog
          sale={{
            id: cancelling.id,
            totalAmount: cancelling.totalAmount,
            summary: cancelling.items.map(i => `${i.quantity}× ${i.product.name}`).join(', '),
          }}
          onDone={() => setOrders(prev => prev.filter(o => o.id !== cancelling.id))}
          onClose={() => setCancelling(null)}
        />
      )}

      {charging && (
        <Modal title={`Cobrar comanda #${charging.order.id}`} onClose={() => setCharging(null)}>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-ink/50 text-sm">{charging.order.customerName ?? 'Total'}</span>
              <span className="font-headline text-3xl font-bold text-secondary">{formatMoney(chargeTotal)}</span>
            </div>
            <div className="flex gap-3">
              {([['CASH', 'Efectivo', Banknote], ['TRANSFER', 'Transferencia', ArrowLeftRight]] as const).map(([method, label, Icon]) => (
                <button
                  key={method}
                  onClick={() => setPayMethod(method)}
                  aria-pressed={payMethod === method}
                  className={cn(
                    'flex-1 py-3 border rounded-xl flex flex-col items-center gap-1 transition-colors',
                    payMethod === method ? 'bg-primary/15 border-primary text-primary' : 'bg-ink/5 border-ink/10 text-ink/60 hover:text-ink'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-label text-[11px] uppercase tracking-widest font-semibold">{label}</span>
                </button>
              ))}
            </div>
            {payMethod === 'CASH' && (
              <div>
                <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2" htmlFor="cash-received">Recibido (opcional)</label>
                <input
                  id="cash-received"
                  type="number"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder={chargeTotal.toFixed(2)}
                  className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink font-mono focus:border-primary/50 focus:outline-none placeholder:text-ink/20"
                />
                {cashReceived && (
                  <p className={cn('text-sm mt-2 font-medium', change < 0 ? 'text-error' : 'text-secondary')}>
                    {change < 0 ? `Faltan ${formatMoney(-change)}` : `Cambio: ${formatMoney(change)}`}
                  </p>
                )}
              </div>
            )}
            <button
              onClick={charge}
              disabled={paying || (payMethod === 'CASH' && !!cashReceived && change < 0)}
              className="w-full py-4 rounded-xl bg-cta text-on-primary font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : charging.deliver ? 'Cobrar y entregar' : 'Cobrar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
