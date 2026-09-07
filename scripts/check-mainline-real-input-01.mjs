import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const root='C:\\Users\\Winner\\student-affairs-multimodal-exp'
const branch='codex/e2-multimodal-recognition-exp'
const baselinePath='docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/BASELINE.json'
const baseCommit='56d0545fd8ffdd7b71f9feeed1ad9ac22a705dbe'
const expectedHead='24c80c02cf4e7b7d9e652caf935638cd2ad1f0ba'
const contextPath='docs/recognition-optimization/CURRENT_CONTEXT.md'
const logPath='docs/recognition-optimization/OPTIMIZATION_LOG.md'
const ensure=(ok,code)=>{if(!ok)throw Error('REAL_INPUT_CHECK_'+code)}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trimEnd()

/** Read-only current-stage protection. This is not a replacement for full
 * engineering, historical environment, paid safety or browser acceptance. */
export function inspectProtection({stage}={}) {
  if(stage!==undefined){ensure(stage==='recovery-a02','STAGE');return inspectRecoveryProtection()}
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase(),'WORKSPACE')
  ensure(git('branch','--show-current')===branch&&git('rev-parse','HEAD')===expectedHead,'AUTHORIZED_GIT')
  const baseline=JSON.parse(readFileSync(baselinePath,'utf8'))
  ensure(baseline.head===expectedHead&&baseline.sources.length===42&&baseline.protected.currentReadOnlyCount===945,'BASELINE_IDENTITY')
  const paths=baseline.sources.map(s=>s.path)
  ensure(new Set(paths).size===42&&paths.includes('src/pages/DashboardPage.tsx'),'WHITELIST')
  const tracked=git('ls-tree','-r','--name-only','-z',baseCommit).split('\0').filter(Boolean)
  const readonly=tracked.filter(path=>!paths.includes(path)&&![contextPath,logPath].includes(path))
  const protectedFiles=readonly.map(path=>({path,sha256:hash(readFileSync(path))}))
  ensure(protectedFiles.length===945&&hash(JSON.stringify(protectedFiles))===baseline.protected.currentReadOnlySha256,'READ_ONLY_PROTECTION')
  for(const item of baseline.priorEvidence)ensure(hash(readFileSync(item.path))===item.sha256,'STATIC_EVIDENCE_CHANGED:'+item.path)
  const log=readFileSync(logPath)
  for(const item of [...baseline.logPrefixes,baseline.logBoundary])ensure(log.length>=item.bytes&&hash(log.subarray(0,item.bytes))===item.sha256,'LOG_PREFIX')
  const sources=baseline.sources.map(s=>({path:s.path,exists:existsSync(s.path),workingSha256:existsSync(s.path)?hash(readFileSync(s.path)):null}))
  return {head:expectedHead,branch,protectedCount:945,protectedSha256:hash(JSON.stringify(protectedFiles)),
    priorEvidenceCount:baseline.priorEvidence.length,logPrefixes:baseline.logPrefixes.length+1,sources,
    fullEngineering:'NOT_RUN',browser:'NOT_RUN',modelAccuracy:'本轮未测量'}
}

export const RECOVERY_SCRIPT_PATHS=Object.freeze(['scripts/real-input-budget.mjs','scripts/real-input-budget.node-test.mjs',
  'scripts/real-input-model-gateway.mjs','scripts/real-input-model-gateway.node-test.mjs',
  'scripts/run-mainline-real-input-01.mjs','scripts/check-mainline-real-input-01.mjs','scripts/check-mainline-real-input-01.node-test.mjs'])
export function verifyRecoveryScope({head,baseline,sources,protectedSummary}) {
  ensure(head==='afd81ee4e8bac9285287c85f9ea389139bea12f6'&&baseline.head===head,'RECOVERY_HEAD')
  ensure(sources.length===42&&baseline.sources.length===42&&new Set(sources.map(s=>s.path)).size===42,'RECOVERY_PATHS')
  ensure(protectedSummary.count===945&&protectedSummary.sha256===baseline.protected.sha256,'RECOVERY_PROTECTION')
  for(const s of sources){const old=baseline.sources.find(x=>x.path===s.path)
    ensure(old&&s.exists&&/^[a-f0-9]{64}$/.test(s.workingSha256),'RECOVERY_PATH')
    if(!RECOVERY_SCRIPT_PATHS.includes(s.path))ensure(s.workingSha256===old.workingSha256,'RECOVERY_READONLY_SOURCE')}
  return true
}
function inspectRecoveryProtection() {
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase(),'WORKSPACE')
  const head=git('rev-parse','HEAD');ensure(git('branch','--show-current')===branch,'AUTHORIZED_GIT')
  const baseline=JSON.parse(readFileSync('docs/recognition-optimization/mainline-real-input-01/runs/recovery-a02-20260907a/BASELINE.json'))
  const paths=baseline.sources.map(s=>s.path)
  const readonly=git('ls-tree','-r','--name-only','-z',baseCommit).split('\0').filter(p=>p&&!paths.includes(p)&&![contextPath,logPath].includes(p))
  const protectedFiles=readonly.map(path=>({path,sha256:hash(readFileSync(path))}))
  const sources=paths.map(path=>({path,exists:existsSync(path),workingSha256:existsSync(path)?hash(readFileSync(path)):null}))
  verifyRecoveryScope({head,baseline,sources,protectedSummary:{count:protectedFiles.length,sha256:hash(JSON.stringify(protectedFiles))}})
  const paidLedger='docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
  for(const item of [...baseline.prior,...baseline.currentEvidence,...baseline.oldReceipts]){
    if(item.path===paidLedger)continue // Only this exact file has an explicit append exception below.
    ensure(hash(readFileSync(item.path))===item.sha256,'RECOVERY_STATIC_EVIDENCE')}
  const ledger=readFileSync(paidLedger),prefix=baseline.ledgerBoundary
  ensure(ledger.length>=prefix.bytes&&hash(ledger.subarray(0,prefix.bytes))===prefix.sha256,'RECOVERY_LEDGER_PREFIX')
  const log=readFileSync(logPath)
  for(const item of [...baseline.logPrefixes,baseline.logBoundary])
    ensure(log.length>=item.bytes&&hash(log.subarray(0,item.bytes))===item.sha256,'RECOVERY_LOG_PREFIX')
  return {head,branch,sources,protectedCount:945,protectedSha256:hash(JSON.stringify(protectedFiles)),
    fullEngineering:'NOT_RUN',browser:'NOT_RUN',stage:'recovery-a02'}
}

export function verifyReviewBinding({head,expectedHead:expected,sources,review}) {
  ensure(head===expected&&/^[a-f0-9]{40}$/.test(head),'REVIEW_HEAD')
  ensure(review?.status==='PASS'&&review.head===head,'REVIEW_STATUS')
  ensure(Array.isArray(sources)&&sources.length>0&&sources.every(s=>typeof s.path==='string'
    &&/^(?:src|scripts)\/[A-Za-z0-9_./-]+$/.test(s.path)&&!s.path.split('/').includes('..')&&/^[a-f0-9]{64}$/.test(s.sha256)),'REVIEW_PATHS')
  ensure(new Set(sources.map(s=>s.path)).size===sources.length,'REVIEW_DUPLICATES')
  ensure(Array.isArray(review.sources)&&review.sources.length===sources.length&&sources.every(s=>
    review.sources.some(r=>r.path===s.path&&r.sha256===s.sha256)),'REVIEW_SHA')
  return true
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  ensure(process.argv.length===3&&['--protection','--recovery-protection'].includes(process.argv[2]),'EXPLICIT_READ_ONLY_MODE')
  console.log(JSON.stringify(inspectProtection(process.argv[2]==='--recovery-protection'?{stage:'recovery-a02'}:{})))
}
