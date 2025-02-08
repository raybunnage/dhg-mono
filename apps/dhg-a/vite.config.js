import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from '../../vite.config.base.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    ...baseConfig,
    plugins: [react()],
    // Custom configurations
    build: {
      ...baseConfig.build,
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 5173,      // Vite's default for development
      ...baseConfig.server,
    },
    preview: {
      port: 4173,      // Vite's default for preview
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV)
    }
  }
}) 