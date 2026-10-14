/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
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
        brand: {
          bg: '#06080d',
          surface: '#0c1017',
          'surface-elevated': '#111722',
          accent: '#00b4d8',
          'accent-hover': '#38bdf8',
        },
        success: 'var(--app-success)',
        warning: 'var(--app-warning)',
        danger: 'var(--app-danger)',
        info: 'var(--app-info)',
      },
      borderRadius: {
        sm: 'var(--app-radius-sm)',
        md: 'var(--app-radius-md)',
        lg: 'var(--app-radius-lg)',
        xl: 'var(--app-radius-xl)',
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
    },
  },
  plugins: [],
}