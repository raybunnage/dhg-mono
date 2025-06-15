import { defineConfig } from 'vitest/config';
import path from 'path';

// Base vitest config for all packages
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [path.resolve(__dirname, 'packages/shared/test-setup.ts')],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'packages/shared'),
    },
  },
});