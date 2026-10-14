import { describe, expect, it } from 'vitest'
import { engineeringReply, cases } from '../mainline05/engineeringReplay'
import { composeSemantics } from '../mainline04/semanticComposer'
import { factIdentity, selectLiveTasks } from './modelPolicy'

async function sample(name: typeof cases[number]) {
  const r = await engineeringReply(name, { sourceId: 'policy-source', sourceVersionId: 'policy-version' })
  const context = { ...r.context, authority: 'live_model_candidate' as const, profile: 'real-input-01' as const }
  return { input: r.rawResponse, context, review: await composeSemantics(r.rawResponse, context) }
}
describe('real-input live policy, seen engineering only', () => {
  it('rejects live authority without explicit profile, old defaults unchanged', async () => {
    const r = await engineeringReply('no-date', { sourceId: 's', sourceVersionId: 'v' })
    expect((await composeSemantics(r.rawResponse, r.context)).items[0].defaultSelected).toBe(true)
    await expect(composeSemantics(r.rawResponse, { ...r.context, authority: 'live_model_candidate' })).rejects.toThrow('LIVE_PROFILE_REQUIRED')
    const live = await sample('no-date')
    expect(live.review.items[0].requiresAction).toBe('true')
    expect(live.review.items[0].defaultSelected).toBe(false)
  })
  it('selected/confidence do not replace explicit current fact review; normal confirm remains nonzero', async () => {
    const { input, review } = await sample('no-date'), id = input.tasks[0].id
    expect(selectLiveTasks(input, review, [], {}, [id])[0]).toMatchObject({ defaultSelected: false, selected: false })
    const reviews = [{ taskId: id, factIdentity: factIdentity(input, id) }]
    expect(selectLiveTasks(input, review, reviews, {}, [id])[0].selected).toBe(true)
    input.tasks[0].object.surface += '篡改'
    expect(() => selectLiveTasks(input, review, reviews, {}, [id])).toThrow('SOURCE_OR_ORIGIN')
  })
  it.each(['condition-true', 'condition-false', 'condition-unknown'] as const)('preserves condition %s and successful true', async name => {
    const { input, review } = await sample(name), id = input.tasks[0].id
    const rows = selectLiveTasks(input, review, [{ taskId: id, factIdentity: factIdentity(input, id) }], {}, [id])
    expect(rows[0].selected).toBe(name === 'condition-true')
    expect(input.tasks[0].condition.value).toBe(name.replace('condition-', ''))
  })
  it('old cancellation is blocked and valid new requirement can confirm', async () => {
    const { input, review } = await sample('revision')
    const rows = selectLiveTasks(input, review, input.tasks.map(t => ({ taskId: t.id, factIdentity: factIdentity(input, t.id) })), {}, ['old', 'new'])
    expect(rows.find(r => r.taskId === 'old')!.selected).toBe(false)
    expect(rows.find(r => r.taskId === 'new')!.selected).toBe(true)
  })
  it('prerequisite reject/defer/uncheck clears dependent selection; same-batch/confirmed work', async () => {
    const { input, context } = await sample('multi'), [a,b] = input.tasks.map(t => t.id)
    input.tasks[1].detail.dependencyTempIds = [a]
    const review = await composeSemantics(input, context)
    const reviews = input.tasks.map(t => ({ taskId: t.id, factIdentity: factIdentity(input, t.id) }))
    for (const disposition of ['rejected', 'deferred'] as const)
      expect(selectLiveTasks(input, review, reviews, { [a]: disposition }, [a,b]).find(r => r.taskId === b)!.selected).toBe(false)
    expect(selectLiveTasks(input, review, reviews, {}, [b]).find(r => r.taskId === b)!.selected).toBe(false)
    expect(selectLiveTasks(input, review, reviews, {}, [a,b]).filter(r => r.selected)).toHaveLength(2)
    expect(selectLiveTasks(input, review, reviews, { [a]: 'confirmed' }, [b]).find(r => r.taskId === b)!.selected).toBe(true)
  })
  it('independent brother keeps its identity after unrelated factual edit and array reorder', async () => {
    const { input } = await sample('multi'), [a,b] = input.tasks.map(t => t.id)
    const first = factIdentity(input, b)
    input.tasks.find(t => t.id === a)!.detail.title += '已改'
    input.tasks.reverse(); input.materials.reverse(); input.timePoints.reverse()
    expect(factIdentity(input, b)).toBe(first)
    expect(factIdentity(input, a)).not.toBe(first)
  })
  it('pure info is not a task, incomplete source stays unresolved', async () => {
    const { input, context, review } = await sample('information')
    expect(selectLiveTasks(input, review, [], {}, [])).toEqual([])
    input.unresolvedScopeIds = [...input.informationScopeIds]; input.informationScopeIds = []
    expect((await composeSemantics(input, context)).issues.some(i => i.code === 'UNRESOLVED_SOURCE_SCOPE')).toBe(true)
  })
})
