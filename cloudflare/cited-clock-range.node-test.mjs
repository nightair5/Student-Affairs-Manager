import test from 'node:test'
import assert from 'node:assert/strict'
import {projectCitedClockRanges} from './cited-clock-range.mjs'
import {applyDeterministicTimeAst,normalizeRecognitionResult} from './recognition.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
const reference='2027-04-01T09:00:00+08:00',timezone='Asia/Shanghai'

test('width and an afternoon shared by two declared event endpoints survive both Worker stages',()=>{
 for(const [literal,a,b]of[['2027年4月16日14：30-16：30','14:30','16:30'],['2027年4月16日下午1:00-3:00','13:00','15:00']]){
  const {raw}=fixture(),source='讲座时间：'+literal+'。';raw.evidence[0].quote=source
  raw.timePoints.forEach(p=>{p.rawText=literal;p.normalizedValue='2027-04-16T'+(p.type==='event_start'?a:b)})
  const before=structuredClone(raw),out=normalizeRecognitionResult(applyDeterministicTimeAst(raw,reference,timezone,source),source,reference,undefined,undefined,true,timezone)
  assert.deepEqual(out.timePoints.map(p=>p.normalizedValue),['2027-04-16T'+a,'2027-04-16T'+b]);assert.ok(out.timePoints.every(p=>!p.needsConfirmation));assert.deepEqual(raw,before)
 }
})

test('a typed single-day clock range cannot acquire a different owner or become a current cancelled event',()=>{
 for(const kind of['owner','cancelled']){
  const {raw}=fixture(),literal='2027年4月16日下午1:00-3:00',source=(kind==='cancelled'?'取消本次讲座，原时间：':'讲座时间：')+literal+'。'
  raw.evidence[0].quote=source;raw.timePoints.forEach(p=>{p.rawText=literal})
  if(kind==='owner')raw.events[0].evidenceIds=[]
  const out=projectCitedClockRanges(raw,source,reference,timezone);assert.ok(out.result.timePoints.every(p=>p.normalizedValue===null&&!p.selected));assert.ok(out.audit.decisions.every(d=>d.blocked))
 }
})
test('a working task-owned handling window keeps its values, selection and conflict-free path',()=>{
 const {raw}=fixture(),literal='2027年4月16日09:00—11:00',source='领取资料办理时间：'+literal+'。'
 raw.evidence[0].quote=source;raw.events=[]
 raw.standaloneTasks=[{tempId:'T',actionVerb:'领取',actionObject:'资料',evidenceIds:['Q'],timePointTempIds:['S','E']}]
 raw.timePoints.forEach(p=>{p.rawText=literal;p.relatedTaskTempIds=['T'];p.normalizedValue='2027-04-16T'+(p.type==='event_start'?'09:00':'11:00')})
 const before=structuredClone(raw),out=projectCitedClockRanges(raw,source,reference,timezone)
 assert.deepEqual(out.result,before);assert.deepEqual(raw,before);assert.ok(out.audit.decisions.every(d=>!d.blocked))
})
test('a tentative clock range never becomes confirmed through the two actual Worker stages',()=>{
 for(const status of ['预计','可能','拟定','暂定','尚未确定','待确定']){
  const {raw}=fixture(),literal='2027年4月16日14:30-16:30',source=`讲座${status}于${literal}举行。`
  raw.events[0].title='讲座';raw.evidence[0].quote=source
  raw.timePoints.forEach((p,i)=>{p.rawText=literal;p.normalizedValue='2027-04-16T'+(i?'16:30':'14:30')})
  const before=structuredClone(raw),out=normalizeRecognitionResult(applyDeterministicTimeAst(raw,reference,timezone,source),source,reference,undefined,undefined,true,timezone)
  assert.ok(out.timePoints.every(p=>p.needsConfirmation&&p.selected===false),status);assert.deepEqual(raw,before)
 }
})
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

test('already-working bare Chinese-hour intervals keep their original selection path',()=>{
  const {raw}=fixture(),literal='2027年4月16日（星期日）18时至22时',source=literal+'，维护期间机房可能断电。'
  raw.evidence[0].quote=source;raw.timePoints.forEach(p=>{p.rawText=literal;p.selected=false})
  const out=projectCitedClockRanges(raw,source,reference,timezone)
  assert.equal(out.result,raw);assert.deepEqual(out.audit.decisions,[])
})

test('Chinese-hour interval inside one cited sentence selects its own end, not the first clock',()=>{
  for(const [day,a,b] of [[16,18,22],[21,7,9]]){
    const {raw}=fixture(),source=`2027年4月${day}日（星期日）${a}时至${b}时，学校将进行供电维护，受其影响机房可能断电。`
    raw.evidence[0].quote=source;raw.timePoints.forEach(p=>{p.rawText=source});raw.timePoints[1].normalizedValue=`2027-04-${day}T${b}:00`
    const before=structuredClone(raw),out=normalizeRecognitionResult(applyDeterministicTimeAst(raw,reference,timezone,source),source,reference,undefined,undefined,true,timezone)
    assert.deepEqual(out.timePoints.map(p=>p.normalizedValue),[`2027-04-${day}T${String(a).padStart(2,'0')}:00`,`2027-04-${day}T${String(b).padStart(2,'0')}:00`])
    assert.ok(out.timePoints.every(p=>p.selected&&!p.needsConfirmation));assert.deepEqual(raw,before)
  }
})

test('whole-sentence hours cannot invent a missing end or borrow shared, foreign, conditional or backwards evidence',()=>{
  for(const kind of ['missing','shared','foreign','conditional','backwards','uncited']){
    const {raw}=fixture();let source='2027年4月16日18时至22时进行维护。'
    if(kind==='conditional')source='若审批通过，'+source
    if(kind==='backwards')source=source.replace('22时','17时')
    raw.evidence[0].quote=source;raw.timePoints.forEach(p=>{p.rawText=source})
    if(kind==='missing'){raw.timePoints.pop();raw.events[0].endTimePointTempId=null}
    if(kind==='shared')raw.events.push({...raw.events[0],tempId:'OTHER'})
    if(kind==='foreign')raw.events[0].evidenceIds=[]
    if(kind==='uncited')raw.timePoints[1].evidenceIds=[]
    const out=projectCitedClockRanges(raw,source,reference,timezone)
    assert.ok(out.result.timePoints.every(p=>p.normalizedValue===null&&!p.selected),kind)
    assert.equal(out.result.timePoints.length,raw.timePoints.length)
  }
})
