import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Power, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { confirm, notifyError } from '../../lib/dialogs';
import { formatMoney } from '../../lib/format';
import { unwrap } from '../../lib/unwrap';
import { inputClass, labelClass, primaryButtonClass } from './styles';
import { FREQUENCY_LABELS, toDailyAmount, type ExpenseFrequency, type ExpenseSummary, type FixedExpense } from './types';
import { Modal } from '../ui/Modal';
import { StatCard } from './ui';

interface ExpenseForm {
  name: string;
  amount: string;
  frequency: ExpenseFrequency;
  notes: string;
}

const EMPTY_FORM: ExpenseForm = { name: '', amount: '', frequency: 'MONTHLY', notes: '' };

export function ExpensesTab() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // null = closed, 'new' = create, number = editing that id
  const [editing, setEditing] = useState<'new' | number | null>(null);
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/expenses', { params: { includeInactive: showInactive || undefined } }),
      api.get('/expenses/summary'),
    ])
      .then(([listRes, summaryRes]) => {
        if (cancelled) return;
        setExpenses(unwrap<FixedExpense[]>(listRes));
        setSummary(unwrap<ExpenseSummary>(summaryRes));
        setError('');
      })
      .catch(err => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showInactive, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey(k => k + 1);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };

  const openEdit = (e: FixedExpense) => {
    setForm({ name: e.name, amount: String(Number(e.amount)), frequency: e.frequency, notes: e.notes ?? '' });
    setEditing(e.id);
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.name.trim() || !Number.isFinite(amount) || amount < 0) return;
    const payload = {
      name: form.name.trim(),
      amount: Math.round(amount * 100) / 100,
      frequency: form.frequency,
      notes: form.notes.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/expenses', payload);
      else await api.patch(`/expenses/${editing}`, payload);
      setEditing(null);
      reload();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (e: FixedExpense) => {
    if (e.isActive && !await confirm({
      title: `¿Desactivar “${e.name}”?`,
      message: 'Dejará de contarse en los cortes nuevos; los cortes ya cerrados no cambian.',
      confirmLabel: 'Desactivar',
      tone: 'danger',
    })) return;
    try {
      if (e.isActive) await api.delete(`/expenses/${e.id}`);
      else await api.patch(`/expenses/${e.id}`, { isActive: true });
      reload();
    } catch (err) {
      notifyError(err);
    }
  };

  const formAmount = Number(form.amount);
  const formDaily = Number.isFinite(formAmount) && formAmount > 0 ? toDailyAmount(formAmount, form.frequency) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Gasto fijo diario" value={formatMoney(summary?.dailyTotal ?? 0)} hint="Se descuenta en cada corte" tone="primary" />
        <StatCard label="Equivalente mensual" value={formatMoney(summary?.monthlyTotal ?? 0)} />
        <div className="glass-panel p-5 flex flex-col justify-between gap-3">
          <button onClick={openCreate} className={primaryButtonClass}><Plus className="w-5 h-5" /> Nuevo gasto</button>
          <label className="flex items-center gap-2 text-ink/60 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => { setLoading(true); setShowInactive(e.target.checked); }}
              className="accent-primary"
            />
            Mostrar desactivados
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="glass-panel p-6 text-error">{error}</div>
      ) : expenses.length === 0 ? (
        <div className="glass-panel p-10 text-center text-ink/50">Aún no registras gastos fijos (renta, luz, sueldos…).</div>
      ) : (
        <div className="glass-panel divide-y divide-ink/5">
          {expenses.map(e => (
            <div key={e.id} className={`flex items-center gap-2 sm:gap-4 p-4 ${e.isActive ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-ink font-medium truncate">{e.name}</p>
                <p className="text-ink/40 text-xs font-label mt-0.5">
                  {formatMoney(e.amount)} {FREQUENCY_LABELS[e.frequency].toLowerCase()}
                  {e.notes ? ` · ${e.notes}` : ''}
                  {!e.isActive && ' · desactivado'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-primary font-semibold">{formatMoney(toDailyAmount(Number(e.amount), e.frequency))}</p>
                <p className="text-ink/40 text-xs font-label">por día</p>
              </div>
              <button onClick={() => openEdit(e)} className="p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5" aria-label={`Editar ${e.name}`}>
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleActive(e)}
                className={`p-2 rounded-lg ${e.isActive ? 'text-error/70 hover:text-error hover:bg-error/10' : 'text-secondary/70 hover:text-secondary hover:bg-secondary/10'}`}
                aria-label={e.isActive ? `Desactivar ${e.name}` : `Reactivar ${e.name}`}
                title={e.isActive ? 'Desactivar' : 'Reactivar'}
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <Modal title={editing === 'new' ? 'Nuevo gasto fijo' : 'Editar gasto fijo'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="expense-name">Concepto</label>
              <input id="expense-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Renta, luz, internet…" className={inputClass} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="expense-amount">Monto</label>
                <input id="expense-amount" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="expense-frequency">Frecuencia</label>
                <select id="expense-frequency" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as ExpenseFrequency })} className={inputClass}>
                  {(Object.keys(FREQUENCY_LABELS) as ExpenseFrequency[]).map(f => (
                    <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="expense-notes">Notas (opcional)</label>
              <input id="expense-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} />
            </div>
            <p className="text-ink/50 text-sm">
              Equivale a <span className="text-primary font-semibold">{formatMoney(formDaily)}</span> por día en el corte.
            </p>
            <button onClick={save} disabled={saving || !form.name.trim() || form.amount === ''} className={`${primaryButtonClass} w-full`}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
