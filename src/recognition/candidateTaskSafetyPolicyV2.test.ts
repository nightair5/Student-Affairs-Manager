import { describe, expect, it } from 'vitest'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  type ActionCandidateClassificationResponse,
  type ActionCandidateVerdict,
} from './actionCandidateClassificationContract'
import { composeActionCandidatesV2 } from './actionCandidateComposerV2'
import { formCandidateSafeTaskSuggestions } from './candidateTaskSafetyPolicy'
import {
  formCandidateSafeTaskSuggestionsV2,
  validateCandidateSafeTaskSuggestionsV2,
  type CandidateTaskSafetyPipelineV2,
} from './candidateTaskSafetyPolicyV2'
import { indexLocalActionCandidatesV2 } from './localActionCandidateIndexV2'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { deriveThreeValuedActionability } from './threeValuedActionability'

async function fixture(
  sourceText: string,
  verdictForAction: Record<string, ActionCandidateVerdict> = {},
): Promise<CandidateTaskSafetyPipelineV2> {
  const index = await indexImmutableScopesV11(`rco5010-${sourceText}`, 'source-v1', sourceText)
  const catalog = await indexLocalActionCandidatesV2(index)
  const response: ActionCandidateClassificationResponse = {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: 'rco5010-test-run',
    classifications: catalog.candidates.map((candidate) => {
      const verdict = verdictForAction[candidate.action.surface]
        ?? (candidate.localDisposition === 'local_non_task' ? 'mention_only' : 'proposition')
      return verdict === 'proposition' && candidate.objectCandidates[0]
        ? { candidateId: candidate.id, verdict, objectCandidateId: candidate.objectCandidates[0].id }
        : { candidateId: candidate.id, verdict: verdict === 'proposition' ? 'uncertain' : verdict, objectCandidateId: null }
    }),
  }
  const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
  expect(composition.ok).toBe(true)
  if (!composition.ok) throw new Error('RCO5010_TEST_COMPOSITION_FAILED')
  const pipeline = await formCandidateSafeTaskSuggestionsV2(index, catalog, composition.value)
  expect(await validateCandidateSafeTaskSuggestionsV2(pipeline, index, catalog, composition.value)).toEqual([])
  return pipeline
}

describe('RCO-5-010 full proposition and three-valued actionability', () => {
  it('keeps the ambiguous B9-shaped sentence unknown instead of forcing a frozen label', async () => {
    const pipeline = await fixture('核对蓝色门签是否属于该流程尚未说明。')
    expect(pipeline.result.tasks).toHaveLength(1)
    expect(pipeline.result.tasks[0].selected).toBe(false)
    expect(pipeline.result.requiresAction).toBeNull()
    expect(pipeline.result.fullPropositionAdjudication.judgments[0]).toMatchObject({
      outcome: 'no_override',
      actionabilityAtom: 'none',
      matrixPredicate: '尚未说明',
    })
  })

  it('can prove a reporting-governed action is embedded content', async () => {
    const pipeline = await fixture('报告记录核对名单的结果仍不明确。')
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBe(false)
    expect(pipeline.result.fullPropositionAdjudication.judgments[0]).toMatchObject({
      outcome: 'confirmed_non_task',
      actionabilityAtom: 'definitely_not_required',
      matrixPredicate: '仍不明确',
    })
  })

  it('keeps explicit uncertainty about whether a duty exists as null', async () => {
    const pipeline = await fixture('是否需要核对蓝色门签尚未说明。')
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBeNull()
    expect(pipeline.result.actionabilityDecision.proof).toBe('UNRESOLVED_POTENTIAL_OBLIGATION')
    expect(pipeline.result.fullPropositionAdjudication.genuinelyUnknownCandidateIds).toHaveLength(1)
  })

  it.each([
    '通知尚未说明是否需要核对名单。',
    '是否必须检查申请表仍未明确。',
    '请问是否需要保存值班记录。',
    '是否需要打印回执尚未说明。',
    '是否需要提交纸质版仍不清楚。',
  ])('does not turn an action mentioned inside an unresolved duty question into a task: %s', async (sourceText) => {
    const pipeline = await fixture(sourceText)
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBeNull()
    expect(pipeline.result.actionabilityDecision.unresolvedCandidateIds.length).toBeGreaterThan(0)
  })

  it('can prove a reported question is not a current duty', async () => {
    const pipeline = await fixture('有人询问是否需要核对名单；这不是正式安排。')
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBe(false)
    expect(pipeline.result.fullPropositionAdjudication.confirmedNonTaskCandidateIds).toHaveLength(1)
    expect(pipeline.result.fullPropositionAdjudication.resolvedNonActionScopeIds).toHaveLength(1)
  })

  it.each([
    '申请材料核对结果尚未说明。',
    '邀请记录核对结果仍不明确。',
    '请假流程核对结果尚不清楚。',
    '请柬核对结果尚未说明。',
    '请帖核对结果仍不明确。',
  ])('uses the full nominalized proposition instead of treating an internal 请 as a directive: %s', async (sourceText) => {
    const pipeline = await fixture(sourceText)
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBe(false)
    expect(pipeline.result.fullPropositionAdjudication.confirmedNonTaskCandidateIds.length).toBeGreaterThan(0)
  })

  it.each([
    '请核对材料。',
    '申请人请核对材料。',
    '请于周五前核对材料。',
    '请各位同学认真核对材料。',
  ])('recognizes 请 only when a complete positive grammar proves it governs the action: %s', async (sourceText) => {
    const pipeline = await fixture(sourceText)
    expect(pipeline.result.tasks.map((task) => task.action.surface)).toEqual(['核对'])
    expect(pipeline.result.requiresAction).toBe(true)
  })

  it.each([
    '请求核对名单。',
    '请柬核对名单。',
    '聘请人员核对名单。',
  ])('keeps an unproved 请-to-action relationship unknown and unselected: %s', async (sourceText) => {
    const pipeline = await fixture(sourceText)
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBeNull()
    expect(pipeline.result.fullPropositionAdjudication.judgments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        outcome: 'unresolved_task_force',
        actionabilityAtom: 'genuinely_unknown',
        directiveGovernorProof: expect.objectContaining({ governed: false, proof: 'NOT_PROVEN' }),
      }),
    ]))
  })

  it.each([
    '请在请假后核对材料。',
    '请在申请材料中核对名单。',
  ])('does not let a later word-internal 请 shadow an earlier real command: %s', async (sourceText) => {
    const pipeline = await fixture(sourceText)
    expect(pipeline.result.tasks.map((task) => task.action.surface)).toEqual(['核对'])
    expect(pipeline.result.requiresAction).toBe(true)
  })

  it('keeps a directive embedded in an outer reported question unknown and unselected', async () => {
    const pipeline = await fixture('老师问：请核对材料吗？')
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBeNull()
    expect(pipeline.result.fullPropositionAdjudication.judgments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        outcome: 'unresolved_task_force',
        actionabilityAtom: 'genuinely_unknown',
        reasons: expect.arrayContaining(['OUTER_SENTENCE_FORCE_NOT_PROVEN']),
      }),
    ]))
  })

  it('does not accept a multi-character governor without a proved left-side grammar', async () => {
    const pipeline = await fixture('申请要求核对结果尚未说明。')
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBe(false)
    expect(pipeline.result.fullPropositionAdjudication.confirmedNonTaskCandidateIds.length).toBeGreaterThan(0)
  })

  it.each([
    { action: '保存', question: '是否需要保存值班记录尚未说明。', directive: '请保存值班记录。' },
    { action: '打印', question: '是否需要打印报名回执尚未说明。', directive: '请打印报名回执。' },
    { action: '提交', question: '是否需要提交纸质版尚未说明。', directive: '请提交纸质版。' },
  ])('changes with the governing proposition instead of the action word: $action', async ({ action, question, directive }) => {
    const unresolved = await fixture(question)
    const required = await fixture(directive)
    expect(unresolved.result.tasks.some((task) => task.action.surface === action)).toBe(false)
    expect(unresolved.result.requiresAction).toBeNull()
    expect(required.result.tasks.some((task) => task.action.surface === action)).toBe(true)
    expect(required.result.requiresAction).toBe(true)
  })

  it.each([
    '请核对蓝色门签是否属于该流程。',
    '通知尚未说明，请核对蓝色门签。',
    '必须核对结果，说明尚未补充。',
  ])('does not let an information word swallow a governed directive: %s', async (sourceText) => {
    const pipeline = await fixture(sourceText)
    expect(pipeline.result.tasks.some((task) => task.action.surface === '核对')).toBe(true)
    expect(pipeline.result.requiresAction).toBe(true)
  })

  it('keeps only the outer directive when another action is embedded under its question', async () => {
    const pipeline = await fixture('请确认是否需要核对蓝色门签。')
    expect(pipeline.result.tasks.map((task) => task.action.surface)).toEqual(['确认'])
    expect(pipeline.result.requiresAction).toBe(true)
    expect(pipeline.result.fullPropositionAdjudication.confirmedNonTaskCandidateIds).toHaveLength(1)
  })

  it('preserves coordinated matrix actions and their separate objects', async () => {
    const pipeline = await fixture('请核对材料是否齐全，并保存结果。')
    expect(pipeline.result.tasks.map((task) => task.action.surface)).toEqual(['核对', '保存'])
    expect(pipeline.result.requiresAction).toBe(true)
  })

  it('keeps an unfinished-action sentence unknown instead of treating 尚未 as a non-task switch', async () => {
    const pipeline = await fixture('核对工作尚未完成。')
    expect(pipeline.result.fullPropositionAdjudication.confirmedNonTaskCandidateIds).toEqual([])
    expect(pipeline.result.requiresAction).toBeNull()
    expect(pipeline.result.tasks.some((task) => task.action.surface === '核对')).toBe(true)
    expect(pipeline.result.tasks.length).toBeGreaterThan(0)
    expect(pipeline.result.tasks.every((task) => task.selected === false)).toBe(true)
  })

  it('keeps a real external obligation true even though safety leaves it unselected', async () => {
    const pipeline = await fixture('请发送值班名单。')
    expect(pipeline.result.tasks).toHaveLength(1)
    expect(pipeline.result.tasks[0]).toMatchObject({ selected: false, effect: 'external_transfer' })
    expect(pipeline.result.requiresAction).toBe(true)
  })

  it('reduces required plus unknown to true without deleting the unknown sibling', async () => {
    const pipeline = await fixture('请保存甲表。核对乙表。', { 核对: 'uncertain' })
    expect(pipeline.result.requiresAction).toBe(true)
    expect(pipeline.result.actionabilityDecision.candidateAtoms.map((item) => item.atom)).toEqual([
      'definitely_required',
      'genuinely_unknown',
    ])
    expect(pipeline.result.tasks.map((task) => task.object.surface)).toEqual(['甲表'])
  })

  it.each([
    '旧通知要求保存纸质回执。',
    '材料已保存。',
    '系统需要保存审计日志。',
    '如果材料缺失，请保存说明。目前材料并未缺失。',
    '可以自行保存练习记录。',
  ])('returns false only after the candidate is proved non-current or non-required: %s', async (sourceText) => {
    const pipeline = await fixture(sourceText)
    expect(pipeline.result.requiresAction).toBe(false)
    expect(pipeline.result.actionabilityDecision.proof).toBe('ALL_POTENTIAL_OBLIGATIONS_EXCLUDED')
  })

  it('keeps a condition with no matching fact unknown', async () => {
    const pipeline = await fixture('如果材料缺失，请保存说明。')
    expect(pipeline.result.requiresAction).toBeNull()
    expect(pipeline.result.actionabilityDecision.unresolvedCandidateIds).toHaveLength(1)
  })

  it.each([
    { sourceText: '如果材料缺失，请保存说明。目前材料缺失。', expected: true, truth: 'true' },
    { sourceText: '如果材料缺失，请保存说明。目前材料并未缺失。', expected: false, truth: 'false' },
    { sourceText: '如果材料缺失，请保存说明。', expected: null, truth: 'unknown' },
  ] as const)('derives the same conditional task from condition truth $truth', async ({ sourceText, expected, truth }) => {
    const pipeline = await fixture(sourceText)
    expect(pipeline.result.requiresAction).toBe(expected)
    expect(pipeline.result.tasks.find((task) => task.action.surface === '保存')?.conditionTruth).toBe(truth)
  })

  it('keeps an invalidated old duty for audit while activating only the replacement', async () => {
    const pipeline = await fixture('先前规定须发送旧清单。该规定已经作废。从现在起，请核对新清单。')
    const oldTask = pipeline.result.tasks.find((task) => task.action.surface === '发送')
    const replacement = pipeline.result.tasks.find((task) => task.action.surface === '核对')
    expect(oldTask).toMatchObject({ selected: false, semantics: { status: 'cancelled', validity: 'superseded' } })
    expect(replacement).toMatchObject({ selected: true, semantics: { status: 'pending', validity: 'active' } })
    expect(pipeline.result.requiresAction).toBe(true)
  })

  it('does not consume selected when deriving actionability', async () => {
    const sourceText = '请发送值班名单。'
    const index = await indexImmutableScopesV11(`rco5010-${sourceText}`, 'source-v1', sourceText)
    const catalog = await indexLocalActionCandidatesV2(index)
    const response: ActionCandidateClassificationResponse = {
      schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
      sourceId: catalog.sourceId,
      sourceVersionId: catalog.sourceVersionId,
      sourceFingerprint: catalog.sourceFingerprint,
      catalogFingerprint: catalog.catalogFingerprint,
      producerRunId: 'rco5010-selected-independence',
      classifications: catalog.candidates.map((candidate) => ({
        candidateId: candidate.id,
        verdict: 'proposition',
        objectCandidateId: candidate.objectCandidates[0]?.id ?? null,
      })),
    }
    const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
    expect(composition.ok).toBe(true)
    if (!composition.ok) return
    const pipeline = await formCandidateSafeTaskSuggestionsV2(index, catalog, composition.value)
    const originalBase = formCandidateSafeTaskSuggestions(index, catalog, pipeline.composition)
    const changedBase = structuredClone(originalBase)
    changedBase.tasks[0].selected = !changedBase.tasks[0].selected
    const original = deriveThreeValuedActionability(index, catalog, pipeline.composition, originalBase, pipeline.result.fullPropositionAdjudication)
    const changed = deriveThreeValuedActionability(index, catalog, pipeline.composition, changedBase, pipeline.result.fullPropositionAdjudication)
    expect(changed).toEqual(original)
    expect(changed.selectedFieldConsumed).toBe(false)
  })

  it('detects tampered actionability instead of letting it self-certify', async () => {
    const sourceText = '请保存值班记录。'
    const index = await indexImmutableScopesV11(`rco5010-${sourceText}`, 'source-v1', sourceText)
    const catalog = await indexLocalActionCandidatesV2(index)
    const response: ActionCandidateClassificationResponse = {
      schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
      sourceId: catalog.sourceId,
      sourceVersionId: catalog.sourceVersionId,
      sourceFingerprint: catalog.sourceFingerprint,
      catalogFingerprint: catalog.catalogFingerprint,
      producerRunId: 'rco5010-tamper-test',
      classifications: catalog.candidates.map((candidate) => ({ candidateId: candidate.id, verdict: 'proposition', objectCandidateId: candidate.objectCandidates[0]?.id ?? null })),
    }
    const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
    expect(composition.ok).toBe(true)
    if (!composition.ok) return
    const pipeline = await formCandidateSafeTaskSuggestionsV2(index, catalog, composition.value)
    const tampered = structuredClone(pipeline)
    tampered.result.requiresAction = false
    tampered.result.actionabilityDecision.value = false
    expect(await validateCandidateSafeTaskSuggestionsV2(tampered, index, catalog, composition.value)).toContain('ACTIONABILITY_DECISION_NOT_DERIVED')
  })

  it('detects a task removed through a sparse array hole', async () => {
    const sourceText = '请保存值班记录。'
    const index = await indexImmutableScopesV11(`rco5010-${sourceText}`, 'source-v1', sourceText)
    const catalog = await indexLocalActionCandidatesV2(index)
    const response: ActionCandidateClassificationResponse = {
      schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
      sourceId: catalog.sourceId,
      sourceVersionId: catalog.sourceVersionId,
      sourceFingerprint: catalog.sourceFingerprint,
      catalogFingerprint: catalog.catalogFingerprint,
      producerRunId: 'rco5010-sparse-array-tamper',
      classifications: catalog.candidates.map((candidate) => ({
        candidateId: candidate.id,
        verdict: 'proposition',
        objectCandidateId: candidate.objectCandidates[0]?.id ?? null,
      })),
    }
    const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
    expect(composition.ok).toBe(true)
    if (!composition.ok) return
    const pipeline = await formCandidateSafeTaskSuggestionsV2(index, catalog, composition.value)
    const tampered = structuredClone(pipeline)
    delete tampered.result.tasks[0]
    expect(tampered.result.tasks).toHaveLength(1)
    expect(await validateCandidateSafeTaskSuggestionsV2(tampered, index, catalog, composition.value)).toContain('RCO5010_PIPELINE_RESULT_NOT_DERIVED')
  })

  it('detects sparse-array tampering in derived evidence arrays', async () => {
    const sourceText = '请保存值班记录。'
    const index = await indexImmutableScopesV11(`rco5010-${sourceText}`, 'source-v1', sourceText)
    const catalog = await indexLocalActionCandidatesV2(index)
    const response: ActionCandidateClassificationResponse = {
      schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
      sourceId: catalog.sourceId,
      sourceVersionId: catalog.sourceVersionId,
      sourceFingerprint: catalog.sourceFingerprint,
      catalogFingerprint: catalog.catalogFingerprint,
      producerRunId: 'rco5010-sparse-evidence-tamper',
      classifications: catalog.candidates.map((candidate) => ({
        candidateId: candidate.id,
        verdict: 'proposition',
        objectCandidateId: candidate.objectCandidates[0]?.id ?? null,
      })),
    }
    const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
    expect(composition.ok).toBe(true)
    if (!composition.ok) return
    const pipeline = await formCandidateSafeTaskSuggestionsV2(index, catalog, composition.value)

    const adjudicationTamper = structuredClone(pipeline)
    delete adjudicationTamper.result.fullPropositionAdjudication.judgments[0]
    expect(await validateCandidateSafeTaskSuggestionsV2(adjudicationTamper, index, catalog, composition.value)).toContain('ADJUDICATED_COMPOSITION_NOT_DERIVED')

    const actionabilityTamper = structuredClone(pipeline)
    delete actionabilityTamper.result.actionabilityDecision.candidateAtoms[0]
    expect(await validateCandidateSafeTaskSuggestionsV2(actionabilityTamper, index, catalog, composition.value)).toContain('ACTIONABILITY_DECISION_NOT_DERIVED')
  })
})
