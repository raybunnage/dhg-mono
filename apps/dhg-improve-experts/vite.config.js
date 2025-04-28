import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'packages': path.resolve(__dirname, '../../packages'),
      'packages/shared/services/supabase-client': path.resolve(__dirname, 'src/adapters/supabase-client-adapter.ts')
    }
  }
})