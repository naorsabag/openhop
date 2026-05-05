import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  // VITE_BASE='/OpenHop/' for the GitHub Pages deploy; '/' for dev. Set in
  // .github/workflows/pages.yml so dev builds aren't affected.
  base: process.env.VITE_BASE ?? '/',
  server: {
    host: '0.0.0.0',
    port: 8788,
    // Explicit allowlist (not `true`) — `allowedHosts: true` disables Vite's
    // host-header validation entirely and opens the dev server up to DNS
    // rebinding attacks (a malicious page can resolve a hostname back to the
    // dev server and pull source). The defaults already cover localhost +
    // every IP literal; we only need to add the docker/WSL hostnames a
    // contributor might hit when running inside a container, plus an env-var
    // escape hatch for tunneled hostnames (ngrok / cloudflared / etc.).
    allowedHosts: [
      'host.docker.internal',
      'openhop',
      '.localhost',
      ...(process.env.VITE_ADDITIONAL_ALLOWED_HOSTS?.split(',').map((s) => s.trim()) ?? []),
    ],
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
