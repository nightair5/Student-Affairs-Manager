import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { composeReducedAnchorsFromSelection, MODEL_ANCHOR_SELECTION_JSON_SCHEMA, MODEL_ANCHOR_SELECTION_SCHEMA_VERSION, validateModelAnchorSelection, type ModelAnchorSelection } from './modelAnchorSelectionContract'

describe('model-only scope/action/object selection contract', () => {
  it('contains no model-authority fields in the strict JSON Schema', () => {
    const serialized = JSON.stringify(MODEL_ANCHOR_SELECTION_JSON_SCHEMA)
    expect(serialized).not.toMatch(/requiresAction|semantics|effect|selected|revisionRefs|actionType/iu)
    expect(MODEL_ANCHOR_SELECTION_JSON_SCHEMA.additionalProperties).toBe(false)
  })

  it('binds every scope and composes only reduced anchors', async () => {
    const index = await indexImmutableScopesV11('source-1', 'version-1', '请保存核对记录。背景信息。')
    const selection: ModelAnchorSelection = {
      schemaVersion: MODEL_ANCHOR_SELECTION_SCHEMA_VERSION, sourceId: index.sourceId, sourceVersionId: index.sourceVersionId,
      sourceFingerprint: index.sourceFingerprint, producerRunId: 'run-1',
      directives: [{ id: 'd1', propositionScopeIds: [index.scopes[0].id], action: { scopeId: index.scopes[0].id, surface: '保存' }, object: { scopeId: index.scopes[0].id, surface: '核对记录' } }],
      ignoredScopeIds: [index.scopes[1].id],
    }
    expect(validateModelAnchorSelection(selection, index, 'run-1')).toEqual({ valid: true, issues: [] })
    const reduced = composeReducedAnchorsFromSelection(selection, index, 'run-1')
    expect(reduced.directives[0]).toMatchObject({ actionTypeHint: 'save', actionSurfaceHint: { surface: '保存' }, objectSurfaceHint: { surface: '核对记录' } })
    expect(reduced.discardedModelAuthority).toContain('selected')
  })

  it('fails closed on invented surfaces, missing scopes and extra authority keys', async () => {
    const index = await indexImmutableScopesV11('source-2', 'version-1', '请填写登记表。说明文字。')
    const base = { schemaVersion: MODEL_ANCHOR_SELECTION_SCHEMA_VERSION, sourceId: index.sourceId, sourceVersionId: index.sourceVersionId, sourceFingerprint: index.sourceFingerprint, producerRunId: 'run-2', directives: [{ id: 'd1', propositionScopeIds: [index.scopes[0].id], action: { scopeId: index.scopes[0].id, surface: '填写' }, object: { scopeId: index.scopes[0].id, surface: '不存在对象' } }], ignoredScopeIds: [] }
    expect(validateModelAnchorSelection(base, index, 'run-2').valid).toBe(false)
    expect(validateModelAnchorSelection({ ...base, selected: true }, index, 'run-2').issues.map((issue) => issue.code)).toContain('ROOT_KEYS_INVALID')
  })
})
