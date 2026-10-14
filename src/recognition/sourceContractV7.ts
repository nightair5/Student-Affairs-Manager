import { plainJson } from '../experiments/mainline04/semanticContract'
import { MAX_REQUEST_BYTES, type WireContext } from '../experiments/realInput01/modelWire'
import { buildObligationAuthorityRequest, decodeObligationProductRecording, OBLIGATION_AUTHORITY_SCHEMA, OBLIGATION_AUTHORITY_VERSION, type ObligationAuthorityFacts } from './sourceContractV6'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const ROLE_AUTHORITY_VERSION = 'role-authority-source-contract-7.0.0' as const
export const ROLE_CANDIDATE_VERSION = 'role-authority-generation-1.0.0'
export const ROLE_PROMPT_VERSION = 'recognition-role-authority-1.0.0'
export const ROLE_LOCAL_CHANNEL_VERSION = 'role-local-channel-evidence-1.0.0'
type Task = ObligationAuthorityFacts['tasks'][number]
export type RoleAuthorityFacts = Omit<ObligationAuthorityFacts, 'schemaVersion' | 'tasks'> & {
  schemaVersion: typeof ROLE_AUTHORITY_VERSION
  tasks: Array<Omit<Task, 'semantics'> & {
    semantics: Omit<Task['semantics'], 'modality'>
    participation: { mode: Task['semantics']['modality']; scopeIds: string[] }
    executionChannel: { surface: string; scopeIds: string[] } | null
  }>
}
export const ROLE_AUTHORITY_SCHEMA = structuredClone(OBLIGATION_AUTHORITY_SCHEMA)
ROLE_AUTHORITY_SCHEMA.properties!.schemaVersion = { type: 'string', const: ROLE_AUTHORITY_VERSION }
const task = ROLE_AUTHORITY_SCHEMA.properties!.tasks.items!
const semantics = task.properties!.semantics
const modality = semantics.properties!.modality
delete semantics.properties!.modality
semantics.required = semantics.required!.filter(k => k !== 'modality')
const scopeIds = { type: 'array', minItems: 0, maxItems: 200, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 4000 } }
task.properties!.participation = { type: 'object', additionalProperties: false, required: ['mode', 'scopeIds'], properties: { mode: modality, scopeIds } }
task.properties!.executionChannel = { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['surface', 'scopeIds'], properties: { surface: { type: 'string', minLength: 1, maxLength: 4000 }, scopeIds: { ...scopeIds, minItems: 1 } } }] }
task.required!.push('participation', 'executionChannel')
Object.assign(task.properties!.participation, { description: '参与意愿/要求的唯一权威声明，程序派生modality。欢迎、有意、可报名是optional，不是个人资格unknown；须/需办理是required。mode非unknown必须引用原文依据。' })
Object.assign(task.properties!.condition, { description: '仅适用资格/条件及个人事实。录取、年级、资格未知为unknown；无资格限制为not_applicable。不要将有意参加、愿意报名当资格；不要将报名完成当录取。' })
Object.assign(task.properties!.object, { description: '动作真正针对的业务对象，报名应针对通知明确的活动。二维码/链接/系统通常是办理渠道，不是活动或报名对象；无对象依据不能猜名称。' })
Object.assign(task.properties!.executionChannel, { description: '可选的办理方式/渠道，独立引用逐字surface及依据，如下方二维码。它不取代object，不自动变成必备材料或另一任务；原文没有则null。' })
Object.assign(ROLE_AUTHORITY_SCHEMA.properties!.prerequisiteStates, { description: '仅已声明dependencyTempIds的真实前置动作完成状态。资格录取不是报名动作完成，不虚构录取task；个人完成情况未说明保留unknown。' })

type Schema = typeof ROLE_AUTHORITY_SCHEMA
function matches(v: unknown, s: Schema): boolean {
  if ('const' in s) return v === s.const
  if (s.anyOf) return s.anyOf.some(a => matches(v, a))
  if (s.enum && !s.enum.includes(v)) return false
  if (s.type === 'null') return v === null
  if (s.type === 'string') return typeof v === 'string' && v.length >= (s.minLength ?? 0) && v.length <= (s.maxLength ?? 4000)
  if (s.type === 'number') return typeof v === 'number' && Number.isFinite(v) && v >= (s.minimum ?? -Infinity) && v <= (s.maximum ?? Infinity)
  if (s.type === 'boolean') return typeof v === 'boolean'
  if (s.type === 'array') return Array.isArray(v) && v.length >= (s.minItems ?? 0) && v.length <= (s.maxItems ?? 200) && (!s.uniqueItems || new Set(v.map(a => JSON.stringify(a))).size === v.length) && v.every(a => matches(a, s.items!))
  if (s.type === 'object') return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === s.required!.length && s.required!.every(k => Object.hasOwn(v, k) && matches((v as Record<string, unknown>)[k], s.properties![k]))
  return false
}
const check = (v: unknown, code: string) => { if (!v) throw Error('ROLE_AUTHORITY_' + code) }

/** One participation authority; literal channels become ordinary description,
 * not new tasks/materials/eligibility. Every original declaration is audited. */
export function projectRoleAuthority(input: unknown, context: WireContext, localizeEvidenceMismatch = false) {
  const original = plainJson(input) as RoleAuthorityFacts
  check(matches(original, ROLE_AUTHORITY_SCHEMA), 'SHAPE')
  const quarantinedChannels: Array<{ taskId: string; declaration: NonNullable<RoleAuthorityFacts['tasks'][number]['executionChannel']> }> = []
  const decisions = original.tasks.map(t => {
    const p = t.participation, c = t.executionChannel
    check((p.mode === 'unknown' || p.scopeIds.length > 0) && p.scopeIds.every(id => t.propositionScopeIds.includes(id) && context.index.scopes.some(s => s.id === id)), 'PARTICIPATION_EVIDENCE')
    if (c) {
      check(c.scopeIds.every(id => context.index.scopes.some(s => s.id === id)), 'CHANNEL_REFERENCE')
      if (!c.scopeIds.every(id => t.propositionScopeIds.includes(id)) || !hasLiteralScopeSpan(c.surface, c.scopeIds, context)) {
        check(localizeEvidenceMismatch, 'CHANNEL_EVIDENCE')
        quarantinedChannels.push({ taskId: t.id, declaration: structuredClone(c) })
      }
    }
    return { taskId: t.id, participation: p, executionChannel: c }
  })
  const projected: ObligationAuthorityFacts = { ...original, schemaVersion: OBLIGATION_AUTHORITY_VERSION,
    tasks: original.tasks.map(({ participation, executionChannel: declaredChannel, ...t }) => {
      const executionChannel = quarantinedChannels.some(c => c.taskId === t.id) ? null : declaredChannel
      return { ...t,
      semantics: { ...t.semantics, modality: participation.mode },
      detail: { ...t.detail, description: executionChannel && !t.detail.description.includes(executionChannel.surface)
        ? [t.detail.description, `办理方式：${executionChannel.surface}`].filter(Boolean).join('；') : t.detail.description },
      }
    }),
    conflicts: [...original.conflicts, ...quarantinedChannels.map((c, i) => ({ id: `channel-evidence-risk-${i}`, type: 'other' as const,
      message: '这项事项的办理渠道引用不完整，渠道暂不采用；请核对该事项，其他有依据的内容可单独保存。',
      entityTempIds: [c.taskId], scopeIds: c.declaration.scopeIds, requiresDecision: true }))],
  }
  return { projected, audit: { version: ROLE_AUTHORITY_VERSION, inferredFacts: 0, operation: 'PARTICIPATION_TO_MODALITY_LITERAL_CHANNEL_TO_DESCRIPTION', decisions,
    localChannels: { version: ROLE_LOCAL_CHANNEL_VERSION, enabled: localizeEvidenceMismatch, quarantinedChannels }, original } }
}
export function decodeRoleProductRecording(raw: string, context: WireContext, role: 'EngineeringFixture' | 'SingleAuthority' = 'EngineeringFixture', localizeMissingCoverage = false, separatedWindowEvidence = false) {
  check(new TextEncoder().encode(raw).byteLength <= 524288, 'RESPONSE_SIZE')
  const envelope = JSON.parse(raw), texts = Array.isArray(envelope.output) ? envelope.output.filter((v: { type?: string }) => v.type === 'message').flatMap((v: { content?: Array<{ type?: string; text?: string }> }) => v.content?.filter(c => c.type === 'output_text') ?? []) : []
  check(texts.length === 1 && typeof texts[0].text === 'string', 'RESPONSE_TEXT')
  const projection = projectRoleAuthority(JSON.parse(texts[0].text), context, localizeMissingCoverage)
  texts[0].text = JSON.stringify(projection.projected)
  const d = decodeObligationProductRecording(JSON.stringify(envelope), context, role, localizeMissingCoverage, separatedWindowEvidence)
  return { ...d, result: { ...d.result, promptVersion: ROLE_PROMPT_VERSION, modelName: role === 'EngineeringFixture' ? '角色分离匿名契约夹具（非模型输出）' : 'RoleAuthority 固定录制（非实时调用）' }, sidecar: { ...d.sidecar, originalResponse: raw, roleAuthorityAudit: projection.audit } }
}
export const ROLE_AUTHORITY_SYSTEM = `依据原文输出Schema指定的JSON。先识别每个独立动作及真正业务对象，再声明参与方式、资格、前置、渠道，最后声明活动、时间和覆盖。
participation是任务要求/意愿的唯一权威字段；optional表示可选择参加，required表示原文要求办理。condition只表示资格与适用条件，不能将有意参加变成资格unknown。已经录取是资格，报名动作完成不等于录取；dependency只连原文明确的前置动作。个人资格或完成状态未说明不能写true。
报名的object是原文明示的活动，二维码/链接/系统放executionChannel，不能拿渠道替代报名对象；不额外制造二维码材料。准备终端设备等独立义务必须是task，不能吞成附注。对象依据不足时保留风险，不猜名称。
task.eventLinks、timePoints.owners、materials.relatedTaskTempIds各自只声明一份权威关系，程序生成反向索引。任务关联的scopeIds同时出现在任务和活动引用；不能因同来源就自动连所有对象。办理窗口与截止分开，共用窗口列所有真实owner。
无任务也保留独立事件、模糊及明确未公布的起止。未公布normalizedValue由程序保留null，不补具体时刻。coverage present必须有真实实体及关联，没提、明确没有、未知不混淆。材料格式、命名、明确目的地、办结标准和取消/修订端点完整保留；回执不冒充渠道。
所有内容必须有逐字依据；不新增常识义务，不输出个人计划，不正式写入。只生成一次JSON，不进行额外repair或verifier。`
export async function buildRoleAuthorityRequest(context: WireContext) {
  const base = await buildObligationAuthorityRequest(context), body = structuredClone(base.body)
  body.input[0].content[0].text = ROLE_AUTHORITY_SYSTEM
  body.text.format.schema = ROLE_AUTHORITY_SCHEMA
  const serialized = JSON.stringify(body)
  check(new TextEncoder().encode(serialized).byteLength <= MAX_REQUEST_BYTES, 'REQUEST_SIZE')
  return { ...base, body, serialized, candidateVersion: ROLE_CANDIDATE_VERSION, promptVersion: ROLE_PROMPT_VERSION, componentVersion: ROLE_AUTHORITY_VERSION, dispatchAuthorized: false as const }
}
