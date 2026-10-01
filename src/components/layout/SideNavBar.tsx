import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Coffee, Package, LineChart, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'pos', label: 'Punto de venta', icon: Coffee, path: '/pos' },
  { id: 'inventory', label: 'Inventario', icon: Package, path: '/inventory' },
  { id: 'finance', label: 'Finanzas', icon: LineChart, path: '/finance' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  CASHIER: 'Cajero',
};

export function SideNavBar() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  const handleLogout = () => {
    // Invalidate the refresh token server-side; log out locally regardless
    api.post('/auth/logout').catch(() => {}).finally(logout);
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 flex flex-col justify-between py-6 px-4 border-r border-surface-border bg-[#0a0b0e]/80 backdrop-blur-3xl z-40">
      <div>
        <div className="mb-10 px-4">
          <h1 className="font-headline font-bold text-2xl text-primary tracking-tight">MonMon Caf<span className="text-white/50">é</span></h1>
          <p className="font-label text-xs text-white/40 mt-1 uppercase tracking-widest">Management OS</p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => cn(
                  "w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all duration-300",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(0,219,233,0.15)]" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                    <span className={cn("font-medium", isActive ? "font-semibold" : "")}>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        {user && (
          <div className="px-4">
            <p className="text-white font-medium truncate">{user.name}</p>
            <p className="text-white/40 text-xs font-label uppercase tracking-widest">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-4 px-4 py-3 rounded-xl text-error/80 hover:text-error hover:bg-error/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
