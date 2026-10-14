import { describe, expect, it } from 'vitest'
import { ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION } from './actionCandidateClassificationContract'
import { composeActionCandidatesV2 } from './actionCandidateComposerV2'
import { formCandidateSafeTaskSuggestionsV2, validateCandidateSafeTaskSuggestionsV2 } from './candidateTaskSafetyPolicyV2'
import { indexLocalActionCandidatesV2 } from './localActionCandidateIndexV2'
import { indexImmutableScopesV11 } from './scopeIndexV11'

async function inputs(text: string) {
  const index = await indexImmutableScopesV11('e1-boundary', 'v1', text)
  const catalog = await indexLocalActionCandidatesV2(index)
  const response = {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: 'offline-fixture',
    classifications: catalog.candidates.map((candidate) => ({
      candidateId: candidate.id,
      verdict: 'proposition' as const,
      objectCandidateId: candidate.objectCandidates[0]?.id ?? null,
    })),
  }
  const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
  if (!composition.ok) throw new Error('BOUNDARY_FIXTURE_COMPOSITION_FAILED')
  return { index, catalog, composition: composition.value }
}

describe('RCO-5-010 E1 whole sentence force', () => {
  it.each(['，', ',', '；', ';', '\n'])('preserves an independent command after a question ending with %j', async (separator) => {
    const data = await inputs(`请核对乙表吗${separator}请保存甲表。`)
    const pipeline = await formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
    expect(pipeline.result.tasks.map((task) => task.object.surface)).toEqual(['甲表'])
    expect(pipeline.result.tasks[0].selected).toBe(true)
    expect(pipeline.result.requiresAction).toBe(true)
  })

  it('does not turn either alternative in a compound question into a selected command', async () => {
    const data = await inputs('请核对乙表吗，还是先保存甲表？')
    const pipeline = await formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
    expect(pipeline.result.tasks.filter((task) => task.selected)).toEqual([])
    expect(pipeline.result.requiresAction).toBeNull()
  })

  it.each(['必须', '应该', '需要', '要求', '请'])('quarantines unproved reported governor %s before old policy can promote it', async (marker) => {
    const data = await inputs(`报告记录${marker}核对材料。`)
    const pipeline = await formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
    expect(pipeline.result.tasks).toEqual([])
    expect(pipeline.result.requiresAction).toBeNull()
  })

  it.each(['\n', '\r\n', '，', '，  '])('does not let a later question quarantine the earlier independent command across %j', async (separator) => {
    const data = await inputs(`请保存甲表${separator}请核对乙表吗？`)
    const pipeline = await formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
    expect(pipeline.result.tasks.map((task) => task.object.surface)).toEqual(['甲表'])
    expect(pipeline.result.tasks[0].selected).toBe(true)
    expect(pipeline.result.requiresAction).toBe(true)
    expect(pipeline.result.actionabilityDecision.unresolvedCandidateIds).toHaveLength(1)
  })

  it.each(['保存', '打印', '核对'])('blocks reported/question/nominalized %s but preserves independent commands', async (action) => {
    for (const text of [
      `报告写明：请${action}材料。`,
      `问题是：请${action}材料吗？`,
      `请${action}材料吗？`,
      `申请人要求${action}结果尚未说明。`,
      `请${action}结果尚未说明。`,
    ]) {
      const data = await inputs(text)
      const pipeline = await formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
      expect(pipeline.result.requiresAction, text).toBeNull()
      expect(pipeline.result.tasks.filter((task) => task.selected), text).toEqual([])
      expect(pipeline.result.actionabilityDecision.unresolvedCandidateIds.length, text).toBeGreaterThan(0)
    }
    const data = await inputs(`报告写明：请${action}旧材料。请${action}新材料。`)
    const pipeline = await formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
    expect(pipeline.result.tasks.map((task) => task.object.surface)).toEqual(['新材料'])
    expect(pipeline.result.requiresAction).toBe(true)
    expect(pipeline.result.tasks[0].selected).toBe(true)
  })

  it.each(['请核对材料。', '请在申请材料中核对名单。', '申请人请核对材料。'])('retains proved real commands: %s', async (text) => {
    const data = await inputs(text)
    const pipeline = await formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
    expect(pipeline.result.requiresAction).toBe(true)
    expect(pipeline.result.tasks.some((task) => task.selected)).toBe(true)
  })
})

describe('RCO-5-010 E1 independent source reconstruction', () => {
  it.each(['object', 'action', 'condition', 'scope', 'source', 'sparse-catalog', 'sparse-scope'] as const)('rejects input tampering before formation and in independent validation: %s', async (kind) => {
    const data = await inputs('请核对材料。')
    const original = await formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
    if (kind === 'object') data.catalog.candidates[0].objectCandidates[0].surface = '全部档案'
    if (kind === 'action') data.catalog.candidates[0].action.surface = '发送'
    if (kind === 'condition') data.catalog.candidates[0].conditionAttachment.truth = 'true'
    if (kind === 'scope') data.index.scopes[0].text = '请核对全部档案。'
    if (kind === 'source') data.index.sourceContent = '请核对全部档案。'
    if (kind === 'sparse-catalog') delete data.catalog.candidates[0]
    if (kind === 'sparse-scope') delete data.index.scopes[0]
    await expect(formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)).rejects.toThrow(/RCO5010_/u)
    expect(await validateCandidateSafeTaskSuggestionsV2(original, data.index, data.catalog, data.composition)).not.toEqual([])
  })

  it('captures inputs before asynchronous hashing instead of using mutated caller objects', async () => {
    const data = await inputs('请核对材料。')
    const pending = formCandidateSafeTaskSuggestionsV2(data.index, data.catalog, data.composition)
    data.catalog.candidates[0].objectCandidates[0].surface = '全部档案'
    data.index.sourceContent = '请核对全部档案。'
    const pipeline = await pending
    expect(pipeline.result.tasks.map((task) => task.object.surface)).toEqual(['材料'])
  })
})
