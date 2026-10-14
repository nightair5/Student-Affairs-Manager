import { describe, it, expect } from 'vitest'
import { createAuthorityFixture, AUTHORITY_CASES } from '../experiments/candidate19Recorded/singleAuthorityFixtures'
import { compileSingleAuthority, decodeSingleAuthorityRecording, buildSingleAuthorityRequest, SINGLE_AUTHORITY_SCHEMA, SINGLE_AUTHORITY_VERSION } from './sourceContractV5'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

describe('single authority generation and ordinary product compiler', () => {
  it('decodes exactly one output message without confusing preceding reasoning or fixture provenance', async()=>{
    const x=await createAuthorityFixture('single'),envelope=JSON.parse(x.rawHttpText)
    envelope.output.unshift({type:'reasoning',content:[{type:'reasoning_text',text:'not the facts'}]})
    expect(decodeSingleAuthorityRecording(JSON.stringify(envelope),x.context,'SingleAuthority').result.modelName).toBe('SingleAuthority 固定录制（非实时调用）')
    expect(decodeSingleAuthorityRecording(x.rawHttpText,x.context).result.modelName).toContain('非模型输出')
    envelope.output.push(envelope.output[1]);expect(()=>decodeSingleAuthorityRecording(JSON.stringify(envelope),x.context)).toThrow('RESPONSE_TEXT')
  })
  it.each(AUTHORITY_CASES.filter(c => c !== 'bad-owner'))('%s goes through real strict schema and ordinary first suggestion', async kind => {
    const x = await createAuthorityFixture(kind), compiled = compileSingleAuthority(x.facts, x.context), decoded = decodeSingleAuthorityRecording(x.rawHttpText, x.context)
    expect(compiled.audit.inferredFacts).toBe(0)
    expect(decoded.result.promptVersion).toBe('recognition-single-authority-1.0.0')
    expect(compiled.projected.events.map(e => e.tempId)).toEqual(x.facts.events.map(e => e.tempId))
  })
  it('one activity keeps its form, interaction and outcome without constructing extra events', async () => {
    const x = await createAuthorityFixture('single'), r = decodeSingleAuthorityRecording(x.rawHttpText, x.context).result
    expect(r.events).toHaveLength(1); expect(r.events[0].description).toContain('分组互动'); expect(r.events[0].description).toContain('参与证明')
    expect(r.timePoints.map(p => [p.type, p.normalizedValue])).toEqual([['event_start', '2026-11-12T14:00'], ['event_end', '2026-11-12T16:00']])
  })
  it('same name is not a merge rule and a distinct dated ceremony remains independent', async () => {
    for (const kind of ['similar', 'ceremony'] as const) { const x = await createAuthorityFixture(kind); expect(decodeSingleAuthorityRecording(x.rawHttpText, x.context).result.events).toHaveLength(2) }
  })
  it('a missing declared fact or wrong owner/type/duplicate endpoint is still refused', async () => {
    const x = await createAuthorityFixture('deadline'), missing = structuredClone(x.facts); missing.timePoints = []
    expect(() => compileSingleAuthority(missing, x.context)).toThrow('MISSING_PRESENT_FACT')
    const wrong = structuredClone(x.facts); wrong.timePoints[0].owners[0].entityId = 'fake'
    expect(() => compileSingleAuthority(wrong, x.context)).toThrow('TASK_OWNER')
    const e = await createAuthorityFixture('single'), invalid = structuredClone(e.facts); invalid.timePoints[0].owners[0].kind = 'event_end'
    expect(() => compileSingleAuthority(invalid, e.context)).toThrow('EVENT_OWNER_TYPE')
    const duplicate = structuredClone(e.facts); duplicate.timePoints.push({ ...duplicate.timePoints[0], tempId: 'duplicate' })
    expect(() => compileSingleAuthority(duplicate, e.context)).toThrow('DUPLICATE_ENDPOINT')
    const cross = await createAuthorityFixture('bad-owner'); expect(() => compileSingleAuthority(cross.facts, cross.context)).toThrow('EVENT_OWNER_EVIDENCE')
  })
  it('an unsupported attribute or unaccounted source is not silently classified as information', async () => {
    const x = await createAuthorityFixture('single'), unsupported = structuredClone(x.facts); unsupported.events[0].attributes[0].text = '必须缴费'
    expect(() => compileSingleAuthority(unsupported, x.context)).toThrow('ATTRIBUTE_EVIDENCE')
    const incomplete = structuredClone(x.facts); incomplete.scopeAccounting.pop()
    expect(() => compileSingleAuthority(incomplete, x.context)).toThrow('ACCOUNTING_INCOMPLETE')
  })
  it('wrong-owner facts remain in audit and block associated events, while an unrelated event can commit',async()=>{
    const x=await createAuthorityFixture('bad-owner'),decoded=decodeSingleAuthorityRecording(x.rawHttpText,x.context)
    expect(decoded.singleAuthorityAudit.quarantinedOwners[0].owner.entityId).toBe('E2')
    expect(decoded.result.events).toHaveLength(3);expect(decoded.result.conflicts.some(c=>c.entityTempIds.includes('E1')&&c.entityTempIds.includes('E2'))).toBe(true)
    const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'坏归属局部阻断',rawText:x.sourceText,provider:'manual',modelName:'ENGINEERING_FIXTURE',promptVersion:'test',pipelineVersion:SINGLE_AUTHORITY_VERSION});await capture.recognize(h,async()=>decoded.result)
    const view=(await new IndexedDbWorkspaceRepository(repo).load())!,receipt=await commitSourceReview(repo,buildSourceReviewPlan((await repo.load())!,view.drafts[0])),read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(receipt.disposition).toBe('partial');expect(read.events.map(e=>e.title)).toEqual(['丙组讨论']);expect(read.timePoints[0].normalizedValue).toBe('2026-11-14T16:00')
  })
  it('source window endpoints remain source roles, never a deadline or personal plan',async()=>{
    const x=await createAuthorityFixture('window'),decoded=decodeSingleAuthorityRecording(x.rawHttpText,x.context)
    expect(decoded.result.timePoints.map(p=>p.normalizedValue)).toEqual(['2026-11-06T09:00','2026-11-08T17:00'])
    expect(decoded.result.timePoints.every(p=>p.type!=='task_deadline'&&p.type!=='planned_start')).toBe(true)
    expect(decoded.singleAuthorityAudit.sourceWindows.map(p=>p.role)).toEqual(['window_start','window_end'])
  })
  it('different dates change the corresponding value, without rebasing on replay day', async () => {
    const x = await createAuthorityFixture('single'), changed = structuredClone(x.facts)
    const text = x.sourceText.replace('2026年11月12日', '2026年12月15日'), index = await indexImmutableScopesV11(x.context.index.sourceId, x.context.index.sourceVersionId, text)
    const bindings = new Map(x.context.index.scopes.map((s, i) => [s.id, index.scopes[i].id]))
    const rebound = JSON.parse(JSON.stringify(changed, (k, v) => k === 'scopeId' && typeof v === 'string' ? bindings.get(v) : Array.isArray(v) && /ScopeIds$|scopeIds/.test(k) ? v.map(id => bindings.get(id) ?? id) : k === 'rawText' && typeof v === 'string' ? v.replace('2026年11月12日', '2026年12月15日') : v))
    const envelope=JSON.parse(x.rawHttpText);envelope.output[0].content[0].text=JSON.stringify(rebound);const raw=JSON.stringify(envelope)
    expect(decodeSingleAuthorityRecording(raw, { ...x.context, index }).result.timePoints[0].normalizedValue).toBe('2026-12-15T14:00')
  })
  it('the real request carries the new schema and no expected answers or permission', async () => {
    const x = await createAuthorityFixture('single'), request = await buildSingleAuthorityRequest(x.context)
    expect(request.dispatchAuthorized).toBe(false); expect(request.body.text.format.schema).toEqual(SINGLE_AUTHORITY_SCHEMA)
    expect(request.body.text.format.schema.properties!.schemaVersion.const).toBe(SINGLE_AUTHORITY_VERSION)
    expect(request.serialized).not.toContain('Expected')
    expect(SINGLE_AUTHORITY_SCHEMA.properties!.events.items!.properties).not.toHaveProperty('startTimePointTempId')
    expect(SINGLE_AUTHORITY_SCHEMA.properties!.tasks.items!.properties!.coverage.properties!.time.properties).not.toHaveProperty('entityIds')
  })
  it('explicit shared time survives actual capture, DomainCommitPlan and independent repository readback', async () => {
    const x = await createAuthorityFixture('shared'), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo)
    const h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '共享时间', rawText: x.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'test', pipelineVersion: SINGLE_AUTHORITY_VERSION })
    await capture.recognize(h, async () => decodeSingleAuthorityRecording(x.rawHttpText, x.context).result)
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, plan = buildSourceReviewPlan((await repo.load())!, view.drafts[0]), receipt = await commitSourceReview(repo, plan)
    const read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(read.events).toHaveLength(2); expect(read.timePoints).toHaveLength(1)
    expect(new Set(read.events.map(e => e.startTimePointId)).size).toBe(1)
    expect(read.timePoints[0].legacyData?.sharedEventIds).toEqual(read.events.map(e => e.id))
  })
})
