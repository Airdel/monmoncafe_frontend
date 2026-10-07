import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Save, Tags, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { unwrap } from '../../lib/unwrap';
import { confirm, notifyError, toast } from '../../lib/dialogs';
import { categoryEmoji, type ProductCategory } from '../../lib/categories';
import { cn } from '../../lib/cn';
import { Modal } from '../ui/Modal';

interface CategoryForm {
  id?: number;
  name: string;
  icon: string;
  color: string;
}

const EMPTY_FORM: CategoryForm = { name: '', icon: '', color: '' };

const EMOJIS = ['☕', '🧊', '🥤', '🧋', '🍵', '🍫', '🍰', '🧁', '🍪', '🥐', '🥪', '🍓', '⭐', '✨'];
const COLORS = ['#D4A574', '#E8A0B4', '#C9A0DC', '#7EC8E3', '#90C8A0', '#F2C66D', '#F29E7D', '#A0A4B8'];

const inputClass = 'w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none placeholder:text-ink/20';
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';
const saveButton = 'w-full py-3 rounded-xl bg-cta text-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50';
const iconButton = 'p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5 disabled:opacity-20 disabled:pointer-events-none';

const productsLabel = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`;

/** The chips at the top of the POS: name, emoji, color and the order they appear in. */
export function CategoriesTab({ canManage, onChanged }: { canManage: boolean; onChanged: () => void }) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [deleting, setDeleting] = useState<ProductCategory | null>(null);
  const [moveTo, setMoveTo] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/products/categories')
    .then(res => setCategories(unwrap<ProductCategory[]>(res)))
    .catch(notifyError)
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const changed = () => {
    load();
    onChanged();
  };

  const openEdit = (c: ProductCategory) => setForm({
    id: c.id,
    name: c.name,
    icon: categoryEmoji(c.icon) ?? '',
    color: c.color ?? '',
  });

  const save = async () => {
    if (!form || !form.name.trim()) return;
    // Empty icon/color are sent as null so clearing them sticks
    const body = { name: form.name.trim(), icon: form.icon.trim() || null, color: form.color || null };
    setSaving(true);
    try {
      if (form.id) await api.patch(`/products/categories/${form.id}`, body);
      else await api.post('/products/categories', body);
      setForm(null);
      changed();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  /** Swaps a category with its neighbour and saves the whole order right away. */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const previous = categories;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
    try {
      await api.put('/products/categories/order', { ids: next.map(c => c.id) });
      onChanged();
    } catch (err) {
      setCategories(previous);
      notifyError(err);
      load();
    }
  };

  const askDelete = async (c: ProductCategory) => {
    if ((c._count?.products ?? 0) > 0) {
      // Products need a new home first; the modal below asks where
      setMoveTo('');
      setDeleting(c);
      return;
    }
    if (!await confirm({
      title: `¿Eliminar “${c.name}”?`,
      message: 'No tiene productos, así que solo desaparece de la barra del POS.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })) return;
    await remove(c);
  };

  const remove = async (c: ProductCategory, destination?: number) => {
    setSaving(true);
    try {
      await api.delete(`/products/categories/${c.id}`, { params: { moveTo: destination } });
      const target = categories.find(x => x.id === destination);
      toast.success(target ? `Sus productos ahora están en “${target.name}”.` : 'Categoría eliminada.', `“${c.name}” eliminada`);
      setDeleting(null);
      changed();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <p className="flex-1 text-ink/50 text-sm">
          Así aparecen en la barra del punto de venta, de izquierda a derecha.
        </p>
        {canManage && (
          <button onClick={() => setForm(EMPTY_FORM)} className="px-5 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-semibold hover:bg-primary/30 transition-all flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Nueva categoría
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : categories.length === 0 ? (
        <div className="glass-panel p-10 text-center text-ink/50">
          Aún no hay categorías. Crea la primera para agrupar tus productos en el POS.
        </div>
      ) : (
        <div className="glass-panel divide-y divide-ink/5">
          {categories.map((c, index) => {
            const emoji = categoryEmoji(c.icon);
            return (
              <div key={c.id} className="flex items-center gap-3 p-3 sm:p-4">
                {canManage && (
                  <div className="flex flex-col shrink-0 -my-1">
                    <button onClick={() => move(index, -1)} disabled={index === 0} className={iconButton} aria-label={`Subir ${c.name}`} title="Subir">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => move(index, 1)} disabled={index === categories.length - 1} className={iconButton} aria-label={`Bajar ${c.name}`} title="Bajar">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div
                  className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl bg-primary/10 border-2"
                  style={{ borderColor: c.color ?? 'transparent' }}
                >
                  {emoji ?? <Tags className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate">{c.name}</p>
                  <p className="text-ink/40 text-xs font-label mt-0.5">
                    {c._count?.products ? productsLabel(c._count.products) : 'Sin productos'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0">
                    <button onClick={() => openEdit(c)} className={iconButton} aria-label={`Editar ${c.name}`} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => askDelete(c)} className="p-2 rounded-lg text-error/70 hover:text-error hover:bg-error/10" aria-label={`Eliminar ${c.name}`} title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <Modal title={form.id ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setForm(null)}>
          <div className="space-y-5">
            <div>
              <label className={labelClass} htmlFor="category-name">Nombre</label>
              <input
                id="category-name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') save(); }}
                placeholder="Postres, Temporada, Bebidas calientes…"
                maxLength={50}
                className={inputClass}
                autoFocus
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="category-icon">Emoji (opcional)</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm({ ...form, icon: form.icon === e ? '' : e })}
                    className={cn('w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all',
                      form.icon === e ? 'border-primary bg-primary/15' : 'border-ink/10 bg-ink/5 hover:bg-ink/10')}
                    aria-label={`Usar ${e}`}
                    aria-pressed={form.icon === e}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <input
                id="category-icon"
                value={form.icon}
                onChange={e => setForm({ ...form, icon: e.target.value })}
                placeholder="O escribe cualquier emoji"
                maxLength={16}
                className={inputClass}
              />
            </div>

            <div>
              <p className={labelClass}>Color (opcional)</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, color: '' })}
                  className={cn('h-9 px-3 rounded-full text-xs font-label border transition-all',
                    !form.color ? 'border-primary text-primary bg-primary/10' : 'border-ink/10 text-ink/50 hover:bg-ink/5')}
                >
                  Sin color
                </button>
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={cn('w-9 h-9 rounded-full border-2 transition-all',
                      form.color.toLowerCase() === color.toLowerCase() ? 'border-ink scale-110' : 'border-transparent')}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                    aria-pressed={form.color.toLowerCase() === color.toLowerCase()}
                  />
                ))}
              </div>
            </div>

            <button onClick={save} disabled={saving || !form.name.trim()} className={saveButton}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar
            </button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Eliminar “${deleting.name}”`} onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            <p className="text-ink/70 text-sm">
              Esta categoría tiene {productsLabel(deleting._count?.products ?? 0)}. Elige a qué categoría se mueven; las ventas y recetas no cambian.
            </p>
            <div>
              <label className={labelClass} htmlFor="category-move-to">Mover productos a</label>
              <select
                id="category-move-to"
                value={moveTo}
                onChange={e => setMoveTo(e.target.value ? Number(e.target.value) : '')}
                className={inputClass}
              >
                <option value="">Elige una categoría…</option>
                {categories.filter(c => c.id !== deleting.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => moveTo !== '' && remove(deleting, moveTo)}
              disabled={saving || moveTo === ''}
              className="w-full py-3 rounded-xl bg-error text-canvas font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} Mover y eliminar
            </button>
            {categories.length < 2 && (
              <p className="text-ink/40 text-xs">Crea primero otra categoría para poder mover estos productos.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
