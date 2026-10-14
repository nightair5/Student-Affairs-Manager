import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {completedSiteFixture} from './current-completed-site-fixture.mjs'
import {inspectCompletedCurrentNoticeSite} from './current-notice-completed-readonly.mjs'

const root='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic'
const reader=pathToFileURL(resolve('scripts/current-notice-completed-readonly.mjs')).href
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim()
const head=git(['rev-parse','HEAD']),objects=resolve(git(['rev-parse','--git-common-dir']),'objects')
function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'current-completed-readonly-'))
  execFileSync('git',['init','--quiet',dir])
  mkdirSync(join(dir,'.git/objects/info'),{recursive:true})
  // Read original Git objects; all fixture mutations stay under this temp repo.
  writeFileSync(join(dir,'.git/objects/info/alternates'),objects.replaceAll('\\','/')+'\n')
  mkdirSync(join(dir,root),{recursive:true})
  const manifest=JSON.parse(readFileSync(root+'/MANIFEST.json'))
  for(const file of ['MANIFEST.json',...manifest.artifacts.map(a=>a.path)])copyFileSync(join(root,file),join(dir,root,file))
  mkdirSync(join(dir,'.data/current-real-notice/execution'),{recursive:true})
  const statePath=join(dir,'.data/current-real-notice/execution/STATE.json')
  const state={batch:manifest.batch,committedHead:head,units:Array.from({length:4},()=>({status:'SETTLED'}))}
  writeFileSync(statePath,JSON.stringify(state))
  const run=()=>execFileSync(process.execPath,['--input-type=module','-e',`const {completedCurrentNoticePackage}=await import(${JSON.stringify(reader)}); try { const p=completedCurrentNoticePackage(); console.log(JSON.stringify({count:p.units.length})); } catch(e) { console.log(e.message); process.exitCode=1; }`],{cwd:dir,encoding:'utf8',stdio:'pipe'})
  return {dir,state,statePath,run}
}
test('completed reader verifies original blobs even after active product changes, without creating auth or ledger',()=>{
  const f=fixture()
  try{assert.deepEqual(JSON.parse(f.run()),{count:4});assert.deepEqual(JSON.parse(readFileSync(f.statePath)),f.state);assert.deepEqual(readdirSync(join(f.dir,'.data/current-real-notice/execution')),['STATE.json'])}finally{rmSync(f.dir,{recursive:true,force:true})}
})
test('uncertain batch is refused before replay and its state remains byte-identical',()=>{
  const f=fixture()
  try{f.state.units[2].status='UNCERTAIN';writeFileSync(f.statePath,JSON.stringify(f.state));const before=readFileSync(f.statePath);assert.throws(f.run,e=>e.stdout.includes('CURRENT_COMPLETED_DETERMINATE_BATCH_REQUIRED'));assert.deepEqual(readFileSync(f.statePath),before)}finally{rmSync(f.dir,{recursive:true,force:true})}
})
test('changed request bytes cannot enter completed replay even with a settled fixture state',()=>{
  const f=fixture()
  try{const path=join(f.dir,root,'PREPARED_REQUEST_IDENTITIES.json'),ids=JSON.parse(readFileSync(path));ids.requests[0].body.temperature=1;writeFileSync(path,JSON.stringify(ids));assert.throws(f.run,e=>e.stdout.includes('CURRENT_COMPLETED_FROZEN_ARTIFACT'));assert.deepEqual(JSON.parse(readFileSync(f.statePath)),f.state)}finally{rmSync(f.dir,{recursive:true,force:true})}
})

test('completed replay allows a different batch append, verifies full chain, leaves bytes intact and does not weaken the paid gate',async()=>{
 const f=await completedSiteFixture()
 try{
  f.append({kind:'scopedGrant',batchId:'OFFLINE_OTHER_BATCH',grantId:'OTHER_FAKE_GRANT'})
  const paths=[f.ledger,join(f.root,'STATE.json'),join(f.root,'AUTHORIZATION.json'),join(f.root,'raw/01.json')],before=paths.map(p=>readFileSync(p))
  const scene=inspectCompletedCurrentNoticeSite(f.root,f.pack,f.ledger)
  assert.equal(scene.audit,'CONSISTENT');assert.equal(scene.ledger.batchRows,9);assert.equal(scene.ledger.otherLaterRows,1);assert.equal(scene.dispatch,'DISABLED_NO_MUTATION_API')
  assert.deepEqual(paths.map(p=>readFileSync(p)),before)
  const gate=f.host.resumeReadOnly();assert.notEqual(gate.audit,'CONSISTENT')
 }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('foreign append cannot hide own-grant collision, tampered receipt/raw, uncertain state or broken chain',async()=>{
 for(const kind of ['collision','receipt','raw','uncertain','chain']){
  const f=await completedSiteFixture()
  try{
   if(kind==='collision')f.append({kind:'scopedSettle',batchId:'OFFLINE_OTHER_BATCH',grantId:'OFFLINE_FAKE_CURRENT'})
   if(kind==='receipt'){const p=join(f.root,'receipts',readdirSync(join(f.root,'receipts'))[0]);writeFileSync(p,readFileSync(p,'utf8')+' ')}
   if(kind==='raw'){const p=join(f.root,'raw/01.json'),r=JSON.parse(readFileSync(p));r.rawHttpText+=' ';writeFileSync(p,JSON.stringify(r))}
   if(kind==='uncertain'){const p=join(f.root,'STATE.json'),s=JSON.parse(readFileSync(p));s.units[1].status='UNCERTAIN';writeFileSync(p,JSON.stringify(s))}
   if(kind==='chain')writeFileSync(f.ledger,readFileSync(f.ledger,'utf8').replace('OFFLINE_ENGINEERING_ONLY','OFFLINE_CHANGED'))
   assert.throws(()=>inspectCompletedCurrentNoticeSite(f.root,f.pack,f.ledger),undefined,kind)
  }finally{rmSync(f.root,{recursive:true,force:true})}
 }
})
