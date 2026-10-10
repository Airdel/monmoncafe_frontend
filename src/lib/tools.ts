import { Coffee, GlassWater, Package, Sparkles, Wrench, type LucideIcon } from 'lucide-react';

export type ToolCategory = 'TABLEWARE' | 'UTENSIL' | 'EQUIPMENT' | 'CLEANING' | 'OTHER';
export type LossReason = 'BROKEN' | 'LOST' | 'WORN';
export type ToolMovementReason = LossReason | 'PURCHASE' | 'COUNT' | 'UNDO';

export interface Tool {
  id: number;
  name: string;
  category: ToolCategory;
  quantity: number;
  idealQuantity: number;
  unitCost: string;
  supplierId: number | null;
  supplier: { name: string } | null;
  notes: string | null;
  isActive: boolean;
  /** The latest breakage or loss, if any. */
  movements: { reason: LossReason; quantity: number; createdAt: string }[];
}

export const TOOL_CATEGORIES: { key: ToolCategory; label: string; icon: LucideIcon }[] = [
  { key: 'TABLEWARE', label: 'Vasos y tazas', icon: GlassWater },
  { key: 'UTENSIL', label: 'Utensilios', icon: Wrench },
  { key: 'EQUIPMENT', label: 'Equipo', icon: Coffee },
  { key: 'CLEANING', label: 'Limpieza', icon: Sparkles },
  { key: 'OTHER', label: 'Otros', icon: Package },
];

export const toolCategory = (key: ToolCategory) => TOOL_CATEGORIES.find(c => c.key === key) ?? TOOL_CATEGORIES[4];

export const LOSS_REASONS: { key: LossReason; label: string }[] = [
  { key: 'BROKEN', label: 'Se rompió' },
  { key: 'LOST', label: 'Se perdió' },
  { key: 'WORN', label: 'Ya no sirve' },
];

/** "Se rompieron 2", "Se perdió 1"… */
export function lossText(reason: ToolMovementReason, quantity: number): string {
  const plural = quantity !== 1;
  switch (reason) {
    case 'BROKEN': return `Se ${plural ? 'rompieron' : 'rompió'} ${quantity}`;
    case 'LOST': return `Se ${plural ? 'perdieron' : 'perdió'} ${quantity}`;
    case 'WORN': return `${quantity} ya no ${plural ? 'sirven' : 'sirve'}`;
    case 'PURCHASE': return `Compra de ${quantity}`;
    case 'COUNT': return `Conteo: ${quantity}`;
    case 'UNDO': return `Compra deshecha (−${quantity})`;
  }
}

export type ExpenseCategory = 'TOOL' | 'OPERATION' | 'CLEANING' | 'MAINTENANCE' | 'OTHER';

export const EXPENSE_CATEGORIES: { key: Exclude<ExpenseCategory, 'TOOL'>; label: string }[] = [
  { key: 'OPERATION', label: 'Operación' },
  { key: 'CLEANING', label: 'Limpieza' },
  { key: 'MAINTENANCE', label: 'Reparación' },
  { key: 'OTHER', label: 'Otro' },
];

export const expenseCategoryLabel = (key: string | null | undefined) =>
  key === 'TOOL' ? 'Herramienta' : EXPENSE_CATEGORIES.find(c => c.key === key)?.label ?? 'Otro';

/** "hoy", "ayer", "3 oct". */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
