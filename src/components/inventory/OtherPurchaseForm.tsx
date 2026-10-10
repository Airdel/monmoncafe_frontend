import { useEffect, useState } from 'react';
import { Check, Loader2, Receipt } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { unwrap } from '../../lib/unwrap';
import { notifyError, toast } from '../../lib/dialogs';
import { formatMoney } from '../../lib/format';
import { EXPENSE_CATEGORIES, TOOL_CATEGORIES, type ExpenseCategory, type Tool, type ToolCategory } from '../../lib/tools';

interface SupplierRef { id: number; name: string }

const inputClass = 'w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none placeholder:text-ink/20';
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';
const chip = (on: boolean) => cn('py-2 px-2 rounded-lg text-xs font-medium border transition-all', on ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-ink/5 border-ink/10 text-ink/50');

type SaveAs = 'NO' | 'TOOL' | 'INGREDIENT';

/**
 * Buying pieces of a registered tool, or something that is not in the
 * system (a lighter, batteries…). Both count as an expense of the day.
 */
export interface PlainExpense {
  description: string;
  quantity: number;
  amount: number;
  category: Exclude<ExpenseCategory, 'TOOL'>;
  supplierId?: number;
  notes?: string;
}

export function OtherPurchaseForm({ mode, suppliers, canManage, initialDescription = '', onDone, recordPlain }: {
  mode: 'tool' | 'other';
  suppliers: SupplierRef[];
  /** Turning an extra into a tool or insumo is for admins and supervisors. */
  canManage: boolean;
  initialDescription?: string;
  onDone?: () => void;
  /** Records a one-off expense another way (the shopping list adds it as a checked item). */
  recordPlain?: (expense: PlainExpense) => Promise<void>;
}) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolId, setToolId] = useState('');
  const [description, setDescription] = useState(initialDescription);
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [category, setCategory] = useState<Exclude<ExpenseCategory, 'TOOL'>>('OPERATION');
  const [saveAs, setSaveAs] = useState<SaveAs>('NO');
  const [toolCategory, setToolCategory] = useState<ToolCategory>('UTENSIL');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'tool') return;
    api.get('/tools').then(res => setTools(unwrap<Tool[]>(res))).catch(err => notifyError(err));
  }, [mode]);

  const tool = tools.find(t => t.id === Number(toolId));
  const qty = Number(quantity);
  const cost = Number(amount);
  const needsWhole = mode === 'tool' || saveAs === 'TOOL';
  const valid = (mode === 'tool' ? !!tool : description.trim().length > 0)
    && qty > 0 && (!needsWhole || Number.isInteger(qty)) && cost > 0;

  const pickTool = (id: string) => {
    setToolId(id);
    const t = tools.find(x => x.id === Number(id));
    if (!t) return;
    const missing = Math.max(t.idealQuantity - t.quantity, 1);
    setQuantity(String(missing));
    setAmount(Number(t.unitCost) > 0 ? (missing * Number(t.unitCost)).toFixed(2) : '');
    setSupplierId(t.supplierId ? String(t.supplierId) : '');
  };

  const reset = () => {
    setToolId(''); setDescription(''); setQuantity('1'); setAmount(''); setSupplierId(''); setNotes(''); setSaveAs('NO');
  };

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    const common = {
      quantity: qty,
      ...(supplierId && { supplierId: Number(supplierId) }),
      ...(notes.trim() && { notes: notes.trim() }),
    };
    try {
      if (mode === 'tool' && tool) {
        await api.post(`/tools/${tool.id}/purchase`, { ...common, totalCost: Math.round(cost * 100) / 100 });
        toast.success(`${tool.name}: +${qty}. Cuenta como gasto de hoy.`);
      } else if (saveAs === 'NO' && recordPlain) {
        await recordPlain({ ...common, description: description.trim(), amount: Math.round(cost * 100) / 100, category });
        toast.success(`${description.trim()} registrado como gasto de hoy`);
      } else {
        await api.post('/other-expenses', {
          ...common,
          description: description.trim(),
          amount: Math.round(cost * 100) / 100,
          category,
          ...(saveAs !== 'NO' && { saveAs }),
          ...(saveAs === 'TOOL' && { toolCategory }),
        });
        toast.success(saveAs === 'TOOL' ? `${description.trim()} se agregó a Herramientas`
          : saveAs === 'INGREDIENT' ? `${description.trim()} se agregó como insumo`
          : `${description.trim()} registrado como gasto de hoy`);
      }
      reset();
      onDone?.();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
      {mode === 'tool' ? (
        <div>
          <label className={labelClass} htmlFor="op-tool">Herramienta</label>
          <select id="op-tool" value={toolId} onChange={e => pickTool(e.target.value)} className={inputClass}>
            <option value="">— Seleccionar —</option>
            {tools.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.quantity}/{t.idealQuantity})</option>
            ))}
          </select>
          {tools.length === 0 && <p className="text-ink/40 text-xs mt-2">Primero registra herramientas en Inventario › Herramientas.</p>}
        </div>
      ) : (
        <div>
          <label className={labelClass} htmlFor="op-desc">¿Qué compraste?</label>
          <input id="op-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Encendedor, pilas, cinta…" className={inputClass} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="op-qty">Cantidad</label>
          <input id="op-qty" type="number" inputMode={needsWhole ? 'numeric' : 'decimal'} min="0" step={needsWhole ? '1' : 'any'} value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="op-amount">Pagué en total</label>
          <input id="op-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="$0.00" className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="op-store">Tienda</label>
        <select id="op-store" value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputClass}>
          <option value="">Sin tienda</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {mode === 'other' && (
        <>
          {saveAs === 'NO' && (
            <div>
              <p className={labelClass}>Tipo de gasto</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EXPENSE_CATEGORIES.map(c => (
                  <button key={c.key} type="button" onClick={() => setCategory(c.key)} className={chip(category === c.key)}>{c.label}</button>
                ))}
              </div>
            </div>
          )}
          {canManage && (
            <div>
              <p className={labelClass}>¿Se va a comprar seguido?</p>
              <div className="flex flex-col gap-2">
                {([
                  ['NO', 'No, solo esta vez', 'Queda como gasto del día.'],
                  ['TOOL', 'Guardarlo como herramienta', 'Aparece en Inventario › Herramientas, con lo que compraste como lo que debes tener.'],
                  ['INGREDIENT', 'Guardarlo como insumo', 'Se gasta con el uso, como servilletas o popotes. Entra al stock en piezas.'],
                ] as const).map(([key, label, hint]) => (
                  <button key={key} type="button" onClick={() => setSaveAs(key)} className={cn('text-left px-3 py-2.5 rounded-xl border transition-all', saveAs === key ? 'bg-primary/10 border-primary/40' : 'bg-ink/5 border-ink/10')}>
                    <span className={cn('text-sm font-medium', saveAs === key ? 'text-primary' : 'text-ink/70')}>{label}</span>
                    <span className="block text-xs text-ink/40">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {saveAs === 'TOOL' && (
            <div>
              <p className={labelClass}>Categoría de herramienta</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TOOL_CATEGORIES.map(c => (
                  <button key={c.key} type="button" onClick={() => setToolCategory(c.key)} className={cn(chip(toolCategory === c.key), 'flex items-center justify-center gap-1.5')}>
                    <c.icon className="w-3.5 h-3.5" /> {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <label className={labelClass} htmlFor="op-notes">Notas (opcional)</label>
        <input id="op-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ticket, motivo…" className={inputClass} />
      </div>

      <p className="text-ink/40 text-xs flex items-center gap-1.5">
        <Receipt className="w-3.5 h-3.5 shrink-0" />
        {saveAs === 'INGREDIENT'
          ? 'Como insumo, su costo entra al stock y no al gasto del día.'
          : <>Se registra como gasto de hoy{cost > 0 && <> ({formatMoney(cost)})</>} y se resta en el corte del día.</>}
      </p>

      <button type="submit" disabled={!valid || saving} className="w-full py-3 rounded-xl bg-cta text-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Registrar compra</>}
      </button>
    </form>
  );
}
