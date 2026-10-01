import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { DARK_THEMES, DEFAULT_THEME, isThemeId, type ThemeId } from '../lib/themes';

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'theme',
      // Ignore stored values for themes that no longer exist
      merge: (persisted, current) => {
        const theme = (persisted as Partial<ThemeState> | undefined)?.theme;
        return { ...current, theme: isThemeId(theme) ? theme : current.theme };
      },
    },
  ),
);

function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.dataset.theme = theme;

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
    const style = DARK_THEMES.has(theme) ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
    SystemBars.setStyle({ style }).catch(() => {});
  }
}

/** Keeps <html data-theme> (and the Android status bar) in sync with the store. */
export function initTheme() {
  applyTheme(useThemeStore.getState().theme);
  useThemeStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme) applyTheme(state.theme);
  });
}
