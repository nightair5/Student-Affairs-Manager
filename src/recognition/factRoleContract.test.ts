import {describe,it,expect} from 'vitest'
import {createTaskRequirementsFixture} from '../experiments/candidate19Recorded/taskRequirementsFixtures'
import {FACT_ROLE_VERSION,FACT_ROLE_SCHEMA,buildFactRoleRequest,decodeFactRoleRecording,projectFactRole,type FactRoleFacts} from './factRoleContract'
import {buildTaskRequirementsRequest} from './taskRequirementsContract'
import {groundSourceActionTimes} from './sourceActionTime'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {validateRecognitionResult} from './schema'
import {supportedCoordinatedObject,supportedEventDescriptor} from './compoundNameSupport'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from '../domain/v2/sourceReviewD26'
import {buildPersonalPlan,defaultPlanOptions} from '../domain/v2/personalPlanD27'
import {decodeTaskRequirementsRecording} from './taskRequirementsContract'

describe('source fact roles through the real ordinary compiler',()=>{
  it('derives presence from actual entities, retains requirements and rejects contradictory/fake owners',async()=>{
    const x=await createTaskRequirementsFixture()
    const facts:FactRoleFacts={...x.facts,schemaVersion:FACT_ROLE_VERSION,tasks:x.facts.tasks.map(t=>{const {coverage,...rest}=t;void coverage;return {...rest,absences:[]}})}
    const envelope=JSON.parse(x.rawHttpText);envelope.output[0].content[0].text=JSON.stringify(facts)
    const d=decodeFactRoleRecording(JSON.stringify(envelope),x.context)
    expect(validateRecognitionResult(d.result).valid).toBe(true)
    expect(d.result.standaloneTasks).toHaveLength(2)
    expect(d.result.materials).toHaveLength(0)
    expect(d.result.standaloneTasks[0].completionCriteria.join()).toContain('实习单位')
    expect(projectFactRole(facts,x.context).projected.tasks[0].coverage.material.status).toBe('not_stated')
    const bad=structuredClone(facts);bad.tasks[0].absences=[{category:'time',status:'explicit_none',scopeIds:bad.tasks[0].propositionScopeIds}]
    expect(()=>projectFactRole(bad,x.context)).toThrow('CONTRADICTION')
    const owner=structuredClone(facts);owner.timePoints[0].owners=[{kind:'task',entityId:'fake'}]
    envelope.output[0].content[0].text=JSON.stringify(owner)
    expect(()=>decodeFactRoleRecording(JSON.stringify(envelope),x.context)).toThrow('OWNER')
  })
  it('keeps the baseline request unchanged and uses one absence authority, never a model personal plan',async()=>{
    const x=await createTaskRequirementsFixture(),before=await buildTaskRequirementsRequest(x.context),next=await buildFactRoleRequest(x.context),after=await buildTaskRequirementsRequest(x.context)
    expect(before.serialized).toBe(after.serialized)
    expect(next.body.text.format.schema).toEqual(FACT_ROLE_SCHEMA)
    expect(next.body.text.format.schema.properties!.tasks.items!.properties!.coverage).toBeUndefined()
    expect(next.dispatchAuthorized).toBe(false)
  })
  it('corrects only an explicit same-action appointment, preserving raw, date and actual deadline; persists the role and pins the plan',async()=>{
    const x=await createTaskRequirementsFixture(),d=decodeTaskRequirementsRecording(x.rawHttpText,x.context)
    const r=structuredClone(d.result);r.events=[];r.conflicts=[];r.timePoints=[{...r.timePoints[0],tempId:'P1',type:'task_deadline',rawText:'2026年11月21日09:00',relatedTaskTempIds:[r.standaloneTasks[1].tempId],relatedMaterialTempIds:[],evidenceIds:['pickup']}]
    const t=r.standaloneTasks[1];t.actionVerb='领取';t.actionObject='门禁卡';t.title='领取门禁卡';t.dependencyTempIds=[];t.timePointTempIds=['P1'];t.evidenceIds=['pickup'];r.standaloneTasks=[t]
    const source='请于2026年11月21日09:00到设备室领取门禁卡。'
    r.evidence=[{id:'pickup',sourceId:'source',field:'deadline',quote:source,extractionMethod:'ai'}]
    r.ignoredContent=[]
    const first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:x.context.referenceTime,timezone:'Asia/Shanghai'})
    expect(first.result.timePoints[0]).toMatchObject({type:'event_start',rawText:'2026年11月21日09:00',normalizedValue:'2026-11-21T09:00'})
    expect(r.timePoints[0].type).toBe('task_deadline')
    const validity=validateRecognitionResult(first.result);if(!validity.valid)throw Error(JSON.stringify(validity))
    const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace())
    const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'办理时刻',rawText:source,provider:'manual',modelName:'ENGINEERING',promptVersion:'fixture',pipelineVersion:'fixture'})
    await capture.recognize(h,async()=>first.result)
    await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>({...d,legacyData:{...d.legacyData,firstSuggestionAssembly:JSON.parse(JSON.stringify(first.audit))}}))}))
    const w=await repo.load(),view=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts[0]
    const receipt=await commitSourceReview(repo,buildSourceReviewPlan(w!,view,view.items[0].id))
    const saved=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(saved.timePoints[0].legacyData?.sourceTimeRole).toBe('task_action_time')
    expect(saved.events).toHaveLength(0)
    const opts={...defaultPlanOptions(new Date('2026-11-21T08:00:00+08:00')),startDate:'2026-11-21',days:1,startTime:'08:00',endTime:'17:00'}
    const plan=buildPersonalPlan(saved,opts)
    expect(plan.segments[0].start).toBe('2026-11-21T01:00:00.000Z')
    expect(plan.segments[0].originalDeadline).toBeNull()
    expect(buildPersonalPlan(saved,{...opts,overrides:{[saved.tasks[0].id]:{start:'2026-11-21T10:00'}}}).unscheduled[0].code).toBe('SOURCE_ACTION_TIME_OUTSIDE_PLAN')
    for(const text of ['请于2026年11月21日09:00前领取门禁卡。','请于2026年11月21日09:00到设备室领取钥匙。','若获批准请于2026年11月21日09:00领取门禁卡。']){
      const bad={...r,evidence:[{...r.evidence[0],quote:text}]}
      expect(groundSourceActionTimes(bad,text).audit.decisions).toHaveLength(0)
    }
  })
  it('accepts closed coordinated roles and activity descriptors, never arbitrary token overlap or headings',()=>{
    expect(supportedCoordinatedObject('账号和系统','激活账号和登录系统',['请激活账号和登录系统。'])).toBe(true)
    expect(supportedCoordinatedObject('账号和系统','激活账号和登录系统',['激活账号。不要登录系统。'])).toBe(false)
    expect(supportedEventDescriptor('暑期学校活动',['将举办线上暑期学校。'])).toBe(true)
    expect(supportedEventDescriptor('暑期学校活动',['领取暑期学校材料。'])).toBe(false)
    expect(supportedEventDescriptor('活动信息',['活动信息：报名讲座。'])).toBe(false)
  })
})
