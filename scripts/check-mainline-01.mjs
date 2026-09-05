import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

// New temporary engineering logs/build/npm audit cache only; no credential file or old cache reads.
const directory = mkdtempSync(join(tmpdir(), 'rco-mainline-01-checks-'))
const results = []
if (!process.argv[2]) throw new Error('NPM_CLI_PATH_REQUIRED_FOR_AUDIT')
process.env.RUN_LIVE_OCR_COMPONENT = '0'
console.log(`CHECK_DIRECTORY=${directory}`)
const run = (name, args) => new Promise((resolve) => {
  const child = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  child.on('error', (error) => { output += error.message })
  child.on('close', (code) => {
    writeFileSync(join(directory, `${name}.log`), output)
    results.push({ name, exitCode: code, log: `${name}.log` })
    const summary = output.split(/\r?\n/).filter((line) => /Test Files|Tests\s|# tests|# pass|# fail|# skipped|passed across|vulnerabilities|error TS|FAIL|Error:/.test(line)).slice(-12)
    console.log(JSON.stringify({ name, exitCode: code, summary }))
    resolve(code === 0)
  })
})
const checks = [
  ['protection-before', ['scripts/protect-mainline-01.mjs']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['typecheck-app', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.app.json', '--incremental', 'false', '--pretty', 'false']],
  ['typecheck-node', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.node.json', '--incremental', 'false', '--pretty', 'false']],
  ['schema-contract', ['scripts/generate-recognition-contract.mjs', '--check']],
  ['time-contract', ['scripts/generate-time-ast.mjs', '--check']],
  ['vitest-all', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/mainline-01.vitest.config.mts', '--reporter=dot']],
  ['server', ['--test', 'server/server-tests.mjs']],
  ['worker', ['--test', 'cloudflare/worker-tests.mjs']],
  ['time-parity', ['--test', 'scripts/time-ast-parity.node-test.mjs']],
  ['multimodal-library', ['--test', 'scripts/multimodal-evaluation-lib.node-test.mjs']],
  ['seen-replay-library', ['--test', 'scripts/rco-5-007-replay.node-test.mjs']],
  ['functions', ['--test', 'functions/functions-tests.mjs']],
]
let okay = true
for (const [name, args] of checks) { if (!await run(name, args)) { okay = false; break } }
if (okay) {
  try {
    await build({ configFile: false, envFile: false, envDir: false, plugins: [react()], base: '/',
      cacheDir: join(directory, 'vite-cache'), build: { outDir: join(directory, 'build'), emptyOutDir: false } })
    results.push({ name: 'build', exitCode: 0, directory: 'build' })
    const root = join(directory, 'build')
    const outputs = readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
    const findings = []
    for (const entry of outputs) {
      if (!/\.(?:mjs|js|css|html|json|map)$/.test(entry.name)) continue
      const text = readFileSync(join(entry.parentPath, entry.name), 'utf8')
      // Same high-value rules as the repository scanner, restricted to new local artifacts.
      const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, /\bsk-[A-Za-z0-9_-]{20,}\b/g,
        /\b(?:DEEPSEEK_API_KEY|CLOUDFLARE_API_TOKEN|FIREBASE_TOKEN|SAM_SYNC_TOKEN|SAM_EMAIL_PROVIDER_TOKEN)\s*[:=]\s*["']?[^\s"']{12,}/gi]
      if (patterns.some((pattern) => [...text.matchAll(pattern)].some((match) => !/example|placeholder|invalid|test-key|test-only|replace|your[-_ ]|<[^>]+>/i.test(match[0])))) findings.push(entry.name)
      if (text.includes('rco-mainline-01-') || text.includes('UNREPRESENTABLE_CONDITION_STATE')) findings.push(`${entry.name}:experimental-entry-in-production-bundle`)
    }
    results.push({ name: 'new-build-security-and-isolation', exitCode: findings.length ? 1 : 0, files: outputs.length, findings })
    if (findings.length) okay = false
  } catch (error) { results.push({ name: 'build', exitCode: 1, error: error.message }); okay = false }
}
if (okay) okay = await run('security-scan', ['scripts/scan-secrets.mjs'])
// npm audit is the only network-capable engineering check; public registry, no model endpoint.
// npm CLI is resolved from the known invoking Node installation via explicit CLI argument.
if (okay) okay = await run('dependency-audit', [process.argv[2], 'audit', '--audit-level=high', '--cache', join(directory, 'npm-audit-cache')])
if (okay) okay = await run('protection-after', ['scripts/protect-mainline-01.mjs'])
writeFileSync(join(directory, 'results.json'), JSON.stringify({ directory, okay, results }, null, 2))
console.log(`ENGINEERING_RESULT=${join(directory, 'results.json')}`)
if (!okay) process.exitCode = 1
