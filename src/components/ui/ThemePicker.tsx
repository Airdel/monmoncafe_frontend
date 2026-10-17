import { Check, Coffee } from 'lucide-react';
import { THEMES } from '../../lib/themes';
import { SEASONS, getSeason, seasonForDate, type DecorMode } from '../../lib/seasons';
import { useThemeStore } from '../../store/theme';
import { Modal } from './Modal';
import { APP_VERSION } from '../../lib/version';

/** Theme chooser; each card renders a small live preview using that theme's tokens. */
export function ThemePicker({ onClose }: { onClose: () => void }) {
  const theme = useThemeStore(state => state.theme);
  const setTheme = useThemeStore(state => state.setTheme);
  const decor = useThemeStore(state => state.decor);
  const setDecor = useThemeStore(state => state.setDecor);
  const decorMotion = useThemeStore(state => state.decorMotion);
  const setDecorMotion = useThemeStore(state => state.setDecorMotion);
  const today = seasonForDate(new Date());

  const decorOptions: { id: DecorMode; label: string; hint: string }[] = [
    { id: 'auto', label: 'Automática', hint: today ? `Hoy: ${getSeason(today).name}` : 'Hoy: ninguna' },
    ...SEASONS.map(season => ({ id: season.id as DecorMode, label: season.name, hint: season.description })),
    { id: 'off', label: 'Sin decoración', hint: 'Solo el tema' },
  ];

  return (
    <Modal title="Temas" onClose={onClose} wide>
      <p className="text-ink/60 text-sm mb-4">Elige cómo se ve la app en este dispositivo.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map(t => {
          const active = t.id === theme;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              aria-pressed={active}
              data-theme={t.id}
              className={`text-left rounded-2xl p-3 border-2 bg-canvas text-ink font-body transition-transform active:scale-[0.98] ${active ? 'border-primary' : 'border-ink/10 hover:border-primary/40'}`}
            >
              <div className="glass-panel p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold leading-tight">{t.name}</p>
                  <p className="text-ink/50 text-xs truncate">{t.description}</p>
                </div>
                {active && (
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="flex-1 h-8 rounded-xl bg-cta text-on-primary text-xs font-bold flex items-center justify-center">Cobrar</span>
                <span className="w-8 h-8 rounded-full bg-secondary" />
                <span className="w-8 h-8 rounded-full bg-accent" />
                <span className="w-8 h-8 rounded-full bg-error" />
              </div>
            </button>
          );
        })}
      </div>

      <h4 className="font-headline font-bold text-ink mt-6 mb-1">Decoración de temporada</h4>
      <p className="text-ink/60 text-sm mb-3">Se suma al tema. En automática cambia sola: otoño en octubre y noviembre, Día de Muertos del 25 de octubre al 2 de noviembre y Navidad del 1 de diciembre al 6 de enero.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {decorOptions.map(option => {
          const active = option.id === decor;
          return (
            <button
              key={option.id}
              onClick={() => setDecor(option.id)}
              aria-pressed={active}
              className={`text-left rounded-xl px-3 py-2 border-2 transition-colors ${active ? 'border-primary bg-primary/10' : 'border-ink/10 hover:border-primary/40'}`}
            >
              <p className="font-bold text-sm leading-tight">{option.label}</p>
              <p className="text-ink/50 text-xs truncate">{option.hint}</p>
            </button>
          );
        })}
      </div>
      {decor !== 'off' && (
        <label className="flex items-center gap-3 mt-3 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={decorMotion}
            onChange={e => setDecorMotion(e.target.checked)}
            className="w-5 h-5 shrink-0 accent-[rgb(var(--c-primary))]"
          />
          <span>Animación (hojas, pétalos o nieve cayendo). Apágala si el celular se siente lento.</span>
        </label>
      )}
      {APP_VERSION && <p className="text-center text-ink/40 text-xs mt-4">Versión {APP_VERSION}</p>}
    </Modal>
  );
}
