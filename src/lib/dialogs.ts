import { create } from 'zustand';
import { getErrorMessage } from './errors';

// In-app replacements for window.alert/confirm, styled with the active theme.
// Call them from anywhere (no hook needed); <DialogHost /> in App renders them.

export type ConfirmTone = 'primary' | 'danger';

export interface ConfirmOptions {
  title: string;
  /** Short explanation under the title. Line breaks are kept. */
  message?: string;
  /** Optional label/value rows, e.g. totals before closing the day. */
  details?: { label: string; value: string }[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' paints the confirm button red (deactivate, delete, reopen…). */
  tone?: ConfirmTone;
}

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

interface DialogState {
  confirmQueue: PendingConfirm[];
  toasts: Toast[];
}

export const useDialogStore = create<DialogState>(() => ({ confirmQueue: [], toasts: [] }));

/** Asks a yes/no question. Resolves true only when the user presses the confirm button. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    useDialogStore.setState(s => ({ confirmQueue: [...s.confirmQueue, { ...options, resolve }] }));
  });
}

/** Closes the confirm dialog on screen with the given answer. */
export function answerConfirm(ok: boolean) {
  const [current, ...rest] = useDialogStore.getState().confirmQueue;
  if (!current) return;
  useDialogStore.setState({ confirmQueue: rest });
  current.resolve(ok);
}

let nextToastId = 1;
const DURATION: Record<ToastKind, number> = { success: 3500, info: 4000, error: 7000 };

function show(kind: ToastKind, message: string, title?: string) {
  const id = nextToastId++;
  useDialogStore.setState(s => ({ toasts: [...s.toasts.slice(-3), { id, kind, title, message }] }));
  setTimeout(() => dismissToast(id), DURATION[kind]);
}

export function dismissToast(id: number) {
  useDialogStore.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
}

/** Small non-blocking notices that disappear on their own. */
export const toast = {
  success: (message: string, title?: string) => show('success', message, title),
  info: (message: string, title?: string) => show('info', message, title),
  error: (message: string, title?: string) => show('error', message, title),
};

/** Shows an API/unknown error as a toast. Replaces alert('Error: ' + getErrorMessage(err)). */
export function notifyError(err: unknown, title = 'Algo salió mal') {
  console.error(err);
  show('error', getErrorMessage(err), title);
}
