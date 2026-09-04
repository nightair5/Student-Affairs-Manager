import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import type { ImmutableScopeIndex, ScopeReferenceCandidate, ScopeReferenceDirective } from './scopeReferenceContract'
import { reduceModelCandidate } from './taskFormationPolicyV2'
import { formLocalTaskSuggestionsP3 } from './taskFormationPolicyP3'

const semantics: ScopeReferenceDirective['semantics'] = { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }
function item(index: ImmutableScopeIndex, actionScope: number, propositionScopes: number[], id: string, action: string, object: string, actionType: ScopeReferenceDirective['actionType']): ScopeReferenceDirective { const scope = index.scopes[actionScope]; return { id, propositionScopeIds: propositionScopes.map((position) => index.scopes[position].id), semantics, inferenceLevel: 'explicit', actionType, action: { scopeId: scope.id, surface: action }, object: { scopeId: scope.id, surface: object }, effect: 'unknown', timeRefs: [], materialRefs: [], eventRef: null, locationRef: null, revisionRefs: [] } }
async function resolve(source: string) { const index = await indexImmutableScopesV11('metamorphic-revision', 'source-v1', source); const directives = [item(index, 0, [0, 1], 'old', '发送', '旧清单', 'send'), item(index, 2, [2], 'new', '核对', '新清单', 'review')]; const candidate: ScopeReferenceCandidate = { schemaVersion: 'scope-reference-candidate-1.0', sourceId: index.sourceId, sourceVersionId: index.sourceVersionId, sourceFingerprint: index.sourceFingerprint, producerRunId: 'metamorphic', requiresAction: false, directives, observations: [], ignoredScopeIds: [] }; return formLocalTaskSuggestionsP3(index, reduceModelCandidate(candidate)) }

describe('revision relation metamorphic properties', () => {
  it('keeps the same relation across bounded invalidation paraphrases', async () => {
    for (const statement of ['该规定已经作废。', '该规定现已取消。', '该规定已经撤销。', '该规定从现在起不再生效。', '该规定已经停止执行。', '该规定现已废止。']) {
      const result = await resolve(`先前规定须发送旧清单。${statement}新的要求是核对新清单。`)
      expect(result.revisionRelations, statement).toEqual([expect.objectContaining({ kind: 'supersedes', resolution: 'shared_scope' })])
      expect(result.tasks[0].semantics, statement).toMatchObject({ tense: 'past', status: 'cancelled', validity: 'superseded' })
      expect(result.tasks[1], statement).toMatchObject({ action: { surface: '核对' }, object: { surface: '新清单' }, selected: true })
    }
  })

  it('preserves action, object, actor and effect while revision status changes', async () => {
    const result = await resolve('先前规定须发送旧清单。该规定已经作废。新的要求是核对新清单。')
    expect(result.tasks[0]).toMatchObject({ action: { surface: '发送' }, object: { surface: '旧清单' }, actionType: 'send', effect: 'external_transfer', semantics: { actor: 'addressee' } })
    expect(result.tasks[1]).toMatchObject({ action: { surface: '核对' }, object: { surface: '新清单' }, actionType: 'review', effect: 'local_change', semantics: { actor: 'addressee' } })
  })

  it('binds relation evidence to immutable scope ids rather than copied text', async () => {
    const result = await resolve('先前规定须发送旧清单。该规定已经作废。新的要求是核对新清单。')
    expect(result.revisionRelations[0].evidenceScopeIds).toHaveLength(3)
    expect(new Set(result.revisionRelations[0].evidenceScopeIds).size).toBe(3)
    expect(result.revisionRelations[0].evidenceScopeIds.every((id) => id.startsWith('scope-'))).toBe(true)
  })
})
