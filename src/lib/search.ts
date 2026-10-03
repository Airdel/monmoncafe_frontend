/** Lowercase without accents, so "cafe" finds "Café". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** True when every word of the query appears in any of the fields. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText(fields.filter(Boolean).join(' '));
  return words.every(word => haystack.includes(word));
}
