import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

const root = 'docs/recognition-optimization/mainline-02-i1/'
const baseline = JSON.parse(readFileSync(root + 'BASELINE.json', 'utf8'))
const sha = (data) => createHash('sha256').update(data).digest('hex')
function protect() {
  const changed = baseline.files.filter(item => !baseline.allowedExisting.includes(item.path) && sha(readFileSync(item.path)) !== item.sha256).map(item => item.path)
  const log = 'docs/recognition-optimization/OPTIMIZATION_LOG.md'
  const appendOnly = sha(readFileSync(log).subarray(0,baseline.logBytes)) === baseline.files.find(item=>item.path===log).sha256
  const additions = ['runtime.ts','reviewAdapter.ts','taskDateView.ts','browser.tsx','runtime.test.ts','reviewAdapter.test.ts','taskDateView.test.ts','mainlineAcceptance.test.tsx'].map(name=>'src/experiments/mainline02/'+name)
  additions.push('scripts/serve-mainline-02-i1.mjs','scripts/check-mainline-02-i1.mjs')
  const untracked = execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)
  const outOfScope = untracked.filter(name=>!additions.includes(name)&&!name.startsWith(root))
  const okay = !changed.length && appendOnly && !outOfScope.length
  const result = { okay, checked: baseline.files.length-baseline.allowedExisting.length, changed, appendOnly, outOfScope }
  console.log(JSON.stringify(result))
  if (!okay) throw new Error('I1_PROTECTION_FAILED')
  return result
}
if (process.argv[2] === '--protect') { protect(); process.exit(0) }
const targeted = process.argv[2] === '--targeted'
if (!targeted && !process.argv[2]) throw new Error('NPM_CLI_PATH_REQUIRED_FOR_FULL_AUDIT')
protect()
const directory = mkdtempSync(join(tmpdir(), 'rco-mainline-02-i1-'))
console.log('CHECK_DIRECTORY=' + directory)
process.env.RUN_LIVE_OCR_COMPONENT = '0'
const results = []
const run = (name, args) => new Promise((resolve) => {
  const child = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  child.on('error', (error) => { output += error.message })
  child.on('close', (code) => {
    writeFileSync(join(directory, name + '.log'), output)
    const summary = output.split(/\r?\n/).filter((line) => /Test Files|Tests\s|# tests|# pass|# fail|# skipped|passed across|vulnerabilities|error TS|FAIL|Error:/.test(line)).map((line) => line.slice(0, 240)).slice(-18)
    results.push({ name, exitCode: code, log: name + '.log', summary })
    console.log(JSON.stringify({ name, exitCode: code, summary }))
    resolve(code === 0)
  })
})
const tests = ['node_modules/vitest/vitest.mjs', 'run',
  ...(targeted ? ['src/experiments/mainline02', 'src/domain/v2/confirmationV2.test.ts', 'src/experiments/mainline01p1/confirmationHarness.test.ts', 'src/experiments/mainline01'] : []),
  '--config', 'scripts/mainline-01.vitest.config.mts', '--reporter=dot']
const checks = targeted ? [['targeted', tests]] : [
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['typecheck-app', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.app.json', '--incremental', 'false', '--pretty', 'false']],
  ['typecheck-node', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.node.json', '--incremental', 'false', '--pretty', 'false']],
  ['schema-contract', ['scripts/generate-recognition-contract.mjs', '--check']],
  ['time-contract', ['scripts/generate-time-ast.mjs', '--check']],
  ['vitest-all', tests],
  ['server', ['--test', 'server/server-tests.mjs']],
  ['worker', ['--test', 'cloudflare/worker-tests.mjs']],
  ['time-parity', ['--test', 'scripts/time-ast-parity.node-test.mjs']],
  ['multimodal-library', ['--test', 'scripts/multimodal-evaluation-lib.node-test.mjs']],
  ['seen-replay-library', ['--test', 'scripts/rco-5-007-replay.node-test.mjs']],
  ['functions', ['--test', 'functions/functions-tests.mjs']],
]
let okay = true
for (const [name, args] of checks) { if (!await run(name, args)) { okay = false; break } }
if (okay && !targeted) {
  try {
    await build({ configFile: false, envFile: false, envDir: false, plugins: [react()], base: '/',
      cacheDir: join(directory, 'vite-cache'), build: { outDir: join(directory, 'build'), emptyOutDir: false } })
    results.push({ name: 'build', exitCode: 0, directory: 'build' })
    const outputs = readdirSync(join(directory, 'build'), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
    const findings = []
    for (const entry of outputs) {
      if (!/\.(?:mjs|js|css|html|json|map)$/.test(entry.name)) continue
      const content = readFileSync(join(entry.parentPath, entry.name), 'utf8')
      const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, /\bsk-[A-Za-z0-9_-]{20,}\b/g,
        /\b(?:DEEPSEEK_API_KEY|CLOUDFLARE_API_TOKEN|FIREBASE_TOKEN|SAM_SYNC_TOKEN|SAM_EMAIL_PROVIDER_TOKEN)\s*[:=]\s*["']?[^\s"']{12,}/gi]
      if (patterns.some((pattern) => [...content.matchAll(pattern)].some((match) => !/example|placeholder|invalid|test-key|test-only|replace|your[-_ ]|<[^>]+>/i.test(match[0])))) findings.push(entry.name)
      if (content.includes('rco-mainline-01-') || content.includes('UNREPRESENTABLE_CONDITION_STATE')) findings.push(entry.name + ':experimental-entry-in-stable-bundle')
    }
    results.push({ name: 'new-build-security-and-isolation', exitCode: findings.length ? 1 : 0, files: outputs.length, findings })
    if (findings.length) okay = false
  } catch (error) { results.push({ name: 'build', exitCode: 1, error: error.message }); okay = false }
}
if (okay && !targeted) okay = await run('security-scan', ['scripts/scan-secrets.mjs'])
if (okay && !targeted) okay = await run('dependency-audit', [process.argv[2], 'audit', '--audit-level=high', '--cache', join(directory, 'npm-audit-cache')])
try { results.push({ name: 'protection-after', ...protect() }) } catch { okay = false }
writeFileSync(join(directory, 'results.json'), JSON.stringify({ directory, mode: targeted ? 'targeted' : 'full', okay, results }, null, 2))
console.log('ENGINEERING_RESULT=' + join(directory, 'results.json'))
if (!okay) process.exitCode = 1
