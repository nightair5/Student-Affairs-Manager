import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // GitHub Pages serves this project beneath the repository name. Keep the
  // development server at the root while emitting deployable production URLs.
  base: mode === 'sites' ? '/' : command === 'build' ? '/Student-Affairs-Manager/' : '/',
  server: {
    port: 4173,
    proxy: {
      // Development-only same-origin bridge to the optional local service.
      // Production deployments must provide an explicit service endpoint.
      '/api': 'http://127.0.0.1:8787',
    },
  },
}))
