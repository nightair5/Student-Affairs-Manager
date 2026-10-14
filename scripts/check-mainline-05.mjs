import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, mkdtempSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { resolve, join, relative, dirname, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { build as bundle } from 'esbuild'

const root=resolve('C:/Users/Winner/student-affairs-multimodal-exp')
const reportRoot='docs/recognition-optimization/mainline-05'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const read=path=>readFileSync(resolve(root,path))
const anchorPath=reportRoot+'/runs/safety-fix-20260906a/self-check.json'
const anchorSha='11da68a2ae1e11677b42446aa2ba008c8ddb333cb5bbcd3ee6e463257802c38a'
assert.equal(sha(read(anchorPath)),anchorSha,'AUTHORIZATION_RECORD_CHANGED')
const anchor=JSON.parse(read(anchorPath))
const start=JSON.parse(read(reportRoot+'/IMPLEMENTATION_BASELINE.json'))
const whitelist=JSON.parse(read(reportRoot+'/IMPLEMENTATION_WHITELIST.json'))
const old=JSON.parse(read(start.protectedReferences[0].path))
const frozen=JSON.parse(read(start.protectedReferences[1].path))
export const allowedPaths=[...start.existing,...start.added].map(f=>typeof f==='string'?f:f.path).concat(anchor.addedException.path)
const protectedMap=new Map(old.files.filter(f=>!allowedPaths.includes(f.path)).map(f=>[f.path,f]))
for(const f of frozen.files)if(!allowedPaths.includes(f.path))protectedMap.set(f.path,f)
const baseline={stage:'MAINLINE05_FULL_PACKAGE',files:[...protectedMap.values()]}
let activeReview=null,runId=null

export function cleanEnvironment(){
  return Object.fromEntries(['PATH','SystemRoot','ComSpec','TEMP','TMP','USERPROFILE'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]).concat([['RUN_LIVE_OCR_COMPONENT','0']]))
}
export function assertReviewGate(review,head,files){
  assert.equal(review.status,'PASS','REVIEW_BLOCKED')
  assert.equal(review.kind,'independent-full-implementation','NOT_A_REAL_IMPLEMENTATION_REVIEW')
  assert.ok(typeof review.reviewer==='string'&&review.reviewer.startsWith('/root/'),'REVIEWER_REQUIRED')
  assert.equal(review.head,head,'REVIEW_HEAD')
  assert.deepEqual([...review.files].sort((a,b)=>a.path.localeCompare(b.path)),[...files].sort((a,b)=>a.path.localeCompare(b.path)),'REVIEW_SOURCE_SHA')
}
export function assertSnapshotGate(actual,expected){
  assert.equal(actual.head,expected.head,'HEAD_CHANGED')
  assert.equal(actual.branch,expected.branch,'BRANCH_CHANGED')
  assert.deepEqual(actual.protectedFiles,expected.protectedFiles,'PROTECTED_SHA_CHANGED')
  assert.deepEqual(actual.files,expected.files,'IMPLEMENTATION_SHA_CHANGED')
  assert.equal(actual.logPrefix,expected.logPrefix,'LOG_PREFIX_CHANGED')
}
export function assertAllowedChanges(paths,tracked=[]){
  for(const path of paths){
    assert.ok(!isAbsolute(path)&&!path.split('/').includes('..')&&!path.includes('\\'),'PATH_SCOPE')
    const newReport=/^docs\/recognition-optimization\/mainline-05\/runs\/[a-z0-9-]+\/(self-check|targeted|review|engineering|browser|download|protection|failure)\.(json|md)$/.test(path)&&!tracked.includes(path)
    assert.ok(allowedPaths.includes(path)||whitelist.dynamicDocuments.includes(path)||newReport,'UNAUTHORIZED_PATH:'+path)
  }
}
export function protect(){
  assert.equal(resolve(process.cwd()),root,'WRONG_REPOSITORY')
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),anchor.head,'HEAD_CHANGED')
  assert.equal(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),'codex/e2-multimodal-recognition-exp','BRANCH_CHANGED')
  assert.equal(allowedPaths.length,26);assert.equal(protectedMap.size,863)
  assert.equal(sha(read(anchorPath)),anchorSha,'AUTHORIZATION_RECORD_CHANGED')
  assert.equal(anchor.head,'f5410d6c88ab1dfa4b90ae4346ea0b257f13ca3b','UNAPPROVED_HEAD')
  assert.equal(anchor.staticEvidence.length,20,'STATIC_EVIDENCE_COUNT')
  const protection=[...protectedMap.values(),...start.planningDocuments,...start.protectedReferences,...anchor.staticEvidence]
  for(const f of protection)assert.equal(sha(read(f.path)),f.sha256,'PROTECTED:'+f.path)
  assert.equal(sha(read(reportRoot+'/IMPLEMENTATION_WHITELIST.json')),start.whitelistSha256,'WHITELIST_CHANGED')
  assert.equal(sha(read('docs/recognition-optimization/OPTIMIZATION_LOG.md').subarray(0,anchor.logBytes)),anchor.logSha256,'LOG_PREFIX_CHANGED')
  const tracked=execFileSync('git',['ls-tree','-r','--name-only','HEAD'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/)
  const changed=execFileSync('git',['diff','HEAD','--name-only'],{cwd:root,encoding:'utf8'}).trim()
  const fresh=execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim()
  assertAllowedChanges([changed,fresh].filter(Boolean).join('\n').split(/\r?\n/).filter(Boolean),tracked)
  const files=allowedPaths.map(path=>({path,sha256:sha(read(path))}))
  const observed={head:anchor.head,branch:'codex/e2-multimodal-recognition-exp',files,
    protectedFiles:protection.map(f=>({path:f.path,sha256:sha(read(f.path))})),
    logPrefix:sha(read('docs/recognition-optimization/OPTIMIZATION_LOG.md').subarray(0,anchor.logBytes))}
  assertSnapshotGate(observed,{...observed,files:activeReview?.files??files,
    protectedFiles:protection.map(f=>({path:f.path,sha256:f.sha256})),logPrefix:anchor.logSha256})
  if(activeReview)assertReviewGate(activeReview,anchor.head,files)
  return {status:'PASS',head:anchor.head,protected:863,planning:4,files}
}
function reportPath(){assert.ok(runId&&/^[a-z0-9-]+$/.test(runId));return reportRoot+'/runs/'+runId+'/engineering.json'}

export function assertDownloadAgreement(download,independent,receipt){
  assert.equal(download.schemaVersion,8,'DOWNLOAD_SCHEMA')
  assert.ok(isDeepStrictEqual(download,independent),'DOWNLOAD_DATABASE_OBJECT_MISMATCH')
  assert.match(receipt.databaseName,/^rco-mainline-01-02-i1-mainline05-[a-z0-9-]{10,100}$/,'DATABASE_SCOPE')
  assert.equal(independent.workspace.id,receipt.databaseName,'DATABASE_IDENTITY')
  assert.match(receipt.origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/,'ORIGIN_SCOPE')
  assert.equal(receipt.readMethod,'new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()','INDEPENDENT_READ_METHOD')
  assert.equal(receipt.sha256,sha(Buffer.from(JSON.stringify(independent))),'INDEPENDENT_READ_DIGEST')
  assert.ok(typeof receipt.observedAt==='string'&&Number.isFinite(Date.parse(receipt.observedAt)),'READ_TIME_REQUIRED')
  assert.ok(typeof receipt.evidenceNote==='string'&&receipt.evidenceNote.length>20,'READ_PROVENANCE_REQUIRED')
  assert.equal(download.reminderRecords.length,0,'UNEXPECTED_REMINDERS')
}
async function checkDownload(receiptPath,downloadPath,independentPath){
  assert.ok(/^docs\/recognition-optimization\/mainline-05\/runs\/[a-z0-9-]+\/browser.json$/.test(receiptPath),'BROWSER_RECEIPT_PATH')
  assert.ok(/^C:\/Users\/Winner\/Downloads\/mainline-05-workspace(?: \([0-9]+\))?\.json$/.test(downloadPath.replaceAll('\\','/')),'DOWNLOAD_PATH_SCOPE')
  const receipt=JSON.parse(read(receiptPath))
  const directory=resolve(receipt.temporaryDirectory)
  assert.ok(dirname(directory)===resolve(tmpdir())&&directory.split(/[\\/]/).at(-1).startsWith('rco-mainline05-'),'TEMP_SCOPE')
  const target=resolve(independentPath)
  assert.equal(dirname(target),directory,'READBACK_PATH_SCOPE')
  assert.equal(target,resolve(receipt.independentObjectPath),'READBACK_RECEIPT_BINDING')
  const browser=receipt.independentRead, bytes=readFileSync(downloadPath), downloaded=JSON.parse(bytes)
  const independent=JSON.parse(readFileSync(target))
  assertDownloadAgreement(downloaded,independent,browser)
  assert.deepEqual(receipt.implementationFiles,protect().files,'BROWSER_SOURCE_SHA')
  const validation=await bundle({stdin:{contents:"export {validateSemanticWorkspace} from './src/experiments/mainline05/semanticState.ts'",resolveDir:root},
    bundle:true,write:false,platform:'node',format:'esm',target:'node24'})
  const {validateSemanticWorkspace}=await import('data:text/javascript;base64,'+Buffer.from(validation.outputFiles[0].contents).toString('base64'))
  await validateSemanticWorkspace(downloaded)
  const result={status:'PASS_FILE_AND_INDEPENDENT_DATABASE',downloadPath,bytes:bytes.length,fileSha256:sha(bytes),
    parsedJsonSha256:sha(Buffer.from(JSON.stringify(downloaded))),independentRead:browser,
    workspaceVersion:8,jointSemanticValidation:'PASS',tasks:downloaded.tasks.length,
    noDate:downloaded.tasks.filter(t=>!downloaded.timePoints.some(p=>p.relatedTaskIds.includes(t.id))).map(t=>({id:t.id,timePoints:0,reminders:0})),
    modelAccuracy:'本轮未测量',doesNotProveAllJourneys:true}
  const output=resolve(root,dirname(receiptPath),'download.json')
  writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result))
}

async function fullEngineering(directory) {
  const checks = [], environment = { node: process.version, currentHistoricalGate: { status: 'R2_FAIL_PRESERVED_NOT_RERUN', passed: 3, failed: 1 } }
  const record = (name, result) => { checks.push({ name, ...result }); console.log(JSON.stringify({ name, ...result, log: result.log })) }
  function run(name, args, cwd = root) {
    protect()
    const child = spawnSync(process.execPath, args, { cwd, windowsHide: true, encoding: 'utf8',
      env: cleanEnvironment(), maxBuffer: 32 * 1024 * 1024 })
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
    // Historical bytes are validated against the immutable original filebook;
    // current authorized exceptions do not remove their historical identity.
    const protectedMap = new Map([...old.files,...frozen.files].map(f => [f.path, f.sha256]))
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
      ['checker-self-tests', ['--test', 'scripts/check-mainline-05.node-test.mjs']],
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
      assert.ok(!['mainline04-task-semantics-1', 'mainline04-review-package-1', 'mainline03-receipt-1', 'UNREPRESENTABLE_CONDITION_STATE', 'mainline05-semantic-state-1', 'mainline05-own-assets-1'].some(m => text.includes(m)), 'STABLE_BUNDLE_EXPERIMENT_IMPORT')
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
  writeFileSync(resolve(root, reportPath()), JSON.stringify(summary, null, 2), { flag: 'wx' })
  process.exitCode = okay ? 0 : 1
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const mode=process.argv[2]
  if(mode==='--protect'||mode==='--snapshot'){assert.equal(process.argv.length,3);console.log(JSON.stringify(protect()))}
  else if(mode==='--full'){
    assert.equal(process.argv.length,5,'FULL_ARGUMENTS_REQUIRED');runId=process.argv[3]
    assert.ok(/^[a-z0-9-]+$/.test(runId),'RUN_ID_SCOPE')
    const reviewPath=process.argv[4]
    assert.ok(/^docs\/recognition-optimization\/mainline-05\/runs\/[a-z0-9-]+\/review.json$/.test(reviewPath),'REVIEW_PATH_SCOPE')
    activeReview=JSON.parse(read(reviewPath));protect()
    const directory=mkdtempSync(join(tmpdir(),'rco-mainline05-check-'+runId+'-'))
    mkdirSync(resolve(root,reportRoot,'runs',runId),{recursive:true})
    assert.ok(!existsSync(resolve(root,reportPath())),'ATTEMPT_ALREADY_EXISTS')
    await fullEngineering(directory)
  }else if(mode==='--download'){
    assert.equal(process.argv.length,6,'DOWNLOAD_ARGUMENTS_REQUIRED');protect()
    await checkDownload(process.argv[3],process.argv[4],process.argv[5]);protect()
  }else throw Error('EXPLICIT_PROTECT_SNAPSHOT_FULL_OR_DOWNLOAD_REQUIRED')
}
