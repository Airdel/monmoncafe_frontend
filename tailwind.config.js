/** @type {import('tailwindcss').Config} */

// Colors come from the CSS variables of the active theme (src/index.css)
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const colors = {
  canvas: token('canvas'),
  ink: token('ink'),
  shade: token('shade'),
  raised: token('raised'),
  nav: token('nav'),
  primary: token('primary'),
  secondary: token('secondary'),
  accent: token('accent'),
  warning: token('warning'),
  error: token('error'),
  'on-primary': token('on-primary'),
  'on-secondary': token('on-secondary'),
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors,
      textColor: {
        // Faint text (text-ink/40) gets a per-theme minimum opacity so it stays
        // readable on light backgrounds, where low alphas wash out much faster.
        ink: 'rgb(var(--c-ink) / calc(var(--text-floor) + (1 - var(--text-floor)) * <alpha-value>))',
      },
      fontFamily: {
        headline: ['var(--font-headline)'],
        body: ['var(--font-body)'],
        label: ['var(--font-label)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      backdropBlur: {
        xl: '40px',
        '2xl': '60px',
      },
    },
  },
  plugins: [],
}
