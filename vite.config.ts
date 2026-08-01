import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => ({
  plugins: [react()],
  // Firebase Hosting serves the application from the site root.
  base: '/',
  server: {
    port: 4173,
    proxy: {
      // Development-only same-origin bridge to the optional local service.
      // Production deployments must provide an explicit service endpoint.
      '/api': 'http://127.0.0.1:8787',
    },
  },
}))
