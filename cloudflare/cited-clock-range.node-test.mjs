import test from 'node:test'
import assert from 'node:assert/strict'
import {projectCitedClockRanges} from './cited-clock-range.mjs'
import {applyDeterministicTimeAst,normalizeRecognitionResult} from './recognition.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
const reference='2027-04-01T09:00:00+08:00',timezone='Asia/Shanghai'
function fixture(){const rawText='2027年4月9日09:00—4月12日16:00',source='答疑活动时间：'+rawText+'。',evidence=[{id:'Q',quote:source,field:'event'}],point={rawText,timezone,isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:1,selected:true};return {source,raw:{schemaVersion:'2.0',evidence,standaloneTasks:[],materials:[],timePoints:[{...point,tempId:'S',type:'event_start',normalizedValue:'2027-04-09T09:00'},{...point,tempId:'E',type:'event_end',normalizedValue:'2027-04-12T16:00'}],events:[{tempId:'EV',title:'答疑活动',startTimePointTempId:'S',endTimePointTempId:'E',evidenceIds:['Q']}],conflicts:[]}}}
test('a correct cross-date end survives both actual Worker normalization stages; no source or input changes',()=>{
  const {source,raw}=fixture(),original=structuredClone(raw)
  const first=applyDeterministicTimeAst(raw,reference,timezone,source),second=normalizeRecognitionResult(first,source,reference,undefined,undefined,true,timezone)
  assert.deepEqual(second.timePoints.map(p=>p.normalizedValue),['2027-04-09T09:00','2027-04-12T16:00'])
  assert.deepEqual(raw,original);assert.equal(second.timePoints.length,2)
  assert.equal(validateRecognitionResult(second,{sourceContent:source}).valid,true)
})
test('an interval declared as a deadline stays a local conflict; a good raw endpoint is retained in audit, never replaced with its start',()=>{
  const {source,raw}=fixture();raw.events=[];raw.timePoints=raw.timePoints.map(p=>({...p,type:'registration_deadline'}));const original=structuredClone(raw)
  const result=projectCitedClockRanges(raw,source,reference,timezone)
  assert.equal(result.audit.decisions[1].before.normalizedValue,'2027-04-12T16:00')
  assert.ok(result.result.timePoints.every(p=>p.normalizedValue===null&&p.needsConfirmation&&p.selected===false))
  assert.equal(result.result.conflicts.length,2);assert.deepEqual(raw,original)
  const normalized=normalizeRecognitionResult(applyDeterministicTimeAst(raw,reference,timezone,source),source,reference,undefined,undefined,true,timezone)
  assert.ok(normalized.timePoints.every(p=>p.normalizedValue===null&&p.needsConfirmation&&p.selected===false))
})
test('an independently stated scalar deadline remains exact, including an end date shared with another interval',()=>{
  const {source,raw}=fixture();raw.evidence.push({id:'D',quote:'提交截止为2027年4月12日16:00。',field:'deadline'});raw.timePoints.push({...raw.timePoints[1],tempId:'D',type:'submission_deadline',rawText:'2027年4月12日16:00',evidenceIds:['D']})
  const out=normalizeRecognitionResult(raw,source+'提交截止为2027年4月12日16:00。',reference,undefined,undefined,true,timezone)
  assert.equal(out.timePoints.at(-1).normalizedValue,'2027-04-12T16:00');assert.equal(out.timePoints.at(-1).needsConfirmation,false)
})
test('wrong owner, multiple owners, reversed or conditional ranges cannot acquire a definite endpoint',()=>{
  for(const mode of ['wrong owner','multiple owners','reversed','conditional']){
    const {source,raw}=fixture();let text=source
    if(mode==='wrong owner')raw.events[0].evidenceIds=[]
    if(mode==='multiple owners')raw.events.push({...raw.events[0],tempId:'FOREIGN'})
    if(mode==='reversed'){for(const p of raw.timePoints)p.rawText=p.rawText.replace('4月12日','4月8日');raw.evidence[0].quote=source.replace('4月12日','4月8日');text=raw.evidence[0].quote}
    if(mode==='conditional'){text='如果获批，'+source;raw.evidence[0].quote=text}
    const out=projectCitedClockRanges(raw,text,reference,timezone)
    assert.ok(out.result.timePoints.every(p=>p.normalizedValue===null&&p.needsConfirmation),mode)
  }
})
test('a false owner ID still fails the real schema; the repair never fabricates a missing entity',()=>{
  const {source,raw}=fixture();raw.events[0].relatedTaskTempIds=['NO_TASK'];const out=normalizeRecognitionResult(raw,source,reference,undefined,undefined,true,timezone)
  assert.deepEqual(out.events[0].relatedTaskTempIds,['NO_TASK']);assert.equal(validateRecognitionResult(out,{sourceContent:source}).valid,false)
  assert.equal(out.timePoints.length,raw.timePoints.length)
})
test('already-working single-day event values and selection are outside the repair',()=>{
  const {raw}=fixture(),literal='2027年4月9日09:00—11:30',source='答疑活动时间：'+literal+'。'
  raw.evidence[0].quote=source;raw.timePoints.forEach(p=>{p.rawText=literal;p.selected=false});raw.timePoints[1].normalizedValue='2027-04-09T11:30'
  const out=projectCitedClockRanges(raw,source,reference,timezone)
  assert.equal(out.result,raw);assert.deepEqual(out.audit.decisions,[])
})
