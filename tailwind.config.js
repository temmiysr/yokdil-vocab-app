/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        academic: {
          50: '#f0f5fa',
          100: '#e1ecf5',
          200: '#c4dbed',
          300: '#97c2e0',
          400: '#64a3cf',
          500: '#3f85be',
          600: '#2d6ba2',
          700: '#265684',
          800: '#234a6e',
          900: '#1b3854',
          950: '#122437',
        },
        sage: {
          50: '#f4f7f4',
          100: '#e5ece5',
          200: '#cddbcd',
          300: '#a7c1a8',
          400: '#7ba17d',
          500: '#5a845c',
          600: '#466848',
          700: '#39533a',
          800: '#304331',
          900: '#29382a',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'Cambria', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
