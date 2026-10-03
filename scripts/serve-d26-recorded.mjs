import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { resolve, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
const [port, instance] = process.argv.slice(2)
if (!/^\d{4,5}$/.test(port ?? '') || +port < 6793 || +port > 65535 || !/^[a-z0-9-]{2,32}$/.test(instance ?? '')) throw Error('RECORDED_NEW_LOOPBACK_INSTANCE_REQUIRED')
const report = JSON.parse(readFileSync('.data/d26-authorized-20261003/COMPARISON_REPORT.json', 'utf8').replace(/^\uFEFF/u, ''))
if (report.status !== 'COMPLETE_DEFINITE_COMPARISON' || report.units.length !== 16) throw Error('COMPLETE_D26_REPORT_REQUIRED')
const sources = JSON.parse(readFileSync('docs/recognition-optimization/d26-correction/SOURCES.json', 'utf8')).sources, sha = v => createHash('sha256').update(v).digest('hex')
const recordings = report.units.map(unit => {
  const source = sources.find(s => s.sourceId === unit.sourceId), raw = JSON.parse(readFileSync('.data/d26/execution/raw/' + String(unit.ordinal).padStart(2, '0') + '.json', 'utf8'))
  if (sha(raw.rawHttpText) !== unit.responseSha256 || raw.requestSha256 !== unit.requestSha256 || sha(source.sourceText) !== source.sourceSha256) throw Error('RECORDED_SHA_DRIFT')
  return { ordinal: unit.ordinal, sourceId: source.sourceId, sourceVersionId: source.sourceVersionId, candidate: unit.candidate, sourceText: source.sourceText, referenceTime: source.referenceTime, timezone: source.timezone, rawHttpText: raw.rawHttpText, responseSha256: unit.responseSha256, requestSha256: unit.requestSha256, frozenOutcome: String(report.cases.find(c => c.ordinal === unit.ordinal).score.completeStatus) }
})
const dir = resolve('.data/d26/recorded-' + instance), origin = 'http://127.0.0.1:' + port, database = 'rco-mainline-01-02-i1-d27-plan-recorded-' + instance
mkdirSync(dir, { recursive: true }); if (readdirSync(dir).length) throw Error('RECORDED_INSTANCE_ALREADY_BUILT')
const hash = createHash('sha256'); for (const f of execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'scripts/serve-d26-recorded.mjs'], { encoding: 'utf8' }).trim().split('\n').sort()) hash.update(f).update(readFileSync(f))
const buildIdentity = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().slice(0, 12) + ' / source ' + hash.digest('hex').slice(0, 12)
const output = await build({ entryPoints: ['src/experiments/d26Recorded/browser.tsx'], bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', target: 'es2022', outdir: 'memory', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}', __D26_RECORDED_CONFIG__: JSON.stringify({ origin, database, build: buildIdentity }) } })
const files = output.outputFiles.map(f => { const name = basename(f.path), content = f.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g, ''); writeFileSync(resolve(dir, name), content); return { name, sha256: sha(content) } })
writeFileSync(resolve(dir, 'recordings.json'), JSON.stringify(recordings))
writeFileSync(resolve(dir, 'index.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · D26真实录制工程回放</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script type="module" src="/browser.js"></script></body></html>')
writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify({ origin, database, build: buildIdentity, role: 'ENGINEERING_REPLAY', files, recordingsSha256: sha(JSON.stringify(recordings)), modelCallsByBrowser: 0 }, null, 2))
createServer((req, res) => { const p = new URL(req.url, origin).pathname; if (!['/', '/browser.js', '/browser.css', '/recordings.json', '/manifest.json'].includes(p)) { res.writeHead(403); res.end('RECORDED_MODEL_AND_EXTERNAL_ROUTES_DISABLED'); return } res.setHeader('Content-Type', p.endsWith('.js') ? 'text/javascript; charset=utf-8' : p.endsWith('.css') ? 'text/css; charset=utf-8' : p.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'); res.end(readFileSync(resolve(dir, p === '/' ? 'index.html' : p.slice(1)))) }).listen(+port, '127.0.0.1', () => console.log(JSON.stringify({ origin, database, modelCallsByBrowser: 0, build: buildIdentity })))
