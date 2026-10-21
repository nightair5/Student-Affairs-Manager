import test from 'node:test'
import assert from 'node:assert/strict'
import {deadlineRangeRoleIssue} from './deadline-range-role.mjs'
import {applyDeterministicTimeAst,normalizeRecognitionResult} from './recognition.mjs'
import {createWorker} from './worker.mjs'
import {productApi} from '../scripts/product-dev-evaluation.mjs'

const referenceTime='2027-04-01T09:00:00+08:00',timezone='Asia/Shanghai'
test('date windows and unannounced relative ends cannot become absolute deadlines',()=>{
 for(const raw of ['4月2日-4月6日','2027年4月2日至6日','申请时间为\n4月2日\n至相关课程考核开始前。'])assert.ok(deadlineRangeRoleIssue(raw,'submission_deadline'))
 assert.equal(deadlineRangeRoleIssue('4月6日17:00前','submission_deadline'),null)
 assert.equal(deadlineRangeRoleIssue('4月2日至4月6日','event_start'),null)
 assert.equal(deadlineRangeRoleIssue('4月2日至4月6日','event_end'),null)
 assert.equal(deadlineRangeRoleIssue('4月2日至4月6日17:00前','submission_deadline'),null)
})
function model(source,literal,value){
 const result=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'申请',sourceType:'text',summary:source,requiresAction:true},standaloneTasks:[{tempId:'T',title:'提交申请',actionVerb:'提交',actionObject:'申请',timePointTempIds:['P'],evidenceIds:['E'],selected:true}],timePoints:[{tempId:'P',type:'submission_deadline',rawText:literal,relatedTaskTempIds:['T'],evidenceIds:['E']}],evidence:[{id:'E',quote:source,field:'deadline'}]},source,referenceTime,'deepseek-v4-flash','recognition-product-contract-1.5.0')
 Object.assign(result.timePoints[0],{normalizedValue:value,precision:value?'date_only':'vague',needsConfirmation:!value,selected:true})
 return result
}
test('actual Worker and ordinary first assembly keep unresolved range roles blocked; concrete cutoff remains usable',async()=>{
 const x=await productApi()
 for(const [literal,value,expected] of [['4月2日-4月6日','2027-04-06',null],['申请时间为\n4月2日\n至相关课程考核开始前。',null,null],['4月6日17:00前','2027-04-06T17:00','2027-04-06T17:00']]){
  const source='请提交申请。'+literal,raw=model(source,literal,value),copy=structuredClone(raw),upstream=applyDeterministicTimeAst(raw,referenceTime,timezone,source)
  assert.equal(upstream.timePoints[0].normalizedValue,expected)
  assert.deepEqual(raw,copy)
  const origin='http://127.0.0.1:7361',worker=createWorker({fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}}),logger:()=>{}})
  const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({content:source,sourceType:'text',referenceTime,timezone})}),{DEEPSEEK_API_KEY:'server-only-test-key',ALLOWED_ORIGINS:origin,DEEPSEEK_PRODUCT_CONTRACT_VERSION:'recognition-product-contract-1.5.0',DEEPSEEK_EXTRACTION_MAX_TOKENS:16384})
  assert.equal(response.status,200);const normalized=(await response.json()).result
  assert.equal(normalized.timePoints[0].normalizedValue,expected)
  const bound=x.bindOrdinaryProviderSupport(x.parseRecognitionResult(normalized),{sourceId:'test-source',sourceVersionId:'test-v1',sourceText:source,referenceTime,timezone},JSON.stringify({result:normalized})),first=x.assembleProductFirstSuggestion(bound.result,{sourceText:source,referenceTime,timezone,workflowMaterialSupport:x.ordinaryWorkflowMaterialSupportFromSidecar(bound.sidecar)})
  assert.equal(first.result.timePoints[0].normalizedValue,expected)
  if(expected===null){assert.equal(first.result.timePoints[0].selected,false);assert.equal(first.result.timePoints[0].needsConfirmation,true);assert.ok(first.audit.unresolved.some(r=>r.reason==='DEADLINE_RANGE_ROLE_UNPROVEN'))}
  else assert.equal(first.result.timePoints[0].needsConfirmation,false)
  assert.equal(first.result.timePoints[0].rawText,literal)
 }
})
