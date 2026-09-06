import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { artificialResponse, notices, NOW } from '../mainline01/fixtures'
import { SEMANTIC_VERSION } from './semanticContract'
import type { SemanticInput } from './semanticContract'
import { assessLegacyHandoff } from './legacyHandoff'
import type { ComposeContext } from './semanticComposer'

async function ordinary() {
  const index = await indexImmutableScopesV11('test-source', 'v1', notices['no-date'])
  const old = artificialResponse('no-date', index.sourceId), task = old.standaloneTasks[0]
  const { tempId, actionVerb, actionObject, inferenceLevel, evidenceIds: evidence, selected, ...detail } = task
  void evidence; void selected
  const input: SemanticInput = { schemaVersion: SEMANTIC_VERSION, sourceId: index.sourceId, sourceVersionId: index.sourceVersionId, sourceFingerprint: index.sourceFingerprint,
    tasks: [{ id: tempId, action: { scopeId: index.scopes[0].id, surface: actionVerb }, object: { scopeId: index.scopes[0].id, surface: actionObject },
      propositionScopeIds: [index.scopes[0].id], inferenceLevel, actionType: 'save', effect: 'local_change',
      semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' },
      detail, condition: { value: 'not_applicable', conditionScopeIds: [], factScopeIds: [] },
      coverage: { time: 'not_stated', material: 'not_stated', event: 'not_stated' }, eventTempIds: [] }],
    materials: [], timePoints: [], events: [], revisions: [], conflicts: [], informationScopeIds: [index.scopes[1].id], unresolvedScopeIds: [] }
  const context: ComposeContext = { index, authority: 'human_engineering', referenceTime: NOW, timezone: 'Asia/Shanghai' }
  return { input, old, context }
}
describe('MAINLINE-04 old V2 capability boundary', () => {
  it('returns the complete original 2.0 object, never a reconstructed projection', async () => {
    const { input, old, context } = await ordinary()
    const before = JSON.stringify(old), result = await assessLegacyHandoff(input, old, context)
    expect(result.eligibleTaskTempIds).toEqual(['save']); expect(result.legacyResult).toEqual(old)
    expect(JSON.stringify(result.legacyResult)).toBe(before); expect(JSON.stringify(old)).toBe(before)
  })
  it.each(['true', 'false', 'unknown'] as const)('does not lower condition %s into the old boolean', async value => {
    const { input, old, context } = await ordinary()
    input.tasks[0].condition = { value, conditionScopeIds: [context.index.scopes[0].id], factScopeIds: [context.index.scopes[1].id] }
    const result = await assessLegacyHandoff(input, old, context)
    expect(result.eligibleTaskTempIds).toEqual([]); expect(result.rows[0].reasons).toContain('CONDITION_NOT_EXPRESSIBLE')
    expect(result.review.original).toEqual(input); expect(result.legacyResult).toEqual(old)
  })
  it('retains non-equivalent task attributes and exposes the difference', async () => {
    const { input, old, context } = await ordinary(); input.tasks[0].detail.description += '（工程结构变形）'
    const result = await assessLegacyHandoff(input, old, context)
    expect(result.rows[0].reasons).toContain('TASK_ATTRIBUTE_DIFFERENCE'); expect(result.eligibleTaskTempIds).toEqual([])
  })
  it('does not put structured revisions into old conflict prose', async () => {
    const { input, old, context } = await ordinary()
    input.revisions = [{ type: 'cancels', targetDirectiveId: 'save', fromDirectiveId: null, effective: 'true', scopeIds: [context.index.scopes[0].id] }]
    const result = await assessLegacyHandoff(input, old, context)
    expect(result.rows[0].reasons).toContain('REVISION_NOT_EXPRESSIBLE'); expect(result.legacyResult).toEqual(old)
  })
  it('rejects the whole old capture on dangling references, retains its raw response', async () => {
    const { input, old, context } = await ordinary(); old.standaloneTasks[0].timePointTempIds = ['missing']
    const result = await assessLegacyHandoff(input, old, context)
    expect(result.capture).toBe('REJECT_WHOLE_CAPTURE'); expect(result.legacyResult).toBeNull(); expect(result.originalLegacy).toEqual(old)
  })
  it('does not trust a forged review package or unreviewed model origin', async () => {
    const { input, old, context } = await ordinary()
    await expect(assessLegacyHandoff({ original: input, items: [{ selected: true }] }, old, context)).rejects.toThrow()
    expect((await assessLegacyHandoff(input, old, { ...context, authority: 'seen_model_unverified' })).eligibleTaskTempIds).toEqual([])
  })
})
