import type { RecognitionResult } from './types'
import { assembleRecognitionFirstSuggestionD26 } from './firstSuggestionD26'

export const MATERIAL_CHANNEL_GROUNDING_VERSION = 'material-channel-role-grounding-1.2.0'
export interface MaterialChannelDecision {
  materialId: string
  materialName: string
  ownerIds: string[]
  originalValue: string
  displayedValue: string | null
  status: 'EXPLICIT_CHANNEL' | 'RECEIPT_CONTEXT_UNRESOLVED' | 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL'
  evidence: Array<{ id: string; quote: string }>
  roleChecks: Array<{ quote: string; object: string; polarity: 'AFFIRMATIVE' | 'NEGATED_OR_UNCERTAIN'; roleText: string; polarityText: string; unrelatedQualifier: string | null }>
}
export interface MaterialChannelAudit {
  version: typeof MATERIAL_CHANNEL_GROUNDING_VERSION
  role: 'PROGRAM_FIELD_GROUNDING_NOT_NEW_MODEL_OUTPUT'
  inferredFacts: 0
  decisions: MaterialChannelDecision[]
}
const compact = (text: string) => text.replace(/\s/gu, '')
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
/** Role evidence, not token overlap: a receipt is not an instruction to send there. */
function destinationRole(clause: string, object: string, channel: string) {
  const text = compact(clause), o = escaped(compact(object)), c = escaped(compact(channel))
  const action = '(?:提交|上传|递交|发送|交付|送交|交)'
  // Only a closed object/destination or a separate post-submission action can follow.
  // An object suffix ("清单照片") or destination suffix never counts as the same role.
  const end = '(?:$|[、：:（(]|(?:并|且|后)(?:保留|保存|等待|查看|核对|确认))'
  const matched = [
    new RegExp(`${action}${o}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`${o}(?:请|须|需|应)?${action}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`(?:把|将)${o}${action}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`(?:通过|经由|在)${c}(?:直接|统一|线上)?${action}${o}${end}`, 'u'),
    new RegExp(`${o}(?:的)?(?:提交渠道|提交地址|接收邮箱|提交入口)(?:为|是|：|:)${c}${end}`, 'u'),
  ].map(pattern => pattern.exec(text)).find(match => match !== null)
  if (!matched) return null
  // Literal object/destination names are values, not grammatical conditions (e.g. 若水).
  // Only an explicit separate receipt-printing note may be excluded. Other trailing
  // conditions, prohibitions and contradictions still participate in the decision.
  const receiptNote = /(?:并|且)(?:保留|保存)(?:电子)?回执([（(](?:无需|无须|不用|不必)打印(?:纸质版|纸质回执)?[）)])$/u.exec(text)
  const unrelatedQualifier = receiptNote?.[1] ?? null
  const polarityText = (unrelatedQualifier ? text.slice(0, -unrelatedQualifier.length) : text)
    .replaceAll(compact(object), '<对象>').replaceAll(compact(channel), '<渠道>')
  // Do not collapse a double negative, condition, example, or question into permission.
  const uncertain = /请勿|勿|不要|不得|不应|不可|不能|不准|不允许|禁止|不必|无需|无须|不用|尚未|未明确|不是|并非|未必|不一定|不建议|不推荐|若|如果|例如|假如|是否|能否/u.test(polarityText)
  return { polarity: uncertain ? 'NEGATED_OR_UNCERTAIN' as const : 'AFFIRMATIVE' as const,
    roleText: matched[0], polarityText, unrelatedQualifier }
}

/** Preserve the answer. Only source-supported destination roles become definite fields. */
export function groundMaterialChannels(input: RecognitionResult, sourceText: string) {
  const result = structuredClone(input)
  const audit: MaterialChannelAudit = { version: MATERIAL_CHANNEL_GROUNDING_VERSION, role: 'PROGRAM_FIELD_GROUNDING_NOT_NEW_MODEL_OUTPUT', inferredFacts: 0, decisions: [] }
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  for (const material of result.materials) {
    if (!material.submissionChannel) continue
    const originalValue = material.submissionChannel
    const owners = tasks.filter(t => material.relatedTaskTempIds.includes(t.tempId) && t.materialTempIds.includes(material.tempId))
    const ids = new Set([...material.evidenceIds, ...owners.flatMap(t => t.evidenceIds)])
    const evidence = result.evidence.filter(e => ids.has(e.id) && e.sourceId === result.evidence.find(r => material.evidenceIds.includes(r.id))?.sourceId
      && typeof e.quote === 'string' && sourceText.includes(e.quote)).map(e => ({ id: e.id, quote: e.quote! }))
    const clauses = evidence.flatMap(e => e.quote.split(/[，。；\n]/u))
    const objects = [...new Set([material.name, ...owners.map(t => t.actionObject)].filter(Boolean))]
    const roleChecks = clauses.flatMap(quote => objects.flatMap(object => {
      const check = destinationRole(quote, object, originalValue)
      return check ? [{ quote, object, ...check }] : []
    }))
    const contradictory = roleChecks.some(c => c.polarity === 'NEGATED_OR_UNCERTAIN')
    const direct = owners.length > 0 && !contradictory && roleChecks.some(c => c.polarity === 'AFFIRMATIVE')
    const receipt = !contradictory && clauses.some(c => c.includes(originalValue) && /显示|提示|回执|接收成功|收到成功/u.test(c))
      && owners.some(t => t.completionCriteria.some(c => c.includes(originalValue) && /显示|提示|回执|接收成功|收到成功/u.test(c) && evidence.some(e=>e.quote.includes(c))))
    const status = direct ? 'EXPLICIT_CHANNEL' : receipt ? 'RECEIPT_CONTEXT_UNRESOLVED' : 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL'
    audit.decisions.push({ materialId: material.tempId, materialName: material.name, ownerIds: material.relatedTaskTempIds, originalValue, displayedValue: direct ? originalValue : null, status, evidence, roleChecks })
    if (direct) continue
    // null here means unconfirmed destination, not "the source states no channel".
    material.submissionChannel = null
    const message = receipt ? `${material.name}的提交渠道原文未明确；“${originalValue}”仅出现在办结回执中，保留推测，不作为确定渠道。`
      : `${material.name}的提交渠道“${originalValue}”缺少同对象的明确依据；请核对关联事项。`
    if (!receipt) {
      result.quality.needsHumanReview = true
      result.quality.reviewReasons.push(message)
      result.conflicts.push({ id: 'material-channel:' + material.tempId, type: 'other', message,
        entityTempIds: [material.tempId, ...material.relatedTaskTempIds], evidenceIds: evidence.map(e => e.id), requiresDecision: true })
      owners.forEach(t => { t.selected = false })
    }
  }
  result.quality.reviewReasons = [...new Set(result.quality.reviewReasons)]
  return { result, audit }
}

/** Shared ordinary first screen; no change to candidate prompts, schema, or historical scorer. */
export function assembleCurrentFirstSuggestion(input: RecognitionResult, context: { sourceText: string; referenceTime: string; timezone: string }) {
  const first = assembleRecognitionFirstSuggestionD26(input, context)
  const channels = groundMaterialChannels(first.result, context.sourceText)
  return { ...first, result: channels.result, materialChannelAudit: channels.audit }
}
