export type ExpenseFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

/** Same proration the backend uses (BIWEEKLY = quincenal, 24/año). */
const OCCURRENCES_PER_YEAR: Record<ExpenseFrequency, number> = {
  DAILY: 365,
  WEEKLY: 52,
  BIWEEKLY: 24,
  MONTHLY: 12,
};

export function toDailyAmount(amount: number, frequency: ExpenseFrequency): number {
  return (amount * OCCURRENCES_PER_YEAR[frequency]) / 365;
}

export interface FixedExpense {
  id: number;
  name: string;
  amount: string;
  frequency: ExpenseFrequency;
  isActive: boolean;
  notes: string | null;
}

export interface ExpenseSummary {
  dailyTotal: number;
  monthlyTotal: number;
}

export interface ClosingDetail {
  ingredientId: number;
  ingredientName: string;
  quantityConsumed: number | string;
  costConsumed: number | string;
}

/** Totals shared by the preview and the stored closing (Decimals arrive as strings). */
export interface ClosingTotals {
  totalSales: number | string;
  totalCost: number | string;
  totalDiscount: number | string;
  grossProfit: number | string;
  fixedExpenses: number | string;
  netProfit: number | string;
  marginPct: number | string;
  reinvestmentTotal: number | string;
  cashSales: number | string;
  transferSales: number | string;
  totalTransactions: number;
}

export interface ClosingPreview extends ClosingTotals {
  date: string;
  alreadyClosed: boolean;
  details: ClosingDetail[];
}

export interface DailyClosing extends ClosingTotals {
  id: number;
  date: string;
  notes: string | null;
  createdAt: string;
  user?: { name: string };
  details?: ClosingDetail[];
}
