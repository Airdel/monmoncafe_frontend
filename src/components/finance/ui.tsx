import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import * as motion from 'motion/react-client';

type Tone = 'primary' | 'secondary' | 'error' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  error: 'text-error',
  neutral: 'text-white',
};

export function StatCard({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className="glass-panel p-5">
      <p className="text-white/50 text-xs font-label uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-headline text-2xl font-bold ${TONE_CLASSES[tone]}`}>{value}</p>
      {hint && <p className="text-white/40 text-xs font-label mt-1">{hint}</p>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className={`glass-panel p-6 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto border-t-2 border-t-primary`}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
