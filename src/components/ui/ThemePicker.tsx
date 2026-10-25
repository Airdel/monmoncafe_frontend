import type { CSSProperties } from 'react';
import { Check, Coffee, Smartphone } from 'lucide-react';
import { DYNAMIC_THEME, THEMES } from '../../lib/themes';
import { SEASONS, getSeason, seasonForDate, type DecorMode } from '../../lib/seasons';
import { SEED_PRESETS, dynamicTokens } from '../../lib/dynamicColor';
import { resolveDynamic, useThemeStore, useWallpaperAvailable, type DynamicMode } from '../../store/theme';
import { Modal } from './Modal';
import { APP_VERSION } from '../../lib/version';
import { SOUND_LEVELS, SOUND_STYLES } from '../../lib/soundSettings';
import { previewSound } from '../../lib/sounds';

/** Theme chooser; each card renders a small live preview using that theme's tokens. */
export function ThemePicker({ onClose }: { onClose: () => void }) {
  const theme = useThemeStore(state => state.theme);
  const setTheme = useThemeStore(state => state.setTheme);
  const decor = useThemeStore(state => state.decor);
  const setDecor = useThemeStore(state => state.setDecor);
  const decorMotion = useThemeStore(state => state.decorMotion);
  const setDecorMotion = useThemeStore(state => state.setDecorMotion);
  const today = seasonForDate(new Date());
  const seed = useThemeStore(state => state.seed);
  const seedSource = useThemeStore(state => state.seedSource);
  const dynamicMode = useThemeStore(state => state.dynamicMode);
  const setSeed = useThemeStore(state => state.setSeed);
  const setSeedSource = useThemeStore(state => state.setSeedSource);
  const setDynamicMode = useThemeStore(state => state.setDynamicMode);
  const haptics = useThemeStore(state => state.haptics);
  const setHaptics = useThemeStore(state => state.setHaptics);
  const soundLevel = useThemeStore(state => state.soundLevel);
  const setSoundLevel = useThemeStore(state => state.setSoundLevel);
  const soundStyle = useThemeStore(state => state.soundStyle);
  const setSoundStyle = useThemeStore(state => state.setSoundStyle);
  const soundVolume = useThemeStore(state => state.soundVolume);
  const setSoundVolume = useThemeStore(state => state.setSoundVolume);
  const wallpaperAvailable = useWallpaperAvailable();
  const usingWallpaper = wallpaperAvailable && seedSource === 'wallpaper';

  // "Mi fondo" has no CSS block: its preview card gets the computed tokens inline
  const dynamic = resolveDynamic({ seed, seedSource, dynamicMode });
  const { 'color-scheme': colorScheme, ...dynamicVars } = dynamicTokens(dynamic.seed, dynamic.dark);
  const dynamicStyle = { ...dynamicVars, colorScheme } as CSSProperties;

  const modeOptions: { id: DynamicMode; label: string }[] = [
    { id: 'auto', label: 'Según el celular' },
    { id: 'light', label: 'Claro' },
    { id: 'dark', label: 'Oscuro' },
  ];

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
              style={t.id === DYNAMIC_THEME ? dynamicStyle : undefined}
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

      {theme === DYNAMIC_THEME && (
        <>
          <h4 className="font-headline font-bold text-ink mt-6 mb-1">Color de Mi fondo</h4>
          <p className="text-ink/60 text-sm mb-3">
            {wallpaperAvailable
              ? 'Toma el color de tu fondo de pantalla, o elige uno.'
              : 'Elige un color y la app arma toda la paleta. En la app de Android 12 o más nuevo también puede tomar el color de tu fondo de pantalla.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {wallpaperAvailable && (
              <button
                onClick={() => setSeedSource('wallpaper')}
                aria-pressed={usingWallpaper}
                className={`h-12 px-4 rounded-full border-2 flex items-center gap-2 text-sm font-bold transition-colors ${usingWallpaper ? 'border-primary bg-primary/10 text-primary' : 'border-ink/10 hover:border-primary/40'}`}
              >
                <Smartphone className="w-4 h-4" /> Fondo de pantalla
              </button>
            )}
            {SEED_PRESETS.map(preset => {
              const active = !usingWallpaper && seed.toLowerCase() === preset.hex;
              return (
                <button
                  key={preset.hex}
                  onClick={() => setSeed(preset.hex)}
                  aria-pressed={active}
                  aria-label={preset.name}
                  title={preset.name}
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'border-primary' : 'border-transparent'}`}
                >
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: preset.hex }}>
                    {active && <Check className="w-4 h-4" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
            <label
              className={`h-12 pl-1.5 pr-4 rounded-full border-2 flex items-center gap-2 text-sm font-bold cursor-pointer ${!usingWallpaper && !SEED_PRESETS.some(p => p.hex === seed.toLowerCase()) ? 'border-primary bg-primary/10 text-primary' : 'border-ink/10 hover:border-primary/40'}`}
            >
              <input
                type="color"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                className="w-9 h-9 rounded-full border-0 p-0 bg-transparent cursor-pointer"
                aria-label="Otro color"
              />
              Otro
            </label>
          </div>
          <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Claro u oscuro">
            {modeOptions.map(option => (
              <button
                key={option.id}
                onClick={() => setDynamicMode(option.id)}
                aria-pressed={dynamicMode === option.id}
                className={`h-11 px-4 rounded-full border-2 text-sm font-bold transition-colors ${dynamicMode === option.id ? 'border-primary bg-primary/10 text-primary' : 'border-ink/10 hover:border-primary/40'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}

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

      <h4 className="font-headline font-bold text-ink mt-6 mb-1">Al tocar</h4>
      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={haptics}
          onChange={e => setHaptics(e.target.checked)}
          className="w-5 h-5 shrink-0 accent-[rgb(var(--c-primary))]"
        />
        <span>Vibración suave al agregar productos, cobrar o cuando algo sale mal (en el celular).</span>
      </label>

      <h4 className="font-headline font-bold text-ink mt-6 mb-1">Sonidos</h4>
      <p className="text-ink/60 text-sm mb-3">Solo importantes: venta, pedido a comandas, comanda nueva o lista, errores y corte. Todos: también al agregar y quitar productos.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Cuándo suenan">
        {SOUND_LEVELS.map(option => {
          const active = soundLevel === option.id;
          return (
            <button key={option.id} onClick={() => setSoundLevel(option.id)} aria-pressed={active} className={`h-11 px-4 rounded-full border-2 text-sm font-bold transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-ink/10 hover:border-primary/40'}`}>
              {option.name}
            </button>
          );
        })}
      </div>
      {soundLevel !== 'off' && (
        <>
          <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Estilo de sonido">
            {SOUND_STYLES.map(option => {
              const active = soundStyle === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => { setSoundStyle(option.id); previewSound(option.id); }}
                  aria-pressed={active}
                  className={`h-11 px-4 rounded-full border-2 text-sm font-bold transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-ink/10 hover:border-primary/40'}`}
                >
                  {option.name}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-3 mt-3 text-sm">
            <span className="font-bold">Volumen</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={soundVolume}
              onChange={e => setSoundVolume(Number(e.target.value))}
              onPointerUp={() => previewSound(soundStyle)}
              onKeyUp={() => previewSound(soundStyle)}
              className="flex-1 max-w-xs accent-[rgb(var(--c-primary))]"
              aria-label="Volumen de los sonidos"
            />
            <span className="font-mono w-10 text-right">{soundVolume}%</span>
          </label>
          <p className="text-ink/50 text-xs mt-2">En Android usan el volumen de multimedia; el modo silencio del celular no los calla.</p>
        </>
      )}
      {APP_VERSION && <p className="text-center text-ink/40 text-xs mt-4">Versión {APP_VERSION}</p>}
    </Modal>
  );
}
