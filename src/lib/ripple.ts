// Material ripple: a wave that spreads from the finger on every button, link
// and [role=button]. One listener for the whole app; add data-no-ripple to opt out.
// Styles live in src/index.css (.ripple-host / .ripple-wave).

const TARGETS = 'button, a[href], [role="button"], [data-ripple]';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function spawn(event: PointerEvent) {
  if (event.button !== 0 || reducedMotion.matches) return;
  const target = (event.target as Element | null)?.closest<HTMLElement>(TARGETS);
  if (!target || target.closest('[data-no-ripple]') || target.matches(':disabled, [aria-disabled="true"]')) return;

  let host = target.querySelector<HTMLSpanElement>(':scope > .ripple-host');
  if (!host) {
    host = document.createElement('span');
    host.className = 'ripple-host';
    host.setAttribute('aria-hidden', 'true');
    target.appendChild(host);
  }

  const rect = target.getBoundingClientRect();
  const size = Math.hypot(rect.width, rect.height) * 2;
  const wave = document.createElement('span');
  wave.className = 'ripple-wave';
  wave.style.width = wave.style.height = `${size}px`;
  wave.style.left = `${event.clientX - rect.left - size / 2}px`;
  wave.style.top = `${event.clientY - rect.top - size / 2}px`;
  host.appendChild(wave);
  wave.addEventListener('animationend', () => wave.remove(), { once: true });
}

export function initRipples() {
  document.addEventListener('pointerdown', spawn, { passive: true });
}
