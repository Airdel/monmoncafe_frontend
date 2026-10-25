import { resolveSeason } from './seasons';
import { useThemeStore } from '../store/theme';
import type { SoundStyle } from './soundSettings';

// Short sounds for key moments, synthesized with Web Audio: no audio files,
// so they are original, weigh nothing and work offline (web and Android).
// Level, style and volume are per device, in Temas.

export type SoundId = 'sale' | 'later' | 'newOrder' | 'ready' | 'error' | 'closing' | 'add' | 'remove';

/** Only played with the "Todos" level: they happen many times per order. */
const MINOR: ReadonlySet<SoundId> = new Set(['add', 'remove']);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // Perceived loudness grows faster than the slider; this keeps 70% comfortable
    master!.gain.value = (useThemeStore.getState().soundVolume / 100) ** 1.5;
    return { ctx, out: master! };
  } catch {
    return null;
  }
}

interface NoteOptions {
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  glideTo?: number;
}

function note(freq: number, at: number, { dur = 0.4, type = 'sine', gain = 0.3, attack = 0.005, glideTo }: NoteOptions = {}) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  const env = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + 0.07);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Small bell or ceramic cup: a few inharmonic partials that fade at different speeds. */
function bell(freq: number, at = 0, gain = 0.25, dur = 1.1) {
  for (const [ratio, g, d] of [[1, 1, 1], [2.76, 0.35, 0.55], [5.4, 0.15, 0.3], [8.93, 0.06, 0.18]]) {
    note(freq * ratio, at, { gain: gain * g, dur: dur * d });
  }
}

function pop(from: number, to: number, at = 0, gain = 0.3) {
  note(from, at, { glideTo: to, dur: 0.14, gain, attack: 0.003 });
}

/** Sleigh bells: three bursts of filtered noise. */
function jingle(at = 0) {
  const a = audio();
  if (!a) return;
  for (let i = 0; i < 3; i++) {
    const t = a.ctx.currentTime + at + i * 0.05;
    const buffer = a.ctx.createBuffer(1, Math.floor(a.ctx.sampleRate * 0.25), a.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (a.ctx.sampleRate * 0.05));
    const source = a.ctx.createBufferSource();
    const filter = a.ctx.createBiquadFilter();
    const env = a.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 6500 + i * 900;
    filter.Q.value = 6;
    env.gain.value = 0.5;
    source.connect(filter).connect(env).connect(a.out);
    source.start(t);
  }
}

const SOUNDS: Record<SoundStyle, Record<SoundId | 'xmas', () => void>> = {
  cafe: {
    add: () => bell(1760, 0, 0.12, 0.35),
    remove: () => bell(1318, 0, 0.1, 0.3),
    sale: () => { bell(1047, 0, 0.2); bell(1319, 0.09, 0.2); bell(1568, 0.18, 0.24, 1.4); },
    later: () => { bell(880, 0, 0.18, 0.8); bell(1175, 0.12, 0.18, 0.9); },
    newOrder: () => { bell(2093, 0, 0.3, 1.6); bell(2093, 0.32, 0.22, 1.6); },
    ready: () => { bell(1319, 0, 0.2, 0.7); bell(1760, 0.13, 0.24, 1.2); },
    error: () => { note(392, 0, { type: 'triangle', gain: 0.22, dur: 0.18 }); note(294, 0.16, { type: 'triangle', gain: 0.22, dur: 0.3 }); },
    closing: () => [1047, 1319, 1568, 2093].forEach((f, i) => bell(f, i * 0.11, 0.18, i === 3 ? 1.6 : 0.7)),
    xmas: () => { jingle(0); bell(1568, 0.05, 0.16, 1.2); jingle(0.22); bell(2093, 0.27, 0.18, 1.4); },
  },
  burbujas: {
    add: () => pop(500, 1000),
    remove: () => pop(800, 420),
    sale: () => { pop(500, 900); pop(650, 1150, 0.09); pop(800, 1500, 0.18, 0.34); },
    later: () => { pop(450, 750); pop(550, 950, 0.12); },
    newOrder: () => { pop(700, 1300, 0, 0.36); pop(700, 1300, 0.18, 0.36); pop(900, 1700, 0.36, 0.34); },
    ready: () => { pop(600, 1000); pop(800, 1400, 0.12, 0.34); },
    error: () => { pop(420, 300); pop(330, 220, 0.15); },
    closing: () => [500, 620, 760, 1000].forEach((f, i) => pop(f, f * 1.8, i * 0.1)),
    xmas: () => { jingle(0); pop(700, 1400, 0.05); jingle(0.22); pop(900, 1800, 0.27); },
  },
};

/** Plays a sound if this device's level allows it. */
export function playSound(id: SoundId) {
  const { soundLevel, soundStyle, decor } = useThemeStore.getState();
  if (soundLevel === 'off' || (soundLevel === 'important' && MINOR.has(id))) return;
  // Sleigh bells on sales while the Christmas decoration is showing
  const variant = id === 'sale' && resolveSeason(decor) === 'navidad' ? 'xmas' : id;
  SOUNDS[soundStyle][variant]();
}

/** Plays a sound regardless of the level, to preview a style or volume in Temas. */
export function previewSound(style: SoundStyle) {
  SOUNDS[style].sale();
}

/**
 * Browsers only let audio start after a tap. Waking the audio on every tap
 * means an order arriving later at Comandas can ring without one.
 */
export function initSounds() {
  document.addEventListener('pointerdown', () => {
    if (useThemeStore.getState().soundLevel !== 'off') audio();
  }, { passive: true });
}
