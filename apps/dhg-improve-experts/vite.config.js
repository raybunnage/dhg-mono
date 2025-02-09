import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from '../../vite.config.base.js'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    ...baseConfig,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    build: {
      ...baseConfig.build,
      outDir: 'dist',
      sourcemap: true
    }
  }
}) 