import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves this project beneath the repository name. Keep the
  // development server at the root while emitting deployable production URLs.
  base: command === 'build' ? '/Student-Affairs-Manager/' : '/',
  server: {
    port: 4173,
    proxy: {
      '/api/deepseek': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
}))
