import { useState } from 'react';
import { Percent, DollarSign, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { DISCOUNT_REASONS, describeDiscount, discountAmount, orderTotals, type Discount, type OrderDiscounts } from '../../lib/discounts';

export interface DiscountLine {
  key: string;
  label: string;
  subtotal: number;
}

const TICKET = '__ticket';

const fieldClass = 'w-full bg-ink/5 border border-ink/10 rounded-xl px-4 py-3 text-ink placeholder-ink/30 focus:outline-none focus:border-primary/50 transition-all';
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';

/**
 * Adds discounts to an order, to one product (spilled coffee) or the whole
 * ticket, as pesos or a percentage. Every discount needs a reason.
 */
export function DiscountDialog({ lines, value, onChange, onClose }: {
  lines: DiscountLine[];
  value: OrderDiscounts;
  onChange: (next: OrderDiscounts) => void;
  onClose: () => void;
}) {
  // A single product starts on that product; otherwise on the whole order
  const [target, setTarget] = useState(lines.length === 1 ? lines[0].key : TICKET);
  const current = target === TICKET ? value.ticket : value.lines[target];
  const [mode, setMode] = useState<Discount['mode']>(current?.mode ?? 'amount');
  const [amount, setAmount] = useState(current ? String(current.value) : '');
  const [reason, setReason] = useState(value.reason);

  const totals = orderTotals(lines, value);
  const base = target === TICKET
    ? totals.subtotal - totals.totalDiscount + totals.ticketDiscount
    : lines.find(l => l.key === target)?.subtotal ?? 0;
  const parsed = Number(amount);
  const invalid = !(parsed > 0) || (mode === 'percent' ? parsed > 100 : parsed > base);
  const preview = invalid ? 0 : discountAmount(base, { mode, value: parsed });

  const pickTarget = (key: string) => {
    setTarget(key);
    const d = key === TICKET ? value.ticket : value.lines[key];
    setMode(d?.mode ?? 'amount');
    setAmount(d ? String(d.value) : '');
  };

  const apply = () => {
    const discount = { mode, value: Math.round(parsed * 100) / 100 };
    onChange(target === TICKET
      ? { ...value, ticket: discount, reason: reason.trim() }
      : { ...value, lines: { ...value.lines, [target]: discount }, reason: reason.trim() });
    onClose();
  };

  const remove = (key: string) => {
    if (key === TICKET) return onChange({ ...value, ticket: null });
    const rest = { ...value.lines };
    delete rest[key];
    onChange({ ...value, lines: rest });
  };

  const applied = [
    ...lines.filter(l => value.lines[l.key]).map(l => ({ key: l.key, label: l.label, d: value.lines[l.key] })),
    ...(value.ticket ? [{ key: TICKET, label: 'Toda la orden', d: value.ticket }] : []),
  ];

  return (
    <Modal title="Descuento" onClose={onClose}>
      <div className="space-y-5">
        {applied.length > 0 && (
          <div>
            <p className={labelClass}>Ya aplicados</p>
            <div className="flex flex-wrap gap-2">
              {applied.map(a => (
                <span key={a.key} className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-secondary/15 text-secondary text-sm">
                  {a.label} · −{describeDiscount(a.d, formatMoney)}
                  <button onClick={() => remove(a.key)} className="p-1 rounded-full hover:bg-secondary/20" aria-label={`Quitar descuento de ${a.label}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="discount-target">¿A qué se aplica?</label>
          <select id="discount-target" value={target} onChange={e => pickTarget(e.target.value)} className={fieldClass}>
            <option value={TICKET}>Toda la orden</option>
            {lines.map(l => <option key={l.key} value={l.key}>{l.label} · {formatMoney(l.subtotal)}</option>)}
          </select>
        </div>

        <div>
          <p className={labelClass}>Descuento</p>
          <div className="flex gap-2">
            <div className="flex rounded-xl border border-ink/10 overflow-hidden shrink-0">
              {([['amount', DollarSign, 'En pesos'], ['percent', Percent, 'En porcentaje']] as const).map(([m, Icon, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  aria-label={label}
                  className={cn('px-4 py-3 transition-colors', mode === m ? 'bg-primary/15 text-primary' : 'bg-ink/5 text-ink/50 hover:text-ink')}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={mode === 'percent' ? '10' : '15.00'}
              aria-label="Cantidad del descuento"
              className={fieldClass}
            />
          </div>
          <p className="text-ink/40 text-xs mt-2">
            {amount && invalid
              ? <span className="text-error">{mode === 'percent' ? 'Entre 1 y 100 %.' : `No puede ser más de ${formatMoney(base)}.`}</span>
              : <>Se descuentan {formatMoney(preview)} de {formatMoney(base)}.</>}
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="discount-reason">Motivo</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {DISCOUNT_REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={cn('px-3 py-1.5 rounded-full text-xs border transition-colors', reason === r ? 'bg-primary/15 border-primary text-primary' : 'bg-ink/5 border-ink/10 text-ink/60 hover:text-ink')}
              >
                {r}
              </button>
            ))}
          </div>
          <input id="discount-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="¿Por qué se descuenta?" className={fieldClass} />
        </div>

        <button
          onClick={apply}
          disabled={invalid || !reason.trim()}
          className="w-full py-4 rounded-xl bg-cta text-on-primary font-bold text-lg disabled:opacity-50"
        >
          {!reason.trim() && !invalid ? 'Escribe el motivo' : `Aplicar −${formatMoney(preview)}`}
        </button>
      </div>
    </Modal>
  );
}
