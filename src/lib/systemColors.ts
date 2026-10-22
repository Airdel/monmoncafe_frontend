import { Capacitor, registerPlugin } from '@capacitor/core';
import { isHexColor } from './dynamicColor';

// Native side: android/app/src/main/java/com/monmoncafe/app/SystemColorsPlugin.java
const SystemColors = registerPlugin<{ getSeed(): Promise<{ seed?: string }> }>('SystemColors');

/** The wallpaper's accent color on Android 12+, or null (web, older Android, older APK). */
export async function getWallpaperSeed(): Promise<string | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    const { seed } = await SystemColors.getSeed();
    return isHexColor(seed) ? seed : null;
  } catch {
    return null;
  }
}
