import { argbFromHex, Hct, SchemeTonalSpot, TonalPalette } from '@material/material-color-utilities';

// "Mi fondo" theme (Material You). Instead of a fixed block in src/index.css,
// its tokens are computed from one seed color with Google's color library,
// the same tonal palettes Android 12+ builds from the wallpaper.

export const DEFAULT_SEED = '#cc407a';

/** Seeds offered in the theme picker when the wallpaper color isn't available. */
export const SEED_PRESETS = [
  { hex: '#cc407a', name: 'Fresa' },
  { hex: '#7a5bc4', name: 'Violeta' },
  { hex: '#2f7fb8', name: 'Mar' },
  { hex: '#4a7a30', name: 'Bosque' },
  { hex: '#d9822b', name: 'Atardecer' },
  { hex: '#a05e30', name: 'Café' },
] as const;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

const rgb = (argb: number) => `${(argb >> 16) & 255} ${(argb >> 8) & 255} ${argb & 255}`;
const hex = (argb: number) => `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`;

/** Every token a theme block in src/index.css defines, derived from the seed. */
export function dynamicTokens(seed: string, dark: boolean): Record<string, string> {
  const s = new SchemeTonalSpot(Hct.fromInt(argbFromHex(isHexColor(seed) ? seed : DEFAULT_SEED)), dark, 0);
  const primary = s.primaryPalette;
  // Tonal Spot's tertiary is quite muted; prices and the second action need a
  // livelier color (like green in Fresa), so keep its hue with more chroma
  const tertiary = TonalPalette.fromHueAndChroma(s.tertiaryPalette.hue, 48);
  const secondary = tertiary.tone(dark ? 80 : 40);

  return {
    'color-scheme': dark ? 'dark' : 'light',
    '--c-canvas': rgb(s.surface),
    '--c-ink': rgb(s.onSurface),
    '--c-shade': rgb(s.neutralPalette.tone(10)),
    '--c-raised': rgb(dark ? s.surfaceContainerHigh : s.surfaceContainerLowest),
    '--c-card': rgb(dark ? s.surfaceContainer : s.surfaceContainerLow),
    '--card-alpha': '1',
    '--c-nav': rgb(s.surfaceContainer),
    '--c-primary': rgb(s.primary),
    '--c-secondary': rgb(secondary),
    '--c-accent': rgb(s.secondary),
    '--c-warning': dark ? '250 204 21' : '176 110 10',
    '--c-error': rgb(s.error),
    '--c-on-primary': rgb(s.onPrimary),
    '--c-on-secondary': rgb(tertiary.tone(dark ? 20 : 100)),
    '--c-cta-from': rgb(primary.tone(dark ? 86 : 50)),
    '--c-cta-to': rgb(s.primary),
    '--c-cta-alt-from': rgb(tertiary.tone(dark ? 86 : 50)),
    '--c-cta-alt-to': rgb(secondary),
    '--blob-1': rgb(s.primaryContainer),
    '--blob-2': rgb(s.tertiaryContainer),
    '--blob-alpha': dark ? '0.12' : '0.45',
    '--text-floor': dark ? '0' : '0.35',
    // Tonal surfaces instead of frosted glass (also lighter on cheap phones)
    '--panel-blur': '0px',
    '--panel-shadow': dark
      ? '0 1px 3px rgb(0 0 0 / 0.3)'
      : '0 1px 2px rgb(0 0 0 / 0.08), 0 2px 6px 1px rgb(var(--c-primary) / 0.06)',
    '--glow-strength': dark ? '0.3' : '0.2',
    '--glow-offset': '4px',
    '--radius-lg': '0.75rem',
    '--radius-xl': '1rem',
    '--radius-2xl': '1.75rem',
    '--font-headline': "'Fredoka Variable', 'Nunito Variable', sans-serif",
    '--font-body': "'Nunito Variable', sans-serif",
    '--font-label': "'Nunito Variable', sans-serif",
    '--font-mono': "'Nunito Variable', ui-sans-serif, sans-serif",
    '--theme-color': hex(s.surface),
    '--decor-snow': dark ? '#ffffff' : '#8fbce6',
  };
}
