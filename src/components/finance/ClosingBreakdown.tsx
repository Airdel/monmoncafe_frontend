import { Banknote, ArrowLeftRight, Receipt, Tag } from 'lucide-react';
import { formatMoney } from '../../lib/format';
import type { ClosingDetail, ClosingTotals } from './types';
import { StatCard } from './ui';

/** KPI grid + ingredient replenishment table, shared by the live preview and stored closings. */
export function ClosingBreakdown({ totals, details }: { totals: ClosingTotals; details: ClosingDetail[] }) {
  const netProfit = Number(totals.netProfit);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Ventas" value={formatMoney(totals.totalSales)} hint={`${totals.totalTransactions} transacciones`} tone="primary" />
        <StatCard label="Costo de lo vendido" value={formatMoney(totals.totalCost)} />
        <StatCard label="Utilidad bruta" value={formatMoney(totals.grossProfit)} hint={`Margen ${Number(totals.marginPct).toFixed(1)}%`} tone="secondary" />
        <StatCard label="Gastos fijos del día" value={formatMoney(totals.fixedExpenses)} hint="Prorrateo diario" />
        <StatCard label="Utilidad neta" value={formatMoney(netProfit)} tone={netProfit >= 0 ? 'secondary' : 'error'} />
        <StatCard label="Para reinvertir" value={formatMoney(totals.reinvestmentTotal)} hint="Reponer insumos" tone="primary" />
      </div>

      <div className="glass-panel p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat icon={Banknote} label="Efectivo" value={formatMoney(totals.cashSales)} />
        <MiniStat icon={ArrowLeftRight} label="Transferencia" value={formatMoney(totals.transferSales)} />
        <MiniStat icon={Tag} label="Descuentos" value={formatMoney(totals.totalDiscount)} />
        <MiniStat icon={Receipt} label="Tickets" value={String(totals.totalTransactions)} />
      </div>

      <div className="glass-panel p-5">
        <h3 className="font-headline text-lg font-bold text-ink mb-4">Insumos consumidos</h3>
        {details.length === 0 ? (
          <p className="text-ink/40 text-sm">No hubo consumo de insumos registrado este día.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink/40 text-xs font-label uppercase tracking-widest text-left">
                  <th className="pb-3 font-medium">Insumo</th>
                  <th className="pb-3 font-medium text-right">Cantidad</th>
                  <th className="pb-3 font-medium text-right">Costo de reposición</th>
                </tr>
              </thead>
              <tbody>
                {details.map(d => (
                  <tr key={d.ingredientId} className="border-t border-ink/5">
                    <td className="py-3 text-ink">{d.ingredientName}</td>
                    <td className="py-3 text-right text-ink/70">{Number(d.quantityConsumed).toLocaleString('es-MX', { maximumFractionDigits: 4 })}</td>
                    <td className="py-3 text-right text-primary">{formatMoney(d.costConsumed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-ink/5"><Icon className="w-4 h-4 text-ink/60" /></div>
      <div>
        <p className="text-ink/40 text-xs font-label uppercase tracking-wider">{label}</p>
        <p className="text-ink font-semibold">{value}</p>
      </div>
    </div>
  );
}
