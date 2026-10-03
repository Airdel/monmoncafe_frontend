import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Pencil, Plus, Power, Save, Users } from 'lucide-react';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { unwrap } from '../lib/unwrap';
import { useAuthStore } from '../store/auth';
import { ROLE_LABELS } from '../components/layout/nav';
import { inputClass, labelClass, primaryButtonClass } from '../components/finance/styles';
import { Modal } from '../components/ui/Modal';

type Role = 'ADMIN' | 'SUPERVISOR' | 'CASHIER';

interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

interface UserForm {
  name: string;
  email: string;
  role: Role;
  password: string;
}

const EMPTY_FORM: UserForm = { name: '', email: '', role: 'CASHIER', password: '' };

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: 'Todo, incluidos los cortes de caja y la administración de usuarios',
  SUPERVISOR: 'Además de vender, edita productos, recetas, inventario, proveedores y gastos',
  CASHIER: 'Vende, atiende comandas y consulta; no edita el catálogo',
};

const ROLE_BADGES: Record<Role, string> = {
  ADMIN: 'bg-primary/15 text-primary',
  SUPERVISOR: 'bg-secondary/15 text-secondary',
  CASHIER: 'bg-ink/10 text-ink/60',
};

function formatLastLogin(value: string | null): string {
  if (!value) return 'Nunca ha entrado';
  return 'Último acceso: ' + new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function UsersPage() {
  const me = useAuthStore(state => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // null = closed, 'new' = create, number = editing that id
  const [editing, setEditing] = useState<'new' | number | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/users')
      .then(res => {
        if (cancelled) return;
        // Active users first, then by name
        const list = unwrap<User[]>(res).sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
        setUsers(list);
        setError('');
      })
      .catch(err => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey(k => k + 1);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };

  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, role: u.role, password: '' });
    setEditing(u.id);
  };

  const isNew = editing === 'new';
  const passwordOk = isNew ? form.password.length >= 6 : form.password === '' || form.password.length >= 6;
  const canSave = form.name.trim() !== '' && form.email.trim() !== '' && passwordOk;

  const save = async () => {
    if (!canSave) return;
    const payload: Record<string, string> = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
    };
    if (form.password) payload.password = form.password;
    setSaving(true);
    try {
      if (isNew) await api.post('/users', payload);
      else await api.patch(`/users/${editing}`, payload);
      setEditing(null);
      reload();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    if (u.isActive && !window.confirm(`¿Desactivar a ${u.name}?\n\nYa no podrá iniciar sesión y se cerrará su sesión abierta. Sus ventas y registros se conservan.`)) return;
    try {
      await api.patch(`/users/${u.id}/toggle-active`);
      reload();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    }
  };

  const activeCount = users.filter(u => u.isActive).length;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-bold text-ink flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" /> Usuarios
          </h2>
          <p className="text-ink/50 mt-1">
            {loading ? 'Cargando…' : `${activeCount} activo${activeCount === 1 ? '' : 's'} de ${users.length}`}
          </p>
        </div>
        <button onClick={openCreate} className={primaryButtonClass}><Plus className="w-5 h-5" /> Nuevo usuario</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="glass-panel p-6 text-error">{error}</div>
      ) : (
        <div className="glass-panel divide-y divide-ink/5">
          {users.map(u => {
            const isMe = u.id === me?.id;
            return (
              <div key={u.id} className={`flex items-center gap-2 sm:gap-4 p-4 ${u.isActive ? '' : 'opacity-50'}`}>
                <div className="w-10 h-10 shrink-0 rounded-full bg-primary/15 text-primary font-headline font-bold flex items-center justify-center">
                  {u.name.trim().charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate">
                    {u.name}
                    {isMe && <span className="text-ink/40 font-normal"> (tú)</span>}
                  </p>
                  <p className="text-ink/50 text-sm truncate">{u.email}</p>
                  <p className="text-ink/40 text-xs font-label mt-0.5">
                    <span className="sm:hidden">{ROLE_LABELS[u.role] ?? u.role} · </span>
                    {u.isActive ? formatLastLogin(u.lastLogin) : 'Desactivado'}
                  </p>
                </div>
                <span className={`hidden sm:inline px-3 py-1 rounded-full text-xs font-semibold ${ROLE_BADGES[u.role]}`}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5" aria-label={`Editar ${u.name}`} title="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  disabled={isMe}
                  className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${u.isActive ? 'text-error/70 hover:text-error hover:bg-error/10' : 'text-secondary/70 hover:text-secondary hover:bg-secondary/10'}`}
                  aria-label={u.isActive ? `Desactivar ${u.name}` : `Reactivar ${u.name}`}
                  title={isMe ? 'No puedes desactivarte a ti mismo' : u.isActive ? 'Desactivar' : 'Reactivar'}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <Modal title={isNew ? 'Nuevo usuario' : 'Editar usuario'} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="user-name">Nombre</label>
              <input id="user-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mónica" className={inputClass} autoFocus />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-email">Correo (para iniciar sesión)</label>
              <input id="user-email" type="email" autoComplete="off" autoCapitalize="none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="monica@cafeteria.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-role">Rol</label>
              <select id="user-role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })} className={inputClass}>
                {(Object.keys(ROLE_HINTS) as Role[]).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <p className="text-ink/40 text-xs mt-2">{ROLE_HINTS[form.role]}</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="user-password">
                {isNew ? 'Contraseña' : 'Nueva contraseña (opcional)'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-ink/30 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={isNew ? 'Mínimo 6 caracteres' : 'Déjala vacía para no cambiarla'}
                  className={`${inputClass} pl-11`}
                />
              </div>
              {form.password !== '' && form.password.length < 6 && (
                <p className="text-error text-xs mt-2">Mínimo 6 caracteres</p>
              )}
              {!isNew && form.password !== '' && (
                <p className="text-ink/40 text-xs mt-2">Al cambiarla se cerrará la sesión de este usuario en sus dispositivos.</p>
              )}
            </div>
            <button onClick={save} disabled={saving || !canSave} className={`${primaryButtonClass} w-full`}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
