import { getApiUrl } from './server';

/**
 * Product photos are stored by the API as a path relative to its base URL
 * (e.g. "uploads/products/3-….jpg"), so the same record works from the web
 * app on GitHub Pages and from the phone app pointing at another server.
 */
export function productImageSrc(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  return `${getApiUrl()}/${imageUrl.replace(/^\/+/, '')}`;
}

/**
 * Shrinks a photo on the device before uploading it: a phone picture of
 * several MB becomes a ~30-60 KB WebP. 600 px covers the biggest POS tile on
 * a sharp screen; it keeps the offline cache and the server's backups small.
 * Browsers that can't make WebP (old Safari) send a JPEG instead.
 */
export async function resizeImage(file: File, maxSize = 600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen');
    // A white background keeps transparent PNG logos readable
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
    // toBlob silently falls back to PNG when the format isn't supported
    const webp = await encode('image/webp');
    if (webp?.type === 'image/webp') return webp;
    const jpeg = await encode('image/jpeg');
    if (!jpeg) throw new Error('No se pudo procesar la imagen');
    return jpeg;
  } finally {
    bitmap.close();
  }
}
