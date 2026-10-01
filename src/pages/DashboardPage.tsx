import { useState, useEffect } from 'react';
import { TrendingUp, Wallet, PieChart, Briefcase, AlertTriangle, Sparkles, Coffee, Package, Loader2 } from 'lucide-react';
import * as motion from 'motion/react-client';
import { api } from '../lib/api';

interface DashboardData {
  today: {
    revenue: number;
    grossProfit: number;
    marginPct: number;
    totalTransactions: number;
    reinvestment: number;
  };
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStock: { id: number; name: string; currentStock: string; minStock: string; unit: string }[];
  recentActivity: {
    id: number;
    total: number;
    itemCount: number;
    productNames: string;
    cashier: string;
    createdAt: string;
    paymentMethod: string;
  }[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Justo ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `Hace ${hours}h`;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data.data || res.data))
      .catch(err => console.error('Dashboard fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const metrics = data?.today || { revenue: 0, grossProfit: 0, marginPct: 0, totalTransactions: 0, reinvestment: 0 };
  const topProducts = data?.topProducts || [];
  const lowStock = data?.lowStock || [];
  const recentActivity = data?.recentActivity || [];

  // Calculate reinvestment progress bar (% of revenue)
  const reinvestPct = metrics.revenue > 0 ? Math.min((metrics.reinvestment / metrics.revenue) * 100, 100) : 0;


  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-8">
      
      {/* Header */}
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary tracking-tight">Dashboard</h1>
        <p className="text-white/50 text-sm font-label uppercase tracking-wider mt-1">Estado operativo en tiempo real</p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Ventas del Día (Large widget) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 col-span-12 md:col-span-8 flex flex-col justify-between relative overflow-hidden group"
        >
          <div className="flex justify-between items-start z-10 relative">
            <div>
              <p className="text-white/50 text-sm font-label uppercase tracking-widest mb-2">Ventas del día</p>
              <h2 className="font-headline text-6xl font-bold text-primary glow-cyan drop-shadow-md">${metrics.revenue.toFixed(2)}</h2>
              <p className="text-white/40 text-xs font-label mt-2">{metrics.totalTransactions} transacciones</p>
            </div>
            <TrendingUp className="w-6 h-6 text-secondary" />
          </div>
          
          {/* Sparkline SVG */}
          <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="glowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00Dbe9" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#00Dbe9" stopOpacity="0" />
                </linearGradient>
                <filter id="neonGlow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path d="M0 80 Q 40 80, 80 60 T 160 70 T 240 20 T 320 80 L 400 30" fill="none" stroke="#00Dbe9" strokeWidth="4" filter="url(#neonGlow)" />
              <path d="M0 80 Q 40 80, 80 60 T 160 70 T 240 20 T 320 80 L 400 30 L 400 100 L 0 100 Z" fill="url(#glowGradient)" />
            </svg>
          </div>
        </motion.div>

        {/* Column for Utilidad and Margen */}
        <div className="col-span-12 md:col-span-4 flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-panel p-6 flex-1 flex flex-col justify-center"
          >
             <div className="flex items-center gap-3 mb-2">
               <Wallet className="w-5 h-5 text-secondary" />
               <p className="text-white/50 text-sm font-label uppercase tracking-widest">Utilidad real</p>
             </div>
             <h3 className="font-headline text-4xl font-bold text-secondary glow-mint">${metrics.grossProfit.toFixed(2)}</h3>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="glass-panel p-6 flex-1 flex flex-col justify-center"
          >
             <div className="flex items-center gap-3 mb-2">
               <PieChart className="w-5 h-5 text-[#C9A0DC]" />
               <p className="text-white/50 text-sm font-label uppercase tracking-widest">Margen neto</p>
             </div>
             <h3 className="font-headline text-4xl font-bold text-[#C9A0DC] drop-shadow-[0_0_15px_rgba(201,160,220,0.3)]">{metrics.marginPct}%</h3>
          </motion.div>
        </div>

        {/* Dinero Reposición */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-panel p-6 col-span-12"
        >
          <div className="flex justify-between items-center mb-4">
            <p className="text-white/50 text-sm font-label uppercase tracking-widest">Dinero para reposición de materia prima</p>
            <Briefcase className="w-5 h-5 text-white/40" />
          </div>
          <h3 className="font-headline text-3xl font-bold text-white mb-4">${metrics.reinvestment.toFixed(2)}</h3>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary glow-cyan rounded-full transition-all duration-1000" style={{ width: `${reinvestPct}%` }}></div>
          </div>
          <p className="text-white/30 text-xs mt-2">{reinvestPct.toFixed(0)}% de tus ventas se destina a materia prima</p>
        </motion.div>

        {/* Top Products */}
        {topProducts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="glass-panel p-6 col-span-12 md:col-span-6"
          >
            <p className="text-white/50 text-sm font-label uppercase tracking-widest mb-4">Top productos del día</p>
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-mono text-xs font-bold">{idx + 1}</span>
                    <span className="text-white text-sm font-medium">{product.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white/40 text-xs font-mono">{product.qty}x</span>
                    <span className="font-mono text-secondary font-medium">${product.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Alerts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className={`col-span-12 ${topProducts.length > 0 ? 'md:col-span-6' : ''}`}
        >
          {lowStock.length > 0 ? (
            <div className="space-y-3">
              <p className="text-white/50 text-sm font-label uppercase tracking-widest mb-2">
                <AlertTriangle className="w-4 h-4 text-error inline mr-2" />
                Alertas de inventario ({lowStock.length})
              </p>
              {lowStock.slice(0, 5).map((item) => (
                <div key={item.id} className="glass-panel p-4 border-l-4 border-l-error bg-error/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-error/80" />
                    <div>
                      <h4 className="font-medium text-white text-sm">{item.name}</h4>
                      <p className="text-white/40 text-xs">{Number(item.currentStock).toFixed(0)} / {Number(item.minStock).toFixed(0)} {item.unit.toLowerCase()}</p>
                    </div>
                  </div>
                  <span className="text-error text-xs font-label font-bold uppercase tracking-wider">Bajo</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel p-6 border-l-4 border-l-primary flex items-center gap-4">
              <Sparkles className="w-6 h-6 text-primary glow-cyan" />
              <div>
                <h4 className="font-headline font-bold text-primary">Todo en orden</h4>
                <p className="text-white/60 text-sm italic">No hay alertas de inventario</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Actividad Reciente */}
        <div className="col-span-12">
          <h3 className="text-white/50 text-xs font-label uppercase tracking-widest mb-4 mt-2">Actividad Reciente</h3>
          
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((sale, idx) => (
                <motion.div 
                  key={sale.id} 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: 0.05 * idx }}
                  className="glass-panel p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <Coffee className="w-4 h-4 text-white/80" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm line-clamp-1">{sale.productNames}</h4>
                      <p className="text-white/40 text-xs">{timeAgo(sale.createdAt)} · {sale.cashier} · {sale.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia'}</p>
                    </div>
                  </div>
                  <span className="font-mono text-secondary font-medium shrink-0">+${sale.total.toFixed(2)}</span>
                </motion.div>
              ))
            ) : (
              <div className="glass-panel p-6 flex items-center justify-center">
                <p className="text-white/30 font-label text-sm uppercase tracking-widest">Sin ventas registradas hoy</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
