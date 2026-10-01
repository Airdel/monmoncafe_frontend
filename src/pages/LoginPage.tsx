import { useState } from 'react';
import { AxiosError } from 'axios';
import { Coffee, Lock, Mail, Loader2, Palette, Server } from 'lucide-react';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { getApiUrl, hasCustomApiUrl, isNativeApp, normalizeApiUrl, setApiUrl } from '../lib/server';
import { useAuthStore } from '../store/auth';
import * as motion from 'motion/react-client';

export function LoginPage({ onOpenThemes }: { onOpenThemes: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverUrl, setServerUrl] = useState(getApiUrl);
  const [showServer, setShowServer] = useState(isNativeApp && !hasCustomApiUrl());
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (showServer) {
      try {
        setApiUrl(serverUrl);
        setServerUrl(getApiUrl());
      } catch {
        setError('La dirección del servidor no es válida');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await api.post('/auth/login', { email, password });
      // NestJS TransformInterceptor wraps the response in a 'data' object
      const { user, accessToken, refreshToken } = res.data.data ? res.data.data : res.data;
      setAuth(user, accessToken, refreshToken);
    } catch (err) {
      const noResponse = err instanceof AxiosError && !err.response;
      setError(noResponse
        ? `No se pudo conectar con el servidor (${getApiUrl()})`
        : getErrorMessage(err, 'Credenciales inválidas'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px]" />
      </div>

      <button
        onClick={onOpenThemes}
        className="fixed right-4 top-[calc(1rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] z-20 flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-ink/70 hover:text-primary text-sm font-medium"
      >
        <Palette className="w-4 h-4" /> Temas
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6 sm:p-8 w-full max-w-md relative z-10 border-primary/20"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-ink/5 border border-ink/10 flex items-center justify-center mb-4 glow-primary">
            <Coffee className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">MonMon Caf<span className="text-ink/50">é</span></h1>
          <p className="font-label text-ink/40 text-xs uppercase tracking-widest mt-2">Management OS</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-ink/60 text-xs font-label uppercase tracking-wider mb-2">Correo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl py-3 pl-11 pr-4 text-ink placeholder-ink/20 focus:outline-none focus:border-primary/50 focus:bg-ink/5 transition-all"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-ink/60 text-xs font-label uppercase tracking-wider mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl py-3 pl-11 pr-4 text-ink placeholder-ink/20 focus:outline-none focus:border-primary/50 focus:bg-ink/5 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {showServer ? (
              <div>
                <label className="block text-ink/60 text-xs font-label uppercase tracking-wider mb-2">Servidor</label>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
                  <input
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={serverUrl}
                    onChange={e => setServerUrl(e.target.value)}
                    className="w-full bg-ink/5 border border-ink/10 rounded-xl py-3 pl-11 pr-4 text-ink placeholder-ink/20 focus:outline-none focus:border-primary/50 focus:bg-ink/5 transition-all"
                    placeholder="192.168.1.50"
                  />
                </div>
                <p className="text-ink/30 text-xs mt-2">
                  IP de la computadora donde corre el backend. Se completa como {normalizeApiUrlSafe(serverUrl) || 'http://IP:3001/api'}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowServer(true)}
                className="flex items-center gap-2 text-ink/30 hover:text-ink/60 text-xs transition-colors"
              >
                <Server className="w-3.5 h-3.5" />
                Servidor: {serverUrl}
              </button>
            )}
          </div>

          <button 
            disabled={loading}
            className="w-full py-4 rounded-xl bg-cta text-on-primary font-bold text-sm glow-primary hover:scale-[1.02] transition-transform flex items-center justify-center disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function normalizeApiUrlSafe(input: string): string {
  try {
    return normalizeApiUrl(input);
  } catch {
    return '';
  }
}
