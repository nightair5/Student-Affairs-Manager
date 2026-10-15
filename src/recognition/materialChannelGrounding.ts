import type { RecognitionResult } from './types'
import { assembleRecognitionFirstSuggestionD26 } from './firstSuggestionD26'
import { groundSourceWindows } from './sourceWindowGrounding'
import { groundSourceActionTimes, type SourceActionTimeDeclaration } from './sourceActionTime'
import { verifyWorkflowChannelEvidence, type WorkflowMaterialSupport } from './workflowChannelSupport'
import {citedDeliveryContexts,type CitedDeliveryContext} from './citedDeliveryContext'

export const MATERIAL_CHANNEL_GROUNDING_VERSION = 'material-channel-role-grounding-1.5.0'
export const WORKFLOW_MATERIAL_CHANNEL_VERSION = 'material-declared-workflow-channel-1.0.0'
export interface MaterialChannelDecision {
  materialId: string
  materialName: string
  ownerIds: string[]
  originalValue: string
  displayedValue: string | null
  status: 'EXPLICIT_CHANNEL' | 'EXPLICIT_OWNER_CHANNELS' | 'EXPLICIT_WORKFLOW_CHANNEL' | 'RECEIPT_CONTEXT_UNRESOLVED' | 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL'
  evidence: Array<{ id: string; quote: string }>
  roleChecks: Array<{ quote: string; object: string; polarity: 'AFFIRMATIVE' | 'NEGATED_OR_UNCERTAIN'; roleText: string; polarityText: string; unrelatedQualifier: string | null }>
  workflowProof?: WorkflowMaterialSupport
  citedContextProof?: CitedDeliveryContext
}
export interface MaterialChannelAudit {
  version: typeof MATERIAL_CHANNEL_GROUNDING_VERSION | typeof WORKFLOW_MATERIAL_CHANNEL_VERSION
  role: 'PROGRAM_FIELD_GROUNDING_NOT_NEW_MODEL_OUTPUT'
  inferredFacts: 0
  decisions: MaterialChannelDecision[]
}
const compact = (text: string) => text.replace(/\s/gu, '')
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
function citedClauses(evidence: Array<{quote:string}>, sourceText: string) {
  // The scope tokenizer may split https: from //host. Rejoin only uniquely
  // located, byte-adjacent cited fragments, never scan uncited paragraph text.
  const spans = evidence.flatMap(e => {const at=sourceText.indexOf(e.quote);return at>=0&&sourceText.indexOf(e.quote,at+1)<0?[{start:at,end:at+e.quote.length}]:[]}).sort((a,b)=>a.start-b.start)
  const joined: Array<{start:number;end:number}> = []
  for(const span of spans){const previous=joined.at(-1);if(previous&&span.start<=previous.end)previous.end=Math.max(previous.end,span.end);else joined.push({...span})}
  return [...new Set([...evidence.map(e=>e.quote),...joined.map(s=>sourceText.slice(s.start,s.end))])].flatMap(q=>q.split(/[，。；\n]/u))
}
/** Role evidence, not token overlap: a receipt is not an instruction to send there. */
function destinationRole(clause: string, object: string, channel: string, siblingObjects: string[] = []) {
  let text = compact(clause)
  const o = escaped(compact(object))
  // A label and its URL may be displayed together even when the original URL
  // follows the registration object. Both literal values must occur in this
  // same clause; never accept a URL borrowed from another item or paragraph.
  const composite = /^(.*?)[（(](https:\/\/[^\s（）()]+)[）)]$/u.exec(compact(channel))
  const label = composite?.[1] ?? compact(channel)
  if (composite) {
    const suffix = new RegExp(`${o}(?:登记|填报|注册)?[（(]${escaped(composite[2])}[）)]$`, 'u')
    if (!label || !suffix.test(text)) return null
    text = text.replace(new RegExp(`[（(]${escaped(composite[2])}[）)]$`, 'u'), '')
  }
  const c = escaped(label)
  const action = '(?:提交|上传|递交|发送|交付|送交|交)'
  const statedTime='(?:(?:当日|同日|当天)|(?:(?:\\d{4}年)?\\d{1,2}月\\d{1,2}日))?(?:\\d{1,2}:[0-5]\\d)(?:[-—–]\\d{1,2}:[0-5]\\d)?(?:前)?'
  // Only a closed object/destination or a separate post-submission action can follow.
  // An object suffix ("清单照片") or destination suffix never counts as the same role.
  const end = '(?:$|[、：:（(]|(?:并|且|后)(?:保留|保存|等待|查看|核对|确认))'
  // A shared destination may follow a closed enumeration, as in an actual
  // exchange notice. Each member must be an already-declared material of this
  // same task; a substring, foreign object or open-ended list is not evidence.
  const members = [...new Set([object, ...siblingObjects].map(compact))].sort((a, b) => b.length - a.length)
  const member = `(?:${members.map(escaped).join('|')})(?:[（(][^（）()]{1,40}[）)])?`
  const list = `${member}(?:(?:及|和|与|、)${member})+`
  const enumeration = new RegExp(`(?:把|将)?(${list})${action}(?:至|到|给)${c}${end}`, 'u').exec(text)
  const plainList = enumeration?.[1].replace(/[（(][^（）()]{1,40}[）)]/gu, '')
  const listed = plainList && new RegExp(`(?:^|及|和|与|、)${o}(?:$|及|和|与|、)`, 'u').test(plainList) ? enumeration : null
  const matched = [
    new RegExp(`${o}(?:请|须|需|应)?(?:于|在)${statedTime}(?:到|至)${c}${action}${end}`,'u'),
    new RegExp(`${o}(?:请|须|需|应)?(?:于|在)${statedTime}${action}(?:到|至|给)${c}${end}`,'u'),
    new RegExp(`${action}${o}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`${o}(?:请|须|需|应)?${action}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`(?:把|将)${o}${action}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`(?:通过|经由|在)${c}(?:直接|统一|线上)?${action}${o}${end}`, 'u'),
    new RegExp(`(?:向|到)${c}(?:直接|统一|线上)?${action}${o}${end}`, 'u'),
    new RegExp(`${o}(?:的)?(?:提交渠道|提交地址|接收邮箱|提交入口)(?:为|是|：|:)${c}${end}`, 'u'),
    new RegExp(`(?:通过|经由|在)${c}(?:完成|进行)${o}(?:登记|填报|注册)${end}`, 'u'),
    new RegExp(`(?:通过|经由|在)${c}(?:登记|填报|注册)${o}${end}`, 'u'),
  ].map(pattern => pattern.exec(text)).find(match => match !== null) ?? listed
  if (!matched) return null
  // Literal object/destination names are values, not grammatical conditions (e.g. 若水).
  // Only an explicit separate receipt-printing note may be excluded. Other trailing
  // conditions, prohibitions and contradictions still participate in the decision.
  const receiptNote = /(?:并|且)(?:保留|保存)(?:电子)?回执([（(](?:无需|无须|不用|不必)打印(?:纸质版|纸质回执)?[）)])$/u.exec(text)
  const unrelatedQualifier = receiptNote?.[1] ?? null
  const polarityText = (unrelatedQualifier ? text.slice(0, -unrelatedQualifier.length) : text)
    .replaceAll(compact(object), '<对象>').replaceAll(label, '<渠道>')
  // Do not collapse a double negative, condition, example, or question into permission.
  const uncertain = /请勿|勿|不要|不得|不应|不可|不能|不准|不允许|禁止|不必|无需|无须|不用|尚未|未明确|不是|并非|未必|不一定|不建议|不推荐|若|如果|例如|假如|是否|能否/u.test(polarityText)
  return { polarity: uncertain ? 'NEGATED_OR_UNCERTAIN' as const : 'AFFIRMATIVE' as const,
    roleText: matched[0], polarityText, unrelatedQualifier }
}

/** Preserve the answer. Only source-supported destination roles become definite fields. */
export function groundMaterialChannels(input: RecognitionResult, sourceText: string, workflowSupport: WorkflowMaterialSupport[] = []) {
  const result = structuredClone(input)
  const audit: MaterialChannelAudit = { version: workflowSupport.length ? WORKFLOW_MATERIAL_CHANNEL_VERSION : MATERIAL_CHANNEL_GROUNDING_VERSION, role: 'PROGRAM_FIELD_GROUNDING_NOT_NEW_MODEL_OUTPUT', inferredFacts: 0, decisions: [] }
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  for (const material of result.materials) {
    if (!material.submissionChannel) continue
    const originalValue = material.submissionChannel
    const owners = tasks.filter(t => material.relatedTaskTempIds.includes(t.tempId) && t.materialTempIds.includes(material.tempId))
    const ids = new Set([...material.evidenceIds, ...owners.flatMap(t => t.evidenceIds)])
    const evidence = result.evidence.filter(e => ids.has(e.id) && e.sourceId === result.evidence.find(r => material.evidenceIds.includes(r.id))?.sourceId
      && typeof e.quote === 'string' && sourceText.includes(e.quote)).map(e => ({ id: e.id, quote: e.quote! }))
    const clauses = citedClauses(evidence, sourceText)
    const objects = [...new Set([material.name, ...owners.map(t => t.actionObject)].filter(Boolean))]
    const siblings = result.materials.filter(m => owners.some(t => m.relatedTaskTempIds.includes(t.tempId) && t.materialTempIds.includes(m.tempId))).map(m => m.name)
    const roleChecks = clauses.flatMap(quote => objects.flatMap(object => {
      const check = destinationRole(quote, object, originalValue, siblings)
      return check ? [{ quote, object, ...check }] : []
    }))
    const contradictory = roleChecks.some(c => c.polarity === 'NEGATED_OR_UNCERTAIN')
    const citedContextProof=!contradictory?citedDeliveryContexts(result,sourceText).find(p=>p.materialIds.includes(material.tempId)&&p.channel===originalValue):undefined
    const direct = owners.length > 0 && !contradictory && (roleChecks.some(c => c.polarity === 'AFFIRMATIVE')||!!citedContextProof)
    const parts=originalValue.split(/[；;]/u).map(s=>s.trim()).filter(Boolean)
    const ownerRoles=parts.length>1&&parts.length===owners.length?parts.map(part=>({part,owners:owners.filter(owner=>{
      const own=evidence.filter(e=>owner.evidenceIds.includes(e.id)),declaredObjects=[material.name,owner.actionObject,...material.formatRequirements.filter(f=>own.some(e=>e.quote.includes(f)))]
      const checks=citedClauses(own,sourceText).flatMap(q=>declaredObjects.flatMap(o=>{const c=destinationRole(q,o,part,siblings);return c?[c]:[]}))
      return checks.some(c=>c.polarity==='AFFIRMATIVE')&&!checks.some(c=>c.polarity==='NEGATED_OR_UNCERTAIN')
    }).map(t=>t.tempId)})):[]
    const ownerSpecific=!contradictory&&ownerRoles.length===parts.length&&parts.length>1&&new Set(parts).size===parts.length&&ownerRoles.every(r=>r.owners.length===1)&&new Set(ownerRoles.flatMap(r=>r.owners)).size===owners.length
    const workflowProof = !contradictory && workflowSupport.find(p => {
      if (p.materialId !== material.tempId || p.channel !== originalValue || p.ownerTaskIds.length !== 1
        || !p.objectSurface.includes(material.name)) return false
      const owner = owners.find(t => t.tempId === p.ownerTaskIds[0])
      if (!owner || owner.actionObject !== p.objectSurface) return false
      const citedAction = compact(p.actionSurface), displayedAction = compact(owner.actionVerb)
      const leadingVerb = /^(?:(?:请|须|需|应|务必|准确|并|再|然后))*(?:在系统(?:上|中|内))?(上传|提交)/u.exec(citedAction)?.[1]
      if (citedAction !== displayedAction && leadingVerb !== displayedAction) return false
      const currentEvidence = result.evidence.filter(e => ids.has(e.id) && e.sourceId === p.sourceId)
      if (![...p.channelQuotes, ...p.taskQuotes].every(q => currentEvidence.some(e => e.quote === q))) return false
      const verified = verifyWorkflowChannelEvidence({ sourceText, channel: p.channel, channelQuotes: p.channelQuotes,
        taskQuotes: p.taskQuotes, actionSurface: p.actionSurface, objectSurface: p.objectSurface })
      return !!verified && verified.workflowText === p.workflowText && verified.start === p.start && verified.end === p.end
    }) || undefined
    const receipt = !contradictory && clauses.some(c => c.includes(originalValue) && /显示|提示|回执|接收成功|收到成功/u.test(c))
      && owners.some(t => t.completionCriteria.some(c => c.includes(originalValue) && /显示|提示|回执|接收成功|收到成功/u.test(c) && evidence.some(e=>e.quote.includes(c))))
    const status = direct ? 'EXPLICIT_CHANNEL' : ownerSpecific?'EXPLICIT_OWNER_CHANNELS': workflowProof ? 'EXPLICIT_WORKFLOW_CHANNEL' : receipt ? 'RECEIPT_CONTEXT_UNRESOLVED' : 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL'
    audit.decisions.push({ materialId: material.tempId, materialName: material.name, ownerIds: material.relatedTaskTempIds, originalValue, displayedValue: direct || ownerSpecific || workflowProof ? originalValue : null, status, evidence, roleChecks, ...(workflowProof ? { workflowProof } : {}),...(citedContextProof?{citedContextProof}:{}) })
    if (direct || ownerSpecific || workflowProof) continue
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
export function assembleCurrentFirstSuggestion(input: RecognitionResult, context: { sourceText: string; referenceTime: string; timezone: string; sourceWindows?: import('./sourceWindowGrounding').SourceWindowDeclaration[]; sourceActionTimes?: SourceActionTimeDeclaration[]; workflowMaterialSupport?: WorkflowMaterialSupport[] }) {
  const first = assembleRecognitionFirstSuggestionD26(input, context)
  const channels = groundMaterialChannels(first.result, context.sourceText, context.workflowMaterialSupport)
  const windows = groundSourceWindows(channels.result, context.sourceWindows ?? [], context)
  const appointments=groundSourceActionTimes(windows.result,context.sourceText,context.sourceActionTimes)
  return { ...first, audit:{...first.audit,sourceActionTimes:appointments.audit},result: appointments.result, materialChannelAudit: channels.audit, sourceWindowGrounding: windows.audit }
}
