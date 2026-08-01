import { copyFile, mkdir } from 'node:fs/promises'

await mkdir('dist/server', { recursive: true })
await copyFile('server/deepseek-service.mjs', 'dist/server/deepseek-service.js')
await copyFile('sites/worker.mjs', 'dist/server/index.js')
