import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {verifyD25,D25_ROOT,sha} from './prepare-d25.mjs'
import {frozenRequests,assertAuthorization,auditUnitMetadata,conservativeUpperMicroUsd,MAX_INPUT_TOKENS} from './d25-executor.mjs'
import {d25Components} from './d25-components.mjs'
import {scoreD25,selectD25,D25_SCORER} from './d25-scoring.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const check=(ok,code)=>{if(!ok)throw Error('D25_SCORE_'+code)}
export async function evaluateRaw(source,reference,raw,candidate,components){
  const x=components??await d25Components()
  const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
  let parsed=null,conversion=null,error=null,originalFacts=null
  try{check(raw.httpStatus===200,'TRANSPORT');originalFacts=JSON.parse(JSON.parse(raw.rawHttpText).output.at(-1).content[0].text)
    if(candidate==='Candidate18'){const result=x.convertCandidate18Envelope(raw.rawHttpText,context);conversion=result.conversion;parsed=x.parseModelEnvelope(result.convertedHttpText,context,'deepseek-flash')}
    else parsed=x.parseModelEnvelope(raw.rawHttpText,context,'deepseek-flash')
  }catch(cause){error=String(cause.message??cause).slice(0,180)}
  const score=parsed?scoreD25(reference,parsed.adaptedResponse):{version:D25_SCORER,status:'REJECTED_OUTPUT',completeStatus:false,risks:[{kind:'TRANSPORT_PARSE_SCHEMA_OR_ASSEMBLY_FAILURE'}],riskUnits:['TRANSPORT_PARSE_SCHEMA_OR_ASSEMBLY_FAILURE'],riskIdentityStatus:'MAPPED',disputes:[],rawProseAdjudication:'NOT_ADJUDICATED'}
  return {originalFacts,programConversion:conversion,productFirstFacts:parsed?.adaptedResponse??null,score,error,humanEdits:'NOT_APPLIED'}
}
export async function scoreD25Execution(){
  const binding=verifyD25(),units=frozenRequests(),root=resolve('.data/d25/execution'),state=read(join(root,'STATE.json')),auth=read(join(root,'AUTHORIZATION.json'))
  assertAuthorization(state,auth,units,binding);check(state.authorized===true&&state.grantId===auth.grantId&&state.units.every(u=>u.status==='SETTLED'),'INCOMPLETE_OR_UNCERTAIN')
  const ledger=readFileSync('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'),chain=validateChain(ledger),later=chain.rows.slice(auth.ledgerBaselineRows)
  check(sha(ledger.subarray(0,auth.ledgerBaselineBytes))===auth.ledgerBaselineSha256&&later.length===33&&later[0].event.kind==='d25Grant'&&later.every(r=>r.event.grantId===auth.grantId&&r.event.batchId===state.batch),'LEDGER')
  check(later[0].event.head===auth.committedHead&&later[0].event.manifestSha256===auth.manifestSha256&&later[0].event.identitiesSha256===auth.identitiesSha256&&later[0].event.hardLimitMicroUsd===auth.hardLimitMicroUsd,'GRANT_BINDING')
  for(const r of later)check(sha(readFileSync(join(root,'receipts',String(r.sequence).padStart(9,'0')+'.json')))===sha(JSON.stringify(r)+'\n'),'RECEIPT')
  const sources=read(join(D25_ROOT,'SOURCES.json')).sources,references=read(join(D25_ROOT,'REFERENCES.json')).references,x=await d25Components(),cases=[]
  for(const unit of units){
    const row=state.units[unit.ordinal-1],rawBytes=readFileSync(join(root,'raw',String(unit.ordinal).padStart(2,'0')+'.json')),raw=JSON.parse(rawBytes),reserve=later[1+2*(unit.ordinal-1)].event,settle=later[2+2*(unit.ordinal-1)].event
    check(raw.ordinal===unit.ordinal&&raw.requestSha256===unit.requestSha256&&raw.unitIdentitySha256===unit.unitIdentitySha256&&sha(raw.rawHttpText)===raw.responseSha256&&raw.responseSha256===row.responseSha256&&reserve.kind==='d25Reserve'&&reserve.requestSha256===unit.requestSha256&&settle.kind==='d25Settle'&&settle.responseSha256===raw.responseSha256&&settle.costUpperMicroUsd===row.costUpperMicroUsd,'UNIT')
    check(reserve.ordinal===unit.ordinal&&settle.ordinal===unit.ordinal&&reserve.unitIdentitySha256===unit.unitIdentitySha256&&reserve.upperMicroUsd===conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192),'RESERVATION_BINDING');auditUnitMetadata(raw,row,settle)
    const result=await evaluateRaw(sources.find(s=>s.sourceId===unit.sourceId),references.find(r=>r.sourceId===unit.sourceId),raw,unit.candidate,x)
    cases.push({ordinal:unit.ordinal,sourceId:unit.sourceId,arm:unit.arm,candidate:unit.candidate,requestSha256:unit.requestSha256,responseSha256:raw.responseSha256,rawFileSha256:sha(rawBytes),httpStatus:raw.httpStatus,usage:row.usage,costUpperMicroUsd:row.costUpperMicroUsd,...result})
  }
  const pairs=sources.map(s=>{const A=cases.find(c=>c.sourceId===s.sourceId&&c.arm==='A').score,B=cases.find(c=>c.sourceId===s.sourceId&&c.arm==='B').score;return {sourceId:s.sourceId,target:s.target,A,B,outcome:A.completeStatus==='UNKNOWN'||B.completeStatus==='UNKNOWN'?'UNKNOWN':A.completeStatus===B.completeStatus?'TIE':B.completeStatus?'IMPROVED':'REGRESSED'}})
  return {version:'d25-results-1',role:'PROVISIONAL_SEEN_DEVELOPMENT_NOT_HOLDOUT',planned:16,sent:16,settled:16,uncertain:0,binding,cases,pairs,decision:selectD25(pairs),arms:Object.fromEntries([['A','Candidate17'],['B','Candidate18']].map(([arm,name])=>{const rows=cases.filter(c=>c.arm===arm);return [name,{denominator:8,wholeCorrect:rows.filter(c=>c.score.completeStatus===true).length,unknown:rows.filter(c=>c.score.completeStatus==='UNKNOWN').length}]})),costUpperMicroUsd:cases.reduce((n,c)=>n+c.costUpperMicroUsd,0),providerActualUsd:'NOT_OBSERVABLE',humanMetrics:'NOT_OBSERVABLE'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const result=await scoreD25Execution(),path=join(D25_ROOT,'COMPARISON_RESULTS.json');if(process.argv[2]==='--write'){check(!existsSync(path),'ALREADY_SCORED');writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'})}else if(process.argv[2]==='--verify')check(readFileSync(path,'utf8')===JSON.stringify(result,null,2)+'\n','RESULT_DRIFT');else throw Error('D25_SCORE_MODE');console.log(JSON.stringify({decision:result.decision,arms:result.arms}))}
