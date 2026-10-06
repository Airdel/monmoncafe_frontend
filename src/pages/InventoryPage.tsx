import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, SlidersHorizontal, Coffee, Loader2, ShoppingCart, Package, ChevronDown, ChevronLeft, ChevronRight, Plus, Send, X, Save, Trash2, ArrowUpDown, Layers, Store, Pencil, EyeOff, Power, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { unwrap } from '../lib/unwrap';
import { useAuthStore } from '../store/auth';
import { Modal } from '../components/ui/Modal';
import { ModifiersTab } from '../components/inventory/ModifiersTab';
import { SuppliersTab } from '../components/inventory/SuppliersTab';
import { ProductEditModal, type EditableProduct } from '../components/inventory/ProductEditModal';
import { productImageSrc } from '../lib/images';
import { ChangeUnitModal, DeleteIngredientModal, IngredientFormModal, type ManagedIngredient } from '../components/inventory/IngredientDialogs';
import { SearchInput } from '../components/ui/SearchInput';
import { cn } from '../lib/cn';
import { matchesSearch } from '../lib/search';
import { unitLabel } from '../lib/modifiers';
import * as motion from 'motion/react-client';

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  currentStock: string;
  minStock: string;
  maxStock?: string | null;
  currentCostPerUnit: string;
  avgCostPerUnit: string;
  priority?: ManagedIngredient['priority'];
  isActive?: boolean;
  supplierId?: number | null;
  supplier?: { name: string } | null;
}

/** Fill of the stock bar: the maximum, or three times the minimum without one. */
const stockPercent = (i: Ingredient) => {
  const full = Number(i.maxStock) || Number(i.minStock) * 3;
  return full > 0 ? Math.min((Number(i.currentStock) / full) * 100, 100) : 100;
};
const isLowStock = (i: Ingredient) => i.isActive !== false && Number(i.currentStock) <= Number(i.minStock);

interface Product {
  id: number;
  name: string;
  sellingPrice: string;
  categoryId: number;
  isActive: boolean;
  imageUrl?: string | null;
  category?: { name: string };
}

interface ProductWithRecipe extends Product {
  size?: string | null;
  recipeIngredients?: RecipeIngredient[];
}

interface RecipeIngredient {
  id: number;
  quantityUsed: string;
  ingredient: Ingredient;
}

interface Supplier {
  id: number;
  name: string;
}

type Tab = 'stock' | 'recipes' | 'modifiers' | 'suppliers' | 'purchases';
type StockFilter = 'all' | 'low';

export function InventoryPage() {
  // Stock adjustments, recipe edits and purchases are SUPERVISOR/ADMIN only on the backend
  const role = useAuthStore(state => state.user?.role);
  const canManage = role === 'ADMIN' || role === 'SUPERVISOR';
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock filter and search
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [stockSearch, setStockSearch] = useState('');

  // Recipe composer
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<RecipeIngredient[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRecipe | null>(null);

  // Recipe editing
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [editRecipeRows, setEditRecipeRows] = useState<{ ingredientId: number; quantityUsed: string }[]>([]);
  const [recipeSaving, setRecipeSaving] = useState(false);

  // Name, POS category, visibility and photo
  const [editingProduct, setEditingProduct] = useState(false);

  // Adjustment modal
  const [adjustModal, setAdjustModal] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('ADJUSTMENT');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Insumo CRUD (create/edit, unit change, delete) and deactivated ones
  const [ingredientForm, setIngredientForm] = useState<Ingredient | 'new' | null>(null);
  const [unitModal, setUnitModal] = useState<Ingredient | null>(null);
  const [deleteModal, setDeleteModal] = useState<Ingredient | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [inactiveIngredients, setInactiveIngredients] = useState<Ingredient[]>([]);

  // Purchase form
  const [purchaseForm, setPurchaseForm] = useState({ ingredientId: 0, supplierId: 0, quantity: '', totalCost: '', notes: '' });
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState('');

  const loadAll = () =>
    Promise.all([
      api.get('/inventory/ingredients'),
      api.get('/products'),
      api.get('/suppliers'),
    ]).then(([ingRes, prodRes, supRes]) => {
      setIngredients(ingRes.data.data || ingRes.data);
      setProducts(prodRes.data.data || prodRes.data);
      setSuppliers(supRes.data.data || supRes.data);
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));

  useEffect(() => { loadAll(); }, []);

  const loadInactive = () =>
    api.get('/inventory/ingredients', { params: { includeInactive: true } })
      .then(res => setInactiveIngredients(unwrap<Ingredient[]>(res).filter(i => i.isActive === false)))
      .catch(err => console.error(err));

  const toggleInactive = (show: boolean) => {
    setShowInactive(show);
    if (show) loadInactive();
  };

  const afterIngredientChange = () => {
    setIngredientForm(null); setUnitModal(null); setDeleteModal(null);
    loadAll();
    if (showInactive) loadInactive();
  };

  const reactivate = async (item: Ingredient) => {
    try {
      await api.patch(`/inventory/ingredients/${item.id}`, { isActive: true });
      afterIngredientChange();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    }
  };

  // Load recipe when product selected
  useEffect(() => {
    if (!selectedProductId) return;
    api.get(`/products/${selectedProductId}/recipe`)
      .then(res => {
        const data = res.data.data || res.data;
        setSelectedProduct(data);
        setRecipe(data?.recipeIngredients || []);
      })
      .catch(err => console.error(err))
      .finally(() => setRecipeLoading(false));
  }, [selectedProductId]);

  const stockIngredients = showInactive && stockFilter === 'all' ? [...ingredients, ...inactiveIngredients] : ingredients;
  const filteredIngredients = stockIngredients.filter(i =>
    (stockFilter === 'all' || isLowStock(i)) &&
    matchesSearch(stockSearch, i.name, i.supplier?.name)
  );
  const emptyStockMessage = stockSearch
    ? `Ningún insumo coincide con "${stockSearch}"`
    : stockFilter === 'low' ? 'No hay ingredientes con stock bajo ✅' : 'No hay ingredientes registrados';

  const filteredProducts = products.filter(p => matchesSearch(recipeSearch, p.name, p.category?.name));

  const selectProduct = (id: number | null) => {
    setSelectedProductId(id);
    setRecipeLoading(!!id);
    setEditingRecipe(false);
    setEditingProduct(false);
    if (!id) { setRecipe([]); setSelectedProduct(null); }
  };

  const lowStockCount = ingredients.filter(isLowStock).length;

  // Recipe cost calculation
  const recipeCost = recipe.reduce((sum, r) => sum + (Number(r.quantityUsed) * Number(r.ingredient.currentCostPerUnit)), 0);
  const sellingPrice = selectedProduct ? Number(selectedProduct.sellingPrice) : 0;
  const margin = sellingPrice > 0 ? ((sellingPrice - recipeCost) / sellingPrice * 100) : 0;

  // Purchase submit
  const handlePurchase = async () => {
    if (!purchaseForm.ingredientId || !purchaseForm.supplierId || !purchaseForm.quantity || !purchaseForm.totalCost) return;
    setPurchaseSubmitting(true);
    setPurchaseSuccess('');
    try {
      await api.post('/purchases', {
        ingredientId: purchaseForm.ingredientId,
        supplierId: purchaseForm.supplierId,
        quantity: Number(purchaseForm.quantity),
        totalCost: Number(purchaseForm.totalCost),
        notes: purchaseForm.notes || undefined,
      });
      setPurchaseSuccess('¡Compra registrada! Stock actualizado.');
      setPurchaseForm({ ingredientId: 0, supplierId: 0, quantity: '', totalCost: '', notes: '' });
      // Refresh ingredients
      const res = await api.get('/inventory/ingredients');
      setIngredients(res.data.data || res.data);
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setPurchaseSubmitting(false);
    }
  };

  // Adjustment submit
  const handleAdjustment = async () => {
    if (!adjustModal || !adjustQty) return;
    setAdjustSubmitting(true);
    try {
      await api.post('/inventory/movements', {
        ingredientId: adjustModal.id,
        type: adjustType,
        quantity: Number(adjustQty),
        reason: adjustReason || `${adjustType === 'IN' ? 'Entrada' : adjustType === 'OUT' ? 'Salida' : 'Ajuste'} manual`,
      });
      setAdjustModal(null); setAdjustQty(''); setAdjustReason('');
      const res = await api.get('/inventory/ingredients');
      setIngredients(res.data.data || res.data);
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const productSaved = (saved: EditableProduct) => {
    setProducts(prev => prev.map(p => p.id === saved.id ? { ...p, ...saved } : p));
    setSelectedProduct(prev => prev && prev.id === saved.id ? { ...prev, ...saved } : prev);
    setEditingProduct(false);
  };

  // Recipe editing helpers
  const startEditRecipe = () => {
    setEditRecipeRows(recipe.map(r => ({ ingredientId: r.ingredient.id, quantityUsed: String(Number(r.quantityUsed)) })));
    setEditingRecipe(true);
  };

  const saveRecipe = async () => {
    if (!selectedProductId) return;
    setRecipeSaving(true);
    try {
      const validRows = editRecipeRows.filter(r => r.ingredientId && Number(r.quantityUsed) > 0);
      const res = await api.put(`/products/${selectedProductId}/recipe`, {
        ingredients: validRows.map(r => ({ ingredientId: r.ingredientId, quantityUsed: Number(r.quantityUsed) }))
      });
      const data = res.data.data || res.data;
      setSelectedProduct(data);
      setRecipe(data?.recipeIngredients || []);
      setEditingRecipe(false);
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setRecipeSaving(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'stock', label: 'Stock', icon: Package },
    { key: 'recipes', label: 'Recetas', icon: SlidersHorizontal },
    { key: 'modifiers', label: 'Opciones', icon: Layers },
    { key: 'suppliers', label: 'Tiendas', icon: Store },
    ...(canManage ? [{ key: 'purchases' as const, label: 'Compras', icon: ShoppingCart }] : []),
  ];

  return (
    <div className="lg:h-full flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-ink tracking-tight">Inventario</h1>
          <p className="text-ink/50 text-sm font-label uppercase tracking-wider mt-1">Gestión de stock, recetas y compras</p>
        </div>
        
        {/* Tabs */}
        <div className="flex w-full sm:w-auto bg-ink/5 rounded-xl p-1 border border-ink/10">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 sm:flex-none justify-center px-1.5 sm:px-5 py-2.5 sm:py-2 rounded-lg font-label text-xs sm:text-sm uppercase sm:tracking-widest flex items-center gap-2 transition-all duration-300 ${
                  activeTab === tab.key
                    ? 'bg-primary/20 text-primary font-bold glow-primary-soft'
                    : 'text-ink/50 hover:text-ink'
                }`}
              >
                <Icon className="hidden sm:block w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ TAB: STOCK ═══ */}
      {activeTab === 'stock' && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Stock filter and search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex bg-ink/5 rounded-full p-1 border border-ink/10 w-fit">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                stockFilter === 'all' ? 'bg-secondary/20 text-secondary' : 'text-ink/50 hover:text-ink'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${stockFilter === 'all' ? 'bg-secondary glow-secondary animate-pulse' : 'bg-ink/30'}`}></div>
              Todos ({ingredients.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                stockFilter === 'low' ? 'bg-error/20 text-error' : 'text-ink/50 hover:text-ink'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${stockFilter === 'low' ? 'bg-error animate-pulse' : 'bg-error/50'}`}></div>
              Stock bajo ({lowStockCount})
            </button>
          </div>
          <SearchInput value={stockSearch} onChange={setStockSearch} placeholder="Buscar insumo o proveedor" className="w-full sm:max-w-xs" />
          {canManage && (
            <>
              <label className="flex items-center gap-2 text-ink/60 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={showInactive} onChange={e => toggleInactive(e.target.checked)} className="accent-primary" />
                Mostrar desactivados
              </label>
              <button onClick={() => setIngredientForm('new')} className="sm:ml-auto px-5 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-semibold hover:bg-primary/30 transition-all flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Nuevo insumo
              </button>
            </>
          )}
          </div>

          {/* Stock cards (phones and portrait tablets) */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loading ? (
              <div className="glass-panel py-8 text-center text-ink/40 sm:col-span-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Cargando inventario...
              </div>
            ) : filteredIngredients.length === 0 ? (
              <div className="glass-panel py-8 px-4 text-center text-ink/40 sm:col-span-2">
                {emptyStockMessage}
              </div>
            ) : filteredIngredients.map(item => {
              const isLow = isLowStock(item);
              const stockPct = stockPercent(item);
              const inactive = item.isActive === false;
              const isNegative = Number(item.currentStock) < 0;
              return (
                <div key={item.id} className={`glass-panel p-4 ${isLow ? 'border-l-4 border-l-error' : ''} ${inactive ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{item.name}{inactive && <span className="text-ink/40 font-normal"> · desactivado</span>}</p>
                      <p className="text-ink/50 text-xs truncate">{item.supplier?.name || 'Sin proveedor'}</p>
                    </div>
                    {isLow ? (
                      <span className="flex items-center gap-1 text-error text-xs font-label font-bold uppercase shrink-0">
                        <AlertTriangle className="w-4 h-4" /> {isNegative ? 'Negativo' : 'Bajo'}
                      </span>
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-3 mt-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className={`font-mono ${isNegative ? 'text-error font-bold' : 'text-ink/80'}`}>{Number(item.currentStock).toLocaleString()}</span>
                        <span className="text-ink/40 text-xs"> {unitLabel(item.unit)} · mín. {Number(item.minStock).toLocaleString()}{item.maxStock != null && ` · máx. ${Number(item.maxStock).toLocaleString()}`}</span>
                      </p>
                      <div className="w-full max-w-[10rem] h-1.5 bg-ink/10 rounded-full mt-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${isLow ? 'bg-error' : 'bg-secondary'}`} style={{ width: `${stockPct}%` }}></div>
                      </div>
                      <p className="font-mono text-secondary text-xs mt-1.5">${Number(item.currentCostPerUnit).toFixed(4)} / {unitLabel(item.unit)}</p>
                    </div>
                    {canManage && (inactive ? (
                      <button onClick={() => reactivate(item)} className="px-4 py-2.5 rounded-xl bg-secondary/10 border border-secondary/30 text-secondary text-xs font-label uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <Power className="w-3.5 h-3.5" /> Reactivar
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setIngredientForm(item)} className="p-2.5 rounded-xl text-ink/50 hover:text-ink hover:bg-ink/5" aria-label={`Editar ${item.name}`}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteModal(item)} className="p-2.5 rounded-xl text-error/70 hover:text-error hover:bg-error/10" aria-label={`Eliminar ${item.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setAdjustModal(item); setAdjustType('ADJUSTMENT'); setAdjustQty(''); setAdjustReason(''); }}
                        className="px-4 py-2.5 rounded-xl bg-ink/5 border border-ink/10 text-ink/70 hover:text-primary hover:border-primary/30 transition-all text-xs font-label uppercase tracking-wider flex items-center gap-1 shrink-0"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" /> Ajustar
                      </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stock Table */}
          <div className="hidden lg:block glass-panel overflow-auto flex-1 border-ink/5 scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 bg-raised/95 backdrop-blur-sm z-10">
                <tr className="border-b border-ink/10 text-ink/40 font-label text-xs uppercase tracking-widest">
                  <th className="py-4 px-6 font-medium">Ingrediente</th>
                  <th className="py-4 px-6 font-medium">Proveedor</th>
                  <th className="py-4 px-6 font-medium">Stock Actual</th>
                  <th className="py-4 px-6 font-medium">Mín. / Máx.</th>
                  <th className="py-4 px-6 font-medium">Costo Unit.</th>
                  <th className="py-4 px-6 font-medium text-center">Estado</th>
                  {canManage && <th className="py-4 px-6 font-medium text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="font-body text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} className="py-8 text-center text-ink/40">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Cargando inventario...
                    </td>
                  </tr>
                ) : filteredIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} className="py-8 text-center text-ink/40">
                      {emptyStockMessage}
                    </td>
                  </tr>
                ) : filteredIngredients.map((item, idx) => {
                  const isLow = isLowStock(item);
                  const stockPct = stockPercent(item);
                  const inactive = item.isActive === false;
                  const isNegative = Number(item.currentStock) < 0;
                  return (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`border-b border-ink/5 hover:bg-ink/[0.02] transition-colors group ${inactive ? 'opacity-50' : ''}`}
                    >
                      <td className="py-4 px-6 text-ink group-hover:text-primary transition-colors font-medium">{item.name}{inactive && <span className="text-ink/40 font-normal"> · desactivado</span>}</td>
                      <td className="py-4 px-6 text-ink/50">{item.supplier?.name || '—'}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono ${isNegative ? 'text-error font-bold' : 'text-ink/80'}`}>{Number(item.currentStock).toLocaleString()}</span>
                          <span className="text-ink/30 text-xs">{unitLabel(item.unit)}</span>
                        </div>
                        <div className="w-20 h-1 bg-ink/10 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${isLow ? 'bg-error' : 'bg-secondary'}`} style={{ width: `${stockPct}%` }}></div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-ink/40">{Number(item.minStock).toLocaleString()} / {item.maxStock != null ? Number(item.maxStock).toLocaleString() : '—'}</td>
                      <td className="py-4 px-6 font-mono text-secondary">${Number(item.currentCostPerUnit).toFixed(4)}</td>
                      <td className="py-4 px-6 flex justify-center">
                        {isLow ? (
                          <span className="flex items-center gap-1 text-error text-xs font-label font-bold uppercase">
                            <AlertTriangle className="w-4 h-4" /> {isNegative ? 'Negativo' : 'Bajo'}
                          </span>
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-secondary" />
                        )}
                      </td>
                      {canManage && <td className="py-4 px-6">
                        {inactive ? (
                          <button onClick={() => reactivate(item)} className="px-3 py-1.5 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary text-xs font-label uppercase tracking-wider flex items-center gap-1 mx-auto">
                            <Power className="w-3 h-3" /> Reactivar
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setAdjustModal(item); setAdjustType('ADJUSTMENT'); setAdjustQty(''); setAdjustReason(''); }}
                              className="px-3 py-1.5 rounded-lg bg-ink/5 border border-ink/10 text-ink/60 hover:text-primary hover:border-primary/30 transition-all text-xs font-label uppercase tracking-wider flex items-center gap-1"
                            >
                              <ArrowUpDown className="w-3 h-3" /> Ajustar
                            </button>
                            <button onClick={() => setIngredientForm(item)} className="p-1.5 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5" aria-label={`Editar ${item.name}`} title="Editar">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteModal(item)} className="p-1.5 rounded-lg text-error/70 hover:text-error hover:bg-error/10" aria-label={`Eliminar ${item.name}`} title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: RECIPES ═══ */}
      {activeTab === 'recipes' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
          {/* Product list (on phones it gives way to the chosen recipe) */}
          <div className={cn('glass-panel p-3 sm:p-4 flex flex-col gap-3 lg:w-72 shrink-0 min-h-0', selectedProductId && 'hidden lg:flex')}>
            <SearchInput value={recipeSearch} onChange={setRecipeSearch} placeholder="Buscar producto o categoría" />
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 space-y-1">
              {loading ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
              ) : filteredProducts.length === 0 ? (
                <p className="py-8 text-center text-ink/40 text-sm">{recipeSearch ? `Ningún producto coincide con "${recipeSearch}"` : 'No hay productos'}</p>
              ) : filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(p.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border border-transparent transition-all',
                    selectedProductId === p.id ? 'bg-primary/10 border-primary/20 text-primary' : 'text-ink/80 hover:bg-ink/5'
                  )}
                >
                  <span className="w-9 h-9 rounded-lg overflow-hidden bg-primary/10 shrink-0 flex items-center justify-center">
                    {p.imageUrl
                      ? <img src={productImageSrc(p.imageUrl) ?? undefined} alt="" loading="lazy" className="w-full h-full object-cover" />
                      : <span className="font-headline font-bold text-xs text-primary/50">{p.name.substring(0, 2).toUpperCase()}</span>}
                  </span>
                  <span className={cn('flex-1 min-w-0', !p.isActive && 'opacity-50')}>
                    <span className="block font-medium truncate">{p.name}</span>
                    <span className="block text-xs text-ink/40 truncate">
                      {p.category?.name}{!p.isActive && ' · oculto en POS'}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-ink/30 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {!selectedProductId && (
            <div className="hidden lg:flex flex-1 glass-panel items-center justify-center text-ink/40 p-8">
              Elige un producto para ver su receta
            </div>
          )}

          {selectedProductId && (
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <button onClick={() => selectProduct(null)} className="lg:hidden self-start flex items-center gap-1 text-primary text-sm font-medium -ml-1">
              <ChevronLeft className="w-4 h-4" /> Todas las recetas
            </button>

            {/* Recipe Summary Card */}
            {selectedProduct && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full">
                <div className="glass-panel p-5 sm:p-6 border-t-2 border-t-primary relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Coffee className="w-32 h-32" /></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="font-headline text-xl font-bold text-ink">{selectedProduct.name}</h3>
                        <p className="text-ink/40 text-xs mt-1">{selectedProduct.category?.name} · {selectedProduct.size || 'Estándar'}</p>
                        {selectedProduct.isActive === false && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded bg-error/15 text-error text-[10px] font-label uppercase tracking-widest">
                            <EyeOff className="w-3 h-3" /> Oculto en POS
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-label tracking-widest uppercase rounded">{recipe.length} items</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-canvas/60 p-3 rounded-xl border border-ink/5">
                        <p className="text-ink/40 text-xs mb-1">Costo</p>
                        <p className="font-mono text-secondary font-medium">${recipeCost.toFixed(2)}</p>
                      </div>
                      <div className="bg-canvas/60 p-3 rounded-xl border border-ink/5">
                        <p className="text-ink/40 text-xs mb-1">Precio</p>
                        <p className="font-mono text-primary font-medium">${sellingPrice.toFixed(2)}</p>
                      </div>
                      <div className="bg-canvas/60 p-3 rounded-xl border border-ink/5">
                        <p className="text-ink/40 text-xs mb-1">Margen</p>
                        <p className={`font-mono font-medium ${margin > 50 ? 'text-secondary' : margin > 30 ? 'text-warning' : 'text-error'}`}>{margin.toFixed(0)}%</p>
                      </div>
                    </div>
                    {/* Edit / Save buttons */}
                    {editingRecipe ? (
                      <div className="flex gap-2">
                        <button onClick={() => setEditingRecipe(false)} className="flex-1 py-2.5 rounded-xl border border-ink/10 text-ink/60 hover:text-ink text-sm font-medium flex items-center justify-center gap-1"><X className="w-4 h-4" /> Cancelar</button>
                        <button onClick={saveRecipe} disabled={recipeSaving} className="flex-1 py-2.5 rounded-xl bg-cta-alt text-on-secondary font-bold text-sm flex items-center justify-center gap-1 disabled:opacity-50">
                          {recipeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar</>}
                        </button>
                      </div>
                    ) : canManage && (
                      <div className="flex gap-2">
                        <button onClick={() => setEditingProduct(true)} className="flex-1 py-2.5 rounded-xl bg-ink/5 border border-ink/10 text-ink/70 hover:text-primary hover:border-primary/30 text-sm font-medium flex items-center justify-center gap-2 transition-all">
                          <Pencil className="w-4 h-4" /> Editar producto
                        </button>
                        <button onClick={startEditRecipe} className="flex-1 py-2.5 rounded-xl bg-ink/5 border border-ink/10 text-ink/70 hover:text-primary hover:border-primary/30 text-sm font-medium flex items-center justify-center gap-2 transition-all">
                          <SlidersHorizontal className="w-4 h-4" /> Editar Receta
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Recipe Table */}
            {selectedProductId && (
              <div className="glass-panel overflow-auto flex-1 border-ink/5">
                {recipeLoading ? (
                  <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                ) : recipe.length === 0 ? (
                  <div className="p-8 text-center text-ink/40">Este producto no tiene receta asignada</div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[420px]">
                    <thead>
                      <tr className="border-b border-ink/10 text-ink/40 font-label text-xs uppercase tracking-widest">
                        <th className="py-3 px-3 sm:px-6 font-medium">Ingrediente</th>
                        <th className="py-3 px-3 sm:px-6 font-medium">Cantidad</th>
                        <th className="py-3 px-3 sm:px-6 font-medium">Unidad</th>
                        <th className="py-3 px-3 sm:px-6 font-medium">Costo</th>
                        {editingRecipe && <th className="py-3 px-4 font-medium w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {editingRecipe ? (
                        <>
                          {editRecipeRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-ink/5">
                              <td className="py-2 px-3 sm:px-6">
                                <select value={row.ingredientId} onChange={e => { const rows = [...editRecipeRows]; rows[idx].ingredientId = Number(e.target.value); setEditRecipeRows(rows); }}
                                  className="w-full px-2 py-1.5 bg-ink/5 border border-ink/10 rounded-lg text-ink text-xs appearance-none [&>option]:bg-raised">
                                  <option value={0}>—</option>
                                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                              </td>
                              <td className="py-2 px-3 sm:px-6">
                                <input type="number" value={row.quantityUsed} onChange={e => { const rows = [...editRecipeRows]; rows[idx].quantityUsed = e.target.value; setEditRecipeRows(rows); }}
                                  className="w-20 px-2 py-1.5 bg-ink/5 border border-ink/10 rounded-lg text-primary font-mono text-xs focus:outline-none focus:border-primary/50" />
                              </td>
                              <td className="py-2 px-3 sm:px-6 text-ink/50">{ingredients.find(i => i.id === row.ingredientId)?.unit.toLowerCase() || '—'}</td>
                              <td className="py-2 px-3 sm:px-6 font-mono text-secondary text-xs">
                                {(() => { const ing = ingredients.find(i => i.id === row.ingredientId); return ing ? '$' + (Number(row.quantityUsed) * Number(ing.currentCostPerUnit)).toFixed(4) : '—'; })()}
                              </td>
                              <td className="py-2 px-4">
                                <button onClick={() => setEditRecipeRows(editRecipeRows.filter((_, i) => i !== idx))} className="text-error/60 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={5} className="py-2 px-3 sm:px-6">
                              <button onClick={() => setEditRecipeRows([...editRecipeRows, { ingredientId: 0, quantityUsed: '' }])}
                                className="text-primary text-xs font-label uppercase tracking-wider flex items-center gap-1 hover:text-primary/80"><Plus className="w-3 h-3" /> Agregar ingrediente</button>
                            </td>
                          </tr>
                        </>
                      ) : (
                        recipe.map((r, idx) => (
                          <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }} className="border-b border-ink/5">
                            <td className="py-3 px-3 sm:px-6 text-ink">{r.ingredient.name}</td>
                            <td className="py-3 px-3 sm:px-6 font-mono text-primary">{Number(r.quantityUsed).toFixed(2)}</td>
                            <td className="py-3 px-3 sm:px-6 text-ink/50">{r.ingredient.unit.toLowerCase()}</td>
                            <td className="py-3 px-3 sm:px-6 font-mono text-secondary">${(Number(r.quantityUsed) * Number(r.ingredient.currentCostPerUnit)).toFixed(4)}</td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          )}

        </div>
      )}

      {editingProduct && selectedProduct && (
        <ProductEditModal product={selectedProduct} onClose={() => setEditingProduct(false)} onSaved={productSaved} />
      )}

      {/* ═══ TAB: MODIFIERS ═══ */}
      {activeTab === 'modifiers' && (
        <ModifiersTab ingredients={ingredients} products={products} canManage={canManage} />
      )}

      {activeTab === 'suppliers' && (
        <SuppliersTab ingredients={ingredients} canManage={canManage} onChanged={loadAll} />
      )}

      {/* ═══ TAB: PURCHASES ═══ */}
      {activeTab === 'purchases' && canManage && (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
          {/* Purchase Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full lg:w-[420px] shrink-0"
          >
            <div className="glass-panel p-5 sm:p-6 border-t-2 border-t-secondary">
              <div className="flex items-center gap-2 mb-6">
                <Plus className="w-5 h-5 text-secondary" />
                <h3 className="font-label uppercase tracking-widest text-sm font-semibold text-ink">Registrar Compra</h3>
              </div>

              <div className="space-y-4">
                {/* Ingredient Select */}
                <div>
                  <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2">Ingrediente</label>
                  <div className="relative">
                    <select
                      value={purchaseForm.ingredientId}
                      onChange={e => setPurchaseForm(f => ({ ...f, ingredientId: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink appearance-none cursor-pointer focus:border-primary/50 focus:outline-none transition-colors [&>option]:bg-raised [&>option]:text-ink"
                    >
                      <option value={0}>— Seleccionar —</option>
                      {ingredients.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit.toLowerCase()})</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40 pointer-events-none" />
                  </div>
                </div>

                {/* Supplier Select */}
                <div>
                  <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2">Proveedor</label>
                  <div className="relative">
                    <select
                      value={purchaseForm.supplierId}
                      onChange={e => setPurchaseForm(f => ({ ...f, supplierId: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink appearance-none cursor-pointer focus:border-primary/50 focus:outline-none transition-colors [&>option]:bg-raised [&>option]:text-ink"
                    >
                      <option value={0}>— Seleccionar —</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40 pointer-events-none" />
                  </div>
                </div>

                {/* Quantity + Total Cost */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2">Cantidad</label>
                    <input
                      type="number"
                      value={purchaseForm.quantity}
                      onChange={e => setPurchaseForm(f => ({ ...f, quantity: e.target.value }))}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink font-mono focus:border-primary/50 focus:outline-none transition-colors placeholder:text-ink/20"
                    />
                  </div>
                  <div>
                    <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2">Costo Total $</label>
                    <input
                      type="number"
                      value={purchaseForm.totalCost}
                      onChange={e => setPurchaseForm(f => ({ ...f, totalCost: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink font-mono focus:border-primary/50 focus:outline-none transition-colors placeholder:text-ink/20"
                    />
                  </div>
                </div>

                {/* Unit cost preview */}
                {purchaseForm.quantity && purchaseForm.totalCost && (
                  <div className="bg-ink/5 rounded-xl p-3 border border-ink/10">
                    <span className="text-ink/40 text-xs">Costo unitario: </span>
                    <span className="font-mono text-primary font-bold">
                      ${(Number(purchaseForm.totalCost) / Number(purchaseForm.quantity)).toFixed(4)}
                    </span>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2">Notas (opcional)</label>
                  <input
                    type="text"
                    value={purchaseForm.notes}
                    onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Factura, lote, etc."
                    className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none transition-colors placeholder:text-ink/20"
                  />
                </div>

                {purchaseSuccess && (
                  <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3 text-secondary text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {purchaseSuccess}
                  </div>
                )}

                <button
                  onClick={handlePurchase}
                  disabled={purchaseSubmitting || !purchaseForm.ingredientId || !purchaseForm.supplierId || !purchaseForm.quantity || !purchaseForm.totalCost}
                  className="w-full py-4 rounded-xl bg-cta-alt text-on-secondary font-bold text-sm glow-secondary hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {purchaseSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Registrar Compra</>}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Current Stock Summary */}
          <div className="flex-1 glass-panel overflow-auto border-ink/5 scrollbar-thin min-h-[16rem]">
            <div className="p-4 border-b border-ink/10 sticky top-0 bg-raised/95 backdrop-blur-sm z-10">
              <p className="text-ink/50 text-xs font-label uppercase tracking-widest">Stock actual — referencia rápida</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-ink/10 text-ink/40 font-label text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-medium">Ingrediente</th>
                  <th className="py-3 px-4 font-medium">Stock</th>
                  <th className="py-3 px-4 font-medium">Costo/U</th>
                  <th className="py-3 px-4 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {ingredients.map(item => {
                  const isLow = isLowStock(item);
                  return (
                    <tr key={item.id} className={`border-b border-ink/5 ${isLow ? 'bg-error/5' : ''}`}>
                      <td className="py-2 px-4 text-ink text-xs">{item.name}</td>
                      <td className="py-2 px-4 font-mono text-ink/70 text-xs">{Number(item.currentStock).toLocaleString()} {item.unit.toLowerCase()}</td>
                      <td className="py-2 px-4 font-mono text-secondary text-xs">${Number(item.currentCostPerUnit).toFixed(4)}</td>
                      <td className="py-2 px-4 text-center">
                        {isLow ? <AlertTriangle className="w-3.5 h-3.5 text-error inline" /> : <CheckCircle2 className="w-3.5 h-3.5 text-secondary inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ═══ ADJUSTMENT MODAL ═══ */}
      {adjustModal && (
        <Modal title="Ajuste de Inventario" onClose={() => setAdjustModal(null)}>
          <p className="text-primary font-medium mb-4">{adjustModal.name} <span className="text-ink/40 text-sm">({Number(adjustModal.currentStock).toLocaleString()} {adjustModal.unit.toLowerCase()} actual)</span></p>

          {/* Type selector */}
          <div className="flex gap-2 mb-4">
            {([['IN', 'Entrada'], ['OUT', 'Salida (Merma)'], ['ADJUSTMENT', 'Ajuste Exacto']] as const).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setAdjustType(type)}
                className={`flex-1 py-2.5 px-1 rounded-lg text-xs font-label uppercase tracking-wider border transition-all ${adjustType === type ? 'bg-primary/20 border-primary text-primary' : 'bg-ink/5 border-ink/10 text-ink/50 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2">
                {adjustType === 'ADJUSTMENT' ? 'Nuevo stock exacto' : 'Cantidad'}
              </label>
              <input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0"
                className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink font-mono focus:border-primary/50 focus:outline-none placeholder:text-ink/20" />
            </div>
            <div>
              <label className="text-ink/50 text-xs font-label uppercase tracking-widest block mb-2">Razón</label>
              <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Merma, donación, conteo físico..."
                className="w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none placeholder:text-ink/20" />
            </div>
            <button onClick={handleAdjustment} disabled={adjustSubmitting || !adjustQty}
              className="w-full py-3 rounded-xl bg-cta text-on-primary font-bold glow-secondary hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {adjustSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowUpDown className="w-4 h-4" /> Aplicar Ajuste</>}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ INSUMO CRUD MODALS ═══ */}
      {ingredientForm && (
        <IngredientFormModal
          ingredient={ingredientForm === 'new' ? null : ingredientForm}
          suppliers={suppliers}
          onClose={() => setIngredientForm(null)}
          onSaved={afterIngredientChange}
          onChangeUnit={item => { setIngredientForm(null); setUnitModal(item as Ingredient); }}
        />
      )}
      {unitModal && <ChangeUnitModal ingredient={unitModal} onClose={() => setUnitModal(null)} onSaved={afterIngredientChange} />}
      {deleteModal && <DeleteIngredientModal ingredient={deleteModal} onClose={() => setDeleteModal(null)} onDone={afterIngredientChange} />}
    </div>
  );
}
