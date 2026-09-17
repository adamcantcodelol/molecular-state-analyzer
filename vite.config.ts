import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Mol* has no package root entry (no main/exports); include the real
    // subpath the viewer imports so Vite prebundle resolves cleanly.
    include: ['molstar/lib/apps/viewer/app'],
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
