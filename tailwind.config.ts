import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // Surfaces
        bg: '#0a0b0d',
        panel: {
          DEFAULT: '#0e1117',
          2: '#14171c',
          3: '#181c22',
        },
        // Lines (avoid clashing with border-utility)
        line: {
          DEFAULT: '#1c1f25',
          2: '#272b33',
        },
        // Ink (text)
        ink: {
          DEFAULT: '#e8e9ed',
          2: '#c9cbd2',
          muted: '#8a8f99',
          subtle: '#5d626c',
        },
        // Brand
        accent: {
          DEFAULT: '#7170ff',
          2: '#5b5af0',
        },
        // Status hues
        status: {
          backlog: '#8b8fa3',
          active: '#7170ff',
          waiting: '#f59e0b',
          blocked: '#ef4444',
          resolved: '#10b981',
          discard: '#6b6f78',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      fontSize: {
        '2xs': ['10.5px', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
