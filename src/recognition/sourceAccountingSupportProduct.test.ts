import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { decodeProductSourceRecording, projectSourceSupportAccounting } from './sourceAccountingSupportProduct'
import { decodeSourceContractRecording, type SourceContractV4 } from './sourceContractV4'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { rebindRecordedScopes } from './recordedProjectionD26'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback, sourceReviewProblem } from '../domain/v2/sourceReviewD26'
const root = 'docs/recognition-optimization/candidate19-development/'
const sources = JSON.parse(readFileSync(root + 'SOURCES.json', 'utf8')).sources as Array<{sourceId:string;sourceVersionId:string;sourceText:string;referenceTime:string;timezone:string}>
const raw = (n:number) => (JSON.parse(readFileSync(root + 'paid-evidence/' + (n < 3 ? '' : 'completed/') + `raw-${String(n).padStart(2,'0')}.json`, 'utf8')) as {rawHttpText:string}).rawHttpText
async function recording(n:number, sourceNumber:number) {
  const source=sources[sourceNumber-1], context={index:await indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
  return {source,context,raw:raw(n)}
}
function changed(input:string, fn:(f:SourceContractV4)=>void) {const envelope=JSON.parse(input),facts=JSON.parse(envelope.output[0].content[0].text) as SourceContractV4;fn(facts);envelope.output[0].content[0].text=JSON.stringify(facts);return JSON.stringify(envelope)}

describe('source-owned supporting facts into the ordinary product, without changing frozen answers',()=>{
  it('restores actual S03 and S05 facts rejected by frozen information accounting, with a reversible audit',async()=>{
    for(const [n,s] of [[6,3],[10,5]]) {
      const r=await recording(n,s),before=r.raw
      expect(()=>decodeSourceContractRecording(r.raw,'Candidate19',r.context)).toThrow('SOURCE_CONTRACT_INFORMATION_ENTITY')
      const p=decodeProductSourceRecording(r.raw,'Candidate19',r.context)
      expect(p.supportAccountingAudit?.inferredFacts).toBe(0)
      expect(p.supportAccountingAudit?.originalWire).toEqual(JSON.parse(JSON.parse(before).output[0].content[0].text))
      expect(raw(n)).toBe(before)
      if(s===3) {
        expect(p.result.standaloneTasks).toHaveLength(3)
        expect(p.result.standaloneTasks[1].dependencyTempIds).toEqual(['task-0001'])
        expect(p.result.standaloneTasks[2].selected).toBe(false)
        expect(sourceReviewProblem(p.result,'task-0003')).toBeTruthy()
        expect(p.supportAccountingAudit?.originalWire.prerequisiteStates[0].completion).toBe('unknown')
      } else {
        expect(p.result.standaloneTasks).toHaveLength(1);expect(p.result.events).toHaveLength(1)
        expect(p.result.materials[0].formatRequirements).toEqual(['PDF'])
        expect(p.result.standaloneTasks[0].completionCriteria).toContain('看到平台显示接收成功才算办结')
        expect(p.result.timePoints.map(t=>t.normalizedValue)).toEqual(['2026-11-13T09:25','2026-11-14T14:20','2026-11-14T15:35'])
      }
    }
  })
  it('accepts a different grounded formulation and accounting order, not a recording identity exception',async()=>{
    const r=await recording(10,5), text=r.source.sourceText.replaceAll('志愿服务统计表','活动成果清单').replaceAll('统计表须为PDF','清单须为PDF').replaceAll('小组编号','学院编号').replaceAll('接收成功','收到文件')
    const index=await indexImmutableScopesV11('anonymous-variant','anonymous-variant-v1',text)
    let wire=r.raw
    for(let i=0;i<r.context.index.scopes.length;i++)wire=wire.replaceAll(r.context.index.scopes[i].id,index.scopes[i].id)
    wire=wire.replaceAll('志愿服务统计表','活动成果清单').replaceAll('统计表须为PDF','清单须为PDF').replaceAll('小组编号','学院编号').replaceAll('接收成功','收到文件')
    wire=changed(wire,f=>f.scopeAccounting.reverse())
    const p=decodeProductSourceRecording(wire,'EngineeringFixture',{...r.context,index})
    expect(p.result.materials[0].name).toBe('活动成果清单')
    expect(p.result.materials[0].namingRequirements).toContain('文件名包含学院编号')
    expect(p.result.standaloneTasks[0].completionCriteria).toContain('看到平台显示收到文件才算办结')
  })
  it('rejects minimal semantic counterexamples: fake/missing primary, cross-scope, wrong owner, wrong standard and graph',async()=>{
    const r=await recording(10,5)
    const mutations:Array<(f:SourceContractV4)=>void>=[
      f=>{f.scopeAccounting.find(x=>x.kind==='information')!.secondaryEntityIds=['invented']},
      f=>{f.scopeAccounting[0].primaryEntityIds=[]},
      f=>{f.scopeAccounting[1].primaryEntityIds=['task-0001']},
      f=>{f.materials[0].scopeIds=[f.scopeAccounting[0].scopeId]},
      f=>{f.materials[0].relatedTaskTempIds=['invented']},
      f=>{f.tasks[0].detail.completionCriteria=['自动算办结']},
      f=>{f.events[0].startTimePointTempId='time-0001'},
      f=>{f.timePoints[0].relatedTaskTempIds=['nonexistent']},
    ]
    for(const mutate of mutations)expect(()=>decodeProductSourceRecording(changed(r.raw,mutate),'Candidate19',r.context)).toThrow()
    const q=await recording(6,3)
    for(const mutate of [
      (f:SourceContractV4)=>{f.tasks[2].object.surface='场地使用登记'},
      (f:SourceContractV4)=>{f.tasks[2].condition.value='true'},
      (f:SourceContractV4)=>{f.prerequisiteStates[0].completion='true'},
      (f:SourceContractV4)=>{f.tasks[2].condition.factScopeIds=[]},
    ])expect(()=>decodeProductSourceRecording(changed(q.raw,mutate),'Candidate19',q.context)).toThrow()
    const foreign=await indexImmutableScopesV11('wrong-source','v1',r.source.sourceText)
    expect(()=>projectSourceSupportAccounting(r.raw,{...r.context,index:foreign})).toThrow()
  })
  it('does not invent a baseline event or hide negative/conditional uncertainty',async()=>{
    const r=await recording(1,1),p=decodeProductSourceRecording(r.raw,'Candidate17',r.context)
    expect(p.result.events).toHaveLength(0);expect(p.result.timePoints).toHaveLength(0)
    const q=await recording(7,4),blocked=decodeProductSourceRecording(q.raw,'Candidate19',q.context)
    expect(blocked.result.standaloneTasks.find(t=>t.actionObject==='展位申请')?.selected).toBe(false)
    expect(sourceReviewProblem(blocked.result,'task-0001')).toBeTruthy()
  })
  it.each([[10,5],[6,3]])('recording %i goes through real capture, selected source transaction and independent canonical readback',async(n,s)=>{
    const r=await recording(n,s),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:r.source.sourceText,sourceType:'text',title:'匿名支持事实',provider:'manual',modelName:'recorded',promptVersion:'recorded',pipelineVersion:'source-support-accounting-projection-1.0.0'})
    const index=await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,r.source.sourceText)
    const rebound=rebindRecordedScopes(r.raw,r.context.index,index)
    await capture.recognize(handle,async()=>decodeProductSourceRecording(rebound.reboundHttpText,'Candidate19',{...r.context,index}).result)
    const view=(await new IndexedDbWorkspaceRepository(repo).load())!,w=(await repo.load())!,draft=view.drafts.find(d=>d.id===handle.draftId)!
    const plan=buildSourceReviewPlan(w,draft),receipt=await commitSourceReview(repo,plan)
    const actual=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    if(s===5){
      expect([actual.tasks.length,actual.projects.length,actual.events.length,actual.timePoints.length,actual.materials.length]).toEqual([1,0,1,3,1])
      expect(actual.timePoints.map(t=>t.normalizedValue)).toEqual(['2026-11-13T09:25','2026-11-14T14:20','2026-11-14T15:35'])
      expect(actual.materials[0].formatRequirements).toEqual(['PDF'])
      await commitSourceReview(repo,plan)
      expect((await repo.load())!.tasks).toHaveLength(1)
    } else {
      expect(actual.tasks).toHaveLength(2);expect(receipt.disposition).toBe('partial')
      expect(actual.tasks.every(t=>t.status!=='completed')).toBe(true)
      expect(actual.extractionDrafts[0].result!.standaloneTasks[2].selected).toBe(false)
    }
  })
})
