// Immutable packet reader for ordinary replay only, without any mutation API.
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {verifyObligationComparison,ROOT,BATCH,COUNT,sha} from './obligation-authority-comparison.mjs'
import {EXECUTION_ROOT} from './obligation-authority-execution-host.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
export async function obligationRecordedScene(){
 const packageRead=()=>verifyObligationComparison({observedReadOnly:true}),pack=packageRead(),scope={batch:BATCH,count:COUNT,snapshot:pack.snapshot}
 const forbidden=()=>{throw Error('OBLIGATION_READ_ONLY_NO_MUTATION')}
 const scene=await createScopedHost(scope,{root:EXECUTION_ROOT,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope),packageRead,gitCheck:forbidden,append:forbidden,transport:{sendOnce:forbidden},role:'OBLIGATION_READ_ONLY_NOT_DISPATCH'}).resumeReadOnly()
 if(scene.state&&scene.audit!=='CONSISTENT')throw Error('OBLIGATION_REPLAY_UNRESOLVED_USE_READ_ONLY_FORENSICS')
 const sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 const recordings=(scene.state?.units??[]).filter(u=>u.status==='SETTLED').map(row=>{const u=pack.units[row.ordinal-1],s=sources.find(s=>s.sourceId===u.sourceId),raw=JSON.parse(readFileSync(join(EXECUTION_ROOT,'raw',String(row.ordinal).padStart(2,'0')+'.json')));if(sha(raw.rawHttpText)!==row.responseSha256)throw Error('OBLIGATION_RAW_DRIFT');return {ordinal:row.ordinal,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,candidate:u.candidate,generationContract:u.generationContract,sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:row.responseSha256,requestSha256:u.requestSha256,frozenOutcome:'OBLIGATION_PAIRED_SETTLED_PROVISIONAL'}})
 return {pack,sources,recordings,scene:{...scene,batch:BATCH,denominator:COUNT}}
}
