import { describe, expect, it } from 'vitest'
import { indexImmutableScopes, type ImmutableScopeIndex, type ScopeReferenceCandidate, type ScopeReferenceDirective } from './scopeReferenceContract'
import { reduceModelCandidate } from './taskFormationPolicyV2'
import { formLocalTaskSuggestionsP2, validateLocalTaskFormationP2 } from './taskFormationPolicyP2'

const ignoredSemantics: ScopeReferenceDirective['semantics'] = { actor: 'issuer', speechAct: 'assertive', polarity: 'negative', tense: 'past', status: 'completed', validity: 'superseded', modality: 'optional' }
function directive(index: ImmutableScopeIndex, position: number, action: string, object: string, actionType: ScopeReferenceDirective['actionType']): ScopeReferenceDirective { const scope = index.scopes[position]; return { id: `d-${position}-${action}`, propositionScopeIds: [scope.id], semantics: ignoredSemantics, inferenceLevel: 'optional_suggestion', actionType, action: { scopeId: scope.id, surface: action }, object: { scopeId: scope.id, surface: object }, effect: 'unknown', timeRefs: [], materialRefs: [], eventRef: null, locationRef: null, revisionRefs: [] } }
function candidate(index: ImmutableScopeIndex, directives: ScopeReferenceDirective[]): ScopeReferenceCandidate { return { schemaVersion: 'scope-reference-candidate-1.0', sourceId: index.sourceId, sourceVersionId: index.sourceVersionId, sourceFingerprint: index.sourceFingerprint, producerRunId: 'untrusted-p2-test', requiresAction: false, directives, observations: [], ignoredScopeIds: [] } }
async function form(source: string, build: (index: ImmutableScopeIndex) => ScopeReferenceDirective[]) { const index = await indexImmutableScopes('p2-source', 'source-v1', source); const reduced = reduceModelCandidate(candidate(index, build(index))); const result = formLocalTaskSuggestionsP2(index, reduced); return { index, reduced, result } }

describe('RCO-5-007-P2 structured semantic responsibilities', () => {
  it('matches a complete negative-looking condition proposition before polarity classification', async () => {
    const source = '如门锁无法闭合，请联系物业前台。事实是门锁现在无法闭合。'
    const { index, reduced, result } = await form(source, (scopeIndex) => { const item = directive(scopeIndex, 1, '联系', '物业前台', 'contact'); item.propositionScopeIds = scopeIndex.scopes.map((scope) => scope.id); return [item] })
    expect(validateLocalTaskFormationP2(result, index, reduced)).toEqual([])
    expect(result.tasks[0]).toMatchObject({ semantics: { speechAct: 'directive', polarity: 'affirmative', status: 'pending', validity: 'active' }, selected: false })
    expect(result.requiresAction).toBe(true)
  })

  it('keeps an explicitly negated condition unresolved rather than activated', async () => {
    const source = '如果获得参评资格，请提交展示稿。目前确实没有获得参评资格。'
    const { result } = await form(source, (scopeIndex) => { const item = directive(scopeIndex, 1, '提交', '展示稿', 'submit'); item.propositionScopeIds = scopeIndex.scopes.map((scope) => scope.id); return [item] })
    expect(result.tasks[0].semantics).toMatchObject({ speechAct: 'hypothetical', polarity: 'uncertain', status: 'unknown', validity: 'uncertain' })
    expect(result.requiresAction).toBe(false)
  })

  it('preserves the validated original action while type and effect classify risk', async () => {
    const { result } = await form('本周内须办理线上缴费。', (scopeIndex) => [directive(scopeIndex, 0, '办理', '线上缴费', 'pay')])
    expect(result.tasks[0]).toMatchObject({ action: { surface: '办理' }, object: { surface: '线上缴费' }, actionType: 'pay', effect: 'external_interaction', selected: false })
  })

  it('does not infer a group actor from an object after the directive marker', async () => {
    const { result } = await form('不得把成员名单发送到群聊。', (scopeIndex) => [directive(scopeIndex, 0, '发送', '成员名单', 'send')])
    expect(result.tasks[0].semantics).toMatchObject({ actor: 'addressee', polarity: 'negative' })
  })

  it('uses an explicit group subject before the directive marker', async () => {
    const { result } = await form('正式成员请填写紧急联系人。', (scopeIndex) => [directive(scopeIndex, 0, '填写', '紧急联系人', 'fill')])
    expect(result.tasks[0]).toMatchObject({ semantics: { actor: 'addressed_group', modality: 'required' }, selected: false })
    expect(result.requiresAction).toBe(true)
  })

  it('separates a revoked old directive from the active replacement', async () => {
    const source = '原安排要求上传住宿申请，现已作废。最新要求是核对申请中的房间号。'
    const { result } = await form(source, (scopeIndex) => {
      const oldItem = directive(scopeIndex, 0, '上传', '住宿申请', 'upload'); oldItem.propositionScopeIds = [scopeIndex.scopes[0].id, scopeIndex.scopes[1].id]
      return [oldItem, directive(scopeIndex, 2, '核对', '房间号', 'review')]
    })
    expect(result.tasks[0].semantics).toEqual({ actor: 'addressee', speechAct: 'directive', polarity: 'negative', tense: 'past', status: 'cancelled', validity: 'superseded', modality: 'required' })
    expect(result.tasks[1]).toMatchObject({ semantics: { polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active' }, selected: true })
  })

  it('is invariant when the same proposition uses alternate current-fact markers', async () => {
    for (const marker of ['当前', '事实是', '经确认']) {
      const source = `若设备持续蜂鸣，请联系值班台。${marker}设备持续蜂鸣。`
      const { result } = await form(source, (scopeIndex) => { const item = directive(scopeIndex, 1, '联系', '值班台', 'contact'); item.propositionScopeIds = scopeIndex.scopes.map((scope) => scope.id); return [item] })
      expect(result.requiresAction, marker).toBe(true)
    }
  })

  it('rejects tampering with action, semantics, effect, selection and obligation', async () => {
    const { index, reduced, result } = await form('请核对报名表。', (scopeIndex) => [directive(scopeIndex, 0, '核对', '报名表', 'review')])
    result.requiresAction = false; result.tasks[0].action.surface = '报名'; result.tasks[0].effect = 'external_interaction'; result.tasks[0].semantics.actor = 'addressed_group'; result.tasks[0].selected = false
    expect(validateLocalTaskFormationP2(result, index, reduced).map((issue) => issue.code)).toEqual(expect.arrayContaining(['P2_REQUIRES_ACTION_NOT_DERIVED', 'P2_TASKS_NOT_DERIVED']))
  })
})
