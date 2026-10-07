import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {SINGLE_AUTHORITY_VERSION,type SingleAuthorityFacts} from '../../recognition/sourceContractV5'
export async function createCompositionFixture(date = '2026年11月20日', title = '设计讨论') {
  const sourceText = `${title}\n${date}\n09:30-11:00\n仅供了解，无需报名。`
  const context = { index: await indexImmutableScopesV11('endpoint-test', 'endpoint-v1', sourceText), referenceTime: '2026-10-07T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const [name, ds, cs] = context.index.scopes
  const facts: SingleAuthorityFacts = { schemaVersion: SINGLE_AUTHORITY_VERSION, tasks: [], materials: [], revisions: [], conflicts: [], prerequisiteStates: [],
    events: [{ tempId: 'event', title, description: title, location: null, relatedTaskTempIds: [], attributes: [], scopeIds: [name.id, ds.id, cs.id], confidence: 1, inferenceLevel: 'explicit' }],
    timePoints: [
      { tempId: 'date', type: 'event_start', rawText: date, scopeIds: [ds.id], owners: [{ kind: 'event_start', entityId: 'event' }], confidence: 1 },
      { tempId: 'clock', type: 'event_start', rawText: cs.text, scopeIds: [cs.id], owners: [{ kind: 'event_start', entityId: 'event' }], confidence: 1 },
      { tempId: 'end', type: 'event_end', rawText: cs.text, scopeIds: [cs.id], owners: [{ kind: 'event_end', entityId: 'event' }], confidence: 1 },
    ], scopeAccounting: context.index.scopes.map(s => ({ scopeId: s.id, kind: [name.id, ds.id, cs.id].includes(s.id) ? 'event' : 'information', primaryEntityIds: [name.id, ds.id, cs.id].includes(s.id) ? ['event'] : [] })) }
  const envelope = (f = facts) => JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(f) }] }], usage: { input_tokens: 0, output_tokens: 0 } })
  return { sourceText, context, facts, envelope }
}
