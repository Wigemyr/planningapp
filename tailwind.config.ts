import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Slate Paper — warm neutral dark palette
        bg: '#111114',
        panel: {
          DEFAULT: '#1f1f23', // surface-2 — cards / dialogs / popovers
          2: '#26262a',       // surface-3 — hover
          3: '#2f2f33',       // surface-4 — highest elevation
        },
        surface: {
          1: '#18181b',
          2: '#1f1f23',
          3: '#26262a',
          4: '#2f2f33',
        },
        line: {
          DEFAULT: 'rgba(255, 255, 255, 0.06)',
          2: 'rgba(255, 255, 255, 0.10)',
          3: 'rgba(255, 255, 255, 0.14)',
        },
        ink: {
          DEFAULT: '#f0f0f0',
          2: '#c4c4c5',
          muted: '#8a8a8d',
          subtle: '#5a5a5d',
        },
        accent: {
          DEFAULT: '#5b8def',
          2: '#7ba2f2',
        },
        // Semantic palette (desaturated, editorial)
        sem: {
          neutral: '#8a8a8d',
          info: '#5b8def',
          warn: '#c79348',
          danger: '#c66e6b',
          success: '#6aa57d',
        },
        // Status hues (status-* utility classes still used in places)
        status: {
          backlog: '#8a8a8d',
          active: '#5b8def',
          waiting: '#c79348',
          blocked: '#c66e6b',
          resolved: '#6aa57d',
          discard: '#5a5a5d',
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
