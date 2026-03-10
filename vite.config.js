import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  server: {
    // Proxy Owncast requests in dev to avoid CORS / mixed-content issues
    proxy: {
      '/hls': {
        target: 'https://stream.willowduster.com',
        changeOrigin: true,
        secure: true,
      },
      '/api': {
        target: 'https://stream.willowduster.com',
        changeOrigin: true,
        secure: true,
      },
      '/ws': {
        target: 'wss://stream.willowduster.com',
        changeOrigin: true,
        ws: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Raised above default (500 KB) because hls.js is intentionally split into its own chunk
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split hls.js into its own chunk to keep the main bundle lean
        manualChunks: {
          'hls': ['hls.js'],
        },
        // Filename hashing ensures updated assets get fresh URLs
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Minification via default esbuild
    minify: 'esbuild',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Inline small assets as base64
    assetsInlineLimit: 4096,
  },
})
