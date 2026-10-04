import type { RecognitionResult } from './types'
import { assembleRecognitionFirstSuggestionD26 } from './firstSuggestionD26'

export const MATERIAL_CHANNEL_GROUNDING_VERSION = 'material-channel-role-grounding-1.0.0'
export interface MaterialChannelDecision {
  materialId: string
  materialName: string
  ownerIds: string[]
  originalValue: string
  displayedValue: string | null
  status: 'EXPLICIT_CHANNEL' | 'RECEIPT_CONTEXT_UNRESOLVED' | 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL'
  evidence: Array<{ id: string; quote: string }>
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
function explicitDestination(clause: string, object: string, channel: string) {
  const text = compact(clause), o = escaped(compact(object)), c = escaped(compact(channel))
  if (/不要|不得|不必|无需|禁止|尚未|未明确|不是|若|如果|例如|假如/u.test(text)) return false
  return [
    new RegExp(`(?:提交|上传|递交|发送|交付|送交)${o}(?:至|到|给)${c}(?:$|[、：:（(])`, 'u'),
    new RegExp(`${o}(?:上传|提交|递交|发送)(?:至|到|给)${c}(?:$|[、：:（(])`, 'u'),
    new RegExp(`(?:通过|经由|在)${c}(?:直接|统一|线上)?(?:提交|上传|递交|发送)${o}(?:$|[、：:（(])`, 'u'),
    new RegExp(`${o}(?:的)?(?:提交渠道|提交地址|接收邮箱|提交入口)(?:为|是|：|:)${c}(?:$|[、：:（(])`, 'u'),
  ].some(pattern => pattern.test(text))
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
    const direct = owners.length > 0 && clauses.some(c => [material.name, ...owners.map(t => t.actionObject)].some(o => o && explicitDestination(c, o, originalValue)))
    const receipt = clauses.some(c => c.includes(originalValue) && /显示|提示|回执|接收成功|收到成功/u.test(c))
      && owners.some(t => t.completionCriteria.some(c => c.includes(originalValue) && /显示|提示|回执|接收成功|收到成功/u.test(c) && evidence.some(e=>e.quote.includes(c))))
    const status = direct ? 'EXPLICIT_CHANNEL' : receipt ? 'RECEIPT_CONTEXT_UNRESOLVED' : 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL'
    audit.decisions.push({ materialId: material.tempId, materialName: material.name, ownerIds: material.relatedTaskTempIds, originalValue, displayedValue: direct ? originalValue : null, status, evidence })
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
