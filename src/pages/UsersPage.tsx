import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Pencil, Plus, Power, Save } from 'lucide-react';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { confirm, notifyError } from '../lib/dialogs';
import { unwrap } from '../lib/unwrap';
import { useAuthStore } from '../store/auth';
import { ROLE_LABELS } from '../components/layout/nav';
import { Modal } from '../components/ui/Modal';
import { inputClass, labelClass, primaryButtonClass } from '../components/finance/styles';

type Role = 'ADMIN' | 'SUPERVISOR' | 'CASHIER';

interface AppUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLogin: string | null;
}

interface UserForm {
  name: string;
  email: string;
  role: Role;
  password: string;
}

const EMPTY_FORM: UserForm = { name: '', email: '', role: 'CASHIER', password: '' };

const ROLE_HINTS: Record<Role, string> = {
  CASHIER: 'Vende y consulta',
  SUPERVISOR: 'Además edita inventario, recetas y gastos',
  ADMIN: 'Acceso total, incluye usuarios',
};

const ROLES: Role[] = ['CASHIER', 'SUPERVISOR', 'ADMIN'];

function formatLastLogin(value: string | null): string {
  if (!value) return 'Nunca ha entrado';
  return 'Último acceso: ' + new Date(value).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function UsersPage() {
  const currentUserId = useAuthStore(state => state.user?.id);
  const [users, setUsers] = useState<AppUser[]>([]);
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
        setUsers(unwrap<AppUser[]>(res));
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

  const openEdit = (u: AppUser) => {
    setForm({ name: u.name, email: u.email, role: u.role, password: '' });
    setEditing(u.id);
  };

  const isNew = editing === 'new';
  const passwordTooShort = form.password !== '' && form.password.length < 6;
  const canSave = form.name.trim() !== '' && form.email.trim() !== '' && (isNew ? form.password.length >= 6 : !passwordTooShort);

  const save = async () => {
    if (!canSave) return;
    const payload: Partial<UserForm> = {
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
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: AppUser) => {
    if (u.isActive && !await confirm({
      title: `¿Desactivar a ${u.name}?`,
      message: 'Ya no podrá iniciar sesión; sus ventas y cortes se conservan.',
      confirmLabel: 'Desactivar',
      tone: 'danger',
    })) return;
    try {
      await api.patch(`/users/${u.id}/toggle-active`);
      reload();
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-ink tracking-tight">Usuarios</h1>
          <p className="text-ink/50 text-sm font-label uppercase tracking-wider mt-1">Quién puede entrar y qué puede hacer</p>
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
            const isMe = u.id === currentUserId;
            return (
              <div key={u.id} className={`flex items-center gap-2 sm:gap-4 p-4 ${u.isActive ? '' : 'opacity-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate">
                    {u.name}{isMe && <span className="text-ink/40 font-normal"> (tú)</span>}
                  </p>
                  <p className="text-ink/50 text-sm truncate">{u.email}</p>
                  <p className="text-ink/40 text-xs font-label mt-0.5">
                    {u.isActive ? formatLastLogin(u.lastLogin) : 'Desactivado'}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-label uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5" aria-label={`Editar ${u.name}`}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  disabled={isMe}
                  className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${u.isActive ? 'text-error/70 hover:text-error hover:bg-error/10' : 'text-secondary/70 hover:text-secondary hover:bg-secondary/10'}`}
                  aria-label={u.isActive ? `Desactivar ${u.name}` : `Reactivar ${u.name}`}
                  title={isMe ? 'No puedes desactivar tu propia cuenta' : u.isActive ? 'Desactivar' : 'Reactivar'}
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
              <input id="user-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} autoFocus />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-email">Correo (para iniciar sesión)</label>
              <input id="user-email" type="email" autoCapitalize="none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-role">Rol</label>
              <select
                id="user-role"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as Role })}
                disabled={editing === currentUserId}
                className={inputClass}
              >
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <p className="text-ink/40 text-xs mt-1.5">
                {editing === currentUserId ? 'No puedes cambiar tu propio rol.' : ROLE_HINTS[form.role]}
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="user-password">
                <KeyRound className="w-3 h-3 inline -mt-0.5 mr-1" />
                {isNew ? 'Contraseña' : 'Nueva contraseña (opcional)'}
              </label>
              <input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder={isNew ? 'Mínimo 6 caracteres' : 'Déjala vacía para no cambiarla'}
                className={inputClass}
              />
              {passwordTooShort && <p className="text-error text-xs mt-1.5">Mínimo 6 caracteres.</p>}
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
