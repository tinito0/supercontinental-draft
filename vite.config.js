import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Esto soluciona la advertencia del tamaño del chunk que vimos antes
    chunkSizeWarningLimit: 1600, 
    
    // --- ESTA ES LA CORRECCIÓN ---
    // Le decimos a Vite que compile para navegadores modernos
    // que soportan 'import.meta'
    target: 'esnext', 
  },
  // Esto asegura que esbuild (que usa Vite) también 
  // entienda la sintaxis moderna.
  esbuild: {
    target: 'esnext',
  }
})