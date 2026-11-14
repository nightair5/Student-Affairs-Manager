import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {RecognitionResult, TaskSuggestionV2} from './types'

const daySource = '(?:(?:\\d{4}年)?\\d{1,2}月\\d{1,2}[日号]|(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]|今天|今日|明天|后天)'
const clockSource = '(?:(?:凌晨|上午|下午|中午|晚上|早上)\\s*)?\\d{1,2}[:：][0-5]\\d'
const tasksOf = (result: RecognitionResult) => [...result.standaloneTasks, ...result.milestones.flatMap(stage => [...stage.tasks, ...stage.workPackages.flatMap(group => group.tasks)])]

/** A later yearless date that runs backwards across a cited year boundary
 * does not establish either the previous year or the next one. This only
 * checks the local paragraph; ordinary unqualified dates retain their fixed
 * reference-year policy. Explicitly year-qualified ranges are unaffected. */
export function localEventYearUnresolved(source:string,raw:string):boolean {
 if(/\d{4}年/u.test(raw))return false
 const current=/(\d{1,2})月(\d{1,2})[日号]/u.exec(raw),at=source.indexOf(raw)
 if(!current||at<0||at!==source.lastIndexOf(raw))return false
 const previous=source.slice(0,at),boundary=Math.max(...['。','！','？','\n'].map(mark=>previous.lastIndexOf(mark)))+1
 const anchors=[...source.slice(boundary,at).matchAll(/\d{4}年(\d{1,2})月(\d{1,2})[日号]/gu)]
 const anchor=anchors.at(-1)
 return Boolean(anchor&&Number(current[1])*100+Number(current[2])<Number(anchor[1])*100+Number(anchor[2]))
}

/** An explicit "same day" points to the preceding dated clause in this
 * sentence/paragraph. A cancelled event can supply a day, never its clock,
 * venue or validity. Multiple/alternative/revised days stay unresolved. */
export function localSameDayTime(source: string, title: string, raw: string, referenceTime: string, timezone: string) {
  const clauses = [...source.matchAll(/[^，,。；;！？\n]+/gu)]
  const owners = clauses.filter(clause => clause[0].includes(title) && clause[0].includes(raw) && /^(?:\s*)(?:同日|当日|当天)/u.test(clause[0]))
  if (owners.length !== 1) return null
  const owner = owners[0], at = owner.index!, previous = source.slice(0, at)
  const boundary = Math.max(...['。', '！', '？', '\n'].map(mark => previous.lastIndexOf(mark))) + 1
  const context = source.slice(boundary, at)
  const days = [...context.matchAll(new RegExp(daySource, 'gu'))]
  if (days.length !== 1 || /(?:或者|或|备选|改为|改至|调整至|延期|另行|待定|每周|每星期)/u.test(context)) return null
  const anchor = parseDirectSourceTime(days[0][0], {type: 'event_start', referenceTime, timezone})
  if (!anchor.normalizedValue || anchor.needsConfirmation) return null
  const ownTime = new RegExp(`^\\s*((?:同日|当日|当天)\\s*${clockSource}(?:\\s*[-－—–至到]\\s*${clockSource})?)`, 'u').exec(owner[0])
  if (!ownTime || !ownTime[1].includes(raw)) return null
  const parsed = parseDirectSourceTime(ownTime[1], {type: 'event_start', referenceTime, timezone, inheritedDate: anchor.normalizedValue.slice(0, 10)})
  return parsed.normalizedValue && !parsed.needsConfirmation ? {parsed, raw: ownTime[1], at: at + owner[0].indexOf(ownTime[1]), anchor: {raw: days[0][0], at: boundary + days[0].index!}} : null
}

export function retainLocalSameDayEvents(input: RecognitionResult, source: string, timezone: string): RecognitionResult {
  if (input.modelName !== 'local-rules') return input
  const result = structuredClone(input)
  for (const event of result.events) {
    const start = result.timePoints.find(point => point.tempId === event.startTimePointTempId)
    if (!start) continue
    const proof = localSameDayTime(source, event.title, start.rawText, result.createdAt, timezone)
    if (!proof || result.evidence.length > 118 || start.evidenceIds.length > 18) continue
    const refs = [proof, proof.anchor].map(span => {
      const id = `local-day-reference:${span.at}`
      if (!result.evidence.some(ref => ref.id === id)) result.evidence.push({id, sourceId: result.evidence[0]?.sourceId ?? 'source', quote: span.raw, quotedText: span.raw, textStart: span.at, textEnd: span.at + span.raw.length, field: 'deadline', extractionMethod: 'parser', confidence: 1})
      return id
    })
    Object.assign(start, {rawText: proof.raw, normalizedValue: proof.parsed.normalizedValue, precision: proof.parsed.precision, timezone, isAllDay: proof.parsed.isAllDay, needsConfirmation: false, evidenceIds: [...new Set([...start.evidenceIds, ...refs])]})
    const end = result.timePoints.find(point => point.tempId === event.endTimePointTempId)
    if (end && proof.parsed.rangeEndNormalizedValue) Object.assign(end, {rawText: proof.raw, normalizedValue: proof.parsed.rangeEndNormalizedValue, precision: proof.parsed.precision, timezone, isAllDay: false, needsConfirmation: false, evidenceIds: [...start.evidenceIds]})
  }
  return result
}

export interface LocalDeliveryReference {
  quote: string; at: number; object: string; form: string; verb: string; sourceVerb: string; channel: string; active: string; activeAt: number; time: string
}

/** Resolve only a closed form contrast: a named document's first delivery
 * form is cancelled, and the immediately following other form explicitly
 * still requires delivery. The name is inherited; its old obligation is not.
 * No reference can jump across a different object, sentence, or condition. */
export function localDeliveryReferences(source: string): LocalDeliveryReference[] {
  const pattern = new RegExp(`(?:^|[。！？\\n])\\s*((纸质|电子)(?:版)?([^，,。；;！？\\n]{2,35}?)(?:取消(?:提交|递交|上传|发送)?|(?:无需|无须|不再)(?:提交|递交|上传|发送))[，,；;]\\s*((电子|纸质)(?:版)?(?:仍须|仍需|仍要|仍应)(?:在|于)?\\s*(${daySource}\\s*(?:${clockSource})?\\s*(?:之前|以前|前))\\s*(发至|发到|发送至|发送到|上传至|上传到|提交至|提交到|递交至|交至|交到)\\s*([^，,。；;！？\\n]+)))`, 'gu')
  return [...source.matchAll(pattern)].flatMap(match => {
    const [, quote, oldForm, object, active, form, time, sourceVerb, channel] = match
    if (oldForm === form || !/(?:材料|资料|报告|申请表|证明|作品|表格|文稿|文档|文件|清单|说明|简历)$/u.test(object) || /(?:和|及|、|或者|或|仅限|如果|若|但)/u.test(object) || channel.length > 60) return []
    const at = match.index! + match[0].indexOf(quote)
    return [{quote, at, object, form: form + '版', verb: sourceVerb.startsWith('发') ? '发送' : sourceVerb.startsWith('上传') ? '上传' : '提交', sourceVerb, channel: channel.trim(), active, activeAt: at + quote.indexOf(active), time}]
  })
}

export function localDeliveryReferenceForTask(input: RecognitionResult, source: string, task: TaskSuggestionV2): LocalDeliveryReference | undefined {
  if (input.modelName !== 'local-rules') return undefined
  const matches = localDeliveryReferences(source).filter(proof => task.actionObject === proof.object && task.actionVerb === proof.verb
    && task.evidenceIds.some(id => input.evidence.find(ref => ref.id === id)?.quote === proof.quote)
    && task.description.includes(proof.active))
  return matches.length === 1 ? matches[0] : undefined
}

export function retainLocalDeliveryReferences(input: RecognitionResult, source: string, timezone: string): RecognitionResult {
  if (input.modelName !== 'local-rules') return input
  const result = structuredClone(input)
  for (const proof of localDeliveryReferences(source)) {
    if (tasksOf(result).some(task => localDeliveryReferenceForTask(result, source, task)?.activeAt === proof.activeAt)) continue
    if (tasksOf(result).length >= 20 || result.evidence.length > 118 || result.materials.length >= 60) continue
    const parsed = parseDirectSourceTime(proof.time, {type: 'submission_deadline', referenceTime: result.createdAt, timezone})
    const id = `local-referenced-delivery:${proof.activeAt}`, eid = id + ':evidence', mid = id + ':material', tid = id + ':deadline', timeAt = proof.activeAt + proof.active.indexOf(proof.time)
    result.evidence.push({id: eid, sourceId: result.evidence[0]?.sourceId ?? 'source', quote: proof.quote, quotedText: proof.quote, textStart: proof.at, textEnd: proof.at + proof.quote.length, field: 'description', extractionMethod: 'parser', confidence: 1})
    result.evidence.push({id: tid + ':evidence', sourceId: result.evidence[0]?.sourceId ?? 'source', quote: proof.time, quotedText: proof.time, textStart: timeAt, textEnd: timeAt + proof.time.length, field: 'deadline', extractionMethod: 'parser', confidence: 1})
    result.timePoints.push({tempId: tid, type: 'submission_deadline', rawText: proof.time, normalizedValue: parsed.normalizedValue, timezone, precision: parsed.precision, isAllDay: parsed.isAllDay, needsConfirmation: parsed.needsConfirmation, relatedTaskTempIds: [id], relatedMaterialTempIds: [mid], evidenceIds: [tid + ':evidence'], confidence: 1, selected: true})
    result.materials.push({tempId: mid, name: proof.object, required: true, formatRequirements: [proof.form], namingRequirements: [], quantity: null, submissionChannel: proof.channel, relatedTaskTempIds: [id], evidenceIds: [eid], confidence: 1, selected: true})
    result.standaloneTasks.push({tempId: id, parentTempId: null, hierarchyType: 'task', title: `${proof.verb}${proof.object}（${proof.form}）`, actionVerb: proof.verb, actionObject: proof.object, description: proof.active, completionCriteria: [], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], materialTempIds: [mid], timePointTempIds: [tid], evidenceIds: [eid], confidence: 1, inferenceLevel: 'strong_inference', userConfirmationRequired: true, selected: true})
    result.sourceSummary.requiresAction = true
  }
  return result
}
