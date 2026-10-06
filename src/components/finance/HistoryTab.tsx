import { useEffect, useState } from 'react';
import { ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { confirm, notifyError } from '../../lib/dialogs';
import { formatDay, formatMoney, todayISO } from '../../lib/format';
import { unwrap } from '../../lib/unwrap';
import { ClosingBreakdown } from './ClosingBreakdown';
import { inputClass, labelClass } from './styles';
import type { DailyClosing } from './types';
import { Modal } from '../ui/Modal';

export function HistoryTab({ isAdmin, reloadKey }: { isAdmin: boolean; reloadKey: number }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [localReload, setLocalReload] = useState(0);
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<DailyClosing | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/closings', { params: { from: from || undefined, to: to || undefined } })
      .then(res => { if (!cancelled) { setClosings(unwrap<DailyClosing[]>(res)); setError(''); } })
      .catch(err => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, reloadKey, localReload]);

  const changeRange = (setter: (v: string) => void, value: string) => {
    setLoading(true);
    setter(value);
  };

  const openDetail = async (closing: DailyClosing) => {
    setSelected(closing);
    setDetailLoading(true);
    try {
      setSelected(unwrap<DailyClosing>(await api.get(`/closings/${closing.id}`)));
    } catch (err) {
      notifyError(err);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const reopen = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: `¿Reabrir el día ${formatDay(selected.date)}?`,
      message: 'Se borra este corte y sus ventas vuelven a quedar pendientes de cierre.',
      confirmLabel: 'Reabrir día',
      tone: 'danger',
    });
    if (!ok) return;
    setReopening(true);
    try {
      await api.delete(`/closings/${selected.id}`);
      setSelected(null);
      setLoading(true);
      setLocalReload(k => k + 1);
    } catch (err) {
      notifyError(err);
    } finally {
      setReopening(false);
    }
  };

  const totalNet = closings.reduce((sum, c) => sum + Number(c.netProfit), 0);
  const totalSales = closings.reduce((sum, c) => sum + Number(c.totalSales), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div>
          <label className={labelClass} htmlFor="history-from">Desde</label>
          <input id="history-from" type="date" value={from} max={to || todayISO()} onChange={e => changeRange(setFrom, e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="history-to">Hasta</label>
          <input id="history-to" type="date" value={to} min={from || undefined} max={todayISO()} onChange={e => changeRange(setTo, e.target.value)} className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Ventas del periodo</p>
          <p className="font-headline text-2xl font-bold text-primary">{formatMoney(totalSales)}</p>
        </div>
        <div>
          <p className={labelClass}>Utilidad neta del periodo</p>
          <p className={`font-headline text-2xl font-bold ${totalNet >= 0 ? 'text-secondary' : 'text-error'}`}>{formatMoney(totalNet)}</p>
        </div>
      </div>
      {!from && !to && <p className="text-ink/40 text-xs font-label -mt-3">Mostrando los últimos 31 cortes.</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="glass-panel p-6 text-error">{error}</div>
      ) : closings.length === 0 ? (
        <div className="glass-panel p-10 text-center text-ink/50">Aún no hay cortes en este periodo.</div>
      ) : (
        <div className="glass-panel divide-y divide-ink/5">
          {closings.map(c => (
            <button key={c.id} onClick={() => openDetail(c)} className="w-full flex items-center gap-3 sm:gap-4 p-4 text-left hover:bg-ink/5 transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-ink font-medium">{formatDay(c.date)}</p>
                <p className="text-ink/40 text-xs font-label mt-0.5">{c.totalTransactions} tickets · cerró {c.user?.name ?? '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-primary font-semibold">{formatMoney(c.totalSales)}</p>
                <p className={`text-xs font-label ${Number(c.netProfit) >= 0 ? 'text-secondary' : 'text-error'}`}>Neta {formatMoney(c.netProfit)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-ink/30" />
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Modal title={`Corte del ${formatDay(selected.date)}`} onClose={() => setSelected(null)} wide>
          {detailLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-ink/50 text-sm">
                Cerrado por {selected.user?.name ?? '—'} el {new Date(selected.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              {selected.notes && <p className="text-ink/70 text-sm italic">“{selected.notes}”</p>}
              <ClosingBreakdown totals={selected} details={selected.details ?? []} />
              {isAdmin && (
                <button onClick={reopen} disabled={reopening} className="self-start flex items-center gap-2 px-4 py-2 rounded-xl border border-error/30 text-error/80 hover:text-error hover:bg-error/10 transition-all disabled:opacity-40">
                  {reopening ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reabrir día
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
