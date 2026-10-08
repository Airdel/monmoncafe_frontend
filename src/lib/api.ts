import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { getApiUrl } from './server';

export const api = axios.create();

api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiUrl();
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // A 401 from /auth/login (wrong credentials) or with no session to renew
    // is a real error for the caller, not an expired access token.
    const isAuthEndpoint = /\/auth\/(login|refresh)$/.test(originalRequest?.url ?? '');
    const auth = useAuthStore.getState();
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint &&
      auth.refreshToken
    ) {
      originalRequest._retry = true;
      try {
        // Use native fetch to avoid interceptor loop
        const res = await fetch(`${getApiUrl()}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.refreshToken}`
          }
        });
        
        if (!res.ok) throw new Error('Refresh failed');
        
        // Unwrap the TransformInterceptor envelope ({ success, data })
        const body = await res.json();
        const data = body?.data ?? body;
        auth.setAuth(auth.user!, data.accessToken, data.refreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(new Error('Tu sesión expiró, inicia sesión de nuevo'));
      }
    }
    if (error.response?.status === 401 && !isAuthEndpoint && auth.accessToken) {
      auth.logout();
    }
    return Promise.reject(error);
  }
);
