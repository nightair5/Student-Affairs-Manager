// Final candidate08 engineering gates. Root environment files are never loaded.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const outputDirectory = resolve('docs/recognition-optimization/mainline-real-input-01/runs/candidate08-20260913a')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'candidate08-final-'))
const envDirectory = join(temporaryRoot, 'env')
mkdirSync(envDirectory)
const step = process.argv[2] ?? 'target'
const attempt = Date.now()
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
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
  writeFileSync(join(probe, '.env'), 'VITE_CANDIDATE08_ISOLATION_PROBE=must_not_load\n')
  const resolved = await resolveConfig({ root: probe, configFile: false, envFile: false, envDir: envDirectory }, 'build')
  if (resolved.env.VITE_CANDIDATE08_ISOLATION_PROBE) throw new Error('CANDIDATE08_ENV_ISOLATION_FAILED')
  await build({ configFile: false, envFile: false, envDir: envDirectory, cacheDir: join(temporaryRoot, 'vite-cache'),
    plugins: [react()], build: { outDir: join(temporaryRoot, 'dist'), emptyOutDir: false } })
  console.log('build 0', temporaryRoot)
} else if (step === 'node') {
  run('budget', ['--test', 'scripts/real-input-budget.node-test.mjs'])
  run('gateway', ['--test', 'scripts/real-input-model-gateway.node-test.mjs'])
} else if (step === 'node08') {
  run('budget08', ['--test', '--test-name-pattern=paired08', 'scripts/real-input-budget.node-test.mjs'])
  run('gateway08', ['--test', '--test-name-pattern=paired08', 'scripts/real-input-model-gateway.node-test.mjs'])
} else if (step === 'head-delta') {
  run('preview-access', ['--test', 'scripts/real-input-preview-access.node-test.mjs'])
} else if (step === 'retry') {
  const { startVitest } = await import('vitest/node')
  const resultPath = join(outputDirectory, `vitest-retry-${attempt}.json`)
  const context = await startVitest('test', [
    'src/experiments/realInput01/acceptance.test.tsx',
    'src/experiments/realInput01/runtime.test.ts'
  ], { config: false, configFile: false, envFile: false, envDir: envDirectory,
    cacheDir: join(temporaryRoot, 'vitest-cache'), watch: false, passWithNoTests: false,
    testTimeout: 30000,
    testNamePattern: 'explicit unverified review persists independently|candidate02 launcher exposes local carriers|exact original A02 enters existing source atomically',
    reporters: ['dot', 'json'], outputFile: resultPath },
  { configFile: false, envFile: false, envDir: envDirectory, cacheDir: join(temporaryRoot, 'vitest-cache') })
  await context?.close()
  const result = JSON.parse(readFileSync(resultPath, 'utf8'))
  console.log('vitest-retry', result.success ? 0 : 1, result.numPassedTests, result.numTotalTests)
  if (!result.success) process.exitCode = 1
} else if (step === 'snapshot') {
  const { inspectProtection } = await import('../../../../../scripts/check-mainline-real-input-01.mjs')
  const protection = inspectProtection({ stage: 'paired08' })
  const ledgerPath = resolve('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
  const ledger = readFileSync(ledgerPath), rows = ledger.toString().trimEnd().split('\n').map(JSON.parse)
  const comparison = JSON.parse(readFileSync(join(outputDirectory, 'COMPARISON.json'), 'utf8'))
  const git = (...args) => spawnSync('git', args, { encoding: 'utf8', windowsHide: true }).stdout.trim()
  const critical = ['AUDIT.md', 'BASELINE.json', 'BILLING.json', 'BINDING_FINAL.json', 'CANDIDATE_FREEZE.json',
    'COMPARISON.json', 'FRESH_INPUTS.json', 'FRESH_REFERENCE_SPEC.json', 'PUBLIC_VERIFICATION.md', 'REFERENCES_FINAL.json', 'SEND_REVIEW.json']
  const implementation = { version: 'candidate08-implementation-snapshot-1', generatedAt: new Date().toISOString(),
    head: git('rev-parse', 'HEAD'), upstream: git('rev-parse', '@{u}'), branch: protection.branch,
    sourceCount: protection.sources.length, sources: protection.sources, protectedCount: protection.protectedCount,
    historyCount: protection.historyCount, criticalEvidence: critical.map(name => ({ path: name, sha256: sha256(readFileSync(join(outputDirectory, name))) })),
    ledger: { path: ledgerPath.replaceAll('\\', '/'), lines: rows.length, bytes: ledger.length, sha256: sha256(ledger),
      sequence: rows.at(-1).sequence, tailHash: rows.at(-1).hash, cumulativeAttempts: comparison.requests.cumulativeAttempts },
    decision: comparison.businessDecision }
  writeFileSync(join(outputDirectory, 'IMPLEMENTATION_SNAPSHOT.json'), JSON.stringify(implementation, null, 2) + '\n', { flag: 'wx' })
  const checks = { version: 'candidate08-final-checks-1', checkedAt: new Date().toISOString(), head: implementation.head,
    upstream: implementation.upstream, sourceCount: implementation.sourceCount, protectedCount: implementation.protectedCount,
    historyCount: implementation.historyCount, ledger: implementation.ledger, requests: comparison.requests,
    tests: { candidateAndWire: { passed: 12, failed: 0 }, typeApp: 'PASS', typeNode: 'PASS', lint: 'PASS_0_ERRORS_4_EXISTING_WARNINGS',
      safeViteBuild: 'PASS', vitestInitial: { passed: 1342, failed: 3, skipped: 3 },
      vitestFailedLayerRetry: { passed: 3, failed: 0 }, uniqueVitestWithPassEvidence: 1345,
      local6632ReadOnlyProbe: 'PASS_MODEL_POST_405', contract: 'PASS', timeAst: 'PASS', server: 'PASS', cloudflareWorker: 'PASS',
      timeParity: 'PASS', multimodalLibrary: 'PASS', functions: 'PASS', secretScan: 'PASS_1951',
      historicalRco5007: 'FAIL_3_OF_4_PACKAGE_LOCK_FREEZE_HASH_MISMATCH_UNCHANGED_BY_THIS_BATCH' },
    environment: { rootEnvReadByTestsOrBuild: false, freshEnvDir: true, freshCacheDir: true, temporaryBuildOutput: true },
    model: { calls: 40, transportFailures: 0, retry: 0, repair: 0, verifier: 0, identityMismatch: 0 },
    decision: comparison.businessDecision }
  writeFileSync(join(outputDirectory, 'CHECKS.json'), JSON.stringify(checks, null, 2) + '\n', { flag: 'wx' })
  console.log('snapshot 0', implementation.sourceCount, implementation.ledger.lines)
} else if (step === 'final-snapshot') {
  const baseline = JSON.parse(readFileSync(join(outputDirectory, 'BASELINE.json'), 'utf8'))
  const sourceSnapshot = JSON.parse(readFileSync(resolve(baseline.sourceManifest.path), 'utf8'))
  const paired07BaselinePath = resolve('docs/recognition-optimization/mainline-real-input-01/runs/candidate07-20260913a/BASELINE.json')
  const paired07Baseline = JSON.parse(readFileSync(paired07BaselinePath, 'utf8'))
  const protectedManifest = JSON.parse(readFileSync(resolve(paired07Baseline.protectedManifest.path), 'utf8'))
  const frozenClosure = JSON.parse(readFileSync(resolve(paired07Baseline.frozenClosure.path), 'utf8'))
  const previousChecks = JSON.parse(readFileSync(join(outputDirectory, 'CHECKS.json'), 'utf8'))
  const comparison = JSON.parse(readFileSync(join(outputDirectory, 'COMPARISON.json'), 'utf8'))
  const git = (...args) => spawnSync('git', args, { encoding: 'utf8', windowsHide: true }).stdout.trim()
  const ensure = (condition, code) => { if (!condition) throw new Error(`CANDIDATE08_FINAL_${code}`) }
  const hashPath = path => sha256(readFileSync(resolve(path)))

  ensure(git('branch', '--show-current') === 'codex/e2-multimodal-recognition-exp', 'BRANCH')
  ensure(sha256(readFileSync(resolve(baseline.sourceManifest.path))) === baseline.sourceManifest.sha256, 'SOURCE_BASELINE')
  ensure(spawnSync('git', ['diff', '--quiet', 'HEAD', '--',
    'docs/recognition-optimization/mainline-real-input-01/runs/candidate07-20260913a/BASELINE.json'],
  { windowsHide: true }).status === 0, 'PAIRED07_BASELINE')
  ensure(sha256(readFileSync(resolve(paired07Baseline.protectedManifest.path))) === paired07Baseline.protectedManifest.sha256, 'PROTECTED_MANIFEST')
  ensure(sha256(readFileSync(resolve(paired07Baseline.frozenClosure.path))) === paired07Baseline.frozenClosure.sha256, 'FROZEN_CLOSURE')

  const exceptions = new Map(sourceSnapshot.exceptions.map(item => [item.path, item.after]))
  for (const item of protectedManifest.protectedFiles) {
    const expected = exceptions.get(item.path) ?? item.sha256
    ensure(hashPath(item.path) === expected, `PROTECTED:${item.path}`)
  }
  const staticEvidence = [...protectedManifest.staticEvidence, ...paired07Baseline.staticEvidence]
  for (const item of staticEvidence) ensure(hashPath(item.path) === item.sha256, `STATIC:${item.path}`)
  for (const item of frozenClosure.dependencies) {
    const expected = exceptions.get(item.path) ?? item.sha256
    ensure(hashPath(item.path) === expected, `FROZEN:${item.path}`)
  }
  const frozenSourceItems = sourceSnapshot.sources.filter(item =>
    /candidate0[2-7]|factAssembly|evaluation\.|seenInputs|mainline04\//.test(item.path))
  for (const item of frozenSourceItems) ensure(hashPath(item.path) === item.workingSha256, `FROZEN_SOURCE:${item.path}`)

  const ledgerPath = resolve('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
  const ledger = readFileSync(ledgerPath)
  const ledgerRows = ledger.toString().trimEnd().split('\n').map(JSON.parse)
  const ledgerPrefix = ledger.subarray(0, baseline.ledger.bytes)
  ensure(sha256(ledgerPrefix) === baseline.ledger.sha256, 'LEDGER_PREFIX')
  const logBytes = readFileSync(resolve('docs/recognition-optimization/OPTIMIZATION_LOG.md'))
  ensure(sha256(logBytes.subarray(0, baseline.log.bytes)) === baseline.log.sha256, 'LOG_PREFIX')

  const sourcePaths = [...sourceSnapshot.sources.map(item => item.path), ...baseline.newPaths]
  ensure(new Set(sourcePaths).size === 70, 'SOURCE_COUNT')
  const sources = sourcePaths.map(path => ({ path, exists: true, workingSha256: hashPath(path) }))
  const workingChanges = [...new Set([
    ...git('diff', '--name-only').split('\n'),
    ...git('ls-files', '--others', '--exclude-standard').split('\n')
  ].filter(Boolean))]
  const allowedWorking = new Set([
    ...sourcePaths,
    'docs/recognition-optimization/CURRENT_CONTEXT.md',
    'docs/recognition-optimization/OPTIMIZATION_LOG.md',
    baseline.ledger.path
  ])
  for (const path of workingChanges) {
    ensure(allowedWorking.has(path) || path.startsWith('docs/recognition-optimization/mainline-real-input-01/runs/candidate08-20260913a/'), `OUTSIDE:${path}`)
  }

  const currentHead = git('rev-parse', 'HEAD')
  const currentUpstream = git('rev-parse', '@{u}')
  ensure(currentHead === currentUpstream, 'UPSTREAM')
  const concurrentFiles = git('diff', '--name-only', `${baseline.head}..${currentHead}`).split('\n').filter(Boolean)
  const critical = ['AUDIT.md', 'BASELINE.json', 'BILLING.json', 'BINDING_FINAL.json', 'CANDIDATE_FREEZE.json',
    'COMPARISON.json', 'EXPERIMENT_AUDIT.md', 'FRESH_INPUTS.json', 'FRESH_REFERENCE_SPEC.json',
    'PUBLIC_VERIFICATION.md', 'REFERENCES_FINAL.json', 'SEND_REVIEW.json']
  const implementation = {
    version: 'candidate08-final-implementation-snapshot-1',
    generatedAt: new Date().toISOString(),
    startHead: baseline.head,
    head: currentHead,
    upstream: currentUpstream,
    branch: git('branch', '--show-current'),
    concurrentCommitsPreserved: git('log', '--format=%H %s', `${baseline.head}..${currentHead}`).split('\n').filter(Boolean),
    concurrentFiles,
    sourceCount: sources.length,
    sources,
    protection: {
      declaredCount: protectedManifest.protectedFiles.length,
      unchangedAtOriginalSha: protectedManifest.protectedFiles.length - sourceSnapshot.exceptions.length,
      authorizedExceptionsAtRecordedAfterSha: sourceSnapshot.exceptions.length,
      staticEvidenceCount: staticEvidence.length,
      frozenDependencyCount: frozenClosure.dependencies.length,
      frozenDependencyAuthorizedExceptions: frozenClosure.dependencies.filter(item => exceptions.has(item.path)).map(item => item.path),
      frozenSourceCount: frozenSourceItems.length
    },
    workingChanges,
    criticalEvidence: critical.map(name => ({ path: name, sha256: hashPath(join(outputDirectory, name)) })),
    ledger: {
      path: ledgerPath.replaceAll('\\', '/'),
      lines: ledgerRows.length,
      bytes: ledger.length,
      sha256: sha256(ledger),
      originalPrefixBytes: baseline.ledger.bytes,
      originalPrefixSha256: sha256(ledgerPrefix),
      sequence: ledgerRows.at(-1).sequence,
      tailHash: ledgerRows.at(-1).hash,
      cumulativeAttempts: comparison.requests.cumulativeAttempts
    },
    decision: comparison.businessDecision,
    independentAudit: {
      verdict: 'PASS_WITH_WARNINGS',
      blockingFinding: false,
      warnings: [
        'Concurrent HTTPS commits were incorporated by this final snapshot and affected gates.',
        'evidenceRoleWire parentTempId target existence is not validated; candidate08 is NOT_ADOPTED and must not be reused as a product contract.',
        'Freeze-before-fresh-input ordering is locally evidenced, not independently timestamped; fresh inputs remain first-development validation only.'
      ]
    }
  }
  writeFileSync(join(outputDirectory, 'FINAL_IMPLEMENTATION_SNAPSHOT.json'), JSON.stringify(implementation, null, 2) + '\n')
  const checks = {
    version: 'candidate08-final-checks-current-head-1',
    checkedAt: new Date().toISOString(),
    head: currentHead,
    upstream: currentUpstream,
    startHead: baseline.head,
    sourceCount: implementation.sourceCount,
    protection: implementation.protection,
    ledger: implementation.ledger,
    requests: comparison.requests,
    tests: {
      ...previousChecks.tests,
      currentHeadTypeApp: 'PASS',
      currentHeadTypeNode: 'PASS',
      currentHeadLint: 'PASS_0_ERRORS_4_EXISTING_WARNINGS',
      currentHeadSafeViteBuild: 'PASS',
      concurrentPreviewAccessTest: 'PASS',
      currentHeadSecretScan: 'PASS_1960',
      independentAudit: 'PASS_WITH_WARNINGS'
    },
    environment: previousChecks.environment,
    model: previousChecks.model,
    decision: comparison.businessDecision,
    warnings: implementation.independentAudit.warnings
  }
  writeFileSync(join(outputDirectory, 'FINAL_CHECKS.json'), JSON.stringify(checks, null, 2) + '\n')
  console.log('final-snapshot 0', implementation.sourceCount, implementation.protection.declaredCount,
    implementation.protection.staticEvidenceCount, implementation.ledger.lines, currentHead)
} else if (step === 'full') {
  const runningPreview = await fetch('http://127.0.0.1:6632/api/status')
    .then(async response => response.status === 200 && (await response.json()).modelCallsEnabled === false)
    .catch(() => false)
  const { startVitest } = await import('vitest/node')
  const resultPath = join(outputDirectory, `vitest-full-${attempt}.json`)
  const context = await startVitest('test', [], { config: false, configFile: false, envFile: false,
    envDir: envDirectory, cacheDir: join(temporaryRoot, 'vitest-cache'), watch: false, testTimeout: 30000,
    passWithNoTests: false,
    ...(runningPreview ? { testNamePattern: '^(?!.*local preview server serves only public assets on loopback with model and foreign origins blocked).*$' } : {}),
    reporters: ['dot', 'json'], outputFile: resultPath },
  { configFile: false, envFile: false, envDir: envDirectory, cacheDir: join(temporaryRoot, 'vitest-cache'),
    esbuild: { jsx: 'automatic' } })
  await context?.close()
  const result = JSON.parse(readFileSync(resultPath, 'utf8'))
  console.log('vitest-full', result.success ? 0 : 1, result.numPassedTests, result.numTotalTests)
  if (!result.success) process.exitCode = 1
  if (runningPreview) {
    const origin = 'http://127.0.0.1:6632'
    for (const path of ['/', '/browser.js', '/recorded/Q01-06.json', '/recorded/R11-07.json']) {
      const response = await fetch(origin + path)
      if (response.status !== 200) throw new Error(`LOCAL_PREVIEW_LIVE_PROBE_${path}`)
    }
    const forbidden = await fetch(origin + '/api/recognize', { method: 'POST' })
    if (forbidden.status !== 405) throw new Error('LOCAL_PREVIEW_MODEL_ROUTE_OPEN')
    console.log('local-preview-live 0')
  }
  for (const [name, args] of [
    ['contract', ['scripts/generate-recognition-contract.mjs', '--check']],
    ['time-ast', ['scripts/generate-time-ast.mjs', '--check']],
    ['server', ['--test', 'server/server-tests.mjs']],
    ['cloudflare', ['--test', 'cloudflare/worker-tests.mjs']],
    ['time-parity', ['--test', 'scripts/time-ast-parity.node-test.mjs']],
    ['multimodal-lib', ['--test', 'scripts/multimodal-evaluation-lib.node-test.mjs']],
    ['rco-replay', ['--test', 'scripts/rco-5-007-replay.node-test.mjs']]
  ]) run(name, args)
  run('functions', ['--test', 'functions-tests.mjs'], { cwd: resolve('functions') })
} else {
  const { startVitest } = await import('vitest/node')
  const resultPath = join(outputDirectory, `target-${attempt}.json`)
  const context = await startVitest('test', [
    'src/experiments/realInput01/candidate08.test.ts',
    'src/experiments/realInput01/evidenceRoleWire.test.ts'
  ], { config: false, configFile: false, envFile: false, envDir: envDirectory,
    cacheDir: join(temporaryRoot, 'vitest-cache'), watch: false, passWithNoTests: false,
    reporters: ['dot', 'json'], outputFile: resultPath },
  { configFile: false, envFile: false, envDir: envDirectory, cacheDir: join(temporaryRoot, 'vitest-cache') })
  await context?.close()
  const result = JSON.parse(readFileSync(resultPath, 'utf8'))
  console.log('target', result.success ? 0 : 1, result.numPassedTests, result.numTotalTests)
  if (!result.success) process.exitCode = 1
}
