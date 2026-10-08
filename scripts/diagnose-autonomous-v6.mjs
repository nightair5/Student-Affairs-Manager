// Read-only raw -> strict/current-product diagnosis. Never scores human edits as first output.
import {build} from 'esbuild'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {verifyV5NoticeDiagnostic,ROOT as V5ROOT,BATCH as V5BATCH,COUNT as V5COUNT} from './prepare-v5-current-notice.mjs'
import {observedSettledBatch} from './settled-batch-observed-readonly.mjs'
import {resolve} from 'node:path'
import {autonomousV6RecordedScene} from './autonomous-v6-readonly.mjs'
import {ROOT,json,sha} from './autonomous-v6-notice.mjs'
const b=await build({stdin:{contents:`export {decodeAuthorityProductRecording} from './src/recognition/singleAuthorityProduct';export {decodeObligationProductRecording} from './src/recognition/sourceContractV6';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
const x=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
const rows=observedSettledBatch({root:V5ROOT,execution:resolve('.data/v5-current-notice/execution'),batch:V5BATCH,count:V5COUNT,verifyPacket:verifyV5NoticeDiagnostic}).recordings.map(r=>({...r,cohort:'HISTORICAL_V5'}))
if(existsSync(join(ROOT,'MANIFEST.json')))rows.push(...(await autonomousV6RecordedScene()).recordings.map(r=>({...r,cohort:'CURRENT_V6'})))
const cases=[]
for(const r of rows){
 const ctx={index:await x.indexImmutableScopesV11(r.sourceId,r.sourceVersionId,r.sourceText),referenceTime:r.referenceTime,timezone:r.timezone},decode=r.candidate==='ObligationAuthority'?x.decodeObligationProductRecording:x.decodeAuthorityProductRecording
 const extract=d=>({status:'DISPLAYED_NOT_WHOLE_SOURCE_CORRECTNESS',tasks:d.result.standaloneTasks,events:d.result.events,timePoints:d.result.timePoints,materials:d.result.materials,conflicts:d.result.conflicts,quality:d.result.quality,localCoverage:d.sidecar.singleAuthorityAudit.localCoverage,attributeAudit:{version:d.sidecar.attributeIndexAudit.version,additions:d.sidecar.attributeIndexAudit.additions},sourceWindows:d.sourceWindowGrounding})
 const stage=local=>{try{return extract(decode(r.rawHttpText,ctx,'SingleAuthority',local))}catch(e){return {status:'REJECTED',code:e.message}}}
 const raw=JSON.parse(r.rawHttpText),text=raw.output.filter(i=>i.type==='message').flatMap(i=>i.content).filter(i=>i.type==='output_text')
 cases.push({sourceId:r.sourceId,cohort:r.cohort,sourceSha256:sha(r.sourceText),responseSha256:r.responseSha256,requestSha256:r.requestSha256,sourceText:r.sourceText,referenceTime:r.referenceTime,timezone:r.timezone,wire:JSON.parse(text[0].text),strictProgram:stage(false),currentProduct:stage(true)})
}
mkdirSync(ROOT,{recursive:true});const report={role:'ACTUAL_SETTLED_RAW_READ_ONLY_PROGRAM_DIAGNOSTIC_NOT_NEW_MODEL_SCORE',truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',cases,summary:Object.fromEntries(['HISTORICAL_V5','CURRENT_V6'].map(cohort=>{const c=cases.filter(r=>r.cohort===cohort);return [cohort,{observed:c.length,strictDisplayed:c.filter(r=>r.strictProgram.status!=='REJECTED').length,currentDisplayed:c.filter(r=>r.currentProduct.status!=='REJECTED').length,wholeSourceAccuracy:'REQUIRES_SEPARATE_FACT_ADJUDICATION'}]}))}
writeFileSync(join(ROOT,'PRODUCT_DIAGNOSTIC.json'),json(report));console.log(json(report.summary))
