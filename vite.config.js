import { defineConfig } from 'vite'

export default defineConfig({
  base: '/willowduster_site/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split hls.js into its own chunk to keep the main bundle lean
        manualChunks: {
          'hls': ['hls.js'],
        },
      },
    },
  },
})
