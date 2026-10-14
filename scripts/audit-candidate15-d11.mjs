import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {D11,verifyD11Preparation} from './run-candidate15-d11.mjs'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const check=(ok,code)=>{if(!ok)throw Error('D11_AUDIT_'+code)}
export function auditD11(){
  const verified=verifyD11Preparation();check(verified.status==='PASS'&&verified.settled===24,'RUN_INCOMPLETE')
  const binding=JSON.parse(readFileSync(join(D11,'BINDING.json'))),state=JSON.parse(readFileSync(join(D11,'STATE.json'))),score=JSON.parse(readFileSync(join(D11,'SCORING_RESULTS.json')))
  const raw=state.units.map(unit=>{const path=join(D11,'raw',String(unit.ordinal).padStart(2,'0')+'.json'),bytes=readFileSync(path),record=JSON.parse(bytes);check(record.ordinal===unit.ordinal&&record.requestSha256===binding.units[unit.ordinal-1].requestSha256&&record.responseSha256===sha(record.rawHttpText)&&unit.responseSha256===record.responseSha256,'RAW_IDENTITY');return {ordinal:unit.ordinal,path,sha256:sha(bytes),responseSha256:record.responseSha256,responseId:unit.responseId,requestSha256:unit.requestSha256??binding.units[unit.ordinal-1].requestSha256}})
  check(new Set(raw.map(row=>row.responseId)).size===24&&score.cases.length===24&&score.cases.every((row,i)=>row.ordinal===i+1&&row.responseSha256===raw[i].responseSha256),'RESULT_COVERAGE')
  const ledgerPath='C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl',rows=readFileSync(ledgerPath,'utf8').trimEnd().split('\n').map(JSON.parse),batch=rows.slice(791)
  check(rows.length===840&&batch.filter(r=>r.event.kind==='candidate15D11Grant').length===1&&batch.filter(r=>r.event.kind==='candidate15D11Reserve').length===24&&batch.filter(r=>r.event.kind==='candidate15D11Settle').length===24&&batch.every(r=>r.event.batchId===binding.batchId),'LEDGER_EVENTS')
  const usage={inputTokens:state.units.reduce((n,u)=>n+u.usage.input_tokens,0),cachedInputTokens:state.units.reduce((n,u)=>n+u.usage.input_tokens_details.cached_tokens,0),outputTokens:state.units.reduce((n,u)=>n+u.usage.output_tokens,0),peakUsageUpperMicroUsd:state.units.reduce((n,u)=>n+u.costUpperMicroUsd,0)}
  check(JSON.stringify({inputTokens:usage.inputTokens,cachedInputTokens:usage.cachedInputTokens,outputTokens:usage.outputTokens})===JSON.stringify(score.usage)&&usage.peakUsageUpperMicroUsd===score.localPeakUsageUpperMicroUsd,'USAGE')
  return {version:'candidate15-d11-provisional-audit-1',status:'PASS_ACCOUNTING_AND_IDENTITY_WITH_SCORING_FAILURE',truthStatus:'SAME_SERIES_PROVISIONAL_NOT_INDEPENDENT_HUMAN',head:binding.head,manifestSha256:binding.manifestSha256,identitiesSha256:binding.identitiesSha256,modelCalls:24,rawCount:24,grantCount:1,reserveCount:24,settleCount:24,retries:0,repairs:0,verifiers:0,ledgerRows:verified.ledgerRows,ledgerSha256:verified.ledgerSha256,protectedFiles:84,usage,providerBilledUsd:'NOT_OBSERVABLE',scoring:{schemaValid:score.cases.filter(c=>c.schemaValid).length,referenceValidCandidate03:score.cases.filter(c=>c.arm==='A'&&c.referenceValid).length,referenceValidCandidate15:score.cases.filter(c=>c.arm==='B'&&c.referenceValid).length,scorerExceptions:score.cases.filter(c=>c.score.status==='SCORER_EXCEPTION').map(c=>c.ordinal),decision:score.decision},raw}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const result=auditD11();if(process.argv[2]==='--write')writeFileSync(join(D11,'AUDIT.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});else if(process.argv[2]!=='--verify')throw Error('D11_AUDIT_ARGUMENT');console.log(JSON.stringify({status:result.status,modelCalls:result.modelCalls,ledgerRows:result.ledgerRows,scoring:result.scoring}))}
