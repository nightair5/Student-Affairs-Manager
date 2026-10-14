import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, realpathSync, readdirSync } from 'node:fs'
import { resolve, join, dirname, relative, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
assert.equal(root.toLowerCase(), 'c:\\users\\winner\\student-affairs-multimodal-exp')
assert.equal(realpathSync(process.cwd()), root)
const report = 'docs/recognition-optimization/mainline-04-i1/'
const read = path => readFileSync(resolve(root, path))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const r2 = process.argv.includes('--stage=R2')
const r2BaselineSha = '4ebbe389a1093b328942f0920d9f254f40c02a54c7ba158f29fba70b73497ac9'
const baselinePath = report + (r2 ? 'R2_BASELINE.json' : 'BASELINE.json')
const baseline = JSON.parse(read(baselinePath))
const git = args => execFileSync('git', args, { cwd: root, windowsHide: true }).toString().trim()
let activeReview = null, activeReviewSha = null
function reportPath(name) {
  if (r2) assert.ok(/^[A-Za-z0-9][A-Za-z0-9_.-]*\.json$/.test(name) && !name.includes('..'), 'REPORT_PATH_INVALID')
  return report + (r2 ? 'R2_' : '') + name
}
function r2State() {
  const paths = [...new Set([...baseline.files.map(f => f.path), ...baseline.allowed])]
  return { head: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']), baselineSha: sha(read(baselinePath)),
    hashes: Object.fromEntries(paths.map(path => [path, sha(read(path))])),
    logPrefixSha: sha(read(baseline.dynamic[1]).subarray(0, baseline.logBytes)),
    changedPaths: execFileSync('git', ['status', '--porcelain=v1', '-z', '-uall'], { cwd: root }).toString().split('\0').filter(Boolean).map(line => line.slice(3)) }
}
function validateR2(state, review = null) {
  assert.equal(state.baselineSha, r2BaselineSha, 'R2_BASELINE_CHANGED')
  assert.equal(state.head, baseline.head, 'BASELINE_HEAD_CHANGED')
  assert.equal(state.branch, baseline.branch, 'BRANCH_CHANGED')
  assert.equal(state.logPrefixSha, baseline.logPrefixSha256, 'LOG_PREFIX_CHANGE')
  for (const file of baseline.files) assert.equal(state.hashes[file.path], file.sha256, 'PROTECTED_CHANGE:' + file.path)
  for (const file of baseline.readonlyImplementation) assert.equal(state.hashes[file.path], file.sha256, 'READONLY_IMPLEMENTATION_CHANGE')
  const allowed = new Set([...baseline.allowed, ...baseline.dynamic])
  for (const path of state.changedPaths) assert.ok(allowed.has(path)
    || (path.startsWith(baseline.reportPrefix) && /^[A-Za-z0-9_.-]+$/.test(path.slice(baseline.reportPrefix.length)) && !path.includes('..')), 'OUT_OF_SCOPE:' + path)
  if (review) {
    assert.equal(review.stage, baseline.stage, 'REVIEW_STAGE_CHANGED')
    assert.equal(review.baselineSha256, r2BaselineSha, 'REVIEW_BASELINE_CHANGED')
    assert.equal(review.decision, 'PASS', 'INDEPENDENT_REVIEW_REQUIRED')
    assert.deepEqual(review.files.map(f => f.path).sort(), [...baseline.allowed].sort(), 'REVIEW_FILE_SET')
    for (const file of review.files) assert.equal(state.hashes[file.path], file.sha256, 'REVIEW_SNAPSHOT_CHANGED')
  }
  return { checked: baseline.files.length, changed: [], appendOnly: true, outOfScope: [], readonlyImplementation: 7 }
}
function selfCheckR2() {
  const state = r2State(), review = { stage: baseline.stage, baselineSha256: r2BaselineSha, decision: 'PASS',
    files: baseline.allowed.map(path => ({ path, sha256: state.hashes[path] })) }
  // In-memory review below tests the gate; it never authorizes --full.
  validateR2(state, review)
  const cases = [
    ['wrong-head', s => { s.head = 'wrong' }], ['wrong-branch', s => { s.branch = 'wrong' }],
    ['baseline-tamper', s => { s.baselineSha = 'wrong' }], ['log-prefix', s => { s.logPrefixSha = 'wrong' }],
    ['semantic-sha', s => { s.hashes[baseline.readonlyImplementation[0].path] = 'wrong' }],
    ['protected-change', s => { s.hashes[baseline.files[0].path] = 'wrong' }],
    ['missing-protected', s => { delete s.hashes[baseline.files[0].path] }],
    ['checker-review-sha', s => { s.hashes['scripts/check-mainline-04-i1.mjs'] = 'wrong' }],
    ['review-blocked', (s, r) => { r.decision = 'BLOCKED' }],
    ['review-old-stage', (s, r) => { r.stage = 'RCO-5-MAINLINE-04-I1-R1' }],
    ['review-old-baseline', (s, r) => { r.baselineSha256 = 'wrong' }],
    ['review-missing-file', (s, r) => { r.files.pop() }],
    ['review-duplicate-file', (s, r) => { r.files.push(r.files[0]) }],
    ['old-report-write', s => { s.changedPaths.push(report + 'REVIEW.json') }],
    ['path-traversal', s => { s.changedPaths.push(baseline.reportPrefix + '../outside.json') }],
    ['extra-source', s => { s.changedPaths.push('src/experiments/mainline04/extra.ts') }],
  ]
  for (const [, mutate] of cases) { const s = structuredClone(state), r = structuredClone(review); mutate(s, r); assert.throws(() => validateR2(s, r)) }
  assert.equal(reportPath('SELF_CHECK.json'), baseline.reportPrefix + 'SELF_CHECK.json')
  for (const path of ['../CHECKS.json', 'C:/outside.json', 'R1_../../CHECKS.json', 'nested/file.json']) assert.throws(() => reportPath(path))
  return { passed: cases.length + 6, failed: 0, cases: ['valid-current-review', ...cases.map(c => c[0]), 'valid-report-path', 'relative-escape', 'absolute-escape', 'embedded-escape', 'nested-report'], syntheticReviewOnly: true }
}
function protect() {
  if (r2) {
    const result = validateR2(r2State(), activeReview)
    const prior = JSON.parse(read(baseline.sourceReview.path))
    assert.equal(prior.decision, 'PASS', 'R1_CODE_REVIEW_REQUIRED')
    for (const file of baseline.readonlyImplementation) assert.ok(prior.files.some(f => f.path === file.path && f.sha256 === file.sha256), 'R1_REVIEW_SOURCE_BINDING')
    if (activeReview) assert.equal(sha(read(reportPath('REVIEW.json'))), activeReviewSha, 'ACTIVE_REVIEW_CHANGED')
    return result
  }
  assert.equal(git(['branch', '--show-current']), baseline.branch)
  assert.equal(git(['rev-parse', 'HEAD']), baseline.head, 'BASELINE_HEAD_CHANGED')
  const changed = baseline.files.filter(item => sha(read(item.path)) !== item.sha256).map(item => item.path)
  assert.deepEqual(changed, [], 'PROTECTED_CHANGE')
  const log = read('docs/recognition-optimization/OPTIMIZATION_LOG.md')
  assert.equal(sha(log.subarray(0, baseline.logBytes)), baseline.logPrefixSha256, 'LOG_PREFIX_CHANGE')
  const allowed = new Set([...baseline.allowed, 'docs/recognition-optimization/CURRENT_CONTEXT.md', 'docs/recognition-optimization/OPTIMIZATION_LOG.md'])
  const status = execFileSync('git', ['status', '--porcelain=v1', '-z', '-uall'], { cwd: root }).toString().split('\0').filter(Boolean)
  const outOfScope = status.map(line => line.slice(3)).filter(path => !allowed.has(path) && !path.startsWith(report))
  assert.deepEqual(outOfScope, [], 'OUT_OF_SCOPE')
  return { checked: baseline.files.length, changed, appendOnly: true, outOfScope }
}
const mode = process.argv[2]
assert.ok((r2 ? ['--protect', '--self-check', '--targeted', '--full'] : ['--protect', '--red', '--targeted', '--full']).includes(mode), 'EXPLICIT_MODE_REQUIRED')
if (r2 && mode === '--full') {
  activeReview = JSON.parse(read(reportPath('REVIEW.json')))
  activeReviewSha = sha(read(reportPath('REVIEW.json')))
}
protect()
if (mode === '--protect') console.log(JSON.stringify(protect()))
else {
  if (r2) assert.match(process.argv[3] ?? '', /^[a-z0-9-]+$/)
  const location = resolve(root, reportPath('TEMP_DIRECTORY.json'))
  const prefix = r2 ? 'rco-mainline04-i1-r2-' : 'rco-mainline04-i1-'
  if (!existsSync(location)) writeFileSync(location, JSON.stringify({ path: mkdtempSync(join(tmpdir(), prefix)),
    ...(r2 ? { stage: baseline.stage, baselineSha256: r2BaselineSha } : {}) }, null, 2), { flag: 'wx' })
  const temporaryRecord = JSON.parse(readFileSync(location)), temporary = temporaryRecord.path
  const temporaryRelative = relative(realpathSync(tmpdir()), realpathSync(temporary))
  assert.ok(temporaryRelative.startsWith(prefix))
  if (r2) {
    assert.equal(temporaryRecord.stage, baseline.stage); assert.equal(temporaryRecord.baselineSha256, r2BaselineSha)
    assert.equal(temporaryRelative.split(/[\\/]/).length, 1, 'TEMP_DIRECTORY_ESCAPE')
  }
  const attempt = process.argv[3]
  assert.match(attempt ?? '', /^[a-z0-9-]+$/)
  const directory = join(temporary, attempt); mkdirSync(directory)
  if (mode === '--full') {
    const review = JSON.parse(read(reportPath('REVIEW.json')))
    assert.equal(review.decision, 'PASS', 'INDEPENDENT_REVIEW_REQUIRED')
    assert.deepEqual(review.files.map(f => f.path).sort(), [...baseline.allowed].sort())
    for (const file of review.files) assert.equal(sha(read(file.path)), file.sha256, 'REVIEW_SNAPSHOT_CHANGED')
    await fullEngineering(directory)
  } else if (r2 && mode === '--self-check') {
    const summary = { stage: baseline.stage, attempt, directory, ...selfCheckR2(), protection: protect(), externalModelCalls: 0 }
    writeFileSync(resolve(root, reportPath(attempt + '.json')), JSON.stringify(summary, null, 2), { flag: 'wx' })
    console.log(JSON.stringify(summary))
  } else {
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/experiments/mainline04',
    '--config', 'scripts/mainline-01.vitest.config.mts', '--reporter=json', '--outputFile=' + join(directory, 'vitest.json')],
  { cwd: root, windowsHide: true, encoding: 'utf8', env: { ...process.env, RUN_LIVE_OCR_COMPONENT: '0' }, maxBuffer: 16 * 1024 * 1024 })
  const output = (result.stdout ?? '') + (result.stderr ?? '')
  writeFileSync(join(directory, 'run.log'), output, { flag: 'wx' })
  const checks = existsSync(join(directory, 'vitest.json')) ? JSON.parse(readFileSync(join(directory, 'vitest.json'))) : null
  const summary = { mode, attempt, directory, exitCode: result.status, passed: checks?.numPassedTests ?? 0,
    failed: checks?.numFailedTests ?? 0, total: checks?.numTotalTests ?? 0,
    failures: checks?.testResults.filter(item => item.status !== 'passed').map(item => ({ name: item.name, message: item.message })) ?? [output.slice(-1500)],
    logSha256: sha(Buffer.from(output)), protection: protect(), externalModelCalls: 0 }
  writeFileSync(resolve(root, reportPath(attempt + '.json')), JSON.stringify(summary, null, 2), { flag: 'wx' })
  console.log(JSON.stringify(summary))
  process.exitCode = mode === '--red' ? (result.status === 0 ? 1 : 0) : result.status ?? 1
  }
}

/** Reuse the R3 layer method, never its old-phase entry point or whitelist.
 * Historical files are copied byte-for-byte from its already verified snapshot. */
async function fullEngineering(directory) {
  const checks = [], environment = { node: process.version, currentHistoricalGate: { status: 'R2_FAIL_PRESERVED_NOT_RERUN', passed: 3, failed: 1 } }
  const record = (name, result) => { checks.push({ name, ...result }); console.log(JSON.stringify({ name, ...result, log: result.log })) }
  function run(name, args, cwd = root) {
    protect()
    const child = spawnSync(process.execPath, args, { cwd, windowsHide: true, encoding: 'utf8',
      env: { ...process.env, RUN_LIVE_OCR_COMPONENT: '0' }, maxBuffer: 32 * 1024 * 1024 })
    const output = (child.stdout ?? '') + (child.stderr ?? ''), log = join(directory, name + '.log')
    writeFileSync(log, output, { flag: 'wx' })
    record(name, { exitCode: child.status, log, sha256: sha(Buffer.from(output)),
      summary: output.split(/\r?\n/).filter(l => /Test Files|Tests\s|[#ℹ] (tests|pass|fail|skipped)|vulnerabilities|error TS|FAIL|Error:/.test(l)).slice(-12) })
    protect(); assert.equal(child.status, 0, name + '_FAILED')
  }
  let okay = false
  try {
    const prior = JSON.parse(read('docs/recognition-optimization/mainline-03-i1/R3_ENGINEERING_CHECKS.json'))
    assert.equal(prior.okay, true)
    const original = prior.environment.historicalSnapshot
    const freezePath = 'docs/recognition-optimization/RCO-5-007_COMPONENT_FREEZE.json'
    const freeze = JSON.parse(read(freezePath))
    const approved = [...new Set([...freeze.predictionDependencyPaths, ...freeze.scoringDependencyPaths, ...freeze.protectedArtifactPaths,
      freezePath, 'scripts/rco-5-007-replay.node-test.mjs', 'docs/recognition-optimization/rco-5-007-replay/result.json'])].sort()
    assert.deepEqual(original.manifest.map(f => f.path).sort(), approved, 'HISTORICAL_FILE_SET')
    const snapshot = join(directory, 'historical-snapshot'), manifest = []
    const protectedMap = new Map(baseline.files.map(f => [f.path, f.sha256]))
    for (const item of original.manifest) {
      assert.ok(!isAbsolute(item.path) && !item.path.split('/').includes('..') && protectedMap.has(item.path))
      assert.equal(item.sha256, freeze.sha256[item.path] ?? protectedMap.get(item.path), 'FREEZE_BINDING')
      const bytes = readFileSync(resolve(original.path, item.path))
      assert.equal(sha(bytes), item.sha256, 'HISTORICAL_BYTES_CHANGED')
      const target = resolve(snapshot, item.path); assert.ok(!relative(snapshot, target).startsWith('..'))
      mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: 'wx' })
      assert.equal(sha(readFileSync(target)), item.sha256)
      manifest.push({ path: item.path, sha256: item.sha256 })
    }
    environment.historicalSnapshot = { path: snapshot, source: original.path, manifest }
    record('historical-integrity', { passed: manifest.length, failed: 0 })
    const oldPackage = JSON.parse(readFileSync(join(snapshot, 'package.json'))), oldLock = JSON.parse(readFileSync(join(snapshot, 'package-lock.json')))
    const currentPackage = JSON.parse(read('package.json')), currentLock = JSON.parse(read('package-lock.json'))
    const allowedTypes = Object.fromEntries(JSON.parse(read('docs/recognition-optimization/mainline-03-i1/R2_DEPENDENCY_RESULT.json')).packages.map(({ path, ...value }) => [path, value]))
    function compatible(p, l) {
      assert.equal(p.devDependencies['@types/node'], '24.13.3')
      const stripped = structuredClone(p); delete stripped.devDependencies['@types/node']
      assert.ok(isDeepStrictEqual(stripped, oldPackage), 'PACKAGE_DRIFT')
      const oldTop = { ...oldLock }, newTop = { ...l }; delete oldTop.packages; delete newTop.packages
      assert.ok(isDeepStrictEqual(oldTop, newTop))
      assert.deepEqual(Object.keys(l.packages).filter(k => !Object.hasOwn(oldLock.packages, k)).sort(), Object.keys(allowedTypes).sort())
      for (const [key, value] of Object.entries(oldLock.packages)) {
        const next = structuredClone(l.packages[key]); if (key === '') delete next.devDependencies['@types/node']
        assert.ok(isDeepStrictEqual(next, value), 'ORIGINAL_LOCK_DRIFT')
      }
      for (const [key, value] of Object.entries(allowedTypes)) assert.ok(isDeepStrictEqual(l.packages[key], value), 'TYPE_LOCK_DRIFT')
    }
    compatible(currentPackage, currentLock)
    const negativeCases = [
      ['third-package', (p, l) => { l.packages['node_modules/extra'] = { version: '1' } }],
      ['node-version', p => { p.devDependencies['@types/node'] = '24.13.4' }],
      ['transitive-version', (p, l) => { l.packages['node_modules/undici-types'].version = '0' }],
      ['runtime-dependency', p => { p.dependencies.react = '0' }],
      ['production-type', (p, l) => { l.packages['node_modules/@types/node'].dev = false }],
      ['old-lock-version', (p, l) => { l.packages['node_modules/react'].version = '0' }],
      ['integrity-drift', (p, l) => { l.packages['node_modules/@types/node'].integrity += 'x' }],
      ['script-drift', p => { p.scripts.lint = 'skip' }],
      ['lock-root-drift', (p, l) => { l.packages[''].dependencies.react = '0' }],
      ['missing-old-package', (p, l) => { delete l.packages['node_modules/react'] }],
    ]
    for (const [, mutate] of negativeCases) {
      const p = structuredClone(currentPackage), l = structuredClone(currentLock); mutate(p, l)
      assert.throws(() => compatible(p, l))
    }
    const historicalBytes = readFileSync(join(snapshot, 'package.json')), originalSha = sha(historicalBytes)
    assert.notEqual(sha(Buffer.concat([historicalBytes, Buffer.from(' ')])), originalSha)
    assert.notEqual(sha(Buffer.from(historicalBytes.toString().replace(/\r\n/g, '\n'))), originalSha)
    record('current-dependency-compatibility', { passed: negativeCases.length + 3, failed: 0,
      cases: ['authorized-two-dev-types', ...negativeCases.map(([name]) => name), 'historical-byte-tamper', 'historical-newline-tamper'],
      oldNonRootEntries: Object.keys(oldLock.packages).length - 1, additions: Object.keys(allowedTypes) })
    run('historical-original-library', ['--test', 'scripts/rco-5-007-replay.node-test.mjs'], snapshot)
    for (const item of manifest) assert.equal(sha(readFileSync(resolve(snapshot, item.path))), item.sha256)
    const commands = [
      ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
      ['type-app', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.app.json', '--incremental', 'false', '--pretty', 'false']],
      ['type-node', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.node.json', '--incremental', 'false', '--pretty', 'false']],
      ['schema-contract', ['scripts/generate-recognition-contract.mjs', '--check']],
      ['time-contract', ['scripts/generate-time-ast.mjs', '--check']],
      ['vitest-all', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/mainline-01.vitest.config.mts', '--reporter=dot']],
      ['server', ['--test', 'server/server-tests.mjs']], ['worker', ['--test', 'cloudflare/worker-tests.mjs']],
      ['time-parity', ['--test', 'scripts/time-ast-parity.node-test.mjs']],
      ['multimodal-library', ['--test', 'scripts/multimodal-evaluation-lib.node-test.mjs']], ['functions', ['--test', 'functions/functions-tests.mjs']],
    ]
    for (const [name, args] of commands) run(name, args)
    let buildOutput = ''
    const logger = { info: s => { buildOutput += s + '\n' }, warn: s => { buildOutput += s + '\n' }, warnOnce: s => { buildOutput += s + '\n' },
      error: s => { buildOutput += s + '\n' }, clearScreen() {}, hasErrorLogged() { return false }, hasWarned: false }
    try { await build({ configFile: false, envFile: false, envDir: false, plugins: [react()], base: '/', customLogger: logger,
      cacheDir: join(directory, 'vite-cache'), build: { outDir: join(directory, 'build'), emptyOutDir: false } }) }
    finally { writeFileSync(join(directory, 'build.log'), buildOutput, { flag: 'wx' }) }
    record('build', { status: 'PASS', log: join(directory, 'build.log'), sha256: sha(Buffer.from(buildOutput)) })
    const assets = readdirSync(join(directory, 'build'), { recursive: true, withFileTypes: true }).filter(e => e.isFile())
    for (const item of assets) {
      if (!/\.(js|mjs|css|html|json|map)$/.test(item.name)) continue
      const text = readFileSync(join(item.parentPath, item.name), 'utf8')
      assert.ok(!['mainline04-task-semantics-1', 'mainline04-review-package-1', 'mainline03-receipt-1', 'UNREPRESENTABLE_CONDITION_STATE'].some(m => text.includes(m)), 'STABLE_BUNDLE_EXPERIMENT_IMPORT')
    }
    record('stable-bundle-isolation', { files: assets.length, findings: 0 })
    run('security-scan', ['scripts/scan-secrets.mjs'])
    for (const file of ['empty-user.npmrc', 'empty-global.npmrc']) writeFileSync(join(directory, file), '', { flag: 'wx' })
    run('dependency-audit', ['C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js', 'audit', '--audit-level=high', '--ignore-scripts',
      '--registry=https://registry.npmjs.org', '--userconfig=' + join(directory, 'empty-user.npmrc'),
      '--globalconfig=' + join(directory, 'empty-global.npmrc'), '--cache=' + join(directory, 'npm-audit-cache')])
    okay = true
  } catch (error) { record('failure', { status: 'FAIL', message: error.message }) }
  let protection
  try { protection = protect() } catch (error) { okay = false; protection = { status: 'FAIL', message: error.message } }
  const summary = { stage: baseline.stage, directory, okay, environment, checks, protection, modelCalls: 0, modelNetwork: 0, feesCny: 0,
    modelAccuracy: '本轮未测量', newSemanticApp: 'NOT_RUN', newSemanticCanonical: 'NOT_RUN' }
  writeFileSync(join(directory, 'ENGINEERING_CHECKS.json'), JSON.stringify(summary, null, 2), { flag: 'wx' })
  writeFileSync(resolve(root, reportPath('ENGINEERING_CHECKS.json')), JSON.stringify(summary, null, 2), { flag: 'wx' })
  process.exitCode = okay ? 0 : 1
}
