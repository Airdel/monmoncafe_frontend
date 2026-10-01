import type { AxiosResponse } from 'axios';

/** The backend's TransformInterceptor wraps every payload as `{ success, data, timestamp }`. */
export function unwrap<T>(res: AxiosResponse): T {
  const body = res.data;
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}
