import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
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
  if(stage==='paired06')return inspectPaired06Protection()
  if(stage==='paired05')return inspectPaired05Protection()
  if(stage==='paired04')return inspectPaired04Protection()
  if(stage==='candidate03')return inspectCandidate03Protection()
  if(stage==='read-close')return inspectReadCloseProtection()
  if(stage==='candidate02')return inspectCandidate02Protection()
  if(stage==='batch-14')return inspectBatchProtection()
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

export const CANDIDATE02_DIRECTORY='docs/recognition-optimization/mainline-real-input-01/runs/candidate02-20260908a'
export const CANDIDATE03_DIRECTORY='docs/recognition-optimization/mainline-real-input-01/runs/candidate03-20260908a'
export const PAIRED04_DIRECTORY='docs/recognition-optimization/mainline-real-input-01/runs/candidate04-20260909a'
export const PAIRED05_DIRECTORY='docs/recognition-optimization/mainline-real-input-01/runs/candidate05-20260912a'
export const PAIRED06_DIRECTORY='docs/recognition-optimization/mainline-real-input-01/runs/candidate06-20260912a'
/** New authorization snapshot, preserving the old stage and every old byte check. */
export function initializePaired06Baseline() {
  const head=git('rev-parse','HEAD')
  ensure(head==='c419aea63a1f6595cb0140cde00eb89dcc092759'&&git('branch','--show-current')===branch,'P06_START')
  const snapPath=PAIRED05_DIRECTORY+'/IMPLEMENTATION_SNAPSHOT.json',old=JSON.parse(readFileSync(PAIRED05_DIRECTORY+'/BASELINE.json'))
  const statics=readdirSync(PAIRED05_DIRECTORY,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>({path:PAIRED05_DIRECTORY+'/'+e.name,sha256:hash(readFileSync(PAIRED05_DIRECTORY+'/'+e.name))}))
  const ledger=readFileSync(old.ledger.path),rows=ledger.toString().trimEnd().split('\n').map(JSON.parse)
  ensure(rows.length===166&&hash(ledger)==='234bdd806d2dcbef6e6bd481fbe28a2ee8b70ee43e4fc82a854e2fcd8e00da39','P06_LEDGER_START')
  const b={head,sourceManifest:{path:snapPath,sha256:hash(readFileSync(snapPath))},protectedManifest:old.protectedManifest,
    staticEvidence:[...old.staticEvidence,...statics],ledger:{path:old.ledger.path,bytes:ledger.length,sha256:hash(ledger),sequence:166,tail:rows.at(-1).hash},
    log:{path:logPath,bytes:readFileSync(logPath).length,sha256:hash(readFileSync(logPath))},
    newPaths:['src/experiments/realInput01/candidate06.ts','src/experiments/realInput01/candidate06.test.ts'],modelCalls:80,
    recovery:'53 working-byte SHAs were checked before any edits; 17 existing uncommitted implementations preserved',
    frozenClosure:{path:PAIRED05_DIRECTORY+'/CANDIDATE_FREEZE.json',sha256:hash(readFileSync(PAIRED05_DIRECTORY+'/CANDIDATE_FREEZE.json'))}}
  mkdirSync(PAIRED06_DIRECTORY,{recursive:true});writeFileSync(PAIRED06_DIRECTORY+'/BASELINE.json',JSON.stringify(b,null,2)+'\n',{flag:'wx'})
  return {head,ledgerRows:166,oldSourceCount:53,newPaths:2}
}
export function inspectPaired06Protection() {
  const b=JSON.parse(readFileSync(PAIRED06_DIRECTORY+'/BASELINE.json'))
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase()&&git('branch','--show-current')===branch&&git('rev-parse','HEAD')===b.head,'P06_GIT')
  for(const ref of [b.sourceManifest,b.protectedManifest,b.frozenClosure])ensure(hash(readFileSync(ref.path))===ref.sha256,'P06_BASELINE')
  const s=JSON.parse(readFileSync(b.sourceManifest.path)),p=JSON.parse(readFileSync(b.protectedManifest.path)),frozen=JSON.parse(readFileSync(b.frozenClosure.path))
  for(const f of [...p.protectedFiles,...p.staticEvidence,...b.staticEvidence,...frozen.dependencies])ensure(hash(readFileSync(f.path))===f.sha256,'P06_PROTECTED:'+f.path)
  for(const f of s.sources.filter(s=>/candidate0[2345]|evaluation\.|factAssembly|mainline04\//.test(s.path)))ensure(hash(readFileSync(f.path))===f.workingSha256,'P06_FROZEN:'+f.path)
  for(const prefix of [b.ledger,b.log])ensure(hash(readFileSync(prefix.path).subarray(0,prefix.bytes))===prefix.sha256,'P06_PREFIX')
  const paths=[...s.sources.map(s=>s.path),...b.newPaths]
  ensure(paths.length===55&&new Set(paths).size===55,'P06_PATHS')
  for(const path of [...git('diff','--name-only').split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))
    ensure(paths.includes(path)||[contextPath,logPath,b.ledger.path].includes(path)||path.startsWith(PAIRED06_DIRECTORY+'/'),'P06_OUTSIDE:'+path)
  return {head:b.head,branch,protectedCount:p.protectedFiles.length,historyCount:p.staticEvidence.length+b.staticEvidence.length,
    sources:paths.map(path=>({path,exists:existsSync(path),workingSha256:existsSync(path)?hash(readFileSync(path)):null}))}
}
export function inspectPaired05Protection() {
  const b=JSON.parse(readFileSync(PAIRED05_DIRECTORY+'/BASELINE.json'))
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase()&&git('branch','--show-current')===branch&&git('rev-parse','HEAD')===b.head,'P05_GIT')
  for(const ref of [b.sourceManifest,b.protectedManifest])ensure(hash(readFileSync(ref.path))===ref.sha256,'P05_BASELINE')
  const s=JSON.parse(readFileSync(b.sourceManifest.path)),p=JSON.parse(readFileSync(b.protectedManifest.path))
  for(const f of [...p.protectedFiles,...p.staticEvidence,...b.staticEvidence])ensure(hash(readFileSync(f.path))===f.sha256,'P05_PROTECTED:'+f.path)
  for(const f of s.sources.filter(s=>/candidate0[234]|evaluation\.|mainline04\//.test(s.path)))ensure(hash(readFileSync(f.path))===f.workingSha256,'P05_FROZEN:'+f.path)
  for(const prefix of [b.ledger,b.log])ensure(hash(readFileSync(prefix.path).subarray(0,prefix.bytes))===prefix.sha256,'P05_PREFIX')
  const paths=[...s.sources.map(s=>s.path),...b.newPaths]
  ensure(paths.length===53&&new Set(paths).size===53,'P05_PATHS')
  for(const path of [...git('diff','--name-only').split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))
    ensure(paths.includes(path)||[contextPath,logPath,b.ledger.path].includes(path)||path.startsWith(PAIRED05_DIRECTORY+'/'),'P05_OUTSIDE:'+path)
  return {head:b.head,branch,protectedCount:p.protectedFiles.length,historyCount:p.staticEvidence.length+b.staticEvidence.length,
    sources:paths.map(path=>({path,exists:existsSync(path),workingSha256:existsSync(path)?hash(readFileSync(path)):null}))}
}
export function inspectPaired04Protection() {
  const b=JSON.parse(readFileSync(PAIRED04_DIRECTORY+'/BASELINE.json'))
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase()&&git('branch','--show-current')===branch,'P04_WORKSPACE')
  ensure(git('rev-parse','HEAD')===b.head&&b.head==='22686cb2a04f08e26d913b97629d5ff1deb76286','P04_HEAD')
  for(const f of [...b.protectedFiles,...b.staticEvidence])ensure(hash(readFileSync(f.path))===f.sha256,'P04_PROTECTED:'+f.path)
  for(const f of b.sources.filter(s=>/candidate0[23]|evaluation\./.test(s.path)))ensure(hash(readFileSync(f.path))===f.workingSha256,'P04_FROZEN:'+f.path)
  ensure(b.protectedFiles.length===944&&hash(readFileSync(logPath).subarray(0,b.log.bytes))===b.log.sha256,'P04_PREFIX')
  ensure(hash(readFileSync(b.ledger.path).subarray(0,b.ledger.bytes))===b.ledger.sha256,'P04_LEDGER_PREFIX')
  const paths=[...b.sources.map(s=>s.path),...b.newPaths]
  ensure(paths.length===49&&new Set(paths).size===49,'P04_PATHS')
  for(const path of git('diff','--name-only').split('\n').filter(Boolean))ensure(paths.includes(path)||[contextPath,logPath,b.ledger.path].includes(path),'P04_OUTSIDE:'+path)
  return {head:b.head,branch,protectedCount:944,historyCount:b.staticEvidence.length,
    sources:paths.map(path=>({path,exists:existsSync(path),workingSha256:existsSync(path)?hash(readFileSync(path)):null}))}
}
export function inspectCandidate03Protection() {
  const b=JSON.parse(readFileSync(CANDIDATE03_DIRECTORY+'/BASELINE.json'))
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase()&&git('branch','--show-current')===branch,'C03_WORKSPACE')
  ensure(git('rev-parse','HEAD')===b.head&&b.head==='c39f7e814b85acd494dc9c161ee0d24fa4e1d03f','C03_HEAD')
  const files=git('ls-tree','-r','--name-only','-z',baseCommit).split('\0').filter(p=>p&&!b.sources.some(s=>s.path===p)&&![contextPath,logPath].includes(p))
    .map(path=>({path,sha256:hash(readFileSync(path))}))
  ensure(files.length===945&&hash(JSON.stringify(files))===b.protectedSha,'C03_PROTECTION')
  for(const f of b.history)ensure(hash(readFileSync(f.path))===f.sha256,'C03_HISTORY:'+f.path)
  for(const f of b.frozenSources)ensure(hash(readFileSync(f.path))===f.sha256,'C03_OLD_CANDIDATE:'+f.path)
  ensure(hash(readFileSync(logPath).subarray(0,b.log.bytes))===b.log.sha256,'C03_LOG_PREFIX')
  ensure(hash(readFileSync(b.ledger.path).subarray(0,b.ledger.bytes))===b.ledger.sha256,'C03_LEDGER_PREFIX')
  const sources=b.sources.map(s=>({path:s.path,exists:existsSync(s.path),workingSha256:hash(readFileSync(s.path))}))
  ensure(sources.length===46&&new Set(sources.map(s=>s.path)).size===46,'C03_PATHS')
  return {head:b.head,branch,protectedCount:945,sources,historyCount:b.history.length}
}
const readCloseMutable=['src/experiments/realInput01/runtime.ts','src/experiments/realInput01/InputReview.tsx',
  'src/experiments/realInput01/browser.tsx','src/experiments/realInput01/acceptance.test.tsx','src/experiments/realInput01/extraction.test.ts',
  'scripts/serve-mainline-real-input-01.mjs','scripts/check-mainline-real-input-01.mjs','scripts/check-mainline-real-input-01.node-test.mjs']
export function verifyReadCloseIdentity(baseline,current) {
  ensure(current.head===baseline.head&&current.head==='f3b1ed68604e3f95c25894ee4717b1eed2072ec9','READ_CLOSE_HEAD')
  ensure(current.protectedCount===945&&current.protectedSha===baseline.protectedSha,'READ_CLOSE_PROTECTED')
  ensure(current.ledgerSha===baseline.ledger.sha256,'READ_CLOSE_LEDGER')
  ensure(current.sources.length===44&&new Set(current.sources.map(s=>s.path)).size===44,'READ_CLOSE_PATHS')
  for(const s of current.sources){const old=baseline.sources.find(o=>o.path===s.path)
    ensure(old&&s.exists&&/^[a-f0-9]{64}$/.test(s.workingSha256),'READ_CLOSE_SOURCE')
    if(!readCloseMutable.includes(s.path))ensure(old.workingSha256===s.workingSha256,'READ_CLOSE_FROZEN_SOURCE')}
  return true
}
export function inspectReadCloseProtection(){
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase()&&git('branch','--show-current')===branch,'READ_CLOSE_WORKSPACE')
  const b=JSON.parse(readFileSync(CANDIDATE02_DIRECTORY+'/READ_CLOSE_BASELINE.json'))
  const files=git('ls-tree','-r','--name-only','-z',baseCommit).split('\0').filter(p=>p&&!b.sources.some(s=>s.path===p)&&![contextPath,logPath].includes(p))
    .map(path=>({path,sha256:hash(readFileSync(path))}))
  const current={head:git('rev-parse','HEAD'),protectedCount:files.length,protectedSha:hash(JSON.stringify(files)),
    ledgerSha:hash(readFileSync(b.ledger.path)),sources:b.sources.map(s=>({path:s.path,exists:existsSync(s.path),workingSha256:hash(readFileSync(s.path))}))}
  verifyReadCloseIdentity(b,current)
  for(const f of b.history)ensure(hash(readFileSync(f.path))===f.sha256,'READ_CLOSE_HISTORY:'+f.path)
  ensure(hash(readFileSync(b.log.path).subarray(0,b.log.bytes))===b.log.sha256,'READ_CLOSE_LOG')
  return {...current,historyCount:b.history.length,modelRequests:0}
}
export function inspectCandidate02Protection() {
  const baseline=JSON.parse(readFileSync(baselinePath)),head=git('rev-parse','HEAD')
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase()&&git('branch','--show-current')===branch
    &&head==='f5e2c54106b1d363eea41246a980a2f7822ff044','C02_GIT')
  const paths=[...baseline.sources.map(s=>s.path),'src/experiments/realInput01/candidate02.ts','src/experiments/realInput01/candidate02.test.ts']
  const files=git('ls-tree','-r','--name-only','-z',baseCommit).split('\0').filter(p=>p&&!paths.includes(p)&&![contextPath,logPath].includes(p))
    .map(path=>({path,sha256:hash(readFileSync(path))}))
  ensure(files.length===945&&hash(JSON.stringify(files))===baseline.protected.currentReadOnlySha256,'C02_PROTECTION')
  for(const f of baseline.priorEvidence)ensure(hash(readFileSync(f.path))===f.sha256,'C02_STATIC_EVIDENCE')
  const prior=JSON.parse(readFileSync(CANDIDATE02_DIRECTORY+'/BASELINE.json'))
  for(const f of prior.evidence)ensure(hash(readFileSync(f.path))===f.sha256,'C02_PRIOR_EVIDENCE')
  const ledger=readFileSync(prior.ledger.path),log=readFileSync(logPath)
  ensure(hash(ledger.subarray(0,prior.ledger.bytes))===prior.ledger.sha256,'C02_LEDGER_PREFIX')
  ensure(hash(log.subarray(0,prior.log.bytes))===prior.log.sha256,'C02_LOG_PREFIX')
  return {head,branch,protectedCount:945,protectedSha256:hash(JSON.stringify(files)),
    sources:paths.map(path=>({path,exists:existsSync(path),workingSha256:hash(readFileSync(path))}))}
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

export function inspectBatchProtection() {
  const D='docs/recognition-optimization/mainline-real-input-01/runs/replay-a02-implementation-20260907a/'
  const baseline=JSON.parse(readFileSync(D+'BATCH_BASELINE.json')),head=git('rev-parse','HEAD')
  ensure(resolve(process.cwd()).toLowerCase()===root.toLowerCase()&&git('branch','--show-current')===branch
    &&head==='ae78dfef255eb5344868d1b4319e486537ac6681'&&baseline.head===head,'BATCH_GIT')
  const paths=baseline.sources.map(s=>s.path)
  ensure(paths.length===42&&new Set(paths).size===42,'BATCH_PATHS')
  const files=git('ls-tree','-r','--name-only','-z',baseCommit).split('\0').filter(p=>p&&!paths.includes(p)&&![contextPath,logPath].includes(p))
    .map(path=>({path,sha256:hash(readFileSync(path))}))
  ensure(files.length===945&&hash(JSON.stringify(files))===baseline.protected.sha256,'BATCH_PROTECTION')
  const prior=JSON.parse(readFileSync(D+'BASELINE.json'))
  for(const f of [...prior.old,...prior.receipts,...baseline.priorLabelEvidence,
    ...JSON.parse(readFileSync(D+'CONTINUATION_CHECKS.json')).newFiles,...JSON.parse(readFileSync(D+'RECOVERY_CHECKS.json')).newFiles])
    ensure(hash(readFileSync(f.path))===f.sha256,'BATCH_OLD_EVIDENCE:'+f.path)
  const ledger=readFileSync('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
  ensure(hash(ledger.subarray(0,baseline.ledgerBoundary.bytes))===baseline.ledgerBoundary.sha256,'BATCH_LEDGER_PREFIX')
  ensure(hash(readFileSync(logPath).subarray(0,baseline.logBoundary.bytes))===baseline.logBoundary.sha256,'BATCH_LOG_PREFIX')
  return {head,branch,protectedCount:945,sources:paths.map(path=>({path,exists:existsSync(path),workingSha256:hash(readFileSync(path))}))}
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
