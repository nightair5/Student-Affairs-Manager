import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { build } from 'esbuild'

const baseline = JSON.parse(readFileSync('docs/recognition-optimization/mainline-03-i1/BASELINE.json', 'utf8'))
const fixturePath = 'src/experiments/mainline01/fixtures.ts'
const dataPath = 'docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json'
const rawPath = 'docs/recognition-optimization/rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a/raw-results.json'
const ids = ['rco-task-b8-01', 'rco-task-b8-07', 'rco-task-b8-09']
const hashes = new Map()
function readProtected(path) {
  const bytes = readFileSync(path), sha = createHash('sha256').update(bytes).digest('hex')
  if (baseline.files.find(item => item.path === path)?.sha256 !== sha) throw Error('REPLAY_INPUT_PROTECTION_FAILED')
  hashes.set(path, 'sha256:' + sha)
  return bytes
}
readProtected(fixturePath)
const data = JSON.parse(readProtected(dataPath).toString('utf8'))
const raw = JSON.parse(readProtected(rawPath).toString('utf8'))
// Whitelisted projection only. No Expected/score/dataset object enters the browser bundle.
const seen = ids.map(caseId => {
  const inputs = data.cases.filter(item => item.id === caseId), records = raw.records.filter(item => item.caseId === caseId)
  if (inputs.length !== 1 || records.length !== 1) throw Error('REPLAY_SELECTION_NOT_UNIQUE')
  const record = records[0]
  return { caseId, sourceText: inputs[0].sourceText, runId: raw.runId, model: record.responseModel,
    rawOutputText: record.rawOutputText, parsed: record.parsed,
    originFiles: [{ path: dataPath, sha256: hashes.get(dataPath) }, { path: rawPath, sha256: hashes.get(rawPath) }] }
})
const bundle = await build({ entryPoints: ['src/experiments/mainline03/browser.tsx'], bundle: true, write: false,
  metafile: true, outdir: 'memory', platform: 'browser', format: 'esm', jsx: 'automatic', loader: { '.svg': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}',
    __MAINLINE03_INPUTS__: JSON.stringify({ fixtureSha256: hashes.get(fixturePath), seen }) } })
const forbidden = Object.keys(bundle.metafile.inputs).filter(path => /(?:fidelity|confirmationHarness|evaluationDataset|score|run-rco-|DATASET\.json|raw-results\.json)/i.test(path))
if (forbidden.length) throw Error('REPLAY_EXPECTED_OR_RUNNER_DEPENDENCY:' + forbidden.join(','))
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ bundle: 'PASS', seenCases: seen.length, engineeringTypes: 8, forbiddenDependencies: forbidden, externalRecognitionCalls: 0 }))
} else {
  const assets = new Map(bundle.outputFiles.map(file => ['/' + basename(file.path), file.contents]))
  const js = [...assets.keys()].find(name => name.endsWith('.js')), css = [...assets.keys()].find(name => name.endsWith('.css'))
  const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>MAINLINE03 真实App来源交接隔离验收</title><meta name="viewport" content="width=device-width,initial-scale=1">'
    + (css ? '<link rel="stylesheet" href="' + css + '">' : '') + '<div id="root"></div><script type="module" src="' + js + '"></script></html>'
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
    response.setHeader('Cache-Control', 'no-store')
    if (request.method !== 'GET' || (path !== '/' && !assets.has(path))) { response.writeHead(404); response.end(); return }
    response.setHeader('Content-Type', path === '/' ? 'text/html; charset=utf-8' : path.endsWith('.css') ? 'text/css' : 'text/javascript')
    response.end(path === '/' ? html : assets.get(path))
  })
  server.listen(0, '127.0.0.1', () => console.log('MAINLINE03_URL=http://127.0.0.1:' + server.address().port
    + '/?run=mainline03-' + randomUUID() + '&new=1'))
}
