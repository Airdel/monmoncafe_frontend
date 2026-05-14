import { useState, useEffect } from 'react';
import { Minus, Plus, Banknote, CreditCard, Zap, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import * as motion from 'motion/react-client';

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
}

interface Product {
  id: number;
  name: string;
  sellingPrice: string;
  categoryId: number;
}

export function PosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // Cart state
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/products/categories'),
      api.get('/products')
    ]).then(([catRes, prodRes]) => {
      const catList: Category[] = catRes.data.data || catRes.data;
      // Deduplicate categories in case seed was run multiple times
      const uniqueCats = Array.from(new Map(catList.map(item => [item.name, item])).values());
      setCategories(uniqueCats);
      setProducts(prodRes.data.data || prodRes.data);
    }).catch(err => {
      console.error(err);
    }).finally(() => setLoading(false));
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      await api.post('/sales', {
        items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
        paymentMethod
      });
      alert('Sale completed successfully!');
      setCart([]);
    } catch (err: any) {
      console.error(err);
      alert('Error processing sale: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (Number(item.product.sellingPrice) * item.quantity), 0);
  const tax = subtotal * 0.08; // 8% tax
  const tip = subtotal * 0.15; // 15% tip
  const total = subtotal + tax + tip;

  // Filter products
  const filteredProducts = activeCategory === 'all' 
    ? products 
    : products.filter(p => p.categoryId === activeCategory);

  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      
      {/* Left Column - Product Grid */}
      <div className="flex-1 flex flex-col gap-6 h-full overflow-hidden min-w-0">
        
        {/* Categories Bar */}
        <div className="flex gap-4 overflow-x-auto pb-2 shrink-0 [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-6 py-3 rounded-xl font-label text-sm uppercase tracking-widest whitespace-nowrap transition-all duration-300 shrink-0 ${
              activeCategory === 'all' 
                ? 'bg-primary text-[#0a0b0e] font-bold shadow-[0_0_20px_rgba(0,219,233,0.4)]'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-6 py-3 rounded-xl font-label text-sm uppercase tracking-widest whitespace-nowrap transition-all duration-300 shrink-0 ${
                activeCategory === cat.id 
                  ? 'bg-primary text-[#0a0b0e] font-bold shadow-[0_0_20px_rgba(0,219,233,0.4)]'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto min-h-0 pb-8 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          {loading ? (
             <div className="col-span-full flex justify-center py-20">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
             </div>
          ) : filteredProducts.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => addToCart(product)}
              className="glass-panel group cursor-pointer border-white/5 hover:border-primary/50 transition-colors flex flex-col h-64 overflow-hidden relative"
            >
              {product.name.includes('Caliente') && (
                <div className="absolute top-2 right-2 z-10 bg-error/90 text-background text-[10px] font-label font-bold uppercase px-2 py-0.5 rounded shadow-[0_0_10px_rgba(255,180,171,0.5)]">
                  HOT
                </div>
              )}
              
              <div className="h-40 w-full overflow-hidden bg-black/40">
                <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 group-hover:scale-110 transition-all duration-500">
                  <span className="font-headline font-bold text-4xl tracking-tighter">{product.name.substring(0, 2).toUpperCase()}</span>
                </div>
              </div>
              
              <div className="p-4 flex-1 flex flex-col justify-between">
                <h3 className="font-headline font-bold text-white text-sm leading-tight line-clamp-2">{product.name}</h3>
                <p className="font-mono text-secondary font-medium text-lg">${Number(product.sellingPrice).toFixed(2)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Column - Order Panel */}
      <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col h-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative z-20">
        
        {/* Order Header */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="font-headline text-2xl font-bold text-white">Current Order</h2>
            <p className="text-white/40 text-xs font-label uppercase tracking-widest mt-1">Walk-in</p>
          </div>
          <span className="font-mono text-white/50 text-sm">#8829</span>
        </div>

        {/* Order Items */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          {cart.length > 0 ? (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-start gap-4 animate-in fade-in slide-in-from-right-4">
                <div className="w-12 h-12 rounded-lg bg-black/40 overflow-hidden border border-white/5 shrink-0 flex items-center justify-center">
                   <span className="font-headline font-bold text-white/50">{item.product.name.substring(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-white text-sm line-clamp-1">{item.product.name}</h4>
                    <span className="font-mono text-white/80">${(Number(item.product.sellingPrice) * item.quantity).toFixed(2)}</span>
                  </div>
                  <p className="text-white/40 text-[10px] mb-2 italic">Standard Prep</p>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-sm w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => addToCart(item.product)}
                      className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-white/30 font-label text-sm uppercase tracking-widest">Cart is empty</p>
            </div>
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="pt-6 border-t border-white/10 mt-4 shrink-0">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Subtotal</span>
              <span className="font-mono text-white/80">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Tax (8%)</span>
              <span className="font-mono text-white/80">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Service Tip (15%)</span>
              <span className="font-mono text-secondary">${tip.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-between items-end mb-4">
            <span className="font-headline text-2xl font-bold text-white">Total</span>
            <span className="font-headline text-4xl font-bold text-secondary glow-mint">${total.toFixed(2)}</span>
          </div>

          {/* Payment Methods */}
          <div className="flex gap-4 mb-4">
            <button 
              onClick={() => setPaymentMethod('CASH')}
              className={`flex-1 py-2 border rounded-xl flex flex-col items-center gap-1 transition-colors ${paymentMethod === 'CASH' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              <Banknote className="w-4 h-4" />
              <span className="font-label text-[10px] uppercase tracking-widest font-semibold">Cash</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('TRANSFER')}
              className={`flex-1 py-2 border rounded-xl flex flex-col items-center gap-1 transition-colors ${paymentMethod === 'TRANSFER' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="font-label text-[10px] uppercase tracking-widest font-semibold">Card</span>
            </button>
          </div>

          {/* Pay Button */}
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0 || isProcessing}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-[#0a0b0e] font-bold text-lg shadow-[0_0_20px_rgba(54,255,196,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
             {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-5 h-5 fill-current" /> PAY NOW</>}
          </button>
        </div>
      </div>
    </div>
  );
}
