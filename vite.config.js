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
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-html2canvas': ['html2canvas'],
        }
      }
    }
  },
  esbuild: {
    target: 'esnext',
  }
})