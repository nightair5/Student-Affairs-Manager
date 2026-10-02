import { build } from 'esbuild'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const [port = '6778', instance = 'accept01'] = process.argv.slice(2)
if (!/^\d{4,5}$/.test(port) || +port < 6778 || +port > 65535 || !/^[a-z0-9-]{2,32}$/.test(instance)) throw Error('D27_NEW_LOOPBACK_INSTANCE_REQUIRED')
const dir = resolve('.data/d27/plan-' + instance), origin = 'http://127.0.0.1:' + port, database = 'rco-mainline-01-02-i1-d27-plan-' + instance
mkdirSync(dir, { recursive: true }); if (readdirSync(dir).length) throw Error('D27_INSTANCE_ALREADY_BUILT')
const hash = createHash('sha256'); for (const f of execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'scripts/serve-d27-plan.mjs'], { encoding: 'utf8' }).trim().split('\n').sort()) hash.update(f).update(readFileSync(f))
const buildIdentity = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().slice(0, 12) + ' / source ' + hash.digest('hex').slice(0, 12)
const output = await build({ entryPoints: ['src/experiments/d27/browser.tsx'], bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', target: 'es2022', outdir: 'memory', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}', __D27_CONFIG__: JSON.stringify({ origin, database, build: buildIdentity }) } })
const sha = v => createHash('sha256').update(v).digest('hex')
const files = output.outputFiles.map(f => { const name = basename(f.path), text = f.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g, ''); writeFileSync(resolve(dir, name), text); return { name, sha256: sha(text) } })
writeFileSync(resolve(dir, 'index.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · D27 匿名安排工程</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script type="module" src="/browser.js"></script></body></html>')
writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify({ origin, database, build: buildIdentity, role: 'ENGINEERING_REPLAY', files, modelCalls: 0 }, null, 2) + '\n')
createServer((req, res) => { const p = new URL(req.url, origin).pathname; if (!['/', '/browser.js', '/browser.css', '/manifest.json'].includes(p)) { res.writeHead(403); res.end('D27_EXTERNAL_AND_MODEL_ROUTES_DISABLED'); return } res.setHeader('Content-Type', p.endsWith('.js') ? 'text/javascript; charset=utf-8' : p.endsWith('.css') ? 'text/css; charset=utf-8' : p.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'); res.end(readFileSync(resolve(dir, p === '/' ? 'index.html' : p.slice(1)))) }).listen(+port, '127.0.0.1', () => console.log(JSON.stringify({ origin, database, modelCalls: 0 })))
