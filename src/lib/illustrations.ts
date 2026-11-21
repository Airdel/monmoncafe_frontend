// Animated drawings for the POS tiles. The SVGs are generated in the backend
// repo (scripts/imagenes-recetas/generador/exportar-svg.js) and ship inside
// the app, so they work offline and weigh ~5 KB each. Each product says which
// one it uses in `illustration`; older servers leave it out and the photo shows.

export type DrinkKind = 'hot' | 'tea' | 'cold' | 'soda' | 'frappe' | 'extra';

const files = import.meta.glob<string>('../assets/ilustraciones/*.svg', { query: '?raw', import: 'default', eager: true });
const svgs: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.replace(/^.*\/(.+)\.svg$/, '$1'), svg]),
);

const ALL: { key: string; name: string; kind: DrinkKind }[] = [
  { key: 'espresso', name: 'Espresso', kind: 'hot' },
  { key: 'americano-caliente', name: 'Americano caliente', kind: 'hot' },
  { key: 'latte-caliente', name: 'Latte caliente', kind: 'hot' },
  { key: 'cappuccino', name: 'Cappuccino', kind: 'hot' },
  { key: 'moka-caliente', name: 'Moka caliente', kind: 'hot' },
  { key: 'honey-black', name: 'Honey black', kind: 'hot' },
  { key: 'chai-guayaba', name: 'Chai de guayaba', kind: 'hot' },
  { key: 'te-negro', name: 'Té negro', kind: 'tea' },
  { key: 'te-verde', name: 'Té verde', kind: 'tea' },
  { key: 'te-jazmin', name: 'Té jazmín', kind: 'tea' },
  { key: 'americano-frio', name: 'Americano frío', kind: 'cold' },
  { key: 'latte-frio', name: 'Latte frío', kind: 'cold' },
  { key: 'caramel-latte', name: 'Caramel latte', kind: 'cold' },
  { key: 'moka-cold-foam', name: 'Moka cold foam', kind: 'cold' },
  { key: 'cold-brew', name: 'Cold brew', kind: 'cold' },
  { key: 'latte-cold-brew', name: 'Latte cold brew', kind: 'cold' },
  { key: 'soda-italiana', name: 'Soda italiana', kind: 'soda' },
  { key: 'frappe-clasico', name: 'Frappé clásico', kind: 'frappe' },
  { key: 'frappe-mazapan', name: 'Frappé mazapán', kind: 'frappe' },
  { key: 'frappe-moka', name: 'Frappé moka', kind: 'frappe' },
  { key: 'frappe-oreo', name: 'Frappé Oreo', kind: 'frappe' },
  { key: 'frappe-caramelo', name: 'Frappé caramelo', kind: 'frappe' },
  { key: 'frappe-chocolate', name: 'Frappé chocolate', kind: 'frappe' },
  { key: 'cold-foam-chocolate', name: 'Cold foam chocolate', kind: 'extra' },
  { key: 'cold-foam-vainilla', name: 'Cold foam vainilla', kind: 'extra' },
  { key: 'generico', name: 'Taza Mon Mon (genérica)', kind: 'hot' },
];

/** Drawings offered in Recetas › Editar producto, in menu order. */
export const ILLUSTRATIONS = ALL.filter(i => i.key in svgs);

const kinds = new Map(ILLUSTRATIONS.map(i => [i.key, i.kind]));

/** SVG markup of a drawing this app knows; unknown keys (from a newer app) fall back to the photo. */
export function illustrationSvg(key?: string | null): string | null {
  return key ? svgs[key] ?? null : null;
}

export function drinkKind(key?: string | null): DrinkKind | null {
  return key ? kinds.get(key) ?? null : null;
}

/** Bounce on tap; in "Solo al tocar" it also plays the drink's animation for a moment. */
export function bounceDrink(container: Element) {
  const art = container.querySelector<HTMLElement>('.drink-art');
  if (!art) return;
  art.classList.remove('is-bounce');
  void art.offsetWidth; // restart the CSS animation
  art.classList.add('is-bounce', 'is-playing');
  const timer = Number(art.dataset.playTimer);
  if (timer) window.clearTimeout(timer);
  art.dataset.playTimer = String(window.setTimeout(() => art.classList.remove('is-playing'), 3200));
}
