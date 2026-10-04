import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { assembleCurrentFirstSuggestion, groundMaterialChannels } from './materialChannelGrounding'
import { decodeCurrentSourceRecording } from './conditionalNonActionProduct'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { rebindRecordedScopes } from './recordedProjectionD26'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback, sourceReviewProblem } from '../domain/v2/sourceReviewD26'
import {createContractFixture} from '../experiments/d26Recorded/contractFixtures'
import {CHANNEL_ROLE_CASES, createChannelRoleFixture} from '../experiments/candidate19Recorded/materialChannelFixtures'
const root='docs/recognition-optimization/candidate19-development/'
const sources=JSON.parse(readFileSync(root+'SOURCES.json','utf8')).sources as Array<{sourceId:string;sourceVersionId:string;sourceText:string;referenceTime:string;timezone:string}>
const raw=(n:number)=>(JSON.parse(readFileSync(root+'paid-evidence/'+(n<3?'':'completed/')+`raw-${String(n).padStart(2,'0')}.json`,'utf8')) as {rawHttpText:string}).rawHttpText
async function recorded(n=10) {
  const s=sources[4],context={index:await indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone}
  return { s, context, decoded:decodeCurrentSourceRecording(raw(n),n===10?'Candidate19':'Candidate17',context) }
}
describe('source role grounded ordinary material channels',()=>{
  it.each(CHANNEL_ROLE_CASES)('real wire $id: source role survives conversion and reordered source, with no invented facts',async row=>{
    const assemble = async (reverse: boolean) => {
      const f=await createChannelRoleFixture(row.id,reverse)
      const decoded=decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context)
      const untouched=structuredClone(decoded.result)
      const p=assembleCurrentFirstSuggestion(decoded.result,{sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone})
      expect(decoded.result).toEqual(untouched)
      expect(p.materialChannelAudit.decisions[0].status).toBe(row.expected)
      expect(p.result.materials[0].submissionChannel).toBe(row.expected==='EXPLICIT_CHANNEL'?row.channel:null)
      expect(p.result.materials[0].formatRequirements).toEqual(['PDF'])
      expect(p.result.events).toHaveLength(2);expect(p.result.timePoints).toHaveLength(5)
      expect(p.result.timePoints.filter(t=>t.normalizedValue===null)).toHaveLength(2)
      expect(Boolean(sourceReviewProblem(p.result,'T1'))).toBe(row.expected!=='EXPLICIT_CHANNEL')
      return p.result
    }
    const first=await assemble(false),reordered=await assemble(true)
    expect(reordered.materials.map(m=>[m.name,m.submissionChannel])).toEqual(first.materials.map(m=>[m.name,m.submissionChannel]))
    expect(reordered.timePoints.map(p=>[p.type,p.rawText,p.normalizedValue])).toEqual(first.timePoints.map(p=>[p.type,p.rawText,p.normalizedValue]))
  })
  it.each(CHANNEL_ROLE_CASES)('real formal path $id: a supported obligation saves, an unsupported channel blocks locally while independent events save',async row=>{
    const f=await createChannelRoleFixture(row.id),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo)
    const h=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:f.sourceText,sourceType:'text',title:'匿名渠道反例',provider:'manual',modelName:'匿名工程夹具',promptVersion:'NOT_MODEL_OUTPUT',pipelineVersion:'channel-role-fixture-1'})
    const context={...f.context,index:await indexImmutableScopesV11(h.sourceId,h.sourceVersionId,f.sourceText)}
    await capture.recognize(h,async()=>assembleCurrentFirstSuggestion(decodeCurrentSourceRecording(rebindRecordedScopes(f.rawHttpText,f.context.index,context.index).reboundHttpText,'EngineeringFixture',context).result,{sourceText:f.sourceText,referenceTime:context.referenceTime,timezone:context.timezone}).result)
    const w=(await repo.load())!,view=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d=>d.id===h.draftId)!
    const plan=buildSourceReviewPlan(w,view),receipt=await commitSourceReview(repo,plan),back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(back.tasks).toHaveLength(row.expected==='EXPLICIT_CHANNEL'?1:0)
    expect(back.materials).toHaveLength(row.expected==='EXPLICIT_CHANNEL'?1:0)
    expect(back.events).toHaveLength(2);expect(back.timePoints).toHaveLength(row.expected==='EXPLICIT_CHANNEL'?5:4);expect(back.projects).toHaveLength(0)
    if(row.expected==='EXPLICIT_CHANNEL')expect(back.materials[0].submissionChannel).toBe(row.channel)
    else expect(receipt.disposition).toBe('partial')
    await commitSourceReview(repo,plan)
    expect((await repo.load())!.events).toHaveLength(2)
  })
  it.each([['周三晚',null],['开始时间尚未公布',null],['2026年11月18日20:10','2026-11-18T20:10']] as const)('new anonymous no-task event expression keeps %s without inventing an obligation or a date',async(rawText,expected)=>{
    const f=await createContractFixture('event'),sourceText=f.sourceText.replaceAll('班车订座网站','校园预约系统').replaceAll('周五晚上',rawText)
    const index=await indexImmutableScopesV11('anonymous-event-variant','anonymous-event-variant-v1',sourceText)
    let text=JSON.stringify(f.facts).replaceAll('班车订座网站','校园预约系统').replaceAll('周五晚上',rawText)
    for(const old of f.context.index.scopes)text=text.replaceAll(old.id,index.scopes[old.order].id)
    const envelope=JSON.parse(f.rawHttpText);envelope.output[0].content[0].text=text
    const http=JSON.stringify(envelope),context={...f.context,index}
    const p=assembleCurrentFirstSuggestion(decodeCurrentSourceRecording(http,'EngineeringFixture',context).result,{sourceText,referenceTime:context.referenceTime,timezone:context.timezone})
    expect(p.result.standaloneTasks).toHaveLength(0);expect(p.result.events).toHaveLength(1)
    expect(p.result.timePoints[0]).toMatchObject({type:'event_start',rawText,normalizedValue:expected,needsConfirmation:expected===null})
    const reordered=JSON.parse(text);reordered.scopeAccounting.reverse()
    envelope.output[0].content[0].text=JSON.stringify(reordered)
    expect(assembleCurrentFirstSuggestion(decodeCurrentSourceRecording(JSON.stringify(envelope),'EngineeringFixture',context).result,{sourceText,referenceTime:context.referenceTime,timezone:context.timezone}).result.timePoints).toEqual(p.result.timePoints)
  })
  it('retains all C19 S05 facts and the disputed original, separates receipt from destination without a guessed channel or mandatory edit',async()=>{
    const {s,decoded}=await recorded(),before=structuredClone(decoded.result)
    const p=assembleCurrentFirstSuggestion(decoded.result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone})
    expect(decoded.result).toEqual(before)
    expect(p.materialChannelAudit.decisions[0]).toMatchObject({originalValue:'平台',displayedValue:null,status:'RECEIPT_CONTEXT_UNRESOLVED'})
    expect(p.result.materials[0]).toMatchObject({submissionChannel:null,formatRequirements:before.materials[0].formatRequirements,namingRequirements:before.materials[0].namingRequirements})
    expect(p.result.standaloneTasks[0].completionCriteria).toContain('看到平台显示接收成功才算办结')
    expect(p.result.conflicts).toEqual(before.conflicts);expect(p.result.events).toHaveLength(1)
  })
  it.each(['请将志愿服务统计表上传至资料门户。','请通过资料门户提交志愿服务统计表。','志愿服务统计表的提交渠道为资料门户。'])('accepts explicit same-object channel in a different expression: %s',async text=>{
    const {decoded}=await recorded(),r=structuredClone(decoded.result),m=r.materials[0],t=r.standaloneTasks[0]
    r.evidence=[{id:'fresh',sourceId:'anonymous',quote:text,field:'materials',extractionMethod:'parser'}];m.evidenceIds=['fresh'];m.submissionChannel='资料门户';t.evidenceIds=['fresh']
    expect(groundMaterialChannels(r,text).audit.decisions[0].status).toBe('EXPLICIT_CHANNEL')
    expect(groundMaterialChannels(r,text).result.materials[0].submissionChannel).toBe('资料门户')
  })
  it.each(['请将活动照片上传至资料门户。','上传志愿服务统计表照片至资料门户。','不要通过资料门户提交志愿服务统计表。','如果通过资料门户提交志愿服务统计表，请等待消息。','资料门户显示已收到活动照片。'])('blocks wrong object, negation, conditional and foreign receipt: %s',async text=>{
    const {decoded}=await recorded(),r=structuredClone(decoded.result),m=r.materials[0],t=r.standaloneTasks[0]
    r.evidence=[{id:'fresh',sourceId:'anonymous',quote:text,field:'materials',extractionMethod:'parser'}];m.evidenceIds=['fresh'];m.submissionChannel='资料门户';t.evidenceIds=['fresh']
    const p=groundMaterialChannels(r,text)
    expect(p.audit.decisions[0].status).toBe('UNSUPPORTED_OR_AMBIGUOUS_CHANNEL');expect(p.result.conflicts.at(-1)?.entityTempIds).toContain(t.tempId)
    expect(p.result.events).toEqual(r.events)
  })
  it('rejects cross-source evidence and leaves an absent channel absent, without manufacture',async()=>{
    const {decoded}=await recorded(),r=structuredClone(decoded.result),m=r.materials[0],t=r.standaloneTasks[0],text='请通过资料门户提交志愿服务统计表。'
    r.evidence=[{id:'material',sourceId:'this-source',quote:'统计表须为PDF。',field:'materials',extractionMethod:'parser'},{id:'other',sourceId:'foreign-source',quote:text,field:'materials',extractionMethod:'parser'}]
    m.evidenceIds=['material'];m.submissionChannel='资料门户';t.evidenceIds=['other']
    expect(groundMaterialChannels(r,'统计表须为PDF。'+text).audit.decisions[0].status).toBe('UNSUPPORTED_OR_AMBIGUOUS_CHANNEL')
    m.submissionChannel=null;expect(groundMaterialChannels(r,text).audit.decisions).toEqual([])
  })
  it('uses Schema, public converter, source review, real atomic repository commit and independent readback; unknown destination does not invent a user edit',async()=>{
    const {s,context}=await recorded(),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo)
    const h=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:s.sourceText,sourceType:'text',title:'匿名材料与回执',provider:'manual',modelName:'Candidate19固定录制',promptVersion:'recorded',pipelineVersion:'channel-grounding'})
    const current={...context,index:await indexImmutableScopesV11(h.sourceId,h.sourceVersionId,s.sourceText)}
    await capture.recognize(h,async()=>assembleCurrentFirstSuggestion(decodeCurrentSourceRecording(rebindRecordedScopes(raw(10),context.index,current.index).reboundHttpText,'Candidate19',current).result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone}).result)
    const w=(await repo.load())!,view=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d=>d.id===h.draftId)!
    const plan=buildSourceReviewPlan(w,view),receipt=await commitSourceReview(repo,plan),back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(back.materials[0].submissionChannel).toBeNull();expect(back.tasks).toHaveLength(1);expect(back.events).toHaveLength(1);expect(back.timePoints).toHaveLength(3)
    expect(back.tasks[0].legacyData?.completionCriteria).toContain('看到平台显示接收成功才算办结')
    await commitSourceReview(repo,plan);expect((await repo.load())!.materials).toHaveLength(1)
  })
})
