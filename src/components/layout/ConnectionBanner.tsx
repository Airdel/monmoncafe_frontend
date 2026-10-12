import { useState } from 'react';
import { AlertTriangle, CloudOff, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useConnectionStore } from '../../store/connection';
import { useOfflineSales, type QueuedSale } from '../../store/offlineSales';
import { retryOfflineSale } from '../../lib/offline';
import { confirm } from '../../lib/dialogs';
import { formatMoney } from '../../lib/format';
import { Modal } from '../ui/Modal';

const plural = (n: number) => `${n} ${n === 1 ? 'venta' : 'ventas'}`;

/**
 * Says when the PC at home can't be reached and how many sales are waiting
 * on this device, and lets someone decide about the ones the server refused.
 */
export function ConnectionBanner() {
  const online = useConnectionStore(state => state.online);
  const sales = useOfflineSales(state => state.sales);
  const [showFailed, setShowFailed] = useState(false);
  const failed = sales.filter(s => s.error);
  const pending = sales.length - failed.length;

  if (online && sales.length === 0) return null;

  return (
    <>
      <div role="status" className="shrink-0 px-4 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-warning/30 bg-warning/10 text-ink/80">
        {!online ? (
          <span className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-warning shrink-0" />
            <span><b className="text-warning">Sin conexión con el servidor.</b> Puedes seguir vendiendo{pending > 0 && <>; {plural(pending)} en este dispositivo</>}.</span>
          </span>
        ) : pending > 0 && (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            Enviando {plural(pending)} hechas sin conexión…
          </span>
        )}
        {failed.length > 0 && (
          <button onClick={() => setShowFailed(true)} className="flex items-center gap-1.5 text-error font-semibold underline underline-offset-2">
            <AlertTriangle className="w-4 h-4" /> {plural(failed.length)} no se pudo enviar
          </button>
        )}
      </div>

      {showFailed && <FailedSales sales={failed} onClose={() => setShowFailed(false)} />}
    </>
  );
}

function FailedSales({ sales, onClose }: { sales: QueuedSale[]; onClose: () => void }) {
  const discard = async (sale: QueuedSale) => {
    const ok = await confirm({
      title: 'Descartar venta',
      message: 'Se borra de este dispositivo y no llegará al servidor. Si se cobró, regístrala de nuevo en Caja.',
      details: [{ label: 'Total', value: formatMoney(sale.total) }],
      confirmLabel: 'Descartar',
      tone: 'danger',
    });
    if (ok) useOfflineSales.getState().remove(sale.clientId);
  };

  return (
    <Modal title="Ventas sin enviar" onClose={onClose}>
      <p className="text-ink/60 text-sm mb-4">
        El servidor no aceptó estas ventas hechas sin conexión. Corrige lo que dice el motivo (por ejemplo, reactivar un producto) y reintenta, o descártalas.
      </p>
      {sales.length === 0 && <p className="text-ink/40 text-center py-6">Ya no hay ventas con problemas</p>}
      <ul className="space-y-3">
        {sales.map(sale => (
          <li key={sale.clientId} className="p-3 rounded-xl bg-ink/5 border border-ink/10">
            <div className="flex justify-between gap-3">
              <span className="text-ink/50 text-xs">{new Date(sale.soldAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })} · {sale.cashier}</span>
              <span className="font-mono font-bold text-ink">{formatMoney(sale.total)}</span>
            </div>
            <p className="text-ink text-sm mt-1">{sale.lines.map(l => `${l.quantity}× ${l.name}`).join(', ')}</p>
            <p className="text-error text-sm mt-1">{sale.error}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => retryOfflineSale(sale.clientId)} className="flex-1 py-2 rounded-lg bg-primary/15 text-primary font-semibold flex items-center justify-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Reintentar
              </button>
              <button onClick={() => discard(sale)} className="px-3 py-2 rounded-lg text-error hover:bg-error/10 flex items-center gap-1.5" aria-label="Descartar venta">
                <Trash2 className="w-4 h-4" /> Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
