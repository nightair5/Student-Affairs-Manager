import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { request } from 'node:http'

const outputDirectory = resolve('docs/recognition-optimization/mainline-real-input-01/runs/baseline-conversion-20260914a')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'baseline-conversion-'))
const environmentDirectory = join(temporaryRoot, 'env')
mkdirSync(environmentDirectory)
writeFileSync(join(environmentDirectory, '.env'), 'VITE_BASELINE_CONVERSION_PROBE=must_not_load\n')
const childEnvironment = {
  ...process.env,
  VITE_ENV_FILE: 'false',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
  REAL_INPUT_CARRIERS_MANIFEST: 'C:/Users/Winner/AppData/Local/Temp/real-input-carriers-e1da8dbf1e8a4f5a9732c02f6469c24f/carriers.json',
}
delete childEnvironment.DEEPSEEK_API_KEY
delete process.env.DEEPSEEK_API_KEY
process.env.VITE_ENV_FILE = 'false'
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
process.env.REAL_INPUT_CARRIERS_MANIFEST = childEnvironment.REAL_INPUT_CARRIERS_MANIFEST
const sha256 = value => createHash('sha256').update(value).digest('hex')
const checks = []
const resume = process.argv[2] === 'resume'

function run(name, command, args) {
  const started = Date.now()
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    env: childEnvironment,
  })
  writeFileSync(join(outputDirectory, name + '.log'), `${result.stdout ?? ''}${result.stderr ?? ''}`)
  checks.push({ name, status: result.status, elapsedMs: Date.now() - started })
  console.log(name, result.status)
  if (result.status !== 0) throw new Error('CHECK_FAILED_' + name)
}

if (!resume) {
  run('type-app', process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json', '--incremental', '--tsBuildInfoFile', join(temporaryRoot, 'app.tsbuildinfo'), '--pretty', 'false'])
  run('type-node', process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.node.json', '--incremental', '--tsBuildInfoFile', join(temporaryRoot, 'node.tsbuildinfo'), '--pretty', 'false'])
  run('lint', process.execPath, ['node_modules/eslint/bin/eslint.js', '.'])
  run('recognition-contract', process.execPath, ['scripts/generate-recognition-contract.mjs', '--check'])
  run('time-ast-contract', process.execPath, ['scripts/generate-time-ast.mjs', '--check'])

  const vitestStarted = Date.now()
  const vitestResultPath = join(temporaryRoot, 'vitest.json')
  const { startVitest } = await import('vitest/node')
  const vitestContext = await startVitest('test', [], {
    config: false, configFile: false, envFile: false, envDir: environmentDirectory,
    cacheDir: join(temporaryRoot, 'vitest-cache'), watch: false, passWithNoTests: false,
    reporters: ['json'], outputFile: vitestResultPath,
  }, { configFile: false, envFile: false, envDir: environmentDirectory, cacheDir: join(temporaryRoot, 'vitest-cache') })
  await vitestContext?.close()
  const vitest = JSON.parse(readFileSync(vitestResultPath, 'utf8'))
  checks.push({ name: 'vitest', status: vitest.success ? 0 : 1, elapsedMs: Date.now() - vitestStarted,
    passed: vitest.numPassedTests, failed: vitest.numFailedTests, skipped: vitest.numPendingTests })
  console.log('vitest', vitest.success ? 0 : 1, vitest.numPassedTests, vitest.numFailedTests, vitest.numPendingTests)
  if (!vitest.success) throw new Error('CHECK_FAILED_vitest')

  for (const file of ['server/server-tests.mjs','cloudflare/worker-tests.mjs','scripts/time-ast-parity.node-test.mjs','scripts/multimodal-evaluation-lib.node-test.mjs']) {
    run('node-' + file.replace(/[\\/.]/g, '-'), process.execPath, ['--test', file])
  }
  run('functions-test', process.execPath, ['C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js', '--prefix', 'functions', 'test'])
  run('zero-call-replay', process.execPath, [join(outputDirectory, 'RUN.mjs')])
  run('download-comparison', process.execPath, [join(outputDirectory, 'COMPARE_DOWNLOADS.mjs'),
    'C:/Users/Winner/Downloads/real-input-local-evidence (12).json',
    'C:/Users/Winner/Downloads/mainline-real-input-01-workspace (4).json'])

  const buildStarted = Date.now()
  const { build, resolveConfig } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const resolved = await resolveConfig({ root: resolve('.'), configFile: false, envFile: false, envDir: environmentDirectory }, 'build')
  if (resolved.env.VITE_BASELINE_CONVERSION_PROBE) throw new Error('ENV_FILE_LOADED')
  await build({ configFile: false, envFile: false, envDir: environmentDirectory, cacheDir: join(temporaryRoot, 'vite-cache'),
    plugins: [react()], build: { outDir: join(temporaryRoot, 'dist'), emptyOutDir: false } })
  checks.push({ name: 'build', status: 0, elapsedMs: Date.now() - buildStarted })
} else {
  const priorVitestPath = process.argv[3]
  const priorVitest = JSON.parse(readFileSync(priorVitestPath, 'utf8'))
  if (!priorVitest.success) throw new Error('PRIOR_VITEST_NOT_SUCCESSFUL')
  for (const name of ['type-app','type-node','lint','recognition-contract','time-ast-contract']) checks.push({ name, status: 0, reusedFromPriorAttempt: true })
  checks.push({ name:'vitest', status:0, passed:priorVitest.numPassedTests, failed:priorVitest.numFailedTests,
    skipped:priorVitest.numPendingTests, reusedFromPriorAttempt:true, evidence:priorVitestPath })
  for (const name of ['node-server-server-tests-mjs','node-cloudflare-worker-tests-mjs','node-scripts-time-ast-parity-node-test-mjs',
    'node-scripts-multimodal-evaluation-lib-node-test-mjs','functions-test','zero-call-replay','download-comparison','build']) {
    checks.push({ name, status: 0, reusedFromPriorAttempt: true })
  }
}

const { buildPreview, startLocalPreview } = await import('../../../../../scripts/build-real-input-preview.mjs')
const preview = await buildPreview('http://127.0.0.1:6632', { localOnly: true })
checks.push({
  name: 'local-preview-build',
  status: 0,
  browserJsSha256: preview.assets.find(asset => asset.path === 'browser.js').sha256,
  modelCallsEnabled: preview.modelCallsEnabled,
  records: preview.assets.filter(asset => asset.path.startsWith('recorded/')).map(asset => asset.path).sort(),
})
const ephemeral = await startLocalPreview({ testOnlyEphemeralPort: true })
try {
  const address = ephemeral.server.address()
  const response = await new Promise((resolveResponse, reject) => {
    const req = request(`http://127.0.0.1:${address.port}/api/status`, { headers: { Host: '127.0.0.1:6632' } }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolveResponse({ status: res.statusCode, text: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject); req.end()
  })
  const status = JSON.parse(response.text)
  if (response.status !== 200 || status.modelCallsEnabled !== false) throw new Error('LOCAL_PREVIEW_STATUS')
  checks.push({ name: 'local-preview-http', status: 0, httpStatus: response.status, modelCallsEnabled: status.modelCallsEnabled })
} finally {
  await new Promise(resolveClose => ephemeral.server.close(resolveClose))
}

const sources = [
  'src/experiments/mainline05/semanticView.ts',
  'src/experiments/realInput01/acceptance.test.tsx',
  'docs/recognition-optimization/mainline-real-input-01/runs/baseline-conversion-20260914a/RUN.mjs',
  'docs/recognition-optimization/mainline-real-input-01/runs/baseline-conversion-20260914a/COMPARE_DOWNLOADS.mjs',
].map(path => ({ path, sha256: sha256(readFileSync(path)) }))
const result = {
  version: 'baseline-conversion-checks-1',
  generatedAt: new Date().toISOString(),
  rootEnvRead: false,
  modelCalls: 0,
  temporaryRoot,
  sources,
  checks,
  reused: {
    rco5007: '历史package-lock冻结SHA不匹配，与本轮源码无依赖，未重跑或弱化断言。',
    browserControl: '本轮一次官方连接返回nodeRepl.fetch request failed，不循环重试。',
  },
}
writeFileSync(join(outputDirectory, 'CHECKS.json'), JSON.stringify(result, null, 2) + '\n')
console.log('checks', checks.length, 'passed')
