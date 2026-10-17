// Seasonal decoration drawn on top of whichever color theme is active.
// Artwork lives in src/components/ui/SeasonalDecor.tsx.
export const SEASONS = [
  { id: 'otono', name: 'Otoño', description: 'Hojas que caen', greeting: '¡Feliz otoño!' },
  { id: 'muertos', name: 'Día de Muertos', description: 'Papel picado y cempasúchil', greeting: '¡Feliz Día de Muertos!' },
  { id: 'navidad', name: 'Navidad', description: 'Nieve, esferas y lucecitas', greeting: '¡Felices fiestas!' },
] as const;

export type SeasonId = (typeof SEASONS)[number]['id'];

/** 'auto' follows the calendar below; 'off' shows nothing; a season id forces it. */
export type DecorMode = 'auto' | 'off' | SeasonId;

export const DEFAULT_DECOR: DecorMode = 'auto';

/**
 * Calendar used by 'auto', as [month, day] inclusive ranges (month 1-12).
 * Checked in order, so Día de Muertos wins over the autumn range around it.
 */
const CALENDAR: { season: SeasonId; from: [number, number]; to: [number, number] }[] = [
  { season: 'muertos', from: [10, 25], to: [11, 2] },
  { season: 'otono', from: [10, 1], to: [11, 30] },
  { season: 'navidad', from: [12, 1], to: [12, 31] },
  { season: 'navidad', from: [1, 1], to: [1, 6] }, // hasta Día de Reyes
];

export function seasonForDate(date: Date): SeasonId | null {
  const key = (date.getMonth() + 1) * 100 + date.getDate();
  const hit = CALENDAR.find(({ from, to }) => key >= from[0] * 100 + from[1] && key <= to[0] * 100 + to[1]);
  return hit?.season ?? null;
}

export function resolveSeason(mode: DecorMode, date = new Date()): SeasonId | null {
  if (mode === 'off') return null;
  if (mode === 'auto') return seasonForDate(date);
  return mode;
}

export function getSeason(id: SeasonId) {
  return SEASONS.find(s => s.id === id)!;
}

export function isDecorMode(value: unknown): value is DecorMode {
  return value === 'auto' || value === 'off' || SEASONS.some(s => s.id === value);
}
