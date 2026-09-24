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
      },
    },
  },
  plugins: [],
}