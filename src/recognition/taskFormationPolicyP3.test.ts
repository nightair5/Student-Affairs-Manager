import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import type { ImmutableScopeIndex, ScopeReferenceCandidate, ScopeReferenceDirective } from './scopeReferenceContract'
import { reduceModelCandidate } from './taskFormationPolicyV2'
import { formLocalTaskSuggestionsP3, validateLocalTaskFormationP3 } from './taskFormationPolicyP3'

const ignoredSemantics: ScopeReferenceDirective['semantics'] = { actor: 'issuer', speechAct: 'assertive', polarity: 'affirmative', tense: 'present', status: 'completed', validity: 'active', modality: 'optional' }
function directive(index: ImmutableScopeIndex, actionScope: number, propositionScopes: number[], action: string, object: string, actionType: ScopeReferenceDirective['actionType']): ScopeReferenceDirective { const scope = index.scopes[actionScope]; return { id: `d-${actionScope}-${action}`, propositionScopeIds: propositionScopes.map((position) => index.scopes[position].id), semantics: ignoredSemantics, inferenceLevel: 'optional_suggestion', actionType, action: { scopeId: scope.id, surface: action }, object: { scopeId: scope.id, surface: object }, effect: 'unknown', timeRefs: [], materialRefs: [], eventRef: null, locationRef: null, revisionRefs: [] } }
function candidate(index: ImmutableScopeIndex, directives: ScopeReferenceDirective[]): ScopeReferenceCandidate { return { schemaVersion: 'scope-reference-candidate-1.0', sourceId: index.sourceId, sourceVersionId: index.sourceVersionId, sourceFingerprint: index.sourceFingerprint, producerRunId: 'untrusted-p3-test', requiresAction: false, directives, observations: [], ignoredScopeIds: [] } }
async function form(source: string, build: (index: ImmutableScopeIndex) => ScopeReferenceDirective[]) { const index = await indexImmutableScopesV11('p3-source', 'source-v1', source); const reduced = reduceModelCandidate(candidate(index, build(index))); const result = formLocalTaskSuggestionsP3(index, reduced); return { index, reduced, result } }

describe('RCO-5-007-P3 local revision relation resolver', () => {
  it('resolves the seen B5 referential failure through a shared status scope', async () => {
    const source = '先前规定须发送宿舍分配表，现声明该规定不再有效。新的要求是核对房间编号。'
    const { result } = await form(source, (index) => [directive(index, 0, [0, 1], '发送', '宿舍分配表', 'send'), directive(index, 2, [2], '核对', '房间编号', 'review')])
    expect(result.revisionRelations).toEqual([expect.objectContaining({ kind: 'supersedes', targetTaskId: result.tasks[0].id, replacementTaskIds: [result.tasks[1].id], resolution: 'shared_scope', referentType: '规定' })])
    expect(result.tasks[0]).toMatchObject({ semantics: { polarity: 'negative', tense: 'past', status: 'cancelled', validity: 'superseded' }, selected: false })
    expect(result.tasks[1]).toMatchObject({ semantics: { polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active' }, selected: true })
  })

  it('constructs a cancellation edge from a unique adjacent typed referent', async () => {
    const source = '上一版通知要求提交统计表。该通知已经废止。'
    const { result } = await form(source, (index) => [directive(index, 0, [0], '提交', '统计表', 'submit')])
    expect(result.revisionRelations).toEqual([expect.objectContaining({ kind: 'cancels', replacementTaskIds: [], resolution: 'adjacent_unique_referent', referentType: '通知' })])
    expect(result.tasks[0].semantics).toMatchObject({ tense: 'past', status: 'cancelled', validity: 'superseded' })
    expect(result.requiresAction).toBe(false)
  })

  it('constructs a supersedes edge and keeps the replacement independently active', async () => {
    const source = '此前方案要求发送纸质清单。该方案现已撤销。当前要求是保存电子清单。'
    const { result } = await form(source, (index) => [directive(index, 0, [0, 1], '发送', '纸质清单', 'send'), directive(index, 2, [2], '保存', '电子清单', 'save')])
    expect(result.revisionRelations[0]).toMatchObject({ kind: 'supersedes', replacementTaskIds: [result.tasks[1].id], referentType: '方案' })
    expect(result.tasks[1].revisionRefs).toEqual([expect.objectContaining({ type: 'supersedes', targetTaskId: result.tasks[0].id })])
    expect(result.tasks[1].selected).toBe(true)
  })

  it('constructs an amendment edge when a new action follows an amend marker', async () => {
    const source = '原流程要求提交纸质表。现调整为上传电子表。'
    const { result } = await form(source, (index) => [directive(index, 0, [0], '提交', '纸质表', 'submit'), directive(index, 1, [1], '上传', '电子表', 'upload')])
    expect(result.revisionRelations).toEqual([expect.objectContaining({ kind: 'amends', targetTaskId: result.tasks[0].id, replacementTaskIds: [result.tasks[1].id], resolution: 'adjacent_unique_referent' })])
    expect(result.tasks[0].semantics.validity).toBe('superseded')
    expect(result.tasks[1].semantics.validity).toBe('active')
  })

  it('fails closed when a generic revision statement has two plausible old targets', async () => {
    const source = '上一版要求上传甲表。此前要求发送乙表。上述要求取消。'
    const { result } = await form(source, (index) => [directive(index, 0, [0], '上传', '甲表', 'upload'), directive(index, 1, [1], '发送', '乙表', 'send')])
    expect(result.revisionRelations).toEqual([])
    expect(result.unresolvedRevisionScopeIds).toEqual([expect.any(String)])
    expect(result.tasks.every((task) => task.semantics.validity === 'active')).toBe(true)
    expect(result.tasks.every((task) => !task.selected)).toBe(true)
  })

  it('does not invent a revision for ordinary current instructions', async () => {
    const { result } = await form('请核对借用数量。请保存核对记录。', (index) => [directive(index, 0, [0], '核对', '借用数量', 'review'), directive(index, 1, [1], '保存', '核对记录', 'save')])
    expect(result.revisionRelations).toEqual([])
    expect(result.unresolvedRevisionScopeIds).toEqual([])
    expect(result.tasks.map((task) => [task.action.surface, task.object.surface, task.selected])).toEqual([['核对', '借用数量', true], ['保存', '核对记录', true]])
  })

  it('detects tampering with relation evidence, old status and requiresAction', async () => {
    const source = '上一版通知要求提交统计表。该通知已经废止。'
    const { index, reduced, result } = await form(source, (scopeIndex) => [directive(scopeIndex, 0, [0], '提交', '统计表', 'submit')])
    result.revisionRelations[0].evidenceScopeIds = ['not-a-scope']
    result.tasks[0].semantics.validity = 'active'
    result.requiresAction = true
    expect(validateLocalTaskFormationP3(result, index, reduced).map((issue) => issue.code)).toEqual(expect.arrayContaining(['P3_REVISION_EVIDENCE_INVALID', 'P3_REQUIRES_ACTION_NOT_DERIVED', 'P3_TASKS_NOT_DERIVED', 'P3_REVISION_RELATIONS_NOT_DERIVED']))
  })
})
