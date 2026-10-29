// Temporary visual-QA harness (deleted after the overhaul QA). Not part of the app.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from '../tailwind.config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const stub = name => path.join(here, 'stubs', name);

export default defineConfig({
  root: here,
  publicDir: path.join(repo, 'public'),
  plugins: [
    react(),
    {
      name: 'qa-stubs',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (source === 'firebase/firestore') return stub('firestore.js');
        if (!importer || !source.startsWith('.')) return null;
        const resolved = path.resolve(path.dirname(importer), source).replace(/\\/g, '/');
        if (resolved.endsWith('/config/firebase.js')) return stub('firebase.js');
        if (resolved.endsWith('/hooks/useLeagueData.js')) return stub('useLeagueData.js');
        return null;
      },
    },
  ],
  css: {
    postcss: {
      plugins: [tailwindcss({ ...tailwindConfig, content: [...tailwindConfig.content.map(p => path.join(repo, p)), path.join(here, '**/*.jsx')] }), autoprefixer()],
    },
  },
  server: {
    port: 5231,
    strictPort: true,
    fs: { allow: [repo] },
    watch: { ignored: ['**/public/**', '**/vendor/**', '**/node_modules/**', '**/graphify-out/**'] },
  },
  optimizeDeps: { entries: [path.join(here, 'main.jsx')] },
});
