import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {commitEventCompletion} from './eventCompletion'
import {commitTaskCommand} from './taskCommand'
import {setTaskSchedule} from './taskSchedule'
import {selectSourceChoice} from './sourceChoice'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

const now='2027-03-01T01:00:00.000Z'
async function setup(){
 const w=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.save(w)
 const add=async(source:string,operationId:string)=>{
  const c=new CapturePersistenceService(repo),h=await c.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'r38-local-test',now})
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  await c.recognize(h,async()=>local);return {handle:h,receipt:await commitDirectDraft(repo,h.draftId,now)}
 }
 return {repo,store,add}
}

describe('local facts in the canonical repository',()=>{
 it('preserves different event dates and independent completion through readback and backup',async()=>{
  const {repo,store,add}=await setup(),source='2027年8月23日9:00—10:00在研修楼101举行语言讲座；8月24日14:00—15:00在研修楼102开展写作工作坊。'
  await add(source,'different-dates-first')
  const saved=(await new CanonicalWorkspaceRepository(store).load())!,[first,second]=saved.events
  expect(saved.events).toHaveLength(2)
  await commitEventCompletion(repo,{operationId:'different-dates-done',eventId:first.id,expected:false,completed:true,changedAt:now})
  let readback=(await new CanonicalWorkspaceRepository(store).load())!
  let view=workspaceV8ToLegacyView(readback)
  expect(view.events.find(e=>e.id===first.id)?.personalCompleted).toBe(true)
  expect(view.events.find(e=>e.id===second.id)?.personalCompleted).not.toBe(true)
  expect(view.events.map(e=>[e.startAt,e.endAt,e.location])).toEqual(expect.arrayContaining([
   ['2027-08-23T09:00','2027-08-23T10:00','研修楼101'],['2027-08-24T14:00','2027-08-24T15:00','研修楼102'],
  ]))
  await commitEventCompletion(repo,{operationId:'different-dates-restore',eventId:first.id,expected:true,expectedRevision:'different-dates-done',completed:false,changedAt:now})
  const beforeRepeat=(await repo.load())!,batch=await add(source,'different-dates-second')
  expect((await repo.load())!.events).toHaveLength(4)
  await undoDirectBatchPreservingEdits(repo,batch.receipt.batch!.id,now)
  readback=(await new CanonicalWorkspaceRepository(store).load())!
  expect(readback.events).toEqual(beforeRepeat.events)
  view=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(readback)))
  expect(view.events.map(e=>e.startAt).sort()).toEqual(['2027-08-23T09:00','2027-08-24T14:00'])
 })
 it('keeps two real sessions independent across completion, restore, repeat, undo and JSON backup',async()=>{
  const {repo,store,add}=await setup(),source='2027年5月6日9:00—10:00在青楼101举行摄影讲座；当天14:00—15:30在青楼201开展摄影实操。'
  await add(source,'events-first')
  const before=(await new CanonicalWorkspaceRepository(store).load())!,[a,b]=before.events
  expect(before.events).toHaveLength(2)
  await commitEventCompletion(repo,{operationId:'event-done',eventId:a.id,expected:false,completed:true,changedAt:now})
  let view=workspaceV8ToLegacyView((await new CanonicalWorkspaceRepository(store).load())!)
  expect(view.events.find(e=>e.id===a.id)?.personalCompleted).toBe(true)
  expect(view.events.find(e=>e.id===b.id)?.personalCompleted).not.toBe(true)
  await commitEventCompletion(repo,{operationId:'event-restore',eventId:a.id,expected:true,expectedRevision:'event-done',completed:false,changedAt:now})
  const original=(await repo.load())!,second=await add(source,'events-second')
  expect((await repo.load())!.events).toHaveLength(4)
  await undoDirectBatchPreservingEdits(repo,second.receipt.batch!.id,now)
  const remaining=(await new CanonicalWorkspaceRepository(store).load())!
  expect(remaining.events).toEqual(original.events)
  view=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(remaining)))
  expect(view.events.map(e=>[e.startAt,e.endAt,e.location])).toEqual(expect.arrayContaining([['2027-05-06T09:00','2027-05-06T10:00','青楼101'],['2027-05-06T14:00','2027-05-06T15:30','青楼201']]))
 })
 it('keeps grouped task deadlines, independent completion and personal planning separate',async()=>{
  const {repo,add}=await setup()
  await add('2027年6月3日12:00前报名创新展示；6月4日18:00前提交作品摘要；6月5日18:00前上传海报。这三项属于同一次创新展示。','grouped')
  const initial=(await repo.load())!,[first,...others]=initial.tasks
  expect(initial.tasks).toHaveLength(3);expect(first.legacyData?.sourceGoalGroup).toBeTruthy()
  const original=workspaceV8ToLegacyView(initial).tasks.map(t=>t.deadline).sort()
  await setTaskSchedule(repo,first.id,'2027-06-02',now)
  await commitTaskCommand(repo,{operationId:'group-step-done',taskId:first.id,expected:{status:first.status},changes:{status:'completed'},changedAt:now})
  const done=(await repo.load())!
  expect(others.every(t=>done.tasks.find(x=>x.id===t.id)?.status===t.status)).toBe(true)
  expect(workspaceV8ToLegacyView(done).tasks.map(t=>t.deadline).sort()).toEqual(original)
  await commitTaskCommand(repo,{operationId:'group-step-restore',taskId:first.id,expected:{status:'completed'},changes:{status:first.status},changedAt:now})
  const roundTrip=importWorkspaceV8(exportWorkspaceV8((await repo.load())!))
  expect(roundTrip.tasks[0].legacyData?.sourceGoalGroup).toBeTruthy()
  expect(workspaceV8ToLegacyView(roundTrip).tasks.map(t=>t.deadline).sort()).toEqual(original)
 })
 it('round-trips the handling window without turning its start into a deadline',async()=>{
  const {repo,add}=await setup()
  await add('2027年6月11日9:00至6月13日17:00可领取证明，请于6月14日12:00前将证明扫描件上传系统。','window')
  const w=importWorkspaceV8(exportWorkspaceV8((await repo.load())!)),view=workspaceV8ToLegacyView(w)
  const pickup=view.tasks.find(t=>t.title==='领取证明')!,upload=view.tasks.find(t=>t.title.includes('上传'))!
  expect(pickup.deadline).toBe('');expect(pickup.sourceWindowLabel).toContain('6月13日17:00')
  expect(pickup.sourceWindowStart).toBe('2027-06-11T01:00:00.000Z');expect(pickup.sourceWindowEnd).toBe('2027-06-13T09:00:00.000Z')
  expect(upload.deadline).toBe('2027-06-14T12:00')
 })
 it('persists each choice branch, protects a user choice and retains it in a JSON backup',async()=>{
  const {repo,add}=await setup(),source='请学生提交阅读心得，可任选纸质版或电子版之一，不需要两种都交。\n选择纸质版者，请于7月14日16:00前交到文科楼105服务台，打印不超过五页。\n选择电子版者，请于7月15日20:00前上传课程平台，格式为PDF。'
  const {receipt}=await add(source,'choice'),saved=(await repo.load())!,view=workspaceV8ToLegacyView(saved)
  expect(view.tasks).toHaveLength(2);expect(view.tasks[0].sourceChoice?.id).toBe(view.tasks[1].sourceChoice?.id)
  expect(view.tasks.map(t=>t.deadline).sort()).toEqual(['2027-07-14T16:00','2027-07-15T20:00'])
  await selectSourceChoice(repo,view.tasks[1].id,null,now)
  const selected=(await repo.load())!
  await expect(undoDirectBatchPreservingEdits(repo,receipt.batch!.id,now)).rejects.toThrow()
  expect(await repo.load()).toEqual(selected)
  const restored=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(selected)))
  expect(restored.tasks[0].sourceChoice?.selectedTaskId).toBe(view.tasks[1].id)
 })
 it('keeps the source and draft intact when saving a multi-event result fails, then retries once',async()=>{
  const {repo}=await setup(),source='2027年5月6日9:00—10:00在青楼101举行摄影讲座；当天14:00—15:30在青楼201开展摄影实操。'
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:'failed-save',sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'r38-local-test',now})
  await capture.recognize(handle,async()=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]}))
  const before=await repo.load(),transaction=repo.transaction.bind(repo)
  repo.transaction=async()=>{throw Error('INJECTED_TRANSACTION_FAILURE')}
  await expect(commitDirectDraft(repo,handle.draftId,now)).rejects.toThrow('INJECTED_TRANSACTION_FAILURE')
  expect(await repo.load()).toEqual(before)
  repo.transaction=transaction
  await commitDirectDraft(repo,handle.draftId,now)
  expect((await repo.load())!.events).toHaveLength(2)
  await commitDirectDraft(repo,handle.draftId,now)
  expect((await repo.load())!.events).toHaveLength(2)
 })
})
