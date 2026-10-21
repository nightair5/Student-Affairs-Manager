import test from 'node:test'
import {citedDeadlineRoleContext} from './deadline-range-role.mjs'
test('alternative on-site dates never become cutoffs; other deadlines and events remain separate',()=>{
 const context='现场确认可选择3月28日、4月11日或4月18日任选一天。'
 assert.equal(deadlineRangeRoleIssue('3月28日','task_deadline',context),'deadline_is_alternative_date_choice')
 assert.equal(deadlineRangeRoleIssue('3月28日、4月11日或4月18日','task_deadline',context),'deadline_is_alternative_date_choice')
 assert.equal(deadlineRangeRoleIssue('3月28日','event_start',context),null)
 assert.equal(deadlineRangeRoleIssue('3月28日','task_deadline','表格可选择甲版或乙版，3月28日、4月11日两次都须交件。'),null)
 assert.equal(deadlineRangeRoleIssue('3月28日','task_deadline','现场确认可选择：3月28日、4月11日。'),'deadline_is_alternative_date_choice')
 const splitSource='可以选择表格版本。后续3月28日、4月11日两次都须交件。'
 const splitContext=citedDeadlineRoleContext({evidenceIds:['A','B']},[{id:'A',quote:'可以选择'},{id:'B',quote:'3月28日、4月11日'}],splitSource)
 assert.equal(deadlineRangeRoleIssue('3月28日','task_deadline',splitContext),null)
 assert.equal(deadlineRangeRoleIssue('3月26日前','submission_deadline','报名3月26日前；'+context),null)
 assert.equal(deadlineRangeRoleIssue('4月2日前','submission_deadline','4月2日前提交申请或4月3日前缴费。'),null)
 assert.equal(deadlineRangeRoleIssue('3月28日','task_deadline','现场确认3月28日；考试4月11日。'),null)
 assert.equal(citedDeadlineRoleContext({evidenceIds:['own']},[{id:'other',quote:context}],context),'')
 assert.equal(citedDeadlineRoleContext({evidenceIds:['own']},[{id:'own',quote:'编造的或任选日期'}],context),'')
})
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
 assert.equal(deadlineRangeRoleIssue('12月19日','registration_deadline','缓考申请时间为12月19日至相关课程考核开始前。'),'deadline_is_cited_window_start')
 assert.equal(deadlineRangeRoleIssue('4月2日','submission_deadline','申请办理窗口4月2日至4月6日。'),'deadline_is_cited_window_start')
 assert.equal(deadlineRangeRoleIssue('4月2日前','submission_deadline','4月2日前提交，后续办理4月2日至4月6日。'),null)
 assert.equal(deadlineRangeRoleIssue('4月2日','submission_deadline','截止时间为4月2日，后续办理4月2日至4月6日。'),null)
 assert.equal(deadlineRangeRoleIssue('4月2日','submission_deadline','截止时间为4月6日。'),null)
 assert.equal(deadlineRangeRoleIssue('4月2日','event_start','办理窗口4月2日至4月6日。'),null)
 assert.equal(deadlineRangeRoleIssue('2026年11月4日16:00','submission_deadline','纸质件请于2026年11月4日09:00—11:00到教务窗口递交，电子件于当日16:00前提交至项目平台。'),null)
 assert.equal(deadlineRangeRoleIssue('2026年11月4日09:00','submission_deadline','纸质件请于2026年11月4日09:00—11:00到教务窗口递交。'),'deadline_is_cited_window_start')
 assert.equal(deadlineRangeRoleIssue('2026年11月21日09:00','task_deadline','请于2026年11月21日09:00到设备室领取门禁卡。'),null)
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

test('a cited opening date truncated by the model is locally blocked in Worker and ordinary first',async()=>{
 const x=await productApi(),source='缓考申请时间为2027年4月2日至相关课程考核开始前。',raw=model(source,'2027年4月2日','2027-04-02'),copy=structuredClone(raw),origin='http://127.0.0.1:7362'
 const worker=createWorker({fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}})})
 const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({content:source,sourceType:'text',referenceTime,timezone})}),{DEEPSEEK_API_KEY:'server-only-test-key',ALLOWED_ORIGINS:origin,DEEPSEEK_EXTRACTION_MAX_TOKENS:16384})
 assert.equal(response.status,200);const normalized=(await response.json()).result
 assert.equal(normalized.timePoints[0].normalizedValue,null)
 const bound=x.bindOrdinaryProviderSupport(x.parseRecognitionResult(normalized),{sourceId:'window-start-test',sourceVersionId:'window-start-v1',sourceText:source,referenceTime,timezone},JSON.stringify({result:normalized})),first=x.assembleProductFirstSuggestion(bound.result,{sourceText:source,referenceTime,timezone})
 assert.equal(first.result.timePoints[0].normalizedValue,null);assert.equal(first.result.timePoints[0].selected,false);assert.equal(first.result.timePoints[0].needsConfirmation,true);assert.deepEqual(raw,copy)
})
