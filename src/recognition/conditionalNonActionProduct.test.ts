import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {decodeCurrentSourceRecording,projectConditionalNonAction} from './conditionalNonActionProduct'
import {decodeProductSourceRecording} from './sourceAccountingSupportProduct'
import {indexImmutableScopesV11} from './scopeIndexV11'
import {rebindRecordedScopes} from './recordedProjectionD26'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback,sourceEventProblem} from '../domain/v2/sourceReviewD26'
const root='docs/recognition-optimization/candidate19-development/'
const sources=JSON.parse(readFileSync(root+'SOURCES.json','utf8')).sources as Array<{sourceId:string;sourceVersionId:string;sourceText:string;referenceTime:string;timezone:string}>
const raw=(n:number)=>(JSON.parse(readFileSync(root+'paid-evidence/'+(n<3?'':'completed/')+`raw-${String(n).padStart(2,'0')}.json`,'utf8')) as {rawHttpText:string}).rawHttpText
async function context(i=3,text=sources[i].sourceText){const s=sources[i];return {index:await indexImmutableScopesV11(s.sourceId,s.sourceVersionId,text),referenceTime:s.referenceTime,timezone:s.timezone}}
describe('current explicit inapplicability is information; waiting and unknown are not deleted',()=>{
  it('both real arms retain original answers, reduce S04 to the one positive task and preserve all evidence',async()=>{
    const c=await context()
    for(const [ordinal,candidate] of [[7,'Candidate19'],[8,'Candidate17']] as const){
      const old=decodeProductSourceRecording(raw(ordinal),candidate,c),before=structuredClone(old.originalAdapted),p=decodeCurrentSourceRecording(raw(ordinal),candidate,c)
      expect(old.originalAdapted).toEqual(before);expect(p.sidecar.originalSemantic.tasks).toHaveLength(2)
      expect(p.result.standaloneTasks.map(t=>t.title)).toEqual(['保存活动联系编号'])
      expect(p.result.ignoredContent.map(i=>i.text).join('')).toContain('不能提交展位申请')
      expect(p.productDisposition.decisions[0].operation).toBe('CURRENT_INAPPLICABLE_INFORMATION')
      expect(p.result.conflicts.filter(c=>c.requiresDecision)).toHaveLength(0)
    }
  })
  it('accepts a genuinely different object, actor and verb expression; order cannot connect a foreign fact',async()=>{
    const c=await context(),text=sources[3].sourceText.replaceAll('展位申请','器材申请').replaceAll('本轮','本次').replaceAll('获准','批准').replaceAll('仅限','只限').replaceAll('你的社团','本社团').replaceAll('不能提交','不得递交')
    const next=await context(3,text)
    let fixture=raw(7)
    for(let i=0;i<c.index.scopes.length;i++)fixture=fixture.replaceAll(c.index.scopes[i].id,next.index.scopes[i].id)
    const envelope=JSON.parse(fixture),w=JSON.parse(envelope.output[0].content[0].text)
    w.tasks[0].action.surface='不得递交';w.tasks[0].object.surface='器材申请'
    envelope.output[0].content[0].text=JSON.stringify(w)
    const p=decodeCurrentSourceRecording(JSON.stringify(envelope),'EngineeringFixture',next)
    expect(p.result.standaloneTasks).toHaveLength(1)
    const changed=structuredClone(p.originalAdapted);changed.tasks[0].object.surface='别的申请'
    expect(projectConditionalNonAction(changed,next).result.tasks).toHaveLength(2)
  })
  it('retains unknown/true, reminders, double negation, mismatched predicate, source state and every relationship endpoint',async()=>{
    const c=await context(),decoded=decodeProductSourceRecording(raw(7),'Candidate19',c)
    const mutations:Array<(s:typeof decoded.originalAdapted)=>void>=[
      s=>{s.tasks[0].condition.value='unknown'},s=>{s.tasks[0].condition.value='true'},s=>{s.tasks[0].semantics.polarity='affirmative'},
      s=>{s.tasks[0].action.surface='不要忘记提交'},s=>{s.tasks[0].action.surface='不能不提交'},s=>{s.tasks[0].condition.factScopeIds=[]},
      s=>{s.tasks[0].object.surface='活动联系编号'},s=>{s.tasks[0].semantics.validity='superseded'},
      s=>{s.tasks[1].detail.dependencyTempIds=[s.tasks[0].id]},s=>{s.tasks[0].detail.dependencyTempIds=[s.tasks[1].id]},
      s=>{s.revisions=[{type:'supersedes',targetDirectiveId:s.tasks[1].id,fromDirectiveId:s.tasks[0].id,scopeIds:s.tasks[0].propositionScopeIds,effective:'unknown'}]},
      s=>{s.conflicts=[{id:'bad',type:'other',message:'冲突',entityTempIds:[],scopeIds:[],requiresDecision:true}]},
    ]
    for(const mutate of mutations){const s=structuredClone(decoded.originalAdapted);mutate(s);expect(projectConditionalNonAction(s,c).result.tasks).toHaveLength(2)}
    for(const text of [sources[3].sourceText.replace('尚未获准','已经获准'),sources[3].sourceText.replace('尚未获准','尚未批准'),sources[3].sourceText.replace('你的社团','另一个社团')]){
      const next=await context(3,text);const s=structuredClone(decoded.originalAdapted)
      for(let i=0;i<c.index.scopes.length;i++){const old=c.index.scopes[i].id,id=next.index.scopes[i].id;const json=JSON.stringify(s).replaceAll(old,id);Object.assign(s,JSON.parse(json))}
      expect(projectConditionalNonAction(s,next).result.tasks).toHaveLength(2)
    }
  })
  it('keeps true waiting obligations, qualification unknown, direct prohibition and normal controls',async()=>{
    for(const [n,i,candidate,count] of [[2,0,'Candidate19',0],[5,2,'Candidate17',3],[6,2,'Candidate19',3],[10,4,'Candidate19',1],[11,5,'Candidate19',1]] as const){const p=decodeCurrentSourceRecording(raw(n),candidate,await context(i));expect(p.result.standaloneTasks).toHaveLength(count);if(i===2){expect(p.result.standaloneTasks[1].dependencyTempIds).toEqual(['task-0001']);expect(p.result.standaloneTasks[2].selected).toBe(false)}}
  })
  it('blocks a real wire task claiming the independent event time; independently owned event remains saveable',async()=>{
    const c=await context(4),envelope=JSON.parse(raw(9)),wire=JSON.parse(envelope.output[0].content[0].text)
    wire.tasks[0].detail.timePointTempIds.push(wire.events[0].startTimePointTempId)
    envelope.output[0].content[0].text=JSON.stringify(wire)
    const p=decodeCurrentSourceRecording(JSON.stringify(envelope),'Candidate17',c)
    expect(p.sidecar.productGraphGuards).toHaveLength(1)
    expect(p.result.conflicts.some(x=>x.requiresDecision&&x.entityTempIds.includes(wire.tasks[0].id))).toBe(true)
    expect(p.result.standaloneTasks[0].selected).toBe(false)
    expect(p.result.quality.needsHumanReview).toBe(true)
    expect(p.result.quality.reviewReasons.join('')).toContain('关联对象不一致')
    expect(p.sidecar.originalSemantic.tasks[0].detail.timePointTempIds).toContain(wire.events[0].startTimePointTempId)
    expect(sourceEventProblem(p.result,p.result.events[0].tempId)).toBeUndefined()
    const store=new MemoryWorkspaceRecordStore(),repository=new CanonicalWorkspaceRepository(store);await repository.initialize(emptyWorkspace())
    const capture=new CapturePersistenceService(repository),s=sources[4],handle=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:s.sourceText,sourceType:'text',title:'匿名错挂时间',provider:'manual',modelName:'Candidate17录制反例',promptVersion:'recorded',pipelineVersion:'source-grounded-conditional-nonaction-1.0.0'})
    const next={...c,index:await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,s.sourceText)}
    await capture.recognize(handle,async()=>decodeCurrentSourceRecording(rebindRecordedScopes(JSON.stringify(envelope),c.index,next.index).reboundHttpText,'Candidate17',next).result)
    const view=await new IndexedDbWorkspaceRepository(repository).load(),w=(await repository.load())!,draft=view!.drafts.find(d=>d.id===handle.draftId)!
    expect(()=>buildSourceReviewPlan(w,{...draft,items:draft.items.map(i=>({...i,selected:true}))})).toThrow('关联对象不一致')
    const receipt=await commitSourceReview(repository,buildSourceReviewPlan(w,draft)),back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(back.tasks).toHaveLength(0);expect(back.events).toHaveLength(1);expect(back.timePoints.map(t=>t.normalizedValue)).toEqual(['2026-11-14T14:20','2026-11-14T15:35'])
    expect(back.extractionDrafts.find(d=>d.id===handle.draftId)?.status).toBe('partially_confirmed')
  })
  it('captures real Schema/public conversion, commits only save-number via the ordinary plan, independently reads and retries idempotently',async()=>{
    const store=new MemoryWorkspaceRecordStore(),repository=new CanonicalWorkspaceRepository(store);await repository.initialize(emptyWorkspace())
    const capture=new CapturePersistenceService(repository),s=sources[3],handle=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:s.sourceText,sourceType:'text',title:'匿名资格限制',provider:'manual',modelName:'Candidate19录制',promptVersion:'recorded',pipelineVersion:'source-grounded-conditional-nonaction-1.0.0'})
    const old=await context(),c={...old,index:await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,s.sourceText)}
    await capture.recognize(handle,async()=>decodeCurrentSourceRecording(rebindRecordedScopes(raw(7),old.index,c.index).reboundHttpText,'Candidate19',c).result)
    const view=await new IndexedDbWorkspaceRepository(repository).load(),w=(await repository.load())!,plan=buildSourceReviewPlan(w,view!.drafts.find(d=>d.id===handle.draftId)!)
    const receipt=await commitSourceReview(repository,plan),back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(back.tasks).toHaveLength(1);expect(back.tasks[0].title).toBe('保存活动联系编号');expect(back.projects).toHaveLength(0)
    await commitSourceReview(repository,plan);expect((await repository.load())!.tasks).toHaveLength(1)
  })
})
