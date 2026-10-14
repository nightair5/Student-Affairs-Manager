import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { SOURCE_CONTRACT_VERSION, type SourceContractV4 } from '../../recognition/sourceContractV4'

/** Authored alternative expressions, not model outputs or independent truth. */
export const EVENT_LABEL_CASES = [
  { id: 'event-label-handling', object: '数据查询服务', label: '暂停办理时间', start: '2026年6月3日16:40', end: '2026年6月5日9:10' },
  { id: 'event-label-operation', object: '设备借用服务', label: '服务暂停运行时段', start: '2026年7月6日10:20', end: '2026年7月8日11:30' },
] as const
export async function createEventLabelFixture(id: string, labelOverride?: string) {
  const row = EVENT_LABEL_CASES.find(c => c.id === id)
  if (!row) throw Error('EVENT_LABEL_FIXTURE_UNKNOWN')
  const label = labelOverride ?? row.label
  const sourceText = `为配合设备维护，${row.object}将临时暂停，暂停期间无法办理。\n${label}：${row.start}—${row.end}`
  const index = await indexImmutableScopesV11(id, id + '-v1', sourceText)
  const context = { index, referenceTime: '2026-06-01T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const timeScope = index.scopes.find(s => s.text.includes(row.start))!
  const header = index.scopes.find(s => s.text.includes(label))!
  const primary = index.scopes.find(s => s.text.includes(row.object))!
  const facts: SourceContractV4 = {
    schemaVersion: SOURCE_CONTRACT_VERSION, tasks: [], materials: [], revisions: [], conflicts: [], prerequisiteStates: [],
    events: [{ tempId: 'E1', title: row.object, description: '为配合设备维护，暂停期间无法办理。', location: null,
      startTimePointTempId: 'P0', endTimePointTempId: 'P1', relatedTaskTempIds: [], scopeIds: index.scopes.map(s => s.id), confidence: 1, inferenceLevel: 'explicit' }],
    timePoints: [row.start, row.end].map((rawText, i) => ({ tempId: 'P' + i, type: i ? 'event_end' : 'event_start', rawText,
      relatedTaskTempIds: [], relatedMaterialTempIds: [], scopeIds: [timeScope.id], confidence: 1 })),
    scopeAccounting: index.scopes.map(s => ({ scopeId: s.id, kind: s.id === primary.id || s.id === timeScope.id ? 'event' : 'information',
      primaryEntityIds: s.id === primary.id || s.id === timeScope.id ? ['E1'] : [],
      secondaryEntityIds: s.id === timeScope.id || s.id === header.id ? ['P0', 'P1'] : s.id === primary.id ? [] : ['E1'] })),
  }
  return { sourceText, context, facts, rawHttpText: JSON.stringify({ model: 'deepseek-flash', status: 'completed', usage: { input_tokens: 0, output_tokens: 0 }, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }] }), role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const }
}
