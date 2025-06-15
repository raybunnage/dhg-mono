import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [path.resolve(__dirname, './test-setup.ts')],
    root: __dirname,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './'),
    },
  },
});