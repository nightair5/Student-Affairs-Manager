import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const sha=v=>createHash('sha256').update(v).digest('hex')
/** Read known settled records only. No credentials, dispatch or ledger mutation. */
export function candidate19Recordings({units,sources,state,rawRoot}) {
  if(state.batch!=='C19-C17-C19-DEVELOPMENT-R1'||state.units.length!==12)throw Error('C19_REPLAY_BATCH')
  return state.units.filter(row=>row.status==='SETTLED').map(row=>{
    const unit=units.find(u=>u.ordinal===row.ordinal),source=sources.find(s=>s.sourceId===unit?.sourceId)
    const raw=JSON.parse(readFileSync(join(rawRoot,String(row.ordinal).padStart(2,'0')+'.json')))
    if(!unit||!source||raw.httpStatus!==200||row.httpStatus!==200||sha(raw.rawHttpText)!==raw.responseSha256
      ||raw.responseSha256!==row.responseSha256||raw.requestSha256!==unit.requestSha256
      ||raw.unitIdentitySha256!==unit.unitIdentitySha256||sha(source.sourceText)!==source.sourceSha256)throw Error('C19_REPLAY_IDENTITY_OR_RAW_DRIFT')
    return {ordinal:unit.ordinal,sourceId:source.sourceId,sourceVersionId:source.sourceVersionId,candidate:unit.candidate,
      sourceText:source.sourceText,referenceTime:source.referenceTime,timezone:source.timezone,rawHttpText:raw.rawHttpText,
      responseSha256:raw.responseSha256,requestSha256:raw.requestSha256,frozenOutcome:state.units.every(u=>u.status==='SETTLED')?'COMPLETE_BATCH_SEE_FROZEN_REPORT':'INCOMPLETE_BATCH_NOT_ADJUDICATED'}
  })
}
