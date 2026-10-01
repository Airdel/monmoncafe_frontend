import { NavLink } from 'react-router-dom';
import { LogOut, Palette } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../store/auth';
import { logout, navItems, ROLE_LABELS } from './nav';

/** Phone header: brand, current user, themes and logout. */
export function MobileTopBar({ onOpenThemes }: { onOpenThemes: () => void }) {
  const user = useAuthStore(state => state.user);

  return (
    <header className="md:hidden shrink-0 pt-safe border-b border-ink/10 bg-nav/80 backdrop-blur-3xl z-40">
      <div className="h-14 px-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-headline font-bold text-xl text-primary tracking-tight leading-none">MonMon Caf<span className="text-ink/50">é</span></h1>
          {user && <p className="text-ink/50 text-xs truncate mt-0.5">{user.name} · {ROLE_LABELS[user.role] ?? user.role}</p>}
        </div>
        <button onClick={onOpenThemes} className="w-10 h-10 rounded-full flex items-center justify-center text-ink/70 hover:text-primary hover:bg-primary/10" aria-label="Temas">
          <Palette className="w-5 h-5" />
        </button>
        <button onClick={logout} className="w-10 h-10 rounded-full flex items-center justify-center text-error/80 hover:text-error hover:bg-error/10" aria-label="Cerrar sesión">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

/** Phone tab bar, reachable with the thumb. */
export function BottomNav() {
  return (
    <nav className="md:hidden shrink-0 pb-safe border-t border-ink/10 bg-nav/90 backdrop-blur-3xl z-40">
      <div className="grid grid-cols-4 h-16">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-ink/50"
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cn("px-4 py-1 rounded-full transition-colors", isActive && "bg-primary/15")}>
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  {item.shortLabel}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
