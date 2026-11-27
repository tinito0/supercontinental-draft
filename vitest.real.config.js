// PES tests against the real game files (vendor/, PES_KIT_SERVER). `npm test` skips them; run with npm run test:real.
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ['tests/pes/**/*.test.js', 'tests/pesCollector/**/*.test.js'],
    env: { PES_REAL: '1' },
  },
}));
