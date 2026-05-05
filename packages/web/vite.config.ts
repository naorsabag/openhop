import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: '0.0.0.0',
    port: 8788,
    // Allow access from any hostname — the dev server binds to 0.0.0.0 so
    // contributors running inside docker / WSL / a dev container can hit it
    // via `host.docker.internal`, the container's bridge IP, or a tunneled
    // hostname. Vite's default host check rejects anything other than
    // `localhost` with a 403 "host not allowed", which surprises people
    // running everything inside docker-compose.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:8787',
      '/health': 'http://localhost:8787',
    },
  },
  build: {
    // elkjs ships an optional `web-worker` import for node usage; not needed
    // in the browser bundle, so we mark it external to keep rolldown happy.
    rollupOptions: {
      external: ['web-worker'],
    },
  },
})
