import { defineConfig } from 'vite'

// Shared Vite configuration for all apps
export default defineConfig({
  build: {
    // Common build settings
    emptyOutDir: true,
    sourcemap: true,
    
    // Common rollup options
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks consistently
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  
  // Common development settings
  server: {
    https: false,
    cors: true,
  },
}) 