import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Lock, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { formatDay, formatMoney, todayISO } from '../../lib/format';
import { unwrap } from '../../lib/unwrap';
import { ClosingBreakdown } from './ClosingBreakdown';
import { inputClass, labelClass, primaryButtonClass } from './styles';
import type { ClosingPreview } from './types';

export function ClosingTab({ onClosed }: { onClosed: () => void }) {
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

  const closeDay = async () => {
    if (!preview) return;
    const ok = window.confirm(
      `¿Cerrar el día ${formatDay(date)}?\n\nVentas: ${formatMoney(preview.totalSales)}\nUtilidad neta: ${formatMoney(preview.netProfit)}\n\nLas ventas de ese día quedarán ligadas a este corte.`,
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      await api.post('/closings', { date, notes: notes.trim() || undefined });
      setNotes('');
      refresh();
      onClosed();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
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
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
        <div className="flex-1">
          <p className="font-headline text-xl font-bold text-white">{formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          {preview?.alreadyClosed ? (
            <p className="flex items-center gap-2 text-secondary text-sm mt-1"><Lock className="w-4 h-4" /> Este día ya está cerrado. Puedes consultarlo en el historial.</p>
          ) : (
            <p className="text-white/50 text-sm mt-1">Vista previa en vivo; nada se guarda hasta que cierres el día.</p>
          )}
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white transition-all" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {loading && !preview ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="glass-panel p-6 text-error">{error}</div>
      ) : preview && (
        <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <ClosingBreakdown totals={preview} details={preview.details} />

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
