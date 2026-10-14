import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Something other than a sale (a purchase, an expense, a broken glass, a
 * count…) registered while the server was unreachable, kept on the device
 * until it is sent.
 */
export interface QueuedOp {
  /** Sent as Idempotency-Key, so the server records it once even if it arrives twice. */
  key: string;
  url: string;
  body: unknown;
  /** When it was really done; the server dates it with this. */
  occurredAt: string;
  /** What it was, for people ("Compra: Leche 2 L"). */
  label: string;
  user: string;
  /** The server refused it; it waits for someone to decide. */
  error?: string;
}

interface OfflineOpsState {
  ops: QueuedOp[];
  add: (op: QueuedOp) => void;
  update: (key: string, change: (op: QueuedOp) => QueuedOp) => void;
  remove: (key: string) => void;
}

export const useOfflineOps = create<OfflineOpsState>()(
  persist(
    set => ({
      ops: [],
      add: op => set(s => ({ ops: [...s.ops, op] })),
      update: (key, change) => set(s => ({ ops: s.ops.map(o => (o.key === key ? change(o) : o)) })),
      remove: key => set(s => ({ ops: s.ops.filter(o => o.key !== key) })),
    }),
    { name: 'offline-ops' }
  )
);
