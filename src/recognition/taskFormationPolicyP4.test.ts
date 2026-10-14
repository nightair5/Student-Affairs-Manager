import { describe, expect, it } from 'vitest'
import { composeLocalAnchorsV2 } from './modelAnchorLocalComposerV2'
import type { ModelAnchorSelection } from './modelAnchorSelectionContract'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { formLocalTaskSuggestionsP4, validateLocalTaskFormationP4 } from './taskFormationPolicyP4'

interface DirectiveInput {
  id: string
  propositionScopeTexts: string[]
  action: { scopeText: string; surface: string }
  object: { scopeText: string; surface: string }
}

async function fixture(sourceId: string, sourceText: string, directives: DirectiveInput[]) {
  const index = await indexImmutableScopesV11(sourceId, 'source-v1', sourceText)
  const lookup = (text: string) => {
    const matches = index.scopes.filter((scope) => scope.text === text)
    if (matches.length !== 1) throw new Error(`scope not unique: ${text}`)
    return matches[0].id
  }
  const covered = new Set(directives.flatMap((directive) => directive.propositionScopeTexts.map(lookup)))
  const selection: ModelAnchorSelection = {
    schemaVersion: 'model-anchor-selection-1.0.0',
    sourceId,
    sourceVersionId: 'source-v1',
    sourceFingerprint: index.sourceFingerprint,
    producerRunId: `test-${sourceId}`,
    directives: directives.map((directive) => ({
      id: directive.id,
      propositionScopeIds: directive.propositionScopeTexts.map(lookup),
      action: { scopeId: lookup(directive.action.scopeText), surface: directive.action.surface },
      object: { scopeId: lookup(directive.object.scopeText), surface: directive.object.surface },
    })),
    ignoredScopeIds: index.scopes.filter((scope) => !covered.has(scope.id)).map((scope) => scope.id),
  }
  return { index, selection }
}

function compose(index: Awaited<ReturnType<typeof indexImmutableScopesV11>>, selection: ModelAnchorSelection) {
  const composition = composeLocalAnchorsV2(selection, index, selection.producerRunId)
  if (!composition.ok) throw new Error(JSON.stringify(composition.issues))
  const formed = formLocalTaskSuggestionsP4(index, composition.value.reduced)
  expect(validateLocalTaskFormationP4(formed, index, composition.value.reduced)).toEqual([])
  return { composition: composition.value, formed }
}

describe('RCO-5-008 local action heads and P4 full-proposition safety', () => {
  it('separates optional and polite markers from controlled action heads', async () => {
    const { index, selection } = await fixture('p4-optional', '资料夹可自行携带；但请检查封面编号。', [
      { id: 'd-carry', propositionScopeTexts: ['资料夹可自行携带；'], action: { scopeText: '资料夹可自行携带；', surface: '可自行携带' }, object: { scopeText: '资料夹可自行携带；', surface: '资料夹' } },
      { id: 'd-check', propositionScopeTexts: ['但请检查封面编号。'], action: { scopeText: '但请检查封面编号。', surface: '请检查' }, object: { scopeText: '但请检查封面编号。', surface: '封面编号' } },
    ])
    const { composition, formed } = compose(index, selection)
    expect(composition.actionNormalizations.map((item) => item.canonicalSurface)).toEqual(['携带', '检查'])
    expect(formed.tasks.map((task) => ({ action: task.action.surface, modality: task.semantics.modality, selected: task.selected }))).toEqual([
      { action: '携带', modality: 'optional', selected: false },
      { action: '检查', modality: 'required', selected: true },
    ])
  })

  it('keeps a swallowed negative marker authoritative and never selects the action', async () => {
    const { index, selection } = await fixture('p4-negative', '本次不得保存临时名单。', [
      { id: 'd-save', propositionScopeTexts: ['本次不得保存临时名单。'], action: { scopeText: '本次不得保存临时名单。', surface: '不得保存' }, object: { scopeText: '本次不得保存临时名单。', surface: '临时名单' } },
    ])
    const { formed } = compose(index, selection)
    expect(formed.requiresAction).toBe(false)
    expect(formed.tasks[0]).toMatchObject({ action: { surface: '保存' }, semantics: { polarity: 'negative', status: 'cancelled' }, selected: false })
  })

  it.each([
    ['true', '当前器材标签未贴齐。', true, 'affirmative'],
    ['false', '当前并未出现器材标签未贴齐。', false, 'uncertain'],
  ])('attaches one deterministic condition fact and resolves %s', async (_name, fact, requiresAction, polarity) => {
    const sourceText = `若器材标签未贴齐，请联系管理员。${fact}`
    const { index, selection } = await fixture(`p4-condition-${_name}`, sourceText, [
      { id: 'd-contact', propositionScopeTexts: ['若器材标签未贴齐，', '请联系管理员。'], action: { scopeText: '请联系管理员。', surface: '请联系' }, object: { scopeText: '请联系管理员。', surface: '管理员' } },
    ])
    const { composition, formed } = compose(index, selection)
    expect(composition.conditionAttachments[0]).toMatchObject({ status: 'attached_unique', truth: _name })
    expect(formed.requiresAction).toBe(requiresAction)
    expect(formed.tasks[0].semantics.polarity).toBe(polarity)
  })

  it('keeps conflicting condition facts unknown instead of choosing one', async () => {
    const sourceText = '若门牌尚未安装，请联系物业。当前门牌尚未安装。目前并未出现门牌尚未安装。'
    const { index, selection } = await fixture('p4-condition-ambiguous', sourceText, [
      { id: 'd-contact', propositionScopeTexts: ['若门牌尚未安装，', '请联系物业。'], action: { scopeText: '请联系物业。', surface: '联系' }, object: { scopeText: '请联系物业。', surface: '物业' } },
    ])
    const { composition, formed } = compose(index, selection)
    expect(composition.conditionAttachments[0]).toMatchObject({ status: 'ambiguous', truth: 'unknown', attachedScopeIds: [] })
    expect(composition.warnings.map((warning) => warning.code)).toContain('CONDITION_ASSERTION_AMBIGUOUS')
    expect(formed.requiresAction).toBe(false)
    expect(formed.tasks[0].semantics.validity).toBe('uncertain')
  })

  it('fails closed when one model action phrase contains two controlled actions', async () => {
    const { index, selection } = await fixture('p4-compound', '请提交并上传材料包。', [
      { id: 'd-compound', propositionScopeTexts: ['请提交并上传材料包。'], action: { scopeText: '请提交并上传材料包。', surface: '提交并上传' }, object: { scopeText: '请提交并上传材料包。', surface: '材料包' } },
    ])
    const composition = composeLocalAnchorsV2(selection, index, selection.producerRunId)
    expect(composition).toEqual({ ok: false, issues: [{ code: 'ACTION_HEAD_AMBIGUOUS', path: 'directives[0].action' }] })
  })

  it('uses an explicit executor and does not treat an object noun as the actor', async () => {
    const { index, selection } = await fixture('p4-actor', '请整理成员名单。现场协调人员须核对座次。', [
      { id: 'd-list', propositionScopeTexts: ['请整理成员名单。'], action: { scopeText: '请整理成员名单。', surface: '整理' }, object: { scopeText: '请整理成员名单。', surface: '成员名单' } },
      { id: 'd-seats', propositionScopeTexts: ['现场协调人员须核对座次。'], action: { scopeText: '现场协调人员须核对座次。', surface: '须核对' }, object: { scopeText: '现场协调人员须核对座次。', surface: '座次' } },
    ])
    const { formed } = compose(index, selection)
    expect(formed.tasks.map((task) => task.semantics.actor)).toEqual(['addressee', 'addressed_group'])
  })
})
