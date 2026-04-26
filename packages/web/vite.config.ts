import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: '0.0.0.0',
    port: 8788,
    proxy: {
      '/api': 'http://localhost:8787',
      '/health': 'http://localhost:8787'
    }
  },
  build: {
    // elkjs ships an optional `web-worker` import for node usage; not needed
    // in the browser bundle, so we mark it external to keep rolldown happy.
    rollupOptions: {
      external: ['web-worker']
    }
  }
})
