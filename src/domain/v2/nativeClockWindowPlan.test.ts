import {it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from '../../recognition/ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {emptyWorkspace} from '../../experiments/mainline01/fixtures'
import {MemoryWorkspaceRecordStore,CanonicalWorkspaceRepository} from './repository'
import {CapturePersistenceService} from './capture'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {buildSourceReviewPlan,commitSourceReview} from './sourceReviewD26'
import {buildPersonalPlan,defaultPlanOptions} from './personalPlanD27'

it('a native exact task/material window survives confirmation and cannot be scheduled early',async()=>{
  const source='签字承诺函，2027年3月19日09:30—11:30交到明溪服务窗口。',r=ordinaryWorkflowFixture(source),t=r.standaloneTasks[0],m=r.materials[0]
  t.title='交签字承诺函';t.actionVerb='交';t.actionObject='签字承诺函';t.description=source;t.timePointTempIds=['S','E'];t.evidenceIds=['Q'];t.estimatedMinutes=30
  m.name='签字承诺函';m.submissionChannel='明溪服务窗口';m.evidenceIds=['Q']
  r.evidence=[{id:'Q',sourceId:'pending-source',quote:source,field:'materials'}]
  r.timePoints=(['event_start','event_end'] as const).map((type,i)=>({tempId:i?'E':'S',type,rawText:'2027年3月19日09:30—11:30',normalizedValue:i?'2027-03-19T11:30':'2027-03-19T09:30',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[t.tempId],relatedMaterialTempIds:[m.tempId],evidenceIds:['Q'],confidence:1,selected:true}))
  const first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace())
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',rawText:source,title:'纸质办理窗口',provider:'manual',modelName:'engineering-fixture',promptVersion:'unchanged',pipelineVersion:first.audit.version})
  await capture.recognize(handle,async()=>first.result)
  const draft=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts[0]
  await commitSourceReview(repo,buildSourceReviewPlan((await repo.load())!,draft))
  const w=(await new CanonicalWorkspaceRepository(store).load())!,before=structuredClone(w)
  const outside=buildPersonalPlan(w,defaultPlanOptions(new Date('2027-03-01T09:00:00+08:00')))
  expect(outside.segments).toEqual([]);expect(outside.unscheduled[0].code).toBe('SOURCE_WINDOW_OUTSIDE_PLAN')
  const options=defaultPlanOptions(new Date('2027-03-19T09:00:00+08:00')),inside=buildPersonalPlan(w,options)
  expect(inside.segments).toHaveLength(1);expect(inside.segments[0].start).toBe('2027-03-19T01:30:00.000Z');expect(inside.segments[0].originalDeadline).toBeNull();expect(w).toEqual(before)
  const wrong=structuredClone(w);wrong.timePoints.find(p=>p.type==='event_end')!.normalizedValue='2027-03-19T09:45';expect(buildPersonalPlan(wrong,options).segments).toEqual([])
  const missing=structuredClone(w);missing.timePoints=missing.timePoints.filter(p=>p.type!=='event_end');expect(buildPersonalPlan(missing,options).segments).toEqual([])
  const foreign=structuredClone(w);foreign.evidenceRefs.forEach(e=>e.quotedText='另一通知');expect(buildPersonalPlan(foreign,options).segments).toEqual([])
})
