/**
 * The same plan the server makes for a new shopping list (backend
 * src/shopping-lists/planner.ts), so a list can be made on the phone while
 * the PC is off. Keep both in step.
 */
export type Priority = 'ESSENTIAL' | 'IMPORTANT' | 'OPTIONAL';

export type PlannerIngredient = {
  id: number;
  unit: string;
  priority: Priority;
  currentStock: number;
  minStock: number;
  /** Restock target set by the user; without it, twice the minimum. */
  maxStock?: number | null;
  costPerUnit: number;
};

export type PlannedRow = {
  priority: Priority;
  stock: number;
  minStock: number;
  quantity: number;
  unitCost: number;
  inBudget: boolean;
  partial: boolean;
  sortOrder: number;
};

const PRIORITY_RANK: Record<Priority, number> = { ESSENTIAL: 0, IMPORTANT: 1, OPTIONAL: 2 };

const TARGET_FACTOR = 2;

const target = (i: PlannerIngredient) =>
  i.maxStock != null && i.maxStock > i.minStock ? i.maxStock : i.minStock * TARGET_FACTOR;

/** Whole grams, millilitres and pieces; kilograms and litres to two decimals. */
function roundUp(quantity: number, unit: string) {
  const step = unit === 'KILOGRAMS' || unit === 'LITERS' ? 100 : 1;
  return Math.ceil(quantity * step - 1e-9) / step;
}

const cents = (value: number) => Math.round(value * 100);

/** Insumos at or below their minimum, essentials and the emptiest first, within `budget`. */
export function planShoppingList(ingredients: PlannerIngredient[], budget: number): (PlannedRow & { ingredientId: number })[] {
  const fill = (i: PlannerIngredient) => i.currentStock / i.minStock;
  const candidates = ingredients
    .filter(i => i.minStock > 0 && i.currentStock <= i.minStock)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || fill(a) - fill(b));

  let remaining = cents(budget);
  return candidates.map((i, sortOrder) => {
    const full = roundUp(target(i) - i.currentStock, i.unit);
    const minimum = roundUp(i.minStock - i.currentStock, i.unit);
    const base = { ingredientId: i.id, priority: i.priority, stock: i.currentStock, minStock: i.minStock, unitCost: i.costPerUnit, sortOrder };

    const fullCost = cents(full * i.costPerUnit);
    if (fullCost <= remaining) {
      remaining -= fullCost;
      return { ...base, quantity: full, inBudget: true, partial: false };
    }
    const minimumCost = cents(minimum * i.costPerUnit);
    if (minimum > 0 && minimumCost <= remaining) {
      remaining -= minimumCost;
      return { ...base, quantity: minimum, inBudget: true, partial: true };
    }
    return { ...base, quantity: full, inBudget: false, partial: false };
  });
}

export type PlannerTool = { id: number; quantity: number; idealQuantity: number; unitCost: number };

/** Tools with missing pieces, after the insumos, with what is left: most incomplete first, in full or left out. */
export function planToolItems(tools: PlannerTool[], remainingBudget: number, firstSortOrder: number): (PlannedRow & { toolId: number })[] {
  let remaining = cents(remainingBudget);
  return tools
    .filter(t => t.quantity < t.idealQuantity)
    .sort((a, b) => a.quantity / a.idealQuantity - b.quantity / b.idealQuantity)
    .map((t, i) => {
      const quantity = t.idealQuantity - t.quantity;
      const cost = cents(quantity * t.unitCost);
      const inBudget = cost <= remaining;
      if (inBudget) remaining -= cost;
      return {
        toolId: t.id,
        priority: 'IMPORTANT' as const,
        stock: t.quantity,
        minStock: t.idealQuantity,
        quantity,
        unitCost: t.unitCost,
        inBudget,
        partial: false,
        sortOrder: firstSortOrder + i,
      };
    });
}

/** What the planned items cost, in pesos. */
export const plannedCost = (items: { quantity: number; unitCost: number; inBudget: boolean }[]) =>
  items.filter(i => i.inBudget).reduce((sum, i) => sum + cents(i.quantity * i.unitCost), 0) / 100;
