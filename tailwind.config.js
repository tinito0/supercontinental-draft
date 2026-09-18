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
    extend: {},
  },
  plugins: [],
}