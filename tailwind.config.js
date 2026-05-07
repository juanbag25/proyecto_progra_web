/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          base: '#0A0F1A',
          raised: '#121212',
          elevated: '#1E1E24',
        },
        accent: {
          cyan: '#00F0FF',
          mint: '#00E676',
        },
        warn: {
          coral: '#FF6B6B',
          orange: '#FF8E53',
        },
        hairline: 'rgba(255, 255, 255, 0.05)',
        glass: 'rgba(255, 255, 255, 0.04)',
      },
      fontFamily: {
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter2: '-0.02em',
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        'glow-cyan': '0 0 40px -8px rgba(0, 240, 255, 0.55)',
        'glow-mint': '0 0 40px -8px rgba(0, 230, 118, 0.55)',
        'glow-coral': '0 0 40px -8px rgba(255, 107, 107, 0.55)',
        'inset-hairline': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backgroundImage: {
        'mesh-hero':
          'radial-gradient(at 15% 15%, rgba(0,240,255,0.10) 0, transparent 45%), radial-gradient(at 85% 80%, rgba(0,230,118,0.08) 0, transparent 50%), radial-gradient(at 50% 100%, rgba(255,107,107,0.05) 0, transparent 55%)',
        'accent-gradient': 'linear-gradient(135deg, #00F0FF 0%, #00E676 100%)',
        'warn-gradient': 'linear-gradient(135deg, #FF8E53 0%, #FF6B6B 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Subtle scale dip + recover. Used as feedback when an item gets
        // checked/unchecked — gives the toggle a haptic-like beat.
        'check-bounce': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'check-bounce': 'check-bounce 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
