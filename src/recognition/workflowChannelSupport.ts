import type { WireContext } from '../experiments/realInput01/modelWire'
import type { RoleAuthorityFacts } from './sourceContractV7'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const WORKFLOW_CHANNEL_SUPPORT_VERSION = 'workflow-channel-support-1.0.0'

export interface WorkflowChannelEvidence {
  sourceText: string
  channel: string
  channelQuotes: string[]
  taskQuotes: string[]
  actionSurface: string
  objectSurface: string
}
export interface WorkflowChannelProof {
  workflowText: string
  start: number
  end: number
  rule: 'SAME_SENTENCE_LOGIN_DIGITAL_STEPS'
}
export interface WorkflowMaterialSupport extends WorkflowChannelProof {
  materialId: string
  ownerTaskIds: string[]
  channel: string
  channelScopeIds: string[]
  taskScopeIds: string[]
  actionSurface: string
  objectSurface: string
  channelQuotes: string[]
  taskQuotes: string[]
  sourceId: string
  sourceVersionId: string
}

const compact = (text: string) => text.replace(/\s/gu, '')

function literalOccurrences(text: string, sourceText: string) {
  if (!text.trim()) return []
  const positions: number[] = [], chars: string[] = []
  for (let i = 0; i < sourceText.length; i++) if (!/\s/u.test(sourceText[i])) {
    positions.push(i); chars.push(sourceText[i])
  }
  const source = chars.join(''), value = compact(text), occurrences: Array<{ start: number; end: number }> = []
  for (let at = source.indexOf(value); at >= 0; at = source.indexOf(value, at + 1)) {
    occurrences.push({ start: positions[at], end: positions[at + value.length - 1] + 1 })
  }
  return occurrences
}
function uniqueLiteral(text: string, sourceText: string) {
  const occurrences = literalOccurrences(text, sourceText)
  return occurrences.length === 1 ? occurrences[0] : null
}
function citedLiteral(text: string, quotes: string[], sourceText: string) {
  if (!quotes.length) return null
  const spans = quotes.map(q => uniqueLiteral(q, sourceText))
  if (spans.some(s => !s)) return null
  const supported = literalOccurrences(text, sourceText).filter(literal => {
    for (let i = literal.start; i < literal.end; i++) if (!/\s/u.test(sourceText[i])
      && !spans.some(s => s && i >= s.start && i < s.end)) return false
    return true
  })
  return supported.length === 1 ? supported[0] : null
}

const digitalVerb = '(?:上传|提交|填写|填报)'
const negativeRole = /(?:请勿|不要|不得|不应|不可|不能|不准|禁止|取消|无需|不必)/u
const destinationSame = (value: string, channel: string) => {
  const destination = compact(value).replace(/[“”"'‘’]/gu, '')
  return destination === compact(channel).replace(/[“”"'‘’]/gu, '')
    || /^(?:该|本|此|上述)?系统(?:上|中|内)?$/u.test(destination)
}
const sameObject = (value: string, object: string) => compact(value).replace(/[“”"'‘’]/gu, '').replace(/^(?:该|这份|上述)/u, '')
  === compact(object).replace(/[“”"'‘’]/gu, '')

/** Inspect all channel authorities for the current object until the instruction
 * ends. An implicit label/parenthesis belongs to the current action only until
 * a new explicit object takes over; a later explicit same-object instruction
 * is still checked. This is a role check, not a collection of destination names. */
function hasConflictingChannelAuthority(suffix: string, object: string, channel: string) {
  let implicitCurrent = true
  for (const originalClause of suffix.split(/[，,]/u)) {
    const clause = compact(originalClause).replace(/^[（()）]+|[（()）]+$/gu, '')
    if (!clause) continue
    const normalized = clause.replaceAll(compact(channel), '<渠道>').replaceAll(compact(object), '<对象>')
    if (negativeRole.test(normalized) && (normalized.includes('<对象>') && /上传|提交|填写|填报|选择|点击/u.test(normalized)
      || /(?:使用|登录|(?:通过|在))<渠道>(?:上|中|内)?(?:办理|上传|提交)?$/u.test(normalized)
      || /(?:使用|登录)(?:该|这个|上述)(?:系统|平台|门户)$/u.test(normalized))) return true

    const declarations: Array<{ object: string | null; destination: string }> = []
    const core = clause.replace(/^(?:(?:但|并|且|另|另外|另行|请|须|需|应|务必))+/u, '')
    // Object-first disposal and action-first transfer share the same role.
    const disposal = new RegExp(`(?:将|把)(.+?)${digitalVerb}(?:至|到|给)([^（）()]+)`, 'u').exec(clause)
    if (disposal) declarations.push({ object: disposal[1], destination: disposal[2] })
    const topic = new RegExp(`^(.+?)${digitalVerb}(?:至|到|给)([^（）()]+)$`, 'u').exec(core)
    const topicObject = topic && !new RegExp(digitalVerb, 'u').test(topic[1]) ? topic[1] : null
    if (topicObject && !disposal) declarations.push({ object: topicObject, destination: topic![2] })
    const transfer = new RegExp(`${digitalVerb}(.*?)(?:至|到|给)([^（）()]+)`, 'u').exec(clause)
    if (transfer && !disposal && !topicObject) declarations.push({ object: transfer[1] || null, destination: transfer[2] })
    // "改用乙门户提交回执" and "通过乙门户上传回执" state a
    // channel for that named object; bare parentheses inherit the active object.
    const through = new RegExp(`(?:改用|换用|改为|通过|经由|在)(.+?)${digitalVerb}([^（）()]*)`, 'u').exec(clause)
    if (through) declarations.push({ object: through[2] || null, destination: through[1] })
    const label = /^(.*?)(?:提交渠道|上传渠道|提交入口|提交地址|接收邮箱)(?:为|是|：|:)([^（）()]+)$/u.exec(clause)
    if (label) {
      const subject = label[1].replace(/^(?:但|并|且|请|须|需|应|务必)+/u, '').replace(/的$/u, '')
      declarations.push({ object: subject || null, destination: label[2] })
    }
    const replacement = /(?:改用|换用|改为|转至)([^（）()]+)$/u.exec(clause)
    if (replacement && !through) declarations.push({ object: null, destination: replacement[1] })
    for (const declaration of declarations) {
      const owns: boolean = declaration.object === null ? implicitCurrent : sameObject(declaration.object, object)
      if (owns && !destinationSame(declaration.destination, channel)) return true
      if (declaration.object !== null) implicitCurrent = owns
    }
    // Another ordinary digital action can close the implicit property owner,
    // even if that action does not state a new channel itself.
    if (!declarations.length) {
      const nextAction = new RegExp(`${digitalVerb}([^（）()]+)$`, 'u').exec(clause)
      if (nextAction && !sameObject(nextAction[1], object)) implicitCurrent = false
    }
  }
  return false
}

/** A declared channel can govern subsequent digital steps in one instruction.
 * This verifies an existing declaration; it never finds a new channel, action,
 * owner or personal qualification from the rest of the notice. */
export function verifyWorkflowChannelEvidence(input: WorkflowChannelEvidence): WorkflowChannelProof | null {
  const { sourceText, channel, channelQuotes, taskQuotes, actionSurface, objectSurface } = input
  const channelSpan = citedLiteral(channel, channelQuotes, sourceText)
  const actionSpan = citedLiteral(actionSurface, taskQuotes, sourceText)
  const objectSpan = citedLiteral(objectSurface, taskQuotes, sourceText)
  if (!channelSpan || !actionSpan || !objectSpan || actionSpan.start <= channelSpan.end
    || objectSpan.start < actionSpan.start || objectSpan.end > actionSpan.end) return null
  // Only the immediately governing login, not a receipt or a bare system name.
  const before = sourceText.slice(0, channelSpan.start)
  const login = /登录\s*$/u.exec(before)
  if (!login) return null
  const start = login.index, between = sourceText.slice(channelSpan.end, actionSpan.start)
  // A new sentence, numbered item, paragraph or semicolon ends this authority.
  if (/[。；;\n\r]/u.test(between) || /(?:^|[，,])\s*\d+[.、]/u.test(between)) return null
  const digitalAction = /^(?:(?:请|须|需|应|务必|准确|并|再|然后)\s*)*(?:(?:在系统(?:上|中|内))\s*)?(点击|选择|填写|填报|上传|提交)/u
  if (!digitalAction.test(actionSurface)) return null
  const action = digitalAction.exec(actionSurface)![1]
  const suffix = sourceText.slice(actionSpan.end).split(/[。；;\n\r]/u)[0]
  // The wire may quote only "上传回执" while the source continues "至乙门户".
  // Inspect the complete current clause, not merely the declared action prefix.
  // A nonclosed object suffix (e.g. "回执照片") is also a different object.
  if (suffix && !/^[\s，,（(]/u.test(suffix)) return null
  if (hasConflictingChannelAuthority(suffix, objectSurface, channel)) return null
  // The inherited scope is digital. A physical transfer or a second named
  // destination is not made digital merely because the paragraph began here.
  const active = compact(between + actionSurface).replaceAll(compact(channel), '<渠道>')
    .replaceAll(compact(objectSurface), '<对象>')
  if (/(?:请勿|不要|不得|不必|无需|禁止|取消|如果|假如|例如|若)/u.test(active)) return null
  if (/(?:现场|线下|携带|带上|前往|递交|送交|交至|提交至|上传至|发送至|转到|切换)/u.test(active)) return null
  if (/(?:登录|打开|进入|通过|经由|在)[^，,（）()]{1,80}(?:系统|平台|门户|邮箱|网站|窗口|服务台)/u.test(active)) return null
  const prefixStart = Math.max(before.lastIndexOf('。'), before.lastIndexOf('；'), before.lastIndexOf('\n')) + 1
  const prefix = compact(sourceText.slice(prefixStart, channelSpan.start)).replaceAll(compact(objectSurface), '<对象>')
  if (/(?:请勿|不要|不得|不必|无需|禁止|取消|如果|假如|例如|若)/u.test(prefix)) return null
  // A substantive channel suffix closes at punctuation or a URL continuation;
  // a named system substring cannot steal the role of a longer system name.
  const afterChannel = sourceText.slice(channelSpan.end, actionSpan.start)
  if (!/^[\s，,（(]/u.test(afterChannel)) return null
  // At least one actual intervening UI step proves the channel's instruction
  // scope. Do not attach any later independent action in the same sentence.
  if (!/(?:点击|选择|填写|填报)/u.test(between) && !['点击', '选择', '填写', '填报'].includes(action)) return null
  // The proof records the complete authority interval that was reviewed,
  // including post-action declarations, rather than a harmless action prefix.
  const end = actionSpan.end + suffix.length
  return { workflowText: sourceText.slice(start, end), start, end,
    rule: 'SAME_SENTENCE_LOGIN_DIGITAL_STEPS' }
}

type ChannelInput = Pick<RoleAuthorityFacts, 'tasks' | 'materials'>
export function projectWorkflowChannelSupport<T extends ChannelInput>(input: T, context: WireContext) {
  const projected = structuredClone(input)
  const decisions: Array<{ taskId: string; channel: string; status: 'ALREADY_LOCAL' | 'DERIVED_WORKFLOW_SUPPORT' | 'NOT_PROVEN'; addedScopeIds: string[]; proof: WorkflowChannelProof | null }> = []
  const materialSupport: WorkflowMaterialSupport[] = []
  for (const original of input.tasks) {
    const channel = original.executionChannel
    if (!channel) continue
    const scope = (id: string) => context.index.scopes.find(s => s.id === id)
    const validIds = channel.scopeIds.length > 0 && new Set(channel.scopeIds).size === channel.scopeIds.length
      && channel.scopeIds.every(id => scope(id)) && original.propositionScopeIds.every(id => scope(id))
    const channelQuotes = channel.scopeIds.flatMap(id => scope(id)?.text ?? [])
    const taskQuotes = original.propositionScopeIds.flatMap(id => scope(id)?.text ?? [])
    const literal = validIds && hasLiteralScopeSpan(channel.surface, channel.scopeIds, context)
    const alreadyLocal = literal && channel.scopeIds.every(id => original.propositionScopeIds.includes(id))
    const proof = literal ? verifyWorkflowChannelEvidence({ sourceText: context.index.sourceContent,
      channel: channel.surface, channelQuotes, taskQuotes, actionSurface: original.action.surface,
      objectSurface: original.object.surface }) : null
    const addedScopeIds = !alreadyLocal && proof ? channel.scopeIds.filter(id => !original.propositionScopeIds.includes(id)) : []
    decisions.push({ taskId: original.id, channel: channel.surface,
      status: alreadyLocal ? 'ALREADY_LOCAL' : proof ? 'DERIVED_WORKFLOW_SUPPORT' : 'NOT_PROVEN', addedScopeIds, proof })
    if (addedScopeIds.length) projected.tasks.find(t => t.id === original.id)!.propositionScopeIds.push(...addedScopeIds)
    if (!proof) continue
    for (const material of input.materials.filter(m => m.relatedTaskTempIds.includes(original.id)
      && m.submissionChannel === channel.surface && m.scopeIds.every(id => scope(id))
      && hasLiteralScopeSpan(m.name, m.scopeIds.filter(id => scope(id)?.text.includes(m.name)), context))) {
      // A login context cannot turn a form selector into a material submission.
      if (!/上传|提交/u.test(original.action.surface)
        || !compact(original.object.surface).includes(compact(material.name))) continue
      materialSupport.push({ ...proof, materialId: material.tempId, ownerTaskIds: [original.id],
        channel: channel.surface, channelScopeIds: [...channel.scopeIds], taskScopeIds: [...original.propositionScopeIds],
        actionSurface: original.action.surface, objectSurface: original.object.surface, channelQuotes, taskQuotes,
        sourceId: context.index.sourceId, sourceVersionId: context.index.sourceVersionId })
    }
  }
  return { projected, audit: { version: WORKFLOW_CHANNEL_SUPPORT_VERSION,
    operation: 'EXISTING_CHANNEL_WORKFLOW_TO_DERIVED_TASK_SUPPORT', inferredFacts: 0 as const, decisions, materialSupport } }
}
