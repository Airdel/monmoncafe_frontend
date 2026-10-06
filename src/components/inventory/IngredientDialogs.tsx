import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Power, Ruler, Save, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { unwrap } from '../../lib/unwrap';
import { getErrorMessage } from '../../lib/errors';
import { notifyError } from '../../lib/dialogs';
import { formatMoney } from '../../lib/format';
import { unitLabel } from '../../lib/modifiers';
import { Modal } from '../ui/Modal';

export type Unit = 'GRAMS' | 'KILOGRAMS' | 'MILLILITERS' | 'LITERS' | 'PIECES';
export type Priority = 'ESSENTIAL' | 'IMPORTANT' | 'OPTIONAL';

export interface ManagedIngredient {
  id: number;
  name: string;
  unit: string;
  currentStock: string;
  minStock: string;
  maxStock?: string | null;
  currentCostPerUnit: string;
  priority?: Priority;
  supplierId?: number | null;
  isActive?: boolean;
}

interface SupplierRef { id: number; name: string }

interface Usage {
  recipes: { productId: number; name: string; isActive: boolean; quantity: string }[];
  modifierOptions: { optionId: number; name: string; group: string; quantity: string }[];
  history: { movements: number; purchases: number };
  hasHistory: boolean;
}

const UNITS: { key: Unit; label: string }[] = [
  { key: 'GRAMS', label: 'Gramos (g)' },
  { key: 'KILOGRAMS', label: 'Kilogramos (kg)' },
  { key: 'MILLILITERS', label: 'Mililitros (ml)' },
  { key: 'LITERS', label: 'Litros (l)' },
  { key: 'PIECES', label: 'Piezas (pz)' },
];

const PRIORITIES: { key: Priority; label: string; active: string }[] = [
  { key: 'ESSENTIAL', label: 'Esencial', active: 'bg-error/15 text-error border-error/30' },
  { key: 'IMPORTANT', label: 'Importante', active: 'bg-primary/15 text-primary border-primary/30' },
  { key: 'OPTIONAL', label: 'Prescindible', active: 'bg-ink/10 text-ink/70 border-ink/20' },
];

const inputClass = 'w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none placeholder:text-ink/20';
const selectClass = `${inputClass} appearance-none cursor-pointer [&>option]:bg-raised [&>option]:text-ink`;
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';
const saveButton = 'w-full py-3 rounded-xl bg-cta text-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50';

const qty = (value: number | string) => Number(value).toLocaleString('es-MX', { maximumFractionDigits: 4 });

// Mirrors the backend: grams/kilograms and millilitres/litres convert on their own
const KIND: Record<string, string> = { GRAMS: 'mass', KILOGRAMS: 'mass', MILLILITERS: 'volume', LITERS: 'volume', PIECES: 'count' };
const BASE: Record<string, number> = { GRAMS: 1, KILOGRAMS: 1000, MILLILITERS: 1, LITERS: 1000, PIECES: 1 };

/** How many `from` units make one `to` unit, when it is known. */
const knownFactor = (from: string, to: string) => (KIND[from] === KIND[to] ? BASE[to] / BASE[from] : null);

const useUsage = (id: number) => {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/inventory/ingredients/${id}/usage`)
      .then(res => setUsage(unwrap<Usage>(res)))
      .catch(err => setError(getErrorMessage(err)));
  }, [id]);
  return { usage, error };
};

/** Create or edit an insumo: name, store, priority and the alert levels. */
export function IngredientFormModal({ ingredient, suppliers, onClose, onSaved, onChangeUnit }: {
  ingredient: ManagedIngredient | null;
  suppliers: SupplierRef[];
  onClose: () => void;
  onSaved: () => void;
  onChangeUnit: (ingredient: ManagedIngredient) => void;
}) {
  const [form, setForm] = useState({
    name: ingredient?.name ?? '',
    unit: (ingredient?.unit ?? 'GRAMS') as Unit,
    supplierId: ingredient?.supplierId ?? 0,
    priority: ingredient?.priority ?? 'IMPORTANT',
    minStock: ingredient ? String(Number(ingredient.minStock)) : '',
    maxStock: ingredient?.maxStock != null ? String(Number(ingredient.maxStock)) : '',
  });
  const [saving, setSaving] = useState(false);

  const min = Number(form.minStock || 0);
  const max = form.maxStock === '' ? null : Number(form.maxStock);
  const rangeError = max !== null && max < min ? 'El máximo no puede ser menor que el mínimo' : '';
  const unit = unitLabel(form.unit);

  const save = async () => {
    if (!form.name.trim() || rangeError) return;
    const body = {
      name: form.name.trim(),
      supplierId: form.supplierId || null,
      priority: form.priority,
      minStock: min,
      maxStock: max,
    };
    setSaving(true);
    try {
      if (ingredient) await api.patch(`/inventory/ingredients/${ingredient.id}`, body);
      else await api.post('/inventory/ingredients', { ...body, unit: form.unit });
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={ingredient ? 'Editar insumo' : 'Nuevo insumo'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="ingredient-name">Nombre</label>
          <input id="ingredient-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Leche entera, Vaso 16oz…" className={inputClass} autoFocus={!ingredient} />
        </div>

        <div>
          <label className={labelClass} htmlFor="ingredient-unit">Unidad de medida</label>
          {ingredient ? (
            <div className="flex items-center gap-3">
              <p className="flex-1 px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink/70">
                {UNITS.find(u => u.key === ingredient.unit)?.label ?? ingredient.unit}
              </p>
              <button type="button" onClick={() => onChangeUnit(ingredient)} className="px-4 py-3 rounded-xl border border-ink/10 text-ink/70 hover:text-primary hover:border-primary/30 text-sm font-medium flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Cambiar
              </button>
            </div>
          ) : (
            <select id="ingredient-unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as Unit })} className={selectClass}>
              {UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="ingredient-supplier">Tienda habitual</label>
          <select id="ingredient-supplier" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: Number(e.target.value) })} className={selectClass}>
            <option value={0}>Sin tienda</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <p className={labelClass}>Prioridad en la lista de compras</p>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setForm({ ...form, priority: p.key })}
                className={`flex-1 py-2.5 rounded-lg text-xs font-label uppercase tracking-wider border transition-all ${form.priority === p.key ? p.active : 'bg-ink/5 border-ink/10 text-ink/50 hover:text-ink'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="ingredient-min">Mínimo <span className="normal-case">({unit})</span></label>
            <input id="ingredient-min" type="number" min={0} inputMode="decimal" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} placeholder="0" className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label className={labelClass} htmlFor="ingredient-max">Máximo <span className="normal-case">({unit})</span></label>
            <input id="ingredient-max" type="number" min={0} inputMode="decimal" value={form.maxStock} onChange={e => setForm({ ...form, maxStock: e.target.value })} placeholder={min > 0 ? String(min * 2) : 'Opcional'} className={`${inputClass} font-mono`} />
          </div>
        </div>
        <p className={`text-xs -mt-2 ${rangeError ? 'text-error' : 'text-ink/40'}`}>
          {rangeError || 'Con el stock en el mínimo o debajo, el insumo sale como "Stock bajo" y entra a la lista de compras, que lo resurte hasta el máximo (sin máximo, el doble del mínimo).'}
        </p>

        <button onClick={save} disabled={saving || !form.name.trim() || !!rangeError} className={saveButton}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar
        </button>
      </div>
    </Modal>
  );
}

/**
 * Switches the unit and shows what it converts: stock, levels, cost and the
 * recipes that use the insumo, so costs are not silently changed.
 */
export function ChangeUnitModal({ ingredient, onClose, onSaved }: {
  ingredient: ManagedIngredient;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { usage, error } = useUsage(ingredient.id);
  const from = ingredient.unit;
  const [to, setTo] = useState<Unit>(() => UNITS.find(u => u.key !== from)!.key);
  const [equivalence, setEquivalence] = useState('');
  const [saving, setSaving] = useState(false);

  const known = knownFactor(from, to);
  // Ask the way people think about it: "1 piece = 30 g", "1 bag = 2 g"
  const anchorIsNew = to === 'PIECES' || from !== 'PIECES';
  const anchor = anchorIsNew ? to : from;
  const other = anchorIsNew ? from : to;
  const x = Number(equivalence);
  const factor = known ?? (x > 0 ? (anchorIsNew ? x : 1 / x) : null);

  const convert = (value: number | string) => (factor ? Number(value) / factor : 0);
  const rows: [string, string, string][] = factor ? [
    ['Stock', `${qty(ingredient.currentStock)} ${unitLabel(from)}`, `${qty(convert(ingredient.currentStock))} ${unitLabel(to)}`],
    ['Mínimo', `${qty(ingredient.minStock)} ${unitLabel(from)}`, `${qty(convert(ingredient.minStock))} ${unitLabel(to)}`],
    ...(ingredient.maxStock != null ? [['Máximo', `${qty(ingredient.maxStock)} ${unitLabel(from)}`, `${qty(convert(ingredient.maxStock))} ${unitLabel(to)}`] as [string, string, string]] : []),
    ['Costo', `${formatMoney(ingredient.currentCostPerUnit)} / ${unitLabel(from)}`, `${formatMoney(Number(ingredient.currentCostPerUnit) * factor)} / ${unitLabel(to)}`],
    ...(usage?.recipes ?? []).map(r => [r.name, `${qty(r.quantity)} ${unitLabel(from)}`, `${qty(convert(r.quantity))} ${unitLabel(to)}`] as [string, string, string]),
    ...(usage?.modifierOptions ?? []).map(o => [`${o.group}: ${o.name}`, `${qty(o.quantity)} ${unitLabel(from)}`, `${qty(convert(o.quantity))} ${unitLabel(to)}`] as [string, string, string]),
  ] : [];

  const save = async () => {
    if (!factor) return;
    setSaving(true);
    try {
      await api.patch(`/inventory/ingredients/${ingredient.id}/unit`, { unit: to, factor });
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Cambiar unidad" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-primary font-medium">{ingredient.name}</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <p className={labelClass}>Ahora</p>
            <p className="px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink/70 truncate">{UNITS.find(u => u.key === from)?.label ?? from}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-ink/40 mb-3.5" />
          <div>
            <label className={labelClass} htmlFor="new-unit">Nueva</label>
            <select id="new-unit" value={to} onChange={e => { setTo(e.target.value as Unit); setEquivalence(''); }} className={selectClass}>
              {UNITS.filter(u => u.key !== from).map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
        </div>

        {known === null && (
          <div>
            <label className={labelClass} htmlFor="equivalence">Equivalencia</label>
            <div className="flex items-center gap-2">
              <span className="text-ink/70 whitespace-nowrap">1 {unitLabel(anchor)} =</span>
              <input id="equivalence" type="number" min={0} inputMode="decimal" value={equivalence} onChange={e => setEquivalence(e.target.value)} placeholder="0" className={`${inputClass} font-mono`} autoFocus />
              <span className="text-ink/70">{unitLabel(other)}</span>
            </div>
            <p className="text-ink/40 text-xs mt-1.5">
              Por ejemplo, si una pieza pesa 30 g, escribe 30. Si solo quieres corregir la etiqueta porque las cantidades ya estaban en {unitLabel(to)}, escribe 1.
            </p>
          </div>
        )}

        {error ? (
          <p className="text-error text-sm">{error}</p>
        ) : !usage ? (
          <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : factor ? (
          <div>
            <p className={labelClass}>Así quedará</p>
            <div className="rounded-xl border border-ink/10 divide-y divide-ink/5 max-h-60 overflow-y-auto text-sm">
              {rows.map(([label, before, after]) => (
                <div key={label} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 min-w-0 truncate text-ink/70">{label}</span>
                  <span className="font-mono text-ink/40 text-xs whitespace-nowrap">{before}</span>
                  <ArrowRight className="w-3 h-3 text-ink/30 shrink-0" />
                  <span className="font-mono text-ink whitespace-nowrap">{after}</span>
                </div>
              ))}
            </div>
            <p className="text-ink/40 text-xs mt-1.5">Las recetas y opciones se ajustan solas, así su costo no cambia. Los movimientos y compras anteriores se quedan en {unitLabel(from)}.</p>
          </div>
        ) : null}

        <button onClick={save} disabled={saving || !factor || !usage} className={saveButton}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ruler className="w-5 h-5" />} Cambiar a {unitLabel(to)}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Deletes an insumo after showing where it is used. One with history
 * (movements, purchases, closings) is deactivated so reports keep it.
 */
export function DeleteIngredientModal({ ingredient, onClose, onDone }: {
  ingredient: ManagedIngredient;
  onClose: () => void;
  onDone: () => void;
}) {
  const { usage, error } = useUsage(ingredient.id);
  const [deleting, setDeleting] = useState(false);
  const usedIn = usage ? usage.recipes.length + usage.modifierOptions.length : 0;

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/inventory/ingredients/${ingredient.id}`, { params: { force: usedIn > 0 || undefined } });
      onDone();
    } catch (err) {
      notifyError(err);
      setDeleting(false);
    }
  };

  return (
    <Modal title={usage?.hasHistory ? 'Desactivar insumo' : 'Eliminar insumo'} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-primary font-medium">{ingredient.name}</p>
        {error ? (
          <p className="text-error text-sm">{error}</p>
        ) : !usage ? (
          <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <>
            {usedIn > 0 ? (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
                <p className="flex items-center gap-2 text-warning font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> Se usa en {usedIn} {usedIn === 1 ? 'receta u opción' : 'recetas u opciones'}
                </p>
                <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 text-ink/70">
                  {usage.recipes.map(r => (
                    <li key={`r${r.productId}`} className="flex justify-between gap-3">
                      <span className="truncate">{r.name}{!r.isActive && <span className="text-ink/40"> · inactivo</span>}</span>
                      <span className="font-mono text-ink/40 text-xs whitespace-nowrap">{qty(r.quantity)} {unitLabel(ingredient.unit)}</span>
                    </li>
                  ))}
                  {usage.modifierOptions.map(o => (
                    <li key={`o${o.optionId}`} className="flex justify-between gap-3">
                      <span className="truncate">{o.group}: {o.name}</span>
                      <span className="font-mono text-ink/40 text-xs whitespace-nowrap">{qty(o.quantity)} {unitLabel(ingredient.unit)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-ink/60">Se quitará de todas ellas y su costo bajará.</p>
              </div>
            ) : (
              <p className="text-ink/60 text-sm">No lo usa ninguna receta ni opción.</p>
            )}
            <p className="text-ink/60 text-sm">
              {usage.hasHistory
                ? 'Tiene movimientos o compras registradas, así que se desactivará en lugar de borrarse: deja de aparecer en el inventario y las compras, y los reportes conservan su historial. Puedes reactivarlo con "Mostrar desactivados".'
                : 'No tiene historial, así que se borrará por completo.'}
            </p>
          </>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-ink/10 text-ink/60 hover:text-ink font-medium">Cancelar</button>
          <button onClick={remove} disabled={deleting || !usage} className="flex-1 py-3 rounded-xl bg-error/15 border border-error/30 text-error font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : usage?.hasHistory ? <Power className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            {usage?.hasHistory ? 'Desactivar' : 'Eliminar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
