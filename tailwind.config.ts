import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0c0b10',
          900: '#121116',
          850: '#18171d',
          800: '#201f26',
        },
        lunar: {
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
        },
      },
      boxShadow: {
        composer: '0 12px 40px rgba(0, 0, 0, 0.18)',
      },
      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'slide-in': 'slideIn 220ms ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config
