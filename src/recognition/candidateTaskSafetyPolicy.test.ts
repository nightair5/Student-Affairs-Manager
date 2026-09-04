import { describe, expect, it } from 'vitest'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  type ActionCandidateClassificationResponse,
} from './actionCandidateClassificationContract'
import { composeActionCandidatesV2 } from './actionCandidateComposerV2'
import { formCandidateSafeTaskSuggestions, validateCandidateSafeTaskSuggestions } from './candidateTaskSafetyPolicy'
import { indexLocalActionCandidatesV2 } from './localActionCandidateIndexV2'
import { indexImmutableScopesV11 } from './scopeIndexV11'

async function fixture(sourceText: string) {
  const index = await indexImmutableScopesV11('p5-adversarial-source', 'source-v1', sourceText)
  const catalog = await indexLocalActionCandidatesV2(index)
  const response: ActionCandidateClassificationResponse = {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: 'p5-adversarial-run',
    classifications: catalog.candidates.map((candidate) => candidate.localDisposition === 'local_non_task'
      ? { candidateId: candidate.id, verdict: 'mention_only', objectCandidateId: null }
      : candidate.objectCandidates[0]
        ? { candidateId: candidate.id, verdict: 'proposition', objectCandidateId: candidate.objectCandidates[0].id }
        : { candidateId: candidate.id, verdict: 'uncertain', objectCandidateId: null }),
  }
  const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
  expect(composition.ok).toBe(true)
  if (!composition.ok) throw new Error('TEST_COMPOSITION_FAILED')
  const formed = formCandidateSafeTaskSuggestions(index, catalog, composition.value)
  expect(validateCandidateSafeTaskSuggestions(formed, index, catalog, composition.value)).toEqual([])
  return { index, catalog, response, composition: composition.value, formed }
}

describe('candidate-bound independent semantic and safety policy', () => {
  it('does not select a completed fact or a system-owned action as the user task', async () => {
    const { formed } = await fixture('材料已保存。系统需要保存审计日志。')
    expect(formed.requiresAction).toBe(false)
    expect(formed.tasks).toHaveLength(2)
    expect(formed.tasks[0]).toMatchObject({ semantics: { tense: 'past', status: 'completed' }, selected: false })
    expect(formed.tasks[1]).toMatchObject({ semantics: { actor: 'third_party' }, selected: false })
  })

  it('keeps forwarded and cross-scope code examples outside the task lane', async () => {
    for (const sourceText of ['群里转发：“请保存旧表”并非本次要求。', '代码示例：请保存配置。']) {
      const { formed } = await fixture(sourceText)
      expect(formed.tasks, sourceText).toEqual([])
      expect(formed.requiresAction, sourceText).toBe(false)
    }
  })

  it('reports unknown rather than false when an action is outside the controlled vocabulary', async () => {
    for (const sourceText of ['领取纪念品。', '请取消明天的会议预约。', '请停止执行数据同步。']) {
      const { formed } = await fixture(sourceText)
      expect(formed.tasks, sourceText).toEqual([])
      expect(formed.requiresAction, sourceText).toBeNull()
      expect(formed.semanticCoverageComplete, sourceText).toBe(false)
    }
  })

  it('applies a false condition to every coordinated action', async () => {
    const { formed } = await fixture('如果材料缺失，请联系老师，并保存说明。目前材料并未缺失。')
    expect(formed.tasks.map((task) => task.action.surface)).toEqual(['联系', '保存'])
    expect(formed.tasks.every((task) => task.semantics.speechAct === 'hypothetical' && task.semantics.validity === 'uncertain')).toBe(true)
    expect(formed.tasks.every((task) => !task.selected)).toBe(true)
    expect(formed.requiresAction).toBe(false)
  })

  it('still selects a locally safe task when its adjacent condition is proved true', async () => {
    const { formed } = await fixture('如果清单缺页，请保存补页记录。当前清单缺页。')
    expect(formed.tasks).toHaveLength(1)
    expect(formed.tasks[0]).toMatchObject({ action: { surface: '保存' }, selected: true })
    expect(formed.requiresAction).toBe(true)
  })

  it('never lets candidate quarantine increase revision certainty', async () => {
    const baseline = await fixture('旧任务保存甲表。原任务核对乙表。上述任务取消。')
    expect(baseline.formed.revisionRelations).toEqual([])
    expect(baseline.formed.unresolvedRevisionScopeIds).toEqual([baseline.index.scopes[2].id])

    const response = structuredClone(baseline.response)
    response.classifications[1] = {
      candidateId: baseline.catalog.candidates[1].id,
      verdict: 'uncertain',
      objectCandidateId: null,
    }
    const composition = await composeActionCandidatesV2(baseline.index, baseline.catalog, response, response.producerRunId)
    expect(composition.ok).toBe(true)
    if (!composition.ok) return
    const quarantined = formCandidateSafeTaskSuggestions(baseline.index, baseline.catalog, composition.value)
    expect(quarantined.revisionRelations).toEqual([])
    expect(quarantined.unresolvedRevisionScopeIds).toEqual([baseline.index.scopes[2].id])
    expect(quarantined.revisionCoverageComplete).toBe(false)
  })

  it('does not let an unresolved historical revision block a later independent current task', async () => {
    const { formed, index } = await fixture('旧任务保存甲表。原任务核对乙表。上述任务取消。请保存丙表。')
    expect(formed.unresolvedRevisionScopeIds).toEqual([index.scopes[2].id])
    expect(formed.tasks.slice(0, 2).every((task) => task.currentness === 'historical' && !task.selected)).toBe(true)
    expect(formed.tasks[2]).toMatchObject({
      action: { surface: '保存' },
      object: { surface: '丙表' },
      currentness: 'current',
      selected: true,
    })
    expect(formed.requiresAction).toBe(true)
  })

  it('preserves adjacent real actions for bounded model classification', async () => {
    for (const sourceText of ['请报名参加比赛。', '请准备提交申请材料。']) {
      const { formed } = await fixture(sourceText)
      expect(formed.tasks.map((task) => task.action.surface), sourceText).toHaveLength(2)
    }
  })

  it('restores the exact owned object instead of letting downstream normalization rewrite it', async () => {
    const { formed } = await fixture('请保存已经核对的记录。')
    expect(formed.tasks).toHaveLength(1)
    expect(formed.tasks[0].object.surface).toBe('已经核对的记录')
  })

  it('reports an injected unknown response ID without letting it erase an independent local default', async () => {
    const current = await fixture('请保存值班记录。')
    const response = structuredClone(current.response)
    response.classifications.push({ candidateId: 'action:injected', verdict: 'proposition', objectCandidateId: current.catalog.candidates[0].defaultObjectCandidateId })
    const composition = await composeActionCandidatesV2(current.index, current.catalog, response, response.producerRunId)
    expect(composition.ok).toBe(true)
    if (!composition.ok) return
    const formed = formCandidateSafeTaskSuggestions(current.index, current.catalog, composition.value)
    expect(formed.responseContractComplete).toBe(false)
    expect(formed.semanticCoverageComplete).toBe(false)
    expect(formed.tasks[0].selected).toBe(true)
    expect(formed.requiresAction).toBe(true)
  })

  it('quarantines one uncertain candidate without changing an independent safe sibling', async () => {
    const current = await fixture('请保存甲表。核对乙表。')
    const response = structuredClone(current.response)
    response.classifications[1] = {
      candidateId: current.catalog.candidates[1].id,
      verdict: 'uncertain',
      objectCandidateId: null,
    }
    const composition = await composeActionCandidatesV2(current.index, current.catalog, response, response.producerRunId)
    expect(composition.ok).toBe(true)
    if (!composition.ok) return
    const formed = formCandidateSafeTaskSuggestions(current.index, current.catalog, composition.value)
    expect(composition.value.status).toBe('partial')
    expect(formed.tasks.map((task) => [task.action.surface, task.object.surface, task.selected])).toEqual([
      ['保存', '甲表', true],
    ])
    expect(formed.requiresAction).toBe(true)
  })

  it('fails closed if an accepted ledger entry loses its owned object binding', async () => {
    const current = await fixture('请保存值班记录。')
    const tampered = structuredClone(current.composition)
    tampered.ledger[0].objectCandidateId = 'object:missing'
    expect(() => formCandidateSafeTaskSuggestions(current.index, current.catalog, tampered)).toThrow('P5_ACCEPTED_CANDIDATE_BINDING_NOT_BIJECTIVE')
  })

  it('keeps a historical requirement visible without calling it a current task', async () => {
    const { formed } = await fixture('旧通知要求保存纸质回执。')
    expect(formed.tasks).toHaveLength(1)
    expect(formed.tasks[0]).toMatchObject({
      action: { surface: '保存' },
      object: { surface: '纸质回执' },
      clauseRole: 'directive',
      currentness: 'historical',
      semantics: { tense: 'past', status: 'unknown', validity: 'uncertain' },
      selected: false,
      needsConfirmation: true,
    })
    expect(formed.requiresAction).toBe(false)
  })

  it('does not turn the condition antecedent into a task and preserves unknown actionability', async () => {
    const { formed } = await fixture('如果已保存草稿，请核对编号。')
    expect(formed.tasks).toHaveLength(1)
    expect(formed.tasks[0]).toMatchObject({
      action: { surface: '核对' },
      object: { surface: '编号' },
      conditionTruth: 'unknown',
      selected: false,
    })
    expect(formed.requiresAction).toBeNull()
  })

  it('uses same-scope condition evidence to allow a proved safe task', async () => {
    const { index, formed } = await fixture('如果材料缺失请保存说明。当前材料缺失。')
    expect(formed.tasks).toHaveLength(1)
    expect(formed.tasks[0]).toMatchObject({
      action: { surface: '保存' },
      object: { surface: '说明' },
      conditionTruth: 'true',
      selected: true,
    })
    expect(formed.tasks[0].propositionScopeIds).toEqual(index.scopes.map((scope) => scope.id))
    expect(formed.requiresAction).toBe(true)
  })

  it('materializes repeated actions directly from their own occurrence and object IDs', async () => {
    const { formed } = await fixture('请核对甲表再核对乙表。')
    expect(formed.tasks.map((task) => [task.action.surface, task.object.surface])).toEqual([
      ['核对', '甲表'],
      ['核对', '乙表'],
    ])
    expect(new Set(formed.tasks.map((task) => task.originCandidateId)).size).toBe(2)
    expect(new Set(formed.tasks.map((task) => task.id)).size).toBe(2)
    expect(formed.tasks.every((task) => task.id === `task:${task.originCandidateId}`)).toBe(true)
    expect(formed.tasks.every((task) => task.selected)).toBe(true)
    expect(formed.requiresAction).toBe(true)
  })
})
