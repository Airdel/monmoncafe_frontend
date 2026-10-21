import { cachedGet } from './offline';
import { useOfflineOps } from '../store/offlineOps';

export const BARCODES_URL = '/inventory/barcodes';

export interface BarcodePrice {
  supplierId: number | null;
  /** What one package cost the last time it was bought at that store. */
  packagePrice: number;
  purchasedAt: string;
}

/** A product's code as the shop knows it: which insumo it is and how much one package holds. */
export interface Barcode {
  id: number;
  code: string;
  ingredientId: number;
  /** In the insumo's unit (1000 for a 1 L milk when milk is counted in ml). */
  packageQuantity: string;
  label: string | null;
  brand: string | null;
  ingredient: { id: number; name: string; unit: string };
  /** Newest first, one per store. */
  prices: BarcodePrice[];
  /** Registered on this device with the server off; not sent yet. */
  queued?: boolean;
}

export type NewBarcode = { code: string; ingredientId: number; packageQuantity: number; label?: string; brand?: string };

/** A temporary negative id for something kept on the device until the server gives it one. */
export const localId = () => -Date.now();

/** What is accepted as a code, as the server checks it. */
export const BARCODE_PATTERN = /^[0-9A-Za-z._-]{4,64}$/;

/**
 * Some phones read a product as UPC-A (12 digits) and others as EAN-13 (the
 * same with a leading 0); the shop keeps EAN-13, like the server.
 */
export function normalizeBarcode(code: string): string {
  const trimmed = code.trim();
  return /^\d{12}$/.test(trimmed) ? `0${trimmed}` : trimmed;
}

/**
 * The codes the shop knows, from the server or this device's copy, plus the
 * ones registered here that are still waiting to be sent.
 */
export async function loadBarcodes(ingredients: { id: number; name: string; unit: string }[]): Promise<Barcode[]> {
  let known: Barcode[] = [];
  try {
    known = await cachedGet<Barcode[]>(BARCODES_URL);
  } catch {
    // Older server or nothing saved yet: only what this device has waiting
  }
  const queued = useOfflineOps.getState().ops
    .filter(o => o.url === BARCODES_URL && (o.method ?? 'POST') === 'POST' && !o.error)
    .map((o, i): Barcode | null => {
      const body = o.body as NewBarcode;
      const ingredient = ingredients.find(x => x.id === body.ingredientId);
      if (!ingredient || known.some(b => b.code === body.code)) return null;
      return {
        id: -1 - i,
        code: body.code,
        ingredientId: body.ingredientId,
        packageQuantity: String(body.packageQuantity),
        label: body.label ?? null,
        brand: body.brand ?? null,
        ingredient: { id: ingredient.id, name: ingredient.name, unit: ingredient.unit },
        prices: [],
        queued: true,
      };
    })
    .filter((b): b is Barcode => b !== null);
  return [...known, ...queued];
}

/** The price to suggest for one package: what it cost at that store, or anywhere lately. */
export function packagePriceAt(barcode: Barcode, supplierId: number | null): number | null {
  const atStore = supplierId !== null ? barcode.prices.find(p => p.supplierId === supplierId) : undefined;
  return (atStore ?? barcode.prices[0])?.packagePrice ?? null;
}

// --- Units ---------------------------------------------------------------

/** Units a label can be written in, and the insumo unit each one belongs to. */
export const LABEL_UNITS = [
  { key: 'kg', unit: 'KILOGRAMS' },
  { key: 'g', unit: 'GRAMS' },
  { key: 'l', unit: 'LITERS' },
  { key: 'ml', unit: 'MILLILITERS' },
  { key: 'pz', unit: 'PIECES' },
] as const;
export type LabelUnit = (typeof LABEL_UNITS)[number]['key'];

const UNITS: Record<string, { kind: string; base: number }> = {
  GRAMS: { kind: 'mass', base: 1 },
  KILOGRAMS: { kind: 'mass', base: 1000 },
  MILLILITERS: { kind: 'volume', base: 1 },
  LITERS: { kind: 'volume', base: 1000 },
  PIECES: { kind: 'count', base: 1 },
};

/**
 * `amount` of a label unit in the insumo's unit (1 l → 1000 ml), or null
 * when they measure different things (grams of a thing counted in pieces).
 */
export function toIngredientUnit(amount: number, from: LabelUnit, ingredientUnit: string): number | null {
  const source = UNITS[LABEL_UNITS.find(u => u.key === from)!.unit];
  const target = UNITS[ingredientUnit];
  if (!target || source.kind !== target.kind) return null;
  return Math.round((amount * source.base / target.base) * 10000) / 10000;
}

/** The label unit that reads best for an insumo (its own one). */
export function labelUnitFor(ingredientUnit: string): LabelUnit {
  return LABEL_UNITS.find(u => u.unit === ingredientUnit)?.key ?? 'pz';
}

// --- Open Food Facts -----------------------------------------------------

export interface ProductHint {
  name: string | null;
  brand: string | null;
  amount: number | null;
  unit: LabelUnit | null;
}

const UNIT_ALIASES: Record<string, LabelUnit> = {
  kg: 'kg', g: 'g', gr: 'g', grs: 'g', gramos: 'g',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  ml: 'ml', cl: 'ml', pz: 'pz', pza: 'pz', pzas: 'pz', piezas: 'pz',
};

/** "1 L", "500g", "750 ml", "12 x 355 ml" → the amount of one package. */
export function parseQuantity(text: string | null | undefined): { amount: number; unit: LabelUnit } | null {
  if (!text) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*(kg|grs?|gramos|g|lts?|litros?|l|ml|cl|pzas?|pz|piezas)\b/i.exec(text);
  if (!match) return null;
  const raw = match[2].toLowerCase();
  const unit = UNIT_ALIASES[raw];
  let amount = Number(match[1].replace(',', '.'));
  if (raw === 'cl') amount *= 10;
  return unit && amount > 0 ? { amount, unit } : null;
}

/**
 * Asks Open Food Facts (free, public) what a code is, to fill in a new one.
 * Goes straight from the phone, so it works with the PC off as long as there
 * is internet; null when it isn't known or can't be reached.
 */
export async function lookupProduct(code: string): Promise<ProductHint | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_es,brands,quantity,product_quantity,product_quantity_unit`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      status?: number;
      product?: { product_name?: string; product_name_es?: string; brands?: string; quantity?: string; product_quantity?: number | string; product_quantity_unit?: string };
    };
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const fromLabel = parseQuantity(p.quantity);
    const fromNumber = p.product_quantity && p.product_quantity_unit
      ? parseQuantity(`${p.product_quantity} ${p.product_quantity_unit}`)
      : null;
    const quantity = fromLabel ?? fromNumber;
    return {
      name: (p.product_name_es || p.product_name || '').trim() || null,
      brand: p.brands?.split(',')[0]?.trim() || null,
      amount: quantity?.amount ?? null,
      unit: quantity?.unit ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
