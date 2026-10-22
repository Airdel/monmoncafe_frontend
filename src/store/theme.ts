import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { DARK_THEMES, DEFAULT_THEME, DYNAMIC_THEME, isThemeId, type ThemeId } from '../lib/themes';
import { DEFAULT_DECOR, isDecorMode, resolveSeason, type DecorMode, type SeasonId } from '../lib/seasons';
import { DEFAULT_SEED, dynamicTokens, isHexColor } from '../lib/dynamicColor';
import { getWallpaperSeed } from '../lib/systemColors';

/** Light/dark for the "Mi fondo" theme; 'auto' follows the phone's dark mode. */
export type DynamicMode = 'auto' | 'light' | 'dark';
/** Where "Mi fondo" takes its color from. */
export type SeedSource = 'wallpaper' | 'custom';

const isDynamicMode = (v: unknown): v is DynamicMode => v === 'auto' || v === 'light' || v === 'dark';
const isSeedSource = (v: unknown): v is SeedSource => v === 'wallpaper' || v === 'custom';

interface ThemeState {
  theme: ThemeId;
  decor: DecorMode;
  /** Falling leaves/snow; off keeps only the still decoration. */
  decorMotion: boolean;
  setTheme: (theme: ThemeId) => void;
  setDecor: (decor: DecorMode) => void;
  setDecorMotion: (decorMotion: boolean) => void;
  /** Seed color chosen by hand for "Mi fondo". */
  seed: string;
  seedSource: SeedSource;
  dynamicMode: DynamicMode;
  /** Vibrate on key moments (adding products, sale recorded, errors). */
  haptics: boolean;
  setSeed: (seed: string) => void;
  setSeedSource: (seedSource: SeedSource) => void;
  setDynamicMode: (dynamicMode: DynamicMode) => void;
  setHaptics: (haptics: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      decor: DEFAULT_DECOR,
      decorMotion: true,
      setTheme: (theme) => set({ theme }),
      setDecor: (decor) => set({ decor }),
      setDecorMotion: (decorMotion) => set({ decorMotion }),
      seed: DEFAULT_SEED,
      seedSource: 'wallpaper',
      dynamicMode: 'auto',
      haptics: true,
      setSeed: (seed) => set({ seed, seedSource: 'custom' }),
      setSeedSource: (seedSource) => set({ seedSource }),
      setDynamicMode: (dynamicMode) => set({ dynamicMode }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    {
      name: 'theme',
      // Ignore stored values for themes/seasons that no longer exist
      merge: (persisted, current) => {
        const stored = (persisted as Partial<ThemeState> | undefined) ?? {};
        return {
          ...current,
          theme: isThemeId(stored.theme) ? stored.theme : current.theme,
          decor: isDecorMode(stored.decor) ? stored.decor : current.decor,
          decorMotion: typeof stored.decorMotion === 'boolean' ? stored.decorMotion : current.decorMotion,
          seed: isHexColor(stored.seed) ? stored.seed : current.seed,
          seedSource: isSeedSource(stored.seedSource) ? stored.seedSource : current.seedSource,
          dynamicMode: isDynamicMode(stored.dynamicMode) ? stored.dynamicMode : current.dynamicMode,
          haptics: typeof stored.haptics === 'boolean' ? stored.haptics : current.haptics,
        };
      },
    },
  ),
);

/** Active season for this device, re-checked every hour so 'auto' changes on its own. */
export function useActiveSeason(): SeasonId | null {
  const mode = useThemeStore(state => state.decor);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  return resolveSeason(mode, now);
}

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
/** Wallpaper color read from Android (null on the web or before Android 12). */
let wallpaperSeed: string | null = null;
/** Inline tokens currently set on <html> by "Mi fondo", removed when leaving it. */
let appliedTokens: string[] = [];

/** Seed and light/dark the "Mi fondo" theme uses right now. */
export function resolveDynamic(state: Pick<ThemeState, 'seed' | 'seedSource' | 'dynamicMode'>) {
  const seed = state.seedSource === 'wallpaper' && wallpaperSeed ? wallpaperSeed : state.seed;
  const dark = state.dynamicMode === 'dark' || (state.dynamicMode === 'auto' && systemDark.matches);
  return { seed, dark };
}

/** True when the wallpaper color can be used on this device. */
export function useWallpaperAvailable() {
  const [available, setAvailable] = useState(wallpaperSeed !== null);
  useEffect(() => {
    getWallpaperSeed().then(seed => setAvailable(seed !== null));
  }, []);
  return available;
}

function applyTheme(state: ThemeState) {
  const root = document.documentElement;
  root.dataset.theme = state.theme;

  for (const name of appliedTokens) root.style.removeProperty(name);
  appliedTokens = [];
  let dark = DARK_THEMES.has(state.theme);
  if (state.theme === DYNAMIC_THEME) {
    const resolved = resolveDynamic(state);
    dark = resolved.dark;
    for (const [name, value] of Object.entries(dynamicTokens(resolved.seed, resolved.dark))) {
      root.style.setProperty(name, value);
      appliedTokens.push(name);
    }
  }

  const themeColor = getComputedStyle(root).getPropertyValue('--theme-color').trim();
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  if (themeColor) meta.content = themeColor;

  if (Capacitor.isNativePlatform()) {
    // DARK = light icons for dark backgrounds
    const style = dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
    SystemBars.setStyle({ style }).catch(() => {});
  }
}

/** Re-reads the wallpaper color (it may have changed while the app was in the background). */
export async function refreshWallpaperSeed() {
  const seed = await getWallpaperSeed();
  if (seed === wallpaperSeed) return;
  wallpaperSeed = seed;
  const state = useThemeStore.getState();
  if (state.theme === DYNAMIC_THEME) applyTheme(state);
}

/** Keeps <html data-theme> (and the Android status bar) in sync with the store. */
export function initTheme() {
  applyTheme(useThemeStore.getState());
  useThemeStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme || state.seed !== prev.seed || state.seedSource !== prev.seedSource || state.dynamicMode !== prev.dynamicMode) {
      applyTheme(state);
    }
  });
  systemDark.addEventListener('change', () => {
    const state = useThemeStore.getState();
    if (state.theme === DYNAMIC_THEME) applyTheme(state);
  });
  refreshWallpaperSeed();
}
