import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, Lock, RefreshCw, Smartphone } from 'lucide-react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { confirm, notifyError, toast } from '../../lib/dialogs';
import { playSound } from '../../lib/sounds';
import { formatDay, formatMoney, todayISO } from '../../lib/format';
import { cachedGet, sendOrQueue } from '../../lib/offline';
import { useConnectionStore } from '../../store/connection';
import { useOfflineOps } from '../../store/offlineOps';
import { useOfflineSales } from '../../store/offlineSales';
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
    // Remembered on the device: without the PC it shows the last numbers it saw
    cachedGet<ClosingPreview>(`/closings/preview?date=${date}`)
      .then(data => { if (!cancelled) { setPreview(data); setError(''); } })
      .catch(err => { if (!cancelled) { setPreview(null); setError(getErrorMessage(err)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, reloadKey]);

  const online = useConnectionStore(state => state.online);
  // This device's sales of that day still waiting to be sent
  const localSales = useOfflineSales(state => state.sales)
    .filter(sale => new Date(sale.soldAt).toLocaleDateString('en-CA') === date && !sale.payload.payLater);
  const localTotal = localSales.reduce((sum, sale) => sum + sale.total, 0);
  // A corte made here without the PC, waiting to be sent
  const queuedClose = useOfflineOps(state => state.ops)
    .find(op => op.url === '/closings' && (op.body as { date?: string } | undefined)?.date === date);
  const otherDevices = preview?.devicesWithPending ?? [];

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
    const ok = await confirm({
      title: `¿Cerrar el día ${formatDay(date)}?`,
      message: [
        'Las ventas de ese día quedarán ligadas a este corte.',
        !online && 'Sin conexión: el corte se guarda en este dispositivo y la PC lo calcula con todo lo que tenga cuando llegue. Estos números son provisionales.',
        otherDevices.length > 0 && `Ojo: ${otherDevices.map(d => d.name).join(', ')} todavía no envía todo. Lo que llegue después del corte cuenta en el día en que llegue.`,
      ].filter(Boolean).join('\n\n'),
      details: preview ? [
        { label: 'Ventas', value: formatMoney(preview.totalSales) },
        { label: 'Utilidad neta', value: formatMoney(preview.netProfit) },
        ...(Number(preview.consignmentSales ?? 0) > 0 ? [{ label: 'Para el proveedor', value: formatMoney(preview.consignmentSales ?? 0) }] : []),
      ] : undefined,
      confirmLabel: 'Cerrar día',
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      const sent = await sendOrQueue('/closings', { date, notes: notes.trim() || undefined }, `Corte del ${formatDay(date)}`);
      setNotes('');
      playSound('closing');
      if (sent.queued) {
        toast.success('Sin conexión: el corte quedó guardado en este dispositivo y la PC lo hará cuando vuelva la conexión.');
        return;
      }
      refresh();
      onClosed();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const closeForm = (
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
  );

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
            <p className="text-ink/50 text-sm mt-1">{online ? 'Vista previa en vivo; nada se guarda hasta que cierres el día.' : 'Provisional: los últimos números que vio este dispositivo.'}</p>
          )}
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-ink/5 border border-ink/10 text-ink/70 hover:text-ink transition-all" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {loading && !preview ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        !online && !queuedClose ? (
          // Never opened this day with the PC on: it can still be closed, the PC does the math
          <div className="flex flex-col">
            <p className="glass-panel p-6 text-ink/70 text-sm flex items-start gap-2">
              <CloudOff className="w-5 h-5 text-ink/50 shrink-0" />
              Sin conexión y sin números guardados de este día en este dispositivo. Puedes dejar el corte guardado y la PC lo calcula cuando vuelva la conexión.
            </p>
            {closeForm}
          </div>
        ) : queuedClose && !queuedClose.error ? (
          <p className="glass-panel p-6 text-ink/70 text-sm">El corte de este día está guardado en este dispositivo y se hará en la PC cuando vuelva la conexión.</p>
        ) : <div className="glass-panel p-6 text-error">{error}</div>
      ) : preview && (
        <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <ClosingBreakdown
            totals={preview}
            details={preview.details}
            expenses={preview.expenses}
            consignment={preview.consignment}
            onDeleteExpense={canManage && !preview.alreadyClosed ? deleteExpense : undefined}
          />

          {!online && (
            <p className="mt-6 p-4 rounded-xl bg-ink/5 border border-ink/10 text-ink text-sm flex items-start gap-2">
              <CloudOff className="w-5 h-5 text-ink/50 shrink-0" />
              <span>Sin conexión con la PC: son los últimos números que vio este dispositivo, no el corte final.</span>
            </p>
          )}

          {!preview.alreadyClosed && localSales.length > 0 && (
            <p className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/30 text-ink text-sm flex items-start gap-2">
              <Smartphone className="w-5 h-5 text-primary shrink-0" />
              <span>
                Además, este dispositivo tiene {localSales.length} {localSales.length === 1 ? 'venta' : 'ventas'} de este día sin enviar ({formatMoney(localTotal)}).
                {' '}Con eso las ventas serían unos {formatMoney(Number(preview.totalSales) + localTotal)}.
              </span>
            </p>
          )}

          {!preview.alreadyClosed && otherDevices.length > 0 && (
            <div className="mt-6 p-4 rounded-xl bg-warning/10 border border-warning/30 text-ink text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <div>
                <p>Estos dispositivos todavía tienen cosas sin enviar. Lo que llegue después del corte cuenta en el día en que llegue:</p>
                <ul className="mt-1 list-disc pl-5">
                  {otherDevices.map(d => (
                    <li key={`${d.name}-${d.lastSeenAt}`}>
                      {d.name}: {[
                        d.pendingSales > 0 && `${d.pendingSales} ${d.pendingSales === 1 ? 'venta' : 'ventas'}`,
                        d.pendingOps > 0 && `${d.pendingOps} ${d.pendingOps === 1 ? 'registro' : 'registros'}`,
                      ].filter(Boolean).join(' y ')} (visto {new Date(d.lastSeenAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {!preview.alreadyClosed && !!preview.unpaidOrders?.count && (
            <p className="mt-6 p-4 rounded-xl bg-warning/10 border border-warning/30 text-ink text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <span>
                Hay {preview.unpaidOrders.count} {preview.unpaidOrders.count === 1 ? 'pedido' : 'pedidos'} por cobrar ({formatMoney(preview.unpaidOrders.total)}) en Comandas.
                No entran en este corte; cóbralos antes de cerrar el día o contarán en el día en que se cobren.
              </span>
            </p>
          )}

          {!preview.alreadyClosed && queuedClose && (
            <p className="mt-6 p-4 rounded-xl bg-secondary/10 border border-secondary/30 text-ink text-sm flex items-start gap-2">
              <CloudOff className="w-5 h-5 text-secondary shrink-0" />
              <span>
                {queuedClose.error
                  ? `La PC no aceptó el corte guardado en este dispositivo: ${queuedClose.error}`
                  : 'El corte de este día está guardado en este dispositivo y se hará en la PC cuando vuelva la conexión.'}
              </span>
            </p>
          )}

          {!preview.alreadyClosed && !queuedClose && closeForm}
        </div>
      )}
    </div>
  );
}
