import { describe, expect, it } from 'vitest'
import { alternativeReceiptFixture } from './conditionalObligation.fixture'
import { ordinaryWorkflowFixture } from './ordinaryProviderSupport.fixture'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { parseRecognitionResult } from './schema'
import { citedConditionalObligations } from './nativeConditionalObligation'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'
import { applySourceReadiness, sourceReadinessGroups } from '../domain/v2/sourceReadiness'
import { workspaceSnapshotHash } from '../domain/v2/migration'

const machine = <T extends ReturnType<typeof alternativeReceiptFixture>>(f: T) => { f.r.promptVersion = 'recognition-product-contract-1.5.0'; return f }
const first = (f: ReturnType<typeof alternativeReceiptFixture>) => assembleCurrentFirstSuggestion(parseRecognitionResult(f.r), { sourceText: f.source, referenceTime: '2027-04-01T09:00:00+08:00', timezone: 'Asia/Shanghai' })
function courses(platform = false) {
  const names = ['《环境与生活》', '《实验设计》'], intro = (platform ? '由课程平台提供的' : '') + 'MOOC' + names.join('\n') + '请在规定区间完成课程学习。'
  const learning = '学习时间：2027年4月2日—2027年4月20日', exam = '考试时间：2027年4月21日—2027年4月28日', source = intro + '\n' + learning + '\n' + exam
  const r = ordinaryWorkflowFixture(source), t = r.standaloneTasks[0]; r.promptVersion = 'recognition-product-contract-1.5.0'; r.materials = []
  r.evidence = [names[0], names[1], '请在规定区间完成课程学习。', learning, exam].map((quote, i) => ({ id: 'e' + i, sourceId: 'pending-source', quote, field: 'requirement' as const }))
  if (platform) r.evidence.push({ id: 'platform', sourceId: 'pending-source', quote: '由课程平台提供的MOOC' + names[0], field: 'requirement' })
  r.standaloneTasks = names.map((n, i) => ({ ...t, tempId: 't' + i, actionVerb: '完成', actionObject: n + '课程学习', title: '完成' + n + '课程学习', materialTempIds: [], timePointTempIds: ['p0', 'p1'], evidenceIds: ['e' + i, 'e2', 'e3'] }))
  r.timePoints = ['event_start', 'event_end', 'event_start', 'event_end'].map((type, i) => ({ tempId: 'p' + i, type: type as 'event_start' | 'event_end', rawText: i < 2 ? learning : exam,
    normalizedValue: null, timezone: 'Asia/Shanghai', isAllDay: true, precision: 'date_only' as const, needsConfirmation: true,
    relatedTaskTempIds: i < 2 ? ['t0', 't1'] : [], relatedMaterialTempIds: [], evidenceIds: [i < 2 ? 'e3' : 'e4'], confidence: 1, selected: true }))
  r.events = ['网络学习', '考试'].map((kind, i) => ({ tempId: 'event' + i, title: 'MOOC' + names.join('') + kind, description: i ? exam : learning,
    startTimePointTempId: 'p' + (i * 2), endTimePointTempId: 'p' + (i * 2 + 1), location: !i && platform ? '课程平台' : null,
    relatedTaskTempIds: i ? [] : ['t0', 't1'], evidenceIds: i ? ['e4'] : ['e0', 'e1', 'e3', ...(platform ? ['platform'] : [])], confidence: 1, inferenceLevel: 'explicit' as const, selected: true }))
  return { source, r }
}
function preparation(personal = '', admitted = false) {
  const rule = admitted ? '线上培训面向被录取的正式学员，被录取的正式学员可互动，各学员需自行准备绘图板。' : '入选后需要自行准备绘图板，个人入选结果未知。'
  const source = rule + personal, r = ordinaryWorkflowFixture(source), t = r.standaloneTasks[0]
  r.materials = []; r.events = []; r.timePoints = []; r.ambiguities = []
  r.evidence = [{ id: 'rule', sourceId: 'pending-source', quote: rule, field: 'requirement' }, ...(personal ? [{ id: 'personal', sourceId: 'pending-source', quote: personal, field: 'requirement' as const }] : [])]
  r.standaloneTasks = [{ ...t, tempId: 'prepare', title: '准备绘图板', actionVerb: '准备', actionObject: '绘图板', materialTempIds: [], timePointTempIds: [], evidenceIds: r.evidence.map(e => e.id), selected: true }]
  return { source, r }
}

describe('opportunity views preserve task facts without duplicate fixed attendance', () => {
  it('keeps normal and conditional receipt branches with all four original points and no duplicate fixed events', () => {
    const f = machine(alternativeReceiptFixture()), before = structuredClone(f.r), out = first(f)
    expect(out.result.standaloneTasks).toHaveLength(2); expect(out.result.standaloneTasks.map(t => t.selected)).toEqual([true, false])
    expect(out.result.events).toHaveLength(0); expect(out.result.timePoints).toHaveLength(4)
    expect(out.result.sourceSummary.summary).toContain('1项领取事项')
    expect(out.audit.opportunityProjection?.decisions.map(d => d.event.location)).toEqual(['甲室', '乙室'])
    expect(out.audit.existingHandlingWindows?.rows).toHaveLength(2)
    expect(citedConditionalObligations(out.result, f.source)[0].alternativeTaskId).toBe('normal')
    expect(out.result.standaloneTasks[1].dependencyTempIds).toEqual([]); expect(f.r).toEqual(before)
  })
  it('keeps legacy/manual event choices as entered rather than migrating them', () => {
    expect(first(alternativeReceiptFixture()).result.events).toHaveLength(2)
  })
  it.each(['different object', 'approval step', 'no second chance', 'other batch', 'broken pair'])('does not fold a receipt described as %s', kind => {
    const f = machine(alternativeReceiptFixture())
    if (kind === 'different object') f.r.standaloneTasks[1].actionObject = '另一资料袋'
    if (kind === 'approval step') { f.source = f.source.replace('如果错过以上领取时间', '登记并审核后'); f.r.evidence[1].quote = f.r.evidence[1].quote.replace('如果错过以上领取时间', '登记并审核后') }
    if (kind === 'no second chance') { f.source = f.source.replace('可于', '不再补领，可于'); f.r.evidence[1].quote = f.r.evidence[1].quote.replace('可于', '不再补领，可于') }
    if (kind === 'other batch') { f.source = f.source.replace('在乙室领取', '在乙室领取另一批'); f.r.evidence[1].quote = f.r.evidence[1].quote.replace('在乙室领取', '在乙室领取另一批') }
    if (kind === 'broken pair') f.r.events[1].endTimePointTempId = null
    expect(first(f).audit.opportunityProjection?.decisions ?? []).toEqual([])
  })
  it.each([false, true])('retains course tasks, shared learning dates, real exam and existing platform=%s', platform => {
    const f = courses(platform), before = structuredClone(f.r), out = first(f)
    expect(out.result.events.map(e => e.title)).toEqual([f.r.events[1].title])
    expect(out.result.standaloneTasks).toHaveLength(2); expect(out.result.timePoints.map(p => p.normalizedValue)).toEqual(['2027-04-02', '2027-04-20', '2027-04-21', '2027-04-28'])
    expect(out.result.timePoints.every(p => p.precision === 'date_only')).toBe(true)
    if (platform) expect(out.result.standaloneTasks.every(t => t.description.includes('课程平台'))).toBe(true)
    expect(out.audit.opportunityProjection?.decisions[0].event).toBeDefined(); expect(f.r).toEqual(before)
  })
  it.each(['fixed class', 'physical venue', 'wrong owner', 'missing task', 'local conflict'])('does not suppress an independently meaningful or unsafe learning event: %s', kind => {
    const f = courses()
    if (kind === 'fixed class') { f.source = f.source.replace('请在规定区间', '统一集中授课，请在规定区间'); f.r.evidence[2].quote = '统一集中授课，' + f.r.evidence[2].quote }
    if (kind === 'physical venue') f.r.events[0].location = '二号教室'
    if (kind === 'wrong owner') f.r.timePoints[0].relatedTaskTempIds = ['t0']
    if (kind === 'missing task') { f.r.standaloneTasks.pop(); f.r.events[0].relatedTaskTempIds = ['t0']; expect(() => first(f)).toThrow('结构无效'); return }
    if (kind === 'local conflict') f.r.conflicts.push({ id: 'conflict', type: 'other', message: '该活动的归属冲突', entityTempIds: ['event0'], evidenceIds: ['e3'], requiresDecision: true })
    expect(first(f).result.events.some(e => e.tempId === 'event0')).toBe(true)
  })
  it('separates qualification-unknown preparation from an unconditional requirement without inventing a task', () => {
    for (const admitted of [false, true]) {
      const f = preparation('', admitted), out = first(f)
      expect(out.result.standaloneTasks).toHaveLength(1); expect(out.result.standaloneTasks[0].selected).toBe(false)
      expect(out.audit.nativeQualificationReview[0].sourceConditionValue).toBe('unknown')
    }
  })
  it.each([['本人已入选。', 'true'], ['本人未入选。', 'false'], ['本人已入选。本人未入选。', 'unknown']] as const)('retains actual personal status %s as %s', (fact, expected) => {
    const out = first(preparation(fact))
    expect(out.audit.nativeQualificationReview[0].sourceConditionValue).toBe(expected)
    if (expected !== 'true') expect(out.result.standaloneTasks[0].selected).toBe(false)
  })
  it('does not reinterpret an unfinished action dependency as admission', () => {
    const f = preparation(); f.source = '登记完成后需要自行准备绘图板。'; f.r.evidence[0].quote = f.source
    const out = first(f); expect(out.audit.nativeQualificationReview).toEqual([])
  })
  it('records one branch choice and saves only that task and its existing points through the canonical transaction', async () => {
    const f = machine(alternativeReceiptFixture()), out = first(f), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({ operationId: crypto.randomUUID(), rawText: f.source, sourceType: 'text', title: '匿名领取', provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: f.r.promptVersion, pipelineVersion: out.audit.version })
    await capture.recognize(h, async () => out.result)
    await repo.transaction(w => ({ ...w, extractionDrafts: w.extractionDrafts.map(d => d.id === h.draftId ? { ...d, legacyData: { ...d.legacyData, firstSuggestionDisplayed: JSON.parse(JSON.stringify(out.result)), firstSuggestionAssembly: JSON.parse(JSON.stringify(out.audit)), originalResponse: JSON.stringify(f.r) } } : d) }))
    let w = (await repo.load())!
    const group = sourceReadinessGroups(w, h.draftId)[0]
    expect(group).toBeDefined()
    await repo.transaction(w => applySourceReadiness(w, h.draftId, { groupId: group.id, choice: 'meets_stated_condition', expectedResult: workspaceSnapshotHash(w.extractionDrafts[0].result), operationId: crypto.randomUUID() }))
    w = (await repo.load())!; const draft = (await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d => d.id === h.draftId)!, plan = buildSourceReviewPlan(w, draft)
    const back = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), await commitSourceReview(repo, plan))
    expect(back.tasks).toHaveLength(1); expect(back.events).toHaveLength(0); expect(back.timePoints).toHaveLength(2)
    expect(back.tasks[0].dependencyIds).toEqual([])
    await commitSourceReview(repo, plan); expect((await repo.load())!.tasks).toHaveLength(1)
  })
})
