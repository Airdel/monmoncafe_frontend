import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Power, Save, Trash2, Layers } from 'lucide-react';
import { api } from '../../lib/api';
import { unwrap } from '../../lib/unwrap';
import { confirm, notifyError } from '../../lib/dialogs';
import { formatDelta, unitLabel, type ModifierGroup, type ModifierOption } from '../../lib/modifiers';
import { Modal } from '../ui/Modal';

interface IngredientRef { id: number; name: string; unit: string }
interface ProductRef { id: number; name: string; category?: { name: string } }

const inputClass = 'w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none placeholder:text-ink/20';
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';
const ghostButton = 'px-3 py-2 rounded-lg bg-ink/5 border border-ink/10 text-ink/60 hover:text-primary hover:border-primary/30 transition-all text-xs font-label uppercase tracking-wider flex items-center gap-1';
const saveButton = 'w-full py-3 rounded-xl bg-cta text-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50';

type GroupForm = { id?: number; name: string; isRequired: boolean; allowMultiple: boolean; productIds: number[] };
type OptionForm = { id?: number; groupId: number; name: string; priceDelta: string; ingredients: { ingredientId: number; quantity: string }[] };

/** Groups of options (leche, tamaño, extras) that the POS offers for each product. */
export function ModifiersTab({ ingredients, products, canManage }: { ingredients: IngredientRef[]; products: ProductRef[]; canManage: boolean }) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupForm, setGroupForm] = useState<GroupForm | null>(null);
  const [optionForm, setOptionForm] = useState<OptionForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get('/modifiers', { params: canManage ? { all: true } : undefined })
      .then(res => setGroups(unwrap<ModifierGroup[]>(res)))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const run = async (request: () => Promise<unknown>, after?: () => void) => {
    setSaving(true);
    try {
      await request();
      after?.();
      await load();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  const saveGroup = () => {
    if (!groupForm || !groupForm.name.trim()) return;
    const { id, ...body } = groupForm;
    run(() => id ? api.put(`/modifiers/groups/${id}`, body) : api.post('/modifiers/groups', body), () => setGroupForm(null));
  };

  const saveOption = () => {
    if (!optionForm || !optionForm.name.trim()) return;
    const { id, groupId, name, priceDelta, ingredients: rows } = optionForm;
    const body = {
      name,
      priceDelta: Number(priceDelta) || 0,
      ingredients: rows
        .filter(r => r.ingredientId && Number(r.quantity))
        .map(r => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
    };
    run(() => id ? api.put(`/modifiers/options/${id}`, body) : api.post(`/modifiers/groups/${groupId}/options`, body), () => setOptionForm(null));
  };

  const editOption = (option: ModifierOption) => setOptionForm({
    id: option.id,
    groupId: option.groupId,
    name: option.name,
    priceDelta: String(Number(option.priceDelta)),
    ingredients: option.ingredients.map(i => ({ ingredientId: i.ingredientId, quantity: String(Number(i.quantity)) })),
  });

  const productName = (id: number) => products.find(p => p.id === id)?.name;

  if (loading) {
    return <div className="glass-panel p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-ink/50 text-sm">Opciones que el POS pregunta al vender: tipo de leche, tamaño, extras...</p>
        {canManage && (
          <button onClick={() => setGroupForm({ name: '', isRequired: false, allowMultiple: false, productIds: [] })} className="px-4 py-2.5 rounded-xl bg-cta text-on-primary font-bold text-sm flex items-center justify-center gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Nuevo grupo
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="glass-panel p-8 text-center text-ink/40">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Aún no hay modificadores. Crea un grupo como “Leche” o “Extras”.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto pb-4 scrollbar-thin">
          {groups.map(group => (
            <div key={group.id} className={`glass-panel p-4 sm:p-5 ${group.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-headline text-lg font-bold text-ink">{group.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-label uppercase tracking-widest">{group.isRequired ? 'Obligatorio' : 'Opcional'}</span>
                    <span className="px-2 py-0.5 rounded bg-ink/5 text-ink/60 text-[10px] font-label uppercase tracking-widest">{group.allowMultiple ? 'Varias opciones' : 'Una opción'}</span>
                    {!group.isActive && <span className="px-2 py-0.5 rounded bg-error/15 text-error text-[10px] font-label uppercase tracking-widest">Inactivo</span>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setGroupForm({ id: group.id, name: group.name, isRequired: group.isRequired, allowMultiple: group.allowMultiple, productIds: group.products.map(p => p.productId) })} className={ghostButton} aria-label={`Editar ${group.name}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!group.isActive) return run(() => api.put(`/modifiers/groups/${group.id}`, { isActive: true }));
                        const ok = await confirm({
                          title: `¿Desactivar “${group.name}”?`,
                          message: 'Dejará de aparecer en el POS.',
                          confirmLabel: 'Desactivar',
                          tone: 'danger',
                        });
                        if (ok) run(() => api.delete(`/modifiers/groups/${group.id}`));
                      }}
                      disabled={saving}
                      className={ghostButton}
                      aria-label={group.isActive ? `Desactivar ${group.name}` : `Reactivar ${group.name}`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-ink/40 text-xs mt-3">
                {group.products.length === 0
                  ? 'No se aplica a ningún producto todavía'
                  : `Aplica a: ${group.products.map(p => productName(p.productId)).filter(Boolean).join(', ')}`}
              </p>

              <ul className="mt-3 divide-y divide-ink/5">
                {group.options.map(option => (
                  <li key={option.id} className={`py-2.5 flex items-center gap-3 ${option.isActive ? '' : 'opacity-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink text-sm font-medium">
                        {option.name}
                        {formatDelta(option.priceDelta) && <span className="ml-2 font-mono text-secondary text-xs">{formatDelta(option.priceDelta)}</span>}
                        {!option.isActive && <span className="ml-2 text-error text-[10px] font-label uppercase">Inactiva</span>}
                      </p>
                      {option.ingredients.length > 0 && (
                        <p className="text-ink/40 text-xs truncate">
                          {option.ingredients.map(i => `${Number(i.quantity) > 0 ? '+' : ''}${Number(i.quantity)} ${unitLabel(i.ingredient.unit)} ${i.ingredient.name}`).join(' · ')}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => editOption(option)} className={ghostButton} aria-label={`Editar ${option.name}`}><Pencil className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => run(() => option.isActive ? api.delete(`/modifiers/options/${option.id}`) : api.put(`/modifiers/options/${option.id}`, { isActive: true }))}
                          disabled={saving}
                          className={ghostButton}
                          aria-label={option.isActive ? `Desactivar ${option.name}` : `Reactivar ${option.name}`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                {group.options.length === 0 && <li className="py-2.5 text-ink/40 text-sm">Sin opciones</li>}
              </ul>

              {canManage && (
                <button onClick={() => setOptionForm({ groupId: group.id, name: '', priceDelta: '', ingredients: [] })} className="mt-2 text-primary text-xs font-label uppercase tracking-wider flex items-center gap-1 hover:text-primary/80">
                  <Plus className="w-3 h-3" /> Agregar opción
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {groupForm && (
        <Modal title={groupForm.id ? 'Editar grupo' : 'Nuevo grupo'} onClose={() => setGroupForm(null)} wide>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nombre</label>
              <input autoFocus value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Leche, Tamaño, Extras..." className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ['isRequired', 'Obligatorio', 'El cajero debe elegir una opción'],
                ['allowMultiple', 'Varias opciones', 'Se pueden elegir varias (extras)'],
              ] as const).map(([key, title, hint]) => (
                <label key={key} className="flex items-start gap-3 p-3 rounded-xl bg-ink/5 border border-ink/10 cursor-pointer">
                  <input type="checkbox" checked={groupForm[key]} onChange={e => setGroupForm({ ...groupForm, [key]: e.target.checked })} className="mt-1 accent-primary" />
                  <span>
                    <span className="block text-ink text-sm font-medium">{title}</span>
                    <span className="block text-ink/40 text-xs">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + ' mb-0'}>Productos ({groupForm.productIds.length})</label>
                <button
                  onClick={() => setGroupForm({ ...groupForm, productIds: groupForm.productIds.length === products.length ? [] : products.map(p => p.id) })}
                  className="text-primary text-xs font-label uppercase tracking-wider"
                >
                  {groupForm.productIds.length === products.length ? 'Quitar todos' : 'Todos'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-60 overflow-y-auto p-2 rounded-xl bg-ink/5 border border-ink/10 scrollbar-thin">
                {products.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink/5 cursor-pointer text-sm text-ink">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={groupForm.productIds.includes(p.id)}
                      onChange={e => setGroupForm({ ...groupForm, productIds: e.target.checked ? [...groupForm.productIds, p.id] : groupForm.productIds.filter(id => id !== p.id) })}
                    />
                    <span className="truncate">{p.name}</span>
                    {p.category && <span className="text-ink/30 text-xs truncate">{p.category.name}</span>}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={saveGroup} disabled={saving || !groupForm.name.trim()} className={saveButton}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar grupo</>}
            </button>
          </div>
        </Modal>
      )}

      {optionForm && (
        <Modal title={optionForm.id ? 'Editar opción' : 'Nueva opción'} onClose={() => setOptionForm(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <div>
                <label className={labelClass}>Nombre</label>
                <input autoFocus value={optionForm.name} onChange={e => setOptionForm({ ...optionForm, name: e.target.value })} placeholder="Avena, Shot extra..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Precio $</label>
                <input type="number" value={optionForm.priceDelta} onChange={e => setOptionForm({ ...optionForm, priceDelta: e.target.value })} placeholder="0" className={inputClass + ' font-mono'} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Inventario por pieza vendida</label>
              <p className="text-ink/40 text-xs mb-2">Suma lo que agrega la opción. Usa negativo para quitar lo que reemplaza de la receta (ej. avena: +200 avena, -200 leche).</p>
              <div className="space-y-2">
                {optionForm.ingredients.map((row, idx) => {
                  const setRow = (patch: Partial<typeof row>) => setOptionForm({ ...optionForm, ingredients: optionForm.ingredients.map((r, i) => i === idx ? { ...r, ...patch } : r) });
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={row.ingredientId} onChange={e => setRow({ ingredientId: Number(e.target.value) })} className="flex-1 min-w-0 px-3 py-2 bg-ink/5 border border-ink/10 rounded-lg text-ink text-sm [&>option]:bg-raised">
                        <option value={0}>—</option>
                        {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <input type="number" value={row.quantity} onChange={e => setRow({ quantity: e.target.value })} placeholder="0" className="w-24 px-3 py-2 bg-ink/5 border border-ink/10 rounded-lg text-primary font-mono text-sm focus:outline-none focus:border-primary/50" />
                      <span className="w-8 text-ink/40 text-xs">{ingredients.find(i => i.id === row.ingredientId)?.unit ? unitLabel(ingredients.find(i => i.id === row.ingredientId)!.unit) : ''}</span>
                      <button onClick={() => setOptionForm({ ...optionForm, ingredients: optionForm.ingredients.filter((_, i) => i !== idx) })} className="text-error/60 hover:text-error p-1" aria-label="Quitar ingrediente"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setOptionForm({ ...optionForm, ingredients: [...optionForm.ingredients, { ingredientId: 0, quantity: '' }] })} className="mt-2 text-primary text-xs font-label uppercase tracking-wider flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agregar ingrediente
              </button>
            </div>
            <button onClick={saveOption} disabled={saving || !optionForm.name.trim()} className={saveButton}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar opción</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
