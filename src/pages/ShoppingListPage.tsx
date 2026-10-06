import { useEffect, useState } from 'react';
import { Check, CheckCircle2, ListChecks, Loader2, Minus, Package, Pencil, Plus, RotateCcw, Star, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { getErrorMessage } from '../lib/errors';
import { confirm, notifyError } from '../lib/dialogs';
import { formatMoney } from '../lib/format';
import { unitLabel } from '../lib/modifiers';
import { matchesSearch } from '../lib/search';
import { unwrap } from '../lib/unwrap';
import { useAuthStore } from '../store/auth';
import { Modal } from '../components/ui/Modal';
import { SearchInput } from '../components/ui/SearchInput';
import { inputClass, labelClass, primaryButtonClass } from '../components/finance/styles';

type Priority = 'ESSENTIAL' | 'IMPORTANT' | 'OPTIONAL';

const PRIORITIES: { key: Priority; label: string; className: string }[] = [
  { key: 'ESSENTIAL', label: 'Esencial', className: 'bg-error/15 text-error border-error/30' },
  { key: 'IMPORTANT', label: 'Importante', className: 'bg-primary/15 text-primary border-primary/30' },
  { key: 'OPTIONAL', label: 'Prescindible', className: 'bg-ink/5 text-ink/60 border-ink/15' },
];
const priorityInfo = (p: Priority) => PRIORITIES.find(x => x.key === p) ?? PRIORITIES[1];

type ListItem = {
  id: number;
  ingredientId: number;
  priority: Priority;
  stock: string;
  minStock: string;
  quantity: string;
  unitCost: string;
  inBudget: boolean;
  partial: boolean;
  purchased: boolean;
  ingredient: { name: string; unit: string; supplierId: number | null; supplier: { name: string } | null };
  /** What was really bought, once checked off. */
  purchase: { quantity: string; totalCost: string; unitCost: string; supplier: { name: string } | null } | null;
};

type Supplier = { id: number; name: string };

type ShoppingList = {
  id: number;
  budget: string;
  createdAt: string;
  user: { name: string };
  items: ListItem[];
};

type Ingredient = { id: number; name: string; unit: string; priority: Priority; supplier?: { name: string } | null };

const itemCost = (i: ListItem) => Number(i.quantity) * Number(i.unitCost);
const formatQty = (qty: string | number, unit: string) =>
  `${Number(qty).toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${unitLabel(unit)}`;

function PriorityBadge({ priority }: { priority: Priority }) {
  const info = priorityInfo(priority);
  return <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-label uppercase tracking-wider', info.className)}>{info.label}</span>;
}

function BudgetForm({ onCreate, busy, initial = '' }: { onCreate: (budget: number) => void; busy: boolean; initial?: string }) {
  const [budget, setBudget] = useState(initial);
  const valid = Number(budget) > 0;
  return (
    <form onSubmit={e => { e.preventDefault(); if (valid) onCreate(Number(budget)); }} className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="budget">Presupuesto disponible</label>
        <input id="budget" type="number" inputMode="decimal" min="0" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="$0.00" className={inputClass} autoFocus />
      </div>
      <button type="submit" disabled={!valid || busy} className={primaryButtonClass}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ListChecks className="w-5 h-5" /> Armar lista</>}
      </button>
    </form>
  );
}

export function ShoppingListPage() {
  const role = useAuthStore(state => state.user?.role);
  const canManage = role === 'ADMIN' || role === 'SUPERVISOR';
  const [tab, setTab] = useState<'list' | 'priorities'>('list');
  const [list, setList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [buying, setBuying] = useState<ListItem | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    api.get('/shopping-lists/current')
      .then(res => setList(unwrap<ShoppingList | null>(res)))
      .catch(err => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
    api.get('/suppliers')
      .then(res => setSuppliers(unwrap<Supplier[]>(res)))
      .catch(() => setSuppliers([]));
  }, []);

  const replaceItem = (item: ListItem) =>
    setList(l => l && { ...l, items: l.items.map(i => i.id === item.id ? item : i) });

  /** Checking off records what was bought and adds it to the inventory. */
  const purchaseItem = async (item: ListItem, body: { quantity: number; totalCost: number; supplierId?: number }) => {
    await api.post(`/shopping-lists/items/${item.id}/purchase`, body);
    const supplier = suppliers.find(s => s.id === body.supplierId) ?? item.ingredient.supplier;
    replaceItem({
      ...item,
      purchased: true,
      purchase: {
        quantity: String(body.quantity),
        totalCost: String(body.totalCost),
        unitCost: String(body.totalCost / body.quantity),
        supplier: supplier ? { name: supplier.name } : null,
      },
    });
    setBuying(null);
  };

  /** Unchecking takes the purchase back out of the inventory. */
  const undoPurchase = async (item: ListItem) => {
    if (!await confirm({
      title: `¿Desmarcar ${item.ingredient.name}?`,
      message: item.purchase
        ? `Se quitarán ${formatQty(item.purchase.quantity, item.ingredient.unit)} del inventario y se borrará la compra de ${formatMoney(Number(item.purchase.totalCost))}.`
        : undefined,
      confirmLabel: 'Desmarcar',
      tone: item.purchase ? 'danger' : 'primary',
    })) return;
    try {
      await api.delete(`/shopping-lists/items/${item.id}/purchase`);
      replaceItem({ ...item, purchased: false, purchase: null });
    } catch (err) {
      notifyError(err);
    }
  };

  const createList = async (budget: number) => {
    setCreating(true);
    try {
      setList(unwrap<ShoppingList>(await api.post('/shopping-lists', { budget })));
      setShowNewList(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setCreating(false);
    }
  };

  const closeList = async () => {
    if (!list || !await confirm({
      title: '¿Terminar esta lista?',
      message: 'Ya no aparecerá aquí.',
      confirmLabel: 'Terminar lista',
    })) return;
    try {
      await api.post(`/shopping-lists/${list.id}/close`);
      setList(null);
    } catch (err) {
      notifyError(err);
    }
  };

  /** Applies the change right away and rolls it back if the server refuses it. */
  const updateItem = async (item: ListItem, changes: Partial<Pick<ListItem, 'inBudget'>> & { quantity?: number }) => {
    const { quantity, ...flags } = changes;
    const local: Partial<ListItem> = { ...flags, ...(quantity !== undefined && { quantity: String(quantity), partial: false }) };
    replaceItem({ ...item, ...local });
    try {
      await api.patch(`/shopping-lists/items/${item.id}`, changes);
    } catch (err) {
      replaceItem(item);
      notifyError(err);
    }
  };

  const saveQuantity = () => {
    if (!editing || !(Number(editQty) > 0)) return;
    updateItem(editing, { quantity: Number(editQty) });
    setEditing(null);
  };

  const toBuy = list?.items.filter(i => i.inBudget) ?? [];
  const leftOut = list?.items.filter(i => !i.inBudget) ?? [];
  const budget = Number(list?.budget ?? 0);
  const planned = toBuy.reduce((sum, i) => sum + itemCost(i), 0);
  const remaining = budget - planned;
  const boughtCount = toBuy.filter(i => i.purchased).length;
  const spent = list?.items.reduce((sum, i) => sum + Number(i.purchase?.totalCost ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-ink tracking-tight">Lista de compras</h1>
          <p className="text-ink/50 text-sm font-label uppercase tracking-wider mt-1">Qué resurtir con el dinero que hay</p>
        </div>
        <div className="flex w-full sm:w-auto bg-ink/5 rounded-xl p-1 border border-ink/10">
          {([['list', 'Lista', ListChecks], ['priorities', 'Prioridades', Star]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn('flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all', tab === key ? 'bg-primary/20 text-primary' : 'text-ink/50 hover:text-ink')}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'priorities' && <PrioritiesTab canManage={canManage} />}

      {tab === 'list' && (loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="glass-panel p-6 text-error">{error}</div>
      ) : !list ? (
        <div className="glass-panel p-5 sm:p-6 flex flex-col gap-4">
          <p className="text-ink/70 text-sm">
            Escribe cuánto dinero hay para compras. La lista toma los insumos con stock bajo, pone primero los esenciales y los más agotados, y te dice qué alcanza y qué queda fuera.
          </p>
          <BudgetForm onCreate={createList} busy={creating} />
        </div>
      ) : (
        <>
          <div className="glass-panel p-4 sm:p-5 grid grid-cols-3 gap-3">
            <div>
              <p className={labelClass}>Presupuesto</p>
              <p className="font-headline text-lg sm:text-2xl font-bold text-ink">{formatMoney(budget)}</p>
            </div>
            <div>
              <p className={labelClass}>A comprar</p>
              <p className="font-headline text-lg sm:text-2xl font-bold text-primary">{formatMoney(planned)}</p>
            </div>
            <div>
              <p className={labelClass}>{remaining >= 0 ? 'Sobra' : 'Falta'}</p>
              <p className={cn('font-headline text-lg sm:text-2xl font-bold', remaining >= 0 ? 'text-secondary' : 'text-error')}>{formatMoney(Math.abs(remaining))}</p>
            </div>
            <p className="col-span-3 text-ink/40 text-xs font-label">
              {boughtCount} de {toBuy.length} comprados{spent > 0 && ` (${formatMoney(spent)} pagados)`} · armada por {list.user.name} el {new Date(list.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          {list.items.length === 0 ? (
            <div className="glass-panel p-8 text-center text-ink/60">
              <CheckCircle2 className="w-10 h-10 text-secondary mx-auto mb-2" />
              No hay insumos con stock bajo. No hace falta comprar nada.
            </div>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h2 className="font-headline text-lg font-semibold text-ink">Comprar ({toBuy.length})</h2>
                {toBuy.length === 0 && <p className="glass-panel p-4 text-ink/50 text-sm">El presupuesto no alcanza para ningún insumo.</p>}
                {toBuy.map(item => (
                  <div key={item.id} className={cn('glass-panel p-3 sm:p-4 flex items-center gap-3', item.purchased && 'opacity-60')}>
                    <button
                      onClick={() => item.purchased ? undoPurchase(item) : setBuying(item)}
                      aria-label={item.purchased ? `Desmarcar ${item.ingredient.name}` : `Marcar ${item.ingredient.name} como comprado`}
                      className={cn('w-11 h-11 shrink-0 rounded-xl border-2 flex items-center justify-center transition-all', item.purchased ? 'bg-secondary border-secondary text-on-secondary' : 'border-ink/20 text-transparent hover:border-secondary')}
                    >
                      <Check className="w-6 h-6" strokeWidth={3} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium text-ink truncate', item.purchased && 'line-through')}>{item.ingredient.name}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <PriorityBadge priority={item.priority} />
                        {item.partial && <span className="text-[10px] font-label uppercase tracking-wider text-warning">Solo el mínimo</span>}
                        {(item.purchase?.supplier ?? item.ingredient.supplier) && <span className="text-xs text-ink/40 truncate">{(item.purchase?.supplier ?? item.ingredient.supplier)!.name}</span>}
                      </div>
                    </div>
                    {item.purchase ? (
                      <div className="text-right shrink-0">
                        <p className="font-mono text-ink/80 text-sm flex items-center gap-1 justify-end"><Package className="w-3 h-3" /> {formatQty(item.purchase.quantity, item.ingredient.unit)}</p>
                        <p className="text-secondary text-sm font-semibold">{formatMoney(Number(item.purchase.totalCost))}</p>
                      </div>
                    ) : (
                      <div className="text-right shrink-0">
                        <button onClick={() => { setEditing(item); setEditQty(String(Number(item.quantity))); }} disabled={item.purchased} className="font-mono text-ink/80 text-sm flex items-center gap-1 ml-auto enabled:hover:text-primary">
                          {formatQty(item.quantity, item.ingredient.unit)} {!item.purchased && <Pencil className="w-3 h-3" />}
                        </button>
                        <p className="text-primary text-sm font-semibold">{formatMoney(itemCost(item))}</p>
                      </div>
                    )}
                    {!item.purchased && (
                      <button onClick={() => updateItem(item, { inBudget: false })} className="p-2 -mr-1 text-ink/40 hover:text-error shrink-0" aria-label={`Quitar ${item.ingredient.name} de la lista`}>
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </section>

              {leftOut.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="font-headline text-lg font-semibold text-ink">Fuera del presupuesto ({leftOut.length})</h2>
                  <p className="text-ink/50 text-xs -mt-1">No alcanzó el dinero para estos. Puedes agregarlos si cambias de opinión.</p>
                  {leftOut.map(item => (
                    <div key={item.id} className="glass-panel p-3 sm:p-4 flex items-center gap-3 border-dashed">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink/70 truncate">{item.ingredient.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <PriorityBadge priority={item.priority} />
                          <span className="text-xs text-ink/40">quedan {formatQty(item.stock, item.ingredient.unit)} · mín. {formatQty(item.minStock, item.ingredient.unit)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-ink/60 text-sm">{formatQty(item.quantity, item.ingredient.unit)}</p>
                        <p className="text-ink/60 text-sm">{formatMoney(itemCost(item))}</p>
                      </div>
                      <button onClick={() => updateItem(item, { inBudget: true })} className="p-2 -mr-1 text-ink/40 hover:text-primary shrink-0" aria-label={`Agregar ${item.ingredient.name} a la lista`}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setShowNewList(true)} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-ink/10 text-ink/70 hover:text-primary hover:border-primary/30 transition-all">
              <RotateCcw className="w-4 h-4" /> Armar de nuevo
            </button>
            <button onClick={closeList} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-secondary/30 text-secondary hover:bg-secondary/10 transition-all">
              <CheckCircle2 className="w-4 h-4" /> Terminar lista
            </button>
          </div>
        </>
      ))}

      {showNewList && list && (
        <Modal title="Armar lista de nuevo" onClose={() => setShowNewList(false)}>
          <p className="text-ink/60 text-sm mb-4">Se arma con el stock de ahora y reemplaza la lista actual. Lo que ya palomeaste se queda en el inventario.</p>
          <BudgetForm onCreate={createList} busy={creating} initial={String(Number(list.budget))} />
        </Modal>
      )}

      {buying && (
        <PurchaseModal item={buying} suppliers={suppliers} onClose={() => setBuying(null)} onConfirm={body => purchaseItem(buying, body)} />
      )}

      {editing && (
        <Modal title={editing.ingredient.name} onClose={() => setEditing(null)}>
          <form onSubmit={e => { e.preventDefault(); saveQuantity(); }} className="flex flex-col gap-4">
            <div>
              <label className={labelClass} htmlFor="qty">Cantidad a comprar ({unitLabel(editing.ingredient.unit)})</label>
              <input id="qty" type="number" inputMode="decimal" min="0" step="any" value={editQty} onChange={e => setEditQty(e.target.value)} className={inputClass} autoFocus />
              <p className="text-ink/40 text-xs mt-2">
                Costo estimado: {formatMoney(Number(editQty || 0) * Number(editing.unitCost))} · quedan {formatQty(editing.stock, editing.ingredient.unit)}, mínimo {formatQty(editing.minStock, editing.ingredient.unit)}
              </p>
            </div>
            <button type="submit" disabled={!(Number(editQty) > 0)} className={primaryButtonClass}>
              <Wallet className="w-5 h-5" /> Guardar cantidad
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/** Confirms what was really bought before it enters the inventory. */
function PurchaseModal({ item, suppliers, onClose, onConfirm }: {
  item: ListItem;
  suppliers: Supplier[];
  onClose: () => void;
  onConfirm: (body: { quantity: number; totalCost: number; supplierId?: number }) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(Number(item.quantity)));
  const [totalCost, setTotalCost] = useState((Number(item.quantity) * Number(item.unitCost)).toFixed(2));
  const [supplierId, setSupplierId] = useState(item.ingredient.supplierId ? String(item.ingredient.supplierId) : '');
  const [saving, setSaving] = useState(false);
  const qty = Number(quantity);
  const cost = Number(totalCost);
  const valid = qty > 0 && cost > 0;
  const unit = unitLabel(item.ingredient.unit);

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onConfirm({ quantity: qty, totalCost: Math.round(cost * 100) / 100, ...(supplierId && { supplierId: Number(supplierId) }) });
    } catch (err) {
      notifyError(err);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Compré ${item.ingredient.name}`} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
        <p className="text-ink/60 text-sm -mt-2">Se suma al inventario y actualiza el costo del insumo. Ajusta lo que de verdad compraste.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="buy-qty">Cantidad ({unit})</label>
            <input id="buy-qty" type="number" inputMode="decimal" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} autoFocus />
          </div>
          <div>
            <label className={labelClass} htmlFor="buy-cost">Pagué en total</label>
            <input id="buy-cost" type="number" inputMode="decimal" min="0" step="0.01" value={totalCost} onChange={e => setTotalCost(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="buy-store">Tienda</label>
          <select id="buy-store" value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputClass}>
            <option value="">Sin tienda</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <p className="text-ink/40 text-xs">
          {valid
            ? <>Costo por {unit}: <b className="text-ink/70">${(cost / qty).toFixed(4)}</b> (antes ${Number(item.unitCost).toFixed(4)})</>
            : 'Escribe la cantidad y lo que pagaste.'}
        </p>
        <button type="submit" disabled={!valid || saving} className={primaryButtonClass}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Sumar al inventario</>}
        </button>
      </form>
    </Modal>
  );
}

/** Sets how much each ingredient matters when money is short. */
function PrioritiesTab({ canManage }: { canManage: boolean }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/inventory/ingredients')
      .then(res => setIngredients(unwrap<Ingredient[]>(res)))
      .catch(err => notifyError(err))
      .finally(() => setLoading(false));
  }, []);

  const setPriority = async (ingredient: Ingredient, priority: Priority) => {
    setIngredients(list => list.map(i => i.id === ingredient.id ? { ...i, priority } : i));
    try {
      await api.patch(`/inventory/ingredients/${ingredient.id}`, { priority });
    } catch (err) {
      setIngredients(list => list.map(i => i.id === ingredient.id ? ingredient : i));
      notifyError(err);
    }
  };

  const visible = ingredients.filter(i => matchesSearch(search, i.name, i.supplier?.name));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink/60 text-sm">
        <b className="text-error">Esencial</b>: sin esto no se puede vender. <b className="text-primary">Importante</b>: hace falta pero aguanta unos días. <b className="text-ink/70">Prescindible</b>: se puede dejar para después.
        {!canManage && ' Solo un administrador o supervisor puede cambiarlas.'}
      </p>
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar insumo" />
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="glass-panel divide-y divide-ink/5">
          {visible.length === 0 && <p className="p-6 text-center text-ink/40 text-sm">Ningún insumo coincide con "{search}"</p>}
          {visible.map(i => (
            <div key={i.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <p className="flex-1 min-w-0 font-medium text-ink truncate">{i.name}</p>
              <div className="flex bg-ink/5 rounded-xl p-1 border border-ink/10">
                {PRIORITIES.map(p => (
                  <button
                    key={p.key}
                    disabled={!canManage}
                    onClick={() => i.priority !== p.key && setPriority(i, p.key)}
                    className={cn(
                      'flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-medium border border-transparent transition-all disabled:cursor-default',
                      i.priority === p.key ? p.className : 'text-ink/40 enabled:hover:text-ink'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
