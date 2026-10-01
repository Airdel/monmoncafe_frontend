import { Routes, Route, Navigate } from 'react-router-dom';
import { SideNavBar } from './components/layout/SideNavBar';
import { InventoryPage } from './pages/InventoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { FinancePage } from './pages/FinancePage';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './store/auth';

function App() {
  const { accessToken } = useAuthStore();

  if (!accessToken) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-background text-white pl-64 overflow-hidden">
      <SideNavBar />
      
      <main className="w-full h-screen relative flex flex-col">
        <div className="pt-8 px-8 pb-8 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
