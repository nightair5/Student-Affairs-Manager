import test from 'node:test'
import assert from 'node:assert/strict'
import {createWorker} from './worker.mjs'
import {citedSameDayContext} from './recognition.mjs'
import {citedTimeContext} from './recognition.mjs'
const reference='2027-03-01T09:00:00+08:00'
const sentence='电子件于当日16:00前提交登记表'

test('whole cited same-day action text is a legitimate time literal; unrelated, repeated or conditional dates cannot anchor it',async()=>{
 const source=`纸质登记表于2027年3月8日递交，${sentence}。`
 const r=await run(source,raw=>{raw.timePoints[0].rawText=sentence})
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.result.timePoints[0].normalizedValue,'2027-03-08T16:00');assert.equal(r.body.result.timePoints[0].selected,true)
})

test('one complete labelled range preserves both existing endpoints, never a missing/shared owner or backwards range',async()=>{
 for(const kind of ['valid','shared','missing-end','backwards']){
  const source=kind==='backwards'?'活动于2027年3月8日21:00开始，20:30结束。':'活动于2027年3月8日19:00开始，20:30结束。'
  const r=await run(source,raw=>{eventResponse(raw);raw.evidence=[{...raw.evidence[0],id:'WHOLE',quote:source.slice(0,-1),quotedText:source.slice(0,-1)}];raw.timePoints.forEach(p=>{p.rawText=source.slice(0,-1);p.evidenceIds=['WHOLE']});raw.events[0].evidenceIds=['WHOLE'];if(kind==='shared')raw.events.push({...raw.events[0],tempId:'OTHER'});if(kind==='missing-end'){raw.events[0].endTimePointTempId=null;raw.timePoints.pop()}})
  assert.equal(r.status,200,JSON.stringify(r.body));if(kind==='valid'){assert.deepEqual(r.body.result.timePoints.map(p=>p.normalizedValue),['2027-03-08T19:00','2027-03-08T20:30']);assert.ok(r.body.result.timePoints.every(p=>p.selected))}else assert.equal(r.body.execution.timeContextProjection.decisions.length,0)
 }
})

test('next-day AM/PM is resolved by a real existing event start and contiguous cited duration, not by model dates',async()=>{
 const source='服务将在本周三（11月17日）晚上11点到次日1点停机维护，预计2小时，完成后正常恢复。'
 function change(raw){eventResponse(raw);raw.timePoints[0].rawText='本周三（11月17日）晚上11点';raw.timePoints[1].rawText='次日1点';raw.timePoints.forEach(p=>p.evidenceIds=['WHOLE']);raw.events[0].evidenceIds=['WHOLE'];raw.events[0].title='服务';raw.evidence=[{...raw.evidence[0],id:'WHOLE',quote:source,quotedText:source}];raw.createdAt='2021-11-15T09:00:00+08:00'}
 const raw=fixture(source);change(raw)
 const opts={referenceTime:'2021-11-15T09:00:00+08:00',timezone:'Asia/Shanghai'}
 assert.equal(citedTimeContext(raw.timePoints[1],raw,raw.evidence,source,opts).endpoint,'2021年11月18日01:00')
 const actual=await run(source,change,opts.referenceTime);assert.equal(actual.status,200,JSON.stringify(actual.body));assert.deepEqual(actual.body.result.timePoints.map(p=>p.normalizedValue),['2021-11-17T23:00','2021-11-18T01:00']);assert.ok(actual.body.result.timePoints.every(p=>p.selected))
 for(const bad of ['owner','duration','conditional','reference']){const b=structuredClone(raw);let text=source;if(bad==='owner')b.events.push({...b.events[0],tempId:'OTHER'});if(bad==='duration'){text=source.replace('2小时','3小时');b.evidence[0].quote=text}if(bad==='conditional'){text='如果'+source;b.evidence[0].quote=text}assert.equal(citedTimeContext(b.timePoints[1],b,b.evidence,text,bad==='reference'?{}:opts),null,bad)}
})
function fixture(source){return {schemaVersion:'2.0',promptVersion:'recognition-product-contract-1.2.0',modelName:'deepseek-v4-flash',createdAt:reference,sourceSummary:{title:'提交登记表',sourceType:'text',notificationType:'material_submission',summary:source,requiresAction:true,actionReason:'原文明示提交登记表'},projectMatch:{decision:'standalone_task',matchedProjectId:null,suggestedProjectTitle:null,confidence:1,reasons:[]},projectSuggestion:null,milestones:[],standaloneTasks:[{tempId:'T',parentTempId:null,hierarchyType:'task',title:'提交登记表',actionVerb:'提交',actionObject:'登记表',description:sentence,completionCriteria:['登记表已提交'],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:['P'],evidenceIds:['Q'],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:true,selected:true}],materials:[],timePoints:[{tempId:'P',type:'submission_deadline',rawText:'当日16:00前',normalizedValue:'2029-01-01T16:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:['T'],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:1,selected:true}],events:[],evidence:[{id:'Q',sourceId:'pending-source',quote:sentence,quotedText:sentence,field:'deadline',extractionMethod:'ai',confidence:1}],conflicts:[],ambiguities:[],ignoredContent:[],quality:{overallConfidence:1,hierarchyConfidence:1,dateConfidence:1,evidenceCoverage:1,duplicateRisk:0,overFragmentationRisk:0,missingActionRisk:0,needsHumanReview:false,reviewReasons:[]}}}
async function run(source,change=()=>{},referenceTime=reference){
 const raw=fixture(source);change(raw);const before=structuredClone(raw)
 const worker=createWorker({fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify(raw)}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})})
 const response=await worker.fetch(new Request('https://local.test/api/deepseek/extract',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json'},body:JSON.stringify({content:source,sourceTitle:'匿名同日交付',sourceType:'text',referenceTime,timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'server-only-test-key-with-length',ALLOWED_ORIGINS:'https://local.test'})
 assert.deepEqual(raw,before,'Original model bytes/objects must remain unchanged')
 return {status:response.status,body:await response.json()}
}
test('actual Worker keeps a cited same-day deadline selected through both normalization passes',async()=>{
 for(const day of [8,19]){
  const source=`纸质登记表于2027年3月${day}日09:00—11:00递交，${sentence}。`,r=await run(source)
  assert.equal(r.status,200,JSON.stringify(r.body));const p=r.body.result.timePoints[0]
  assert.equal(p.normalizedValue,`2027-03-${String(day).padStart(2,'0')}T16:00`);assert.equal(p.rawText,'当日16:00前');assert.equal(p.selected,true);assert.equal(p.needsConfirmation,false)
  const audit=r.body.execution.timeContextProjection
  assert.equal(audit.version,'cited-same-day-normalization-1.1.0');assert.equal(audit.decisions[0].original.normalizedValue,'2029-01-01T16:00');assert.equal(audit.decisions[0].normalizedInput.selected,false);assert.equal(audit.decisions[0].after.selected,true)
 }
})
test('no date, multiple dates, another paragraph, cancelled context and repeated evidence stay unresolved',async()=>{
 for(const source of [`请递交纸质登记表，${sentence}。`,`纸质登记表于2027年3月8日或2027年3月9日递交，${sentence}。`,`纸质登记表于2027年3月8日递交。${sentence}。`,`已取消2027年3月8日纸质递交，${sentence}。`,`2027年3月8日，${sentence}。2027年3月9日，${sentence}。`]){
  const r=await run(source);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.result.timePoints[0].normalizedValue,null);assert.equal(r.body.result.timePoints[0].selected,false)
 }
})
test('foreign primary evidence and a nonexistent owner still fail the actual shared validator',async()=>{
 const source=`纸质登记表于2027年3月8日递交，${sentence}。`
 for(const change of [r=>{r.timePoints[0].evidenceIds=['MISSING']},r=>{r.timePoints[0].relatedTaskTempIds=['MISSING']}])assert.equal((await run(source,change)).status,502)
 const point=fixture(source).timePoints[0];assert.equal(citedSameDayContext(point,[],source),null)
})
function eventResponse(raw){
 raw.standaloneTasks=[];raw.sourceSummary.requiresAction=false;raw.sourceSummary.notificationType='event_notice'
 raw.evidence=[{id:'QS',sourceId:'pending-source',quote:'说明会于2027年3月8日19:00开始',quotedText:'说明会于2027年3月8日19:00开始',field:'event',extractionMethod:'ai',confidence:1},{id:'QE',sourceId:'pending-source',quote:'20:30结束',quotedText:'20:30结束',field:'event',extractionMethod:'ai',confidence:1}]
 const point=raw.timePoints[0]
 raw.timePoints=[{...point,tempId:'S',type:'event_start',rawText:'2027年3月8日19:00',relatedTaskTempIds:[],evidenceIds:['QS']},{...point,tempId:'E',type:'event_end',rawText:'20:30',relatedTaskTempIds:[],evidenceIds:['QE']}]
 raw.events=[{tempId:'EV',title:'说明会',description:'说明会安排',startTimePointTempId:'S',endTimePointTempId:'E',location:null,relatedTaskTempIds:[],evidenceIds:['QS','QE'],confidence:1,inferenceLevel:'explicit',selected:true}]
}
test('an existing event end inherits its own adjacent cited start date and remains selected',async()=>{
 const r=await run('说明会于2027年3月8日19:00开始，20:30结束。',eventResponse)
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.result.timePoints[1].normalizedValue,'2027-03-08T20:30');assert.equal(r.body.result.timePoints[1].selected,true)
 assert.equal(r.body.execution.timeContextProjection.decisions[0].rule,'EXISTING_EVENT_ADJACENT_START_DATE')
})
test('a single full event quote supports its own existing start and end, including a named start literal',async()=>{
 const source='说明会于2027年3月8日19:00开始，20:30结束。',r=await run(source,raw=>{
  eventResponse(raw);raw.timePoints[0].rawText='说明会于2027年3月8日19:00开始';raw.timePoints[1].rawText='20:30结束';raw.timePoints.forEach(p=>p.evidenceIds=['WHOLE']);raw.events[0].evidenceIds=['WHOLE'];raw.evidence=[{id:'WHOLE',sourceId:'pending-source',quote:source.slice(0,-1),quotedText:source.slice(0,-1),field:'event',extractionMethod:'ai',confidence:1}]
 })
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.result.timePoints[1].normalizedValue,'2027-03-08T20:30');assert.equal(r.body.result.timePoints[1].selected,true)
})
test('a foreign/shared owner, an uncited start, a backwards clock and an intervening clause cannot supply an end date',async()=>{
 for(const kind of ['shared','uncited','backwards','intervening']){
  const source=kind==='intervening'?'说明会于2027年3月8日19:00开始，另一场培训另行通知，20:30结束。':kind==='backwards'?'说明会于2027年3月8日21:00开始，20:30结束。':'说明会于2027年3月8日19:00开始，20:30结束。'
  const r=await run(source,raw=>{eventResponse(raw);if(kind==='shared')raw.events.push({...raw.events[0],tempId:'OTHER'});if(kind==='uncited')raw.events[0].evidenceIds=['QE'];if(kind==='backwards'){raw.timePoints[0].rawText='2027年3月8日21:00';raw.evidence[0].quote='说明会于2027年3月8日21:00开始';raw.evidence[0].quotedText=raw.evidence[0].quote}})
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.result.timePoints[1].normalizedValue,null);assert.equal(r.body.result.timePoints[1].selected,false)
 }
})
