/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        bg:             '#000000',
        s1:             '#0F0F0F',
        s2:             '#161616',
        s3:             '#1E1E1E',
        border:         '#2A2A2A',
        primary:        '#FF9F00',
        'primary-deep': '#C47800',
        'primary-glow': 'rgba(255,159,0,0.18)',
        white:          '#F1F5F9',
        muted:          '#666666',
        dim:            '#2A2A2A',
        success:        '#10B981',
        warning:        '#F59E0B',
        danger:         '#F43F5E',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['"Roboto Mono"', 'monospace'],
      },
      animation: {
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
        'slide-up':  'slideUp 0.25s ease-out',
        'fade-in':   'fadeIn 0.3s ease-out',
        'glow':      'glow 2s ease-in-out infinite',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.4', transform: 'scale(0.75)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(255,159,0,0.25)' },
          '50%':      { boxShadow: '0 0 24px rgba(255,159,0,0.5)' },
        },
      },
      boxShadow: {
        'primary-sm': '0 0 12px rgba(255,159,0,0.2)',
        'primary-md': '0 0 24px rgba(255,159,0,0.3)',
      },
    },
  },
  plugins: [],
};
