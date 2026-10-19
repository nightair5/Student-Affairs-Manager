import { describe, it, expect } from 'vitest'
import { createAuthorityFixture } from '../experiments/candidate19Recorded/singleAuthorityFixtures'
import { decodeAuthorityProductRecording } from './singleAuthorityProduct'
import { currentDraftSourceInformation, projectSourceInformation, retainDeclaredSourceInformation, SOURCE_INFORMATION_PREVIEW_VERSION } from './sourceInformationPreview'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import { MemoryWorkspaceRecordStore, CanonicalWorkspaceRepository } from '../domain/v2/repository'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

async function informationFixture() {
  const x = await createAuthorityFixture('information'), decoded = decodeAuthorityProductRecording(x.rawHttpText, x.context)
  return { x, result: decoded.result, source: { sourceId: x.context.index.sourceId, sourceVersionId: x.context.index.sourceVersionId, text: x.sourceText } }
}

describe('source information visible without inventing entity ownership', () => {
  it('preserves an existing policy-tagged equipment requirement with its full condition, never an unsupported policy or a guessed owner',()=>{
    const text='活动免费，需自备量角器。',source='请提交图纸。'+text,r=ordinaryWorkflowFixture(source);r.evidence.push({id:'TOOLS',sourceId:'pending-source',quote:text,field:'requirement'});r.ignoredContent=[{text,reason:'policy'}]
    const first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'});expect(first.result.ignoredContent).toContainEqual({text,reason:'other'});expect(first.result.materials).toHaveLength(r.materials.length);expect(first.result.standaloneTasks).toHaveLength(r.standaloneTasks.length)
    for(const quote of ['活动免费，无需自备量角器。','活动免费，如需另行申请请等通知。']){const n=structuredClone(r);n.ignoredContent=[{text:quote,reason:'policy'}];n.evidence.at(-1)!.quote=quote;expect(retainDeclaredSourceInformation(n,'请提交图纸。'+quote).decisions).toEqual([])}
    const unproved=structuredClone(r);unproved.evidence.pop();expect(retainDeclaredSourceInformation(unproved,source).decisions).toEqual([])
    const conditional=structuredClone(r);const full='若报名获批，需自备量角器。';conditional.ignoredContent=[{text:full,reason:'policy'}];conditional.evidence.at(-1)!.quote=full;retainDeclaredSourceInformation(conditional,full);expect(conditional.ignoredContent).toContainEqual({text:full,reason:'other'});expect(conditional.materials).toHaveLength(r.materials.length)
  })
  it('a model-declared equipment requirement is visible as a literal source note, with no fabricated owner or new entity',()=>{
    const note='活动免费，需自备绘图板等工具。',source='请提交画稿。'+note,r=ordinaryWorkflowFixture(source);r.evidence.push({id:'INFO',sourceId:'pending-source',quote:note,field:'requirement'});r.ignoredContent=[{text:'需自备绘图板等工具',reason:'background'}]
    const before=structuredClone(r),first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
    expect(first.result.ignoredContent).toContainEqual({text:note,reason:'other'});expect(first.result.standaloneTasks).toHaveLength(r.standaloneTasks.length);expect(first.result.materials).toHaveLength(r.materials.length);expect(r).toEqual(before)
    const negative=structuredClone(r);negative.evidence.at(-1)!.quote='不是需自备绘图板等工具。';retainDeclaredSourceInformation(negative,'请提交画稿。不是需自备绘图板等工具。');expect(negative.ignoredContent[0].text).toBe('不是需自备绘图板等工具。')
    const missing=structuredClone(r);missing.ignoredContent=[];expect(retainDeclaredSourceInformation(missing,source).decisions).toEqual([])
  })
  it('ordinary assembly retains an existing unassigned requirement citation, not the model annotation opinion',()=>{
    const note='新生的课程安排请关注教务网站后续通知。',source='请提交画稿。'+note,r=ordinaryWorkflowFixture(source)
    r.evidence.push({id:'INFO',sourceId:'pending-source',quote:note,field:'requirement'})
    r.ambiguities=[{id:'A',field:'description',message:'模型推测所有学生现在都必须提交',options:['先核对适用范围'],evidenceIds:['INFO']}]
    const before=structuredClone(r),first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
    expect(first.result.ignoredContent).toContainEqual({text:note,reason:'other'})
    expect(first.result.standaloneTasks).toHaveLength(r.standaloneTasks.length)
    expect(first.result.events).toHaveLength(r.events.length);expect(first.result.timePoints).toHaveLength(r.timePoints.length)
    expect(first.audit.declaredSourceInformation?.decisions[0].text).toBe(note);expect(r).toEqual(before)
    const bound={...first.result,evidence:first.result.evidence.map(e=>({...e,sourceId:'S'}))}
    expect(projectSourceInformation(bound,{sourceId:'S',sourceVersionId:'V',text:source}).items.map(i=>i.text)).toContain(note)
    expect(projectSourceInformation(bound,{sourceId:'S',sourceVersionId:'V',text:source}).items.some(i=>i.text.includes('模型推测'))).toBe(false)
  })
  it('does not fill information absent from the model, unsupported text, an undeclared note, or an already displayed owner',()=>{
    const note='下月讲座地点尚未公布。',source='请提交画稿。'+note
    for(const kind of ['absent','unsupported','undeclared','owned']){
      const r=ordinaryWorkflowFixture(source)
      if(kind!=='absent')r.evidence.push({id:'INFO',sourceId:'pending-source',quote:kind==='unsupported'?'下月讲座在北楼。':note,field:'requirement'})
      r.ambiguities=kind==='undeclared'?[]:[{id:'A',field:'description',message:'需核对',options:[],evidenceIds:['INFO']}]
      if(kind==='owned')r.standaloneTasks[0].evidenceIds.push('INFO')
      expect(retainDeclaredSourceInformation(r,source).decisions).toEqual([])
    }
  })
  it('keeps different objects and literal wording as source information, not an event attribute or task', async () => {
    const { result, source } = await informationFixture(), before = structuredClone(result)
    const preview = projectSourceInformation(result, source)
    expect(preview.items.map(i => i.text).join('')).toContain('参与证明的名称保持不变')
    expect(preview.items.map(i => i.text).join('')).toContain('办事指南采用新版版式')
    expect(preview.inferredFacts).toBe(0); expect(result).toEqual(before)
    expect(result.standaloneTasks).toHaveLength(0); expect(result.events).toHaveLength(0); expect(result.timePoints).toHaveLength(0)
  })
  it('missing model information is never filled from the source', async () => {
    const { result, source } = await informationFixture()
    expect(projectSourceInformation({ ...result, ignoredContent: [] }, source).items).toEqual([])
  })
  it('rejects unsupported, foreign-source and contradictory fabricated quotes; deduplicates literal information', async () => {
    const { result, source } = await informationFixture(), duplicate = result.ignoredContent[0]
    const r = structuredClone(result)
    r.ignoredContent.push(duplicate, { text: '必须提交报名表', reason: 'other' })
    const projected = projectSourceInformation(r, source)
    expect(projected.suppressed.map(s => s.reason)).toContain('DUPLICATE')
    expect(projected.suppressed.map(s => s.reason)).toContain('UNSUPPORTED_SOURCE')
    expect(projectSourceInformation({ ...r, evidence: r.evidence.map(e => ({ ...e, sourceId: 'other-notice' })) }, source).items).toEqual([])
  })
  it('does not repeat already displayed real event attributes, and does not infer ownership for unattached information', async () => {
    const x = await createAuthorityFixture('single'), r = decodeAuthorityProductRecording(x.rawHttpText, x.context).result
    const supported = r.evidence.find(e => e.quote?.includes('参与证明'))!
    r.ignoredContent.push({ text: supported.quote!, reason: 'other' })
    const p = projectSourceInformation(r, { sourceId: x.context.index.sourceId, sourceVersionId: x.context.index.sourceVersionId, text: x.sourceText })
    expect(p.suppressed.some(s => s.reason === 'ENTITY_EVIDENCE_ALREADY_DISPLAYED')).toBe(true)
    expect(p.items.every(i => !i.text.includes('参与证明'))).toBe(true)
    expect(r.events).toHaveLength(1); expect(r.events[0].description).toContain('参与证明')
  })
  it('ordinary capture, formal transaction and independent readback retain information and first snapshot without creating empty entities', async () => {
    const { result, source } = await informationFixture(), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo)
    const h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '来源补充说明', rawText: source.text, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'test', pipelineVersion: SOURCE_INFORMATION_PREVIEW_VERSION })
    const bound = { ...result, evidence: result.evidence.map(e => ({ ...e, sourceId: h.sourceId })) }
    await capture.recognize(h, async () => bound)
    const info = projectSourceInformation(bound, { sourceId: h.sourceId, sourceVersionId: h.sourceVersionId, text: source.text })
    await repo.transaction(w => ({ ...w, extractionDrafts: w.extractionDrafts.map(d => d.id === h.draftId ? { ...d, legacyData: { ...d.legacyData, firstSourceInformationDisplayed: JSON.parse(JSON.stringify(info)) } } : d) }))
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, receipt = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, view.drafts[0]))
    const read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(read.tasks).toHaveLength(0); expect(read.events).toHaveLength(0); expect(read.timePoints).toHaveLength(0)
    const loaded = (await new CanonicalWorkspaceRepository(store).load())!, projected = currentDraftSourceInformation(loaded, h.draftId)
    expect(projected.status).toBe('CURRENT')
    if (projected.status === 'CURRENT') expect(projected.preview).toEqual(info)
    expect(loaded.projects).toHaveLength(0)
    expect(loaded.extractionDrafts[0].legacyData?.firstSourceInformationDisplayed).toEqual(info)
    const changed = structuredClone(loaded); changed.sources[0].currentVersionId = 'new-version'
    expect(currentDraftSourceInformation(changed, h.draftId).status).toBe('SOURCE_VERSION_UNAVAILABLE')
  })
})
