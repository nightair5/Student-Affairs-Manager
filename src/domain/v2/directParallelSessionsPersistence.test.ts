import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatch} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {validateWorkspaceV8} from './validators/workspaceValidator'

const now='2026-10-30T15:56:11Z'
const notice='【职业探索活动】\n【宣讲时间】11月3日（周二）9:30-10:30\n【交流时间】11月3日（周二）10:30-12:00\n【活动地点】文化中心一楼报告厅（宣讲）、展厅（交流）\n请参加交流的同学在11.1日晚上6:00前填写下方问卷。\n【报名链接】https://example.edu/form'
const local=()=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:notice,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})

describe('labelled sessions in the direct persistence transaction',()=>{
 it.each(['local-rules','deepseek'] as const)('persists separate sessions and the form in %s mode, and undoes only the new batch',async provider=>{
  const w=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
  const capture=new CapturePersistenceService(repo)
  const add=async (operationId:string)=>{
   const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:notice,provider,modelName:'engineering-fixture',promptVersion:'fixture',pipelineVersion:'fixture',now})
   await capture.recognize(h,async()=>{
    const r=local()
    // This is a deterministic simulated answer, not a call to a real model.
    return provider==='deepseek'?{...r,events:[],standaloneTasks:[],milestones:[],materials:[],timePoints:[]}:r
   })
   return commitDirectDraft(repo,h.draftId,now)
  }
  const first=await add('parallel-1'),afterFirst=(await repo.load())!,view=workspaceV8ToLegacyView(afterFirst)
  expect(first.duplicate).toBe(false);expect(validateWorkspaceV8(afterFirst).valid).toBe(true)
  expect(view.events).toHaveLength(2)
  const talk=view.events.find(e=>e.title.endsWith('宣讲'))!,workshop=view.events.find(e=>e.title.endsWith('交流'))!
  expect(talk.location).toContain('报告厅');expect(talk.startAt).toContain('2026-11-03T09:30');expect(talk.endAt).toContain('2026-11-03T10:30')
  expect(workshop.location).toContain('展厅');expect(workshop.startAt).toContain('2026-11-03T10:30');expect(workshop.endAt).toContain('2026-11-03T12:00')
  expect(view.tasks.some(t=>t.title.includes('问卷')&&t.deadline.includes('2026-11-01T18:00'))).toBe(true)
  expect(afterFirst.materials.some(m=>m.submissionChannel==='https://example.edu/form')).toBe(true)
  if(provider==='deepseek')expect(first.batch?.provenance).toBe('local')
  const second=await add('parallel-2');expect((await repo.load())!.events).toHaveLength(4)
  await undoDirectBatch(repo,second.batch!.id)
  const afterUndo=(await repo.load())!
  expect(afterUndo.events).toEqual(afterFirst.events);expect(afterUndo.tasks).toEqual(afterFirst.tasks)
  expect(validateWorkspaceV8(afterUndo).valid).toBe(true)
 })
})
