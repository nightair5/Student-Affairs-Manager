import { plainJson } from '../experiments/mainline04/semanticContract'
import { MAX_REQUEST_BYTES, type WireContext } from '../experiments/realInput01/modelWire'
import { buildSingleAuthorityRequest, SINGLE_AUTHORITY_SCHEMA, SINGLE_AUTHORITY_VERSION, type SingleAuthorityFacts } from './sourceContractV5'
import { decodeAuthorityProductRecording } from './singleAuthorityProduct'

export const OBLIGATION_AUTHORITY_VERSION = 'obligation-authority-source-contract-6.0.0' as const
export const OBLIGATION_CANDIDATE_VERSION = 'obligation-authority-generation-1.0.0'
export const OBLIGATION_PROMPT_VERSION = 'recognition-obligation-authority-1.0.0'
export const OBLIGATION_LOCAL_RELATION_VERSION = 'obligation-local-relation-1.0.0'
export type ObligationAuthorityFacts = Omit<SingleAuthorityFacts, 'schemaVersion' | 'tasks' | 'events'> & {
  schemaVersion: typeof OBLIGATION_AUTHORITY_VERSION
  tasks: Array<SingleAuthorityFacts['tasks'][number] & { eventLinks: Array<{ eventId: string; scopeIds: string[] }> }>
  events: Array<Omit<SingleAuthorityFacts['events'][number], 'relatedTaskTempIds'>>
}

export const OBLIGATION_AUTHORITY_SCHEMA = structuredClone(SINGLE_AUTHORITY_SCHEMA)
OBLIGATION_AUTHORITY_SCHEMA.properties!.schemaVersion = { type: 'string', const: OBLIGATION_AUTHORITY_VERSION }
const ids = { type: 'array', minItems: 1, maxItems: 200, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 4000 } }
const task = OBLIGATION_AUTHORITY_SCHEMA.properties!.tasks.items!
task.properties!.eventLinks = { type: 'array', maxItems: 200, uniqueItems: true, items: {
  type: 'object', additionalProperties: false, required: ['eventId', 'scopeIds'], properties: { eventId: ids.items, scopeIds: ids },
} }
task.required!.push('eventLinks')
Object.assign(task, { description: '先列每个独立义务的动作、对象、适用条件及前置。准备设备/提交/激活等动作不能放入事件附注。eventLinks是任务关联活动的一份权威声明，附逐字依据。' })
Object.assign(task.properties!.eventLinks, { description: '报名/准备等真实义务关联的活动；每条依据须同时被任务propositionScopeIds和对应事件scopeIds引用。不复制事件反向任务索引；无关联填空数组。' })
Object.assign(task.properties!.coverage, { description: '四态声明不替代事实：present必须能从实际材料、时间owners、eventLinks找到实体；not_stated/explicit_none/unknown仍分别保留。' })
const event = OBLIGATION_AUTHORITY_SCHEMA.properties!.events.items!
delete event.properties!.relatedTaskTempIds
event.required = event.required!.filter(k => k !== 'relatedTaskTempIds')
Object.assign(event.properties!.attributes, { description: '仅形式、互动、结果和真正地点附注。需/须/请准备等独立动作先列任务，不能被附注或完成标准吞掉。' })
Object.assign(OBLIGATION_AUTHORITY_SCHEMA.properties!.timePoints.items!.properties!.owners, { description: '时间的一份权威归属。多个动作共用窗口须逐个列真实task owner；事件起止使用event_start/event_end。未公布/模糊仍保留原文时间实体，不猜日期。' })
const order = ['schemaVersion', 'tasks', 'prerequisiteStates', 'events', 'timePoints', 'materials', 'revisions', 'conflicts', 'scopeAccounting']
OBLIGATION_AUTHORITY_SCHEMA.properties = Object.fromEntries(order.map(k => [k, OBLIGATION_AUTHORITY_SCHEMA.properties![k]]))
OBLIGATION_AUTHORITY_SCHEMA.required = order

type Schema = typeof OBLIGATION_AUTHORITY_SCHEMA
function matches(value: unknown, schema: Schema): boolean {
  if ('const' in schema) return value === schema.const
  if (schema.anyOf) return schema.anyOf.some(s => matches(value, s))
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'null') return value === null
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? 4000)
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? 200) && (!schema.uniqueItems || new Set(value.map(v => JSON.stringify(v))).size === value.length) && value.every(v => matches(v, schema.items!))
  if (schema.type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === schema.required!.length && schema.required!.every(k => Object.hasOwn(value, k) && matches((value as Record<string, unknown>)[k], schema.properties![k]))
  return false
}
const check = (ok: unknown, code: string) => { if (!ok) throw Error('OBLIGATION_AUTHORITY_' + code) }

/** Only invert explicit task links. No omitted obligation, owner or relationship is inferred. */
export function projectObligationAuthority(input: unknown, context: WireContext, localizeEvidenceMismatch = false) {
  const original = plainJson(input) as ObligationAuthorityFacts
  check(matches(original, OBLIGATION_AUTHORITY_SCHEMA), 'SHAPE')
  const relations: Array<{ taskId: string; eventId: string; scopeIds: string[] }> = []
  const quarantinedRelations: typeof relations = []
  const quarantinedPrerequisites: ObligationAuthorityFacts['prerequisiteStates'] = []
  for (const t of original.tasks) {
    const seen = new Set<string>()
    for (const link of t.eventLinks) {
      const e = original.events.find(e => e.tempId === link.eventId)
      check(e && !seen.has(link.eventId), 'EVENT_LINK_REFERENCE')
      check(link.scopeIds.every(id => context.index.scopes.some(s => s.id === id) && t.propositionScopeIds.includes(id)), 'EVENT_LINK_EVIDENCE')
      seen.add(link.eventId)
      if (!link.scopeIds.every(id => e!.scopeIds.includes(id))) {
        check(localizeEvidenceMismatch, 'EVENT_LINK_EVIDENCE')
        quarantinedRelations.push({ taskId: t.id, eventId: link.eventId, scopeIds: [...link.scopeIds] })
        continue
      }
      relations.push({ taskId: t.id, eventId: link.eventId, scopeIds: [...link.scopeIds] })
    }
  }
  const prerequisiteStates = original.prerequisiteStates.filter(p => {
    const t = original.tasks.find(t => t.id === p.taskId), predecessor = original.tasks.find(t => t.id === p.predecessorId)
    check(t && predecessor && p.factScopeIds.every(id => context.index.scopes.some(s => s.id === id)), 'PREREQUISITE_REFERENCE')
    if (!t!.detail.dependencyTempIds.includes(p.predecessorId) && localizeEvidenceMismatch) { quarantinedPrerequisites.push(p); return false }
    return true
  })
  const projected: SingleAuthorityFacts = { ...original, schemaVersion: SINGLE_AUTHORITY_VERSION,
    prerequisiteStates,
    tasks: original.tasks.map(({ eventLinks, ...t }) => { void eventLinks; return t }),
    events: original.events.map(e => ({ ...e, relatedTaskTempIds: relations.filter(r => r.eventId === e.tempId).map(r => r.taskId) })),
    conflicts: [...original.conflicts, ...quarantinedRelations.map((r, i) => ({ id: `event-link-risk-${i}`, type: 'other' as const,
      message: '该事项与活动的关联依据不完整，关联暂不采用；已有活动和无关联风险的内容仍可单独保存。',
      entityTempIds: [r.taskId], scopeIds: r.scopeIds, requiresDecision: true })), ...quarantinedPrerequisites.map((p, i) => ({ id: `prerequisite-link-risk-${i}`, type: 'other' as const,
      message: '前置状态与所声明的依赖不一致，不能当成已完成或可开始；该事项待核对，其他内容可单独保存。',
      entityTempIds: [p.taskId], scopeIds: p.factScopeIds, requiresDecision: true }))],
  }
  return { projected, audit: { version: OBLIGATION_AUTHORITY_VERSION, operation: 'TASK_EVENT_LINK_TO_INVERSE_INDEX_ONLY', inferredFacts: 0, relations,
    localRelations: { version: OBLIGATION_LOCAL_RELATION_VERSION, enabled: localizeEvidenceMismatch, quarantinedRelations, quarantinedPrerequisites }, original } }
}

export function decodeObligationProductRecording(raw: string, context: WireContext, role: 'EngineeringFixture' | 'SingleAuthority' = 'EngineeringFixture', localizeMissingCoverage=false, separatedWindowEvidence=false) {
  check(new TextEncoder().encode(raw).byteLength <= 524288, 'RESPONSE_SIZE')
  const envelope = JSON.parse(raw), messages = Array.isArray(envelope.output) ? envelope.output.filter((v: { type?: string }) => v.type === 'message') : []
  const texts = messages.flatMap((v: { content?: { type?: string; text?: string }[] }) => v.content?.filter(c => c.type === 'output_text') ?? [])
  check(texts.length === 1 && typeof texts[0].text === 'string', 'RESPONSE_TEXT')
  const projection = projectObligationAuthority(JSON.parse(texts[0].text), context, localizeMissingCoverage)
  texts[0].text = JSON.stringify(projection.projected)
  const decoded = decodeAuthorityProductRecording(JSON.stringify(envelope), context, role, localizeMissingCoverage, separatedWindowEvidence)
  return { ...decoded, result: { ...decoded.result, promptVersion: OBLIGATION_PROMPT_VERSION, modelName: role === 'EngineeringFixture' ? '义务先行匿名契约夹具（非模型输出）' : 'ObligationAuthority 固定录制（非实时调用）' },
    sidecar: { ...decoded.sidecar, originalResponse: raw, obligationAuthorityAudit: projection.audit } }
}

export const OBLIGATION_AUTHORITY_SYSTEM = `根据通知输出指定JSON，按Schema顺序先完成tasks和prerequisiteStates，再组织活动、时间、材料及逐片段覆盖；只输出JSON，不调用第二次核对。
第一层是最小义务：每个需要独立完成的动作+对象先有真实task，包括准备设备、报名、激活登录。资格condition回答适用性，dependencyTempIds/prerequisiteStates回答前一步是否完成；未给个人状态用unknown，不写true。已录取才参与等资格与准备后的顺序不能互相冒充。格式、材料名称、办理结果、纯说明和禁止不是独立动作；另需缴费等新动作也不能吞为criteria/地点附注。
第二层只声明一份关联：每项任务eventLinks列真实关联活动及该关系的scopeIds，依据同时出现在该task.propositionScopeIds及event.scopeIds；event不再生成relatedTaskTempIds反向副本，由程序派生。关系不明保留冲突/unknown，不能仅因同来源就相连。材料.relatedTaskTempIds、timePoints.owners仍为各自一份权威归属；同窗口适用于两个动作须列两个真实task owner，不许只写coverage present。
coverage四态逐类明确：present必须有对应真实实体和owner/eventLinks且absenceScopeIds为空；not_stated是没提，explicit_none引用明示没有，unknown保留未决。模糊、仅日期、未公布起止仍有time实体和原文rawText，日期由公共程序解释，不能补默认时刻。办理窗口window_start/window_end不能变deadline。
第三层保留独立事件和附属说明：无任务也保留事件、起止和明确未公布。一个活动一个event；真正独立不同活动分开。attributes只保留形式、互动、结业结果、地点附注，不替代已经识别的义务。scopeAccounting引用真实主task/event，附属引用和反向索引由程序派生；不能把scope当实体，不伪造遗漏事实覆盖。
所有事实保留逐字依据；材料格式、命名、明确目的地和完成标准保留，回执不冒充渠道。取消/替代用真实对象端点，未知端点保持风险。原文事实、个人状态与个人计划分开；不生成计划、不正式写入、不增加常识义务。`

export async function buildObligationAuthorityRequest(context: WireContext) {
  const base = await buildSingleAuthorityRequest(context), body = structuredClone(base.body)
  body.input[0].content[0].text = OBLIGATION_AUTHORITY_SYSTEM
  body.text.format.schema = OBLIGATION_AUTHORITY_SCHEMA
  const serialized = JSON.stringify(body)
  check(new TextEncoder().encode(serialized).byteLength <= MAX_REQUEST_BYTES, 'REQUEST_SIZE')
  return { ...base, body, serialized, candidateVersion: OBLIGATION_CANDIDATE_VERSION, promptVersion: OBLIGATION_PROMPT_VERSION, componentVersion: OBLIGATION_AUTHORITY_VERSION, dispatchAuthorized: false as const }
}
