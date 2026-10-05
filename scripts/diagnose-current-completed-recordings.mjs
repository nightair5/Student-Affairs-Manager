// Public fixed recordings only: no credentials, execution state, dispatch or ledger writes.
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {publicNoticeComponents} from './public-notice-components.mjs'
const root='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic'
const dest=root+'/paid-evidence/AFTER.json'
const read=path=>JSON.parse(readFileSync(path,'utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex')
export async function diagnoseCompletedRecordings(){
  const x=await publicNoticeComponents(),sources=read(root+'/SOURCES.json').sources,units=read(root+'/PREPARED_REQUEST_IDENTITIES.json').requests,rows=[]
  for(const [i,s]of sources.entries()){
    const path=root+'/paid-evidence/raw-'+String(i+1).padStart(2,'0')+'.json',raw=read(path),unit=units[i]
    if(raw.ordinal!==unit.ordinal||raw.requestSha256!==unit.requestSha256||raw.unitIdentitySha256!==unit.unitIdentitySha256||sha(raw.rawHttpText)!==raw.responseSha256)throw Error('COMPLETED_RECORDING_BINDING')
    const http=JSON.parse(raw.rawHttpText),message=http.output.filter(p=>p.type==='message').flatMap(m=>m.content??[]).filter(c=>c.type==='output_text').map(c=>c.text).join('')
    const base={ordinal:i+1,sourceId:s.sourceId,source:s,rawPath:path,responseSha256:raw.responseSha256,httpStatus:raw.httpStatus,responseStatus:http.status,usage:http.usage,wire:JSON.parse(message)}
    try{
      const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone}
      const decoded=x.decodeCurrentSourceRecording(raw.rawHttpText,'Candidate19',context),first=x.assembleCurrentFirstSuggestion(decoded.result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone})
      rows.push({...base,status:'DECODED_NOT_SEMANTIC_PASS',originalAdapted:decoded.originalAdapted,conversion:decoded.conversion,sidecar:decoded.sidecar,result:decoded.result,firstSuggestion:first})
    }catch(e){rows.push({...base,status:'REJECTED',error:e.message})}
  }
  return {version:'current-real-post-recording-diagnostic-1',role:'POST_OUTPUT_PROGRAM_COMPATIBILITY_NOT_NEW_MODEL_SCORE',modelCalls:0,ledgerWrites:0,rows}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const report=await diagnoseCompletedRecordings()
  if(process.argv.length!==3)throw Error('MODE_REQUIRED')
  if(process.argv[2]==='--write')writeFileSync(dest,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  else if(process.argv[2]!=='--verify'||!isDeepStrictEqual(read(dest),report))throw Error('COMPLETED_DIAGNOSTIC_DRIFT')
  console.log(JSON.stringify({sources:report.rows.length,decoded:report.rows.filter(r=>r.status==='DECODED_NOT_SEMANTIC_PASS').length,rejected:report.rows.filter(r=>r.status==='REJECTED').length,modelCalls:0,ledgerWrites:0}))
}
