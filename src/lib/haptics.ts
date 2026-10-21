import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { useThemeStore } from '../store/theme';

// Light vibration on key moments. Native on the Android app; on the web only
// Chrome for Android vibrates, everything else ignores it.

const enabled = () => useThemeStore.getState().haptics;
const native = Capacitor.isNativePlatform();

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported
  }
}

export const haptic = {
  /** Adding a product, changing a quantity, switching sections. */
  tap() {
    if (!enabled()) return;
    if (native) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else vibrate(8);
  },
  /** Sale recorded or anything else that went well. */
  success() {
    if (!enabled()) return;
    if (native) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else vibrate([12, 60, 12]);
  },
  error() {
    if (!enabled()) return;
    if (native) Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    else vibrate([30, 50, 30]);
  },
};
