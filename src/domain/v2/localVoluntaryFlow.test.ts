import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatch} from './directIntake'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {improveDirectFallback} from '../../recognition/directFallback'
import {convertDirectResult} from '../../recognition/directResult'
import {workspaceV8ToLegacyView} from './legacyView'
import {commitTaskCommand} from './taskCommand'

const now='2026-11-14T01:00:00.000Z'
const source='【校园文化节志愿者招募】\n活动将于11月25日14:00在文体楼报告厅举行。\n一、岗位介绍：联络组2人对接来宾，技术组3人负责音响。岗位是可选报名方向，不要求每位同学都承担所有职责。\n二、申请方式：有意愿参加的同学请在11月21日17:00前填写报名表并提交到志愿服务平台。\n三、组织流程：主办方11月22日审核申请。\n四、其他说明：报名表内可注明感兴趣的方向。'
const local=()=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})

describe('local voluntary notices through the canonical repository',()=>{
 it('keeps a named audience on its own action without applying it to an unrelated action',()=>{
  const text='【校园安排】仅限二年级学生申报奖学金。请二年级学生在11月20日17:00前提交奖学金申请表。所有同学请在11月21日17:00前填写公共意见表。'
  const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  const direct=convertDirectResult(improveDirectFallback(result,text,{scopeAware:true}),text,undefined,{scopeAware:true}).result
  expect(direct.standaloneTasks.find(t=>t.title.includes('提交奖学金申请表'))?.title).toContain('如符合条件')
  expect(direct.standaloneTasks.find(t=>t.title.includes('填写公共意见表'))?.title).not.toContain('如符合条件')
 })
 it('keeps an explicit entry restriction without treating a limited sub-room as the whole event',()=>{
  const recognize=(text:string)=>{
   const input=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
   return convertDirectResult(improveDirectFallback(input,text,{scopeAware:true}),text,undefined,{scopeAware:true})
  }
  const entry=recognize('【技能分享】12月6日19:00在图书馆会议室举办经验分享，欢迎自愿参加。仅限已完成登记者进入现场。')
  expect(entry.result.events[0].description).toContain('仅限已完成登记者进入现场')
  expect(entry.items.find(item=>item.kind==='event')?.tags).toContain('如符合条件')
  const room=recognize('【实验室开放日】12月6日19:00在图书馆会议室举办开放日，欢迎自愿参加。仅限已完成培训的同学进入实验区。')
  expect(room.items.find(item=>item.kind==='event')?.tags).not.toContain('如符合条件')
 })
 it('persists one action and one event, allows independent recovery, and undoes only the new batch',async()=>{
  const w=createGoldenWorkspaceV8(),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  await repo.save(w)
  const capture=new CapturePersistenceService(repo)
  async function add(operationId:string){
   const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'test',now})
   await capture.recognize(h,async()=>local())
   return commitDirectDraft(repo,h.draftId,now)
  }
  const first=await add('voluntary-first')
  let reloaded=(await new CanonicalWorkspaceRepository(store).load())!
  expect(reloaded.tasks).toHaveLength(1)
  expect(reloaded.tasks[0].title).toContain('报名表')
  expect(reloaded.tasks[0].title).not.toContain('如符合条件')
  expect(reloaded.events).toHaveLength(1)
  expect(reloaded.events[0].location).toContain('文体楼报告厅')
  expect(reloaded.timePoints.some(p=>p.normalizedValue==='2026-11-21T17:00')).toBe(true)
  expect(reloaded.timePoints.some(p=>p.normalizedValue==='2026-11-25T14:00')).toBe(true)
  const id=reloaded.tasks[0].id
  await commitTaskCommand(repo,{operationId:'voluntary-complete',taskId:id,expected:{status:'todo'},changes:{status:'completed'},changedAt:now})
  reloaded=(await new CanonicalWorkspaceRepository(store).load())!
  expect(reloaded.tasks[0].status).toBe('completed')
  const roundTrip=importWorkspaceV8(exportWorkspaceV8(reloaded))
  expect(roundTrip.tasks[0].status).toBe('completed')
  await commitTaskCommand(repo,{operationId:'voluntary-restore',taskId:id,expected:{status:'completed'},changes:{status:'todo'},changedAt:now})
  expect((await repo.load())!.tasks[0].status).toBe('todo')
  const second=await add('voluntary-second')
  expect((await repo.load())!.tasks).toHaveLength(2)
  await undoDirectBatch(repo,second.batch!.id)
  reloaded=(await new CanonicalWorkspaceRepository(store).load())!
  expect(reloaded.tasks.map(t=>t.id)).toEqual([id])
  expect(reloaded.events).toHaveLength(1)
  expect(first.batch!.id).not.toBe(second.batch!.id)
 })
 it('retains two choice branches and their separate deadlines in storage and export',async()=>{
  const text='【证明领取】请任选一种方式办理：电子版证明于11月26日17:00前上传至服务平台；纸质版证明于11月27日12:00前交到服务窗口。两种方式不必同时完成。'
  const w=createGoldenWorkspaceV8(),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  await repo.save(w)
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:'inline-choice',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'test',now})
  await capture.recognize(h,async()=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]}))
  const receipt=await commitDirectDraft(repo,h.draftId,now)
  const saved=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(saved)
  expect(view.tasks.map(t=>t.deadline)).toEqual(['2026-11-26T17:00','2026-11-27T12:00'])
  expect(view.tasks.every(t=>t.sourceChoice?.optionTaskIds.length===2)).toBe(true)
  const imported=importWorkspaceV8(exportWorkspaceV8(saved))
  expect(workspaceV8ToLegacyView(imported).tasks.map(t=>t.sourceChoice)).toEqual(view.tasks.map(t=>t.sourceChoice))
  await undoDirectBatch(repo,receipt.batch!.id)
  expect((await repo.load())!.tasks).toHaveLength(0)
 })
})
