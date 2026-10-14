import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {createCurrentNoticeHost,EXECUTION_ROOT} from './current-notice-execution-host.mjs'
import {verifyCurrentNoticeDiagnostic,ROOT,BATCH,COUNT,sha} from './prepare-current-notice-diagnostic.mjs'
export async function currentNoticeRecordedScene(){
 const pack=verifyCurrentNoticeDiagnostic(),scene=await createCurrentNoticeHost().resumeReadOnly(),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'),'utf8')).sources
 if(!['NO_STATE','CONSISTENT'].includes(scene.audit)||scene.lockExists||scene.halt||scene.uncertainty)throw Error('CURRENT_REPLAY_UNCERTAIN_SITE')
 const recordings=(scene.state?.units??[]).filter(r=>r.status==='SETTLED').map(row=>{const u=pack.units[row.ordinal-1],s=sources.find(s=>s.sourceId===u.sourceId),raw=JSON.parse(readFileSync(join(EXECUTION_ROOT,'raw',String(row.ordinal).padStart(2,'0')+'.json'),'utf8'));if(!s||sha(raw.rawHttpText)!==row.responseSha256||raw.requestSha256!==u.requestSha256)throw Error('CURRENT_RECORDING_DRIFT');return {ordinal:row.ordinal,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,candidate:u.candidate,sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:u.requestSha256,frozenOutcome:'CURRENT_SINGLE_ARM_SETTLED_RECORDING'}})
 return {pack,scene:{...scene,batch:BATCH,denominator:COUNT},sources,recordings}
}
