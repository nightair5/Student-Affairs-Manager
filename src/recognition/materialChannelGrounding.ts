import type { RecognitionResult } from './types'
import {citedDocumentNames, type CitedDocumentName} from './citedDocumentName'
import { assembleRecognitionFirstSuggestionD26,assembleAlignedTwoStepFirstSuggestion } from './firstSuggestionD26'
import { groundSourceWindows } from './sourceWindowGrounding'
import { groundSourceActionTimes,SOURCE_ACTION_TIME_VERSION, type SourceActionTimeDeclaration } from './sourceActionTime'
import { verifyWorkflowChannelEvidence, type WorkflowMaterialSupport } from './workflowChannelSupport'
import {citedDeliveryContexts,type CitedDeliveryContext} from './citedDeliveryContext'

export const MATERIAL_CHANNEL_GROUNDING_VERSION = 'material-channel-role-grounding-1.13.0'
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
  ownerChannels?: Array<{ownerId:string;channel:string}>
  documentNameProof?:CitedDocumentName
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
  // A line break inside one cited delivery is layout. The closed role grammar
  // below still requires the actual object/action/destination in order; it
  // cannot borrow across a sentence or a different object's intervening text.
  return [...new Set([...evidence.map(e=>e.quote),...joined.map(s=>sourceText.slice(s.start,s.end))])].flatMap(q=>[...q.split(/[，。；]/u),...(/https:\/\//u.test(q)&&/登录/u.test(q)&&/通过/u.test(q)?[q]:[]),
    // Retain a single closed sentence whose second clause explicitly says
    // which tool to use for the immediately preceding delivery. No borrowing
    // across a period or another object's instruction.
    ...(/(?:提交|上传|递交|发送)[^，。；]{1,60}[，,](?:统一)?使用[^，。；]+[。；]?$/u.test(q)&&q.split(/[。；]/u).filter(Boolean).length===1?[q.replace(/[。；]$/u,'')]:[])])
}
/** Role evidence, not token overlap: a receipt is not an instruction to send there. */
function destinationRole(clause: string, object: string, channel: string, siblingObjects: string[] = []) {
  let text = compact(clause)
  // A literal repeated-material determiner does not change the stated object.
  // It cannot replace a missing object name or borrow another material.
  const o = '(?:同一份)?' + escaped(compact(object))
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
  // A site plus its submission module is one explicit route. The original
  // quote states login(site+URL), then submit(object) through that module.
  // Validate those ordered roles, not merely that their words occur nearby.
  const stepped=/^([^（）()]+)[（(](https:\/\/[^\s（）()]+)[）)](.+)$/u.exec(compact(channel))
  const steppedRole=stepped?new RegExp(`登录${escaped(stepped[1])}[（(]${escaped(stepped[2])}[）)][，,](?:然后)?通过${escaped(stepped[3])}(?:直接)?(?:提交|上传|发送)${o}(?:$|[，。；])`,'u').exec(text):null
  const action = '(?:提交|上传|递交|发送|交付|送交|交)'
  const statedTime='(?:(?:当日|同日|当天)|(?:(?:\\d{4}年)?\\d{1,2}月\\d{1,2}日))?(?:\\d{1,2}:[0-5]\\d)(?:[-—–]\\d{1,2}:[0-5]\\d)?(?:前)?'
  // Only a closed object/destination or a separate post-submission action can follow.
  // An object suffix ("清单照片") or destination suffix never counts as the same role.
  const end = '(?:$|[、：:（(]|(?:并|且|后)(?:保留|保存|等待|查看|核对|确认))'
  // A closed download-location parenthesis annotates where the same form is
  // obtained. It does not replace the following explicit submission address.
  // Other parenthetical conditions are never stripped or treated as permission.
  const downloadNote='[（(][^（）()，。；]{1,80}(?:常用下载|表格下载|下载专区)[）)]'
  const downloadMatch=new RegExp(`${action}${o}(${downloadNote})(?:至|到|给)${c}(?:办理)?$`,'u').exec(text)
  const annotatedDelivery=downloadMatch&&!/仅限|只有|须|需审核|未通过|不得|禁止|取消|如果|若|例如/u.test(downloadMatch[1])?downloadMatch:null
  // A shared destination may follow a closed enumeration, as in an actual
  // exchange notice. Each member must be an already-declared material of this
  // same task; a substring, foreign object or open-ended list is not evidence.
  const members = [...new Set([object, ...siblingObjects].map(compact))].sort((a, b) => b.length - a.length)
  const member = `(?:${members.map(escaped).join('|')})(?:[（(][^（）()]{1,40}[）)])?`
  const list = `${member}(?:(?:及|和|与|、)${member})+`
  const enumeration = new RegExp(`(?:把|将)?(${list})(?:请|须|需|应)?(?:(?:于|在)${statedTime})?(?:一起|一并|统一|均)?${action}(?:至|到|给)${c}${end}`, 'u').exec(text)
  const plainList = enumeration?.[1].replace(/[（(][^（）()]{1,40}[）)]/gu, '')
  const listed = plainList && new RegExp(`(?:^|及|和|与|、)${o}(?:$|及|和|与|、)`, 'u').test(plainList) ? enumeration : null
  const matched = [
    new RegExp(`${o}(?:请|须|需|应)?(?:于|在)${statedTime}(?:到|至)${c}${action}${end}`,'u'),
    new RegExp(`${o}(?:请|须|需|应)?(?:于|在)${statedTime}${action}(?:到|至|给)${c}${end}`,'u'),
    new RegExp(`${action}${o}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`${action}${o}[，,](?:统一)?使用${c}$`, 'u'),
    new RegExp(`${o}(?:请|须|需|应)?${action}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`(?:把|将)${o}${action}(?:至|到|给)${c}${end}`, 'u'),
    new RegExp(`(?:通过|经由|在)${c}(?:直接|统一|线上)?${action}${o}${end}`, 'u'),
    new RegExp(`(?:向|到)${c}(?:直接|统一|线上)?${action}${o}${end}`, 'u'),
    new RegExp(`${o}(?:的)?(?:提交渠道|提交地址|接收邮箱|提交入口)(?:为|是|：|:)${c}${end}`, 'u'),
    new RegExp(`(?:通过|经由|在)${c}(?:完成|进行)${o}(?:登记|填报|注册)${end}`, 'u'),
    new RegExp(`(?:通过|经由|在)${c}(?:登记|填报|注册)${o}${end}`, 'u'),
  ].map(pattern => pattern.exec(text)).find(match => match !== null) ?? listed ?? steppedRole ?? annotatedDelivery
  if (!matched) return null
  // Literal object/destination names are values, not grammatical conditions (e.g. 若水).
  // Only an explicit separate receipt-printing note may be excluded. Other trailing
  // conditions, prohibitions and contradictions still participate in the decision.
  const receiptNote = /(?:并|且)(?:保留|保存)(?:电子)?回执([（(](?:无需|无须|不用|不必)打印(?:纸质版|纸质回执)?[）)])$/u.exec(text)
  const unrelatedQualifier = receiptNote?.[1] ?? null
  let polarityText = (unrelatedQualifier ? text.slice(0, -unrelatedQualifier.length) : text)
    .replaceAll(compact(object), '<对象>').replaceAll(label, '<渠道>')
  if(steppedRole)for(const value of stepped!.slice(1))polarityText=polarityText.replaceAll(value,'<渠道组成>')
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
  const documentNames=citedDocumentNames(result,sourceText)
  for (const material of result.materials) {
    if (!material.submissionChannel) continue
    const originalValue = material.submissionChannel
    const owners = tasks.filter(t => material.relatedTaskTempIds.includes(t.tempId) && t.materialTempIds.includes(material.tempId))
    const ids = new Set([...material.evidenceIds, ...owners.flatMap(t => t.evidenceIds)])
    const evidence = result.evidence.filter(e => ids.has(e.id) && e.sourceId === result.evidence.find(r => material.evidenceIds.includes(r.id))?.sourceId
      && typeof e.quote === 'string' && sourceText.includes(e.quote)).map(e => ({ id: e.id, quote: e.quote! }))
    const clauses = citedClauses(evidence, sourceText)
    const documentNameProof=documentNames.find(p=>p.materialId===material.tempId&&owners.some(t=>t.tempId===p.taskId))
    const objects = [...new Set([material.name, ...owners.map(t => t.actionObject),...(documentNameProof?[documentNameProof.literalObject]:[])].filter(Boolean))]
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
      // A shared citation may contain both paper and electronic instructions.
      // Its sibling format is not another name for this owner. Require the
      // format in the object, or a citation unique to that owner, is required.
      const own=evidence.filter(e=>owner.evidenceIds.includes(e.id)),declaredObjects=[material.name,owner.actionObject,...material.formatRequirements.filter(f=>own.some(e=>e.quote.includes(f))&&(compact(owner.actionObject).includes(compact(f))||owners.filter(t=>evidence.some(e=>t.evidenceIds.includes(e.id)&&e.quote.includes(f))).length===1))]
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
    audit.decisions.push({ materialId: material.tempId, materialName: material.name, ownerIds: material.relatedTaskTempIds, originalValue, displayedValue: direct || ownerSpecific || workflowProof ? originalValue : null, status, evidence, roleChecks, ...(workflowProof ? { workflowProof } : {}),...(citedContextProof?{citedContextProof}:{}),...(documentNameProof?{documentNameProof}:{}),...(ownerSpecific?{ownerChannels:ownerRoles.map(r=>({ownerId:r.owners[0],channel:r.part}))}:{}) })
    if (direct || ownerSpecific || workflowProof) continue
    // null here means unconfirmed destination, not "the source states no channel".
    material.submissionChannel = null
    const message = receipt ? `${material.name}的提交渠道原文未明确；“${originalValue}”仅出现在办结回执中，保留推测，不作为确定渠道。`
      : `${material.name}的提交渠道“${originalValue}”缺少同对象的明确依据；请核对关联事项。`
    if (!receipt) {
      result.quality.needsHumanReview = true
      result.quality.reviewReasons.push(message)
      // Diagnostics obey the same bounded wire contract as model conflicts.
      // Every affected owner and every proof remains represented; an oversized
      // shared-material diagnostic must not discard the entire source.
      const entities = [...new Set([material.tempId, ...material.relatedTaskTempIds])]
      const proofs = [...new Set(evidence.map(e => e.id))]
      const chunks = Math.max(1, Math.ceil(entities.length / 30), Math.ceil(proofs.length / 20))
      for (let part = 0; part < chunks; part++) result.conflicts.push({
        id: 'material-channel:' + material.tempId + (chunks > 1 ? ':' + (part + 1) : ''), type: 'other', message,
        // Evidence and owner chunks can have different counts. Repeat their
        // last nonempty scope; an empty owner list means a GLOBAL conflict.
        entityTempIds: entities.slice(Math.min(part, Math.ceil(entities.length / 30) - 1) * 30, (Math.min(part, Math.ceil(entities.length / 30) - 1) + 1) * 30),
        evidenceIds: proofs.slice(Math.min(part, Math.max(0, Math.ceil(proofs.length / 20) - 1)) * 20, (Math.min(part, Math.max(0, Math.ceil(proofs.length / 20) - 1)) + 1) * 20), requiresDecision: true,
      })
      owners.forEach(t => { t.selected = false })
    }
  }
  result.quality.reviewReasons = [...new Set(result.quality.reviewReasons)]
  return { result, audit }
}

/** Shared ordinary first screen; no change to candidate prompts, schema, or historical scorer. */
export function assembleCurrentFirstSuggestion(input: RecognitionResult, context: { sourceText: string; referenceTime: string; timezone: string; obligationViewVersion?: 'source-obligation-view-1.0.0'; sourceWindows?: import('./sourceWindowGrounding').SourceWindowDeclaration[]; sourceActionTimes?: SourceActionTimeDeclaration[]; workflowMaterialSupport?: WorkflowMaterialSupport[] }) {
  const first = assembleRecognitionFirstSuggestionD26(input, context)
  const channels = groundMaterialChannels(first.result, context.sourceText, context.workflowMaterialSupport)
  const windows = groundSourceWindows(channels.result, context.sourceWindows ?? [], context)
  const appointments=groundSourceActionTimes(windows.result,context.sourceText,context.sourceActionTimes)
  const reasons=[...new Set(appointments.result.quality.reviewReasons)]
  if(reasons.length>20)appointments.result.quality.reviewReasons=[...reasons.slice(0,19),`另有${reasons.length-19}项待核对说明，请展开事项、材料及冲突明细查看。`]
  return { ...first, audit:{...first.audit,sourceActionTimes:appointments.audit},result: appointments.result, materialChannelAudit: channels.audit, sourceWindowGrounding: windows.audit }
}

/** Versioned ordinary product entry. Older component/replay callers retain
 * their declared assembly while App and current evaluation use this entry. */
export function assembleProductFirstSuggestion(input:RecognitionResult,context:Parameters<typeof assembleCurrentFirstSuggestion>[1]){
  if(input.promptVersion.startsWith('recognition-two-step-')){
    const first=assembleAlignedTwoStepFirstSuggestion(input,context),windows=groundSourceWindows(first.result,[],context)
    const materialChannelAudit:MaterialChannelAudit={version:MATERIAL_CHANNEL_GROUNDING_VERSION,role:'PROGRAM_FIELD_GROUNDING_NOT_NEW_MODEL_OUTPUT',inferredFacts:0,decisions:[]}
    return{...first,result:windows.result,audit:{...first.audit,sourceActionTimes:{version:SOURCE_ACTION_TIME_VERSION,operation:'SOURCE_APPOINTMENT_NOT_DEADLINE_OR_PERSONAL_PLAN',inferredFacts:0,decisions:[],rejectedDeadlineRoles:[]}},materialChannelAudit,sourceWindowGrounding:windows.audit}
  }

  return assembleCurrentFirstSuggestion(input,{...context,obligationViewVersion:'source-obligation-view-1.0.0'})
}
