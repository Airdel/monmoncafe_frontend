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
 * several MB becomes a ~100 KB JPEG that loads fast on the POS.
 */
export async function resizeImage(file: File, maxSize = 800, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen');
    // JPEG has no transparency; a white background keeps PNG logos readable
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', quality)
    );
  } finally {
    bitmap.close();
  }
}
