import { Banknote, ArrowLeftRight, Receipt, Tag, Trash2 } from 'lucide-react';
import { formatMoney } from '../../lib/format';
import { expenseCategoryLabel } from '../../lib/tools';
import type { ClosingDetail, ClosingTotals, DayExpense } from './types';
import { StatCard } from './ui';

/** KPI grid + the day's other expenses + ingredient replenishment table, shared by the live preview and stored closings. */
export function ClosingBreakdown({ totals, details, expenses = [], onDeleteExpense }: {
  totals: ClosingTotals;
  details: ClosingDetail[];
  expenses?: DayExpense[];
  /** Only while the day is open. */
  onDeleteExpense?: (expense: DayExpense) => void;
}) {
  const netProfit = Number(totals.netProfit);
  const otherExpenses = Number(totals.otherExpenses ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ventas" value={formatMoney(totals.totalSales)} hint={`${totals.totalTransactions} transacciones`} tone="primary" />
        <StatCard label="Costo de lo vendido" value={formatMoney(totals.totalCost)} />
        <StatCard label="Utilidad bruta" value={formatMoney(totals.grossProfit)} hint={`Margen ${Number(totals.marginPct).toFixed(1)}%`} tone="secondary" />
        <StatCard label="Gastos fijos del día" value={formatMoney(totals.fixedExpenses)} hint="Prorrateo diario" />
        <StatCard label="Otros gastos del día" value={formatMoney(otherExpenses)} hint="Herramientas y extras" tone={otherExpenses > 0 ? 'error' : 'neutral'} />
        <StatCard label="Utilidad neta" value={formatMoney(netProfit)} tone={netProfit >= 0 ? 'secondary' : 'error'} />
        <StatCard label="Para reinvertir" value={formatMoney(totals.reinvestmentTotal)} hint="Reponer insumos" tone="primary" />
      </div>

      <div className="glass-panel p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat icon={Banknote} label="Efectivo" value={formatMoney(totals.cashSales)} />
        <MiniStat icon={ArrowLeftRight} label="Transferencia" value={formatMoney(totals.transferSales)} />
        <MiniStat icon={Tag} label="Descuentos" value={formatMoney(totals.totalDiscount)} />
        <MiniStat icon={Receipt} label="Tickets" value={String(totals.totalTransactions)} />
      </div>

      {expenses.length > 0 && (
        <div className="glass-panel p-5">
          <h3 className="font-headline text-lg font-bold text-ink mb-1">Otros gastos del día</h3>
          <p className="text-ink/40 text-xs mb-3">Herramientas repuestas y artículos extra. No están en ninguna receta, por eso se restan aparte.</p>
          <div className="divide-y divide-ink/5">
            {expenses.map(e => (
              <div key={e.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-ink truncate">{e.description}{e.quantity !== null && e.quantity !== 1 && <span className="text-ink/50"> ×{Number(e.quantity).toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>}</p>
                  <p className="text-ink/40 text-xs truncate">
                    {e.category === 'TOOL' ? 'Herramienta' : `Extra · ${expenseCategoryLabel(e.category)}`}
                    {e.supplierName && ` · ${e.supplierName}`}
                    {e.fromShoppingList && ' · lista de compras'}
                  </p>
                </div>
                <p className="text-error shrink-0">{formatMoney(e.amount)}</p>
                {onDeleteExpense && !e.fromShoppingList && (
                  <button onClick={() => onDeleteExpense(e)} className="p-2 -mr-2 text-ink/40 hover:text-error shrink-0" aria-label={`Quitar ${e.description}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
