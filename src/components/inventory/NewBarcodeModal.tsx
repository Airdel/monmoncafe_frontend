import { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';
import { inputClass, labelClass, primaryButtonClass } from '../finance/styles';
import { cn } from '../../lib/cn';
import { notifyError, toast } from '../../lib/dialogs';
import { unitLabel } from '../../lib/modifiers';
import { matchesSearch } from '../../lib/search';
import { QUEUED_MESSAGE, sendOrQueue } from '../../lib/offline';
import {
  BARCODES_URL, LABEL_UNITS, labelUnitFor, localId, lookupProduct, toIngredientUnit,
  type Barcode, type LabelUnit, type NewBarcode, type ProductHint,
} from '../../lib/barcodes';

export type BarcodeIngredient = { id: number; name: string; unit: string };

/**
 * First scan of a product: says which insumo it is and how much one package
 * holds, so every later scan fills the purchase by itself. Open Food Facts
 * suggests the name and content when it knows the code.
 */
export function NewBarcodeModal({ code, ingredients, initialIngredientId, onSaved, onClose }: {
  code: string;
  ingredients: BarcodeIngredient[];
  /** When scanning from an item's purchase, that item's insumo. */
  initialIngredientId?: number;
  onSaved: (barcode: Barcode) => void;
  onClose: () => void;
}) {
  const [ingredientId, setIngredientId] = useState<number | null>(initialIngredientId ?? null);
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState('');
  const initial = ingredients.find(i => i.id === initialIngredientId);
  const [unit, setUnit] = useState<LabelUnit>(initial ? labelUnitFor(initial.unit) : 'g');
  const [label, setLabel] = useState('');
  const [brand, setBrand] = useState('');
  const [hint, setHint] = useState<ProductHint | null | 'loading'>('loading');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    lookupProduct(code).then(found => {
      if (!active) return;
      setHint(found);
      if (!found) return;
      if (found.name) setLabel(l => l || [found.name, found.amount && found.unit ? `${found.amount} ${found.unit}` : ''].filter(Boolean).join(' '));
      if (found.brand) setBrand(b => b || found.brand!);
      if (found.amount && found.unit) {
        setAmount(a => a || String(found.amount));
        setUnit(found.unit);
      }
    });
    return () => { active = false; };
  }, [code]);

  const ingredient = ingredients.find(i => i.id === ingredientId);
  const packageQuantity = ingredient && Number(amount) > 0 ? toIngredientUnit(Number(amount), unit, ingredient.unit) : null;
  const mismatch = ingredient && Number(amount) > 0 && packageQuantity === null;
  const valid = !!ingredient && packageQuantity !== null && packageQuantity > 0;
  const visible = ingredients.filter(i => matchesSearch(search, i.name)).slice(0, 30);

  const pick = (i: BarcodeIngredient) => {
    setIngredientId(i.id);
    // A label in grams fits an insumo in kg; one in pieces needs its own unit
    if (toIngredientUnit(1, unit, i.unit) === null) setUnit(labelUnitFor(i.unit));
  };

  const save = async () => {
    if (!valid || !ingredient) return;
    setSaving(true);
    const body: NewBarcode = {
      code,
      ingredientId: ingredient.id,
      packageQuantity: packageQuantity!,
      ...(label.trim() && { label: label.trim() }),
      ...(brand.trim() && { brand: brand.trim() }),
    };
    try {
      const sent = await sendOrQueue<Barcode>(BARCODES_URL, body, `Código ${code}: ${ingredient.name}`);
      if (sent.queued) toast.success(QUEUED_MESSAGE);
      onSaved(sent.queued ? {
        id: localId(),
        code,
        ingredientId: ingredient.id,
        packageQuantity: String(packageQuantity),
        label: body.label ?? null,
        brand: body.brand ?? null,
        ingredient,
        prices: [],
        queued: true,
      } : { ...sent.data, prices: sent.data.prices ?? [] });
    } catch (err) {
      notifyError(err);
      setSaving(false);
    }
  };

  return (
    <Modal title="Producto nuevo" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
        <p className="text-ink/60 text-sm -mt-2">
          Código <span className="font-mono text-ink/80">{code}</span>. Dile a la app qué insumo es; las siguientes veces se llenará solo.
        </p>
        {hint === 'loading' ? (
          <p className="text-ink/40 text-xs flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Buscando el producto en Open Food Facts…</p>
        ) : hint ? (
          <p className="text-secondary text-xs flex items-center gap-2"><Sparkles className="w-3 h-3" /> Sugerido por Open Food Facts. Revísalo antes de guardar.</p>
        ) : null}

        <div>
          <p className={labelClass}>¿Qué insumo es?</p>
          {ingredient ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30">
              <span className="font-medium text-ink truncate">{ingredient.name} <span className="text-ink/40 text-xs">({unitLabel(ingredient.unit)})</span></span>
              <button type="button" onClick={() => setIngredientId(null)} className="text-primary text-sm font-medium shrink-0">Cambiar</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar insumo" />
              <div className="max-h-48 overflow-y-auto rounded-xl border border-ink/10 divide-y divide-ink/5">
                {visible.length === 0 && <p className="p-4 text-center text-ink/40 text-sm">Ningún insumo coincide</p>}
                {visible.map(i => (
                  <button key={i.id} type="button" onClick={() => pick(i)} className="w-full text-left px-4 py-3 text-sm text-ink hover:bg-primary/5">
                    {i.name} <span className="text-ink/40 text-xs">({unitLabel(i.unit)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="barcode-amount">Contenido de un paquete</label>
          <div className="flex gap-2">
            <input id="barcode-amount" type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1" className={cn(inputClass, 'flex-1 min-w-0')} />
            <div className="flex bg-ink/5 rounded-xl p-1 border border-ink/10 shrink-0">
              {LABEL_UNITS.map(u => (
                <button key={u.key} type="button" onClick={() => setUnit(u.key)} className={cn('px-2.5 py-2 rounded-lg text-xs font-medium transition-all', unit === u.key ? 'bg-primary/20 text-primary' : 'text-ink/50')}>{u.key}</button>
              ))}
            </div>
          </div>
          <p className={cn('text-xs mt-2', mismatch ? 'text-warning' : 'text-ink/40')}>
            {mismatch
              ? `${ingredient!.name} se cuenta en ${unitLabel(ingredient!.unit)}: escribe el contenido en esa unidad.`
              : packageQuantity && ingredient
                ? `Cada paquete suma ${packageQuantity.toLocaleString('es-MX', { maximumFractionDigits: 4 })} ${unitLabel(ingredient.unit)} al inventario.`
                : 'Lo que dice la etiqueta: 1 l, 500 g, 50 pz…'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="barcode-label">Presentación</label>
            <input id="barcode-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={191} placeholder="Lala entera 1 l" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="barcode-brand">Marca</label>
            <input id="barcode-brand" value={brand} onChange={e => setBrand(e.target.value)} maxLength={191} placeholder="Opcional" className={inputClass} />
          </div>
        </div>

        <button type="submit" disabled={!valid || saving} className={primaryButtonClass}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Guardar y seguir</>}
        </button>
      </form>
    </Modal>
  );
}
