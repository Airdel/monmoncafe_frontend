import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Android back gesture: closes the top-most sheet or dialog first, then goes
// back in history, and only leaves the app from the first screen.

const handlers: (() => void)[] = [];

/** While `active`, the back gesture calls `onBack` instead of navigating. */
export function useBackHandler(active: boolean, onBack: () => void) {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    const handler = () => latest.current();
    handlers.push(handler);
    return () => {
      const i = handlers.lastIndexOf(handler);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, [active]);
}

export function initBackButton() {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener('backButton', ({ canGoBack }) => {
    const top = handlers[handlers.length - 1];
    if (top) top();
    else if (canGoBack) window.history.back();
    else App.exitApp();
  }).catch(() => {});
}
