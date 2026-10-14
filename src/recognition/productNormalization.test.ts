import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {bindOrdinaryProviderSupport} from './ordinaryProviderSupport'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {supportedEventOperation} from './compoundNameSupport'
import {validateRecognitionResult} from './schema'
import type {RecognitionResult} from './types'

function base(text:string):RecognitionResult{
 const r=ordinaryWorkflowFixture();r.sourceSummary.summary=text;r.standaloneTasks=[];r.materials=[];r.timePoints=[];r.events=[];r.evidence=[{id:'Q',sourceId:'pending-source',quote:text,field:'description'}];return r
}
function point(id:string,type:'event_start'|'event_end',raw:string,quoteId='Q'):RecognitionResult['timePoints'][number]{return {tempId:id,type,rawText:raw,normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[quoteId],confidence:.9,selected:false}}
function event(id:string,title:string,start:string,end:string,quoteId='Q'):RecognitionResult['events'][number]{return {tempId:id,title,description:title,startTimePointTempId:start,endTimePointTempId:end,location:null,evidenceIds:[quoteId],confidence:.9,inferenceLevel:'explicit',selected:false}}
function first(r:RecognitionResult,text:string){expect(validateRecognitionResult(r,{sourceContent:text}).valid).toBe(true);const bound=bindOrdinaryProviderSupport(r,{sourceId:'PRODUCT-ANONYMOUS',sourceVersionId:'PRODUCT-ANONYMOUS-v1',sourceText:text,referenceTime:'2026-10-14T08:30:00+08:00',timezone:'Asia/Shanghai'},JSON.stringify({result:r}));return assembleCurrentFirstSuggestion(bound.result,{sourceText:text,referenceTime:'2026-10-14T08:30:00+08:00',timezone:'Asia/Shanghai'})}
describe('product normalization through real schema and common first screen',()=>{
 it('an already-declared named shutdown survives intervening literal date words; conditions/foreign entities do not',()=>{
  const text='借阅平台将在周四晚停机，借阅记录不受影响。',r=base(text);r.timePoints=[point('P','event_start','周四晚')];r.events=[{...event('E','借阅平台停机','P','P'),endTimePointTempId:null}]
  const x=first(r,text);expect(x.result.events[0].title).toBe('借阅平台停机');expect(x.result.timePoints[0].normalizedValue).toBeNull()
  expect(supportedEventOperation('其它平台停机',[text],text,true)).toBe(false)
  const conditional='如果借阅平台将在周四晚停机，再发布通知。';expect(supportedEventOperation('借阅平台停机',[conditional],conditional,true)).toBe(false)
  const cancelled='借阅平台不再于周四晚停机。';expect(supportedEventOperation('借阅平台停机',[cancelled],cancelled,true)).toBe(false)
 })
 it('two existing endpoints citing one whole clock range keep their actual roles',()=>{
  const text='说明会于2026年11月3日13:10—14:45在学习室举行。',r=base(text);r.timePoints=[point('A','event_start','2026年11月3日13:10—14:45'),point('B','event_end','2026年11月3日13:10—14:45')];r.events=[event('E','说明会','A','B')]
  const x=first(r,text);expect(x.result.timePoints.map(p=>p.normalizedValue)).toEqual(['2026-11-03T13:10','2026-11-03T14:45']);expect(x.result.timePoints.map(p=>p.rawText)).toEqual(r.timePoints.map(p=>p.rawText))
  const ambiguous='说明会分2026年11月3日13:10—14:45和2026年11月4日09:00—10:00两场。';const a=base(ambiguous);a.timePoints=[point('A','event_start',ambiguous),point('B','event_end',ambiguous)];a.events=[event('E','说明会','A','B')];expect(first(a,ambiguous).result.timePoints.every(p=>p.normalizedValue===null)).toBe(true)
 })
 it('the explicitly subsequent same-day event inherits only the adjacent cited event date, never a deadline or next day',()=>{
  const previous='社团分享于2026年11月3日10:00—11:00在报告厅举行',later='随后11:20—12:00在同一地点开展作品展示',text=previous+'。'+later+'。',r=base(text)
  r.evidence=[{id:'PREV',sourceId:'pending-source',quote:previous,field:'event'},{id:'NEXT',sourceId:'pending-source',quote:later,field:'event'}];r.timePoints=[point('A','event_start','2026年11月3日10:00','PREV'),point('B','event_end','11:00','PREV'),point('C','event_start','11:20','NEXT'),point('D','event_end','12:00','NEXT')];r.events=[event('E1','社团分享','A','B','PREV'),event('E2','作品展示','C','D','NEXT')]
  expect(first(r,text).result.timePoints.slice(2).map(p=>p.normalizedValue)).toEqual(['2026-11-03T11:20','2026-11-03T12:00'])
  const inclusive=structuredClone(r);inclusive.evidence[0].quote=previous+'。';expect(first(inclusive,text).result.timePoints.slice(2).map(p=>p.normalizedValue)).toEqual(['2026-11-03T11:20','2026-11-03T12:00'])
  const other=structuredClone(r);other.events=[other.events[1]];expect(first(other,text).result.timePoints.slice(2).every(p=>p.normalizedValue===null)).toBe(true)
  const nextDay=text.replace('随后','次日');const n=structuredClone(r);n.evidence[1].quote=later.replace('随后','次日');expect(first(n,nextDay).result.timePoints.slice(2).every(p=>p.normalizedValue===null)).toBe(true)
 })
})
