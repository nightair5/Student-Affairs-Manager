import {readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createCandidate19Host,readCandidate19Package} from './candidate19-execution-host.mjs'
import {ROOT,BATCH,sha} from './prepare-candidate19.mjs'
import {scoreCandidate19,selectCandidate19} from './candidate19-scoring.mjs'
import {sourceContractComponents} from './source-contract-components.mjs'
export async function reportCandidate19(){
 const pack=readCandidate19Package(),scene=await createCandidate19Host().resumeReadOnly(),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources,refs=JSON.parse(readFileSync(join(ROOT,'REFERENCES.json'))).references
 const eligible=scene.audit==='CONSISTENT'&&!scene.lockExists&&!scene.halt&&scene.state?.units.every(u=>u.status==='SETTLED')&&scene.batchEvidence.grantCount===1&&scene.batchEvidence.reserveCount===12&&scene.batchEvidence.settleCount===12
 const units=pack.units.map(u=>({ordinal:u.ordinal,sourceId:u.sourceId,arm:u.arm,candidate:u.candidate,status:scene.state?.units[u.ordinal-1]?.status??'NOT_RUN'})),cases=[]
 if(eligible){const x=await sourceContractComponents();for(const u of pack.units){const raw=JSON.parse(readFileSync('.data/candidate19/execution/raw/'+String(u.ordinal).padStart(2,'0')+'.json'))
  if(sha(raw.rawHttpText)!==raw.responseSha256||raw.requestSha256!==u.requestSha256)throw Error('C19_REPORT_RAW_DRIFT')
  const source=sources.find(s=>s.sourceId===u.sourceId),ref=refs.find(r=>r.sourceId===u.sourceId),context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
  try{if(raw.httpStatus!==200)throw Error('HTTP_STATUS_'+raw.httpStatus);const decoded=x.decodeSourceContractRecording(raw.rawHttpText,u.candidate,context),declarations=u.candidate==='Candidate19'?JSON.parse(JSON.parse(raw.rawHttpText).output[0].content[0].text):null
   cases.push({...u,body:undefined,responseSha256:raw.responseSha256,rawContractScore:scoreCandidate19(ref,decoded.originalAdapted,declarations),firstDisplayScore:scoreCandidate19(ref,x.assembleSemanticFirstSuggestionD26(decoded.originalAdapted,context).result,declarations),conversion:decoded.conversion,coverageAudit:decoded.coverageAudit,humanFinal:'NOT_OBSERVABLE'})
  }catch(e){const score={completeStatus:false,risks:[{kind:'SCHEMA_REFERENCE_OR_TRANSPORT_REJECT'}],riskUnits:['SCHEMA_REFERENCE_OR_TRANSPORT_REJECT'],riskIdentityStatus:'MAPPED',freeProseAndLeakage:'NOT_ADJUDICATED'};cases.push({ordinal:u.ordinal,sourceId:u.sourceId,arm:u.arm,candidate:u.candidate,error:String(e.message).slice(0,200),rawContractScore:score,firstDisplayScore:score,humanFinal:'NOT_OBSERVABLE'})}
 }}
 const pairs=sources.map(s=>({sourceId:s.sourceId,A:cases.find(c=>c.sourceId===s.sourceId&&c.arm==='A')?.firstDisplayScore,B:cases.find(c=>c.sourceId===s.sourceId&&c.arm==='B')?.firstDisplayScore})),summary={}
 for(const candidate of ['Candidate17','Candidate19'])for(const layer of ['rawContractScore','firstDisplayScore']){const scores=cases.filter(c=>c.candidate===candidate).map(c=>c[layer]);summary[candidate+'_'+layer]={plannedDenominator:6,observable:scores.length,wholeCorrect:scores.filter(s=>s.completeStatus===true).length,wrong:scores.filter(s=>s.completeStatus===false).length,unknown:scores.filter(s=>s.completeStatus==='UNKNOWN').length,notRun:6-scores.length,rate:eligible?scores.filter(s=>s.completeStatus===true).length+'/6':'NOT_OBSERVABLE'}}
 return {version:'c19-comparison-report-1',batch:BATCH,status:eligible?'COMPLETE_DEFINITE_COMPARISON':scene.state?'SEALED_OR_INCOMPLETE_NO_WINNER':'NOT_RUN',plannedSources:6,plannedRequests:12,units,cases,summary,selection:eligible?selectCandidate19(pairs,6):selectCandidate19([],6),scene,rawAssessmentBoundary:'Frozen parsed/compiled contract score, not independent human raw truth',referenceTruth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',freeProseAndLeakage:'NOT_ADJUDICATED unless source support is deterministically checked',humanMetrics:'NOT_OBSERVABLE',providerActualCharge:'NOT_OBSERVABLE'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await reportCandidate19(),null,2))
