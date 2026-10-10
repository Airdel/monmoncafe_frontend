import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { notifyError, toast } from '../../lib/dialogs';
import { formatMoney } from '../../lib/format';

const REASONS = ['Capturada por error', 'Venta duplicada', 'El cliente canceló'];

const fieldClass = 'w-full bg-ink/5 border border-ink/10 rounded-xl px-4 py-3 text-ink placeholder-ink/30 focus:outline-none focus:border-primary/50 transition-all';

/** Voids a sale with a reason; it stays in Ventas marked as Anulada. */
export function CancelSaleDialog({ sale, onDone, onClose }: {
  sale: { id: number; totalAmount: number | string; summary: string };
  onDone: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  // Off when the drink was already made and thrown away
  const [restock, setRestock] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/sales/${sale.id}/cancel`, { reason: reason.trim(), restock });
      toast.success(restock ? 'Los insumos regresaron al inventario.' : 'Los insumos se quedan como usados.', `Venta #${sale.id} anulada`);
      onDone();
      onClose();
    } catch (err) {
      notifyError(err, 'No se pudo anular la venta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Anular venta #${sale.id}`} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-ink/70 text-sm">
          {sale.summary} · <b className="text-ink">{formatMoney(sale.totalAmount)}</b>
          <span className="block text-ink/50 mt-1">Deja de contar en ventas, comandas y corte, pero sigue en el reporte como anulada.</span>
        </p>

        <div>
          <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2" htmlFor="cancel-reason">Motivo</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={cn('px-3 py-1.5 rounded-full text-xs border transition-colors', reason === r ? 'bg-primary/15 border-primary text-primary' : 'bg-ink/5 border-ink/10 text-ink/60 hover:text-ink')}
              >
                {r}
              </button>
            ))}
          </div>
          <input id="cancel-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="¿Por qué se anula?" className={fieldClass} />
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl bg-ink/5 border border-ink/10 cursor-pointer">
          <input type="checkbox" checked={restock} onChange={e => setRestock(e.target.checked)} className="mt-1 accent-primary w-4 h-4" />
          <span className="text-sm">
            <span className="text-ink font-medium block">Regresar los insumos al inventario</span>
            <span className="text-ink/50">Desmárcalo si la bebida ya se preparó y se tiró.</span>
          </span>
        </label>

        <button
          onClick={submit}
          disabled={saving || !reason.trim()}
          className="w-full py-4 rounded-xl bg-error text-canvas font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : reason.trim() ? 'Anular venta' : 'Escribe el motivo'}
        </button>
      </div>
    </Modal>
  );
}
