import { useState } from 'react';
import { Calculator, History, Wallet, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { ClosingTab } from '../components/finance/ClosingTab';
import { HistoryTab } from '../components/finance/HistoryTab';
import { ExpensesTab } from '../components/finance/ExpensesTab';

type Tab = 'closing' | 'history' | 'expenses';

export function FinancePage() {
  const role = useAuthStore(state => state.user?.role);
  const canManageExpenses = role === 'ADMIN' || role === 'SUPERVISOR';
  const [activeTab, setActiveTab] = useState<Tab>('closing');
  // Bumped after closing a day so the history refetches
  const [historyKey, setHistoryKey] = useState(0);

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'closing', label: 'Corte del día', icon: Calculator },
    { key: 'history', label: 'Historial', icon: History },
    ...(canManageExpenses ? [{ key: 'expenses' as const, label: 'Gastos fijos', icon: Wallet }] : []),
  ];

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold text-white tracking-tight">Finanzas</h1>
          <p className="text-white/50 text-sm font-label uppercase tracking-wider mt-1">Corte de caja y gastos fijos</p>
        </div>

        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-primary/20 text-primary' : 'text-white/50 hover:text-white'}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'closing' && <ClosingTab onClosed={() => setHistoryKey(k => k + 1)} />}
      {activeTab === 'history' && <HistoryTab isAdmin={role === 'ADMIN'} reloadKey={historyKey} />}
      {activeTab === 'expenses' && canManageExpenses && <ExpensesTab />}
    </div>
  );
}
