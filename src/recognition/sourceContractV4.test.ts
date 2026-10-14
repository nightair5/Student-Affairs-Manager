import { describe, it, expect } from 'vitest'
import { createContractFixture } from '../experiments/d26Recorded/contractFixtures'
import { assembleSourceContractV4, declareLegacyRecordingV4, decodeSourceContractRecording, buildSourceContractRequest, SOURCE_CONTRACT_VERSION, type SourceContractV4 } from './sourceContractV4'
import { SOURCE_FACT_VERSION } from '../experiments/realInput01/sourceFactsV3'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback, sourceReviewProblem, sourceEventProblem } from '../domain/v2/sourceReviewD26'
import { assembleRecognitionFirstSuggestionD26 } from './firstSuggestionD26'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DraftReviewPanel } from '../components/DraftReviewPanel'
const envelope = (facts: unknown) => JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }], usage: { input_tokens: 0, output_tokens: 0 } })
const legacy = (facts: SourceContractV4) => ({ ...structuredClone(facts), schemaVersion: SOURCE_FACT_VERSION, informationScopeIds: facts.scopeAccounting.filter(r => r.kind === 'information').map(r => r.scopeId), unresolvedScopeIds: facts.scopeAccounting.filter(r => r.kind === 'unresolved').map(r => r.scopeId), tasks: facts.tasks.map(t => ({ ...t, coverage: Object.fromEntries(Object.entries(t.coverage).map(([k, v]) => [k, v.status === 'present' ? null : 'not_stated'])) })), scopeAccounting: facts.scopeAccounting.map(r => ({ scopeId: r.scopeId, kind: r.kind, entityIds: [...r.primaryEntityIds, ...r.secondaryEntityIds] })) })

describe('explicit source contract through real schema, public adapter, ordinary display and formal repository', () => {
  it.each(['event', 'deadline', 'dependency', 'mixed', 'revision'] as const)('accepts source-authored %s while preserving its known facts', async kind => {
    const f = await createContractFixture(kind), decoded = decodeSourceContractRecording(f.rawHttpText, 'EngineeringFixture', f.context)
    expect(decoded.coverageAudit.unknownCoverage).toHaveLength(0)
    expect(decoded.result.events).toHaveLength(f.facts.events.length)
    expect(decoded.result.timePoints).toHaveLength(f.facts.timePoints.length)
    if (kind === 'deadline') {
      expect(decoded.result.timePoints[0]).toMatchObject({ type: 'submission_deadline', rawText: '2026年11月6日15:20前', normalizedValue: '2026-11-06T15:20', needsConfirmation: false })
      expect(decoded.result.materials[0]).toMatchObject({ name: '器材清单', formatRequirements: ['PDF'], namingRequirements: ['学院和姓名'] })
      expect(decoded.result.standaloneTasks[0].completionCriteria).toContain('文件名用学院和姓名')
    }
    if (kind === 'mixed') {
      expect(decoded.result.timePoints.find(p => p.tempId === 'P5')?.normalizedValue).toBe('2026-11-07T15:00')
      expect(decoded.result.timePoints.find(p => p.tempId === 'P3')).toMatchObject({ normalizedValue: null, rawText: '结束时间尚未公布', needsConfirmation: true })
    }
  })
  it('different reference order is invariant; fake/wrong-kind/cross-scope/unrelated secondary and absent primary are rejected', async () => {
    const f = await createContractFixture('mixed'), original = assembleSourceContractV4(f.facts, f.context)
    const reordered = structuredClone(f.facts); reordered.scopeAccounting.reverse(); reordered.events.reverse(); reordered.timePoints.reverse()
    expect(assembleSourceContractV4(reordered, f.context).assembledWire.tasks[0].detail.title).toBe(original.assembledWire.tasks[0].detail.title)
    for (const mode of ['fake', 'wrong-kind', 'cross-scope', 'unrelated', 'no-primary']) {
      const invalid = structuredClone(f.facts), row = invalid.scopeAccounting.find(r => r.primaryEntityIds.includes('E1'))!
      if (mode === 'fake') row.secondaryEntityIds.push('fake')
      if (mode === 'wrong-kind') row.primaryEntityIds = ['P2']
      if (mode === 'cross-scope') row.secondaryEntityIds.push('P1')
      if (mode === 'unrelated') { invalid.timePoints.find(p => p.tempId === 'P1')!.scopeIds = [row.scopeId]; row.secondaryEntityIds.push('P1') }
      if (mode === 'no-primary') row.primaryEntityIds = []
      expect(() => assembleSourceContractV4(invalid, f.context)).toThrow(/REFERENCE/)
    }
  })
  it('coverage distinguishes present, explicit-none, not-stated and unknown without null or invented facts', async () => {
    const f = await createContractFixture('dependency'), facts = structuredClone(f.facts)
    facts.tasks[0].coverage.time = { status: 'unknown', entityIds: [], scopeIds: [] }
    facts.tasks[1].coverage.time = { status: 'explicit_none', entityIds: [], scopeIds: [f.context.index.scopes.find(s => s.text.includes('未设截止'))!.id] }
    const decoded = decodeSourceContractRecording(envelope(facts), 'EngineeringFixture', f.context)
    expect(decoded.coverageAudit.declarations[1].coverage.time).toMatchObject({ status: 'explicit_none' })
    expect(sourceReviewProblem(decoded.result, 'T1')).toContain('时间覆盖未说明')
    expect(sourceReviewProblem(decoded.result, 'T2')).toBeUndefined()
    expect(decoded.result.timePoints).toHaveLength(0)
    const invalid = structuredClone(facts); (invalid.tasks[0].coverage as unknown as { time: null }).time = null
    expect(() => assembleSourceContractV4(invalid, f.context)).toThrow('SHAPE')
    invalid.tasks[0].coverage.time = { status: 'explicit_none', entityIds: [], scopeIds: [] }
    expect(() => assembleSourceContractV4(invalid, f.context)).toThrow('EVIDENCE_REQUIRED')
  })
  it('ambiguous legacy null is preserved as unknown, not no-event or whole-answer correct', async () => {
    const f = await createContractFixture('deadline'), input = legacy(f.facts)
    input.tasks[0].coverage.event = null
    const oldBytes = JSON.stringify(input), declared = declareLegacyRecordingV4(input)
    expect(declared.facts.tasks[0].coverage.event.status).toBe('unknown')
    expect(declared.audit.missingDeclarations).toHaveLength(1)
    const decoded = decodeSourceContractRecording(envelope(input), 'Candidate18', f.context)
    expect(decoded.result.events).toHaveLength(0)
    expect(decoded.result.standaloneTasks[0].selected).toBe(false)
    expect(sourceReviewProblem(decoded.result, 'T1')).toContain('关联事件覆盖未说明')
    expect(JSON.stringify(input)).toBe(oldBytes)
  })
  it('known legacy event + its time can display without human entry; omitted event stays absent', async () => {
    const f = await createContractFixture('event'), input = legacy(f.facts), decoded = decodeSourceContractRecording(envelope(input), 'Candidate18', f.context)
    expect(decoded.result.events).toHaveLength(1); expect(decoded.result.timePoints).toHaveLength(1)
    expect(decoded.result.timePoints[0]).toMatchObject({ normalizedValue: null, rawText: '周五晚上', precision: 'vague', needsConfirmation: true })
    input.events = []; input.timePoints = []
    expect(() => decodeSourceContractRecording(envelope(input), 'Candidate18', f.context)).toThrow('FAKE_REFERENCE')
  })
  it('neither direction of an old accounting contradiction is silently chosen; both arms retain missing facts', async () => {
    const f = await createContractFixture('event'), input = legacy(f.facts)
    input.informationScopeIds.push(input.scopeAccounting.find(r=>r.kind==='event')!.scopeId)
    expect(()=>declareLegacyRecordingV4(input)).toThrow('LEGACY_INFORMATION_CONFLICT')
    const removed = legacy(f.facts); removed.informationScopeIds = []
    expect(()=>declareLegacyRecordingV4(removed)).toThrow('LEGACY_INFORMATION_CONFLICT')
  })
  it('conditional completion is never evidence of true prerequisite; missing revision endpoints and wrong event time types reject', async () => {
    const f = await createContractFixture('dependency'), invalid = structuredClone(f.facts)
    invalid.prerequisiteStates[0].completion = 'true'; invalid.prerequisiteStates[0].factScopeIds = [invalid.tasks[1].propositionScopeIds[0]]
    invalid.tasks[0].semantics.status = 'completed'
    expect(() => assembleSourceContractV4(invalid, f.context)).toThrow('CONDITIONAL_NOT_COMPLETION_PROOF')
    const r = await createContractFixture('revision'); r.facts.revisions[0].targetDirectiveId = 'scope-not-task'
    expect(() => assembleSourceContractV4(r.facts, r.context)).toThrow('REFERENCE')
    const e = await createContractFixture('event'); e.facts.timePoints[0].type = 'submission_deadline'
    expect(() => assembleSourceContractV4(e.facts, e.context)).toThrow('EVENT_TIME_TYPE')
  })
  it('the proposed request uses the exact new schema, existing source clock and no dispatch permission', async () => {
    const f = await createContractFixture('event'), req = await buildSourceContractRequest(f.context)
    expect(req.body.model).toBe('deepseek-flash'); expect(req.dispatchAuthorized).toBe(false)
    expect(req.body.text.format.schema.properties!.schemaVersion.const).toBe(SOURCE_CONTRACT_VERSION)
    expect(req.serialized).toContain(f.context.referenceTime)
    expect(req.body.input[0].content[0].text).toContain('禁止用null')
    expect(req.serialized).not.toContain('Expected')
  })
  it('a separate explicit completed statement can prove completion, while conditional wording cannot', async () => {
    const f = await createContractFixture('dependency'), source = f.sourceText + '借用记录已经填写完成。'
    const index = await indexImmutableScopesV11(f.context.index.sourceId, f.context.index.sourceVersionId, source)
    const proof = index.scopes.at(-1)!
    let serialized = JSON.stringify(f.facts)
    for (const old of f.context.index.scopes) serialized = serialized.replaceAll(old.id, index.scopes.find(s => s.text === old.text && s.order === old.order)!.id)
    const facts = JSON.parse(serialized) as SourceContractV4
    facts.tasks[0].semantics.status = 'completed'
    facts.prerequisiteStates[0] = { ...facts.prerequisiteStates[0], completion: 'true', factScopeIds: [proof.id] }
    facts.scopeAccounting.push({ scopeId: proof.id, kind: 'information', primaryEntityIds: [], secondaryEntityIds: [] })
    expect(assembleSourceContractV4(facts, { ...f.context, index }).explicitFacts.prerequisiteStates[0].completion).toBe('true')
  })
  it.each(['mixed','dependency'] as const)('ordinary %s review explains provenance, events and waiting without changing the legacy banner API', async kind => {
    const f = await createContractFixture(kind), repo = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), handle = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '契约页面', rawText: f.sourceText, provider: 'manual', modelName: 'engineering', promptVersion: SOURCE_CONTRACT_VERSION, pipelineVersion: SOURCE_CONTRACT_VERSION })
    const bound = await createContractFixture(kind, handle)
    await capture.recognize(handle, async () => decodeSourceContractRecording(bound.rawHttpText, 'EngineeringFixture', bound.context).result)
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, noop = () => undefined
    const props: Parameters<typeof DraftReviewPanel>[0] = { draft: view.drafts[0], source: view.sources[0], onClose: noop, onUpdate: noop, onConfirm: noop, onReject: noop, onConfirmAll: noop, projectWillCreate: false, projects: [], onProjectChoice: noop, onKeepExplicit: noop, onMoveTask: noop, onToggleRecognitionEntity: noop, onToggleTaskSelected: noop, onSplitTask: noop, onMergeTask: noop, ordinarySourceReview: { busy: false, unsaved: false, facts: null, onConfirm: noop, description: '匿名契约工程夹具 · 非模型输出 · 无新模型请求' } }
    const html = renderToStaticMarkup(createElement(DraftReviewPanel, props))
    if(kind==='mixed')expect(html).toContain('1 项任务、2 个事件')
    else {expect(html).toContain('等待前一步：填写借用记录');expect(html).toContain('前置完成后')}
    expect(html).toContain('匿名契约工程夹具 · 非模型输出')
    expect(renderToStaticMarkup(createElement(DraftReviewPanel, { ...props, recognitionDescription: '旧入口独立说明' }))).toContain('旧入口独立说明')
  })
  it('real capture, ordinary display, DomainCommitPlan and independent readback preserve 1 task + 2 events + 5 times', async () => {
    const fixture = await createContractFixture('mixed'), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), handle = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '不同写法', rawText: fixture.sourceText, provider: 'manual', modelName: 'engineering', promptVersion: SOURCE_CONTRACT_VERSION, pipelineVersion: SOURCE_CONTRACT_VERSION })
    const f = await createContractFixture('mixed', handle)
    await capture.recognize(handle, async () => assembleRecognitionFirstSuggestionD26(decodeSourceContractRecording(f.rawHttpText, 'EngineeringFixture', f.context).result, { sourceText: f.sourceText, referenceTime: f.context.referenceTime, timezone: f.context.timezone }).result)
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, draft = view.drafts[0]
    const receipt = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, draft)), read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(read.tasks).toHaveLength(1); expect(read.events).toHaveLength(2); expect(read.timePoints).toHaveLength(5); expect(read.projects).toHaveLength(0)
    expect(read.timePoints.filter(p => p.normalizedValue === null).map(p => p.rawText).sort()).toEqual(['周五晚上', '结束时间尚未公布'])
    expect(read.timePoints.find(p => p.type === 'submission_deadline')?.normalizedValue).toBe('2026-11-06T15:20')
  })
  it('unknown eligibility blocks its task while prerequisite-waiting and unrelated tasks can persist', async () => {
    const f = await createContractFixture('dependency'), decoded = decodeSourceContractRecording(f.rawHttpText, 'EngineeringFixture', f.context)
    expect(sourceReviewProblem(decoded.result, 'T3')).toContain('资格尚未确认')
    expect(sourceReviewProblem(decoded.result, 'T2')).toBeUndefined()
    expect(decoded.result.standaloneTasks.find(t => t.tempId === 'T2')?.dependencyTempIds).toEqual(['T1'])
  })
  it('an event endpoint type conflict is local: unrelated task remains confirmable', async () => {
    const f = await createContractFixture('mixed'), decoded = decodeSourceContractRecording(f.rawHttpText, 'EngineeringFixture', f.context)
    decoded.result.events[0].startTimePointTempId = 'P1'
    expect(sourceEventProblem(decoded.result, 'E1')).toContain('其他类型')
    expect(sourceReviewProblem(decoded.result, 'T1')).toBeUndefined()
  })
})
