// Values for each theme live in src/index.css under [data-theme='<id>'],
// except "Mi fondo", computed from a seed color in src/lib/dynamicColor.ts
export const THEMES = [
  { id: 'fresa', name: 'Fresa con crema', description: 'Rosa pastel, cálido y tierno' },
  { id: 'matcha', name: 'Matcha latte', description: 'Verde suave y fresco' },
  { id: 'lavanda', name: 'Lavanda', description: 'Lila tranquilo y dulce' },
  { id: 'cafe', name: 'Café con leche', description: 'Tonos crema y caramelo' },
  { id: 'noche', name: 'Noche', description: 'Oscuro, para poca luz' },
  { id: 'mifondo', name: 'Mi fondo', description: 'Material You: el color de tu fondo de pantalla' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'fresa';
export const DYNAMIC_THEME: ThemeId = 'mifondo';
export const DARK_THEMES: ReadonlySet<ThemeId> = new Set(['noche']);

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some(t => t.id === value);
}
