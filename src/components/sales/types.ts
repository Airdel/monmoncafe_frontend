export type Consumption = { ingredientId: number; name: string; unit: string; quantity: number; cost: number };

export interface SaleRowItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  /** unitPrice × quantity, before its discount. */
  subtotal: number;
  discount: number;
  cost: number;
  modifiers: string[];
  modifierOptionIds: number[];
}

/** One sale as GET /sales/history returns it. */
export interface SaleRow {
  id: number;
  createdAt: string;
  status: 'COMPLETED' | 'CANCELLED' | string;
  isPaid: boolean;
  paymentMethod: 'CASH' | 'TRANSFER';
  customerName: string | null;
  notes: string | null;
  cashier: string;
  totalAmount: number;
  cashReceived: number | null;
  /** All discounts: per item plus the whole ticket. */
  discount: number;
  discountReason: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  editedAt: string | null;
  /** Part of a saved corte de caja; it has to be reopened to correct the sale. */
  inClosing: boolean;
  cost: number;
  items: SaleRowItem[];
  consumption: Consumption[];
}
