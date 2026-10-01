import { NavLink } from 'react-router-dom';
import { Coffee, LogOut, Palette } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../store/auth';
import { logout, navItems, ROLE_LABELS } from './nav';

/** Tablet (md): compact icon rail. Desktop (lg+): full sidebar. Hidden on phones. */
export function SideNavBar({ onOpenThemes }: { onOpenThemes: () => void }) {
  const user = useAuthStore(state => state.user);

  return (
    <aside className="hidden md:flex w-24 lg:w-64 h-full shrink-0 flex-col justify-between pt-safe border-r border-ink/10 bg-nav/80 backdrop-blur-3xl z-40">
      <div className="py-6 px-2 lg:px-4">
        <div className="mb-8 lg:mb-10 lg:px-4 flex flex-col items-center lg:items-start">
          <div className="lg:hidden w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Coffee className="w-6 h-6 text-primary" />
          </div>
          <h1 className="hidden lg:block font-headline font-bold text-2xl text-primary tracking-tight">MonMon Caf<span className="text-ink/50">é</span></h1>
          <p className="hidden lg:block font-label text-xs text-ink/40 mt-1 uppercase tracking-widest">Management OS</p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                title={item.label}
                className={({ isActive }) => cn(
                  "w-full flex flex-col lg:flex-row items-center gap-1 lg:gap-4 px-2 lg:px-4 py-3 rounded-xl transition-all duration-300 border border-transparent",
                  isActive
                    ? "bg-primary/10 text-primary border-primary/20 glow-primary-soft"
                    : "text-ink/60 hover:text-ink hover:bg-ink/5"
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon className="w-6 h-6 lg:w-5 lg:h-5" strokeWidth={isActive ? 2.5 : 2} />
                    <span className={cn("text-[11px] lg:text-base font-medium leading-tight text-center", isActive && "font-semibold")}>
                      <span className="lg:hidden">{item.shortLabel}</span>
                      <span className="hidden lg:inline">{item.label}</span>
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 py-6 px-2 lg:px-4 pb-safe">
        {user && (
          <div className="hidden lg:block px-4 pb-1">
            <p className="text-ink font-medium truncate">{user.name}</p>
            <p className="text-ink/40 text-xs font-label uppercase tracking-widest">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
        )}
        <button
          onClick={onOpenThemes}
          title="Temas"
          className="w-full flex flex-col lg:flex-row items-center gap-1 lg:gap-4 px-2 lg:px-4 py-3 rounded-xl text-ink/60 hover:text-primary hover:bg-primary/10 transition-all"
        >
          <Palette className="w-6 h-6 lg:w-5 lg:h-5" />
          <span className="text-[11px] lg:text-base font-medium">Temas</span>
        </button>
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="w-full flex flex-col lg:flex-row items-center gap-1 lg:gap-4 px-2 lg:px-4 py-3 rounded-xl text-error/80 hover:text-error hover:bg-error/10 transition-all"
        >
          <LogOut className="w-6 h-6 lg:w-5 lg:h-5" />
          <span className="text-[11px] lg:text-base font-medium">
            <span className="lg:hidden">Salir</span>
            <span className="hidden lg:inline">Cerrar sesión</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
