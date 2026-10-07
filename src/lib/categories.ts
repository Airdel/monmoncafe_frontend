/** POS category as returned by GET /products/categories, in bar order. */
export interface ProductCategory {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  _count?: { products: number };
}

/**
 * The emoji to show next to a category name. Categories created by the old seed
 * stored icon-library names like "cafe-outline", which are not shown.
 */
export function categoryEmoji(icon: string | null | undefined): string | null {
  if (!icon || /^[a-z0-9-]+$/i.test(icon)) return null;
  return icon;
}
