import { formatMoney } from './format';

export interface ModifierOptionIngredient {
  id: number;
  ingredientId: number;
  quantity: string;
  ingredient: { id: number; name: string; unit: string; currentCostPerUnit: string };
}

export interface ModifierOption {
  id: number;
  groupId: number;
  name: string;
  priceDelta: string;
  isActive: boolean;
  ingredients: ModifierOptionIngredient[];
}

export interface ModifierGroup {
  id: number;
  name: string;
  isRequired: boolean;
  allowMultiple: boolean;
  isActive: boolean;
  options: ModifierOption[];
  products: { productId: number }[];
}

/** "+$10.00", "-$5.00" or "" when the option doesn't change the price. */
export function formatDelta(value: number | string): string {
  const n = Number(value);
  if (!n) return '';
  return `${n > 0 ? '+' : '-'}${formatMoney(Math.abs(n))}`;
}

const UNIT_LABELS: Record<string, string> = { GRAMS: 'g', MILLILITERS: 'ml', PIECES: 'pz', KILOGRAMS: 'kg', LITERS: 'l' };

export const unitLabel = (unit: string) => UNIT_LABELS[unit] ?? unit.toLowerCase();
