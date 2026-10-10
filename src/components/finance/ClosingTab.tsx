import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Lock, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { confirm, notifyError } from '../../lib/dialogs';
import { formatDay, formatMoney, todayISO } from '../../lib/format';
import { unwrap } from '../../lib/unwrap';
import { ClosingBreakdown } from './ClosingBreakdown';
import { inputClass, labelClass, primaryButtonClass } from './styles';
import type { ClosingPreview, DayExpense } from './types';

export function ClosingTab({ onClosed, canManage }: { onClosed: () => void; canManage: boolean }) {
  const [date, setDate] = useState(todayISO);
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<ClosingPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/closings/preview', { params: { date } })
      .then(res => { if (!cancelled) { setPreview(unwrap<ClosingPreview>(res)); setError(''); } })
      .catch(err => { if (!cancelled) { setPreview(null); setError(getErrorMessage(err)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, reloadKey]);

  const changeDate = (value: string) => {
    if (!value || value === date) return;
    setLoading(true);
    setDate(value);
  };

  const refresh = () => {
    setLoading(true);
    setReloadKey(k => k + 1);
  };

  const deleteExpense = async (expense: DayExpense) => {
    if (!await confirm({
      title: `¿Quitar ${expense.description}?`,
      message: expense.category === 'TOOL'
        ? `Se borra el gasto de ${formatMoney(expense.amount)} y las piezas compradas salen de Herramientas.`
        : `Se borra el gasto de ${formatMoney(expense.amount)}.`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    })) return;
    try {
      await api.delete(`/other-expenses/${expense.id}`);
      refresh();
    } catch (err) {
      notifyError(err);
    }
  };

  const closeDay = async () => {
    if (!preview) return;
    const ok = await confirm({
      title: `¿Cerrar el día ${formatDay(date)}?`,
      message: 'Las ventas de ese día quedarán ligadas a este corte.',
      details: [
        { label: 'Ventas', value: formatMoney(preview.totalSales) },
        { label: 'Utilidad neta', value: formatMoney(preview.netProfit) },
      ],
      confirmLabel: 'Cerrar día',
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      await api.post('/closings', { date, notes: notes.trim() || undefined });
      setNotes('');
      refresh();
      onClosed();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel p-5 flex flex-col md:flex-row md:items-end gap-4">
        <div className="md:w-64">
          <label className={labelClass} htmlFor="closing-date">Día del corte</label>
          <input
            id="closing-date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={e => changeDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <p className="font-headline text-xl font-bold text-ink">{formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          {preview?.alreadyClosed ? (
            <p className="flex items-center gap-2 text-secondary text-sm mt-1"><Lock className="w-4 h-4" /> Este día ya está cerrado. Puedes consultarlo en el historial.</p>
          ) : (
            <p className="text-ink/50 text-sm mt-1">Vista previa en vivo; nada se guarda hasta que cierres el día.</p>
          )}
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-ink/5 border border-ink/10 text-ink/70 hover:text-ink transition-all" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {loading && !preview ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="glass-panel p-6 text-error">{error}</div>
      ) : preview && (
        <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <ClosingBreakdown
            totals={preview}
            details={preview.details}
            expenses={preview.expenses}
            onDeleteExpense={canManage && !preview.alreadyClosed ? deleteExpense : undefined}
          />

          {!preview.alreadyClosed && !!preview.unpaidOrders?.count && (
            <p className="mt-6 p-4 rounded-xl bg-warning/10 border border-warning/30 text-ink text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <span>
                Hay {preview.unpaidOrders.count} {preview.unpaidOrders.count === 1 ? 'pedido' : 'pedidos'} por cobrar ({formatMoney(preview.unpaidOrders.total)}) en Comandas.
                No entran en este corte; cóbralos antes de cerrar el día o contarán en el día en que se cobren.
              </span>
            </p>
          )}

          {!preview.alreadyClosed && (
            <div className="glass-panel p-5 mt-6 flex flex-col md:flex-row gap-4 md:items-end">
              <div className="flex-1">
                <label className={labelClass} htmlFor="closing-notes">Notas (opcional)</label>
                <input
                  id="closing-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej. faltaron $20 en caja, se rompió una taza…"
                  className={inputClass}
                />
              </div>
              <button onClick={closeDay} disabled={submitting} className={primaryButtonClass}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Cerrar día
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
