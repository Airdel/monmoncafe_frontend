import { LayoutDashboard, Coffee, Package, LineChart } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Inicio', icon: LayoutDashboard, path: '/' },
  { id: 'pos', label: 'Punto de venta', shortLabel: 'Vender', icon: Coffee, path: '/pos' },
  { id: 'inventory', label: 'Inventario', shortLabel: 'Inventario', icon: Package, path: '/inventory' },
  { id: 'finance', label: 'Finanzas', shortLabel: 'Finanzas', icon: LineChart, path: '/finance' },
];

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  CASHIER: 'Cajero',
};

export function logout() {
  // Invalidate the refresh token server-side; log out locally regardless
  api.post('/auth/logout').catch(() => {}).finally(useAuthStore.getState().logout);
}
