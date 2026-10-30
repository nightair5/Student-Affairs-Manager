import { describe, expect, it } from 'vitest'
import { createGoldenWorkspaceV8 } from './fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'
import { CapturePersistenceService } from './capture'
import { buildLocalRecognition } from '../../recognition/pipeline'
import { improveDirectFallback } from '../../recognition/directFallback'
import { commitDirectDraft, editDirectItem, replaceDirectFallback, undoDirectBatch } from './directIntake'
import { directReplacementDiff } from './directReplacementSafety'

const source='请于2026年10月30日17:00前提交课程论文。请于2026年11月1日18:00前填写报名表。'
const now='2026-10-26T10:00:00.000Z'
const local=()=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})

async function setup(provider:'local-rules'|'deepseek'='local-rules') {
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const) workspace[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
  await repo.save(workspace)
  const service=new CapturePersistenceService(repo)
  const first=await service.beginCapture({operationId:'original',sourceType:'text',title:'匿名通知',rawText:source,provider,modelName:provider,promptVersion:'test',pipelineVersion:'test',now})
  await service.recognize(first,async()=>improveDirectFallback(local(),source))
  const receipt=await commitDirectDraft(repo,first.draftId,now)
  const retry=async(partial:boolean)=>{
    const answer=improveDirectFallback(local(),source)
    expect(answer.standaloneTasks.length).toBeGreaterThanOrEqual(2)
    if(partial){
      const task=answer.standaloneTasks.find(t=>t.actionObject.includes('课程论文'))!
      expect(task).toBeTruthy()
      answer.standaloneTasks=[task]
      answer.materials=answer.materials.filter(m=>m.relatedTaskTempIds.includes(task.tempId))
      answer.timePoints=answer.timePoints.filter(p=>p.relatedTaskTempIds.includes(task.tempId))
    }
    const handle=await service.beginRetry(first.sourceId,{provider:'deepseek',modelName:'deepseek-v4-flash',promptVersion:'test',pipelineVersion:'test',expectedSourceVersionId:first.sourceVersionId,now:'2026-10-26T10:01:00.000Z'})
    await service.recognize(handle,async()=>answer)
    return handle
  }
  return {repo,receipt,retry}
}

describe('retrying mixed AI and local completion',()=>{
  it('allows a grounded hybrid result through the same atomic replacement and undo',async()=>{
    const {repo,receipt,retry}=await setup()
    const original=(await repo.load())!
    expect(original.tasks).toHaveLength(2)
    const handle=await retry(true)
    const replaced=await replaceDirectFallback(repo,receipt.batch!.id,handle.draftId,'2026-10-26T10:02:00.000Z')
    expect(replaced.batch?.provenance).toBe('hybrid')
    const after=(await repo.load())!
    expect(after.tasks).toHaveLength(2)
    expect(after.timePoints.filter(p=>p.type.endsWith('_deadline')).map(p=>p.normalizedValue).sort()).toEqual(['2026-10-30T17:00','2026-11-01T18:00'])
    await undoDirectBatch(repo,replaced.batch!.id,'2026-10-26T10:03:00.000Z')
    expect((await repo.load())!.tasks).toHaveLength(0)
  })
  it('also allows the user to retry an AI-origin batch while protecting edits',async()=>{
    const {repo,receipt,retry}=await setup('deepseek')
    const handle=await retry(false)
    const replaced=await replaceDirectFallback(repo,receipt.batch!.id,handle.draftId,'2026-10-26T10:02:00.000Z')
    const edited=replaced.batch!.items[0]
    await editDirectItem(repo,edited.id,{title:'用户修改的事项',date:'2026-10-30'},'2026-10-26T10:03:00.000Z')
    const again=await retry(false),before=await repo.load()
    await expect(replaceDirectFallback(repo,replaced.batch!.id,again.draftId,'2026-10-26T10:04:00.000Z')).rejects.toThrow(/已修改过/u)
    expect(await repo.load()).toEqual(before)
  })
  it('reports lost material quantity, task dependencies and event details separately',()=>{
    const before=createGoldenWorkspaceV8(),after=structuredClone(before)
    before.events[0].description='主讲人：林老师\n参加须知：请提前入场'
    after.events[0].description='主讲人：林老师'
    after.materials[0].quantity=null
    after.tasks.find(t=>t.id==='task-2')!.dependencyIds=[]
    const ids=new Set([...before.tasks.map(t=>t.id),...before.events.map(e=>e.id)])
    const diff=directReplacementDiff(before,after,ids,ids)
    expect(diff.preserved).toBe(false)
    expect(diff.issues.map(i=>i.field)).toEqual(expect.arrayContaining(['material','dependency','event_detail']))
  })
  it('never treats a different action on the same object as a replacement',()=>{
    const before=createGoldenWorkspaceV8(),after=structuredClone(before)
    const old=before.tasks[0],next=after.tasks[0]
    old.title='提交申请表';old.legacyData={...old.legacyData,actionVerb:'提交',actionObject:'申请表'}
    next.title='删除申请表';next.legacyData={...next.legacyData,actionVerb:'删除',actionObject:'申请表'}
    expect(directReplacementDiff(before,after,new Set([old.id]),new Set([next.id])).preserved).toBe(false)
  })
  it('protects an older deadline linked only through taskId',()=>{
    const before=createGoldenWorkspaceV8(),after=structuredClone(before),task=before.tasks[0]
    const point=before.timePoints.find(p=>p.normalizedValue)!
    point.taskId=task.id;point.relatedTaskIds=[]
    after.timePoints=after.timePoints.filter(p=>p.id!==point.id)
    const diff=directReplacementDiff(before,after,new Set([task.id]),new Set([task.id]))
    expect(diff.issues.some(i=>i.field==='time')).toBe(true)
  })
})
