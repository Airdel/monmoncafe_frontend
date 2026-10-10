import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, History, Loader2, Pencil, Plus, Power, Save, ShoppingCart, Trash2, Wrench } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { unwrap } from '../../lib/unwrap';
import { confirm, notifyError, toast } from '../../lib/dialogs';
import { formatMoney } from '../../lib/format';
import { matchesSearch } from '../../lib/search';
import { LOSS_REASONS, TOOL_CATEGORIES, lossText, shortDate, toolCategory, type LossReason, type Tool, type ToolCategory, type ToolMovementReason } from '../../lib/tools';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';

interface SupplierRef { id: number; name: string }

const inputClass = 'w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none placeholder:text-ink/20';
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';
const saveButton = 'w-full py-3 rounded-xl bg-cta text-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50';

/**
 * Work tools: glasses, jugs, the blender… They are not used up by sales; they
 * break, get lost or wear out. Missing pieces go to the shopping list.
 */
export function ToolsTab({ suppliers, canManage }: { suppliers: SupplierRef[]; canManage: boolean }) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ToolCategory | 'ALL'>('ALL');
  const [form, setForm] = useState<Tool | 'new' | null>(null);
  const [losing, setLosing] = useState<Tool | null>(null);
  const [history, setHistory] = useState<Tool | null>(null);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/tools', { params: { includeInactive: showInactive || undefined } })
      .then(res => { if (!cancelled) setTools(unwrap<Tool[]>(res)); })
      .catch(err => notifyError(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showInactive, reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  const active = tools.filter(t => t.isActive);
  const missing = active.filter(t => t.quantity < t.idealQuantity);
  const missingCost = missing.reduce((sum, t) => sum + (t.idealQuantity - t.quantity) * Number(t.unitCost), 0);
  const totalValue = active.reduce((sum, t) => sum + t.quantity * Number(t.unitCost), 0);
  const usedCategories = TOOL_CATEGORIES.filter(c => tools.some(t => t.category === c.key));
  const visible = tools.filter(t => (category === 'ALL' || t.category === category) && matchesSearch(search, t.name, t.supplier?.name, t.notes));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-3 sm:p-4 min-w-0">
          <p className="text-ink/50 text-[10px] sm:text-xs font-label uppercase tracking-widest mb-1">En uso</p>
          <p className="font-headline text-lg sm:text-2xl font-bold text-ink">{active.reduce((sum, t) => sum + t.quantity, 0)} pzas</p>
        </div>
        <div className="glass-panel p-3 sm:p-4 min-w-0">
          <p className="text-ink/50 text-[10px] sm:text-xs font-label uppercase tracking-widest mb-1">Por reponer</p>
          <p className={cn('font-headline text-lg sm:text-2xl font-bold', missing.length ? 'text-error' : 'text-secondary')}>
            {missing.length}{missing.length > 0 && <span className="text-xs sm:text-sm font-normal text-ink/50"> ({formatMoney(missingCost)})</span>}
          </p>
        </div>
        <div className="glass-panel p-3 sm:p-4 min-w-0">
          <p className="text-ink/50 text-[10px] sm:text-xs font-label uppercase tracking-widest mb-1">Valor del equipo</p>
          <p className="font-headline text-lg sm:text-2xl font-bold text-secondary break-words">{formatMoney(totalValue)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar herramienta..." className="flex-1" />
        {canManage && (
          <label className="flex items-center gap-2 text-ink/60 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={e => { setLoading(true); setShowInactive(e.target.checked); }} className="accent-primary" />
            Mostrar desactivadas
          </label>
        )}
        {canManage && (
          <div className="flex gap-3">
            <button onClick={() => setCounting(true)} disabled={active.length === 0} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-ink/10 text-ink/70 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
              <ClipboardList className="w-5 h-5" /> Conteo
            </button>
            <button onClick={() => setForm('new')} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-semibold hover:bg-primary/30 transition-all flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" /> Nueva
            </button>
          </div>
        )}
      </div>

      {usedCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
          {[{ key: 'ALL' as const, label: 'Todas', icon: Wrench }, ...usedCategories].map(c => {
            const Icon = c.icon;
            return (
              <button key={c.key} onClick={() => setCategory(c.key)} className={cn('shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all', category === c.key ? 'bg-primary/20 border-primary/40 text-primary' : 'border-ink/10 text-ink/50 hover:text-ink')}>
                <Icon className="w-3.5 h-3.5" /> {c.label}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <div className="glass-panel p-10 text-center text-ink/50">
          {search || category !== 'ALL'
            ? 'Ninguna herramienta coincide con la búsqueda.'
            : 'Aún no registras herramientas. Agrega vasos, tazas, jarras, la licuadora… y cuántas deberías tener de cada una.'}
        </div>
      ) : (
        <div className="glass-panel divide-y divide-ink/5">
          {visible.map(t => {
            const Icon = toolCategory(t.category).icon;
            const short = t.idealQuantity - t.quantity;
            const lastLoss = t.movements[0];
            return (
              <div key={t.id} className={cn('flex items-center gap-3 p-3 sm:p-4', short > 0 && t.isActive && 'bg-error/5', !t.isActive && 'opacity-50')}>
                <div className={cn('w-10 h-10 shrink-0 rounded-xl flex items-center justify-center', short > 0 ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary')}>
                  <Icon className="w-5 h-5" />
                </div>
                <button onClick={() => setHistory(t)} className="flex-1 min-w-0 text-left">
                  <p className="text-ink font-medium truncate">{t.name}{!t.isActive && <span className="text-ink/40 font-normal"> · desactivada</span>}</p>
                  <p className="text-ink/40 text-xs font-label mt-0.5 truncate">
                    {formatMoney(t.unitCost)} c/u{t.supplier && ` · ${t.supplier.name}`}
                    {lastLoss && <> · <History className="w-3 h-3 inline -mt-0.5" /> {lossText(lastLoss.reason, lastLoss.quantity)} · {shortDate(lastLoss.createdAt)}</>}
                  </p>
                </button>
                <div className="text-right shrink-0">
                  <p className="font-mono text-ink text-sm"><b>{t.quantity}</b><span className="text-ink/40"> / {t.idealQuantity}</span></p>
                  {short > 0
                    ? <p className="text-error text-[11px] font-label uppercase tracking-wider flex items-center gap-1 justify-end"><ShoppingCart className="w-3 h-3" /> Faltan {short}</p>
                    : <p className="text-secondary text-[11px] font-label uppercase tracking-wider flex items-center gap-1 justify-end"><CheckCircle2 className="w-3 h-3" /> Completo</p>}
                </div>
                <div className="flex shrink-0">
                  {t.isActive && (
                    <button onClick={() => setLosing(t)} disabled={t.quantity === 0} className="p-2 rounded-lg text-ink/50 hover:text-error hover:bg-error/10 disabled:opacity-30 disabled:pointer-events-none" aria-label={`Reportar rotura o pérdida de ${t.name}`} title="Se rompió o se perdió">
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => setForm(t)} className="hidden sm:block p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5" aria-label={`Editar ${t.name}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-ink/40 text-xs -mt-1">
        Lo que falta para completar se agrega a la lista de compras, y al comprarlo cuenta como gasto del día en el corte.
      </p>

      {form && <ToolFormModal tool={form === 'new' ? null : form} suppliers={suppliers} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
      {losing && <LossModal tool={losing} onClose={() => setLosing(null)} onSaved={() => { setLosing(null); reload(); }} />}
      {history && <HistoryModal tool={history} onClose={() => setHistory(null)} onEdit={canManage ? () => { setForm(history); setHistory(null); } : undefined} />}
      {counting && <CountModal tools={active} onClose={() => setCounting(false)} onSaved={() => { setCounting(false); reload(); }} />}
    </div>
  );
}

function ToolFormModal({ tool, suppliers, onClose, onSaved }: { tool: Tool | null; suppliers: SupplierRef[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tool?.name ?? '');
  const [category, setCategory] = useState<ToolCategory>(tool?.category ?? 'TABLEWARE');
  const [quantity, setQuantity] = useState(String(tool?.quantity ?? ''));
  const [ideal, setIdeal] = useState(String(tool?.idealQuantity ?? ''));
  const [unitCost, setUnitCost] = useState(tool ? String(Number(tool.unitCost)) : '');
  const [supplierId, setSupplierId] = useState(tool?.supplierId ? String(tool.supplierId) : '');
  const [notes, setNotes] = useState(tool?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const isInt = (v: string) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0;
  const valid = name.trim() && isInt(quantity) && isInt(ideal) && Number(unitCost || 0) >= 0;

  const save = async () => {
    if (!valid) return;
    const body = {
      name: name.trim(),
      category,
      quantity: Number(quantity),
      idealQuantity: Number(ideal),
      unitCost: Math.round(Number(unitCost || 0) * 100) / 100,
      supplierId: supplierId ? Number(supplierId) : null,
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      if (tool) await api.patch(`/tools/${tool.id}`, body);
      else await api.post('/tools', body);
      toast.success(tool ? 'Cambios guardados' : `${body.name} agregada`);
      onSaved();
    } catch (err) {
      notifyError(err);
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!tool) return;
    if (tool.isActive && !await confirm({
      title: `¿Quitar “${tool.name}”?`,
      message: 'Si ya tiene compras se desactiva y su historial se conserva; si no, se borra.',
      confirmLabel: 'Quitar',
      tone: 'danger',
    })) return;
    try {
      if (tool.isActive) await api.delete(`/tools/${tool.id}`);
      else await api.patch(`/tools/${tool.id}`, { isActive: true });
      onSaved();
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <Modal title={tool ? 'Editar herramienta' : 'Nueva herramienta'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
        <div>
          <label className={labelClass} htmlFor="tool-name">Nombre</label>
          <input id="tool-name" value={name} onChange={e => setName(e.target.value)} placeholder="Vaso de espresso 3 oz" className={inputClass} autoFocus={!tool} />
        </div>
        <div>
          <p className={labelClass}>Categoría</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TOOL_CATEGORIES.map(c => (
              <button key={c.key} type="button" onClick={() => setCategory(c.key)} className={cn('py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all', category === c.key ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-ink/5 border-ink/10 text-ink/50')}>
                <c.icon className="w-3.5 h-3.5" /> {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="tool-qty">Tienes</label>
            <input id="tool-qty" type="number" inputMode="numeric" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="tool-ideal">Deberías tener</label>
            <input id="tool-ideal" type="number" inputMode="numeric" min="0" step="1" value={ideal} onChange={e => setIdeal(e.target.value)} placeholder="0" className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="tool-cost">Costo por pieza</label>
            <input id="tool-cost" type="number" inputMode="decimal" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="$0.00" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="tool-store">Tienda</label>
            <select id="tool-store" value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputClass}>
              <option value="">Sin tienda</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="tool-notes">Notas (opcional)</label>
          <input id="tool-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Modelo, color, dónde se guarda…" className={inputClass} />
        </div>
        {tool && Number(quantity) !== tool.quantity && isInt(quantity) && (
          <p className="text-ink/50 text-xs -mt-2">Se guardará como conteo: antes había {tool.quantity}.</p>
        )}
        <button type="submit" disabled={!valid || saving} className={saveButton}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Guardar</>}
        </button>
        {tool && (
          <button type="button" onClick={toggleActive} className={cn('w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-sm', tool.isActive ? 'border-error/30 text-error hover:bg-error/10' : 'border-secondary/30 text-secondary hover:bg-secondary/10')}>
            {tool.isActive ? <><Trash2 className="w-4 h-4" /> Quitar herramienta</> : <><Power className="w-4 h-4" /> Reactivar</>}
          </button>
        )}
      </form>
    </Modal>
  );
}

function LossModal({ tool, onClose, onSaved }: { tool: Tool; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState<LossReason>('BROKEN');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const qty = Number(quantity);
  const valid = Number.isInteger(qty) && qty > 0 && qty <= tool.quantity;
  const left = tool.quantity - (valid ? qty : 0);
  const short = tool.idealQuantity - left;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await api.post(`/tools/${tool.id}/loss`, { quantity: qty, reason, notes: notes.trim() || undefined });
      toast.success(short > 0 ? `${lossText(reason, qty)}. Se agregó a la lista de compras.` : lossText(reason, qty));
      onSaved();
    } catch (err) {
      notifyError(err);
      setSaving(false);
    }
  };

  return (
    <Modal title="Reportar rotura o pérdida" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
        <p className="text-primary font-medium -mt-2">{tool.name} <span className="text-ink/40 text-sm">({tool.quantity} en uso)</span></p>
        <div className="flex gap-2">
          {LOSS_REASONS.map(r => (
            <button key={r.key} type="button" onClick={() => setReason(r.key)} className={cn('flex-1 py-2.5 px-1 rounded-lg text-xs font-label uppercase tracking-wider border transition-all', reason === r.key ? 'bg-error/15 border-error/40 text-error' : 'bg-ink/5 border-ink/10 text-ink/50')}>
              {r.label}
            </button>
          ))}
        </div>
        <div>
          <label className={labelClass} htmlFor="loss-qty">¿Cuántos?</label>
          <input id="loss-qty" type="number" inputMode="numeric" min="1" max={tool.quantity} step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className={labelClass} htmlFor="loss-notes">Nota (opcional)</label>
          <input id="loss-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Se cayó al lavar…" className={inputClass} />
        </div>
        <div className="bg-ink/5 rounded-xl p-3 border border-ink/10 text-sm text-ink/70 flex flex-col gap-1">
          {valid ? (
            <>
              <p>Quedan <b className="text-ink">{left}</b> de {tool.idealQuantity}. Pérdida: <b className="text-error">{formatMoney(qty * Number(tool.unitCost))}</b></p>
              {short > 0 && <p className="flex items-center gap-1.5 text-primary"><ShoppingCart className="w-4 h-4 shrink-0" /> Faltarán {short}: se agregan a la lista de compras</p>}
            </>
          ) : (
            <p>Escribe cuántos, hasta {tool.quantity}.</p>
          )}
        </div>
        <button type="submit" disabled={!valid || saving} className="w-full py-3 rounded-xl bg-error/15 border border-error/40 text-error font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Dar de baja {valid ? qty : ''}</>}
        </button>
      </form>
    </Modal>
  );
}

interface Movement { id: number; type: 'IN' | 'OUT' | 'ADJUSTMENT'; reason: ToolMovementReason; quantity: number; cost: string | null; notes: string | null; createdAt: string; user: { name: string } }

function HistoryModal({ tool, onClose, onEdit }: { tool: Tool; onClose: () => void; onEdit?: () => void }) {
  const [movements, setMovements] = useState<Movement[] | null>(null);

  useEffect(() => {
    api.get(`/tools/${tool.id}/movements`)
      .then(res => setMovements(unwrap<Movement[]>(res)))
      .catch(err => { notifyError(err); setMovements([]); });
  }, [tool.id]);

  return (
    <Modal title={tool.name} onClose={onClose}>
      <p className="text-ink/50 text-sm -mt-3 mb-4">{tool.quantity} de {tool.idealQuantity} · {formatMoney(tool.unitCost)} c/u{tool.supplier && ` · ${tool.supplier.name}`}</p>
      {tool.notes && <p className="text-ink/60 text-sm mb-4">{tool.notes}</p>}
      {onEdit && (
        <button onClick={onEdit} className="w-full mb-4 py-2.5 rounded-xl border border-ink/10 text-ink/70 hover:text-primary hover:border-primary/30 flex items-center justify-center gap-2 text-sm">
          <Pencil className="w-4 h-4" /> Editar herramienta
        </button>
      )}
      {!movements ? (
        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : movements.length === 0 ? (
        <p className="text-ink/40 text-sm text-center py-6">Sin movimientos todavía.</p>
      ) : (
        <div className="divide-y divide-ink/5">
          {movements.map(m => (
            <div key={m.id} className="py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', m.type === 'OUT' ? 'text-error' : m.type === 'IN' ? 'text-secondary' : 'text-ink')}>{lossText(m.reason, m.quantity)}</p>
                <p className="text-ink/40 text-xs">{new Date(m.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })} · {m.user.name}{m.notes && ` · ${m.notes}`}</p>
              </div>
              {m.cost && <p className="text-sm text-ink/70 shrink-0">{formatMoney(m.cost)}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function CountModal({ tools, onClose, onSaved }: { tools: Tool[]; onClose: () => void; onSaved: () => void }) {
  const [counts, setCounts] = useState<Record<number, string>>(() => Object.fromEntries(tools.map(t => [t.id, String(t.quantity)])));
  const [saving, setSaving] = useState(false);
  const changed = tools.filter(t => counts[t.id] !== '' && Number(counts[t.id]) !== t.quantity);
  const valid = tools.every(t => counts[t.id] !== '' && Number.isInteger(Number(counts[t.id])) && Number(counts[t.id]) >= 0);

  const save = async () => {
    if (!valid || changed.length === 0) return;
    setSaving(true);
    try {
      await api.post('/tools/count', { items: changed.map(t => ({ id: t.id, quantity: Number(counts[t.id]) })) });
      toast.success(`Conteo guardado: ${changed.length} ${changed.length === 1 ? 'cambio' : 'cambios'}`);
      onSaved();
    } catch (err) {
      notifyError(err);
      setSaving(false);
    }
  };

  return (
    <Modal title="Conteo de herramientas" onClose={onClose} wide>
      <p className="text-ink/60 text-sm -mt-2 mb-4">Cuenta lo que hay de verdad y corrige los números. Solo se guardan los que cambian.</p>
      <div className="divide-y divide-ink/5 mb-4">
        {tools.map(t => (
          <div key={t.id} className="py-2 flex items-center gap-3">
            <p className="flex-1 min-w-0 text-ink text-sm truncate">{t.name}</p>
            <span className="text-ink/40 text-xs shrink-0">de {t.idealQuantity}</span>
            <input
              type="number" inputMode="numeric" min="0" step="1"
              value={counts[t.id]}
              onChange={e => setCounts(c => ({ ...c, [t.id]: e.target.value }))}
              aria-label={`Piezas de ${t.name}`}
              className={cn('w-20 px-3 py-2 bg-ink/5 border rounded-lg text-ink font-mono text-center focus:outline-none', Number(counts[t.id]) !== t.quantity ? 'border-primary/50' : 'border-ink/10')}
            />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={!valid || changed.length === 0 || saving} className={saveButton}>
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Guardar conteo{changed.length > 0 && ` (${changed.length})`}</>}
      </button>
    </Modal>
  );
}
