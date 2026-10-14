import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { OBLIGATION_AUTHORITY_VERSION, type ObligationAuthorityFacts } from '../../recognition/sourceContractV6'
import { createAuthorityFixture } from './singleAuthorityFixtures'
import { createCompositionFixture } from './authorityCompositionFixtures'
import type { SingleAuthorityFacts } from '../../recognition/sourceContractV5'
import type { WireContext } from '../realInput01/modelWire'

export const OBLIGATION_CASES = ['equipment', 'registration', 'shared-window', 'no-task', 'split-clock', 'control'] as const
export type ObligationCase = typeof OBLIGATION_CASES[number]
export function authorityToObligationFixture(f: SingleAuthorityFacts): ObligationAuthorityFacts {
  return { ...structuredClone(f), schemaVersion: OBLIGATION_AUTHORITY_VERSION,
    tasks: f.tasks.map(t => ({ ...structuredClone(t), eventLinks: f.events.filter(e => e.relatedTaskTempIds.includes(t.id)).map(e => ({ eventId: e.tempId, scopeIds: t.propositionScopeIds.filter(s => e.scopeIds.includes(s)) })) })),
    events: f.events.map(({ relatedTaskTempIds, ...e }) => { void relatedTaskTempIds; return structuredClone(e) }),
  }
}
// The existing transport decoder requires its pinned model label; provenance
// is explicitly EngineeringFixture in the caller and never a real model sample.
export const obligationEnvelope = (f: ObligationAuthorityFacts) => JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(f) }] }], usage: { input_tokens: 0, output_tokens: 0 } })

/** Source assertions are authored separately from the converter; these are not generated outputs. */
export async function createObligationFixture(kind: ObligationCase) {
  if (kind === 'control' || kind === 'split-clock') {
    const base = kind === 'control' ? await createAuthorityFixture('deadline') : await createCompositionFixture()
    const facts = authorityToObligationFixture(base.facts)
    return { kind, sourceText: base.sourceText, context: base.context, facts, rawHttpText: obligationEnvelope(facts), role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const }
  }
  const texts = {
    equipment: '若已获远程研修录取，需自行准备笔记本。远程研修于2026年11月18日09:00开始，结束时间尚未公布。',
    registration: '请于2026年11月6日17:00前报名制图讲座。制图讲座于2026年11月9日14:00开始，15:00结束。',
    'shared-window': '请填写借用记录并激活借用账号。填写借用记录和激活借用账号均可在2026年11月10日09:00至2026年11月12日17:00办理。',
    'no-task': '网络服务在周五晚上维护，结束时间尚未公布。不需报名，不需提交说明。',
  }
  const sourceText = texts[kind], sourceId = 'obligation-fixture-' + kind, context: WireContext = { index: await indexImmutableScopesV11(sourceId, sourceId + '-v1', sourceText), referenceTime: '2026-10-07T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const scope = (fragment: string) => { const s = context.index.scopes.find(s => s.text.includes(fragment)); if (!s) throw Error('OBLIGATION_FIXTURE_SOURCE'); return s.id }
  const facts: ObligationAuthorityFacts = { schemaVersion: OBLIGATION_AUTHORITY_VERSION, tasks: [], prerequisiteStates: [], events: [], timePoints: [], materials: [], revisions: [], conflicts: [], scopeAccounting: [] }
  const task = (id: string, action: string, object: string, fragment: string) => {
    const s = scope(fragment), t: ObligationAuthorityFacts['tasks'][number] = { id, action: { surface: action, scopeId: s }, object: { surface: object, scopeId: s }, propositionScopeIds: [s], semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }, inferenceLevel: 'explicit', actionType: 'other', effect: 'local_change', detail: { parentTempId: null, hierarchyType: 'task', title: action + object, description: '', completionCriteria: [], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], confidence: 1, userConfirmationRequired: true }, condition: { value: 'not_applicable', conditionScopeIds: [], factScopeIds: [] }, eventLinks: [], coverage: { time: { status: 'not_stated', absenceScopeIds: [] }, material: { status: 'not_stated', absenceScopeIds: [] }, event: { status: 'not_stated', absenceScopeIds: [] } } }
    facts.tasks.push(t); return t
  }
  const event = (title: string, fragments: string[]) => { const e = { tempId: 'E1', title, description: '', location: null, scopeIds: fragments.map(scope), confidence: 1, inferenceLevel: 'explicit' as const, attributes: [] }; facts.events.push(e); return e }
  const point = (id: string, rawText: string, type: ObligationAuthorityFacts['timePoints'][number]['type'], fragment: string, owners: ObligationAuthorityFacts['timePoints'][number]['owners']) => facts.timePoints.push({ tempId: id, rawText, type, scopeIds: [scope(fragment)], owners, confidence: 1 })
  if (kind === 'equipment' || kind === 'registration') {
    const equipment = kind === 'equipment', name = equipment ? '远程研修' : '制图讲座', fragment = equipment ? '需自行准备' : '请于'
    const t = task('T1', equipment ? '准备' : '报名', equipment ? '笔记本' : name, fragment)
    const e = event(name, [fragment, equipment ? '09:00开始' : '14:00开始', equipment ? '结束时间尚未' : '15:00结束'])
    t.eventLinks = [{ eventId: e.tempId, scopeIds: [scope(fragment)] }]
    t.coverage.event.status = 'present'; t.coverage.time.status = 'present'
    if (equipment) t.condition = { value: 'unknown', conditionScopeIds: [scope('若已获')], factScopeIds: [] }
    else point('P0', '2026年11月6日17:00前', 'submission_deadline', fragment, [{ kind: 'task', entityId: t.id }])
    point('P1', equipment ? '2026年11月18日09:00' : '2026年11月9日14:00', 'event_start', equipment ? '09:00开始' : '14:00开始', [{ kind: 'event_start', entityId: 'E1' }])
    point('P2', equipment ? '结束时间尚未公布' : '15:00', 'event_end', equipment ? '结束时间尚未' : '15:00结束', [{ kind: 'event_end', entityId: 'E1' }])
  } else if (kind === 'shared-window') {
    const a = task('T1', '填写', '借用记录', '请填写'), b = task('T2', '激活', '借用账号', '请填写')
    const owners = [a, b].map(t => ({ kind: 'task' as const, entityId: t.id }))
    for (const t of [a, b]) { t.propositionScopeIds.push(scope('均可在')); t.coverage.time.status = 'present' }
    point('P1', '2026年11月10日09:00', 'window_start', '均可在', owners); point('P2', '2026年11月12日17:00', 'window_end', '均可在', owners)
  } else {
    event('网络服务在周五晚上维护', ['网络服务', '结束时间尚未'])
    point('P1', '周五晚上', 'event_start', '网络服务', [{ kind: 'event_start', entityId: 'E1' }]); point('P2', '结束时间尚未公布', 'event_end', '结束时间尚未', [{ kind: 'event_end', entityId: 'E1' }])
  }
  for (const s of context.index.scopes) {
    const ts = facts.tasks.filter(t => t.propositionScopeIds.includes(s.id)), es = facts.events.filter(e => e.scopeIds.includes(s.id))
    facts.scopeAccounting.push({ scopeId: s.id, kind: ts.length ? 'action' : es.length ? 'event' : 'information', primaryEntityIds: ts.length ? ts.map(t => t.id) : es.map(e => e.tempId) })
  }
  return { kind, sourceText, context, facts, rawHttpText: obligationEnvelope(facts), role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const }
}
