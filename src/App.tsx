import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SideNavBar } from './components/layout/SideNavBar';
import { BottomNav, MobileTopBar } from './components/layout/MobileNav';
import { ThemePicker } from './components/ui/ThemePicker';
import { DialogHost } from './components/ui/DialogHost';
import { SeasonalBackdrop, SeasonalGarland } from './components/ui/SeasonalDecor';
import { ConnectionBanner } from './components/layout/ConnectionBanner';
import { startOfflineSync } from './lib/offline';
import { InventoryPage } from './pages/InventoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { FinancePage } from './pages/FinancePage';
import { OrdersPage } from './pages/OrdersPage';
import { ShoppingListPage } from './pages/ShoppingListPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { useAuthStore } from './store/auth';

function App() {
  const { accessToken, user } = useAuthStore();
  const [showThemes, setShowThemes] = useState(false);
  const openThemes = () => setShowThemes(true);

  // Sales made while the PC at home was off are sent once it answers again
  useEffect(() => (accessToken ? startOfflineSync() : undefined), [accessToken]);

  const themePicker = showThemes && <ThemePicker onClose={() => setShowThemes(false)} />;

  if (!accessToken) {
    return (
      <>
        <SeasonalBackdrop />
        <SeasonalGarland className="fixed inset-x-0 top-0 pt-safe z-10" />
        <LoginPage onOpenThemes={openThemes} />
        {themePicker}
        <DialogHost />
      </>
    );
  }

  return (
    <div className="h-[100dvh] flex text-ink overflow-hidden">
      <SeasonalBackdrop />
      <SideNavBar onOpenThemes={openThemes} />

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar onOpenThemes={openThemes} />
        <ConnectionBanner />
        <SeasonalGarland />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/shopping" element={<ShoppingListPage />} />
            <Route path="/finance" element={<FinancePage />} />
            {user?.role === 'ADMIN' && <Route path="/users" element={<UsersPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>

      {themePicker}
      <DialogHost />
    </div>
  )
}

export default App
