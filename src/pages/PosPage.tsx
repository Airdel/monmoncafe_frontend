import { useState, useEffect } from 'react';
import { Minus, Plus, Banknote, ArrowLeftRight, Zap, Loader2, ShoppingBag, ChevronDown, Clock } from 'lucide-react';
import { cn } from '../lib/cn';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { unwrap } from '../lib/unwrap';
import { formatDelta, type ModifierGroup, type ModifierOption } from '../lib/modifiers';
import { Modal } from '../components/ui/Modal';
import { productImageSrc } from '../lib/images';
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
  isActive: boolean;
  imageUrl?: string | null;
  modifierGroups?: { groupId: number }[];
}

interface CartLine {
  /** Product id plus chosen options, so a latte with oat milk is its own line. */
  key: string;
  product: Product;
  options: ModifierOption[];
  quantity: number;
}

const lineKey = (productId: number, options: ModifierOption[]) =>
  [productId, ...options.map(o => o.id).sort((a, b) => a - b)].join('-');

const unitPrice = (line: Pick<CartLine, 'product' | 'options'>) =>
  Number(line.product.sellingPrice) + line.options.reduce((sum, o) => sum + Number(o.priceDelta), 0);

export function PosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);
  // Product waiting for the cashier to choose its options
  const [picking, setPicking] = useState<{ product: Product; groups: ModifierGroup[]; selected: number[] } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  // Shown on the comanda so the bar can call the order without asking again
  const [customerName, setCustomerName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // Phones show the order as a bottom sheet
  const [orderOpen, setOrderOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/products/categories'),
      api.get('/products'),
      api.get('/modifiers'),
    ]).then(([catRes, prodRes, modRes]) => {
      setModifierGroups(unwrap<ModifierGroup[]>(modRes));
      const catList: Category[] = catRes.data.data || catRes.data;
      // Deduplicate categories in case seed was run multiple times
      const uniqueCats = Array.from(new Map(catList.map(item => [item.name, item])).values());
      setCategories(uniqueCats);
      // Products switched off in Recetas are no longer sold
      setProducts(unwrap<Product[]>(prodRes).filter(p => p.isActive));
    }).catch(err => {
      console.error(err);
    }).finally(() => setLoading(false));
  }, []);

  const addToCart = (product: Product, options: ModifierOption[] = []) => {
    const key = lineKey(product.id, options);
    setCart(prev => {
      const existing = prev.find(item => item.key === key);
      if (existing) {
        return prev.map(item => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { key, product, options, quantity: 1 }];
    });
  };

  const removeFromCart = (key: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.key === key);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.key === key ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.key !== key);
    });
  };

  // Products with options open the picker; the rest go straight to the order
  const selectProduct = (product: Product) => {
    const linked = new Set(product.modifierGroups?.map(g => g.groupId));
    const groups = modifierGroups.filter(g => linked.has(g.id) && g.options.length > 0);
    if (groups.length === 0) return addToCart(product);
    // Required single-choice groups start on their first option
    const selected = groups.filter(g => g.isRequired && !g.allowMultiple).map(g => g.options[0].id);
    setPicking({ product, groups, selected });
  };

  const toggleOption = (group: ModifierGroup, optionId: number) => {
    setPicking(prev => {
      if (!prev) return prev;
      const isOn = prev.selected.includes(optionId);
      const groupIds = new Set(group.options.map(o => o.id));
      let selected: number[];
      if (group.allowMultiple) {
        selected = isOn ? prev.selected.filter(id => id !== optionId) : [...prev.selected, optionId];
      } else if (isOn) {
        // Required groups keep their choice; optional ones can be cleared
        selected = group.isRequired ? prev.selected : prev.selected.filter(id => id !== optionId);
      } else {
        selected = [...prev.selected.filter(id => !groupIds.has(id)), optionId];
      }
      return { ...prev, selected };
    });
  };

  const pickedOptions = picking
    ? picking.groups.flatMap(g => g.options.filter(o => picking.selected.includes(o.id)))
    : [];
  const missingGroup = picking?.groups.find(g => g.isRequired && !g.options.some(o => picking.selected.includes(o.id)));

  /** payLater sends the order to Comandas now and it is charged there later. */
  const handleCheckout = async (payLater = false) => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      const sale = unwrap<{ id: number }>(await api.post('/sales', {
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          ...(item.options.length > 0 && { modifierOptionIds: item.options.map(o => o.id) }),
        })),
        paymentMethod,
        customerName: customerName.trim() || undefined,
        notes: orderNote.trim() || undefined,
        ...(payLater && { payLater: true }),
      }));
      alert(payLater
        ? `Pedido enviado a comandas sin cobrar. Comanda #${sale.id}`
        : `¡Venta registrada! Comanda #${sale.id}`);
      setCart([]);
      setCustomerName('');
      setOrderNote('');
      setOrderOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error al registrar la venta: ' + getErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Matches what the backend charges: price plus options, no tax or tip
  const total = cart.reduce((acc, item) => acc + unitPrice(item) * item.quantity, 0);
  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Filter products
  const filteredProducts = activeCategory === 'all' 
    ? products 
    : products.filter(p => p.categoryId === activeCategory);

  const chipClass = (active: boolean) => cn(
    'px-5 py-2.5 sm:px-6 sm:py-3 rounded-full sm:rounded-xl font-label text-sm uppercase tracking-widest whitespace-nowrap transition-all duration-300 shrink-0',
    active
      ? 'bg-primary text-on-primary font-bold glow-primary'
      : 'bg-ink/5 border border-ink/10 text-ink/60 hover:text-ink hover:bg-ink/10'
  );

  return (
    <div className="h-full w-full flex flex-col md:flex-row gap-4 lg:gap-6">

      {/* Left Column - Product Grid */}
      <div className="flex-1 flex flex-col gap-4 lg:gap-6 h-full overflow-hidden min-w-0">

        {/* Categories Bar */}
        <div className="flex gap-2 sm:gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 shrink-0 scrollbar-none">
          <button onClick={() => setActiveCategory('all')} className={chipClass(activeCategory === 'all')}>
            Todo
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={chipClass(activeCategory === cat.id)}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 auto-rows-max content-start overflow-y-auto min-h-0 pb-24 md:pb-8 md:pr-2 scrollbar-thin">
          {loading ? (
             <div className="col-span-full flex justify-center py-20">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
             </div>
          ) : filteredProducts.map((product, idx) => (
            <motion.button
              key={product.id}
              type="button"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(idx, 12) * 0.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => selectProduct(product)}
              className="glass-panel group text-left border-ink/5 hover:border-primary/50 transition-colors flex flex-col overflow-hidden relative"
            >
              <div className="h-24 sm:h-32 lg:h-36 w-full shrink-0 overflow-hidden bg-primary/5">
                {product.imageUrl ? (
                  <img
                    src={productImageSrc(product.imageUrl) ?? undefined}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary/30 group-hover:scale-110 transition-all duration-500">
                    <span className="font-headline font-bold text-3xl sm:text-4xl tracking-tighter">{product.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-1">
                <h3 className="font-headline font-bold text-ink text-sm leading-tight line-clamp-2">{product.name}</h3>
                <p className="font-mono text-secondary font-semibold text-base sm:text-lg">{formatMoney(Number(product.sellingPrice))}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Phone: summary bar that opens the order sheet */}
      {!orderOpen && (
        <button
          onClick={() => setOrderOpen(true)}
          className="md:hidden fixed inset-x-4 bottom-[calc(5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] z-30 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-cta text-on-primary font-bold glow-primary"
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="flex-1 text-left">{itemCount === 0 ? 'Orden vacía' : `Ver orden · ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}</span>
          <span className="font-mono text-lg">{formatMoney(total)}</span>
        </button>
      )}
      {orderOpen && <div className="md:hidden fixed inset-0 z-40 bg-shade/50 backdrop-blur-sm" onClick={() => setOrderOpen(false)} />}

      {/* Right Column - Order Panel (bottom sheet on phones) */}
      <div className={cn(
        'flex-col bg-raised md:bg-raised/70 backdrop-blur-md border border-ink/10 p-5 lg:p-6',
        'md:static md:flex md:w-72 lg:w-[320px] xl:w-[380px] md:shrink-0 md:h-full md:rounded-2xl md:z-auto',
        orderOpen ? 'flex fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] rounded-t-3xl pb-[calc(1.25rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]' : 'hidden'
      )}>

        {/* Order Header */}
        <div className="mb-4 lg:mb-6 flex items-center justify-between">
          <h2 className="font-headline text-2xl font-bold text-ink">Orden actual</h2>
          <button onClick={() => setOrderOpen(false)} className="md:hidden -m-2 p-2 text-ink/50" aria-label="Cerrar orden">
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* Order Items */}
        <div className="flex-1 min-h-[6rem] overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {cart.length > 0 ? (
            cart.map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.product.imageUrl
                    ? <img src={productImageSrc(item.product.imageUrl) ?? undefined} alt="" className="w-full h-full object-cover" />
                    : <span className="font-headline font-bold text-primary/60">{item.product.name.substring(0, 2).toUpperCase()}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-ink text-sm line-clamp-1">{item.product.name}</h4>
                    <span className="font-mono text-ink/80 shrink-0">{formatMoney(unitPrice(item) * item.quantity)}</span>
                  </div>
                  {item.options.length > 0 && (
                    <p className="text-ink/50 text-xs line-clamp-2">{item.options.map(o => o.name).join(' · ')}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => removeFromCart(item.key)}
                      className="w-9 h-9 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-ink/60 hover:bg-ink/10 hover:text-ink active:scale-90 transition"
                      aria-label={`Quitar un ${item.product.name}`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-base w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => addToCart(item.product, item.options)}
                      className="w-9 h-9 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-ink/60 hover:bg-ink/10 hover:text-ink active:scale-90 transition"
                      aria-label={`Agregar un ${item.product.name}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-ink/30 font-label text-sm uppercase tracking-widest">Sin productos</p>
            </div>
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="pt-5 border-t border-ink/10 mt-4 shrink-0">
          <div className="flex justify-between items-end mb-4 gap-2">
            <div>
              <span className="font-headline text-2xl font-bold text-ink">Total</span>
              <p className="text-ink/40 text-xs font-label">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</p>
            </div>
            <span className="font-headline text-3xl xl:text-4xl font-bold text-secondary">{formatMoney(total)}</span>
          </div>

          {/* Who it's for and special requests, shown on the comanda */}
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 mb-3">
            <input
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              maxLength={60}
              placeholder="Nombre"
              aria-label="Nombre del cliente"
              className="min-w-0 px-3 py-2.5 bg-ink/5 border border-ink/10 rounded-xl text-ink text-sm focus:border-primary/50 focus:outline-none placeholder:text-ink/30"
            />
            <input
              value={orderNote}
              onChange={e => setOrderNote(e.target.value)}
              maxLength={500}
              placeholder="Nota (sin hielo, para llevar...)"
              aria-label="Nota del pedido"
              className="min-w-0 px-3 py-2.5 bg-ink/5 border border-ink/10 rounded-xl text-ink text-sm focus:border-primary/50 focus:outline-none placeholder:text-ink/30"
            />
          </div>

          {/* Payment Methods */}
          <div className="flex gap-3 mb-4">
            {([['CASH', 'Efectivo', Banknote], ['TRANSFER', 'Transferencia', ArrowLeftRight]] as const).map(([method, label, Icon]) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                aria-pressed={paymentMethod === method}
                className={`flex-1 py-3 border rounded-xl flex flex-col items-center gap-1 transition-colors ${paymentMethod === method ? 'bg-primary/15 border-primary text-primary' : 'bg-ink/5 border-ink/10 text-ink/60 hover:bg-ink/10 hover:text-ink'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-label text-[11px] uppercase tracking-widest font-semibold">{label}</span>
              </button>
            ))}
          </div>

          {/* Pay now, or send to Comandas and charge on pickup/delivery */}
          <div className="flex gap-2">
            <button
              onClick={() => handleCheckout(true)}
              disabled={cart.length === 0 || isProcessing}
              className="px-3 py-4 rounded-xl bg-ink/5 border border-ink/15 text-ink/80 font-bold text-sm leading-tight hover:bg-ink/10 hover:text-ink active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Clock className="w-4 h-4 shrink-0" /> Cobrar después
            </button>
            <button
              onClick={() => handleCheckout()}
              disabled={cart.length === 0 || isProcessing}
              className="flex-1 py-4 rounded-xl bg-cta text-on-primary font-bold text-lg glow-secondary hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
               {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-5 h-5 fill-current" /> Cobrar</>}
            </button>
          </div>
        </div>
      </div>

      {/* Options picker */}
      {picking && (
        <Modal title={picking.product.name} onClose={() => setPicking(null)}>
          <div className="space-y-5">
            {picking.groups.map(group => (
              <div key={group.id}>
                <p className="text-ink/50 text-xs font-label uppercase tracking-widest mb-2">
                  {group.name}
                  <span className="ml-2 normal-case tracking-normal text-ink/30">
                    {group.isRequired ? 'elige una' : group.allowMultiple ? 'opcional, varias' : 'opcional'}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {group.options.map(option => {
                    const on = picking.selected.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleOption(group, option.id)}
                        aria-pressed={on}
                        className={cn(
                          'px-3 py-3 rounded-xl border text-left transition-colors',
                          on ? 'bg-primary/15 border-primary text-primary' : 'bg-ink/5 border-ink/10 text-ink/70 hover:bg-ink/10 hover:text-ink'
                        )}
                      >
                        <span className="block font-medium text-sm">{option.name}</span>
                        {formatDelta(option.priceDelta) && <span className="block font-mono text-xs opacity-70">{formatDelta(option.priceDelta)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              onClick={() => { addToCart(picking.product, pickedOptions); setPicking(null); }}
              disabled={!!missingGroup}
              className="w-full py-4 rounded-xl bg-cta text-on-primary font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {missingGroup ? `Elige ${missingGroup.name.toLowerCase()}` : <>Agregar · {formatMoney(unitPrice({ product: picking.product, options: pickedOptions }))}</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
