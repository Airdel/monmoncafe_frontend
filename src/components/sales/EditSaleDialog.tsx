import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Banknote, Loader2, Minus, Plus, Tag, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { OptionsPicker } from './OptionsPicker';
import { DiscountDialog } from './DiscountDialog';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { notifyError, toast } from '../../lib/dialogs';
import { formatMoney } from '../../lib/format';
import { unwrap } from '../../lib/unwrap';
import { orderTotals, type OrderDiscounts } from '../../lib/discounts';
import type { ModifierGroup, ModifierOption } from '../../lib/modifiers';
import type { SaleRow } from './types';

interface Product {
  id: number;
  name: string;
  sellingPrice: string;
  isActive: boolean;
  modifierGroups?: { groupId: number }[];
}

interface Line {
  key: string;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  optionIds: number[];
  optionNames: string[];
}

const fieldClass = 'w-full bg-ink/5 border border-ink/10 rounded-xl px-4 py-3 text-ink placeholder-ink/30 focus:outline-none focus:border-primary/50 transition-all';
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';

const lineKey = (productId: number, optionIds: number[]) =>
  [productId, ...[...optionIds].sort((a, b) => a - b)].join('-');

/** What the backend needs to rebuild the items, to tell whether they changed. */
const itemsPayload = (lines: Line[], lineDiscounts: Record<string, number>) => lines.map(l => ({
  productId: l.productId,
  quantity: l.quantity,
  ...(l.optionIds.length > 0 && { modifierOptionIds: l.optionIds }),
  ...(lineDiscounts[l.key] > 0 && { discount: lineDiscounts[l.key] }),
}));

function initialState(sale: SaleRow) {
  // The same product and options can appear twice on old sales; keep them apart
  const lines: Line[] = sale.items.map((item, i) => ({
    key: `${lineKey(item.productId, item.modifierOptionIds)}#${i}`,
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    optionIds: item.modifierOptionIds,
    optionNames: item.modifiers,
  }));
  const lineDiscountTotal = sale.items.reduce((sum, i) => sum + i.discount, 0);
  const ticket = Math.round((sale.discount - lineDiscountTotal) * 100) / 100;
  const discounts: OrderDiscounts = {
    lines: Object.fromEntries(sale.items.flatMap((item, i) => item.discount > 0 ? [[lines[i].key, { mode: 'amount' as const, value: item.discount }]] : [])),
    ticket: ticket > 0 ? { mode: 'amount', value: ticket } : null,
    reason: sale.discountReason ?? '',
  };
  return { lines, discounts };
}

/** Corrects a sale captured by mistake: products, quantities, discounts, payment. */
export function EditSaleDialog({ sale, onDone, onClose }: { sale: SaleRow; onDone: () => void; onClose: () => void }) {
  const initial = useMemo(() => initialState(sale), [sale]);
  const [lines, setLines] = useState(initial.lines);
  const [discounts, setDiscounts] = useState(initial.discounts);
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod);
  const [customerName, setCustomerName] = useState(sale.customerName ?? '');
  const [notes, setNotes] = useState(sale.notes ?? '');
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [picking, setPicking] = useState<{ product: Product; groups: ModifierGroup[] } | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/products'), api.get('/modifiers')])
      .then(([prodRes, modRes]) => {
        setProducts(unwrap<Product[]>(prodRes).filter(p => p.isActive));
        setGroups(unwrap<ModifierGroup[]>(modRes));
      })
      .catch(err => notifyError(err, 'No se pudieron cargar los productos'));
  }, []);

  const discountLines = lines.map(l => ({ key: l.key, label: `${l.quantity}× ${l.name}`, subtotal: l.unitPrice * l.quantity }));
  const totals = orderTotals(discountLines, discounts);
  const items = itemsPayload(lines, totals.lineDiscounts);
  const initialItems = itemsPayload(initial.lines, orderTotals(initial.lines.map(l => ({ key: l.key, subtotal: l.unitPrice * l.quantity })), initial.discounts).lineDiscounts);
  const itemsChanged = JSON.stringify(items) !== JSON.stringify(initialItems);

  const setQuantity = (key: string, quantity: number) => {
    if (quantity < 1) {
      setLines(prev => prev.filter(l => l.key !== key));
      setDiscounts(prev => {
        const rest = { ...prev.lines };
        delete rest[key];
        return { ...prev, lines: rest };
      });
    } else {
      setLines(prev => prev.map(l => l.key === key ? { ...l, quantity } : l));
    }
  };

  const addLine = (product: Product, options: ModifierOption[] = []) => {
    const optionIds = options.map(o => o.id);
    const key = lineKey(product.id, optionIds);
    setLines(prev => prev.some(l => l.key === key)
      ? prev.map(l => l.key === key ? { ...l, quantity: l.quantity + 1 } : l)
      : [...prev, {
        key,
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: Number(product.sellingPrice) + options.reduce((sum, o) => sum + Number(o.priceDelta), 0),
        optionIds,
        optionNames: options.map(o => o.name),
      }]);
  };

  const pickProduct = (id: string) => {
    const product = products.find(p => p.id === Number(id));
    if (!product) return;
    const linked = new Set(product.modifierGroups?.map(g => g.groupId));
    const productGroups = groups.filter(g => linked.has(g.id) && g.options.length > 0);
    if (productGroups.length === 0) addLine(product);
    else setPicking({ product, groups: productGroups });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = unwrap<{ stockWarnings?: { name: string }[] }>(await api.patch(`/sales/${sale.id}`, {
        ...(itemsChanged && { items }),
        discount: totals.ticketDiscount,
        ...(totals.totalDiscount > 0 && { discountReason: discounts.reason }),
        paymentMethod,
        customerName: customerName.trim(),
        notes: notes.trim(),
      }));
      const negative = res.stockWarnings?.length ? ` Ojo: quedó en negativo ${res.stockWarnings.map(w => w.name).join(', ')}.` : '';
      toast.success(`Total ahora ${formatMoney(totals.total)}.${negative}`, `Venta #${sale.id} corregida`);
      onDone();
      onClose();
    } catch (err) {
      notifyError(err, 'No se pudo corregir la venta');
    } finally {
      setSaving(false);
    }
  };

  // Pickers render beside the dialog: inside it, its animation would misplace them
  return (
    <>
      <Modal title={`Corregir venta #${sale.id}`} onClose={onClose} wide>
        <div className="space-y-5">
          <div>
            <p className={labelClass}>Productos</p>
            <ul className="space-y-3">
              {lines.map(line => (
                <li key={line.key} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-ink font-medium text-sm truncate">{line.name}</p>
                    {line.optionNames.length > 0 && <p className="text-ink/40 text-xs truncate">{line.optionNames.join(' · ')}</p>}
                    {totals.lineDiscounts[line.key] > 0 && <p className="text-secondary text-xs font-semibold">Descuento −{formatMoney(totals.lineDiscounts[line.key])}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setQuantity(line.key, line.quantity - 1)} className="w-9 h-9 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-ink/60 hover:text-ink" aria-label={`Quitar un ${line.name}`}>
                      {line.quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    </button>
                    <span className="font-mono w-6 text-center">{line.quantity}</span>
                    <button onClick={() => setQuantity(line.key, line.quantity + 1)} className="w-9 h-9 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-ink/60 hover:text-ink" aria-label={`Agregar un ${line.name}`}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="font-mono text-ink/80 text-sm w-20 text-right shrink-0">{formatMoney(line.unitPrice * line.quantity)}</span>
                </li>
              ))}
            </ul>
            <select value="" onChange={e => pickProduct(e.target.value)} className={cn(fieldClass, 'mt-3')} aria-label="Agregar producto">
              <option value="">+ Agregar producto…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} · {formatMoney(p.sellingPrice)}</option>)}
            </select>
            {itemsChanged && (
              <p className="text-ink/40 text-xs mt-2">Al cambiar productos se recalculan precios y costos con los actuales, y el inventario se ajusta.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              onClick={() => setDiscountOpen(true)}
              disabled={lines.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink/5 border border-ink/10 text-ink/70 hover:text-ink disabled:opacity-50"
            >
              <Tag className="w-4 h-4" /> {totals.totalDiscount > 0 ? 'Cambiar descuento' : 'Descuento'}
            </button>
            {totals.totalDiscount > 0 && <span className="text-secondary font-semibold truncate">−{formatMoney(totals.totalDiscount)} · {discounts.reason}</span>}
          </div>

          <div>
            <p className={labelClass}>Pago</p>
            <div className="flex gap-3">
              {([['CASH', 'Efectivo', Banknote], ['TRANSFER', 'Transferencia', ArrowLeftRight]] as const).map(([method, label, Icon]) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  aria-pressed={paymentMethod === method}
                  className={cn('flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 transition-colors', paymentMethod === method ? 'bg-primary/15 border-primary text-primary' : 'bg-ink/5 border-ink/10 text-ink/60 hover:text-ink')}
                >
                  <Icon className="w-4 h-4" /> <span className="text-sm font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="edit-sale-name">Nombre</label>
              <input id="edit-sale-name" value={customerName} onChange={e => setCustomerName(e.target.value)} maxLength={60} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="edit-sale-notes">Nota</label>
              <input id="edit-sale-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} className={fieldClass} />
            </div>
          </div>

          <div className="flex items-end justify-between pt-4 border-t border-ink/10">
            <span className="text-ink/50 text-sm">Antes {formatMoney(sale.totalAmount)}</span>
            <span className="font-headline text-2xl font-bold text-secondary">{formatMoney(totals.total)}</span>
          </div>

          <button
            onClick={save}
            disabled={saving || lines.length === 0}
            className="w-full py-4 rounded-xl bg-cta text-on-primary font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : lines.length === 0 ? 'Agrega un producto o anula la venta' : 'Guardar cambios'}
          </button>
        </div>
      </Modal>

      {picking && (
        <OptionsPicker
          title={picking.product.name}
          groups={picking.groups}
          basePrice={Number(picking.product.sellingPrice)}
          onAdd={options => addLine(picking.product, options)}
          onClose={() => setPicking(null)}
        />
      )}
      {discountOpen && (
        <DiscountDialog lines={discountLines} value={discounts} onChange={setDiscounts} onClose={() => setDiscountOpen(false)} />
      )}
    </>
  );
}
