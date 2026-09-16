import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Mol* is large; pre-bundle for snappier first open of the viewer panel.
    include: ['molstar'],
  },
  build: {
    chunkSizeWarningLimit: 3500,
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Mol* ships SCSS skins; silence legacy API noise from dart-sass.
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
})
