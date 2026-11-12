import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {FlowTimeline} from '../../components/FlowTimeline'
import {eventActionGroups,pairFlowEvents} from '../../lib/homeFlow'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {improveDirectFallback} from '../../recognition/directFallback'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatch} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {commitEventCompletion} from './eventCompletion'
import {commitTaskCommand} from './taskCommand'
import {setTaskSchedule} from './taskSchedule'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {validateWorkspaceV8} from './validators/workspaceValidator'

const now='2026-11-12T02:00:00Z'
// Anonymous engineering notice; not a model answer or a production record.
const source='【11月13日｜校园职业说明会】\n【宣讲时间】11月13日（本周五）16:00－17:30\n【宣讲地点】知行楼201\n【资料入口】https://school.example/jobs\n\n本次介绍职业发展、岗位和政策，邀请36家单位到场。\n活动安排往返接驳车，并设有咨询展区。\n\n请参加说明会的同学在11.12日晚上700前填写下方问卷。\n【报名链接】https://school.example/form/1'

async function setup(){
 const workspace=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(workspace)
 const add=async(operationId:string,text=source,webPartial=false)=>{
  let handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名工程夹具',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'local',pipelineVersion:'fixture',now})
  if(webPartial)handle=await capture.attachWebSource(handle,text,{version:'web-read-1',partial:true,unreadCount:1},now)
  await capture.recognize(handle,async()=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]}))
  return {handle,receipt:await commitDirectDraft(repo,handle.draftId,now)}
 }
 return {store,repo,capture,add}
}

describe('labelled activity and its independent preparation',()=>{
 it('preserves actual facts and relation through direct save, projection, states, backup and batch undo',async()=>{
  const {store,repo,add}=await setup(),first=await add('first')
  expect((await commitDirectDraft(repo,first.handle.draftId,now)).duplicate).toBe(true)
  const independent=new CanonicalWorkspaceRepository(store),initial=(await independent.load())!,view=workspaceV8ToLegacyView(initial)
  expect(validateWorkspaceV8(initial).valid).toBe(true)
  expect(view.events).toHaveLength(1);expect(view.tasks).toHaveLength(1)
  const event=view.events[0],task=view.tasks[0],groups=eventActionGroups(view.tasks,view.events,initial)
  expect(event.title).toBe('校园职业说明会')
  expect([event.startAt,event.endAt,event.location]).toEqual(['2026-11-13T16:00','2026-11-13T17:30','知行楼201'])
  expect(event.description).toContain('36家单位');expect(event.description).toContain('接驳车');expect(event.description).toContain('咨询展区')
  expect(task.title).toContain('问卷');expect(task.deadline).toBe('2026-11-12T19:00')
  expect(task.materials.some(material=>material.submissionChannel==='https://school.example/form/1')).toBe(true)
  expect(groups[event.id]?.map(item=>item.id)).toEqual([task.id])
  const html=renderToStaticMarkup(<FlowTimeline tasks={view.tasks} allTasks={view.tasks} events={view.events} eventActions={groups} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} onSetEventCompletion={async()=>{}} />)
  expect(html).toContain('校园职业说明会');expect(html).toContain('需要准备');expect(html).toContain('19:00');expect(html).toContain('16:00');expect(html).toContain('知行楼201')
  expect(html).not.toContain('data-task-id=')

  const second=await add('second'),both=(await independent.load())!
  expect(both.events).toHaveLength(2);expect(both.tasks).toHaveLength(2)
  await undoDirectBatch(repo,second.receipt.batch!.id)
  expect((await independent.load())!.events).toEqual(initial.events)
  expect((await independent.load())!.tasks).toEqual(initial.tasks)

  const taskRecord=initial.tasks[0]
  await commitTaskCommand(repo,{operationId:'finish-form',taskId:task.id,expected:{status:taskRecord.status},changes:{status:'completed'},changedAt:'2026-11-12T02:01:00Z'})
  let saved=(await independent.load())!
  expect(saved.events[0].legacyData?.personalCompletionV1).not.toBe(true)
  await commitEventCompletion(repo,{operationId:'finish-event',eventId:event.id,expected:false,completed:true,changedAt:'2026-11-12T02:02:00Z'})
  await commitEventCompletion(repo,{operationId:'restore-event',eventId:event.id,expected:true,expectedRevision:'finish-event',completed:false,changedAt:'2026-11-12T02:03:00Z'})
  await commitTaskCommand(repo,{operationId:'restore-form',taskId:task.id,expected:{status:'completed'},changes:{status:taskRecord.status},changedAt:'2026-11-12T02:04:00Z'})
  await setTaskSchedule(repo,task.id,'2026-11-12','2026-11-12T02:05:00Z')
  saved=importWorkspaceV8(exportWorkspaceV8((await independent.load())!))
  const restored=workspaceV8ToLegacyView(saved)
  expect(restored.tasks[0].deadline).toBe('2026-11-12T19:00')
  expect(restored.events[0].startAt).toBe('2026-11-13T16:00')
  expect(restored.events[0].personalCompleted).not.toBe(true)
  expect(eventActionGroups(restored.tasks,restored.events,saved)[event.id]?.[0].id).toBe(task.id)
 })

 it('keeps two different same-day events as separate records',async()=>{
  const {repo,add}=await setup()
  await add('two-events','11月14日09:00在图书馆102参加摄影讲座。11月14日15:00在体育馆观看篮球赛。')
  const view=workspaceV8ToLegacyView((await repo.load())!)
  expect(view.events.map(event=>[event.title,event.startAt,event.location])).toEqual([
   ['摄影讲座','2026-11-14T09:00','图书馆102'],['篮球赛','2026-11-14T15:00','体育馆'],
  ])
 })
 it('marks unread source links partial while keeping the pasted facts and source',async()=>{
  const {repo,add}=await setup(),result=await add('partial',source,true),saved=(await repo.load())!
  expect(result.receipt.batch?.processing).toBe('partial')
  expect(saved.sourceVersions.some(version=>version.rawText===source)).toBe(true)
  expect(workspaceV8ToLegacyView(saved).events[0].startAt).toBe('2026-11-13T16:00')
 })
 it('does not present a conflicting weekday as a confirmed schedule',async()=>{
  const {repo,add}=await setup(),conflict=source.replace('本周五','本周四'),result=await add('conflict',conflict),view=workspaceV8ToLegacyView((await repo.load())!)
  expect(result.receipt.batch?.processing).toBe('partial')
  expect(view.events.every(event=>!event.startAt)).toBe(true)
 })
 it('keeps an explicitly overnight event and does not interpret attendance count as a time',async()=>{
  const {repo,add}=await setup(),text='【校园安全培训】\n【培训时间】11月18日（下周三）23:30－次日00:30\n【培训地点】实验楼C103\n预计700人参与。'
  await add('overnight',text)
  const view=workspaceV8ToLegacyView((await repo.load())!)
  expect(view.events).toHaveLength(1)
  expect([view.events[0].startAt,view.events[0].endAt,view.events[0].location]).toEqual(['2026-11-18T23:30','2026-11-19T00:30','实验楼C103'])
  expect(view.tasks).toHaveLength(0)
 })
 it('projects an undated attendance and its linked event as one visible entry',async()=>{
  const {repo,add}=await setup()
  await add('relative','本周课程结束后留十分钟，参加实习安排说明。具体课程日期未提供。')
  const saved=(await repo.load())!,view=workspaceV8ToLegacyView(saved),pair=pairFlowEvents(view.tasks,view.events,saved)
  expect(view.tasks).toHaveLength(1);expect(view.events).toHaveLength(1)
  expect(Object.keys(pair.linked)).toHaveLength(1);expect(pair.unpaired).toHaveLength(0)
  expect(view.events[0].startAt).toBeNull()
 })
 it('adds only a source-proven relation to a simulated semantic answer',async()=>{
  const {repo,capture}=await setup()
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  // A synthetic answer exercises mapping only. No provider request is made.
  const answer=improveDirectFallback(local,source)
  answer.promptVersion='recognition-semantic-notice-3.12.0';answer.modelName='simulated-semantic-answer'
  answer.events.forEach(event=>event.relatedTaskTempIds=[])
  const handle=await capture.beginCapture({operationId:'semantic-fixture',sourceType:'text',title:'匿名工程夹具',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:answer.promptVersion,pipelineVersion:'fixture',now})
  await capture.recognize(handle,async()=>answer)
  const receipt=await commitDirectDraft(repo,handle.draftId,now),saved=(await repo.load())!,view=workspaceV8ToLegacyView(saved)
  expect(receipt.batch?.provenance).toBe('hybrid')
  expect(eventActionGroups(view.tasks,view.events,saved)[view.events[0].id]?.[0].id).toBe(view.tasks[0].id)
  expect(view.tasks[0].deadline).toBe('2026-11-12T19:00')
  expect(view.events[0].startAt).toBe('2026-11-13T16:00')
 })
})
