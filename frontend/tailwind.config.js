/** @type {import('tailwindcss').Config} */
// Colors point at CSS variables defined in src/index.css (single source of truth).
const v = (name) => `var(--${name})`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: v('bg-app'),
        surface: v('bg-surface'),
        card: { DEFAULT: v('bg-card'), hover: v('bg-card-hover') },
        elevated: v('bg-elevated'),
        line: { DEFAULT: v('border-subtle'), strong: v('border-strong') },
        accent: {
          DEFAULT: v('accent'),
          hover: v('accent-hover'),
          soft: v('accent-soft'),
          ring: v('accent-ring'),
          on: v('on-accent'),
        },
        fg: { DEFAULT: v('text-primary'), secondary: v('text-secondary'), muted: v('text-muted') },
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info'),
      },
      borderColor: { DEFAULT: v('border-subtle') },
      borderRadius: { sm: '10px', md: '16px', lg: '22px', xl: '28px' },
      fontFamily: { sans: v('font-sans') },
      boxShadow: { glow: '0 0 0 4px var(--accent-soft)', float: '0 20px 60px rgba(0,0,0,0.5)' },
    },
  },
  plugins: [],
};
