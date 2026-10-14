import { useState } from 'react';
import { AlertTriangle, CloudOff, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useConnectionStore } from '../../store/connection';
import { useOfflineSales, type QueuedSale } from '../../store/offlineSales';
import { useOfflineOps, type QueuedOp } from '../../store/offlineOps';
import { retryOfflineOp, retryOfflineSale } from '../../lib/offline';
import { confirm } from '../../lib/dialogs';
import { formatMoney } from '../../lib/format';
import { Modal } from '../ui/Modal';

const salesText = (n: number) => `${n} ${n === 1 ? 'venta' : 'ventas'}`;
const opsText = (n: number) => `${n} ${n === 1 ? 'registro' : 'registros'}`;

/** "2 ventas y 1 registro", leaving out whatever is zero. */
function pendingText(sales: number, ops: number) {
  return [sales > 0 && salesText(sales), ops > 0 && opsText(ops)].filter(Boolean).join(' y ');
}

const when = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Says when the PC at home can't be reached and how much is waiting on this
 * device (sales and other records), and lets someone decide about the ones
 * the server refused.
 */
export function ConnectionBanner() {
  const online = useConnectionStore(state => state.online);
  const sales = useOfflineSales(state => state.sales);
  const ops = useOfflineOps(state => state.ops);
  const [showFailed, setShowFailed] = useState(false);
  const failedSales = sales.filter(s => s.error);
  const failedOps = ops.filter(o => o.error);
  const pendingSales = sales.length - failedSales.length;
  const pendingOps = ops.length - failedOps.length;
  const pending = pendingText(pendingSales, pendingOps);
  const failed = failedSales.length + failedOps.length;

  if (online && sales.length === 0 && ops.length === 0) return null;

  return (
    <>
      <div role="status" className="shrink-0 px-4 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-warning/30 bg-warning/10 text-ink/80">
        {!online ? (
          <span className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-warning shrink-0" />
            <span><b className="text-warning">Sin conexión con el servidor.</b> Puedes seguir vendiendo y registrando compras{pending && <>; {pending} en este dispositivo</>}.</span>
          </span>
        ) : pending && (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            Enviando {pending} hechos sin conexión…
          </span>
        )}
        {failed > 0 && (
          <button onClick={() => setShowFailed(true)} className="flex items-center gap-1.5 text-error font-semibold underline underline-offset-2">
            <AlertTriangle className="w-4 h-4" /> {pendingText(failedSales.length, failedOps.length)} sin enviar
          </button>
        )}
      </div>

      {showFailed && <FailedItems sales={failedSales} ops={failedOps} onClose={() => setShowFailed(false)} />}
    </>
  );
}

function FailedItems({ sales, ops, onClose }: { sales: QueuedSale[]; ops: QueuedOp[]; onClose: () => void }) {
  const discardSale = async (sale: QueuedSale) => {
    const ok = await confirm({
      title: 'Descartar venta',
      message: 'Se borra de este dispositivo y no llegará al servidor. Si se cobró, regístrala de nuevo en Caja.',
      details: [{ label: 'Total', value: formatMoney(sale.total) }],
      confirmLabel: 'Descartar',
      tone: 'danger',
    });
    if (ok) useOfflineSales.getState().remove(sale.clientId);
  };

  const discardOp = async (op: QueuedOp) => {
    const ok = await confirm({
      title: 'Descartar registro',
      message: 'Se borra de este dispositivo y no llegará al servidor. Si hace falta, regístralo de nuevo.',
      details: [{ label: 'Registro', value: op.label }],
      confirmLabel: 'Descartar',
      tone: 'danger',
    });
    if (ok) useOfflineOps.getState().remove(op.key);
  };

  const actions = (onRetry: () => void, onDiscard: () => void, what: string) => (
    <div className="flex gap-2 mt-3">
      <button onClick={onRetry} className="flex-1 py-2 rounded-lg bg-primary/15 text-primary font-semibold flex items-center justify-center gap-1.5">
        <RotateCcw className="w-4 h-4" /> Reintentar
      </button>
      <button onClick={onDiscard} className="px-3 py-2 rounded-lg text-error hover:bg-error/10 flex items-center gap-1.5" aria-label={`Descartar ${what}`}>
        <Trash2 className="w-4 h-4" /> Descartar
      </button>
    </div>
  );

  return (
    <Modal title="Sin enviar" onClose={onClose}>
      <p className="text-ink/60 text-sm mb-4">
        El servidor no aceptó esto que se hizo sin conexión. Corrige lo que dice el motivo (por ejemplo, reactivar un producto o reabrir un corte) y reintenta, o descártalo.
      </p>
      {sales.length === 0 && ops.length === 0 && <p className="text-ink/40 text-center py-6">Ya no hay nada con problemas</p>}
      <ul className="space-y-3">
        {sales.map(sale => (
          <li key={sale.clientId} className="p-3 rounded-xl bg-ink/5 border border-ink/10">
            <div className="flex justify-between gap-3">
              <span className="text-ink/50 text-xs">{when(sale.soldAt)} · {sale.cashier}</span>
              <span className="font-mono font-bold text-ink">{formatMoney(sale.total)}</span>
            </div>
            <p className="text-ink text-sm mt-1">{sale.lines.map(l => `${l.quantity}× ${l.name}`).join(', ')}</p>
            <p className="text-error text-sm mt-1">{sale.error}</p>
            {actions(() => retryOfflineSale(sale.clientId), () => discardSale(sale), 'venta')}
          </li>
        ))}
        {ops.map(op => (
          <li key={op.key} className="p-3 rounded-xl bg-ink/5 border border-ink/10">
            <span className="text-ink/50 text-xs">{when(op.occurredAt)} · {op.user}</span>
            <p className="text-ink text-sm mt-1">{op.label}</p>
            <p className="text-error text-sm mt-1">{op.error}</p>
            {actions(() => retryOfflineOp(op.key), () => discardOp(op), 'registro')}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
