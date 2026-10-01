import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, SlidersHorizontal, Coffee, Loader2, ShoppingCart, Package, ChevronDown, Plus, Send, X, Save, Trash2, ArrowUpDown, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import * as motion from 'motion/react-client';

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  currentStock: string;
  minStock: string;
  currentCostPerUnit: string;
  avgCostPerUnit: string;
  supplier?: { name: string } | null;
}

interface Product {
  id: number;
  name: string;
  sellingPrice: string;
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

type Tab = 'stock' | 'recipes' | 'purchases';
type StockFilter = 'all' | 'low';

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock filter
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  // Recipe composer
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<RecipeIngredient[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRecipe | null>(null);

  // Recipe editing
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [editRecipeRows, setEditRecipeRows] = useState<{ ingredientId: number; quantityUsed: string }[]>([]);
  const [recipeSaving, setRecipeSaving] = useState(false);

  // Adjustment modal
  const [adjustModal, setAdjustModal] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('ADJUSTMENT');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Purchase form
  const [purchaseForm, setPurchaseForm] = useState({ ingredientId: 0, supplierId: 0, quantity: '', totalCost: '', notes: '' });
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState('');

  useEffect(() => {
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
  }, []);

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

  const filteredIngredients = stockFilter === 'low'
    ? ingredients.filter(i => Number(i.currentStock) <= Number(i.minStock))
    : ingredients;

  const lowStockCount = ingredients.filter(i => Number(i.currentStock) <= Number(i.minStock)).length;

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
    { key: 'purchases', label: 'Compras', icon: ShoppingCart },
  ];

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold text-white tracking-tight">Inventario</h1>
          <p className="text-white/50 text-sm font-label uppercase tracking-wider mt-1">Gestión de stock, recetas y compras</p>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2 rounded-lg font-label text-sm uppercase tracking-widest flex items-center gap-2 transition-all duration-300 ${
                  activeTab === tab.key
                    ? 'bg-primary/20 text-primary font-bold shadow-[0_0_15px_rgba(0,219,233,0.2)]'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ TAB: STOCK ═══ */}
      {activeTab === 'stock' && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Stock filter */}
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10 w-fit">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                stockFilter === 'all' ? 'bg-secondary/20 text-secondary' : 'text-white/50 hover:text-white'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${stockFilter === 'all' ? 'bg-secondary glow-mint animate-pulse' : 'bg-white/30'}`}></div>
              In Stock ({ingredients.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                stockFilter === 'low' ? 'bg-error/20 text-error' : 'text-white/50 hover:text-white'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${stockFilter === 'low' ? 'bg-error animate-pulse' : 'bg-error/50'}`}></div>
              Low Stock ({lowStockCount})
            </button>
          </div>

          {/* Stock Table */}
          <div className="glass-panel overflow-auto flex-1 border-white/5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 bg-[#0d0e12]/95 backdrop-blur-sm z-10">
                <tr className="border-b border-white/10 text-white/40 font-label text-xs uppercase tracking-widest">
                  <th className="py-4 px-6 font-medium">Ingrediente</th>
                  <th className="py-4 px-6 font-medium">Proveedor</th>
                  <th className="py-4 px-6 font-medium">Stock Actual</th>
                  <th className="py-4 px-6 font-medium">Mínimo</th>
                  <th className="py-4 px-6 font-medium">Costo Unit.</th>
                  <th className="py-4 px-6 font-medium text-center">Estado</th>
                  <th className="py-4 px-6 font-medium text-center">Ajustar</th>
                </tr>
              </thead>
              <tbody className="font-body text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-white/40">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Cargando inventario...
                    </td>
                  </tr>
                ) : filteredIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-white/40">
                      {stockFilter === 'low' ? 'No hay ingredientes con stock bajo ✅' : 'No hay ingredientes registrados'}
                    </td>
                  </tr>
                ) : filteredIngredients.map((item, idx) => {
                  const isLow = Number(item.currentStock) <= Number(item.minStock);
                  const stockPct = Number(item.minStock) > 0 ? (Number(item.currentStock) / (Number(item.minStock) * 3)) * 100 : 100;
                  return (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-4 px-6 text-white group-hover:text-primary transition-colors font-medium">{item.name}</td>
                      <td className="py-4 px-6 text-white/50">{item.supplier?.name || '—'}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-white/80">{Number(item.currentStock).toLocaleString()}</span>
                          <span className="text-white/30 text-xs">{item.unit.toLowerCase()}</span>
                        </div>
                        <div className="w-20 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${isLow ? 'bg-error' : 'bg-secondary'}`} style={{ width: `${Math.min(stockPct, 100)}%` }}></div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-white/40">{Number(item.minStock).toLocaleString()}</td>
                      <td className="py-4 px-6 font-mono text-secondary">${Number(item.currentCostPerUnit).toFixed(4)}</td>
                      <td className="py-4 px-6 flex justify-center">
                        {isLow ? (
                          <span className="flex items-center gap-1 text-error text-xs font-label font-bold uppercase">
                            <AlertTriangle className="w-4 h-4" /> Bajo
                          </span>
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-secondary" />
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => { setAdjustModal(item); setAdjustType('ADJUSTMENT'); setAdjustQty(''); setAdjustReason(''); }}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-primary hover:border-primary/30 transition-all text-xs font-label uppercase tracking-wider flex items-center gap-1 mx-auto"
                        >
                          <ArrowUpDown className="w-3 h-3" /> Ajustar
                        </button>
                      </td>
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
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          {/* Product Selector */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="glass-panel p-6">
              <label className="text-white/50 text-xs font-label uppercase tracking-widest block mb-3">Seleccionar Producto</label>
              <div className="relative">
                <select
                  value={selectedProductId || ''}
                  onChange={e => {
                    const id = Number(e.target.value) || null;
                    setSelectedProductId(id);
                    setRecipeLoading(!!id);
                    if (!id) { setRecipe([]); setSelectedProduct(null); }
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:border-primary/50 focus:outline-none transition-colors [&>option]:bg-[#0d0e12] [&>option]:text-white"
                >
                  <option value="">— Elige un producto —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.category ? `(${p.category.name})` : ''}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Recipe Table */}
            {selectedProductId && (
              <div className="glass-panel overflow-auto flex-1 border-white/5">
                {recipeLoading ? (
                  <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                ) : recipe.length === 0 ? (
                  <div className="p-8 text-center text-white/40">Este producto no tiene receta asignada</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 font-label text-xs uppercase tracking-widest">
                        <th className="py-3 px-6 font-medium">Ingrediente</th>
                        <th className="py-3 px-6 font-medium">Cantidad</th>
                        <th className="py-3 px-6 font-medium">Unidad</th>
                        <th className="py-3 px-6 font-medium">Costo</th>
                        {editingRecipe && <th className="py-3 px-4 font-medium w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {editingRecipe ? (
                        <>
                          {editRecipeRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-white/5">
                              <td className="py-2 px-6">
                                <select value={row.ingredientId} onChange={e => { const rows = [...editRecipeRows]; rows[idx].ingredientId = Number(e.target.value); setEditRecipeRows(rows); }}
                                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs appearance-none [&>option]:bg-[#0d0e12]">
                                  <option value={0}>—</option>
                                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                              </td>
                              <td className="py-2 px-6">
                                <input type="number" value={row.quantityUsed} onChange={e => { const rows = [...editRecipeRows]; rows[idx].quantityUsed = e.target.value; setEditRecipeRows(rows); }}
                                  className="w-20 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-primary font-mono text-xs focus:outline-none focus:border-primary/50" />
                              </td>
                              <td className="py-2 px-6 text-white/50">{ingredients.find(i => i.id === row.ingredientId)?.unit.toLowerCase() || '—'}</td>
                              <td className="py-2 px-6 font-mono text-secondary text-xs">
                                {(() => { const ing = ingredients.find(i => i.id === row.ingredientId); return ing ? '$' + (Number(row.quantityUsed) * Number(ing.currentCostPerUnit)).toFixed(4) : '—'; })()}
                              </td>
                              <td className="py-2 px-4">
                                <button onClick={() => setEditRecipeRows(editRecipeRows.filter((_, i) => i !== idx))} className="text-error/60 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={5} className="py-2 px-6">
                              <button onClick={() => setEditRecipeRows([...editRecipeRows, { ingredientId: 0, quantityUsed: '' }])}
                                className="text-primary text-xs font-label uppercase tracking-wider flex items-center gap-1 hover:text-primary/80"><Plus className="w-3 h-3" /> Agregar ingrediente</button>
                            </td>
                          </tr>
                        </>
                      ) : (
                        recipe.map((r, idx) => (
                          <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }} className="border-b border-white/5">
                            <td className="py-3 px-6 text-white">{r.ingredient.name}</td>
                            <td className="py-3 px-6 font-mono text-primary">{Number(r.quantityUsed).toFixed(2)}</td>
                            <td className="py-3 px-6 text-white/50">{r.ingredient.unit.toLowerCase()}</td>
                            <td className="py-3 px-6 font-mono text-secondary">${(Number(r.quantityUsed) * Number(r.ingredient.currentCostPerUnit)).toFixed(4)}</td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Recipe Summary Card */}
          {selectedProduct && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full lg:w-80 shrink-0">
              <div className="glass-panel p-6 border-t-2 border-t-primary relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Coffee className="w-32 h-32" /></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-headline text-xl font-bold text-white">{selectedProduct.name}</h3>
                      <p className="text-white/40 text-xs mt-1">{selectedProduct.category?.name} · {selectedProduct.size || 'Estándar'}</p>
                    </div>
                    <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-label tracking-widest uppercase rounded">{recipe.length} items</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-[#111318]/50 p-3 rounded-xl border border-white/5">
                      <p className="text-white/40 text-xs mb-1">Costo</p>
                      <p className="font-mono text-secondary font-medium">${recipeCost.toFixed(2)}</p>
                    </div>
                    <div className="bg-[#111318]/50 p-3 rounded-xl border border-white/5">
                      <p className="text-white/40 text-xs mb-1">Precio</p>
                      <p className="font-mono text-primary font-medium">${sellingPrice.toFixed(2)}</p>
                    </div>
                    <div className="bg-[#111318]/50 p-3 rounded-xl border border-white/5">
                      <p className="text-white/40 text-xs mb-1">Margen</p>
                      <p className={`font-mono font-medium ${margin > 50 ? 'text-secondary' : margin > 30 ? 'text-yellow-400' : 'text-error'}`}>{margin.toFixed(0)}%</p>
                    </div>
                  </div>
                  {/* Edit / Save buttons */}
                  {editingRecipe ? (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingRecipe(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm font-medium flex items-center justify-center gap-1"><X className="w-4 h-4" /> Cancelar</button>
                      <button onClick={saveRecipe} disabled={recipeSaving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-secondary/80 to-[#1b9a73] text-[#0a0b0e] font-bold text-sm flex items-center justify-center gap-1 disabled:opacity-50">
                        {recipeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar</>}
                      </button>
                    </div>
                  ) : (
                    <button onClick={startEditRecipe} className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-primary hover:border-primary/30 text-sm font-medium flex items-center justify-center gap-2 transition-all">
                      <SlidersHorizontal className="w-4 h-4" /> Editar Receta
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ═══ TAB: PURCHASES ═══ */}
      {activeTab === 'purchases' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          {/* Purchase Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full lg:w-[420px] shrink-0"
          >
            <div className="glass-panel p-6 border-t-2 border-t-secondary">
              <div className="flex items-center gap-2 mb-6">
                <Plus className="w-5 h-5 text-secondary" />
                <h3 className="font-label uppercase tracking-widest text-sm font-semibold text-white">Registrar Compra</h3>
              </div>

              <div className="space-y-4">
                {/* Ingredient Select */}
                <div>
                  <label className="text-white/50 text-xs font-label uppercase tracking-widest block mb-2">Ingrediente</label>
                  <div className="relative">
                    <select
                      value={purchaseForm.ingredientId}
                      onChange={e => setPurchaseForm(f => ({ ...f, ingredientId: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:border-primary/50 focus:outline-none transition-colors [&>option]:bg-[#0d0e12] [&>option]:text-white"
                    >
                      <option value={0}>— Seleccionar —</option>
                      {ingredients.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit.toLowerCase()})</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  </div>
                </div>

                {/* Supplier Select */}
                <div>
                  <label className="text-white/50 text-xs font-label uppercase tracking-widest block mb-2">Proveedor</label>
                  <div className="relative">
                    <select
                      value={purchaseForm.supplierId}
                      onChange={e => setPurchaseForm(f => ({ ...f, supplierId: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:border-primary/50 focus:outline-none transition-colors [&>option]:bg-[#0d0e12] [&>option]:text-white"
                    >
                      <option value={0}>— Seleccionar —</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  </div>
                </div>

                {/* Quantity + Total Cost */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 text-xs font-label uppercase tracking-widest block mb-2">Cantidad</label>
                    <input
                      type="number"
                      value={purchaseForm.quantity}
                      onChange={e => setPurchaseForm(f => ({ ...f, quantity: e.target.value }))}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:border-primary/50 focus:outline-none transition-colors placeholder:text-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs font-label uppercase tracking-widest block mb-2">Costo Total $</label>
                    <input
                      type="number"
                      value={purchaseForm.totalCost}
                      onChange={e => setPurchaseForm(f => ({ ...f, totalCost: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:border-primary/50 focus:outline-none transition-colors placeholder:text-white/20"
                    />
                  </div>
                </div>

                {/* Unit cost preview */}
                {purchaseForm.quantity && purchaseForm.totalCost && (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <span className="text-white/40 text-xs">Costo unitario: </span>
                    <span className="font-mono text-primary font-bold">
                      ${(Number(purchaseForm.totalCost) / Number(purchaseForm.quantity)).toFixed(4)}
                    </span>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="text-white/50 text-xs font-label uppercase tracking-widest block mb-2">Notas (opcional)</label>
                  <input
                    type="text"
                    value={purchaseForm.notes}
                    onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Factura, lote, etc."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-primary/50 focus:outline-none transition-colors placeholder:text-white/20"
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
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-secondary/80 to-[#1b9a73] text-[#0a0b0e] font-bold text-sm shadow-[0_0_20px_rgba(54,255,196,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {purchaseSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Registrar Compra</>}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Current Stock Summary */}
          <div className="flex-1 glass-panel overflow-auto border-white/5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
            <div className="p-4 border-b border-white/10 sticky top-0 bg-[#0d0e12]/95 backdrop-blur-sm z-10">
              <p className="text-white/50 text-xs font-label uppercase tracking-widest">Stock actual — referencia rápida</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/40 font-label text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-medium">Ingrediente</th>
                  <th className="py-3 px-4 font-medium">Stock</th>
                  <th className="py-3 px-4 font-medium">Costo/U</th>
                  <th className="py-3 px-4 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {ingredients.map(item => {
                  const isLow = Number(item.currentStock) <= Number(item.minStock);
                  return (
                    <tr key={item.id} className={`border-b border-white/5 ${isLow ? 'bg-error/5' : ''}`}>
                      <td className="py-2 px-4 text-white text-xs">{item.name}</td>
                      <td className="py-2 px-4 font-mono text-white/70 text-xs">{Number(item.currentStock).toLocaleString()} {item.unit.toLowerCase()}</td>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAdjustModal(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="glass-panel p-6 w-full max-w-md border-t-2 border-t-primary"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline text-xl font-bold text-white">Ajuste de Inventario</h3>
              <button onClick={() => setAdjustModal(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-primary font-medium mb-4">{adjustModal.name} <span className="text-white/40 text-sm">({Number(adjustModal.currentStock).toLocaleString()} {adjustModal.unit.toLowerCase()} actual)</span></p>

            {/* Type selector */}
            <div className="flex gap-2 mb-4">
              {([['IN', 'Entrada'], ['OUT', 'Salida (Merma)'], ['ADJUSTMENT', 'Ajuste Exacto']] as const).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setAdjustType(type)}
                  className={`flex-1 py-2 rounded-lg text-xs font-label uppercase tracking-wider border transition-all ${adjustType === type ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/50 text-xs font-label uppercase tracking-widest block mb-2">
                  {adjustType === 'ADJUSTMENT' ? 'Nuevo stock exacto' : 'Cantidad'}
                </label>
                <input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:border-primary/50 focus:outline-none placeholder:text-white/20" />
              </div>
              <div>
                <label className="text-white/50 text-xs font-label uppercase tracking-widest block mb-2">Razón</label>
                <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Merma, donación, conteo físico..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-primary/50 focus:outline-none placeholder:text-white/20" />
              </div>
              <button onClick={handleAdjustment} disabled={adjustSubmitting || !adjustQty}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-[#0a0b0e] font-bold shadow-[0_0_20px_rgba(54,255,196,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {adjustSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowUpDown className="w-4 h-4" /> Aplicar Ajuste</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
