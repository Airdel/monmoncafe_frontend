// Sound options stored with the theme (src/store/theme.ts); playback is in src/lib/sounds.ts.

export type SoundLevel = 'off' | 'important' | 'all';
export type SoundStyle = 'cafe' | 'burbujas';

export const SOUND_LEVELS: { id: SoundLevel; name: string }[] = [
  { id: 'off', name: 'Apagados' },
  { id: 'important', name: 'Solo importantes' },
  { id: 'all', name: 'Todos' },
];

export const SOUND_STYLES: { id: SoundStyle; name: string }[] = [
  { id: 'cafe', name: 'Cafetería' },
  { id: 'burbujas', name: 'Burbujas' },
];

export const isSoundLevel = (v: unknown): v is SoundLevel => v === 'off' || v === 'important' || v === 'all';
export const isSoundStyle = (v: unknown): v is SoundStyle => v === 'cafe' || v === 'burbujas';
