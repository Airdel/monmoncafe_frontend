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
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const auth = useAuthStore.getState();
        if (!auth.refreshToken) throw new Error('No refresh token');
        
        // Use native fetch to avoid interceptor loop
        const res = await fetch(`${getApiUrl()}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.refreshToken}`
          }
        });
        
        if (!res.ok) throw new Error('Refresh failed');
        
        const data = await res.json();
        auth.setAuth(auth.user!, data.accessToken, data.refreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (err) {
        useAuthStore.getState().logout();
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);
