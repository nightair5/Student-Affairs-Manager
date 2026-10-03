import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {decodeSourceContractRecording} from './sourceContractV4'
import {applyRecordedDirectiveDisposition,projectDirectiveDisposition} from './directiveDispositionProduct'
import {indexImmutableScopesV11} from './scopeIndexV11'
import {rebindRecordedScopes} from './recordedProjectionD26'
import {createContractFixture} from '../experiments/d26Recorded/contractFixtures'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from '../domain/v2/sourceReviewD26'
const root='docs/recognition-optimization/candidate19-development/paid-evidence/'
const recording=JSON.parse(readFileSync(root+'raw-02.json','utf8')) as {rawHttpText:string}
const source='校园失物查询网站将在周日晚间暂停查询。此前登记的信息保持不变，不需要重新登记，也不要发送补充邮件。'
async function context(text=source){return {index:await indexImmutableScopesV11('C19-DEV-S01','C19-DEV-S01-v1',text),referenceTime:'2026-10-03T09:00:00+08:00',timezone:'Asia/Shanghai'}}
async function variant(text:string){
  const old=await context(),next=await context(text),envelope=JSON.parse(recording.rawHttpText)
  let facts=JSON.parse(envelope.output[0].content[0].text)
  let serialized=JSON.stringify(facts)
  for(let i=0;i<old.index.scopes.length;i++)serialized=serialized.replaceAll(old.index.scopes[i].id,next.index.scopes[i].id)
  facts=JSON.parse(serialized);envelope.output[0].content[0].text=JSON.stringify(facts)
  return {decoded:decodeSourceContractRecording(JSON.stringify(envelope),'Candidate19',next),context:next}
}
describe('recorded negative directives, first display and formal ordinary save',()=>{
  it('preserves the real raw and frozen bridge but removes directly prohibited isolated actions from current suggestions',async()=>{
    const c=await context(),decoded=decodeSourceContractRecording(recording.rawHttpText,'Candidate19',c),before=structuredClone(decoded)
    const product=applyRecordedDirectiveDisposition(decoded,c)
    expect(decoded).toEqual(before)
    expect(product.sidecar.originalSemantic.tasks).toHaveLength(2)
    expect(product.sidecar.frozenBridgeResult.standaloneTasks).toHaveLength(2)
    expect(product.result.standaloneTasks).toHaveLength(0)
    expect(product.result.events).toHaveLength(1)
    expect(product.result.timePoints[0]).toMatchObject({normalizedValue:null,rawText:'周日晚间',precision:'vague',needsConfirmation:true})
    expect(product.productDisposition.decisions.every(d=>d.operation==='NON_ACTION_INFORMATION')).toBe(true)
    expect(product.result.ignoredContent.map(c=>c.text).join('')).toContain('不要发送补充邮件')
  })
  it('different direct negation forms are accepted; double negation or affirmative source stays blocked',async()=>{
    for(const text of [source.replace('不需要','无需').replace('也不要','也不必'),source.replace('不需要','不必')]){
      const v=await variant(text);expect(applyRecordedDirectiveDisposition(v.decoded,v.context).result.standaloneTasks).toHaveLength(0)
    }
    for(const text of [source.replace('不需要','不是不需要'),source.replace('不需要重新登记','需要重新登记')]){
      const v=await variant(text),p=applyRecordedDirectiveDisposition(v.decoded,v.context)
      expect(p.result.standaloneTasks).toHaveLength(1)
      expect(p.result.standaloneTasks[0].selected).toBe(false)
      expect(p.productDisposition.decisions[0].operation).toBe('RETAIN_BLOCKED')
    }
  })
  it('never deletes a relationship endpoint, missing primary or missing event; valid positive materials and dependency stay intact',async()=>{
    const c=await context(),decoded=decodeSourceContractRecording(recording.rawHttpText,'Candidate19',c),linked=structuredClone(decoded.originalAdapted)
    linked.tasks[1].detail.dependencyTempIds=['task-0001']
    expect(projectDirectiveDisposition(linked,c).result.tasks).toHaveLength(2)
    const shared=structuredClone(decoded.originalAdapted)
    shared.events[0].scopeIds=shared.tasks[0].propositionScopeIds
    expect(projectDirectiveDisposition(shared,c).audit.decisions[0].operation).toBe('RETAIN_BLOCKED')
    const guarded=structuredClone(decoded)
    guarded.result.conflicts.push({id:'unrelated-coverage',type:'other',message:'另一个片段仍需核对',entityTempIds:[],evidenceIds:[],requiresDecision:true})
    const guardedProduct=applyRecordedDirectiveDisposition(guarded,c)
    expect(guardedProduct.result.quality.needsHumanReview).toBe(true)
    expect(guardedProduct.result.conflicts.some(x=>x.id==='unrelated-coverage')).toBe(true)
    for(const kind of ['dependency','deadline','mixed'] as const){const f=await createContractFixture(kind),d=decodeSourceContractRecording(f.rawHttpText,'EngineeringFixture',f.context),p=applyRecordedDirectiveDisposition(d,f.context);expect(p.result.standaloneTasks).toEqual(d.result.standaloneTasks);expect(p.result.timePoints).toEqual(d.result.timePoints);expect(p.result.materials).toEqual(d.result.materials)}
    const baseline=JSON.parse(readFileSync(root+'raw-01.json','utf8')) as {rawHttpText:string}
    const missing=applyRecordedDirectiveDisposition(decodeSourceContractRecording(baseline.rawHttpText,'Candidate17',c),c)
    expect(missing.result.events).toHaveLength(0);expect(missing.result.timePoints).toHaveLength(0)
  })
  it('reminders, conditional timing and questions are not unconditional non-action information',async()=>{
    for(const [text,retainedId] of [
      [source.replace('不要发送','不要忘记发送'),'task-0002'],
      [source.replace('不要发送','不要在审批前发送'),'task-0002'],
      [source.replace('不需要重新登记','不需要现在重新登记'),'task-0001'],
      [source.replace('不需要重新登记','不需要重新登记吗'),'task-0001'],
    ]){
      const v=await variant(text),p=applyRecordedDirectiveDisposition(v.decoded,v.context)
      expect(p.result.standaloneTasks).toHaveLength(1)
      expect(p.result.standaloneTasks[0].tempId).toBe(retainedId)
      expect(p.result.standaloneTasks[0].selected).toBe(false)
      expect(p.productDisposition.decisions.find(d=>d.entityId===retainedId)?.operation).toBe('RETAIN_BLOCKED')
    }
  })
  it('uses the real capture, ordinary draft, DomainCommitPlan and separate repository readback with 0 tasks / 1 event / 1 unknown time',async()=>{
    const store=new MemoryWorkspaceRecordStore(),repository=new CanonicalWorkspaceRepository(store)
    await repository.initialize(emptyWorkspace())
    const capture=new CapturePersistenceService(repository),handle=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:source,sourceType:'text',title:'匿名暂停查询',provider:'manual',modelName:'recorded',promptVersion:'recorded-product',pipelineVersion:'source-grounded-nonaction-projection-1.0.1'})
    const old=await context(),c={...old,index:await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,source)}
    const rebound=rebindRecordedScopes(recording.rawHttpText,old.index,c.index)
    await capture.recognize(handle,async()=>applyRecordedDirectiveDisposition(decodeSourceContractRecording(rebound.reboundHttpText,'Candidate19',c),c).result)
    const view=await new IndexedDbWorkspaceRepository(repository).load(),w=(await repository.load())!
    const plan=buildSourceReviewPlan(w,view!.drafts.find(d=>d.id===handle.draftId)!)
    const receipt=await commitSourceReview(repository,plan),readback=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(readback.tasks).toHaveLength(0);expect(readback.projects).toHaveLength(0);expect(readback.events).toHaveLength(1)
    expect(readback.timePoints).toHaveLength(1);expect(readback.timePoints[0]).toMatchObject({normalizedValue:null,rawText:'周日晚间',precision:'vague'})
    expect(receipt.disposition).toBe('no_task')
  })
})
