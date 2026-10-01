import { isAxiosError } from 'axios';

/** Extracts a readable message from an API (NestJS) or generic error. */
export function getErrorMessage(err: unknown, fallback = 'Error inesperado'): string {
  if (isAxiosError(err)) {
    const message = err.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
