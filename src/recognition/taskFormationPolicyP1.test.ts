import { describe, expect, it } from 'vitest'
import {
  indexImmutableScopes,
  type ImmutableScopeIndex,
  type ScopeReferenceCandidate,
  type ScopeReferenceDirective,
} from './scopeReferenceContract'
import { reduceModelCandidate } from './taskFormationPolicyV2'
import { formLocalTaskSuggestionsP1, validateLocalTaskFormationP1 } from './taskFormationPolicyP1'

const ignoredSemantics: ScopeReferenceDirective['semantics'] = {
  actor: 'issuer', speechAct: 'assertive', polarity: 'negative', tense: 'past',
  status: 'completed', validity: 'superseded', modality: 'optional',
}

function directive(index: ImmutableScopeIndex, position: number, action: string, object: string, actionType: ScopeReferenceDirective['actionType']): ScopeReferenceDirective {
  const scope = index.scopes[position]
  return {
    id: `d-${position}-${action}`, propositionScopeIds: [scope.id], semantics: ignoredSemantics,
    inferenceLevel: 'optional_suggestion', actionType,
    action: { scopeId: scope.id, surface: action }, object: { scopeId: scope.id, surface: object }, effect: 'unknown',
    timeRefs: [], materialRefs: [], eventRef: null, locationRef: null, revisionRefs: [],
  }
}

function candidate(index: ImmutableScopeIndex, directives: ScopeReferenceDirective[]): ScopeReferenceCandidate {
  return {
    schemaVersion: 'scope-reference-candidate-1.0', sourceId: index.sourceId, sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint, producerRunId: 'untrusted-p1-test', requiresAction: false,
    directives, observations: [], ignoredScopeIds: [],
  }
}

async function form(source: string, build: (index: ImmutableScopeIndex) => ScopeReferenceDirective[]) {
  const index = await indexImmutableScopes('p1-source', 'source-v1', source)
  const result = formLocalTaskSuggestionsP1(index, reduceModelCandidate(candidate(index, build(index))))
  return { index, result }
}

describe('RCO-5-007-P1 responsibility layers', () => {
  it('derives a required external action independently from safe default selection', async () => {
    const { index, result } = await form('请向学院邮箱提交申请。', (scopeIndex) => [directive(scopeIndex, 0, '提交', '申请', 'submit')])
    expect(validateLocalTaskFormationP1(result, index)).toEqual([])
    expect(result).toMatchObject({ requiresAction: true, tasks: [{ effect: 'external_transfer', selected: false }] })
  })

  it('does not turn an optional local action into a current obligation', async () => {
    const { result } = await form('可通过网页查看直播。', (scopeIndex) => [directive(scopeIndex, 0, '查看', '直播', 'review')])
    expect(result.requiresAction).toBe(false)
    expect(result.tasks[0]).toMatchObject({ semantics: { actor: 'addressed_group', modality: 'optional' }, selected: false })
  })

  it('splits same-scope actions when their objects differ', async () => {
    const { index, result } = await form('请核对宿舍名单并保存门禁故障说明。', (scopeIndex) => [
      directive(scopeIndex, 0, '核对', '宿舍名单', 'review'),
      directive(scopeIndex, 0, '保存', '门禁故障说明', 'save'),
    ])
    expect(validateLocalTaskFormationP1(result, index)).toEqual([])
    expect(result.tasks.map((task) => [task.action.surface, task.object.surface])).toEqual([
      ['核对', '宿舍名单'], ['保存', '门禁故障说明'],
    ])
  })

  it('keeps a same-object local action chain merged', async () => {
    const { result } = await form('请检查预约草稿并保存预约草稿。', (scopeIndex) => [
      directive(scopeIndex, 0, '检查', '预约草稿', 'review'),
      directive(scopeIndex, 0, '保存', '预约草稿', 'save'),
    ])
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0]).toMatchObject({ object: { surface: '预约草稿' }, selected: true })
  })

  it('activates a condition only when a later bound scope explicitly satisfies it', async () => {
    const source = '若实验柜持续闪红，请联系值班室。当前实验柜确实持续闪红。'
    const { index, result } = await form(source, (scopeIndex) => {
      const item = directive(scopeIndex, 1, '联系', '值班室', 'contact')
      item.propositionScopeIds = [scopeIndex.scopes[0].id, scopeIndex.scopes[1].id, scopeIndex.scopes[2].id]
      return [item]
    })
    expect(validateLocalTaskFormationP1(result, index)).toEqual([])
    expect(result.tasks[0].semantics).toMatchObject({ speechAct: 'directive', polarity: 'affirmative', status: 'pending', validity: 'active' })
    expect(result.requiresAction).toBe(true)
    expect(result.tasks[0].selected).toBe(false)
  })

  it('keeps an unmet condition uncertain and non-actionable', async () => {
    const source = '若收到正式盖章通知，再提交住宿申请。目前只有未盖章的预览稿。'
    const { result } = await form(source, (scopeIndex) => {
      const item = directive(scopeIndex, 1, '提交', '住宿申请', 'submit')
      item.propositionScopeIds = [scopeIndex.scopes[0].id, scopeIndex.scopes[1].id]
      return [item]
    })
    expect(result.tasks[0].semantics).toMatchObject({ speechAct: 'hypothetical', polarity: 'uncertain', status: 'unknown', validity: 'uncertain' })
    expect(result.requiresAction).toBe(false)
  })

  it('preserves an exact lexicalized object instead of stripping its 的 character', async () => {
    const { result } = await form('请核对联系电话后保存批注。', (scopeIndex) => [directive(scopeIndex, 0, '核对', '联系电话', 'review')])
    expect(result.tasks[0].object.surface).toBe('联系电话')
    expect(result.tasks[0]).toMatchObject({ effect: 'local_change', selected: true })
  })

  it('classifies online confirmation as external while allowing a local completion', async () => {
    const external = await form('必须在线确认阅读状态。', (scopeIndex) => [directive(scopeIndex, 0, '确认', '阅读状态', 'complete')])
    const local = await form('请完成预算表。', (scopeIndex) => [directive(scopeIndex, 0, '完成', '预算表', 'complete')])
    expect(external.result.tasks[0]).toMatchObject({ effect: 'external_interaction', selected: false })
    expect(local.result.tasks[0]).toMatchObject({ effect: 'local_change', selected: true })
  })

  it('blocks an embedded external transfer even when the outer verb is complete', async () => {
    const { result } = await form('请完成报名材料邮寄。', (scopeIndex) => [directive(scopeIndex, 0, '完成', '报名材料邮寄', 'complete')])
    expect(result).toMatchObject({ requiresAction: true, tasks: [{ effect: 'external_transfer', selected: false }] })
  })

  it('derives group ownership and explicit negative state', async () => {
    const { result } = await form('已获批免交的同学不需要提交纸质证明。', (scopeIndex) => [directive(scopeIndex, 0, '提交', '纸质证明', 'submit')])
    expect(result.tasks[0].semantics).toEqual({
      actor: 'addressed_group', speechAct: 'directive', polarity: 'negative', tense: 'future',
      status: 'cancelled', validity: 'active', modality: 'required',
    })
    expect(result.requiresAction).toBe(false)
  })

  it('does not treat a group word inside the object as the acting subject', async () => {
    const { result } = await form('请核对同学名单。', (scopeIndex) => [directive(scopeIndex, 0, '核对', '同学名单', 'review')])
    expect(result.tasks[0]).toMatchObject({ semantics: { actor: 'addressee' }, effect: 'local_change', selected: true })
  })

  it('does not confuse a contact noun with a contact action', async () => {
    const { result } = await form('请检查联系人清单。', (scopeIndex) => [directive(scopeIndex, 0, '检查', '联系人清单', 'review')])
    expect(result.tasks[0]).toMatchObject({ effect: 'local_change', selected: true })
  })

  it('blocks an external action nominalized at the end of a completion object', async () => {
    const { result } = await form('请完成在线报名。', (scopeIndex) => [directive(scopeIndex, 0, '完成', '在线报名', 'complete')])
    expect(result.tasks[0]).toMatchObject({ effect: 'external_interaction', selected: false })
    expect(result.requiresAction).toBe(true)
  })

  it('does not activate a condition when later evidence explicitly negates it', async () => {
    const source = '如果获得参评资格，请提交展示稿。目前确实没有获得参评资格。'
    const { result } = await form(source, (scopeIndex) => {
      const item = directive(scopeIndex, 1, '提交', '展示稿', 'submit')
      item.propositionScopeIds = [scopeIndex.scopes[0].id, scopeIndex.scopes[1].id, scopeIndex.scopes[2].id]
      return [item]
    })
    expect(result.tasks[0].semantics).toMatchObject({ speechAct: 'hypothetical', validity: 'uncertain' })
    expect(result.requiresAction).toBe(false)
  })

  it('is invariant to model anchor order for distinct same-scope actions', async () => {
    const index = await indexImmutableScopes('p1-source', 'source-v1', '请核对名单并保存说明。')
    const review = directive(index, 0, '核对', '名单', 'review')
    const save = directive(index, 0, '保存', '说明', 'save')
    const left = formLocalTaskSuggestionsP1(index, reduceModelCandidate(candidate(index, [review, save])))
    const right = formLocalTaskSuggestionsP1(index, reduceModelCandidate(candidate(index, [save, review])))
    expect(left.tasks.map((task) => [task.action.surface, task.object.surface, task.selected]))
      .toEqual(right.tasks.map((task) => [task.action.surface, task.object.surface, task.selected]))
  })

  it('rejects tampering with independently derived obligation, effect, semantics and selection', async () => {
    const { index, result } = await form('请提交申请。', (scopeIndex) => [directive(scopeIndex, 0, '提交', '申请', 'submit')])
    result.requiresAction = false
    result.tasks[0].effect = 'local_change'
    result.tasks[0].selected = true
    result.tasks[0].semantics.status = 'completed'
    expect(validateLocalTaskFormationP1(result, index).map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'P1_REQUIRES_ACTION_NOT_DERIVED', 'P1_SEMANTICS_NOT_DERIVED', 'P1_EFFECT_NOT_DERIVED', 'P1_SELECTED_NOT_DERIVED',
    ]))
  })
})
