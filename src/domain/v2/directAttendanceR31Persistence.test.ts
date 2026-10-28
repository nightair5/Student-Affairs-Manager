import {describe,it,expect} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {commitDirectDraft,undoDirectBatch} from './directIntake'
const text='【就业指导培训会通知】\n现组织就业指导培训会。\n时间：周四 中午 12:40（请提前几分钟入场）\n地点：东教学楼报告厅\n指导老师主讲。有意向参加的同学建议到场聆听。'
const now='2026-10-28T02:00:00.000Z'
describe('optional labelled event recovery through direct save',()=>{
 it('saves the task, event, inferred date and venue once, and undoes the complete batch',async()=>{
  const w=createGoldenWorkspaceV8();for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:'r31',sourceType:'text',title:'匿名工程夹具',rawText:text,provider:'deepseek',modelName:'test',promptVersion:'test',pipelineVersion:'test',now})
  await capture.recognize(h,async()=>{const base=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]});return {...base,standaloneTasks:[],milestones:[],events:[],timePoints:[],materials:[]}})
  const receipt=await commitDirectDraft(repo,h.draftId,now),saved=(await repo.load())!
  expect(saved.tasks.map(t=>t.title)).toEqual(['参加就业指导培训会'])
  expect(saved.events).toHaveLength(1);expect(saved.events[0].location).toBe('东教学楼报告厅')
  expect(saved.timePoints.some(p=>p.normalizedValue==='2026-10-29T12:40'&&p.needsConfirmation)).toBe(true)
  expect(saved.tasks[0].needsReview).toBe(true);expect(saved.events[0].needsReview).toBe(true)
  expect((await commitDirectDraft(repo,h.draftId,now)).duplicate).toBe(true)
  await undoDirectBatch(repo,receipt.batch!.id);const undone=(await repo.load())!;expect(undone.tasks).toHaveLength(0);expect(undone.events).toHaveLength(0);expect(undone.timePoints).toHaveLength(0)
 })
})
