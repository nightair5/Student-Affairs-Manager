// Immutable packet reader for ordinary replay only, without any mutation API.
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {verifyV5NoticeDiagnostic,ROOT,BATCH,COUNT,sha} from './prepare-v5-current-notice.mjs'
import {EXECUTION_ROOT} from './v5-current-notice-execution-host.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
export async function v5CurrentNoticeRecordedScene(){
 const packageRead=()=>verifyV5NoticeDiagnostic({observedReadOnly:true}),pack=packageRead(),scope={batch:BATCH,count:COUNT,snapshot:pack.snapshot}
 const forbidden=()=>{throw Error('V5_NOTICE_READ_ONLY_NO_MUTATION')}
 const scene=await createScopedHost(scope,{root:EXECUTION_ROOT,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope),packageRead,gitCheck:forbidden,append:forbidden,transport:{sendOnce:forbidden},role:'V5_CURRENT_NOTICE_READ_ONLY_NOT_DISPATCH'}).resumeReadOnly()
 if(scene.state&&scene.audit!=='CONSISTENT')throw Error('V5_NOTICE_REPLAY_UNRESOLVED_USE_READ_ONLY_FORENSICS')
 const sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 const recordings=(scene.state?.units??[]).filter(u=>u.status==='SETTLED').map(row=>{const u=pack.units[row.ordinal-1],s=sources[row.ordinal-1],raw=JSON.parse(readFileSync(join(EXECUTION_ROOT,'raw',String(row.ordinal).padStart(2,'0')+'.json')));if(sha(raw.rawHttpText)!==row.responseSha256)throw Error('V5_NOTICE_RAW_DRIFT');return {ordinal:row.ordinal,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,candidate:'SingleAuthority',generationContract:u.generationContract,sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:row.responseSha256,requestSha256:u.requestSha256,frozenOutcome:'CURRENT_V5_SINGLE_ARM_SETTLED_NOT_COMPARISON'}})
 return {pack,sources,recordings,scene:{...scene,batch:BATCH,denominator:COUNT}}
}
