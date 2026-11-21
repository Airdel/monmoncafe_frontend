// Sound and motion options stored with the theme (src/store/theme.ts); playback is in src/lib/sounds.ts.

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

/** How the drinks on the POS tiles move (see .drink-art in index.css). */
export type TileMotion = 'always' | 'tap' | 'still';

export const TILE_MOTIONS: { id: TileMotion; name: string }[] = [
  { id: 'always', name: 'Siempre' },
  { id: 'tap', name: 'Solo al tocar' },
  { id: 'still', name: 'Quietas' },
];

export const isTileMotion = (v: unknown): v is TileMotion => v === 'always' || v === 'tap' || v === 'still';
