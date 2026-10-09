import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {decodeFactRoleRecording} from './factRoleContract'
import {indexImmutableScopesV11} from './scopeIndexV11'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {sourceWindowsFromSidecar} from './sourceWindowGrounding'
import {sourceActionTimesFromSidecar} from './sourceActionTime'
import {assembleRecognitionFirstSuggestionD26} from './firstSuggestionD26'
import {validateRecognitionResult} from './schema'
import {supportedEventOperation} from './compoundNameSupport'
import {rangeEndpointSupport} from './rangeEndpointSupport'
import {createContractFixture} from '../experiments/d26Recorded/contractFixtures'
import {decodeCurrentSourceRecording} from './conditionalNonActionProduct'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore,type WorkspaceRecordMutation} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback,sourceReviewProblem} from '../domain/v2/sourceReviewD26'
import {rebindRecordedScopes} from './recordedProjectionD26'
import {D20ReviewSessionRepository} from '../experiments/candidate16/d20ReviewSession'
const root='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/qualification-association-followup/real-notice-fact-role/'
const sources=JSON.parse(readFileSync(root+'SOURCES.json','utf8')).sources as Array<{sourceId:string;sourceVersionId:string;sourceText:string;referenceTime:string;timezone:string}>
const raw=(n:number)=>(JSON.parse(readFileSync(root+`observed/raw-${String(n).padStart(2,'0')}.json`,'utf8')) as {rawHttpText:string}).rawHttpText
async function recorded(n:number){const s=sources[n-1],context={index:await indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone};const d=decodeFactRoleRecording(raw(n),context,'SingleAuthority');return {s,context,d,first:assembleCurrentFirstSuggestion(d.result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,sourceWindows:sourceWindowsFromSidecar(d.sidecar),sourceActionTimes:sourceActionTimesFromSidecar(d.sidecar)})}}

describe('actual source-first recordings retain facts without relaxing semantic blocks',()=>{
 it.each([1,2])('request %i enters the real Capture service without the action-field length rejection',async n=>{
  const {s,context,d,first}=await recorded(n)
  expect(validateRecognitionResult(first.result).valid).toBe(true)
  expect(d.sidecar.originalResponse).toBe(raw(n))
  expect(d.sidecar.displayAudit.actionFields.length).toBe(n===1?1:2)
  expect(d.sidecar.displayAudit.actionFields.every(a=>a.status==='CITED_VERB_PROJECTION')).toBe(true)
  expect(d.sidecar.displayAudit.actionFields.every(a=>a.before.length>20&&a.after.length<=20)).toBe(true)
  expect(first.result.standaloneTasks.every(t=>sourceReviewProblem(first.result,t.tempId))).toBe(true)
  if(n===1)expect(first.result.materials[0].formatRequirements).toContain('word版')
  if(n===2)expect(first.result.standaloneTasks[0].title).toContain('登录厦门大学学工系统https://xmuxg.xmu.edu.cn/app/515')
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.initialize(emptyWorkspace())
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:s.sourceId,rawText:s.sourceText,provider:'manual',modelName:'ENGINEERING_FIXED_RECORDING',promptVersion:d.result.promptVersion,pipelineVersion:'first-loss-regression'})
  const target={...context,index:await indexImmutableScopesV11(h.sourceId,h.sourceVersionId,s.sourceText)},rebound=rebindRecordedScopes(raw(n),context.index,target.index)
  const actual=decodeFactRoleRecording(rebound.reboundHttpText,target,'SingleAuthority')
  await capture.recognize(h,async()=>assembleCurrentFirstSuggestion(actual.result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,sourceWindows:sourceWindowsFromSidecar(actual.sidecar)}).result)
  const saved=(await repo.load())!
  expect(saved.tasks).toHaveLength(0);expect(saved.extractionDrafts).toHaveLength(1)
 })
 it('retains the separate participation-authority failure; it is not silently made correct',async()=>{await expect(recorded(3)).rejects.toThrow('ROLE_AUTHORITY_PARTICIPATION_EVIDENCE')})
 it('preserves maintenance name, outcome and exact existing endpoints through confirmation and independent reload',async()=>{
  const {s,context,d,first}=await recorded(4)
  expect(first.result.standaloneTasks).toHaveLength(0)
  expect(first.result.events[0]).toMatchObject({title:'厦门大学信息门户升级维护',selected:true})
  expect(first.result.events[0].description).toContain('信息门户将暂时无法访问')
  expect(first.result.timePoints.map(t=>t.normalizedValue)).toEqual(['2026-04-14T00:00','2026-04-14T03:00'])
  expect(first.result.timePoints.every(t=>t.precision==='exact'&&!t.needsConfirmation)).toBe(true)
  expect(d.sidecar.displayAudit.rangeSupport[0].rule).toBe('CITED_SAME_EVENT_CLOCK_RANGE')
  class FaultStore extends MemoryWorkspaceRecordStore {
    readonly name='rco-mainline-01-02-i1-d26-ordinary-real-loss'
    failTransaction=false
    override async transaction(key:string,mutator:WorkspaceRecordMutation){return super.transaction(key,current=>{const next=mutator(current);if(this.failTransaction)throw Error('FIRST_LOSS_TRANSACTION_FAILURE');return next})}
  }
  const store=new FaultStore(),repo=new CanonicalWorkspaceRepository(store)
  await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo)
  const h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:s.sourceId,rawText:s.sourceText,provider:'manual',modelName:'ENGINEERING_FIXED_RECORDING',promptVersion:d.result.promptVersion,pipelineVersion:'first-loss-regression'})
  const target={...context,index:await indexImmutableScopesV11(h.sourceId,h.sourceVersionId,s.sourceText)},rebound=rebindRecordedScopes(raw(4),context.index,target.index),actual=decodeFactRoleRecording(rebound.reboundHttpText,target,'SingleAuthority')
  await capture.recognize(h,async()=>assembleCurrentFirstSuggestion(actual.result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone}).result)
  const w=(await repo.load())!,field='event:'+actual.result.events[0].tempId+':selected',sessions=new D20ReviewSessionRepository(store,undefined,undefined,true)
  const stage=await sessions.stage(w,h.draftId,field,true,true,sessions.writer,false)
  expect(stage.fields[field].editId).toBeUndefined()
  expect((await new D20ReviewSessionRepository(store,undefined,undefined,true).load(w,h.draftId)).fields[field].revision).toBe(stage.fields[field].revision)
  const view=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts[0],plan=buildSourceReviewPlan(w,view),before=JSON.stringify(await repo.load())
  store.failTransaction=true
  await expect(commitSourceReview(repo,plan)).rejects.toThrow('FIRST_LOSS_TRANSACTION_FAILURE')
  expect(JSON.stringify(await repo.load())).toBe(before)
  store.failTransaction=false
  const receipt=await commitSourceReview(repo,plan)
  await expect(verifySourceReviewReadback({load:async()=>{throw Error('FIRST_LOSS_READBACK_FAILURE')}},receipt)).rejects.toThrow('FIRST_LOSS_READBACK_FAILURE')
  const back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
  expect(back.tasks).toHaveLength(0);expect(back.projects).toHaveLength(0);expect(back.events).toHaveLength(1);expect(back.timePoints).toHaveLength(2)
  expect(back.events[0].title).toBe('厦门大学信息门户升级维护')
  expect(back.events[0].endTimePointId).toBe(back.timePoints.find(p=>p.type==='event_end')!.id)
  expect(back.timePoints.find(p=>p.type==='event_end')).toMatchObject({normalizedValue:'2026-04-14T03:00',precision:'exact'})
  expect((await repo.load())!.extractionDrafts[0].commitOperationIds).toEqual([receipt.commitId])
 })
})

describe('different wording and counterexamples use the ordinary compiler',()=>{
 it.each([
  ['请按时将艺术展览报名材料提交至校园艺术中心材料接收办公室','艺术展览报名材料',true],
  ['请上传研究生实践报告和补充附件至青禾学院学生材料受理系统','研究生实践报告和补充附件',true],
  ['请勿将艺术展览报名材料提交至校园艺术中心材料接收办公室','艺术展览报名材料',false],
  ['若获批准将艺术展览报名材料提交至校园艺术中心材料接收办公室','艺术展览报名材料',false],
  ['请按时将艺术展览报名材料提交至校园艺术中心材料接收办公室','实验设备清单',false],
  ['请登录校园艺术中心报名系统并缴纳校园活动报名费用','校园艺术中心报名系统',false],
  ['请提交艺术展览报名材料至校园艺术中心但不得提交艺术展览报名材料','艺术展览报名材料',false],
 ] as const)('long action %s does not invent an action or borrow another object',async(surface,object,ok)=>{
  const f=await createContractFixture('deadline'),input=decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context).result
  input.events=[];input.materials=[];input.timePoints=[];input.conflicts=[]
  const t=input.standaloneTasks[0];t.actionVerb=surface;t.actionObject=object;t.title='匿名动作字段';t.materialTempIds=[];t.timePointTempIds=[];t.evidenceIds=['one'];t.completionCriteria=[surface]
  const source=surface+'。';input.evidence=[{id:'one',sourceId:'anonymous',field:'description',quote:source,extractionMethod:'parser'}]
  const before=structuredClone(input),first=assembleRecognitionFirstSuggestionD26(input,{sourceText:source,referenceTime:f.context.referenceTime,timezone:'Asia/Shanghai'})
  expect(first.audit.actionFields[0].status).toBe(ok?'CITED_VERB_PROJECTION':'LOCAL_UNRESOLVED_ACTION')
  expect(first.result.standaloneTasks[0].selected).toBe(ok)
  expect(input).toEqual(before)
  if(!ok){expect(first.result.quality.needsHumanReview).toBe(true);expect(sourceReviewProblem(first.result,t.tempId)).toContain('动作字段')}
 })
 it('cannot erase the source negation omitted from the long action surface',async()=>{
  const f=await createContractFixture('deadline'),input=decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context).result
  const surface='提交艺术展览报名材料至校园艺术中心材料接收办公室',source='请勿'+surface+'。',t=input.standaloneTasks[0]
  t.actionVerb=surface;t.actionObject='艺术展览报名材料';t.evidenceIds=['negation']
  input.evidence=[{id:'negation',sourceId:'anonymous',field:'description',quote:source,extractionMethod:'parser'}]
  const first=assembleRecognitionFirstSuggestionD26(input,{sourceText:source,referenceTime:f.context.referenceTime,timezone:'Asia/Shanghai'})
  expect(first.result.standaloneTasks[0].selected).toBe(false)
  expect(sourceReviewProblem(first.result,t.tempId)).toContain('动作字段')
 })
 it.each([
  ['青禾报名门户升级维护','将对青禾报名门户（https://example.edu/a）进行升级维护。',true],
  ['图书借阅系统升级检修','将对图书借阅系统进行升级检修。',true],
  ['青禾报名门户升级维护','将对实验设备系统进行升级维护。',false],
  ['青禾报名门户升级维护','不会对青禾报名门户进行升级维护。',false],
  ['青禾报名门户升级维护','若审批通过将对青禾报名门户进行升级维护。',false],
  ['青禾报名门户升级维护','将对青禾报名门户进行升级维护。不会对青禾报名门户进行升级维护。',false],
  ['青禾报名门户升级维护','青禾报名门户。实验设备将进行升级维护。',false],
 ] as const)('closed event name %s/%s rejects cross-object, condition and contradiction',(name,source,ok)=>expect(supportedEventOperation(name,[source],source)).toBe(ok))
 it('only reconstructs contiguous cited URL parts, never uncited text',()=>{
  const source='将对青禾报名门户（https://example.edu/a）进行升级维护。',at=source.indexOf(':')+1
  expect(supportedEventOperation('青禾报名门户升级维护',[source.slice(0,at),source.slice(at)],source)).toBe(true)
  expect(supportedEventOperation('青禾报名门户升级维护',[source.slice(0,at)],source)).toBe(false)
 })
 it.each([
  ['2027年2月15日04:30','event_end','2027年2月15日01:00-04:30',true],
  ['2027年2月15日01:00','event_start','2027年2月15日01:00-04:30',true],
  ['2027年2月15日04:31','event_end','2027年2月15日01:00-04:30',false],
  ['2027年2月16日04:30','event_end','2027年2月15日01:00-04:30',false],
  ['2027年2月15日04:30','event_start','2027年2月15日01:00-04:30',false],
  ['2027年2月15日04:30','task_deadline','2027年2月15日01:00-04:30',false],
  ['2027年2月15日01:00','event_end','2027年2月15日23:00-01:00',false],
  ['2027年2月15日04:30','event_end','2027年2月15日01:00-04:30。2027年2月15日02:00-04:30',false],
 ] as const)('explicit clock endpoint %s/%s requires the exact existing value and type',(rawText,type,quote,ok)=>expect(Boolean(rangeEndpointSupport(rawText,type,[quote],'2027-02-01T09:00:00+08:00','Asia/Shanghai'))).toBe(ok))
 it('cannot borrow the maintenance range from another event or manufacture its missing end',async()=>{
  const {s,d}=await recorded(4),input=structuredClone(d.result)
  input.events[0].evidenceIds=[]
  const first=assembleRecognitionFirstSuggestionD26(input,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone})
  expect(first.result.timePoints.find(t=>t.type==='event_end')!.normalizedValue).toBeNull()
  input.timePoints=input.timePoints.filter(t=>t.type!=='event_end');input.events[0].endTimePointTempId=null
  expect(assembleRecognitionFirstSuggestionD26(input,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone}).result.timePoints).toHaveLength(1)
 })
})
