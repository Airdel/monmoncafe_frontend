import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Info, X, XCircle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as motion from 'motion/react-client';
import { answerConfirm, dismissToast, useDialogStore, type ToastKind } from '../../lib/dialogs';

const TOAST_STYLE: Record<ToastKind, { icon: typeof Info; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-secondary border-l-secondary' },
  error: { icon: XCircle, color: 'text-error border-l-error' },
  info: { icon: Info, color: 'text-primary border-l-primary' },
};

/** Renders the confirm dialogs and toasts requested through src/lib/dialogs.ts. Mount once. */
export function DialogHost() {
  return (
    <>
      <ConfirmDialog />
      <Toasts />
    </>
  );
}

function ConfirmDialog() {
  const current = useDialogStore(s => s.confirmQueue[0]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answerConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  const danger = current?.tone === 'danger';
  const Icon = danger ? AlertTriangle : CircleHelp;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key="confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-shade/50 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => answerConfirm(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={e => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={current.message ? 'confirm-message' : undefined}
            className={`glass-panel bg-raised p-5 sm:p-6 w-full sm:max-w-sm rounded-b-none sm:rounded-b-2xl border-t-2 ${danger ? 'border-t-error' : 'border-t-primary'}`}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${danger ? 'bg-error/15 text-error' : 'bg-primary/15 text-primary'}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 id="confirm-title" className="font-headline text-lg font-bold text-ink">{current.title}</h3>
              {current.message && (
                <p id="confirm-message" className="text-ink/60 text-sm mt-2 whitespace-pre-line">{current.message}</p>
              )}
            </div>

            {current.details && current.details.length > 0 && (
              <dl className="mt-4 rounded-xl bg-ink/5 px-4 py-3 space-y-1.5 text-sm">
                {current.details.map(d => (
                  <div key={d.label} className="flex justify-between gap-4">
                    <dt className="text-ink/60">{d.label}</dt>
                    <dd className="font-mono font-semibold text-ink">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5">
              <button
                onClick={() => answerConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-ink/10 outline-none focus-visible:ring-2 focus-visible:ring-ink/30 text-ink/70 hover:text-ink hover:bg-ink/5 font-semibold text-sm transition-colors"
              >
                {current.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                autoFocus
                onClick={() => answerConfirm(true)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm outline-none focus-visible:ring-2 focus-visible:ring-ink/30 active:scale-95 transition-transform ${danger ? 'bg-error text-canvas' : 'bg-cta text-on-primary glow-primary-soft'}`}
              >
                {current.confirmLabel ?? 'Aceptar'}
              </button>
            </div>
            <div className="sm:hidden pb-safe" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Toasts() {
  const toasts = useDialogStore(s => s.toasts);

  return (
    <div className="fixed inset-x-0 top-0 z-[70] pt-safe pointer-events-none flex flex-col items-center gap-2 px-3 sm:items-end sm:px-6">
      <div className="h-2 sm:h-4" />
      <AnimatePresence initial={false}>
        {toasts.map(t => {
          const { icon: Icon, color } = TOAST_STYLE[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto glass-panel bg-raised w-full max-w-sm border-l-4 ${color} flex items-start gap-3 p-3 pr-2`}
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {t.title && <p className="font-headline font-bold text-sm text-ink">{t.title}</p>}
                <p className="text-sm text-ink/70 break-words whitespace-pre-line">{t.message}</p>
              </div>
              <button onClick={() => dismissToast(t.id)} className="-m-1 p-1.5 text-ink/40 hover:text-ink" aria-label="Cerrar aviso">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
