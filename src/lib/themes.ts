// Values for each theme live in src/index.css under [data-theme='<id>']
export const THEMES = [
  { id: 'fresa', name: 'Fresa con crema', description: 'Rosa pastel, cálido y tierno' },
  { id: 'matcha', name: 'Matcha latte', description: 'Verde suave y fresco' },
  { id: 'lavanda', name: 'Lavanda', description: 'Lila tranquilo y dulce' },
  { id: 'cafe', name: 'Café con leche', description: 'Tonos crema y caramelo' },
  { id: 'noche', name: 'Noche', description: 'Oscuro, para poca luz' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'fresa';
export const DARK_THEMES: ReadonlySet<ThemeId> = new Set(['noche']);

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some(t => t.id === value);
}
