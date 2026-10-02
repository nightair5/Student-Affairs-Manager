import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {sha,D25_ROOT} from './prepare-d25.mjs'
import {d25Components} from './d25-components.mjs'
import {evaluateRaw} from './score-d25.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
export function calibratedReference(reference,wire,context,x){
  const r=structuredClone(reference),points=x.adaptModelWire(wire,context).adapted.timePoints
  for(const rep of r.representations){for(const task of rep.tasks)if(task.times!=='N/A')task.times=task.times.map(p=>({...p,...points.find(a=>a.rawText===p.rawText&&a.type===p.type)}));for(const f of rep.noTaskFacts)if(f.kind==='time')f.time={...f.time,...points.find(p=>p.rawText===f.value&&p.type===f.time.type)}}
  return r
}
export async function diagnoseD25(){
  const x=await d25Components(),batches={}
  for(const [batch,candidateRoot,resultPath,rawRoot] of [
    ['D15','docs/recognition-optimization/candidate16/d13-development','docs/recognition-optimization/candidate16/d15-integrated/SCORING_RESULTS.json','.data/candidate16/d14-execution/raw'],
    ['D17','docs/recognition-optimization/candidate17/d16-development','docs/recognition-optimization/candidate17/d17-development/SCORING_RESULTS.json','.data/candidate17/d17-execution/raw']]){
    const old=read(resultPath),sources=read(join(candidateRoot,'SOURCES.json')).sources,references=read(join(candidateRoot,'REFERENCES.json')).references,oracles=read(join(candidateRoot,'LEGAL_WIRE_ORACLES.json')).oracles,cases=[],roundtrip=[]
    for(const source of sources){const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone},oracle=oracles.find(o=>o.sourceId===source.sourceId).wire,reference=calibratedReference(references.find(r=>r.sourceId===source.sourceId),oracle,context,x),facts=x.projectSourceFacts(oracle,context);const envelope=JSON.stringify({status:'completed',error:null,model:'deepseek-flash',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(facts)}]}],usage:{input_tokens:0,output_tokens:0}});const result=await evaluateRaw(source,reference,{httpStatus:200,rawHttpText:envelope},'Candidate18',x);roundtrip.push({sourceId:source.sourceId,role:'ENGINEERING_ORACLE_NOT_NEW_OUTPUT',completeStatus:result.score.completeStatus,risks:result.score.risks,disputes:result.score.disputes,error:result.error});
      for(const prior of old.cases.filter(c=>c.sourceId===source.sourceId)){const bytes=readFileSync(join(rawRoot,String(prior.ordinal).padStart(2,'0')+'.json')),raw=JSON.parse(bytes);if(sha(bytes)!==prior.rawFileSha256||sha(raw.rawHttpText)!==prior.responseSha256||raw.requestSha256!==prior.requestSha256)throw Error('D25_OLD_RAW_DRIFT');const diagnostic=await evaluateRaw(source,reference,raw,prior.candidate,x);cases.push({ordinal:prior.ordinal,sourceId:source.sourceId,arm:prior.arm,candidate:prior.candidate,responseSha256:raw.responseSha256,rawFileSha256:sha(bytes),oldV7Complete:prior.score.complete,oldV7Severe:prior.score.severity?.severe,referenceRoundtrip:result.score.completeStatus===true?'PASS':'UNRESOLVED',diagnostic:result.score.completeStatus===true?diagnostic.score:{...diagnostic.score,completeStatus:'UNKNOWN',disputes:[...diagnostic.score.disputes,'HISTORICAL_REFERENCE_ROUNDTRIP_UNRESOLVED']},originalFacts:diagnostic.originalFacts,programConversion:'SHARED_EXISTING_PRODUCT_WIRE_TIME_ADAPTER; NO_FACT_COMPLETION',error:diagnostic.error})}
    }
    batches[batch]={denominator:24,sourceCount:12,originalDecision:old.decision,roundtrip,cases,summary:Object.fromEntries([...new Set(cases.map(c=>c.candidate))].map(candidate=>{const rows=cases.filter(c=>c.candidate===candidate);return [candidate,{denominator:12,diagnosticWhole:rows.filter(c=>c.diagnostic.completeStatus===true).length,unknown:rows.filter(c=>c.diagnostic.completeStatus==='UNKNOWN').length}]}))}
  }
  return {version:'d25-offline-diagnostic-1',role:'POSTHOC_SHARED_PRODUCT_ADAPTER_PROVISIONAL_NOT_NEW_MODEL_QUALITY',newModelCalls:0,oldResultsUnchanged:true,referenceCalibration:'New clone only: time values use common product adapter; historical marker mapping preserved, unresolved metadata remains a dispute. Original references unchanged.',historicalD19Correction:'D19 d15 section actually reads Candidate15 D11 v6; retained unchanged. This D25 diagnostic reads genuine D15 Candidate03/Candidate16 raws.',batches}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const result=await diagnoseD25(),path=join(D25_ROOT,'OFFLINE_DIAGNOSTIC.json'),content=JSON.stringify(result,null,2)+'\n';if(process.argv[2]==='--write'){mkdirSync(D25_ROOT,{recursive:true});writeFileSync(path,content)}else if(process.argv[2]==='--verify'){if(readFileSync(path,'utf8')!==content)throw Error('D25_DIAGNOSTIC_DRIFT')}else throw Error('D25_DIAGNOSTIC_MODE');console.log(JSON.stringify(Object.fromEntries(Object.entries(result.batches).map(([b,r])=>[b,r.summary]))))}
