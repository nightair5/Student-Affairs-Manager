import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {FlowTimeline} from '../../components/FlowTimeline'
import {CompactEventDetailPanel} from '../../components/CompactEventDetailPanel'
import {sourceNoticeContextForEntity} from '../../lib/sourceNoticeContext'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {improveDirectFallback} from '../../recognition/directFallback'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,editDirectItem,undoDirectBatch} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import type {JsonValue} from './types'

const now='2026-11-12T14:00:00Z'
const volunteer='✨【校园志愿服务日】\n📅 活动时间：12月3日\n📍 活动地点：知行楼\n\n🔗 接待组（人数若干）：\n联系来宾并确认行程。\n\n🖥️ 技术组：\n放映（2人）｜负责投影。\n声光（2人）｜负责灯光。\n\n🎟️ 现场组：\n引导（4人）｜安排入场。\n\n🎤 舞台组·主持助理（1人）：\n准备主持稿。\n\n报名截止11月15日中午12:00。\n\n福利：\n服务时长待定。\n\n报名方式：\n填写报名问卷，报名完成后加入志愿者群。'
const activity='【校园主题交流会】\n【宣讲时间】11月13日（本周五）16:00－17:30\n【宣讲地点】知行楼201\n\n本次交流将介绍行业发展、岗位要求与实践机会，邀请多家机构参与并提供现场咨询服务。\n\n参加者请于11月12日19:00前填写报名问卷。'
async function prepare(source:string,semantic=false){
 const w=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo);await repo.save(w)
 let result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 if(semantic){result=improveDirectFallback(result,source);result.promptVersion='recognition-semantic-notice-3.11.0';result.modelName='synthetic-answer';for(const event of result.events){event.description='参加须知：欢迎参加';event.endTimePointTempId=null}}
 const handle=await capture.beginCapture({operationId:'fixture',sourceType:'text',title:'匿名工程通知',rawText:source,provider:semantic?'deepseek':'local-rules',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'fixture',now})
 await capture.recognize(handle,async()=>result)
 const receipt=await commitDirectDraft(repo,handle.draftId,now)
 return {repo,store,receipt}
}
describe('source details in the saved direct flow',()=>{
 it('preserves role groups and renders them in the selected task without creating role obligations',async()=>{
  const {repo,store,receipt}=await prepare(volunteer),fresh=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(fresh)
  expect(view.events).toHaveLength(1);expect(view.events[0].startAt).toBe('2026-12-03');expect(view.events[0].location).toBe('知行楼')
  expect(view.tasks).toHaveLength(1);expect(view.tasks[0].deadline).toBe('2026-11-15T12:00')
  for(const fact of ['接待组','技术组','放映（2人）','声光（2人）','现场组','引导（4人）','舞台组','时长待定','加入志愿者群'])expect(view.events[0].description).toContain(fact)
  const html=renderToStaticMarkup(<FlowTimeline workspace={fresh} tasks={view.tasks} allTasks={view.tasks} events={view.events} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}}/>)
  expect(html).toContain('通知中的岗位与分工（原文）');expect(html).toContain('放映（2人）');expect(html).toContain('舞台组')
  const restored=importWorkspaceV8(exportWorkspaceV8(fresh));expect(restored.events[0].description).toContain('声光（2人）')
  await undoDirectBatch(repo,receipt.batch!.id);expect((await repo.load())!.events).toHaveLength(0)
 })
 it('retains a source-backed activity overview and missing endpoint for a synthetic semantic answer',async()=>{
  const {repo,store}=await prepare(activity,true),fresh=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(fresh)
  expect(view.events).toHaveLength(1);expect(view.events[0].startAt).toBe('2026-11-13T16:00');expect(view.events[0].endAt).toBe('2026-11-13T17:30')
  expect(view.events[0].description).toContain('岗位要求与实践机会')
  expect(view.tasks[0].deadline).toBe('2026-11-12T19:00')
  expect(importWorkspaceV8(exportWorkspaceV8(fresh)).events[0].description).toContain('现场咨询')
  const event=view.events[0]
  await editDirectItem(repo,event.id,{title:event.title,date:event.startAt!,description:'用户自己写的说明',preserveTimes:true})
  const edited=(await repo.load())!,editedEvent=workspaceV8ToLegacyView(edited).events[0]
  expect(editedEvent.description).toBe('用户自己写的说明')
  expect(sourceNoticeContextForEntity(edited,'event',event.id,editedEvent.description)?.sections.some(section=>section.text.includes('实践机会'))).toBe(true)
 })
 it('shows source excerpts for an older sparse event without rewriting it, and suppresses stale or multiple-event attribution',async()=>{
  const {repo}=await prepare(activity,true),saved=(await repo.load())!,event=saved.events[0]
  event.description='参加须知：欢迎参加'
  const context=sourceNoticeContextForEntity(saved,'event',event.id,event.description,true)!
  expect(context.sections.some(section=>section.kind==='overview'&&section.text.includes('实践机会'))).toBe(true)
  expect(context.sections.some(section=>section.kind==='time'&&section.text.includes('17:30'))).toBe(true)
  const view=workspaceV8ToLegacyView(saved),html=renderToStaticMarkup(<CompactEventDetailPanel event={view.events[0]} sourceContext={context} evidenceQuotes={[]} sourceTitles={[]} onClose={()=>{}}/>)
  expect(html).toContain('通知中的活动介绍（原文）');expect(html).toContain('实践机会');expect(html).toContain('17:30')
  expect(event.description).toBe('参加须知：欢迎参加')
  const stale=structuredClone(saved);stale.sources[0].currentVersionId='newer'
  expect(sourceNoticeContextForEntity(stale,'event',event.id)).toBeNull()
  const multi=structuredClone(saved),other=structuredClone(multi.events[0]);other.id='other';multi.events.push(other)
  const batch=multi.extractionDrafts[0].legacyData!.directBatch as Record<string,JsonValue>
  ;(batch.items as JsonValue[]).push({kind:'event',id:'other',tempId:'other',tags:[]})
  expect(sourceNoticeContextForEntity(multi,'event',event.id)?.sections).toEqual([])
 })
 it('keeps a single rescheduled event but does not present its previous range as the new time',async()=>{
  const text='【专题会议】\n会议时间：12月7日09:00-10:30\n会议地点：主楼301\n会议改期，具体时间另行通知。'
  const {repo}=await prepare(text),view=workspaceV8ToLegacyView((await repo.load())!)
  expect(view.events).toHaveLength(1)
  expect(view.events[0].startAt).toBeFalsy();expect(view.events[0].endAt).toBeFalsy()
  expect(view.events[0].description).toContain('具体时间另行通知')
 })
})
