/** A discount as the cashier typed it: pesos off, or a percentage of what it applies to. */
export interface Discount {
  mode: 'amount' | 'percent';
  value: number;
}

/** Discounts on an order: per line (by line key) and on the whole ticket, with one reason. */
export interface OrderDiscounts {
  lines: Record<string, Discount>;
  ticket: Discount | null;
  reason: string;
}

export const NO_DISCOUNTS: OrderDiscounts = { lines: {}, ticket: null, reason: '' };

/** Quick reasons so the cashier rarely has to type. */
export const DISCOUNT_REASONS = ['Se derramó en el traslado', 'Error en la preparación', 'Cortesía', 'Cliente frecuente'];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pesos a discount takes off a base amount, never more than the base. */
export function discountAmount(base: number, discount: Discount | null | undefined): number {
  if (!discount || !(discount.value > 0)) return 0;
  const off = discount.mode === 'percent' ? (base * Math.min(discount.value, 100)) / 100 : discount.value;
  return round2(Math.min(base, off));
}

/**
 * Totals of an order with its discounts, in the same order the backend applies
 * them: each line first, then the whole ticket on what is left.
 */
export function orderTotals(lines: { key: string; subtotal: number }[], discounts: OrderDiscounts) {
  const lineDiscounts: Record<string, number> = {};
  let afterLines = 0;
  let subtotal = 0;
  for (const line of lines) {
    const off = discountAmount(line.subtotal, discounts.lines[line.key]);
    lineDiscounts[line.key] = off;
    subtotal += line.subtotal;
    afterLines += line.subtotal - off;
  }
  afterLines = round2(afterLines);
  const ticketDiscount = discountAmount(afterLines, discounts.ticket);
  const totalDiscount = round2(round2(subtotal) - afterLines + ticketDiscount);
  return {
    subtotal: round2(subtotal),
    lineDiscounts,
    ticketDiscount,
    totalDiscount,
    total: round2(afterLines - ticketDiscount),
  };
}

/** "10%" or "$15.00" for chips and summaries. */
export function describeDiscount(d: Discount, format: (n: number) => string): string {
  return d.mode === 'percent' ? `${d.value}%` : format(d.value);
}
