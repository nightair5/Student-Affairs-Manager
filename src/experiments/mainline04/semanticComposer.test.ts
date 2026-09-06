import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { notices, NOW } from '../mainline01/fixtures'
import { composeSemantics } from './semanticComposer'
import type { ComposeContext } from './semanticComposer'
import { SEMANTIC_VERSION } from './semanticContract'
import type { SemanticInput, SemanticTask, Truth } from './semanticContract'

async function example() {
  const index = await indexImmutableScopesV11('engineering', 'v1', notices['condition-true'])
  const scope = index.scopes.find(s => s.text.includes('提交'))!
  const task: SemanticTask = { id: 'conditional', propositionScopeIds: [scope.id],
    action: { scopeId: scope.id, surface: '提交' }, object: { scopeId: scope.id, surface: '场地申请表' },
    semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' },
    inferenceLevel: 'explicit', actionType: 'submit', effect: 'physical_action',
    detail: { parentTempId: null, hierarchyType: 'task', title: '提交场地申请表', description: notices['condition-true'],
      completionCriteria: [], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium',
      dependencyTempIds: [], materialTempIds: [], timePointTempIds: [], confidence: 1, userConfirmationRequired: true },
    condition: { value: 'true', conditionScopeIds: [index.scopes[0].id], factScopeIds: [index.scopes.at(-1)!.id] },
    coverage: { time: 'not_stated', material: 'not_stated', event: 'not_stated' }, eventTempIds: [] }
  const input: SemanticInput = { schemaVersion: SEMANTIC_VERSION, sourceId: index.sourceId, sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint, tasks: [task], materials: [], timePoints: [], events: [], revisions: [], conflicts: [],
    informationScopeIds: [], unresolvedScopeIds: [] }
  const context: ComposeContext = { index, authority: 'human_engineering', referenceTime: NOW, timezone: 'Asia/Shanghai' }
  return { input, context, task }
}
describe('MAINLINE-04 finite-state composition, not natural-language classification', () => {
  it.each<Truth>(['true', 'false', 'unknown'])('preserves declared condition %s without coercion', async value => {
    const { input, context, task } = await example(); task.condition.value = value
    const out = await composeSemantics(input, context)
    expect(out.original).toEqual(input)
    expect(out.items[0].condition.value).toBe(value)
    expect(out.items[0].requiresAction).toBe(value)
    expect(out.items[0].defaultSelected).toBe(value === 'true')
  })
  it.each(['completed', 'cancelled'] as const)('does not select %s', async status => {
    const { input, context, task } = await example(); task.semantics.status = status
    const item = (await composeSemantics(input, context)).items[0]
    expect(item.requiresAction).toBe('false'); expect(item.defaultSelected).toBe(false)
  })
  it.each(['interrogative', 'hypothetical', 'quoted', 'unknown'] as const)('does not select speech act %s', async speechAct => {
    const { input, context, task } = await example(); task.semantics.speechAct = speechAct
    expect((await composeSemantics(input, context)).items[0].defaultSelected).toBe(false)
  })
  it.each(['negative', 'uncertain'] as const)('does not select polarity %s', async polarity => {
    const { input, context, task } = await example(); task.semantics.polarity = polarity
    expect((await composeSemantics(input, context)).items[0].defaultSelected).toBe(false)
  })
  it.each(['optional', 'informational', 'recommended', 'unknown'] as const)('does not default select modality %s', async modality => {
    const { input, context, task } = await example(); task.semantics.modality = modality
    expect((await composeSemantics(input, context)).items[0].defaultSelected).toBe(false)
  })
  it.each(['not_extracted', 'unresolved'] as const)('empty %s does not mean no information', async state => {
    const { input, context, task } = await example(); task.coverage.time = state
    const out = await composeSemantics(input, context)
    expect(out.items[0].defaultSelected).toBe(false); expect(out.original.tasks[0].coverage.time).toBe(state)
  })
  it('requires source identity and exact immutable scope index', async () => {
    const { input, context } = await example()
    await expect(composeSemantics({ ...input, sourceId: 'foreign' }, context)).rejects.toThrow('SOURCE_BINDING')
    context.index.scopes[0].start++
    await expect(composeSemantics(input, context)).rejects.toThrow('SOURCE_BINDING')
  })
  it('rejects duplicate IDs and scope-free or nonunique surfaces locally', async () => {
    const { input, context } = await example()
    await expect(composeSemantics({ ...input, tasks: [input.tasks[0], input.tasks[0]] }, context)).rejects.toThrow('DUPLICATE_ENTITY')
    input.tasks[0].action.scopeId = 'foreign'
    const out = await composeSemantics(input, context)
    expect(out.items[0].issues).toContain('SURFACE_NOT_UNIQUE_IN_SCOPE'); expect(out.items[0].defaultSelected).toBe(false)
  })
  it('does not accept injected selected or self-reported authority', async () => {
    const { input, context, task } = await example()
    await expect(composeSemantics({ ...input, tasks: [{ ...task, selected: true }] }, context)).rejects.toThrow()
    await expect(composeSemantics({ ...input, authority: 'human_engineering' }, context)).rejects.toThrow()
    expect((await composeSemantics(input, { ...context, authority: 'seen_model_unverified' })).items[0].defaultSelected).toBe(false)
  })
  it('preserves object-key order equivalence and isolates caller mutation', async () => {
    const { input, context } = await example()
    const reversed = Object.fromEntries(Object.entries(input).reverse())
    const a = await composeSemantics(input, context), b = await composeSemantics(reversed, context)
    expect(b).toEqual(a); input.tasks[0].condition.value = 'false'
    expect(a.original.tasks[0].condition.value).toBe('true')
  })
  it('records cancellation without fabricating a replacement task', async () => {
    const { input, context } = await example()
    input.revisions = [{ type: 'cancels', targetDirectiveId: 'conditional', fromDirectiveId: null, effective: 'true', scopeIds: [context.index.scopes[0].id] }]
    const out = await composeSemantics(input, context)
    expect(out.original.revisions).toEqual(input.revisions); expect(out.items).toHaveLength(1)
    expect(out.items[0].requiresAction).toBe('false'); expect(out.items[0].defaultSelected).toBe(false)
  })
  it('rejects cyclical and dangling relations without changing references', async () => {
    const { input, context, task } = await example()
    task.detail.dependencyTempIds = [task.id]
    const out = await composeSemantics(input, context)
    expect(out.items[0].defaultSelected).toBe(false); expect(out.original).toEqual(input)
    task.detail.dependencyTempIds = ['missing']
    expect((await composeSemantics(input, context)).items[0].issues).toContain('BAD_ENTITY_REFERENCE')
  })
})

// R1 additions, preserving the original test prefix byte-for-byte.
describe('MAINLINE-04-I1-R1 cancellation evidence', () => {
  it.each(['missing', 'bad-scope', 'unknown', 'valid', 'false'] as const)('R1 cancel without replacement: %s', async mode => {
    const { input, context } = await example()
    input.revisions = [{ type: 'cancels', targetDirectiveId: 'conditional', fromDirectiveId: null,
      effective: mode === 'unknown' ? 'unknown' : mode === 'false' ? 'false' : 'true',
      scopeIds: mode === 'missing' ? [] : mode === 'bad-scope' ? ['missing-scope'] : [context.index.scopes[0].id] }]
    const result = await composeSemantics(input, context), item = result.items[0]
    expect(result.original).toEqual(input)
    expect(result.items).toHaveLength(1)
    expect(item.requiresAction).toBe(mode === 'valid' ? 'false' : mode === 'false' ? 'true' : 'unknown')
    expect(item.defaultSelected).toBe(mode === 'false')
  })
})
