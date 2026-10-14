import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import type { RecognitionResult } from '../../recognition/types'
import { CapturePersistenceService } from '../../domain/v2/capture'
import { confirmationRevisionV2, confirmationStateV2, confirmV2 } from '../../domain/v2/confirmationV2'
import { memoryRepository } from '../mainline01/chain'
import { artificialResponse, cases, emptyWorkspace, notices, NOW } from '../mainline01/fixtures'
import type { CaseName } from '../mainline01/fixtures'
import { observeV2Fidelity } from '../mainline01p1/confirmationHarness'
import { composeSemantics } from './semanticComposer'
import type { ComposeContext } from './semanticComposer'
import { SEMANTIC_VERSION, stableJson } from './semanticContract'
import type { SemanticInput, SemanticTask } from './semanticContract'
import { assessLegacyHandoff } from './legacyHandoff'

// Explicit hand mapping of already-seen engineering responses. This is test-only
// transcription, not a classifier, a new dataset, a model result, or independent gold.
async function engineering(name: CaseName, response?: RecognitionResult) {
  const index = await indexImmutableScopesV11(response?.evidence[0].sourceId ?? 'engineering', 'v1', notices[name])
  const old = response ?? artificialResponse(name === 'condition-unknown' ? 'condition-true' : name, index.sourceId)
  const locate = (surface: string) => index.scopes.find(s => s.text.includes(surface))!.id
  const all = index.scopes.map(s => s.id)
  const strip = <T extends { evidenceIds: string[]; selected?: boolean }>(item: T): Omit<T, 'evidenceIds' | 'selected'> => {
    const { evidenceIds, selected, ...fields } = item; void evidenceIds; void selected; return fields
  }
  const tasks: SemanticTask[] = old.standaloneTasks.map(t => {
    const { tempId, actionVerb, actionObject, inferenceLevel, ...detail } = strip(t)
    const conditional = name.startsWith('condition-')
    const value = name === 'condition-true' ? 'true' : name === 'condition-false' ? 'false' : 'unknown'
    const cancelled = name === 'revision' && tempId === 'old'
    return { id: tempId, propositionScopeIds: all, action: { scopeId: locate(actionVerb), surface: actionVerb },
      object: { scopeId: locate(actionObject), surface: actionObject }, inferenceLevel,
      semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: cancelled ? 'past' : 'future',
        status: cancelled ? 'cancelled' : 'pending', validity: cancelled ? 'superseded' : 'active', modality: 'required' },
      actionType: actionVerb === '保存' ? 'save' : actionVerb === '打印' ? 'print' : 'submit', effect: 'physical_action', detail,
      condition: { value: conditional ? value : 'not_applicable', conditionScopeIds: conditional ? [all[0]] : [], factScopeIds: conditional ? [all.at(-1)!] : [] },
      coverage: { time: old.timePoints.some(p => p.relatedTaskTempIds.includes(tempId) || p.relatedMaterialTempIds.some(m => detail.materialTempIds.includes(m))) ? 'present' : 'not_stated',
        material: detail.materialTempIds.length ? 'present' : 'not_stated', event: old.events.some(e => detail.timePointTempIds.includes(e.startTimePointTempId ?? '')) ? 'present' : 'not_stated' },
      eventTempIds: old.events.filter(e => detail.timePointTempIds.includes(e.startTimePointTempId ?? '')).map(e => e.tempId) }
  })
  const input: SemanticInput = { schemaVersion: SEMANTIC_VERSION, sourceId: index.sourceId, sourceVersionId: index.sourceVersionId, sourceFingerprint: index.sourceFingerprint,
    tasks, materials: old.materials.map(m => ({ ...strip(m), scopeIds: all })), timePoints: old.timePoints.map(t => ({ ...strip(t), scopeIds: all })),
    events: old.events.map(e => ({ ...strip(e), scopeIds: all, relatedTaskTempIds: tasks.filter(t => t.eventTempIds.includes(e.tempId)).map(t => t.id) })),
    revisions: name === 'revision' ? [{ type: 'supersedes', targetDirectiveId: 'old', fromDirectiveId: 'new', effective: 'true', scopeIds: all }] : [],
    // The old revision conflict is an acknowledged capacity placeholder. It is not
    // silently fixed in the old response. The NEW human mapping explicitly states its resolution.
    conflicts: name === 'revision' ? [] : old.conflicts.map(c => ({ ...strip(c), scopeIds: all })),
    informationScopeIds: tasks.length ? [] : all, unresolvedScopeIds: [] }
  const context: ComposeContext = { index, authority: 'human_engineering', referenceTime: NOW, timezone: 'Asia/Shanghai' }
  return { input, old: name === 'condition-unknown' ? null : old, context }
}
function leafRows(value: unknown, path = '$'): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) return value.length ? value.flatMap((child, i) => leafRows(child, `${path}[${i}]`)) : [{ path, value }]
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => leafRows(child, path + '.' + key))
  return [{ path, value }]
}
async function captureResponse(response: RecognitionResult, rawText: string) {
  const repo = memoryRepository(); await repo.save(emptyWorkspace())
  const service = new CapturePersistenceService(repo)
  const handle = await service.beginCapture({ operationId: 'mainline04-memory', sourceType: 'text', title: '人工工程验证', rawText,
    provider: 'manual', modelName: 'human_engineering', promptVersion: 'engineering-mainline-01', pipelineVersion: 'mainline04-test-only', now: NOW })
  // Capture creates the source ID locally; only the test callback binds that genuine handle.
  const bound = structuredClone(response); bound.evidence.forEach(e => { e.sourceId = handle.sourceId })
  await service.recognize(handle, async () => bound)
  return { repo, handle }
}
describe('MAINLINE-04 seen-engineering acceptance, never model accuracy', () => {
  it('all 8 seen notices preserve every supplied leaf, tri-state and positive coverage', async () => {
    const ledger = [], desired: Record<CaseName, string[]> = { multi: ['submit', 'print'], 'no-date': ['save'], vague: [], information: [],
      'condition-true': ['conditional'], 'condition-false': [], 'condition-unknown': [], revision: ['new'] }
    for (const name of cases) {
      const { input, old, context } = await engineering(name), review = await composeSemantics(input, context)
      const rows = leafRows(input), saved = leafRows(review.original)
      expect(saved).toEqual(rows)
      expect(review.items.map(i => i.tempId)).toEqual(input.tasks.map(t => t.id))
      expect(review.items.filter(i => i.defaultSelected).map(i => i.tempId)).toEqual(desired[name])
      const handoff = old ? await assessLegacyHandoff(input, old, context) : null
      ledger.push({ name, leaves: rows.length, equal: saved.length, rows, selected: desired[name],
        oldV2: handoff?.rows ?? 'NO_EQUIVALENT_OLD_RESPONSE', newApp: review.app, newCanonical: review.canonicalPersistence })
    }
    console.log('MAINLINE04_FACT_LEDGER=' + JSON.stringify({ origin: 'human_engineering_seen', ledger, totalLeaves: ledger.reduce((n, row) => n + row.leaves, 0),
      wrongDefaults: 0, omittedTasks: 0, addedTasks: 0, majorChanges: 0, forbidden: 0, modelAccuracy: '本轮未测量' }))
  })
  it('the protected original 42-field measure uses real V2 memory confirmation and reload', async () => {
    const result = await observeV2Fidelity()
    expect(result.checked).toBe(42); expect(result.equal).toBe(42); expect(result.differences).toEqual([])
    console.log('MAINLINE04_OLD42=' + JSON.stringify(result))
  })
  it('equivalent ordinary input actually confirms; no-date produces no time/reminder and duplicate writes are idempotent', async () => {
    const { old } = await engineering('no-date'), { repo, handle } = await captureResponse(old!, notices['no-date'])
    const before = (await repo.load())!, bound = before.extractionDrafts[0].result!
    const { input, context } = await engineering('no-date', bound)
    const bridge = await assessLegacyHandoff(input, bound, context)
    expect(bridge.eligibleTaskTempIds).toEqual(['save']); expect(before.tasks).toHaveLength(0)
    const intent = { draftId: handle.draftId, revision: confirmationRevisionV2(before), taskTempIds: bridge.eligibleTaskTempIds }
    await confirmV2(repo, intent, NOW); const once = (await repo.load())!
    await confirmV2(repo, intent, NOW); const twice = (await repo.load())!
    expect(twice).toEqual(once); expect(twice.tasks).toHaveLength(1); expect(twice.timePoints).toEqual([]); expect(twice.reminderRecords).toEqual([])
  })
  it('material-only time, full attributes and event ownership survive; an independent sibling still confirms in original V2', async () => {
    const old = artificialResponse('multi', 'engineering')
    old.timePoints[0].type = 'event_start'
    old.events.push({ tempId: 'linked-event', title: '入场', description: '已登记工程关系变形', startTimePointTempId: 'd0', endTimePointTempId: null,
      location: null, evidenceIds: ['notice'], confidence: 1, inferenceLevel: 'explicit', selected: true })
    const mapped = await engineering('multi', old)
    mapped.input.tasks[0].detail.timePointTempIds = []
    old.standaloneTasks[0].timePointTempIds = []
    mapped.input.events[0].relatedTaskTempIds = ['submit']; mapped.input.tasks[0].coverage.event = 'present'
    const out = await composeSemantics(mapped.input, mapped.context)
    expect(out.original).toEqual(mapped.input); expect(out.original.events[0].location).toBeNull()
    const bridge = await assessLegacyHandoff(mapped.input, old, mapped.context)
    expect(bridge.eligibleTaskTempIds).toEqual(['print']); expect(bridge.rows[0].reasons).toContain('EVENT_NOT_CONFIRMABLE_IN_V2')
    expect(bridge.legacyResult).toEqual(old)
    const { repo, handle } = await captureResponse(old, notices.multi), before = (await repo.load())!
    expect(confirmationStateV2(before, handle.draftId, 'submit').blockedReason).toBe('CONFIRMATION_V2_EVENT_REQUIRES_SEPARATE_CONFIRMATION')
    await expect(confirmV2(repo, { draftId: handle.draftId, revision: confirmationRevisionV2(before), taskTempIds: ['submit'] }, NOW)).rejects.toThrow('EVENT_REQUIRES_SEPARATE_CONFIRMATION')
    expect(await repo.load()).toEqual(before)
    await confirmV2(repo, { draftId: handle.draftId, revision: confirmationRevisionV2(before), taskTempIds: ['print'] }, NOW)
    const saved = (await repo.load())!
    expect(saved.tasks).toHaveLength(1); expect(saved.tasks[0].legacyData?.recognitionTempId).toBe('print')
    expect(saved.extractionDrafts[0].result!.events).toEqual(old.events)
  })
  it.each(['d0', 'm0', 'linked-event'])('conflict %s affects the associated task, not an independent sibling', async entityId => {
    const old = artificialResponse('multi', 'engineering')
    if (entityId === 'linked-event') {
      old.timePoints[0].type = 'event_start'
      old.events.push({ tempId: entityId, title: '入场', description: '', startTimePointTempId: 'd0', endTimePointTempId: null, location: null,
        evidenceIds: ['notice'], confidence: 1, inferenceLevel: 'explicit' })
    }
    old.conflicts.push({ id: 'bound-conflict', type: 'other', message: '已登记关系冲突', entityTempIds: [entityId], evidenceIds: ['notice'], requiresDecision: true })
    const { input, context } = await engineering('multi', old), result = await composeSemantics(input, context)
    expect(result.items[0].defaultSelected).toBe(false); expect(result.items[1].defaultSelected).toBe(true)
    expect(result.original.conflicts[0].entityTempIds).toEqual([entityId])
  })
  it('shared event time propagates only to its true owners, and array order does not change decisions', async () => {
    const { input, context } = await engineering('multi')
    input.timePoints[0].relatedTaskTempIds.push('print')
    input.events = [{ tempId: 'shared-event', title: '入场', description: '', startTimePointTempId: 'd0', endTimePointTempId: null, location: null,
      scopeIds: context.index.scopes.map(s => s.id), confidence: 1, inferenceLevel: 'explicit', relatedTaskTempIds: ['submit', 'print'] }]
    input.tasks.forEach(t => { t.eventTempIds = ['shared-event']; t.coverage.event = 'present' })
    input.conflicts = [{ id: 'shared', type: 'deadline', message: '已登记共享时间冲突', entityTempIds: ['d0'], scopeIds: [context.index.scopes[0].id], requiresDecision: true }]
    const first = await composeSemantics(input, context)
    input.tasks.reverse(); input.timePoints.reverse(); input.materials.reverse()
    const second = await composeSemantics(input, context)
    expect(first.items.every(i => !i.defaultSelected)).toBe(true)
    expect([...second.items].sort((a, b) => a.tempId.localeCompare(b.tempId))).toEqual([...first.items].sort((a, b) => a.tempId.localeCompare(b.tempId)))
    expect(second.original.events[0].relatedTaskTempIds).toEqual(['submit', 'print'])
  })
  it('seen B8-01/07/09 remain raw unverified candidates, not invented complete 2.0 results', async () => {
    const dataset = JSON.parse(readFileSync('docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json', 'utf8')) as { cases: Array<{ id: string; sourceText: string }> }
    const file = JSON.parse(readFileSync('docs/recognition-optimization/rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a/raw-results.json', 'utf8')) as { records: Array<{ caseId: string; parsed: unknown }> }
    const rows = []
    for (const id of ['rco-task-b8-01', 'rco-task-b8-07', 'rco-task-b8-09']) {
      // Only these two projections leave the read-only result adapter. No Expected/score fields.
      const source = dataset.cases.find(c => c.id === id)!.sourceText, raw = file.records.find(r => r.caseId === id)!.parsed
      const index = await indexImmutableScopesV11('seen-' + id, 'v1', source)
      const envelope: SemanticInput = { schemaVersion: SEMANTIC_VERSION, sourceId: index.sourceId, sourceVersionId: index.sourceVersionId,
        sourceFingerprint: index.sourceFingerprint, tasks: [], materials: [], timePoints: [], events: [], revisions: [], conflicts: [],
        informationScopeIds: [], unresolvedScopeIds: index.scopes.map(s => s.id) }
      const result = await assessLegacyHandoff(envelope, raw, { index, authority: 'seen_model_unverified', referenceTime: NOW, timezone: 'Asia/Shanghai' })
      expect(stableJson(result.originalLegacy)).toBe(stableJson(raw)); expect(result.capture).toBe('REJECT_WHOLE_CAPTURE')
      expect(result.eligibleTaskTempIds).toEqual([]); expect(result.review.original.unresolvedScopeIds).toHaveLength(index.scopes.length)
      rows.push({ id, source, raw, status: 'NOT_SUPPORTED_MISSING_UPSTREAM_SEMANTICS', accuracy: 'NOT_REMEASURED' })
    }
    console.log('MAINLINE04_SEEN_B8=' + JSON.stringify(rows))
  })
})

// R1 additions: the original 49 assertions and fixture mapping above remain unchanged.
describe('MAINLINE-04-I1-R1 registered counterexamples', () => {
  it('R1 revision missing evidence blocks the linked new requirement', async () => {
    const { input, context } = await engineering('revision')
    input.revisions[0].scopeIds = []
    const out = await composeSemantics(input, context)
    expect(out.original).toEqual(input)
    expect(out.items.find(t => t.tempId === 'new')!.defaultSelected).toBe(false)
    expect(out.items.find(t => t.tempId === 'new')!.requiresAction).toBe('unknown')
    expect(out.items.every(t => t.issues.includes('MISSING_EVIDENCE'))).toBe(true)
  })
  it('R1 material difference does not block an independent sibling', async () => {
    const { input, old, context } = await engineering('multi')
    input.materials[0].name += ' changed'
    const handoff = await assessLegacyHandoff(input, old, context)
    expect(handoff.eligibleTaskTempIds).toEqual(['print'])
    expect(handoff.rows.find(r => r.taskId === 'submit')!.reasons).toContain('FULL_ENTITY_DIFFERENCE')
    expect(handoff.legacyResult).toEqual(old)
    expect(handoff.review.original).toEqual(input)
  })
})

describe('MAINLINE-04-I1-R1 revision boundaries', () => {
  it.each(['missing', 'bad-scope', 'unknown', 'valid'] as const)('R1 superseding evidence: %s', async mode => {
    const { input, context } = await engineering('revision')
    if (mode === 'missing') input.revisions[0].scopeIds = []
    if (mode === 'bad-scope') input.revisions[0].scopeIds = ['foreign-scope']
    if (mode === 'unknown') input.revisions[0].effective = 'unknown'
    const first = await composeSemantics(input, context)
    const newItem = first.items.find(t => t.tempId === 'new')!
    expect(first.original).toEqual(input)
    expect(newItem.defaultSelected).toBe(mode === 'valid')
    expect(newItem.requiresAction).toBe(mode === 'valid' ? 'true' : 'unknown')
    if (mode !== 'valid') expect(first.items.every(t => !t.defaultSelected && t.requiresAction === 'unknown')).toBe(true)
    input.tasks.reverse()
    const reordered = await composeSemantics(input, context)
    expect([...reordered.items].sort((a, b) => a.tempId.localeCompare(b.tempId)))
      .toEqual([...first.items].sort((a, b) => a.tempId.localeCompare(b.tempId)))
  })
})

describe('MAINLINE-04-I1-R1 per-task entity comparison', () => {
  it.each(['material', 'time'] as const)('R1 independent %s difference remains local', async kind => {
    const { input, old, context } = await engineering('multi')
    if (kind === 'material') input.materials[0].quantity = 2
    else input.timePoints[0].confidence = 0.5
    const out = await assessLegacyHandoff(input, old, context)
    expect(out.eligibleTaskTempIds).toEqual(['print'])
    expect(out.rows.find(r => r.taskId === 'submit')!.reasons).toContain('FULL_ENTITY_DIFFERENCE')
    expect(out.rows.find(r => r.taskId === 'print')!.reasons).toEqual([])
    expect(out.originalLegacy).toEqual(old); expect(out.review.original).toEqual(input)
  })
  it.each(['material', 'time'] as const)('R1 shared %s difference affects both actual owners', async kind => {
    const old = artificialResponse('multi', 'engineering')
    if (kind === 'material') {
      old.materials[0].relatedTaskTempIds.push('print')
      old.standaloneTasks[1].materialTempIds.push('m0')
    } else {
      old.timePoints[0].relatedTaskTempIds.push('print')
      old.standaloneTasks[1].timePointTempIds.push('d0')
    }
    const { input, context } = await engineering('multi', old)
    if (kind === 'material') input.materials[0].quantity = 2
    else input.timePoints[0].confidence = 0.5
    const out = await assessLegacyHandoff(input, old, context)
    expect(out.rows).toHaveLength(2)
    expect(out.rows.every(r => r.reasons.includes('FULL_ENTITY_DIFFERENCE'))).toBe(true)
    expect(out.eligibleTaskTempIds).toEqual([])
    expect(out.originalLegacy).toEqual(old); expect(out.review.original).toEqual(input)
  })
  it.each(['old-only', 'new-only'] as const)('R1 ownership union includes %s material links', async side => {
    const old = artificialResponse('multi', 'engineering')
    if (side === 'old-only') {
      old.materials[0].relatedTaskTempIds.push('print')
      old.standaloneTasks[1].materialTempIds.push('m0')
    }
    const originalOld = structuredClone(old)
    const mapped = await engineering('multi', old)
    const input = structuredClone(mapped.input), context = mapped.context
    if (side === 'old-only') {
      input.materials[0].relatedTaskTempIds = ['submit']
      input.tasks[1].detail.materialTempIds = ['m1']
    } else {
      input.materials[0].relatedTaskTempIds.push('print')
      input.tasks[1].detail.materialTempIds.push('m0')
    }
    input.materials[0].quantity = 2
    expect(old).toEqual(originalOld)
    expect(old.materials[0].relatedTaskTempIds.includes('print')).toBe(side === 'old-only')
    expect(input.materials[0].relatedTaskTempIds.includes('print')).toBe(side === 'new-only')
    const out = await assessLegacyHandoff(input, old, context)
    expect(out.rows.find(r => r.taskId === 'print')!.reasons).toContain('FULL_ENTITY_DIFFERENCE')
    expect(out.originalLegacy).toEqual(originalOld); expect(out.review.original).toEqual(input)
  })
  it('R1 preserves material-owned time and independent sibling eligibility', async () => {
    const old = artificialResponse('multi', 'engineering')
    old.standaloneTasks[0].timePointTempIds = []
    old.timePoints[0].relatedTaskTempIds = []
    const { input, context } = await engineering('multi', old)
    input.timePoints[0].confidence = 0.5
    const out = await assessLegacyHandoff(input, old, context)
    expect(out.eligibleTaskTempIds).toEqual(['print'])
    expect(out.rows[0].reasons).toContain('FULL_ENTITY_DIFFERENCE')
    expect(out.originalLegacy).toEqual(old); expect(out.review.original).toEqual(input)
  })
  it('R1 reordered task and entity arrays keep both ordinary positive candidates', async () => {
    const { input, old, context } = await engineering('multi')
    const before = await assessLegacyHandoff(input, old, context)
    expect(before.eligibleTaskTempIds).toEqual(['submit', 'print'])
    input.tasks.reverse(); input.materials.reverse(); input.timePoints.reverse()
    const after = await assessLegacyHandoff(input, old, context)
    expect(after.eligibleTaskTempIds.sort()).toEqual(['print', 'submit'])
    expect([...after.rows].sort((a, b) => a.taskId.localeCompare(b.taskId)))
      .toEqual([...before.rows].sort((a, b) => a.taskId.localeCompare(b.taskId)))
    expect(after.originalLegacy).toEqual(old); expect(after.review.original).toEqual(input)
  })
})
// R1 independent review: sharing one material must not transfer all sibling assets.
describe('MAINLINE-04-I1-R1 shared ownership is not a task dependency', () => {
  it.each(['equivalent', 'private-material', 'private-time', 'shared-material'] as const)('R1 shared material with independent deadlines: %s', async mode => {
    const old = artificialResponse('multi', 'engineering')
    old.materials[0].relatedTaskTempIds.push('print')
    old.standaloneTasks[1].materialTempIds.push('m0')
    old.timePoints.forEach(time => { time.relatedMaterialTempIds = [] })
    const { input, context } = await engineering('multi', old)
    if (mode === 'private-material') input.materials[1].quantity = 2
    if (mode === 'private-time') input.timePoints[1].confidence = 0.5
    if (mode === 'shared-material') input.materials[0].quantity = 2
    const out = await assessLegacyHandoff(input, old, context)
    expect(out.review.items.every(item => !item.issues.includes('MULTIPLE_DEADLINES'))).toBe(true)
    expect(out.eligibleTaskTempIds).toEqual(mode === 'equivalent' ? ['submit', 'print'] : mode === 'shared-material' ? [] : ['submit'])
    if (mode === 'shared-material') expect(out.rows.every(row => row.reasons.includes('FULL_ENTITY_DIFFERENCE'))).toBe(true)
    if (mode === 'private-material' || mode === 'private-time') {
      expect(out.rows.find(row => row.taskId === 'print')!.reasons).toContain('FULL_ENTITY_DIFFERENCE')
      expect(out.rows.find(row => row.taskId === 'submit')!.reasons).toEqual([])
    }
    expect(out.originalLegacy).toEqual(old); expect(out.review.original).toEqual(input)
    input.tasks.reverse()
    const reordered = await assessLegacyHandoff(input, old, context)
    expect([...reordered.rows].sort((a, b) => a.taskId.localeCompare(b.taskId)))
      .toEqual([...out.rows].sort((a, b) => a.taskId.localeCompare(b.taskId)))
  })
})
