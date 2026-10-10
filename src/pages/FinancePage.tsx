import { useState } from 'react';
import { Calculator, History, Receipt, Wallet, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { ClosingTab } from '../components/finance/ClosingTab';
import { HistoryTab } from '../components/finance/HistoryTab';
import { ExpensesTab } from '../components/finance/ExpensesTab';
import { SalesTab } from '../components/finance/SalesTab';

type Tab = 'closing' | 'history' | 'sales' | 'expenses';

export function FinancePage() {
  const role = useAuthStore(state => state.user?.role);
  // Sales with their costs and fixed expenses are for admins and supervisors
  const canManageExpenses = role === 'ADMIN' || role === 'SUPERVISOR';
  const [activeTab, setActiveTab] = useState<Tab>('closing');
  // Bumped after closing a day so the history refetches
  const [historyKey, setHistoryKey] = useState(0);

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'closing', label: 'Corte del día', icon: Calculator },
    { key: 'history', label: 'Historial', icon: History },
    ...(canManageExpenses
      ? [
          { key: 'sales' as const, label: 'Ventas', icon: Receipt },
          { key: 'expenses' as const, label: 'Gastos fijos', icon: Wallet },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-5xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-ink tracking-tight">Finanzas</h1>
          <p className="text-ink/50 text-sm font-label uppercase tracking-wider mt-1">Corte de caja, ventas y gastos fijos</p>
        </div>

        <div className="flex w-full sm:w-auto bg-ink/5 rounded-xl p-1 border border-ink/10 overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-primary/20 text-primary' : 'text-ink/50 hover:text-ink'}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'closing' && <ClosingTab canManage={canManageExpenses} onClosed={() => setHistoryKey(k => k + 1)} />}
      {activeTab === 'history' && <HistoryTab isAdmin={role === 'ADMIN'} reloadKey={historyKey} />}
      {activeTab === 'sales' && canManageExpenses && <SalesTab />}
      {activeTab === 'expenses' && canManageExpenses && <ExpensesTab />}
    </div>
  );
}
