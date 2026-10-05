import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { SOURCE_CONTRACT_VERSION, type SourceContractV4 } from '../../recognition/sourceContractV4'
import { createPublicNoticeFixture } from './publicNotices'

/** Hand-authored wires from publicly verified excerpts; never model outputs. */
export const CURRENT_NOTICE_CASES = [
  { id: 'heading-clock', label: '真实讲座：日期与时段分行', text: '活动信息\n时间\n2026年10月12日（周一）\n12:30-14:00\n地点\n海韵园办公楼A栋302室', referenceTime: '2026-09-29T09:00:00+08:00' },
  { id: 'midnight-deadline', label: '真实报名：6月30日24:00', text: '报名截止日期：2026年6月30日24:00\n申请人请于相应截止日期前登录报名网站: https://centralscience.xmu.edu.cn/进行网上申报。', referenceTime: '2026-05-20T09:00:00+08:00' },
] as const
export async function createCurrentNoticeFixture(id: string) {
  const row = CURRENT_NOTICE_CASES.find(c => c.id === id)
  if (!row) throw Error('CURRENT_NOTICE_FIXTURE_UNKNOWN')
  const sourceText: string = row.text, index = await indexImmutableScopesV11(id, id + '-v1', sourceText)
  const context = { index, referenceTime: row.referenceTime, timezone: 'Asia/Shanghai' }
  const facts: SourceContractV4 = { schemaVersion: SOURCE_CONTRACT_VERSION, tasks: [], materials: [], revisions: [], conflicts: [], prerequisiteStates: [], events: [], timePoints: [], scopeAccounting: [] }
  if (id === 'heading-clock') {
    const valueScopes = index.scopes.filter(s => /2026年|12:30/u.test(s.text)).map(s => s.id)
    facts.events.push({ tempId: 'E1', title: '活动信息', description: '', location: '海韵园办公楼A栋302室', startTimePointTempId: 'P0', endTimePointTempId: 'P1', relatedTaskTempIds: [], scopeIds: index.scopes.map(s => s.id), confidence: 1, inferenceLevel: 'explicit' })
    facts.timePoints.push(...['12:30', '14:00'].map((rawText, i) => ({ tempId: 'P' + i, type: i ? 'event_end' as const : 'event_start' as const, rawText, relatedTaskTempIds: [], relatedMaterialTempIds: [], scopeIds: valueScopes, confidence: 1 })))
    facts.scopeAccounting = index.scopes.map(s => ({ scopeId: s.id, kind: 'event', primaryEntityIds: ['E1'], secondaryEntityIds: /12:30/u.test(s.text) ? ['P0', 'P1'] : [] }))
  } else {
    const base = await createPublicNoticeFixture('PUB-C19-02'), task = structuredClone(base.facts.tasks[0])
    const action = index.scopes.find(s => s.text.includes('网上申报'))!, deadline = index.scopes.find(s => s.text.includes('24:00'))!
    task.id = 'T1'; task.action = { surface: '进行', scopeId: action.id }; task.object = { surface: '网上申报', scopeId: action.id }; task.actionType = 'register'
    task.propositionScopeIds = index.scopes.map(s => s.id)
    task.detail.title = '进行网上申报'; task.detail.completionCriteria = []
    task.condition = { value: 'not_applicable', conditionScopeIds: [], factScopeIds: [] }
    task.coverage = { time: { status: 'present', entityIds: ['P0'], scopeIds: [deadline.id] }, material: { status: 'not_stated', entityIds: [], scopeIds: [] }, event: { status: 'not_stated', entityIds: [], scopeIds: [] } }
    facts.tasks.push(task)
    facts.timePoints.push({ tempId: 'P0', type: 'registration_deadline', rawText: '2026年6月30日24:00', relatedTaskTempIds: ['T1'], relatedMaterialTempIds: [], scopeIds: [deadline.id], confidence: 1 })
    facts.scopeAccounting = index.scopes.map(s => ({ scopeId: s.id, kind: 'action', primaryEntityIds: ['T1'], secondaryEntityIds: s.id === deadline.id ? ['P0'] : [] }))
  }
  // The transport parser requires this model identity. The fixture role and
  // synthetic zero usage distinguish authored data from a paid recording.
  return { sourceText, context, facts, rawHttpText: JSON.stringify({ usage: { input_tokens: 0, output_tokens: 0 }, model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }] }), role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const }
}
