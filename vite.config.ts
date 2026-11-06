import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // El API de WorkLog solo admite este origen en CORS durante el desarrollo.
    port: 5174,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // MapLibre pesa casi 1 MB: va en su propio archivo y solo lo descarga la pantalla de sitios.
        manualChunks: (id: string) => (id.includes('node_modules/maplibre-gl') ? 'maplibre' : undefined),
      },
    },
  },
})
