/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['"Source Serif 4"', '"Source Serif Pro"', 'Georgia', 'Cambria', 'serif'],
      },
      colors: {
        // Neutral commercial palette: warm stone, deep ink, single accent.
        ink: {
          DEFAULT: '#1c1917',
          muted: '#57534e',
        },
        accent: {
          50:  '#f3f6f2',
          100: '#e1e9dd',
          200: '#c2d4ba',
          300: '#9bb88f',
          400: '#739969',
          500: '#557a4d',
          600: '#41613b',
          700: '#344d30',
          800: '#2a3d28',
          900: '#1f2c1e',
        },
      },
      maxWidth: {
        '8xl': '88rem',
      },
      letterSpacing: {
        tightish: '-0.015em',
      },
    },
  },
  plugins: [],
};
