import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** What POST /sales takes, without the fields the queue adds when sending it. */
export interface SalePayload {
  items: { productId: number; quantity: number; modifierOptionIds?: number[]; discount?: number; chargedUnitPrice?: number }[];
  paymentMethod: 'CASH' | 'TRANSFER';
  cashReceived?: number;
  discount?: number;
  discountReason?: string;
  customerName?: string;
  notes?: string;
  payLater?: boolean;
  orderStatus?: 'PENDING' | 'READY' | 'DELIVERED';
}

/** A sale made while the server was unreachable, kept on the device until it is sent. */
export interface QueuedSale {
  /** Sent with the sale so the server records it once even if it arrives twice. */
  clientId: string;
  soldAt: string;
  payload: SalePayload;
  /** For showing it in Comandas before it reaches the server. */
  total: number;
  lines: { quantity: number; name: string; options: string[] }[];
  cashier: string;
  /** The server refused it (e.g. a product deleted meanwhile); it waits for someone to decide. */
  error?: string;
}

interface OfflineSalesState {
  sales: QueuedSale[];
  add: (sale: QueuedSale) => void;
  update: (clientId: string, change: (sale: QueuedSale) => QueuedSale) => void;
  remove: (clientId: string) => void;
}

export const useOfflineSales = create<OfflineSalesState>()(
  persist(
    set => ({
      sales: [],
      add: sale => set(s => ({ sales: [...s.sales, sale] })),
      update: (clientId, change) => set(s => ({ sales: s.sales.map(q => (q.clientId === clientId ? change(q) : q)) })),
      remove: clientId => set(s => ({ sales: s.sales.filter(q => q.clientId !== clientId) })),
    }),
    { name: 'offline-sales' }
  )
);

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
