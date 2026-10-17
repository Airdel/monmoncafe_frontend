import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { SeasonId } from '../../lib/seasons';
import { useActiveSeason, useThemeStore } from '../../store/theme';

/*
 * Seasonal decoration, layered on top of the color theme:
 * - SeasonalBackdrop: falling leaves/petals/snow and a small scene in the corner,
 *   painted behind everything so it only shows in the gaps between panels.
 * - SeasonalGarland: a hanging string (papel picado, lights, leaves) under the header.
 * Nothing here takes clicks. Colors are fixed on purpose (marigold is orange in every theme).
 */

// ---------------------------------------------------------------------------
// Small pieces of artwork (24x24 unless noted)

const MAPLE = 'M12 1 13.6 5.2 16.2 3.8 15.6 8 19.6 6.6 18.2 10.2 22 11.2 18.4 13.6 19.6 16 14.6 15.4 13 18.2 13 23 11 23 11 18.2 9.4 15.4 4.4 16 5.6 13.6 2 11.2 5.8 10.2 4.4 6.6 8.4 8 7.8 3.8 10.4 5.2Z';
const LEAF_COLORS = ['#d9662b', '#e8a33a', '#b8452e', '#c98a2b', '#e07a3c'];

function MapleLeaf({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <path d={MAPLE} fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
      <path d="M12 21V8M12 13l-4-3M12 13l4-3" stroke="#7a3a16" strokeOpacity="0.35" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function MarigoldShape() {
  const petals = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return <circle key={i} cx={12 + Math.cos(a) * 6.5} cy={12 + Math.sin(a) * 6.5} r="4.2" fill="#f7a400" />;
  });
  const inner = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    return <circle key={i} cx={12 + Math.cos(a) * 3.4} cy={12 + Math.sin(a) * 3.4} r="3" fill="#f08c00" />;
  });
  return (
    <g>
      {petals}
      {inner}
      <circle cx="12" cy="12" r="2.4" fill="#cf6a00" />
    </g>
  );
}

function Marigold() {
  return <svg viewBox="0 0 24 24" className="w-full h-full"><MarigoldShape /></svg>;
}

function Petal({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <path d="M12 3c5 4 6 10 0 18C6 13 7 7 12 3Z" fill={color} />
    </svg>
  );
}

function Snowflake() {
  const arms = [0, 60, 120, 180, 240, 300].map(deg => (
    <g key={deg} transform={`rotate(${deg} 12 12)`}>
      <path d="M12 12V2.5M12 6l-2.6-2.4M12 6l2.6-2.4M12 9.4l-1.8-1.6M12 9.4l1.8-1.6" />
    </g>
  ));
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="var(--decor-snow)" strokeWidth="1.6" strokeLinecap="round">
      {arms}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Falling particles

// Fixed layout so it looks the same on every render
const PARTICLES = [
  { left: 4, top: 12, size: 22, duration: 17, delay: 0, spin: 300 },
  { left: 13, top: 64, size: 16, duration: 21, delay: 6, spin: -260 },
  { left: 22, top: 30, size: 26, duration: 19, delay: 12, spin: 380 },
  { left: 31, top: 82, size: 14, duration: 23, delay: 3, spin: -340 },
  { left: 40, top: 46, size: 20, duration: 18, delay: 9, spin: 280 },
  { left: 49, top: 8, size: 15, duration: 24, delay: 15, spin: -300 },
  { left: 58, top: 70, size: 24, duration: 20, delay: 1, spin: 360 },
  { left: 67, top: 24, size: 17, duration: 22, delay: 11, spin: -280 },
  { left: 76, top: 56, size: 21, duration: 18, delay: 5, spin: 320 },
  { left: 85, top: 90, size: 15, duration: 25, delay: 14, spin: -360 },
  { left: 93, top: 38, size: 23, duration: 19, delay: 8, spin: 300 },
  { left: 97, top: 74, size: 14, duration: 22, delay: 17, spin: -320 },
];

function particleArt(season: SeasonId, i: number): ReactNode {
  if (season === 'navidad') return <Snowflake />;
  if (season === 'muertos') return i % 3 === 0 ? <Marigold /> : <Petal color={i % 2 ? '#f7a400' : '#f08c00'} />;
  return <MapleLeaf color={LEAF_COLORS[i % LEAF_COLORS.length]} />;
}

function Particles({ season, moving }: { season: SeasonId; moving: boolean }) {
  return (
    <>
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className={cn('absolute', moving ? 'top-0 decor-fall' : '')}
          style={{
            left: `${p.left}%`,
            top: moving ? undefined : `${p.top}%`,
            width: p.size,
            height: p.size,
            opacity: season === 'navidad' ? 0.85 : 0.75,
            // Negative delay: the screen starts already full, not empty
            animationDuration: `${p.duration}s`,
            animationDelay: `-${p.delay}s`,
            '--decor-spin': `${p.spin}deg`,
          } as CSSProperties}
        >
          <div
            className={cn('w-full h-full', moving && 'decor-sway')}
            style={{ animationDuration: `${3 + (i % 3)}s`, transform: moving ? undefined : `rotate(${p.spin / 3}deg)` }}
          >
            {particleArt(season, i)}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Corner scenes (120x120)

function PumpkinScene() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <g transform="translate(4 70) rotate(-25 12 12) scale(1.5)"><MapleLeafShape color="#b8452e" /></g>
      <g transform="translate(84 74) rotate(30 12 12) scale(1.4)"><MapleLeafShape color="#e8a33a" /></g>
      <path d="M58 46c0-8 3-12 8-14" stroke="#6b4a2b" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M64 40c8-8 18-6 20 0-8 4-14 4-20 0Z" fill="#5c9a4a" />
      <ellipse cx="38" cy="78" rx="22" ry="26" fill="#e67e22" />
      <ellipse cx="82" cy="78" rx="22" ry="26" fill="#e67e22" />
      <ellipse cx="60" cy="78" rx="24" ry="29" fill="#f39c12" />
      <path d="M60 50v56M46 54c-6 14-6 34 0 48M74 54c6 14 6 34 0 48" stroke="#d35400" strokeOpacity="0.35" strokeWidth="2" fill="none" />
      <circle cx="51" cy="78" r="2.6" fill="#4a2c3a" />
      <circle cx="69" cy="78" r="2.6" fill="#4a2c3a" />
      <path d="M55 86q5 4 10 0" stroke="#4a2c3a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="46" cy="84" r="3" fill="#ff8fa3" opacity="0.6" />
      <circle cx="74" cy="84" r="3" fill="#ff8fa3" opacity="0.6" />
    </svg>
  );
}

function MapleLeafShape({ color }: { color: string }) {
  return <path d={MAPLE} fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />;
}

function SkullScene() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <path d="M60 22c-24 0-38 16-38 36 0 12 6 20 14 25v12c0 4 3 7 7 7h34c4 0 7-3 7-7V83c8-5 14-13 14-25 0-20-14-36-38-36Z" fill="#fff8f0" stroke="#4a2c3a" strokeWidth="2.5" />
      <circle cx="45" cy="60" r="10" fill="#ff7eb3" />
      <circle cx="75" cy="60" r="10" fill="#4ecdc4" />
      <circle cx="45" cy="60" r="4.5" fill="#4a2c3a" />
      <circle cx="75" cy="60" r="4.5" fill="#4a2c3a" />
      <path d="M60 70l-4 7h8Z" fill="#4a2c3a" />
      <path d="M46 88h28M52 84v8M60 84v8M68 84v8" stroke="#4a2c3a" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 38q10-8 20 0" stroke="#a66cff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="60" cy="44" r="3" fill="#f7a400" />
      <g transform="translate(18 10) scale(1.3)"><MarigoldShape /></g>
      <g transform="translate(76 6) scale(1.1)"><MarigoldShape /></g>
      <g transform="translate(90 92) scale(1.1)"><MarigoldShape /></g>
    </svg>
  );
}

function TreeScene() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <rect x="53" y="96" width="14" height="16" rx="3" fill="#8b5a3c" />
      <path d="M60 30 92 70H28Z" fill="#2f8f5b" />
      <path d="M60 46 100 98H20Z" fill="#2a7f51" />
      <path d="M60 22 96 68H24Z" fill="#37a066" />
      <path d="M60 10l3.5 7.5 8 .8-6 5.4 1.8 8-7.3-4.2-7.3 4.2 1.8-8-6-5.4 8-.8Z" fill="#f4c542" />
      <path d="M36 62q24 10 50-4M30 86q30 12 62-4" stroke="#f4c542" strokeWidth="2" fill="none" strokeDasharray="2 4" strokeLinecap="round" />
      <circle cx="48" cy="50" r="4" fill="#e74c3c" />
      <circle cx="72" cy="56" r="4" fill="#3498db" />
      <circle cx="56" cy="74" r="4.5" fill="#f4c542" />
      <circle cx="80" cy="82" r="4.5" fill="#e74c3c" />
      <circle cx="38" cy="86" r="4.5" fill="#ff7eb3" />
      <rect x="84" y="100" width="16" height="12" rx="2" fill="#e74c3c" />
      <path d="M92 100v12M84 106h16" stroke="#f4c542" strokeWidth="2" />
    </svg>
  );
}

const SCENES: Record<SeasonId, () => ReactNode> = {
  otono: PumpkinScene,
  muertos: SkullScene,
  navidad: TreeScene,
};

/** Background layer: particles plus a little scene in the bottom corner. */
export function SeasonalBackdrop() {
  const season = useActiveSeason();
  const motion = useThemeStore(state => state.decorMotion);
  if (!season) return null;
  const Scene = SCENES[season];

  return (
    <div aria-hidden className="decor-layer fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      <Particles season={season} moving={motion} />
      <div className="absolute right-2 sm:right-6 bottom-20 md:bottom-6 w-24 h-24 sm:w-32 sm:h-32 opacity-90">
        <Scene />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Garland: repeated tiles, so it fits any width without stretching

const PICADO_COLORS = ['#e8407f', '#f39c12', '#8e5bd6', '#27ae60', '#f1c40f', '#2e86de'];
const BULB_COLORS = ['#e74c3c', '#27ae60', '#f4c542', '#3498db', '#ff7eb3'];
const TILES = Array.from({ length: 48 }, (_, i) => i);

function PicadoTile({ i }: { i: number }) {
  const color = PICADO_COLORS[i % PICADO_COLORS.length];
  // Flag with a zigzag bottom; the cut-outs are holes (evenodd)
  const flag = 'M6 3H50V22L46 26 42 22 38 26 34 22 30 26 26 22 22 26 18 22 14 26 10 22 6 26Z';
  const holes = 'M28 8 32 12.5 28 17 24 12.5Z M15 9.5a2 2 0 1 0 0.01 0Z M41 9.5a2 2 0 1 0 0.01 0Z M12 17h4v2h-4Z M40 17h4v2h-4Z';
  return (
    <svg viewBox="0 0 56 30" width="56" height="30" className="shrink-0 overflow-visible">
      <path d="M0 3H56" stroke="#6b4a2b" strokeOpacity="0.5" strokeWidth="1" />
      <path d={`${flag} ${holes}`} fill={color} fillRule="evenodd" opacity="0.92" />
    </svg>
  );
}

function LightsTile({ i, moving }: { i: number; moving: boolean }) {
  const color = BULB_COLORS[i % BULB_COLORS.length];
  return (
    <svg viewBox="0 0 48 30" width="48" height="30" className="shrink-0 overflow-visible">
      <path d="M0 3Q24 14 48 3" stroke="#2f5e3f" strokeWidth="1.5" fill="none" />
      <rect x="21.5" y="8" width="5" height="4" rx="1" fill="#55606a" />
      <ellipse
        cx="24" cy="18" rx="4.5" ry="6.5" fill={color}
        className={moving ? 'decor-blink' : undefined}
        style={{ animationDelay: `${(i % 4) * 0.4}s`, filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

function LeavesTile({ i }: { i: number }) {
  const color = LEAF_COLORS[i % LEAF_COLORS.length];
  return (
    <svg viewBox="0 0 40 30" width="40" height="30" className="shrink-0 overflow-visible">
      <path d="M0 3Q20 10 40 3" stroke="#6b4a2b" strokeOpacity="0.5" strokeWidth="1" fill="none" />
      <g transform={`translate(10 5) rotate(${i % 2 ? 12 : -12} 10 10) scale(0.85)`}>
        <MapleLeafShape color={color} />
      </g>
    </svg>
  );
}

/**
 * Hangs just under the header. Height 0 wrapper, so it never moves the page;
 * content scrolls underneath it.
 */
export function SeasonalGarland({ className }: { className?: string }) {
  const season = useActiveSeason();
  const motion = useThemeStore(state => state.decorMotion);
  if (!season) return null;

  return (
    <div aria-hidden className={cn('relative h-0 z-30 pointer-events-none', className)}>
      <div className="decor-layer absolute inset-x-0 top-0 flex overflow-hidden">
        {TILES.map(i =>
          season === 'muertos' ? <PicadoTile key={i} i={i} />
            : season === 'navidad' ? <LightsTile key={i} i={i} moving={motion} />
              : <LeavesTile key={i} i={i} />,
        )}
      </div>
    </div>
  );
}
