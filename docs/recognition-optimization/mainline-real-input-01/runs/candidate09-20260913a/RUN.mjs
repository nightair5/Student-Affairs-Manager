// Final candidate09 engineering gates. Root environment files are never loaded.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const outputDirectory = resolve('docs/recognition-optimization/mainline-real-input-01/runs/candidate09-20260913a')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'candidate09-final-'))
const envDirectory = join(temporaryRoot, 'env')
mkdirSync(envDirectory)
mkdirSync(outputDirectory, { recursive: true })
const step = process.argv[2] ?? 'target'
const attempt = Date.now()
const childEnvironment = { ...process.env,
  VITE_ENV_FILE: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
  REAL_INPUT_TEST_TEMP: join(temporaryRoot, 'budget'),
  REAL_INPUT_CARRIERS_MANIFEST: process.env.REAL_INPUT_CARRIERS_MANIFEST
    ?? 'C:/Users/Winner/AppData/Local/Temp/real-input-carriers-e1da8dbf1e8a4f5a9732c02f6469c24f/carriers.json' }
delete childEnvironment.DEEPSEEK_API_KEY
mkdirSync(childEnvironment.REAL_INPUT_TEST_TEMP)
process.env.REAL_INPUT_CARRIERS_MANIFEST = childEnvironment.REAL_INPUT_CARRIERS_MANIFEST

function run(name, args, options = {}) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true,
    maxBuffer: 64 * 1024 * 1024, env: childEnvironment, ...options })
  writeFileSync(join(outputDirectory, `${name}-${attempt}.log`), `${result.stdout ?? ''}${result.stderr ?? ''}`)
  console.log(name, result.status)
  if (result.status !== 0) process.exitCode = 1
}

if (step === 'type') {
  run('type-app', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json', '--incremental',
    '--tsBuildInfoFile', join(temporaryRoot, 'app.tsbuildinfo'), '--pretty', 'false'])
  run('type-node', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.node.json', '--incremental',
    '--tsBuildInfoFile', join(temporaryRoot, 'node.tsbuildinfo'), '--pretty', 'false'])
} else if (step === 'lint') {
  run('lint', ['node_modules/eslint/bin/eslint.js', '.'])
} else if (step === 'build') {
  const { build, resolveConfig } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const probe = join(temporaryRoot, 'probe')
  mkdirSync(probe)
  writeFileSync(join(probe, '.env'), 'VITE_CANDIDATE09_ISOLATION_PROBE=must_not_load\n')
  const resolved = await resolveConfig({ root: probe, configFile: false, envFile: false, envDir: envDirectory }, 'build')
  if (resolved.env.VITE_CANDIDATE09_ISOLATION_PROBE) throw new Error('CANDIDATE09_ENV_ISOLATION_FAILED')
  await build({ configFile: false, envFile: false, envDir: envDirectory, cacheDir: join(temporaryRoot, 'vite-cache'),
    plugins: [react()], build: { outDir: join(temporaryRoot, 'dist'), emptyOutDir: false } })
  console.log('build 0', temporaryRoot)
} else if (step === 'node') {
  run('budget', ['--test', 'scripts/real-input-budget.node-test.mjs'])
  run('gateway', ['--test', 'scripts/real-input-model-gateway.node-test.mjs'])
} else if (step === 'node09') {
  run('budget09', ['--test', '--test-name-pattern=paired09', 'scripts/real-input-budget.node-test.mjs'])
  run('gateway09', ['--test', '--test-name-pattern=paired09', 'scripts/real-input-model-gateway.node-test.mjs'])
} else {
  const { startVitest } = await import('vitest/node')
  const resultPath = join(outputDirectory, `target-${attempt}.json`)
  const files = step === 'full' ? [] : ['acceptance','port'].includes(step) ? ['src/experiments/realInput01/acceptance.test.tsx'] : [
    'src/experiments/realInput01/candidate09.test.ts',
    'src/experiments/realInput01/evidenceRoleWireV2.test.ts'
  ]
  const context = await startVitest('test', files, { config: false, configFile: false, envFile: false, envDir: envDirectory,
    ...(step === 'acceptance' ? {testNamePattern:'paired09'} : {}),
    ...(step === 'port' ? {testNamePattern:'local preview server serves only'} : {}),
    cacheDir: join(temporaryRoot, 'vitest-cache'), watch: false, passWithNoTests: false,
    reporters: ['dot', 'json'], outputFile: resultPath },
  { configFile: false, envFile: false, envDir: envDirectory, cacheDir: join(temporaryRoot, 'vitest-cache') })
  await context?.close()
  const result = JSON.parse(readFileSync(resultPath, 'utf8'))
  console.log('target', result.success ? 0 : 1, result.numPassedTests, result.numTotalTests)
  if (!result.success) process.exitCode = 1
}
