/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#111318',
        primary: '#00Dbe9',
        secondary: '#36FFc4',
        error: '#FFB4ab',
        surface: 'rgba(255, 255, 255, 0.03)',
        'surface-border': 'rgba(255, 255, 255, 0.1)',
      },
      fontFamily: {
        headline: ['"Hanken Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['"Space Grotesk"', 'monospace'],
      },
      backdropBlur: {
        xl: '40px',
        '2xl': '60px',
      },
    },
  },
  plugins: [],
}
