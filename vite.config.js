import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Add these PDF.js specific configurations
  optimizeDeps: {
    include: ['pdfjs-dist/build/pdf.worker.mjs']
  },
  build: {
    rollupOptions: {
      external: ['pdfjs-dist/build/pdf.worker.mjs']
    }
  }
})); 