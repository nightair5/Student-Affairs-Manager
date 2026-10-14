import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { SOURCE_CONTRACT_VERSION, type SourceContractV4, type CoverageClaim } from '../../recognition/sourceContractV4'
import type { WireContext } from '../realInput01/modelWire'

export const CONTRACT_FIXTURE_KINDS = ['event', 'deadline', 'dependency', 'mixed', 'revision'] as const
export type ContractFixtureKind = typeof CONTRACT_FIXTURE_KINDS[number]
const texts: Record<ContractFixtureKind, string> = {
  event: '班车订座网站将在周五晚上暂停服务。现有预约不受影响，不用提交任何说明。',
  deadline: '请于2026年11月6日15:20前递交器材清单。器材清单必须为PDF，文件名用学院和姓名。',
  dependency: '先填写借用记录。填写完成后提交借用记录。借用资格尚未公布，只有符合资格才能领取储物柜钥匙。本通知未设截止日期。',
  mixed: '请于2026年11月6日15:20前递交器材清单。器材清单必须为PDF。器材讲解会于2026年11月7日14:00开始，15:00结束。系统维护在周五晚上开始，结束时间尚未公布。',
  revision: '原寄送纸质申请的要求已取消。现在改为上传电子申请。请保存受理编号。',
}
const emptyClaim = (): CoverageClaim => ({ status: 'not_stated', entityIds: [], scopeIds: [] })
/** Independent anonymous product inputs; role is always engineering, never an actual first answer. */
export async function createContractFixture(kind: ContractFixtureKind, identity?: { sourceId: string; sourceVersionId: string }) {
  const sourceText = texts[kind], sourceId = identity?.sourceId ?? `contract-fixture-${kind}`, sourceVersionId = identity?.sourceVersionId ?? sourceId + '-v1'
  const context: WireContext = { index: await indexImmutableScopesV11(sourceId, sourceVersionId, sourceText), referenceTime: '2026-10-03T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const scopes = (fragment: string) => context.index.scopes.filter(s => s.text.includes(fragment)).map(s => s.id)
  const one = (fragment: string) => { const id = scopes(fragment)[0]; if (!id) throw Error('CONTRACT_FIXTURE_SOURCE'); return id }
  const facts: SourceContractV4 = { schemaVersion: SOURCE_CONTRACT_VERSION, tasks: [], materials: [], timePoints: [], events: [], revisions: [], conflicts: [], scopeAccounting: [], prerequisiteStates: [] }
  const task = (id: string, action: string, object: string, fragment: string) => {
    const scopeId = one(fragment)
    const t: SourceContractV4['tasks'][number] = { id, propositionScopeIds: [scopeId], semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }, inferenceLevel: 'explicit', actionType: 'other', action: { surface: action, scopeId }, object: { surface: object, scopeId }, effect: 'local_change',
      detail: { parentTempId: null, hierarchyType: 'task', title: action + object, description: '', completionCriteria: [], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], confidence: 1, userConfirmationRequired: true }, condition: { value: 'not_applicable', conditionScopeIds: [], factScopeIds: [] }, coverage: { time: emptyClaim(), material: emptyClaim(), event: emptyClaim() } }
    facts.tasks.push(t); return t
  }
  const point = (id: string, rawText: string, type: SourceContractV4['timePoints'][number]['type'], fragment: string, tasks: string[] = []) => {
    const p = { tempId: id, type, rawText, relatedTaskTempIds: tasks, relatedMaterialTempIds: [], scopeIds: [one(fragment)], confidence: 1 }; facts.timePoints.push(p); return p
  }
  if (kind === 'deadline' || kind === 'mixed') {
    const t = task('T1', '递交', '器材清单', '请于')
    const materialScopes = [one('器材清单必须'), ...(kind === 'deadline' ? [one('文件名用')] : [])]
    t.propositionScopeIds.push(...materialScopes)
    t.detail.completionCriteria = kind === 'deadline' ? ['器材清单必须为PDF', '文件名用学院和姓名'] : ['器材清单必须为PDF']
    facts.materials.push({ tempId: 'M1', name: '器材清单', required: true, formatRequirements: ['PDF'], namingRequirements: kind === 'deadline' ? ['学院和姓名'] : [], quantity: null, submissionChannel: null, relatedTaskTempIds: ['T1'], scopeIds: materialScopes, confidence: 1 })
    t.coverage.material = { status: 'present', entityIds: ['M1'], scopeIds: materialScopes }
    const p = point('P1', '2026年11月6日15:20前', 'submission_deadline', '请于', ['T1'])
    t.coverage.time = { status: 'present', entityIds: ['P1'], scopeIds: p.scopeIds }
  }
  if (kind === 'event' || kind === 'mixed') {
    const title = kind === 'event' ? '班车订座网站将在周五晚上暂停服务' : '系统维护', fragment = kind === 'event' ? '班车订座' : '系统维护'
    const start = point('P2', '周五晚上', 'event_start', fragment)
    const end = kind === 'mixed' ? point('P3', '结束时间尚未公布', 'event_end', '结束时间') : null
    facts.events.push({ tempId: 'E1', title, description: '', location: null, startTimePointTempId: start.tempId, endTimePointTempId: end?.tempId ?? null, relatedTaskTempIds: [], scopeIds: [one(fragment), ...(end ? [one('结束时间')] : [])], confidence: 1, inferenceLevel: 'explicit' })
    if (kind === 'mixed') {
      const start = point('P4', '2026年11月7日14:00', 'event_start', '器材讲解会'), end = point('P5', '15:00', 'event_end', '15:00结束')
      facts.events.push({ tempId: 'E2', title: '器材讲解会', description: '', location: null, startTimePointTempId: start.tempId, endTimePointTempId: end.tempId, relatedTaskTempIds: [], scopeIds: [one('器材讲解会'), one('15:00结束')], confidence: 1, inferenceLevel: 'explicit' })
    }
  }
  if (kind === 'dependency') {
    task('T1', '填写', '借用记录', '先填写')
    const t = task('T2', '提交', '借用记录', '填写完成后')
    t.detail.dependencyTempIds = ['T1']
    facts.prerequisiteStates.push({ taskId: 'T2', predecessorId: 'T1', completion: 'unknown', factScopeIds: [] })
    const q = task('T3', '领取', '储物柜钥匙', '只有符合')
    q.condition = { value: 'unknown', conditionScopeIds: [one('只有符合')], factScopeIds: [one('资格尚未')] }
  }
  if (kind === 'revision') {
    const old = task('T1', '寄送', '纸质申请', '原寄送')
    old.semantics.status = 'cancelled'; old.semantics.validity = 'superseded'
    task('T2', '上传', '电子申请', '现在改为')
    task('T3', '保存', '受理编号', '请保存')
    facts.revisions.push({ type: 'supersedes', targetDirectiveId: 'T1', fromDirectiveId: 'T2', effective: 'true', scopeIds: [one('原寄送'), one('现在改为')] })
  }
  for (const scope of context.index.scopes) {
    const events = facts.events.filter(e => e.scopeIds.includes(scope.id)), tasks = facts.tasks.filter(t => t.propositionScopeIds.includes(scope.id))
    const primary = events.length ? events.map(e => e.tempId) : tasks.map(t => t.id)
    const secondary = [...facts.materials, ...facts.timePoints].filter(e => e.scopeIds.includes(scope.id)).map(e => e.tempId)
    facts.scopeAccounting.push({ scopeId: scope.id, kind: events.length ? 'event' : tasks.length ? 'action' : 'information', primaryEntityIds: primary, secondaryEntityIds: primary.length ? secondary : [] })
  }
  const rawHttpText = JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }], usage: { input_tokens: 0, output_tokens: 0 } })
  return { kind, context, facts, sourceText, rawHttpText, role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const }
}
