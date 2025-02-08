import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from '../../vite.config.base.js'

export default defineConfig({
  ...baseConfig,
  plugins: [react()],
  // Custom configurations
  build: {
    ...baseConfig.build,
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    ...baseConfig.server,
    port: 3000,
  }
}) 