import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

/** Local assets from the existing dependency, shared by dev and built output. */
function localPdfCMaps(): Plugin {
  const directory = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/cmaps/UniGB-UCS2-H.bcmap'))
  const files = readdirSync(directory).filter(name => /^[A-Za-z0-9_-]+\.bcmap$/u.test(name) || name === 'LICENSE')
  return {
    name: 'local-pdf-cmaps',
    configureServer(server) {
      server.middlewares.use('/pdf-cmaps/', (request, response, next) => {
        const name = request.url?.split('?')[0] ?? ''
        if (!files.includes(name)) return next()
        response.setHeader('Content-Type', 'application/octet-stream')
        response.end(readFileSync(join(directory, name)))
      })
    },
    generateBundle() {
      for (const name of files) this.emitFile({ type: 'asset', fileName: 'pdf-cmaps/' + name, source: readFileSync(join(directory, name)) })
    },
  }
}

export default defineConfig(() => ({
  plugins: [react(), localPdfCMaps()],
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
