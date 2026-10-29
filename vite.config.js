import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Restore reasonable chunk size warning
    chunkSizeWarningLimit: 600,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libs into their own cacheable chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
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