import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'api-url';
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// On the phone, "localhost" is the phone itself, so the backend URL (the IP of
// the PC running it) has to be set from the login screen and is remembered.
export function getApiUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

export function setApiUrl(url: string) {
  const normalized = normalizeApiUrl(url);
  if (normalized) localStorage.setItem(STORAGE_KEY, normalized);
  else localStorage.removeItem(STORAGE_KEY);
}

// Accepts "192.168.1.50", "192.168.1.50:3001" or a full URL and returns
// e.g. "http://192.168.1.50:3001/api".
export function normalizeApiUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  const parsed = new URL(url);
  if (!parsed.port && parsed.protocol === 'http:') parsed.port = '3001';
  if (parsed.pathname === '/' || parsed.pathname === '') parsed.pathname = '/api';
  return parsed.toString().replace(/\/+$/, '');
}

export function hasCustomApiUrl(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export const isNativeApp = Capacitor.isNativePlatform();
