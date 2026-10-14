import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'

// In-memory bundle, no Vite/.env/service proxy/cache/static filesystem serving.
const bundled = await build({ entryPoints: ['src/experiments/mainline01p1/browser.tsx'], bundle: true,
  write: false, platform: 'browser', format: 'esm', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' } })
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>MAINLINE-01-P1 隔离确认 V2</title>
<style>body{font:16px system-ui;margin:24px;max-width:1100px;color:#162a38}button,input,select{font:inherit;margin:6px;padding:8px}article,section,details{border:1px solid #b8c6cc;padding:12px;margin:8px}pre{font-size:12px;white-space:pre-wrap}small{display:block}label{display:block}.review-item-header{display:flex;gap:8px;align-items:center}.dialog-close{float:right}.sr-only{font-size:12px}.form-grid{display:grid;grid-template-columns:1fr 1fr}mark{background:#ffe39b}</style>
<div id="root"></div><script type="module" src="/bundle.js"></script></html>`
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET' || !['/', '/bundle.js'].includes(path)) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', path === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8')
  response.end(path === '/' ? html : bundled.outputFiles[0].contents)
})
server.listen(0, '127.0.0.1', () => console.log(`MAINLINE_P1_TEST_URL=http://127.0.0.1:${server.address().port}/?run=${randomUUID()}`))
