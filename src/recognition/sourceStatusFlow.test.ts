import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from './schema'
import {convertSemanticNotice} from './directSemanticNotice'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {commitDirectDraft} from '../domain/v2/directIntake'
import {exportWorkspaceV8,importWorkspaceV8} from '../domain/v2/serialization'

describe('source status stays distinct from the direct-mode selection',()=>{
 it('retains an unverified cancellation as uncertain without creating a confirmed appointment',async()=>{
  const source='学术交流会12月8日14:00在教学楼101举行。'
  const raw={topic:'学术交流会',kind:'event',items:[{key:'event',kind:'event',status:'cancelled',title:'学术交流会',evidence:[source],location:'教学楼101',times:[{role:'start',raw:'12月8日14:00'}]}],materials:[]}
  const output=compileSemanticNotice(raw,{source,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'})
  const result=parseRecognitionResult(output.result),converted=convertSemanticNotice(result,source)
  expect(result.events[0].sourceStatus).toBe('uncertain')
  expect(converted.result.events[0].sourceStatus).toBe('uncertain')
  expect(converted.result.events[0].startTimePointTempId).toBeNull()
  expect(converted.result.events[0].description).toContain('12月8日14:00')
  expect(converted.items[0].tags).toContain('待确认')
  const w=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:'status-uncertain',sourceType:'text',title:'学术交流会',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now:'2026-11-03T02:00:00Z'})
  await capture.recognize(h,async()=>result);await commitDirectDraft(repo,h.draftId,'2026-11-03T02:00:00Z')
  const saved=(await repo.load())!
  expect(saved.events).toHaveLength(1)
  expect(saved.events[0].startTimePointId).toBeNull()
  expect(saved.events[0].legacyData?.sourceStatus).toBe('uncertain')
  const restored=importWorkspaceV8(exportWorkspaceV8(saved))
  expect(restored.events[0].legacyData?.sourceStatus).toBe('uncertain')
  expect(restored.events[0].startTimePointId).toBeNull()
 })
})
