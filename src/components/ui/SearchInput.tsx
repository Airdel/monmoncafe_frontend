import { Search, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export function SearchInput({ value, onChange, placeholder = 'Buscar...', className }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-ink/5 border border-ink/10 rounded-xl text-ink placeholder-ink/30 focus:outline-none focus:border-primary/50 focus:bg-ink/10 transition-all [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink/40 hover:text-ink" aria-label="Borrar búsqueda">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
