import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from '../../vite.config.base.js'
import path from "path"
import { componentTagger } from "lovable-tagger"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    ...baseConfig,
    plugins: [
      react({
        jsxRuntime: 'automatic',
        babel: {
          plugins: ['@babel/plugin-transform-react-jsx']
        }
      }),
      mode === 'development' && componentTagger()
    ].filter(Boolean),
    // Custom configurations
    build: {
      ...baseConfig.build,
      outDir: 'dist',
      sourcemap: true,
      commonjsOptions: {
        include: [/pdfjs-dist/]
      },
      rollupOptions: {
        output: {
          manualChunks: {
            pdfjs: ['pdfjs-dist']
          }
        }
      }
    },
    server: {
      port: 5174,  // Change from 5173 to 5174
      host: "::",      // Keep host setting from lovable
      ...baseConfig.server,
    },
    preview: {
      port: 4173,
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
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        '@supabase': path.resolve(__dirname, './supabase'),
        "@root": path.resolve(__dirname, "../../"),
      },
    },
    publicDir: 'public',
    optimizeDeps: {
      include: ['zod', 'pdfjs-dist']
    }
  }
})
