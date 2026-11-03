import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {compileSemanticNotice} from '../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from './schema'
import {convertSemanticNotice} from './directSemanticNotice'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {commitDirectDraft,undoDirectBatch} from '../domain/v2/directIntake'
import {workspaceV8ToLegacyView} from '../domain/v2/legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from '../domain/v2/serialization'
import {FlowTimeline} from '../components/FlowTimeline'
import {directReplacementDiff} from '../domain/v2/directReplacementSafety'

const source='交流说明会可任选一场：12月10日14:00在明德楼101参加线下说明会，或12月12日19:00参加线上说明会；只参加其中一场即可。'
const raw={topic:'交流说明会',kind:'event',items:[
 {key:'onsite',kind:'event',title:'线下说明会',status:'active',evidence:['12月10日14:00在明德楼101参加线下说明会','只参加其中一场即可'],times:[{role:'start',raw:'12月10日14:00'}],location:'明德楼101'},
 {key:'online',kind:'event',title:'线上说明会',status:'active',evidence:['12月12日19:00参加线上说明会','只参加其中一场即可'],times:[{role:'start',raw:'12月12日19:00'}]},
],materials:[]}
const compile=(input:unknown,text=source)=>parseRecognitionResult(compileSemanticNotice(input,{source:text,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'}).result)

it('keeps three source-backed sessions uncommitted when one is to be chosen',()=>{
 const text='作品辅导有三个场次：12月25日9:00在甲楼、12月26日14:00在乙楼、12月27日19:00线上；每人只参加其中一场。'
 const facts={topic:'作品辅导',kind:'event',items:[
  {key:'a',kind:'event',title:'甲楼辅导',evidence:['12月25日9:00在甲楼'],times:[{role:'start',raw:'12月25日9:00'}],requirements:['每人只参加其中一场']},
  {key:'b',kind:'event',title:'乙楼辅导',evidence:['12月26日14:00在乙楼'],times:[{role:'start',raw:'12月26日14:00'}],requirements:['每人只参加其中一场']},
  {key:'c',kind:'event',title:'线上辅导',evidence:['12月27日19:00线上'],times:[{role:'start',raw:'12月27日19:00'}],requirements:['每人只参加其中一场']},
 ],materials:[]}
 const result=compile(facts,text)
 expect(result.events.map(event=>event.sourceStatus)).toEqual(['alternative','alternative','alternative'])
 expect(convertSemanticNotice(result,text).result.events.every(event=>event.startTimePointTempId===null)).toBe(true)
})

it('keeps sessions uncommitted for a source-backed 从两次中选一次 instruction',()=>{
 const text='咨询会两次：12月10日9:30在甲楼，12月11日14:30在乙楼。每人从两次中选一次参加。'
 const facts={topic:'咨询会',kind:'event',items:[
  {key:'a',kind:'event',title:'甲楼咨询',evidence:['12月10日9:30在甲楼'],times:[{role:'start',raw:'12月10日9:30'}],requirements:['每人从两次中选一次参加']},
  {key:'b',kind:'event',title:'乙楼咨询',evidence:['12月11日14:30在乙楼'],times:[{role:'start',raw:'12月11日14:30'}],requirements:['每人从两次中选一次参加']},
 ],materials:[]}
 const result=compile(facts,text)
 expect(result.events.map(event=>event.sourceStatus)).toEqual(['alternative','alternative'])
 expect(convertSemanticNotice(result,text).result.events.every(event=>event.startTimePointTempId===null)).toBe(true)
})

describe('source-backed event choices',()=>{
 it('keeps separate candidate times and locations without creating confirmed appointments',async()=>{
  const result=compile(raw),direct=convertSemanticNotice(result,source)
  expect(result.events.map(event=>event.sourceStatus)).toEqual(['alternative','alternative'])
  expect(result.conflicts.some(conflict=>conflict.id.startsWith('sem-event-choice-')&&conflict.entityTempIds.length===2)).toBe(true)
  expect(direct.result.events.every(event=>event.startTimePointTempId===null)).toBe(true)
  expect(direct.result.events.map(event=>event.description)).toEqual(expect.arrayContaining([expect.stringContaining('12月10日14:00'),expect.stringContaining('12月12日19:00')]))
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(workspace)
  const capture=new CapturePersistenceService(repo)
  const add=async(operationId:string)=>{
   const handle=await capture.beginCapture({operationId,sourceType:'text',title:'交流说明会',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now:'2026-11-03T02:00:00Z'})
   await capture.recognize(handle,async()=>result)
   return commitDirectDraft(repo,handle.draftId,'2026-11-03T02:00:00Z')
  }
  const first=await add('event-choice-first'),second=await add('event-choice-second')
  const saved=(await repo.load())!
  expect(saved.events).toHaveLength(4)
  expect(saved.events.every(event=>event.startTimePointId===null)).toBe(true)
  expect(saved.timePoints.filter(point=>point.eventId)).toHaveLength(0)
  const choice=saved.events[0].legacyData?.sourceEventChoice as {id:string;optionEventIds:string[];candidateTimes:{rawText:string;normalizedValue:string}[]}
  const other=saved.events[1].legacyData?.sourceEventChoice as typeof choice
  expect(choice.id).toBe(other.id)
  expect(choice.optionEventIds).toHaveLength(2)
  expect(choice.candidateTimes[0]).toMatchObject({rawText:'12月10日14:00',normalizedValue:'2026-12-10T14:00'})
  expect(other.candidateTimes[0]).toMatchObject({rawText:'12月12日19:00',normalizedValue:'2026-12-12T19:00'})
  const restored=importWorkspaceV8(exportWorkspaceV8(saved)),view=workspaceV8ToLegacyView(restored)
  expect(view.events[0].startAt).toBeNull()
  expect(view.events[0].location).toBe('明德楼101')
  expect(view.events[0].description).toContain('任选一场，尚未安排')
  const html=renderToStaticMarkup(<FlowTimeline tasks={[]} events={view.events} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).toContain('任选一场');expect(html).toContain('12月10日14:00')
  const ids=new Set(first.batch!.items.map(item=>item.id)),withoutChoice=structuredClone(saved)
  for(const event of withoutChoice.events)if(ids.has(event.id)&&event.legacyData)delete event.legacyData.sourceEventChoice
  expect(directReplacementDiff(saved,withoutChoice,ids,ids).issues.some(issue=>issue.field==='choice')).toBe(true)
  const withoutCandidate=structuredClone(saved),edited=withoutCandidate.events.find(event=>ids.has(event.id))!
  const editedChoice=edited.legacyData?.sourceEventChoice as typeof choice
  editedChoice.candidateTimes=[]
  expect(directReplacementDiff(saved,withoutCandidate,ids,ids).issues.some(issue=>issue.field==='choice')).toBe(true)
  await undoDirectBatch(repo,second.batch!.id)
  expect((await repo.load())!.events.map(event=>event.id).sort()).toEqual(first.batch!.items.map(item=>item.id).sort())
 })
 it('does not turn two ordinary events into a choice without a shared explicit source instruction',()=>{
  const text='12月10日14:00在明德楼101参加线下说明会，12月12日19:00参加线上说明会，欢迎两场都参加。'
  const facts=structuredClone(raw)
  facts.items[0].evidence=['12月10日14:00在明德楼101参加线下说明会']
  facts.items[1].evidence=['12月12日19:00参加线上说明会']
  const result=compile(facts,text)
  expect(result.events.every(event=>event.sourceStatus!=='alternative')).toBe(true)
  expect(result.events.every(event=>event.startTimePointTempId!==null)).toBe(true)
 })
 it('does not guess an unrelated or ungrounded event belongs to the choice',()=>{
  const facts=structuredClone(raw)
  facts.items[1].evidence=['12月12日19:00参加线上说明会']
  const result=compile(facts)
  expect(result.events.every(event=>event.sourceStatus!=='alternative')).toBe(true)
 })
 it('retains choice expressed in both model requirements even when the event quotations are separate',()=>{
  const facts=structuredClone(raw) as typeof raw & {items:Array<(typeof raw.items)[number]&{requirements?:string[]}>}
  facts.items[0].evidence=['12月10日14:00在明德楼101参加线下说明会']
  facts.items[1].evidence=['12月12日19:00参加线上说明会']
  for(const item of facts.items)item.requirements=['两种方式任选一场，只参加其中一场即可']
  const result=compile(facts)
  expect(result.events.map(event=>event.sourceStatus)).toEqual(['alternative','alternative'])
  expect(convertSemanticNotice(result,source).result.events.every(event=>event.startTimePointTempId===null)).toBe(true)
 })
})
