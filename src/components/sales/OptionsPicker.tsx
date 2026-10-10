import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { formatDelta, type ModifierGroup, type ModifierOption } from '../../lib/modifiers';

/** Asks for a product's options (milk, size, extras) before adding it to an order. */
export function OptionsPicker({ title, groups, basePrice, onAdd, onClose }: {
  title: string;
  groups: ModifierGroup[];
  basePrice: number;
  onAdd: (options: ModifierOption[]) => void;
  onClose: () => void;
}) {
  // Required single-choice groups start on their first option
  const [selected, setSelected] = useState<number[]>(
    () => groups.filter(g => g.isRequired && !g.allowMultiple).map(g => g.options[0].id),
  );

  const toggleOption = (group: ModifierGroup, optionId: number) => {
    setSelected(prev => {
      const isOn = prev.includes(optionId);
      const groupIds = new Set(group.options.map(o => o.id));
      if (group.allowMultiple) return isOn ? prev.filter(id => id !== optionId) : [...prev, optionId];
      // Required groups keep their choice; optional ones can be cleared
      if (isOn) return group.isRequired ? prev : prev.filter(id => id !== optionId);
      return [...prev.filter(id => !groupIds.has(id)), optionId];
    });
  };

  const picked = groups.flatMap(g => g.options.filter(o => selected.includes(o.id)));
  const missingGroup = groups.find(g => g.isRequired && !g.options.some(o => selected.includes(o.id)));
  const price = basePrice + picked.reduce((sum, o) => sum + Number(o.priceDelta), 0);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-5">
        {groups.map(group => (
          <div key={group.id}>
            <p className="text-ink/50 text-xs font-label uppercase tracking-widest mb-2">
              {group.name}
              <span className="ml-2 normal-case tracking-normal text-ink/30">
                {group.isRequired ? 'elige una' : group.allowMultiple ? 'opcional, varias' : 'opcional'}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map(option => {
                const on = selected.includes(option.id);
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
          onClick={() => { onAdd(picked); onClose(); }}
          disabled={!!missingGroup}
          className="w-full py-4 rounded-xl bg-cta text-on-primary font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {missingGroup ? `Elige ${missingGroup.name.toLowerCase()}` : <>Agregar · {formatMoney(price)}</>}
        </button>
      </div>
    </Modal>
  );
}
