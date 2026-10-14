import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { allowedPaths, assertAllowedChanges, assertReviewGate, assertSnapshotGate, assertDownloadAgreement, protect, cleanEnvironment } from './check-mainline-05.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex')
const head='f5410d6c88ab1dfa4b90ae4346ea0b257f13ca3b'
const files=allowedPaths.map(path=>({path,sha256:sha(readFileSync(path))}))
const snapshot={head,branch:'codex/e2-multimodal-recognition-exp',files,
  protectedFiles:[{path:'readonly-original',sha256:'original'}],logPrefix:'original-prefix'}
// These in-memory values test predicates, never launch the full gate or create a review file.
const review={kind:'independent-full-implementation',reviewer:'/root/unit-test-only',status:'PASS',head,files}
test('current real protection and exact 26-path/source inventory',()=>{
  assert.equal(allowedPaths.length,26);assert.equal(new Set(allowedPaths).size,26)
  const result=protect();assert.equal(result.protected,863);assert.equal(result.planning,4)
  assert.deepEqual(result.files,files)
})
test('pure snapshot legal input and bound review pass without authorizing a run',()=>{
  assertSnapshotGate(snapshot,structuredClone(snapshot));assertReviewGate(review,head,files)
})
for(const [name,mutate] of [
  ['wrong-head',s=>{s.head='old-head'}],['wrong-branch',s=>{s.branch='main'}],
  ['source-drift',s=>{s.files[0].sha256='changed'}],['missing-source',s=>{s.files.pop()}],
  ['readonly-drift',s=>{s.protectedFiles[0].sha256='changed'}],['log-rewrite',s=>{s.logPrefix='changed'}],
])test('snapshot rejects '+name,()=>{const bad=structuredClone(snapshot);mutate(bad);assert.throws(()=>assertSnapshotGate(bad,snapshot))})
for(const [name,mutate] of [
  ['blocked',r=>{r.status='BLOCKED'}],['old-head',r=>{r.head='old'}],
  ['changed-reviewed-source',r=>{r.files[0].sha256='changed'}],['missing-reviewed-source',r=>{r.files.pop()}],
  ['not-independent',r=>{r.kind='test-result'}],['reviewer-missing',r=>{delete r.reviewer}],
])test('review rejects '+name,()=>{const bad=structuredClone(review);mutate(bad);assert.throws(()=>assertReviewGate(bad,head,files))})
test('source scope and newly appended report are accepted',()=>{
  assertAllowedChanges([...allowedPaths,'docs/recognition-optimization/CURRENT_CONTEXT.md',
    'docs/recognition-optimization/mainline-05/runs/unit-test-only/targeted.json'])
})
for(const path of ['src/main.tsx','package.json','src/experiments/mainline04/semanticContract.ts',
  '../outside','C:/outside','src\\App.tsx','docs/recognition-optimization/mainline-05/runs/new/Expected.json',
  'docs/recognition-optimization/mainline-05/runs/new/code.mjs'])test('rejects unauthorized path '+path,()=>assert.throws(()=>assertAllowedChanges([path])))
test('previous audit is readonly even when its name matches the new-report pattern',()=>{
  const path='docs/recognition-optimization/mainline-05/runs/selection-stop-20260906a/failure.json'
  assert.throws(()=>assertAllowedChanges([path],[path]))
})
test('child environment contains only the declared non-secret allowlist',()=>{
  const permitted=['PATH','SystemRoot','ComSpec','TEMP','TMP','USERPROFILE','RUN_LIVE_OCR_COMPONENT']
  assert.ok(Object.keys(cleanEnvironment()).every(key=>permitted.includes(key)))
  assert.equal(cleanEnvironment().RUN_LIVE_OCR_COMPONENT,'0')
})
const downloaded={schemaVersion:8,workspace:{id:'rco-mainline-01-02-i1-mainline05-file-unit-test'},tasks:[],reminderRecords:[]}
const receipt={databaseName:downloaded.workspace.id,origin:'http://127.0.0.1:19001',
  readMethod:'new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()',
  sha256:sha(Buffer.from(JSON.stringify(downloaded))),observedAt:'2026-09-06T10:00:00Z',
  evidenceNote:'Unit test only. This is not real browser or database evidence.'}
test('file comparison legal synthetic predicate is not browser acceptance',()=>assertDownloadAgreement(downloaded,structuredClone(downloaded),receipt))
for(const [name,mutate] of [
  ['wrong-db',r=>{r.databaseName+='-other'}],['remote-origin',r=>{r.origin='https://example.invalid'}],
  ['export-instead-of-read',r=>{r.readMethod='exportJson'}],['self-digest',r=>{r.sha256='unverified'}],
  ['no-provenance',r=>{r.evidenceNote=''}],['no-time',r=>{delete r.observedAt}],
])test('file evidence rejects '+name,()=>{const bad=structuredClone(receipt);mutate(bad);assert.throws(()=>assertDownloadAgreement(downloaded,downloaded,bad))})
test('file object difference is rejected even with recomputed file digest',()=>{
  const bad=structuredClone(downloaded);bad.tasks.push({id:'added'})
  assert.throws(()=>assertDownloadAgreement(bad,downloaded,{...receipt,sha256:sha(Buffer.from(JSON.stringify(bad)))}))
})
