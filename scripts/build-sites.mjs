import { copyFile, mkdir, rename } from 'node:fs/promises'

// Sites exposes static files from the Cloudflare/Vite client output directory.
await mkdir('dist/client', { recursive: true })
await rename('dist/index.html', 'dist/client/index.html')
await rename('dist/assets', 'dist/client/assets')
await mkdir('dist/server', { recursive: true })
await copyFile('server/deepseek-service.mjs', 'dist/server/deepseek-service.js')
await copyFile('sites/worker.mjs', 'dist/server/index.js')
