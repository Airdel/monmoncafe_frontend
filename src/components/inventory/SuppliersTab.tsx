import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, MapPin, Pencil, Phone, Plus, Power, Save, Store } from 'lucide-react';
import { api } from '../../lib/api';
import { unwrap } from '../../lib/unwrap';
import { getErrorMessage } from '../../lib/errors';
import { matchesSearch } from '../../lib/search';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';

interface IngredientRef { id: number; name: string; supplierId?: number | null }

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  _count?: { ingredients: number };
}

interface SupplierForm {
  id?: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  ingredientIds: number[];
}

const EMPTY_FORM: SupplierForm = { name: '', phone: '', address: '', notes: '', ingredientIds: [] };

const inputClass = 'w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none placeholder:text-ink/20';
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';
const saveButton = 'w-full py-3 rounded-xl bg-cta text-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50';

const isLink = (value: string) => /^(https?:\/\/|www\.)|\.(com|mx|net)(\/|$)/i.test(value.trim());
const toHref = (value: string) => (/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);

/** Stores where insumos are bought: the corner shop, Mercado Libre, local candy stores… */
export function SuppliersTab({ ingredients, canManage, onChanged }: { ingredients: IngredientRef[]; canManage: boolean; onChanged: () => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<SupplierForm | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/suppliers', { params: { includeInactive: showInactive || undefined } })
      .then(res => { if (!cancelled) setSuppliers(unwrap<Supplier[]>(res)); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showInactive, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey(k => k + 1);
    onChanged();
  };

  const visible = suppliers.filter(s => matchesSearch(search, s.name, s.address, s.notes));

  const openCreate = () => {
    setIngredientSearch('');
    setForm(EMPTY_FORM);
  };

  const openEdit = (s: Supplier) => {
    setIngredientSearch('');
    setForm({
      id: s.id,
      name: s.name,
      phone: s.phone ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
      ingredientIds: ingredients.filter(i => i.supplierId === s.id).map(i => i.id),
    });
  };

  const toggleIngredient = (id: number) => {
    if (!form) return;
    const has = form.ingredientIds.includes(id);
    setForm({ ...form, ingredientIds: has ? form.ingredientIds.filter(x => x !== id) : [...form.ingredientIds, id] });
  };

  const save = async () => {
    if (!form || !form.name.trim()) return;
    // null clears a field that was emptied while editing
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    setSaving(true);
    try {
      const res = form.id ? await api.patch(`/suppliers/${form.id}`, body) : await api.post('/suppliers', body);
      const supplierId = form.id ?? unwrap<Supplier>(res).id;

      // Each insumo has a single usual store: assign the checked ones here, release the unchecked ones
      const changes = ingredients.flatMap(i => {
        const checked = form.ingredientIds.includes(i.id);
        if (checked && i.supplierId !== supplierId) return [api.patch(`/inventory/ingredients/${i.id}`, { supplierId })];
        if (!checked && i.supplierId === supplierId) return [api.patch(`/inventory/ingredients/${i.id}`, { supplierId: null })];
        return [];
      });
      await Promise.all(changes);

      setForm(null);
      reload();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Supplier) => {
    if (s.isActive && !window.confirm(`¿Desactivar "${s.name}"?\n\nYa no aparecerá al registrar compras; el historial se conserva.`)) return;
    try {
      if (s.isActive) await api.delete(`/suppliers/${s.id}`);
      else await api.patch(`/suppliers/${s.id}`, { isActive: true });
      reload();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    }
  };

  const supplierName = (id: number | null | undefined) => suppliers.find(s => s.id === id)?.name;
  const pickable = ingredients.filter(i => matchesSearch(ingredientSearch, i.name));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar tienda..." className="flex-1" />
        <label className="flex items-center gap-2 text-ink/60 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => { setLoading(true); setShowInactive(e.target.checked); }}
            className="accent-primary"
          />
          Mostrar desactivadas
        </label>
        {canManage && (
          <button onClick={openCreate} className="px-5 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-semibold hover:bg-primary/30 transition-all flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Nueva tienda
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <div className="glass-panel p-10 text-center text-ink/50">
          {search ? `Ninguna tienda coincide con "${search}"` : 'Aún no registras tiendas. Agrega dónde compras tus insumos: la tienda de la esquina, Mercado Libre, dulcerías…'}
        </div>
      ) : (
        <div className="glass-panel divide-y divide-ink/5">
          {visible.map(s => {
            const count = s._count?.ingredients ?? 0;
            return (
              <div key={s.id} className={`flex items-start gap-3 p-4 ${s.isActive ? '' : 'opacity-50'}`}>
                <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate">{s.name}{!s.isActive && <span className="text-ink/40 font-normal"> · desactivada</span>}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-ink/50 text-sm">
                    {s.address && (isLink(s.address) ? (
                      <a href={toHref(s.address)} target="_blank" rel="noreferrer" className="flex items-center gap-1 min-w-0 hover:text-primary">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{s.address}</span>
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{s.address}</span></span>
                    ))}
                    {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone className="w-3.5 h-3.5" />{s.phone}</a>}
                  </div>
                  <p className="text-ink/40 text-xs font-label mt-1">
                    {count === 0 ? 'Sin insumos asignados' : `${count} ${count === 1 ? 'insumo' : 'insumos'}`}
                    {s.notes ? ` · ${s.notes}` : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0">
                    <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5" aria-label={`Editar ${s.name}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(s)}
                      className={`p-2 rounded-lg ${s.isActive ? 'text-error/70 hover:text-error hover:bg-error/10' : 'text-secondary/70 hover:text-secondary hover:bg-secondary/10'}`}
                      aria-label={s.isActive ? `Desactivar ${s.name}` : `Reactivar ${s.name}`}
                      title={s.isActive ? 'Desactivar' : 'Reactivar'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <Modal title={form.id ? 'Editar tienda' : 'Nueva tienda'} onClose={() => setForm(null)} wide>
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="supplier-name">Nombre</label>
              <input id="supplier-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tienda de la esquina, Mercado Libre…" className={inputClass} autoFocus />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="supplier-address">Dirección o enlace</label>
                <input id="supplier-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Calle… o mercadolibre.com.mx" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="supplier-phone">Teléfono (opcional)</label>
                <input id="supplier-phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-notes">Notas (opcional)</label>
              <input id="supplier-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Horario, envío gratis desde $299…" className={inputClass} />
            </div>

            <div>
              <p className={labelClass}>Insumos que compras aquí ({form.ingredientIds.length})</p>
              <SearchInput value={ingredientSearch} onChange={setIngredientSearch} placeholder="Buscar insumo..." />
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-ink/10 divide-y divide-ink/5">
                {pickable.length === 0 ? (
                  <p className="p-3 text-ink/40 text-sm">Sin coincidencias</p>
                ) : pickable.map(i => {
                  const checked = form.ingredientIds.includes(i.id);
                  const elsewhere = !checked && i.supplierId && i.supplierId !== form.id ? supplierName(i.supplierId) : undefined;
                  return (
                    <label key={i.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-ink/5">
                      <input type="checkbox" checked={checked} onChange={() => toggleIngredient(i.id)} className="accent-primary w-4 h-4" />
                      <span className="flex-1 text-ink text-sm">{i.name}</span>
                      {elsewhere && <span className="text-ink/40 text-xs truncate max-w-[40%]">ahora: {elsewhere}</span>}
                    </label>
                  );
                })}
              </div>
              <p className="text-ink/40 text-xs mt-1.5">Cada insumo tiene una tienda habitual; marcarlo aquí lo mueve a esta tienda.</p>
            </div>

            <button onClick={save} disabled={saving || !form.name.trim()} className={saveButton}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
