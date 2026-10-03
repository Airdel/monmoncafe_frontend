import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { getErrorMessage } from '../../lib/errors';
import { formatMoney, todayISO } from '../../lib/format';
import { unitLabel } from '../../lib/modifiers';
import { unwrap } from '../../lib/unwrap';
import { inputClass, labelClass } from './styles';
import { StatCard } from './ui';

type Consumption = { ingredientId: number; name: string; unit: string; quantity: number; cost: number };

type SaleRow = {
  id: number;
  createdAt: string;
  status: 'COMPLETED' | 'CANCELLED' | string;
  isPaid: boolean;
  paymentMethod: 'CASH' | 'TRANSFER';
  customerName: string | null;
  cashier: string;
  totalAmount: number;
  discount: number;
  cost: number;
  items: { name: string; quantity: number; subtotal: number; cost: number; modifiers: string[] }[];
  consumption: Consumption[];
};

type SalesHistory = {
  summary: { salesCount: number; totalSales: number; totalCost: number; grossProfit: number };
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

  useEffect(() => {
    let cancelled = false;
    api.get('/sales/history', { params: { from: from || undefined, to: to || undefined } })
      .then(res => { if (!cancelled) { setData(unwrap<SalesHistory>(res)); setError(''); } })
      .catch(err => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

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
            <StatCard label="Ventas" value={formatMoney(data.summary.totalSales)} tone="primary" />
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
                        {cancelled && ' · Cancelada'}
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
                              </span>
                              <span className="text-right whitespace-nowrap">
                                <span className="text-ink/80">{formatMoney(item.subtotal)}</span>
                                <span className="block text-ink/40 text-xs">costo {formatMoney(item.cost)}</span>
                              </span>
                            </li>
                          ))}
                          {sale.discount > 0 && (
                            <li className="flex justify-between text-ink/50">
                              <span>Descuento</span><span>−{formatMoney(sale.discount)}</span>
                            </li>
                          )}
                        </ul>
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
    </div>
  );
}
