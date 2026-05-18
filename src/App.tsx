import { Routes, Route } from 'react-router-dom';
import { SideNavBar } from './components/layout/SideNavBar';
import { TopAppBar } from './components/layout/TopAppBar';
import { InventoryPage } from './pages/InventoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
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
        <TopAppBar />
        
        {/* Main Content Area */}
        <div className="pt-24 px-8 pb-8 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/pos" element={<PosPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
