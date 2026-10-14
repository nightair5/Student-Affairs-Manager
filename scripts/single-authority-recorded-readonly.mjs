// This reader only exposes completed original receipts to the existing App.
// No send, settlement, recovery or authorization method is available here.
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {verifyAuthorityComparison,ROOT,BATCH,COUNT,sha} from './single-authority-comparison.mjs'
import {EXECUTION_ROOT} from './single-authority-execution-host.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
const check=(v,c)=>{if(!v)throw Error('AUTHORITY_REPLAY_'+c)}
export async function authorityRecordedScene(){
 const pack=verifyAuthorityComparison(),scope={batch:BATCH,count:COUNT,snapshot:pack.snapshot}
 const scene=await createScopedHost(scope,{root:EXECUTION_ROOT,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope),packageRead:verifyAuthorityComparison,role:'AUTHORITY_RECORDING_READ_ONLY_NOT_DISPATCH',append:()=>{throw Error('READ_ONLY')},transport:{sendOnce:()=>{throw Error('READ_ONLY')}}}).resumeReadOnly()
 check(scene.audit==='CONSISTENT'&&!scene.halt&&!scene.lockExists&&!scene.uncertainty,'INCONSISTENT_SITE')
 check(scene.state?.units.length===COUNT&&scene.state.units.every(u=>u.status==='SETTLED'),'ALL_DETERMINATE_RECORDINGS_REQUIRED')
 const sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 const recordings=scene.state.units.map(row=>{
  const u=pack.units[row.ordinal-1],s=sources.find(s=>s.sourceId===u.sourceId),raw=JSON.parse(readFileSync(join(EXECUTION_ROOT,'raw',String(row.ordinal).padStart(2,'0')+'.json')))
  check(s&&raw.rawHttpText&&sha(raw.rawHttpText)===row.responseSha256&&raw.requestSha256===u.requestSha256,'RAW_BINDING')
  return {ordinal:row.ordinal,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,candidate:u.candidate,...(u.candidate==='SingleAuthority'?{generationContract:'single-authority-source-contract-5.0.0'}:{}),sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:row.responseSha256,requestSha256:u.requestSha256,frozenOutcome:'PAIRED_DEVELOPMENT_SETTLED_RECORDING_NOT_ADJUDICATED'}
 })
 return {pack,scene:{...scene,batch:BATCH,denominator:COUNT},sources,recordings}
}
