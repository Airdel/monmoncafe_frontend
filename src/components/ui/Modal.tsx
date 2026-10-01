import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import * as motion from 'motion/react-client';

/** Centered dialog on tablet/desktop, bottom sheet on phones. */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-shade/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass-panel bg-raised p-5 sm:p-6 w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[90dvh] overflow-y-auto rounded-b-none sm:rounded-b-2xl border-t-2 border-t-primary`}
      >
        <div className="flex justify-between items-center gap-4 mb-5 sm:mb-6">
          <h3 className="font-headline text-xl font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="-m-2 p-2 text-ink/40 hover:text-ink" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        {children}
        <div className="sm:hidden pb-safe" />
      </motion.div>
    </div>
  );
}
