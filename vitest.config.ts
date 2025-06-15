import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: [
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
      'scripts/**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/node_modules/**'
    ]
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './packages/shared'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    target: 'node14'
  }
})