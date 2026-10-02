/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#060a12',
          900: '#0a101c',
          800: '#111a2c',
          700: '#1a2740',
          600: '#25365a',
          500: '#37507f',
        },
        volt: {
          DEFAULT: '#facc15',
          dim: '#a16207',
        },
        live: '#22c55e',
        hazard: '#ef4444',
      },
      fontFamily: {
        mono: ['Consolas', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
