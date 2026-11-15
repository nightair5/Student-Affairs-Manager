import {expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assembleProductFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {commitTaskCommand} from './taskCommand'
import {commitEventCompletion} from './eventCompletion'
import {setTaskSchedule} from './taskSchedule'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {validateWorkspaceV8} from './validators/workspaceValidator'

const now='2026-11-15T12:00:00+08:00',timezone='Asia/Shanghai'
async function setup(){
 const blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 async function prepare(content:string,operationId:string){
  const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content,referenceTime:new Date(now),timezone,projects:[],tasks:[]})
  const assembled=assembleProductFirstSuggestion(raw,{sourceText:content,referenceTime:now,timezone}).result
  const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:content,provider:'local-rules',modelName:null,promptVersion:raw.promptVersion,pipelineVersion:'local-directive-test',now})
  await capture.recognize(h,async()=>assembled)
  return h
 }
 const add=async(text:string,id:string)=>commitDirectDraft(repo,(await prepare(text,id)).draftId,now)
 const read=async()=>new CanonicalWorkspaceRepository(store).load().then(w=>w!)
 return {repo,add,prepare,read}
}

it('saves the surviving goal when a nominal background candidate is rejected before commit',async()=>{
 const {add,read}=await setup()
 await add('【课程档案归档申请】\n机构名称用于说明环境，不表示这些机构承担学生的提交工作。\n办理要求：\n请周四前上传项目报告。\n如使用访谈资料，还须周五前提交授权书。\n如使用图片，需提交来源清单。','background-and-deliveries')
 const saved=await read(),view=workspaceV8ToLegacyView(saved)
 expect(saved.tasks).toHaveLength(3)
 expect(new Set(view.tasks.map(t=>t.sourceGoal?.id)).size).toBe(1)
 expect(view.tasks.every(t=>t.sourceGoal?.title==='课程档案归档申请')).toBe(true)
 expect(validateWorkspaceV8(saved).valid).toBe(true)
})

it('keeps recovered conditional steps independent through edits, completion, repeat intake, undo and backup',async()=>{
 const {repo,add,read}=await setup()
 const text='【课程成果验收】\n请周四前上传成果报告；如使用访谈资料，需提交同意书；如使用公开图片，还须提交出处清单。'
 const first=await add(text,'first'),baseline=await read()
 expect(baseline.tasks).toHaveLength(3)
 const second=await add(text,'second')
 expect((await read()).tasks).toHaveLength(6)
 await undoDirectBatchPreservingEdits(repo,second.batch!.id,now)
 expect((await read()).tasks).toEqual(baseline.tasks)
 const view=workspaceV8ToLegacyView(baseline),consent=view.tasks.find(t=>t.title.includes('同意书'))!,report=view.tasks.find(t=>t.title.includes('成果报告'))!
 const entity=baseline.tasks.find(t=>t.id===consent.id)!
 expect(consent.deadline).toBeFalsy();expect(consent.directTags).toContain('如符合条件')
 await commitTaskCommand(repo,{operationId:'complete',taskId:entity.id,expected:{status:entity.status},changes:{status:'completed'},changedAt:now})
 expect((await read()).tasks.find(t=>t.id===report.id)?.status).toBe(baseline.tasks.find(t=>t.id===report.id)?.status)
 expect((await read()).tasks.find(t=>t.id===entity.id)?.status).toBe('completed')
 await commitTaskCommand(repo,{operationId:'restore',taskId:entity.id,expected:{status:'completed'},changes:{status:entity.status},changedAt:now})
 await commitTaskCommand(repo,{operationId:'rename',taskId:entity.id,expected:{title:entity.title},changes:{title:'提交我的访谈同意书'},changedAt:now})
 await setTaskSchedule(repo,entity.id,'2026-11-18',now)
 const restored=importWorkspaceV8(exportWorkspaceV8(await read())),projection=workspaceV8ToLegacyView(restored)
 const step=projection.tasks.find(t=>t.id===entity.id)!
 expect([step.title,step.plannedStart]).toEqual(['提交我的访谈同意书','2026-11-18'])
 expect(step.deadline).toBeFalsy()
 expect(step.description).toContain('使用访谈资料')
 expect(consent.sourceGoal?.id).toBeTruthy()
 expect(step.sourceGoal?.id).toBe(consent.sourceGoal?.id)
 expect(projection.tasks.find(t=>t.id===report.id)?.deadline).toBe('2026-11-19')
 expect(restored.materials).toEqual(baseline.materials)
 expect(validateWorkspaceV8(restored).valid).toBe(true)
 await expect(undoDirectBatchPreservingEdits(repo,first.batch!.id,now)).rejects.toThrow('这批事项已修改')
})

it('preserves goal-scoped conditional material ownership and atomic retry without changing other goals',async()=>{
 const {repo,prepare,read}=await setup()
 const text='【校外访问申请】\n请周二前提交访问申请表至服务平台。\n本人办理时可提供行程说明。委托办理时须提供委托书。\n【社团资料登记】\n请周四前提交成员名单至社团邮箱。'
 const h=await prepare(text,'materials'),before=await read(),transaction=repo.transaction.bind(repo)
 repo.transaction=async()=>{throw Error('INJECTED_SAVE_FAILURE')}
 await expect(commitDirectDraft(repo,h.draftId,now)).rejects.toThrow('INJECTED_SAVE_FAILURE')
 expect(await read()).toEqual(before);expect(before.sourceVersions[0].rawText).toBe(text)
 repo.transaction=transaction
 await commitDirectDraft(repo,h.draftId,now)
 const saved=await read(),backup=importWorkspaceV8(exportWorkspaceV8(saved)),view=workspaceV8ToLegacyView(backup)
 expect(view.tasks).toHaveLength(2)
 const visit=view.tasks.find(t=>t.title.includes('访问申请表'))!,club=view.tasks.find(t=>t.title.includes('成员名单'))!
 const required=backup.materials.find(m=>m.name==='委托书')!,optional=backup.materials.find(m=>m.name==='行程说明')!
 expect(required.legacyData?.goalMaterialScope).toMatchObject({taskIds:[visit.id],condition:'委托办理',requirement:'required'})
 expect(optional.legacyData?.goalMaterialScope).toMatchObject({taskIds:[visit.id],condition:'本人办理',requirement:'optional'})
 expect(club.materials.some(m=>m.name==='委托书'||m.name==='行程说明')).toBe(false)
 expect(backup.materials).toEqual(saved.materials)
 expect(validateWorkspaceV8(backup).valid).toBe(true)
})

it('persists a cross-paragraph midnight event and its independent personal state without recalculating the source date',async()=>{
 const {repo,add,read}=await setup()
 await add('11月24日10:00在东楼举行讲座。欢迎自愿参加。\n\n同日23:00至次日01:00在西楼举行观测。','cross-paragraph')
 const saved=await read(),events=workspaceV8ToLegacyView(saved).events,night=events.find(e=>e.title==='观测')!
 expect(events).toHaveLength(2)
 expect([night.startAt,night.endAt]).toEqual(['2026-11-24T23:00','2026-11-25T01:00'])
 await commitEventCompletion(repo,{operationId:'night-done',eventId:night.id,expected:false,completed:true,changedAt:now})
 let view=workspaceV8ToLegacyView(await read())
 expect(view.events.find(e=>e.id===night.id)?.personalCompleted).toBe(true)
 expect(view.events.find(e=>e.id!==night.id)?.personalCompleted).not.toBe(true)
 await commitEventCompletion(repo,{operationId:'night-restored',eventId:night.id,expected:true,expectedRevision:'night-done',completed:false,changedAt:now})
 view=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(await read())))
 expect(view.events.find(e=>e.id===night.id)?.endAt).toBe(night.endAt)
 expect(view.events.every(e=>!e.personalCompleted)).toBe(true)
})
