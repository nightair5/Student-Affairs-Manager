import { createAuthorityFixture } from './singleAuthorityFixtures'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'

export const CURRENT_MECHANISM_CASES = ['compact-window', 'expanded-window', 'whole-action'] as const
export async function createCurrentMechanismFixture(kind: typeof CURRENT_MECHANISM_CASES[number], range = '2026年11月6—8日') {
  const base = await createAuthorityFixture(kind === 'whole-action' ? 'deadline' : 'window')
  const sourceText = kind === 'whole-action' ? '请于2026年11月6日17:00完成相关信息登记，确保填写的信息完整准确。'
    : `请在开放时段办理申请。办理申请开放时间为${range}。`
  const sourceId = 'mechanism-fixture-' + kind, sourceVersionId = sourceId + '-v1'
  const context = { ...base.context, index: await indexImmutableScopesV11(sourceId, sourceVersionId, sourceText) }
  const ids = context.index.scopes.map(s => s.id), facts = structuredClone(base.facts), task = facts.tasks[0]
  task.propositionScopeIds = ids
  task.action = { surface: kind === 'whole-action' ? '完成相关信息登记' : '办理', scopeId: ids[0] }
  task.object = { surface: kind === 'whole-action' ? '相关信息' : '申请', scopeId: ids[0] }
  facts.materials = []; task.coverage.material = { status: 'not_stated', absenceScopeIds: [] }
  facts.events = []; facts.revisions = []; facts.conflicts = []; facts.prerequisiteStates = []
  facts.timePoints = facts.timePoints.map((p, i) => ({ ...p, scopeIds: [kind === 'whole-action' ? ids[0] : ids[1]],
    rawText: kind === 'whole-action' ? '2026年11月6日17:00' : kind === 'expanded-window' ? `2026年11月${i ? '8' : '6'}日` : range }))
  facts.scopeAccounting = ids.map(scopeId => ({ scopeId, kind: 'action', primaryEntityIds: [task.id] }))
  const rawHttpText = JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }], usage: { input_tokens: 0, output_tokens: 0 } })
  return { kind, context, sourceText, facts, rawHttpText, role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const }
}
