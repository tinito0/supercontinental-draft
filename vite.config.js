import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fuentes de arriba del pliegue (cuerpo en Barlow 400, títulos en Barlow Condensed 700): los .woff2 de @fontsource salen
// con hash, así que el preload se arma con el nombre real del build. Solo latin; el resto de pesos y alfabetos
// se baja cuando el CSS los pide.
const PRELOADED_FONTS = ['barlow-latin-400-normal', 'barlow-condensed-latin-700-normal'];
const preloadFonts = () => ({
  name: 'preload-fonts',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx.bundle) return undefined;
      const files = Object.keys(ctx.bundle);
      return PRELOADED_FONTS.map(name => files.find(file => file.includes(name) && file.endsWith('.woff2')))
        .filter(Boolean)
        .map(file => ({ tag: 'link', injectTo: 'head-prepend', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${file}`, crossorigin: '' } }));
    },
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), preloadFonts()],
  build: {
    // Restore reasonable chunk size warning
    chunkSizeWarningLimit: 600,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libs into their own cacheable chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/firestore'],
          // Auth and Storage only load with the draft (config/firebase.js); the league site stays on vendor-firebase.
          'vendor-firebase-auth': ['firebase/auth', 'firebase/storage'],
          // chart.js no va en un chunk manual: así quedaba en <link rel=modulepreload> de todas las páginas.
          // jspdf / html2canvas are only reached through lazy imports, so Rollup already splits
          // them. A manual 'vendor-pdf' chunk also captured Vite's preload helper, which made every
          // page download jsPDF (424 kB) up front.
        }
      }
    }
  },
  esbuild: {
    target: 'esnext',
  },
  test: {
    globals: true,
    environment: 'node',
    // The PES tests on the real database (vendor/) zip and hash ~30 MB; 5 s is too tight on a busy machine.
    testTimeout: 30000,
    exclude: ['**/node_modules/**', '**/dist/**', 'vendor/**', 'tests/rules/**'],
  }
})