import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
assert.equal(realpathSync(process.cwd()), ROOT, 'WRONG_WORKSPACE')
assert.equal(ROOT.toLowerCase(), 'c:\\users\\winner\\student-affairs-multimodal-exp', 'UNAUTHORIZED_ROOT')
const REPORT = 'docs/recognition-optimization/mainline-03-i1/'
const BASELINE = REPORT + 'R3_BASELINE.json'
const BASELINE_SHA = '10ff4cb081a722b66fceb4b2436d76657ab0690080b4e14891a18fee6f8b70ca'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const read = path => readFileSync(resolve(ROOT, path))
assert.equal(sha(read(BASELINE)), BASELINE_SHA, 'R3_BASELINE_CHANGED')
const baseline = JSON.parse(read(BASELINE))
const protectedHashes = new Map(baseline.files.map(item => [item.path, item.sha256]))
const scriptPath = 'scripts/check-mainline-03-i1-r3.mjs'
const scriptSha = sha(read(scriptPath))
const freezePath = 'docs/recognition-optimization/RCO-5-007_COMPONENT_FREEZE.json'
const historicalTest = 'scripts/rco-5-007-replay.node-test.mjs'
const historicalResult = 'docs/recognition-optimization/rco-5-007-replay/result.json'
const packageNames = ['node_modules/@types/node', 'node_modules/undici-types']
const git = args => execFileSync('git', args, { cwd: ROOT, windowsHide: true })
const json = bytes => JSON.parse(bytes.toString('utf8'))

function protect() {
  assert.equal(git(['branch', '--show-current']).toString().trim(), baseline.branch, 'WRONG_BRANCH')
  assert.equal(sha(read(BASELINE)), BASELINE_SHA, 'R3_BASELINE_CHANGED')
  assert.equal(sha(read(scriptPath)), scriptSha, 'RUNNING_SCRIPT_CHANGED')
  const changed = baseline.files.filter(item => sha(read(item.path)) !== item.sha256).map(item => item.path)
  const log = read('docs/recognition-optimization/OPTIMIZATION_LOG.md')
  const appendOnly = sha(log.subarray(0, baseline.logBytes)) === baseline.logPrefixSha256
  const existing = new Set([...baseline.implementation.map(item => item.path), ...baseline.dynamic, scriptPath])
  const status = git(['status', '--porcelain=v1', '-z', '-uall']).toString().split('\0').filter(Boolean)
  const outOfScope = status.map(line => line.slice(3)).filter(path => !existing.has(path) && !path.startsWith(baseline.allowedNewReports))
  assert.deepEqual(changed, [], 'PROTECTED_CHANGE')
  assert.equal(appendOnly, true, 'LOG_PREFIX_CHANGED')
  assert.deepEqual(outOfScope, [], 'OUT_OF_SCOPE_CHANGE')
  return { checked: baseline.files.length, changed, appendOnly, outOfScope, implementationMatches: 12 }
}

// Reconstruct ONLY the documented R2 dependency patch. Full historical byte hashes
// are mandatory, including its two apply_patch context-line CRLF boundaries.
function verifyHistoricalBytes(bytes, expected, path) {
  assert.equal(sha(bytes), expected, 'HISTORICAL_BYTES_NOT_RECONSTRUCTABLE:' + path)
}

function prepareHistorical() {
  const freeze = json(read(freezePath))
  assert.equal(sha(read(freezePath)), protectedHashes.get(freezePath), 'FREEZE_REFERENCE_CHANGED')
  const files = new Map()
  const bound = [...new Set([...freeze.predictionDependencyPaths, ...freeze.scoringDependencyPaths, ...freeze.protectedArtifactPaths])]
  const paths = [...new Set([...bound, freezePath, historicalTest, historicalResult])]
  for (const path of paths) {
    assert.ok(protectedHashes.has(path), 'UNAPPROVED_HISTORICAL_PATH')
    assert.ok(!isAbsolute(path) && !path.split('/').includes('..'), 'UNSAFE_HISTORICAL_PATH')
    let bytes = read(path), method = 'verified-read-only-workspace-copy'
    if (path === 'package.json') {
      const lines = bytes.toString('utf8').split(/(?<=\n)/)
      const added = lines.filter(line => line.includes('"@types/node"'))
      assert.equal(added.length, 1, 'DEPENDENCY_PATCH_NOT_UNIQUE')
      assert.equal(added[0].trim(), '"@types/node": "24.13.3",', 'DEPENDENCY_PATCH_CHANGED')
      bytes = Buffer.from(lines.filter(line => line !== added[0]).map(line =>
        line.includes('"@napi-rs/canvas"') || line.includes('"@types/react"')
          ? line.replace(/\r?\n$/, '\r\n') : line).join(''))
      method = 'inverse-documented-R2-hunk-exact-byte-hash'
    } else if (path === 'package-lock.json') {
      bytes = Buffer.from(git(['show', baseline.head + ':' + path]).toString('utf8').replace(/\r?\n/g, '\r\n'))
      method = 'R2-start-Git-content-verified-CRLF-byte-hash'
    }
    const expected = freeze.sha256[path] ?? protectedHashes.get(path)
    verifyHistoricalBytes(bytes, expected, path)
    files.set(path, { bytes, sha256: expected, method })
  }
  return { files, bound, freeze, originalPackage: json(files.get('package.json').bytes), originalLock: json(files.get('package-lock.json').bytes) }
}

function compatibility(oldPackage, oldLock, currentPackage, currentLock, expectedAdditions) {
  assert.equal(currentPackage.devDependencies['@types/node'], '24.13.3', 'NODE_TYPE_VERSION')
  const strippedPackage = structuredClone(currentPackage)
  delete strippedPackage.devDependencies['@types/node']
  assert.ok(isDeepStrictEqual(strippedPackage, oldPackage), 'PACKAGE_UNRELATED_DRIFT')
  const oldTop = { ...oldLock }, currentTop = { ...currentLock }
  delete oldTop.packages; delete currentTop.packages
  assert.ok(isDeepStrictEqual(oldTop, currentTop), 'LOCK_TOP_LEVEL_DRIFT')
  const added = Object.keys(currentLock.packages).filter(key => !Object.hasOwn(oldLock.packages, key)).sort()
  assert.deepEqual(added, [...packageNames].sort(), 'LOCK_ADDITION_SET')
  for (const [key, value] of Object.entries(oldLock.packages)) {
    let next = currentLock.packages[key]
    if (key === '') { next = structuredClone(next); delete next.devDependencies['@types/node'] }
    assert.ok(isDeepStrictEqual(next, value), 'EXISTING_LOCK_ENTRY_DRIFT:' + key)
  }
  for (const name of packageNames) {
    const actual = currentLock.packages[name]
    assert.ok(isDeepStrictEqual(actual, expectedAdditions[name]), 'TYPE_LOCK_IDENTITY_DRIFT:' + name)
    assert.equal(actual.dev, true, 'TYPE_NOT_DEV_ONLY')
    assert.equal(actual.license, 'MIT', 'TYPE_LICENSE_CHANGED')
  }
  return { oldNonRootEntries: Object.keys(oldLock.packages).length - 1, added, unrelatedDrift: [] }
}

function compatibilityCases(history) {
  const packageNow = json(read('package.json')), lockNow = json(read('package-lock.json'))
  const expected = Object.fromEntries(json(read(REPORT + 'R2_DEPENDENCY_RESULT.json')).packages.map(({ path, ...value }) => [path, value]))
  const check = (p, l) => compatibility(history.originalPackage, history.originalLock, p, l, expected)
  const result = check(packageNow, lockNow), cases = [{ name: 'authorized-two-dev-types', passed: true }]
  const mutations = [
    ['third-package', (p, l) => { p.devDependencies['r3-extra-type'] = '1.0.0'; l.packages['node_modules/r3-extra-type'] = { version: '1.0.0', dev: true } }],
    ['node-version', p => { p.devDependencies['@types/node'] = '24.13.4' }],
    ['transitive-version', (p, l) => { l.packages['node_modules/undici-types'].version = '7.18.3' }],
    ['runtime-dependency', p => { p.dependencies.react = '0.0.0' }],
    ['production-type', (p, l) => { l.packages['node_modules/@types/node'].dev = false }],
    ['old-lock-version', (p, l) => { l.packages['node_modules/react'].version = '0.0.0' }],
    ['integrity-drift', (p, l) => { l.packages['node_modules/@types/node'].integrity += 'x' }],
    ['script-drift', p => { p.scripts.lint = 'echo skipped' }],
    ['lock-root-drift', (p, l) => { l.packages[''].dependencies.react = '0.0.0' }],
    ['missing-old-package', (p, l) => { delete l.packages['node_modules/react'] }],
  ]
  for (const [name, mutate] of mutations) {
    const p = structuredClone(packageNow), l = structuredClone(lockNow)
    mutate(p, l); assert.throws(() => check(p, l), assert.AssertionError, name)
    cases.push({ name, passed: true, expected: 'REJECT' })
  }
  const historical = history.files.get('package.json')
  assert.throws(() => verifyHistoricalBytes(Buffer.concat([historical.bytes, Buffer.from(' ')]), historical.sha256, 'package.json'), assert.AssertionError)
  cases.push({ name: 'historical-byte-tamper', passed: true, expected: 'REJECT' })
  assert.throws(() => verifyHistoricalBytes(Buffer.from(historical.bytes.toString().replace(/\r\n/g, '\n')), historical.sha256, 'package.json'), assert.AssertionError)
  cases.push({ name: 'historical-newline-tamper', passed: true, expected: 'REJECT' })
  const installed = packageNames.map(name => {
    const p = json(read(name + '/package.json')), lock = lockNow.packages[name]
    assert.equal(p.version, lock.version, 'INSTALLED_TYPE_VERSION')
    assert.equal(p.license, 'MIT', 'INSTALLED_TYPE_LICENSE')
    assert.deepEqual(p.scripts ?? {}, {}, 'TYPE_SCRIPTS_UNEXPECTED')
    return { name: p.name, version: p.version, license: p.license }
  })
  return { ...result, cases, installed }
}

const mode = process.argv[2]
assert.ok(['--protect', '--targeted', '--full'].includes(mode), 'EXPLICIT_MODE_REQUIRED')
protect()
if (mode === '--protect') {
  console.log(JSON.stringify(protect()))
} else {
  const directory = mkdtempSync(join(tmpdir(), 'rco-mainline03-r3-'))
  console.log('CHECK_DIRECTORY=' + directory)
  process.env.RUN_LIVE_OCR_COMPONENT = '0'
  const results = [], environment = { node: process.version, platform: process.platform, scriptSha, baselineSha: BASELINE_SHA,
    currentHistoricalGate: { status: 'R2_FAIL_PRESERVED_NOT_RERUN', passed: 3, failed: 1 } }
  const run = (name, args, cwd = ROOT) => new Promise(resolveRun => {
    let output = ''
    const child = spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', chunk => { output += chunk }); child.stderr.on('data', chunk => { output += chunk })
    child.on('error', error => { output += error.message })
    child.on('close', code => {
      const path = join(directory, name + '.log'); writeFileSync(path, output, { flag: 'wx' })
      const summary = output.split(/\r?\n/).filter(line => /Test Files|Tests\s|[#ℹ] (tests|pass|fail|skipped)|vulnerabilities|error TS|FAIL|Error:/.test(line)).slice(-16)
      const result = { name, exitCode: code, log: path, sha256: sha(Buffer.from(output)), summary }
      results.push(result); console.log(JSON.stringify(result)); resolveRun(code === 0)
    })
  })
  let okay = false
  try {
    const history = prepareHistorical()
    const compatible = compatibilityCases(history)
    results.push({ name: 'current-dependency-compatibility', status: 'PASS', ...compatible })
    console.log(JSON.stringify({ name: 'compatibility', cases: compatible.cases.length, passed: compatible.cases.length }))
    const snapshot = join(directory, 'historical-snapshot')
    const manifest = []
    for (const [path, record] of history.files) {
      const target = resolve(snapshot, path)
      assert.ok(!relative(snapshot, target).startsWith('..'), 'SNAPSHOT_ESCAPE')
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, record.bytes, { flag: 'wx' })
      assert.equal(sha(readFileSync(target)), record.sha256, 'SNAPSHOT_WRITE_MISMATCH')
      manifest.push({ path, sha256: record.sha256, method: record.method })
    }
    environment.historicalSnapshot = { path: snapshot, boundFiles: history.bound.length, totalFiles: manifest.length, manifest,
      note: 'Exact frozen artifact bytes; old library tests use Node core only. No old runner or historical model execution.' }
    writeFileSync(join(directory, 'historical-manifest.json'), JSON.stringify(environment.historicalSnapshot, null, 2), { flag: 'wx' })
    okay = await run('historical-original-library', ['--test', historicalTest], snapshot)
    for (const item of manifest) assert.equal(sha(readFileSync(resolve(snapshot, item.path))), item.sha256, 'HISTORICAL_AFTER_CHANGE')
    results.push({ name: 'historical-snapshot-after', status: 'PASS', checked: manifest.length })
    protect()
    if (okay && mode === '--full') {
      const npmCli = resolve(process.argv[3] ?? '')
      assert.equal(npmCli.toLowerCase(), resolve('C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js').toLowerCase(), 'EXPLICIT_KNOWN_NPM_CLI_REQUIRED')
      const checks = [
        ['bundle', ['scripts/serve-mainline-03-i1.mjs', '--check']],
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
        ['functions', ['--test', 'functions/functions-tests.mjs']],
      ]
      for (const [name, args] of checks) {
        protect()
        if (!await run(name, args)) { okay = false; break }
        protect()
      }
      if (okay) {
        let output = ''
        const logger = { info: text => { output += text + '\n' }, warn: text => { output += text + '\n' },
          warnOnce: text => { output += text + '\n' }, error: text => { output += text + '\n' },
          clearScreen() {}, hasErrorLogged() { return false }, hasWarned: false }
        try {
          await build({ configFile: false, envFile: false, envDir: false, plugins: [react()], base: '/', customLogger: logger,
            cacheDir: join(directory, 'vite-cache'), build: { outDir: join(directory, 'build'), emptyOutDir: false } })
          results.push({ name: 'build', status: 'PASS' })
        } finally { writeFileSync(join(directory, 'build.log'), output, { flag: 'wx' }) }
        const findings = []
        const outputs = readdirSync(join(directory, 'build'), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
        for (const entry of outputs) {
          if (!/\.(?:mjs|js|css|html|json|map)$/.test(entry.name)) continue
          const text = readFileSync(join(entry.parentPath, entry.name), 'utf8')
          const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, /\bsk-[A-Za-z0-9_-]{20,}\b/g,
            /\b(?:DEEPSEEK_API_KEY|CLOUDFLARE_API_TOKEN|FIREBASE_TOKEN|SAM_SYNC_TOKEN|SAM_EMAIL_PROVIDER_TOKEN)\s*[:=]\s*["']?[^\s"']{12,}/gi]
          if (patterns.some(pattern => [...text.matchAll(pattern)].some(match => !/example|placeholder|invalid|test-key|test-only|replace|your[-_ ]|<[^>]+>/i.test(match[0])))) findings.push(entry.name)
          if (['rco-mainline-01-', 'UNREPRESENTABLE_CONDITION_STATE', 'mainline03-receipt-1'].some(marker => text.includes(marker))) findings.push(entry.name + ':experimental-entry-in-stable-bundle')
        }
        results.push({ name: 'new-build-security-isolation', status: findings.length ? 'FAIL' : 'PASS', files: outputs.length, findings })
        assert.deepEqual(findings, [], 'NEW_BUILD_SECURITY_ISOLATION')
        protect()
        okay = await run('security-scan', ['scripts/scan-secrets.mjs'])
        if (okay) okay = await run('dependency-audit', [npmCli, 'audit', '--audit-level=high', '--ignore-scripts',
          '--registry=https://registry.npmjs.org', '--userconfig=' + join(directory, 'empty-user.npmrc'),
          '--globalconfig=' + join(directory, 'empty-global.npmrc'), '--cache', join(directory, 'npm-audit-cache')])
      }
    }
  } catch (error) {
    okay = false; results.push({ name: 'failure', status: 'FAIL', message: error.message }); console.log('CHECK_FAILED=' + error.message)
  }
  try { results.push({ name: 'protection-after', ...protect() }) } catch (error) { okay = false; results.push({ name: 'protection-after', status: 'FAIL', message: error.message }) }
  const path = join(directory, 'results.json')
  writeFileSync(path, JSON.stringify({ stage: 'RCO-5-MAINLINE-03-I1-R3', mode, okay, environment, results,
    modelAccuracy: '本轮未测量', externalRecognitionCalls: 0, modelNetwork: 0, feesCny: 0 }, null, 2), { flag: 'wx' })
  console.log('RESULT=' + path); if (!okay) process.exitCode = 1
}
