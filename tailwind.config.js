/** @type {import('tailwindcss').Config} */
// Design tokens live in index.css (:root --c-* as RGB channels); these names are the only
// colors components should use besides Tailwind's slate scale and the position colors.
const token = name => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  // hover: solo con puntero real (@media (hover: hover)): en el celular un toque no deja el hover pegado.
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./index.html",
    "./*.jsx",
    "./components/**/*.jsx",
    "./screens/**/*.jsx",
    "./hooks/**/*.jsx",
    "./utils/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        raised: token('raised'),
        overlay: token('overlay'),
        ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
        line: token('line'),
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          soft: token('accent-soft'),
          deep: token('accent-deep'),
        },
        'on-accent': token('on-accent'),
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        info: { DEFAULT: token('accent'), soft: token('accent-soft') },
        // Previous names, kept so older classes keep resolving to the same tokens.
        brand: {
          bg: token('canvas'),
          surface: token('surface'),
          'surface-elevated': token('raised'),
          accent: token('accent'),
          'accent-hover': token('accent-hover'),
        },
      },
      fontFamily: {
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--app-radius-sm)',
        md: 'var(--app-radius-md)',
        lg: 'var(--app-radius-lg)',
        xl: 'var(--app-radius-xl)',
        '2xl': 'var(--app-radius-2xl)',
      },
      boxShadow: {
        sm: 'var(--app-shadow-sm)',
        md: 'var(--app-shadow-md)',
        lg: 'var(--app-shadow-lg)',
      },
      zIndex: {
        dropdown: 'var(--app-z-dropdown)',
        sticky: 'var(--app-z-sticky)',
        modal: 'var(--app-z-modal)',
        toast: 'var(--app-z-toast)',
        tooltip: 'var(--app-z-tooltip)',
      },
      spacing: {
        'header': 'var(--app-header-h)',
        'sidebar': 'var(--app-sidebar-w)',
      },
      maxWidth: {
        page: '1440px',
      },
      // Motion tokens (index.css --dur-*, --ease-*). ease-in/out/in-out are redefined so every class uses the app's curves.
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        move: 'var(--dur-move)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
        'in-out': 'var(--ease-in-out)',
      },
    },
  },
  plugins: [],
}
