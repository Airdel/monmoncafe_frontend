import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Loader2, MapPin, Pencil, Phone, Plus, Power, Save, Store } from 'lucide-react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { matchesSearch } from '../../lib/search';
import { unwrap } from '../../lib/unwrap';
import { inputClass, labelClass, primaryButtonClass } from '../finance/styles';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  _count?: { ingredients: number };
}

interface SupplierForm {
  name: string;
  website: string;
  phone: string;
  address: string;
  email: string;
  notes: string;
}

const EMPTY_FORM: SupplierForm = { name: '', website: '', phone: '', address: '', email: '', notes: '' };

/** Adds https:// when the link was typed without it (e.g. "mercadolibre.com.mx"). */
function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function hostOf(url: string): string {
  try {
    return new URL(withProtocol(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Suppliers are the stores where ingredients are bought: the corner store, MercadoLibre, local candy shops… */
export function SuppliersTab({ onChanged }: { onChanged: () => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // null = closed, 'new' = create, number = editing that id
  const [editing, setEditing] = useState<'new' | number | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/suppliers', { params: { includeInactive: showInactive || undefined } })
      .then(res => {
        if (cancelled) return;
        setSuppliers(unwrap<Supplier[]>(res));
        setError('');
      })
      .catch(err => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showInactive, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey(k => k + 1);
    onChanged();
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };

  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name,
      website: s.website ?? '',
      phone: s.phone ?? '',
      address: s.address ?? '',
      email: s.email ?? '',
      notes: s.notes ?? '',
    });
    setEditing(s.id);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    // On edit an emptied field is sent as null so it gets cleared
    const empty = editing === 'new' ? undefined : null;
    const field = (value: string) => value.trim() || empty;
    const website = form.website.trim();
    const payload = {
      name: form.name.trim(),
      website: website ? withProtocol(website) : empty,
      phone: field(form.phone),
      address: field(form.address),
      email: field(form.email),
      notes: field(form.notes),
    };
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/suppliers', payload);
      else await api.patch(`/suppliers/${editing}`, payload);
      setEditing(null);
      reload();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Supplier) => {
    const count = s._count?.ingredients ?? 0;
    const warning = count > 0 ? `\n\n${count} insumo${count === 1 ? ' sigue' : 's siguen'} asignado${count === 1 ? '' : 's'} a esta tienda.` : '';
    if (s.isActive && !window.confirm(`¿Desactivar "${s.name}"?\n\nYa no aparecerá al registrar compras ni al asignar insumos. Las compras pasadas se conservan.${warning}`)) return;
    try {
      if (s.isActive) await api.delete(`/suppliers/${s.id}`);
      else await api.patch(`/suppliers/${s.id}`, { isActive: true });
      reload();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    }
  };

  const visible = suppliers.filter(s => matchesSearch(search, s.name, s.address, s.website, s.notes));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar tienda" className="w-full sm:max-w-xs" />
        <label className="flex items-center gap-2 text-ink/60 text-sm cursor-pointer select-none sm:mr-auto">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => { setLoading(true); setShowInactive(e.target.checked); }}
            className="accent-primary"
          />
          Mostrar desactivadas
        </label>
        <button onClick={openCreate} className={primaryButtonClass}><Plus className="w-5 h-5" /> Nueva tienda</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="glass-panel p-6 text-error">{error}</div>
      ) : visible.length === 0 ? (
        <div className="glass-panel p-10 text-center text-ink/50">
          {search
            ? `Ninguna tienda coincide con "${search}"`
            : 'Aún no registras dónde compras los insumos: la tienda de la esquina, MercadoLibre, dulcerías…'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map(s => {
            const count = s._count?.ingredients ?? 0;
            return (
              <div key={s.id} className={`glass-panel p-4 flex gap-3 ${s.isActive ? '' : 'opacity-50'}`}>
                <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  {s.website && !s.address ? <Globe className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-ink font-medium truncate">{s.name}</p>
                  <p className="text-ink/40 text-xs font-label">
                    {count === 0 ? 'Sin insumos asignados' : `${count} insumo${count === 1 ? '' : 's'}`}
                    {!s.isActive && ' · desactivada'}
                  </p>
                  {s.website && (
                    <a href={withProtocol(s.website)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary text-sm hover:underline min-w-0">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{hostOf(s.website)}</span>
                    </a>
                  )}
                  {s.address && (
                    <p className="flex items-start gap-1.5 text-ink/60 text-sm"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />{s.address}</p>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-ink/60 text-sm hover:text-ink"><Phone className="w-3.5 h-3.5 shrink-0" />{s.phone}</a>
                  )}
                  {s.notes && <p className="text-ink/50 text-sm italic">{s.notes}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5" aria-label={`Editar ${s.name}`} title="Editar">
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
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <Modal title={editing === 'new' ? 'Nueva tienda' : 'Editar tienda'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="supplier-name">Nombre</label>
              <input id="supplier-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tienda de la esquina, MercadoLibre…" className={inputClass} autoFocus />
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-address">Dirección (opcional)</label>
              <input id="supplier-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Calle, colonia, Tepic" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-website">Enlace / tienda en línea (opcional)</label>
              <input id="supplier-website" type="url" inputMode="url" autoCapitalize="none" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="mercadolibre.com.mx" className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="supplier-phone">Teléfono (opcional)</label>
                <input id="supplier-phone" type="tel" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="311 123 4567" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="supplier-email">Correo (opcional)</label>
                <input id="supplier-email" type="email" autoCapitalize="none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-notes">Notas (opcional)</label>
              <input id="supplier-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Horario, qué conviene comprar ahí…" className={inputClass} />
            </div>
            <button onClick={save} disabled={saving || !form.name.trim()} className={`${primaryButtonClass} w-full`}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
