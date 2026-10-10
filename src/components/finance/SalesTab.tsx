import { useEffect, useState } from 'react';
import { Ban, ChevronDown, Loader2, Lock, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { getErrorMessage } from '../../lib/errors';
import { formatMoney, todayISO } from '../../lib/format';
import { unitLabel } from '../../lib/modifiers';
import { unwrap } from '../../lib/unwrap';
import { inputClass, labelClass } from './styles';
import { StatCard } from './ui';
import { CancelSaleDialog } from '../sales/CancelSaleDialog';
import { EditSaleDialog } from '../sales/EditSaleDialog';
import type { Consumption, SaleRow } from '../sales/types';

type SalesHistory = {
  summary: { salesCount: number; cancelledCount: number; totalSales: number; totalDiscount: number; totalCost: number; grossProfit: number };
  ingredients: Consumption[];
  sales: SaleRow[];
};

const formatQty = (c: Consumption) =>
  `${c.quantity.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${unitLabel(c.unit)}`;

function ConsumptionTable({ rows }: { rows: Consumption[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-ink/40 text-xs font-label uppercase tracking-widest">
          <th className="text-left font-normal pb-2">Insumo</th>
          <th className="text-right font-normal pb-2">Cantidad</th>
          <th className="text-right font-normal pb-2">Costo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/5">
        {rows.map(c => (
          <tr key={c.ingredientId}>
            <td className="py-2 pr-2 text-ink/80">{c.name}</td>
            <td className="py-2 text-right font-mono text-ink/70 whitespace-nowrap">{formatQty(c)}</td>
            <td className="py-2 pl-2 text-right text-ink/70 whitespace-nowrap">{formatMoney(c.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Sales of a date range and what each one took from the inventory. */
export function SalesTab() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<SalesHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [cancelling, setCancelling] = useState<SaleRow | null>(null);
  // Bumped after a correction so the list and totals reload
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/sales/history', { params: { from: from || undefined, to: to || undefined } })
      .then(res => { if (!cancelled) { setData(unwrap<SalesHistory>(res)); setError(''); } })
      .catch(err => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, version]);

  const changeRange = (setter: (v: string) => void, value: string) => {
    setLoading(true);
    setter(value);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="sales-from">Desde</label>
          <input id="sales-from" type="date" value={from} max={to || todayISO()} onChange={e => changeRange(setFrom, e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="sales-to">Hasta</label>
          <input id="sales-to" type="date" value={to} min={from || undefined} max={todayISO()} onChange={e => changeRange(setTo, e.target.value)} className={inputClass} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="glass-panel p-6 text-error">{error}</div>
      ) : !data || data.sales.length === 0 ? (
        <div className="glass-panel p-10 text-center text-ink/50">No hay ventas en este periodo.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Ventas"
              value={formatMoney(data.summary.totalSales)}
              tone="primary"
              hint={[
                data.summary.totalDiscount > 0 && `Descuentos −${formatMoney(data.summary.totalDiscount)}`,
                data.summary.cancelledCount > 0 && `${data.summary.cancelledCount} anulada${data.summary.cancelledCount === 1 ? '' : 's'}`,
              ].filter(Boolean).join(' · ') || undefined}
            />
            <StatCard label="Costo de insumos" value={formatMoney(data.summary.totalCost)} tone="error" />
            <StatCard label="Utilidad bruta" value={formatMoney(data.summary.grossProfit)} tone="secondary" />
            <StatCard label="Tickets" value={String(data.summary.salesCount)} />
          </div>

          <div className="glass-panel p-5">
            <h2 className="font-headline text-lg font-semibold text-ink mb-3">Consumo de inventario del periodo</h2>
            {data.ingredients.length === 0
              ? <p className="text-ink/50 text-sm">Estas ventas no descontaron insumos.</p>
              : <ConsumptionTable rows={data.ingredients} />}
          </div>

          <div className="glass-panel divide-y divide-ink/5">
            {data.sales.map(sale => {
              const open = openId === sale.id;
              const cancelled = sale.status !== 'COMPLETED';
              return (
                <div key={sale.id}>
                  <button
                    onClick={() => setOpenId(open ? null : sale.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 sm:gap-4 p-4 text-left hover:bg-ink/5 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-ink font-medium truncate', cancelled && 'line-through text-ink/40')}>
                        #{sale.id} · {sale.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
                      </p>
                      <p className="text-ink/40 text-xs font-label mt-0.5">
                        {new Date(sale.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        {' · '}{sale.cashier}
                        {sale.customerName && ` · ${sale.customerName}`}
                        {' · '}{sale.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia'}
                        {!sale.isPaid && ' · Por cobrar'}
                        {cancelled && ' · Anulada'}
                        {!cancelled && sale.editedAt && ' · Corregida'}
                        {!cancelled && sale.discount > 0 && ` · Desc. −${formatMoney(sale.discount)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-primary font-semibold">{formatMoney(sale.totalAmount)}</p>
                      <p className="text-xs font-label text-ink/40">Costo {formatMoney(sale.cost)}</p>
                    </div>
                    <ChevronDown className={cn('w-4 h-4 text-ink/30 transition-transform', open && 'rotate-180')} />
                  </button>

                  {open && (
                    <div className="px-4 pb-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <p className={labelClass}>Productos</p>
                        <ul className="space-y-2 text-sm">
                          {sale.items.map((item, idx) => (
                            <li key={idx} className="flex justify-between gap-3">
                              <span className="text-ink/80 min-w-0">
                                {item.quantity}× {item.name}
                                {item.modifiers.length > 0 && <span className="block text-ink/40 text-xs">{item.modifiers.join(', ')}</span>}
                                {item.discount > 0 && <span className="block text-secondary text-xs">Descuento −{formatMoney(item.discount)}</span>}
                              </span>
                              <span className="text-right whitespace-nowrap">
                                <span className="text-ink/80">{formatMoney(item.subtotal)}</span>
                                <span className="block text-ink/40 text-xs">costo {formatMoney(item.cost)}</span>
                              </span>
                            </li>
                          ))}
                          {sale.discount > 0 && (
                            <li className="flex justify-between gap-3 text-ink/50">
                              <span className="min-w-0">
                                Descuento total
                                {sale.discountReason && <span className="block text-xs">{sale.discountReason}</span>}
                              </span>
                              <span className="whitespace-nowrap">−{formatMoney(sale.discount)}</span>
                            </li>
                          )}
                        </ul>
                        {cancelled && (
                          <p className="mt-4 p-3 rounded-xl bg-error/10 border border-error/25 text-sm text-ink/80">
                            <b className="text-error">Anulada</b>
                            {sale.cancelledAt && ` el ${new Date(sale.cancelledAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}`}
                            {sale.cancelReason && `: ${sale.cancelReason}`}
                          </p>
                        )}
                        {!cancelled && (sale.inClosing ? (
                          <p className="mt-4 text-ink/50 text-xs flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 shrink-0" /> Ya está en un corte de caja. Para corregirla, reabre ese corte en Historial.
                          </p>
                        ) : (
                          <div className="mt-4 flex gap-2">
                            <button onClick={() => setEditing(sale)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25">
                              <Pencil className="w-4 h-4" /> Corregir
                            </button>
                            <button onClick={() => setCancelling(sale)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-error/10 border border-error/25 text-error text-sm font-semibold hover:bg-error/20">
                              <Ban className="w-4 h-4" /> Anular
                            </button>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className={labelClass}>Insumos descontados</p>
                        {sale.consumption.length === 0
                          ? <p className="text-ink/50 text-sm">Esta venta no descontó insumos.</p>
                          : <ConsumptionTable rows={sale.consumption} />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {data.sales.length >= 500 && <p className="text-ink/40 text-xs font-label -mt-3">Se muestran las 500 ventas más recientes del periodo.</p>}
        </>
      )}

      {editing && <EditSaleDialog sale={editing} onDone={() => setVersion(v => v + 1)} onClose={() => setEditing(null)} />}
      {cancelling && (
        <CancelSaleDialog
          sale={{ id: cancelling.id, totalAmount: cancelling.totalAmount, summary: cancelling.items.map(i => `${i.quantity}× ${i.name}`).join(', ') }}
          onDone={() => setVersion(v => v + 1)}
          onClose={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
