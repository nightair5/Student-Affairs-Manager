import {groundActivityRoles} from './activityRoles'
import {retainDeclaredSourceInformation} from './sourceInformationPreview'
import {nativePreconditionIssues} from './nativePrecondition'
import {citedEventSequence,citedSplitEventRange,citedTaskDateRange} from '../../cloudflare/cited-event-sequence.mjs'
import { interpretTimeD26, type D26TimeInterpretation } from '../lib/timeSemanticsD26'
import { adaptModelWire, type WireContext } from '../experiments/realInput01/modelWire'
import type { SemanticInput } from '../experiments/mainline04/semanticContract'
import type { RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2 } from './types'
import { groundEligibility } from './eligibilityGrounding'
import { rangeEndpointSupport } from './rangeEndpointSupport'
import { taskActionText } from '../lib/taskActionText'
import { supportedCoordinatedObject, supportedEventDescriptor, supportedEventOperation } from './compoundNameSupport'
import {retainCurrentDeadlineFacts,type SourceCurrentFactAudit} from './sourceCurrentFacts'
import {completeDeclaredEventNameSupport,type DeclaredEventNameAudit} from './declaredEventNameSupport'
import {completeCitedOwnerSupport,type CitedOwnerDecision} from './citedOwnerSupport'
import {completeCitedSourceWindows,CITED_SOURCE_WINDOW_VERSION} from './citedSourceWindow'
import {addDateOnlyDays} from '../lib/timeSemantics'
import {nativeQualificationReviews} from './nativeQualificationReview'
import {projectCitedClockRanges,type CitedClockRangeDecision} from '../../cloudflare/cited-clock-range.mjs'
import {isolateRecognitionItems,unanchoredAcademicWeek,LOCAL_ISOLATION_NOTE_PREFIX,type LocalIsolationAudit} from '../../cloudflare/recognition-local-isolation.mjs'

export const D26_FIRST_SUGGESTION_VERSION = 'grounded-first-suggestion-1.25.0'
interface ProseRecord { entityId: string; kind: 'task' | 'event' | 'source'; title: string; description: string }
export interface D26FirstSuggestionAudit {
  version: typeof D26_FIRST_SUGGESTION_VERSION
  originalProse: ProseRecord[]
  generatedProse: ProseRecord[]
  times: Array<{ entityId: string; before: TimeFields; after: TimeFields; interpretation: D26TimeInterpretation }>
  citedClockRanges?:CitedClockRangeDecision[]
  declaredSourceInformation?:ReturnType<typeof retainDeclaredSourceInformation>
  localIsolation?:LocalIsolationAudit
  unresolved: Array<{ entityId: string; reason: string }>
  sourceCurrentness: SourceCurrentFactAudit[]
  declaredEventNameSupport: DeclaredEventNameAudit[]
  citedOwnerSupport:CitedOwnerDecision[]
  citedSourceWindows:ReturnType<typeof completeCitedSourceWindows>
  projectDisplayDefault: {before:string;after:string;reason:string}|null
  nativePreconditionReview:ReturnType<typeof nativePreconditionIssues>
  nativeQualificationReview:ReturnType<typeof nativeQualificationReviews>
  activityRoles:ReturnType<typeof groundActivityRoles>
  actionFields: Array<{entityId:string; before:string; after:string; status:'CITED_VERB_PROJECTION'|'LOCAL_UNRESOLVED_ACTION'|'EXISTING_COURSE_COMPLETION_SUPPORT'; quotes:string[]}>
  rangeSupport: Array<{entityId:string; quote:string; literalRange:string; expanded:string; rule:'CITED_SAME_EVENT_RANGE_ENDPOINT'|'CITED_SAME_EVENT_CLOCK_RANGE'|'CITED_ADJACENT_SAME_DAY_EVENT'|'CITED_NEXT_DAY_DURATION_CONSENSUS'|'CITED_SHARED_TASK_RANGE_ENDPOINT'}>
  role: 'DETERMINISTIC_PRODUCT_ASSEMBLY_NOT_MODEL_OUTPUT'
}
type TimeFields = Pick<TimePointSuggestionV2, 'normalizedValue' | 'timezone' | 'isAllDay' | 'precision' | 'needsConfirmation'>
const fields = (point: TimeFields): TimeFields => ({ normalizedValue: point.normalizedValue, timezone: point.timezone,
  isAllDay: point.isAllDay, precision: point.precision, needsConfirmation: point.needsConfirmation })
const auditRecord = (): D26FirstSuggestionAudit => ({ version: D26_FIRST_SUGGESTION_VERSION, originalProse: [], generatedProse: [], times: [], unresolved: [], sourceCurrentness:[], declaredEventNameSupport:[], citedOwnerSupport:[],citedSourceWindows:{version:CITED_SOURCE_WINDOW_VERSION,inferredFacts:0,decisions:[]}, projectDisplayDefault:null,nativePreconditionReview:[],nativeQualificationReview:[], activityRoles:{reusedNameEvidence:[],suppressedLocationTasks:[],invalidEnds:[]}, actionFields: [], rangeSupport: [], role: 'DETERMINISTIC_PRODUCT_ASSEMBLY_NOT_MODEL_OUTPUT' })
const supported = (value: string, quotes: string[]) => Boolean(value.trim()) && quotes.some(quote => quote.includes(value))
function supportedAdjacent(value: string, quotes: string[], sourceText: string) {
  if (supported(value, quotes)) return true
  const start = sourceText.indexOf(value)
  if (!value.trim() || start < 0 || sourceText.indexOf(value, start + 1) >= 0) return false
  const spans = unique(quotes).flatMap(quote => {
    const at = sourceText.indexOf(quote)
    return at >= 0 && sourceText.indexOf(quote, at + 1) < 0 ? [{start:at,end:at+quote.length}] : []
  }).sort((a,b)=>a.start-b.start)
  let covered = start
  for (const span of spans) if (span.start <= covered && span.end > covered) covered = span.end
  return covered >= start + value.length
}
const unique = (values: string[]) => [...new Set(values)]
/** A model's existing completion action may express a course requirement,
 * rather than quote a literal verb. Require the same cited course/assignment,
 * an open teaching component, an assessment obligation and its owned deadline.
 * This validates an existing action; it never creates a task or a time. */
function supportedCourseCompletion(task:TaskSuggestionV2,quotes:string[],points:TimePointSuggestionV2[]) {
  if(task.actionVerb!=='完成'||!['课程学习','线上课程学习','在线课程学习','在线作业','线上作业'].includes(task.actionObject))return false
  const course=task.actionObject.endsWith('课程学习'),object=course?'课程学习':task.actionObject
  const relevant=quotes.filter(q=>course?/课程|学习/u.test(q):q.includes(object))
  if(relevant.some(q=>/不要|不得|请勿|无需|不必|禁止|取消|作废|尚未|如果|例如|另行通知/u.test(q)))return false
  if(!quotes.some(q=>q.includes(object)))return false
  const opened=relevant.some(q=>course?/(?:线上|在线)课程(?:教学)?资源已(?:全部|同步)?(?:开启|开放)/u.test(q):/作业[”"]?(?:环节)?已(?:全部|同步)?(?:开启|开放)/u.test(q))
  const assessment=relevant.some(q=>/(?:成绩|作业)占(?:各门)?课程总评成绩的\d+(?:\.\d+)?%[，,](?:请)?务必/u.test(q))
  const deadline=points.some(p=>task.timePointTempIds.includes(p.tempId)&&p.relatedTaskTempIds.includes(task.tempId)&&p.type.endsWith('_deadline')
    &&!p.needsConfirmation&&!!p.normalizedValue&&relevant.some(q=>q.includes(p.rawText)&&q.includes('截止时间')))
  return opened&&assessment&&deadline
}
function contiguousEventQuotes(quotes:string[],source:string){
 const spans=unique(quotes).flatMap(q=>{const start=source.indexOf(q);return q&&start>=0&&source.indexOf(q,start+1)<0?[{start,end:start+q.length}]:[]}).sort((a,b)=>a.start-b.start)
 const runs:Array<{start:number;end:number}>=[]
 for(const span of spans){const last=runs.at(-1);if(last&&(span.start<=last.end||/^[，,\s]*$/u.test(source.slice(last.end,span.start))))last.end=Math.max(last.end,span.end);else runs.push({...span})}
 return runs.map(r=>source.slice(r.start,r.end))
}
/** Wire action.surface is a citation, while the ordinary actionVerb is at most
 * 20 characters. Project only a verb in that same grounded grammatical action;
 * never truncate source text, guess an action or discard the other tasks. */
function boundActionField(task:TaskSuggestionV2, quotes:string[], sourceText:string, audit:D26FirstSuggestionAudit) {
  if(task.actionVerb.length<=20)return
  const before=task.actionVerb, cited=supportedAdjacent(before,quotes,sourceText)&&supportedAdjacent(task.actionObject,quotes,sourceText)
  const verbs='提交|上传|登录|选择|填写|领取|准备|签署|打印|发送|联系|办理|缴纳|核对|保存|删除|参加|完成|申请|登记|激活|带上|下载'
  const prefixes='(?:(?:请|须|需|应|务必|准确|按时|立即|尽快)\\s*)*'
  const leading=new RegExp('^'+prefixes+'('+verbs+')','u').exec(before)
  const disposal=new RegExp('^'+prefixes+'(?:将|把)([^，。；]+?)('+verbs+')(?:至|到|给|$)','u').exec(before)
  const safeDisposal=disposal&&disposal[1].includes(task.actionObject)&&!new RegExp(verbs,'u').test(disposal[1])
  const residual=before.replace(task.actionObject,'')
  const independentAction=new RegExp('(?:并|且|然后|再|同时|以及)\\s*('+verbs+')','u').test(residual)
  const at=sourceText.indexOf(before),prefix=at<0?'':sourceText.slice(0,at).split(/[，。；\n]/u).at(-1)??''
  const negated=/请勿|不要|不得|无需|不必|禁止|取消|不再/u.test(prefix+residual)
  const verb=cited&&!independentAction&&!negated?(leading?.[1]??(safeDisposal?disposal![2]:null)):null
  task.actionVerb=verb??'待核对'
  audit.actionFields.push({entityId:task.tempId,before,after:task.actionVerb,status:verb?'CITED_VERB_PROJECTION':'LOCAL_UNRESOLVED_ACTION',quotes})
  if(!verb){task.selected=false;audit.unresolved.push({entityId:task.tempId,reason:'ACTION_FIELD_NOT_SOURCE_GROUNDED'})}
}
function retainActionBlocks(result:RecognitionResult,audit:D26FirstSuggestionAudit) {
  for(const row of audit.actionFields.filter(a=>a.status==='LOCAL_UNRESOLVED_ACTION')){
    const id='first-action-source:'+row.entityId
    if(!result.conflicts.some(c=>c.id===id))result.conflicts.push({id,type:'other',message:'动作字段不能从同一事项的原文中可靠拆出，请核对该事项；其他有依据的事项可单独保存。',entityTempIds:[row.entityId],evidenceIds:result.standaloneTasks.find(t=>t.tempId===row.entityId)?.evidenceIds??[],requiresDecision:true})
  }
}
function timeClause(rawText: string, quote: string): string {
  const start = quote.indexOf(rawText)
  if (start < 0) return ''
  const left = quote.slice(0, start).search(/[^，。；;,\n]*$/u)
  const tail = quote.slice(start + rawText.length), boundary = tail.search(/[，。；;,\n]/u)
  return quote.slice(left, start + rawText.length + (boundary < 0 ? tail.length : boundary))
}
function prose(audit: D26FirstSuggestionAudit, original: ProseRecord, title: string, description: string) {
  audit.originalProse.push(original)
  audit.generatedProse.push({ ...original, title, description })
  return { title, description }
}
function time<T extends TimeFields & { tempId: string; rawText: string; type: TimePointSuggestionV2['type'] }>(point: T, quotes: string[], referenceTime: string, timezone: string, audit: D26FirstSuggestionAudit, inheritedDate?: string, anchorContext = '', rangeQuotes: string[] = [], anchorMinutes?:number, proof?:NonNullable<ReturnType<typeof citedSplitEventRange>>) {
  const before = fields(point)
  if(unanchoredAcademicWeek(point.rawText)){
    Object.assign(point,{normalizedValue:null,isAllDay:false,precision:'vague',needsConfirmation:true,selected:false})
    audit.times.push({entityId:point.tempId,before,after:fields(point),interpretation:interpretTimeD26('待公布',{referenceTime,timezone,type:point.type})})
    return
  }
  const fullRange=/(?:\d{4}年)?\d{1,2}月\d{1,2}日?\s*(?:[-—–至到]\s*(?:\d{4}年)?(?:\d{1,2}月)?\d{1,2}日|\d{1,2}:[0-5]\d\s*[-—–至到]\s*\d{1,2}:[0-5]\d|\d{1,2}:[0-5]\d(?:开始|开场)[，,、；;\s]*\d{1,2}:[0-5]\d(?:结束|散场|闭幕))/u.test(point.rawText)
  const range = proof?{quote:proof.context,literalRange:point.rawText,expanded:proof.endpoint,rule:proof.rule==='EXISTING_SHARED_TASK_DATE_RANGE'?'CITED_SHARED_TASK_RANGE_ENDPOINT' as const:'CITED_SAME_EVENT_RANGE_ENDPOINT' as const}:supported(point.rawText, quotes)&&!fullRange?null:rangeEndpointSupport(point.rawText, point.type, rangeQuotes, referenceTime, timezone)
  if (!supported(point.rawText, quotes) && !range) {
    audit.unresolved.push({ entityId: point.tempId, reason: 'TIME_SOURCE_SUPPORT_MISSING' })
    Object.assign(point, { normalizedValue: null, isAllDay: false, precision: 'vague', needsConfirmation: true })
    return
  }
  if (range) audit.rangeSupport.push({entityId:point.tempId,...range})
  // Bare clock ranges resemble dates to the legacy parser. Use a clock
  // endpoint only when the same event and endpoint explicitly cite the unique
  // adjacent calendar heading already checked by citedEventDate.
  const clocks = /^(\d{1,2}):([0-5]\d)\s*[-—–]\s*(\d{1,2}):([0-5]\d)(?:同地(?:有)?[^\d。；\n]{1,20})?$/u.exec(point.rawText)
  const heading = /^\d{4}年\d{1,2}月\d{1,2}日(?:[（(](?:周|星期)[一二三四五六日天][）)])?\s*$/u.test(anchorContext)
  const validClocks = clocks && +clocks[1] <= 23 && +clocks[3] <= 23 && +clocks[3] * 60 + +clocks[4] > +clocks[1] * 60 + +clocks[2]
  const literalRanges = ['event_start','event_end'].includes(point.type) ? unique(rangeQuotes).filter(q=>q.includes(point.rawText)).flatMap(q=>[...point.rawText.matchAll(/(?<!\d)((?:\d{4}年)?\d{1,2}月\d{1,2}日)\s*(\d{1,2}):([0-5]\d)\s*[-—–至到]\s*(\d{1,2}):([0-5]\d)(?!\d)/gu)].map(m=>({q,m}))) : []
  const closed = literalRanges.length===1 && +literalRanges[0].m[2]<24 && +literalRanges[0].m[4]<24
    && +literalRanges[0].m[4]*60+ +literalRanges[0].m[5]>+literalRanges[0].m[2]*60+ +literalRanges[0].m[3] ? literalRanges[0] : null
  if(literalRanges.length>0&&!closed){
    Object.assign(point,{normalizedValue:null,isAllDay:false,precision:'vague',needsConfirmation:true})
    audit.unresolved.push({entityId:point.tempId,reason:'EVENT_RANGE_ENDPOINT_AMBIGUOUS'})
    return
  }
  const expanded = closed ? closed.m[1]+(point.type==='event_start'?closed.m[2]+':'+closed.m[3]:closed.m[4]+':'+closed.m[5]) : null
  if(expanded&&closed)audit.rangeSupport.push({entityId:point.tempId,quote:closed.q,literalRange:closed.m[0],expanded,rule:'CITED_SAME_EVENT_CLOCK_RANGE'})
  const sameDayClock=inheritedDate&&/(?:当日|同日|当天)(\d{1,2}:[0-5]\d)(?:前)?/u.exec(point.rawText)
  const sameDayEndpoint=sameDayClock&&[...point.rawText.matchAll(/\d{1,2}:[0-5]\d/gu)].length===1?inheritedDate!.replace(/(\d{4})-(\d{2})-(\d{2})/u,'$1年$2月$3日')+sameDayClock[1]:null
  const composed = expanded ?? sameDayEndpoint ?? (inheritedDate && (heading||Boolean(anchorContext)) && validClocks && ['event_start','event_end'].includes(point.type)
    ? inheritedDate.replace(/(\d{4})-(\d{2})-(\d{2})/u,'$1年$2月$3日') + ' ' + (point.type === 'event_start' ? clocks[1]+':'+clocks[2] : clocks[3]+':'+clocks[4]) : null
  )
  if (composed) audit.rangeSupport.push({entityId:point.tempId,quote:anchorContext+'\n'+point.rawText,literalRange:point.rawText,expanded:composed,rule:'CITED_SAME_EVENT_CLOCK_RANGE'})
  const nextDay=inheritedDate&&point.type==='event_end'&&/^次日\d{1,2}点/u.test(point.rawText)?addDateOnlyDays(inheritedDate,1):null
  const nextDayLiteral=nextDay?nextDay.replace(/(\d{4})-(\d{2})-(\d{2})/u,'$1年$2月$3日')+point.rawText.replace(/^次日/u,''):null
  // A bare next-day hour can mean AM or PM. Resolve only when the same cited
  // event's explicit start and duration leave exactly one matching endpoint.
  // Missing endpoints/owners, unsupported duration or contradictions stay unknown.
  const bareNext=/^次日(\d{1,2})点(?:([0-5]?\d)分|(半))?$/u.exec(point.rawText)
  const durationQuotes=nextDay&&anchorMinutes!==undefined&&bareNext&&+bareNext[1]>=1&&+bareNext[1]<=12?unique(rangeQuotes).filter(q=>q.includes(point.rawText)&&q.indexOf(point.rawText)===q.lastIndexOf(point.rawText)&&q.startsWith(anchorContext.split('\n')[0])):[]
  const durations=durationQuotes.flatMap(q=>{const suffix=q.slice(q.indexOf(point.rawText)+point.rawText.length);const m=/^(?:停机维护|停机|维护|培训|举行|会议|活动|结束)?[，,\s]*(?:预计|持续)?(\d+(?:\.\d+)?)小时(?:[，,。\s]|$)/u.exec(suffix);return m&&+m[1]>0&&+m[1]<=24?[{quote:q,minutes:+m[1]*60}]:[]})
  let verifiedNext:string|null=null
  if(nextDay&&anchorMinutes!==undefined&&bareNext&&durations.length===1){
   const minute=bareNext[3]?30:Number(bareNext[2]??0),hours=[+bareNext[1]%12,+bareNext[1]%12+12],matches=hours.filter(h=>1440+h*60+minute-anchorMinutes===durations[0].minutes)
   if(matches.length===1){verifiedNext=nextDay.replace(/(\d{4})-(\d{2})-(\d{2})/u,'$1年$2月$3日')+' '+String(matches[0]).padStart(2,'0')+':'+String(minute).padStart(2,'0');audit.rangeSupport.push({entityId:point.tempId,quote:durations[0].quote,literalRange:point.rawText,expanded:verifiedNext,rule:'CITED_NEXT_DAY_DURATION_CONSENSUS'})}
  }
  const interpretation = interpretTimeD26(verifiedNext??nextDayLiteral??composed ?? range?.expanded ?? point.rawText, { type: point.type, referenceTime, timezone, inheritedDate,
    sourceContext: [anchorContext, range?.quote, ...quotes.filter(quote => quote.includes(point.rawText)).map(quote => timeClause(point.rawText, quote))].filter(Boolean).join('\n') })
  // The AST keeps both endpoints of a literal range. Select its end only for
  // an already-declared end attached to the same unique existing event. Never
  // create a missing endpoint or borrow a range from a different owner.
  if (point.type === 'event_end' && rangeQuotes.filter(q => q.includes(point.rawText)).length === 1
    && !interpretation.point.needsConfirmation && interpretation.point.normalizedValue
    && interpretation.point.rangeEndNormalizedValue && interpretation.point.rangeEndNormalizedValue > interpretation.point.normalizedValue) {
    interpretation.point.normalizedValue = interpretation.point.rangeEndNormalizedValue
    audit.rangeSupport.push({entityId:point.tempId,quote:rangeQuotes.find(q=>q.includes(point.rawText))!,literalRange:point.rawText,expanded:interpretation.point.normalizedValue,rule:'CITED_SAME_EVENT_CLOCK_RANGE'})
  }
  Object.assign(point, fields(interpretation.point))
  audit.times.push({ entityId: point.tempId, before, after: fields(point), interpretation })
}

type EventAnchorOwner = { evidenceIds?: string[]; tempId: string; startTimePointTempId: string | null; endTimePointTempId: string | null }
type AnchorPoint = { evidenceIds?: string[]; tempId: string; rawText: string; type: TimePointSuggestionV2['type'] }
function citedEventDate(point: AnchorPoint, events: EventAnchorOwner[], quotes: (id: string) => string[], eventQuotes: (id: string) => string[], sourceText: string, referenceTime: string, timezone: string) {
  if (!['event_start', 'event_end'].includes(point.type)) return undefined
  // A date heading is usable only when the model already cites it for this
  // endpoint AND its unique event owner, immediately above the cited time row.
  // This does not scan unrelated source dates or create a missing endpoint.
  const dates = unique(quotes(point.tempId).filter(q => /^(?:日期[：:]?\s*|时间[：:]?\s*)?\d{4}年\d{1,2}月\d{1,2}日(?:[（(](?:周|星期)[一二三四五六日天][）)])?\s*$/u.test(q)))
  if (!dates.length) return undefined
  const blocked = { date: undefined, context: '', blocked: true }
  const owners = events.filter(e => e.startTimePointTempId === point.tempId || e.endTimePointTempId === point.tempId)
  if (dates.length !== 1 || owners.length !== 1 || !eventQuotes(owners[0].tempId).includes(dates[0])) return blocked
  const dateQuote = dates[0], at = sourceText.indexOf(dateQuote)
  if (at < 0 || sourceText.indexOf(dateQuote, at + 1) >= 0) return blocked
  const adjacent = quotes(point.tempId).filter(q => q.includes(point.rawText)).some(q => {
    const start = sourceText.indexOf(q)
    return start >= at + dateQuote.length && sourceText.indexOf(q, start + 1) < 0
      && /^\s*$/u.test(sourceText.slice(at + dateQuote.length, start))
  })
  const date = interpretTimeD26(dateQuote, { type: point.type, referenceTime, timezone })
  return adjacent && date.point.precision === 'date_only' && !date.point.needsConfirmation && date.knownDate
    ? { date: date.knownDate, context: dateQuote, blocked: false } : blocked
}

function eventAnchor(pointId: string, events: EventAnchorOwner[], points: AnchorPoint[], quotes: (id: string) => string[], eventQuotes: (id: string) => string[], sourceText: string, referenceTime: string, timezone: string) {
  const owners = events.filter(event => event.endTimePointTempId === pointId)
  const anchors = owners.flatMap(event => {
    const start = points.find(point => point.tempId === event.startTimePointTempId)
    if (!start || start.tempId === pointId || !supported(start.rawText, quotes(start.tempId))) return []
    const heading = citedEventDate(start, events, quotes, eventQuotes, sourceText, referenceTime, timezone)
    if (heading?.blocked) return []
    const sourceContext = [heading?.context, ...quotes(start.tempId).filter(quote => quote.includes(start.rawText)).map(quote => timeClause(start.rawText, quote))].filter(Boolean).join('\n')
    const interpreted = interpretTimeD26(start.rawText, { type: start.type, referenceTime, timezone, sourceContext, inheritedDate: heading?.date })
    const clock=/T(\d{2}):([0-5]\d)$/u.exec(interpreted.point.normalizedValue??'')
    return interpreted.knownDate ? [{ date: interpreted.knownDate, context: sourceContext,...(clock&&!interpreted.point.needsConfirmation?{startMinutes:+clock[1]*60+ +clock[2]}:{}) }] : []
  })
  // Shared endpoints with disagreeing or absent anchors remain unresolved.
  return owners.length > 0 && anchors.length === owners.length && new Set(anchors.map(anchor => anchor.date)).size === 1 ? anchors[0] : undefined
}

function citedSameDayDate(point:AnchorPoint,quotes:(id:string)=>string[],source:string,referenceTime:string,timezone:string){
 if(!/(?:当日|同日|当天)\d{1,2}:[0-5]\d(?:前)?/u.test(point.rawText)||[...point.rawText.matchAll(/\d{1,2}:[0-5]\d/gu)].length!==1||/[。；\n]|取消|作废|如果|若/u.test(point.rawText))return undefined
 const all=unique(quotes(point.tempId).filter(q=>q.includes(point.rawText))),rows=all.filter(q=>!all.some(other=>other.length>q.length&&other.includes(q)));if(rows.length!==1)return undefined
 const at=source.indexOf(rows[0]);if(at<0||source.indexOf(rows[0],at+1)>=0)return undefined
 const pointAt=rows[0].indexOf(point.rawText)
 const preceding=source.slice(0,at+pointAt).split(/[。\n]/u).at(-1)??''
 const dates=[...preceding.matchAll(/\d{4}年\d{1,2}月\d{1,2}日/gu)]
 if(dates.length!==1||/次日|另日|取消|作废|若|如果/u.test(preceding))return undefined
 const parsed=interpretTimeD26(dates[0][0],{type:point.type,referenceTime,timezone})
 return parsed.knownDate&&!parsed.point.needsConfirmation?{date:parsed.knownDate,context:preceding+'\n'+rows[0]}:undefined
}

/** Existing endpoint + explicit same-day/sequence connector + immediately
 * preceding cited event. No scan of unrelated registration dates or new owner. */
function sequentialEventDate(point:AnchorPoint,events:EventAnchorOwner[],points:AnchorPoint[],evidence:RecognitionResult['evidence'],sourceText:string,referenceTime:string,timezone:string){
 const sequence=citedEventSequence(point,events,points,evidence,sourceText)
 if(!sequence)return undefined
 const date=interpretTimeD26(sequence.dateLiteral,{type:point.type,referenceTime,timezone})
 return date.knownDate&&!date.point.needsConfirmation?{date:date.knownDate,context:sequence.context,blocked:false}:undefined
}

/** Consume schema-validated semantic facts, preserve original prose, do not infer missing facts or fix graph edges. */
export function assembleSemanticFirstSuggestionD26(input: SemanticInput, context: WireContext) {
  const result = structuredClone(input), audit = auditRecord()
  const quote = (ids: string[]) => ids.flatMap(id => context.index.scopes.find(scope => scope.id === id)?.text ?? [])
  const pointQuotes = (id: string) => quote(result.timePoints.find(p => p.tempId === id)?.scopeIds ?? [])
  const eventQuotes = (id: string) => quote(result.events.find(e => e.tempId === id)?.scopeIds ?? [])
  for (const point of result.timePoints) {
    const heading = citedEventDate(point, result.events, pointQuotes, eventQuotes, context.index.sourceContent, context.referenceTime, context.timezone)
    const anchor = heading ?? eventAnchor(point.tempId, result.events, result.timePoints, pointQuotes, eventQuotes, context.index.sourceContent, context.referenceTime, context.timezone)
    if (heading?.blocked) audit.unresolved.push({ entityId: point.tempId, reason: 'EVENT_DATE_HEADING_NOT_UNAMBIGUOUS' })
    const owners = result.events.filter(e => e.startTimePointTempId === point.tempId || e.endTimePointTempId === point.tempId)
    const rangeQuotes = owners.length === 1 ? pointQuotes(point.tempId).filter(q => eventQuotes(owners[0].tempId).includes(q)) : []
    time(point, quote(point.scopeIds), context.referenceTime, context.timezone, audit, anchor?.date, anchor?.context, rangeQuotes)
  }
  for (const task of result.tasks) {
    const quotes = quote(task.propositionScopeIds)
    // A URL colon can split one action into adjacent source scopes. Its value
    // must begin inside its declared scope and all remaining bytes be cited by
    // the same proposition; unrelated clauses cannot provide the missing text.
    const partSupported=(value:string,scopeId:string)=>{
      if(supported(value,quote([scopeId])))return true
      const own=context.index.scopes.find(s=>s.id===scopeId),start=context.index.sourceContent.indexOf(value)
      return Boolean(own&&task.propositionScopeIds.includes(scopeId)&&start>=own.start&&start<own.end
        &&supportedAdjacent(value,quotes,context.index.sourceContent))
    }
    const grounded = partSupported(task.action.surface,task.action.scopeId) && (partSupported(task.object.surface,task.object.scopeId) || supportedCoordinatedObject(task.object.surface,task.action.surface,quote([task.object.scopeId])))
    const original = { entityId: task.id, kind: 'task' as const, title: task.detail.title, description: task.detail.description }
    Object.assign(task.detail, prose(audit, original, grounded ? supportedCoordinatedObject(task.object.surface,task.action.surface,quote([task.object.scopeId]))?task.action.surface:taskActionText(task.action.surface, task.object.surface) : '待核对事项',
      grounded ? unique(quotes).join('\n') : '动作或对象缺少对应来源依据，请核对。'))
    if (!grounded) audit.unresolved.push({ entityId: task.id, reason: 'ACTION_OBJECT_SOURCE_SUPPORT_MISSING' })
  }
  for (const event of result.events) {
    const quotes = quote(event.scopeIds), grounded = supportedAdjacent(event.title, quotes, context.index.sourceContent)||supportedEventDescriptor(event.title,quotes)||supportedEventOperation(event.title,quotes,context.index.sourceContent)
    const original = { entityId: event.tempId, kind: 'event' as const, title: event.title, description: event.description }
    Object.assign(event, prose(audit, original, grounded ? event.title : '待核对事件', grounded ? unique(quotes).join('\n') : '事件内容缺少对应来源依据，请核对。'))
    if (!grounded) audit.unresolved.push({ entityId: event.tempId, reason: 'EVENT_SOURCE_SUPPORT_MISSING' })
  }
  return { result, audit }
}

export function adaptModelWireD26(input: unknown, context: WireContext) {
  const adapted = adaptModelWire(input, context)
  const first = assembleSemanticFirstSuggestionD26(adapted.adapted, context)
  return { wire: adapted.wire, originalAdapted: adapted.adapted, adapted: first.result, audit: first.audit }
}

/** Same time/display policy for the ordinary RecognitionResult. No experimental runtime or storage dependency. */
export function assembleRecognitionFirstSuggestionD26(input: RecognitionResult, context: { sourceText: string; referenceTime: string; timezone: string }) {
  // Machine product-wire items share the Worker's isolation rule. Manual and
  // legacy semantic views keep their existing field-level source/verb checks;
  // they are not untrusted raw model containers to silently rewrite here.
  const isolated=input.promptVersion.startsWith('recognition-product-contract-')?isolateRecognitionItems(input,context.sourceText,{allowNoUsableSubset:true}):{result:input,audit:{version:'recognition-local-isolation-1.0.0' as const,inferredFacts:0 as const,quarantined:[],structure:[],relations:[]},rootFailure:false}
  if(!isolated.result)throw Error('RECOGNITION_ROOT_INVALID')
  const result = structuredClone(isolated.result), audit = auditRecord()
  if(isolated.audit.quarantined.length||isolated.audit.structure.length||isolated.audit.relations.length)audit.localIsolation=isolated.audit
  for(const note of result.ambiguities.filter(a=>a.id.startsWith(LOCAL_ISOLATION_NOTE_PREFIX)))audit.unresolved.push({entityId:note.id,reason:note.field==='source_coverage'?'MODEL_OUTPUT_INCOMPLETE':'MODEL_ITEM_QUARANTINED_PENDING_SOURCE_REVIEW'})
  audit.declaredSourceInformation=retainDeclaredSourceInformation(result,context.sourceText)
  audit.sourceCurrentness=retainCurrentDeadlineFacts(result,context.sourceText)
  audit.activityRoles=groundActivityRoles(result,context.sourceText,'names')
  audit.declaredEventNameSupport=completeDeclaredEventNameSupport(result,context.sourceText)
  audit.citedOwnerSupport=completeCitedOwnerSupport(result,context.sourceText)
  audit.citedSourceWindows=completeCitedSourceWindows(result,context.sourceText,context.referenceTime,context.timezone)
  const clockRanges=projectCitedClockRanges(result,context.sourceText,context.referenceTime,context.timezone)
  Object.assign(result,clockRanges.result)
  audit.citedClockRanges=clockRanges.audit.decisions
  const genericApplication=/(?:项目|课题)(?:申请|申报)/u.test(context.sourceText)&&!/项目名称|课题名称|项目编号|课题编号|里程碑|分阶段|[“「『]/u.test(context.sourceText)
  // A proposed project name is only an option. It does not require creating a
  // project for an otherwise standalone notice, and remains available to edit.
  if(result.projectMatch.decision==='uncertain'&&!result.projectMatch.matchedProjectId&&result.milestones.length===0&&result.standaloneTasks.length>0&&(!/项目|课题|立项/u.test(context.sourceText)||genericApplication)){
    const reason='通知未声明项目结构，先作为独立事项；项目关联可稍后调整。'
    audit.projectDisplayDefault={before:'uncertain',after:'standalone_task',reason}
    result.projectMatch.decision='standalone_task';result.projectMatch.reasons=[...result.projectMatch.reasons,reason]
    result.ambiguities=result.ambiguities.filter(a=>a.field!=='projectMatch')
    result.quality.reviewReasons=result.quality.reviewReasons.filter(r=>!/项目归属|项目匹配|项目关联/u.test(r))
    if(!result.quality.reviewReasons.length&&!result.conflicts.some(c=>c.requiresDecision)&&!result.ambiguities.length&&result.quality.missingActionRisk<.3)result.quality.needsHumanReview=false
  }
  const quote = (ids: string[]) => ids.flatMap(id => {
    const evidence = result.evidence.find(row => row.id === id)
    return evidence?.quote && context.sourceText.includes(evidence.quote) ? [evidence.quote] : []
  })
  const pointQuotes = (id: string) => {
    const point = result.timePoints.find(p => p.tempId === id)
    const quotes = quote(point?.evidenceIds ?? [])
    // An exact source value can cross adjacent punctuation scopes. Require
    // actual source-span coverage before offering the same literal to time().
    return point && supportedAdjacent(point.rawText, quotes, context.sourceText)
      ? unique([...quotes, point.rawText]) : quotes
  }
  const eventQuotes = (id: string) => quote(result.events.find(e => e.tempId === id)?.evidenceIds ?? [])
  for (const point of result.timePoints) {
    const clockRange=audit.citedClockRanges.find(d=>d.pointId===point.tempId)
    if(clockRange){if(clockRange.blocked)audit.unresolved.push({entityId:point.tempId,reason:clockRange.reason});continue}
    const split=citedTaskDateRange(point,[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])],result.timePoints,result.evidence,context.sourceText)??citedSplitEventRange(point,result.events,result.timePoints,result.evidence,context.sourceText)
    const heading = split?undefined:citedEventDate(point, result.events, pointQuotes, eventQuotes, context.sourceText, context.referenceTime, context.timezone)
    const sequence = sequentialEventDate(point,result.events,result.timePoints,result.evidence,context.sourceText,context.referenceTime,context.timezone)
    const sameDay=citedSameDayDate(point,pointQuotes,context.sourceText,context.referenceTime,context.timezone)
    const anchor = heading ?? eventAnchor(point.tempId, result.events, result.timePoints, pointQuotes, eventQuotes, context.sourceText, context.referenceTime, context.timezone) ?? sequence ?? sameDay
    if(sequence)audit.rangeSupport.push({entityId:point.tempId,quote:sequence.context,literalRange:point.rawText,expanded:sequence.date+'T'+point.rawText,rule:'CITED_ADJACENT_SAME_DAY_EVENT'})
    if (heading?.blocked) audit.unresolved.push({ entityId: point.tempId, reason: 'EVENT_DATE_HEADING_NOT_UNAMBIGUOUS' })
    const owners = result.events.filter(e => e.startTimePointTempId === point.tempId || e.endTimePointTempId === point.tempId)
    const window=audit.citedSourceWindows.decisions.find(w=>[w.startPointId,w.endPointId].includes(point.tempId))
    const rangeQuotes = window?quote(window.evidenceIds):owners.length === 1 ? unique([...pointQuotes(point.tempId).filter(q => eventQuotes(owners[0].tempId).includes(q)),...(/^次日/u.test(point.rawText)?contiguousEventQuotes(eventQuotes(owners[0].tempId),context.sourceText):[])]) : []
    time(point, pointQuotes(point.tempId), context.referenceTime, context.timezone, audit, anchor?.date, anchor?.context, rangeQuotes,'startMinutes' in (anchor??{})?(anchor as {startMinutes?:number}).startMinutes:undefined,split??undefined)
  }
  const tasks: TaskSuggestionV2[] = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  for (const task of tasks) {
    boundActionField(task,quote(task.evidenceIds),context.sourceText,audit)
    const quotes = quote(task.evidenceIds),completion=supportedCourseCompletion(task,quotes,result.timePoints),grounded = completion||supportedAdjacent(task.actionVerb, quotes,context.sourceText) && (supportedAdjacent(task.actionObject, quotes,context.sourceText)||supportedCoordinatedObject(task.actionObject,task.actionVerb,quotes))
    if(completion)audit.actionFields.push({entityId:task.tempId,before:task.actionVerb,after:task.actionVerb,status:'EXISTING_COURSE_COMPLETION_SUPPORT',quotes})
    const original = { entityId: task.tempId, kind: 'task' as const, title: task.title, description: task.description }
    Object.assign(task, prose(audit, original, grounded ? supportedCoordinatedObject(task.actionObject,task.actionVerb,quotes)?task.actionVerb:taskActionText(task.actionVerb, task.actionObject) : '待核对事项',
      grounded ? unique(quotes).join('\n') : '动作或对象缺少对应来源依据，请核对。'))
    if (!grounded) {
      task.selected = false; audit.unresolved.push({ entityId: task.tempId, reason: 'ACTION_OBJECT_SOURCE_SUPPORT_MISSING' })
      const id='source-action-evidence:'+task.tempId
      result.conflicts=result.conflicts.filter(c=>c.id!==id)
      if(!audit.actionFields.some(row=>row.entityId===task.tempId&&row.status==='LOCAL_UNRESOLVED_ACTION'))result.conflicts.push({id,type:'other',message:'这项动作或对象的原文关联不完整，暂不能直接保存；请查看它的原文依据。其他依据完整的事项可以单独确认。',entityTempIds:[task.tempId],evidenceIds:task.evidenceIds,requiresDecision:true})
    }
  }
  for (const event of result.events) {
    const quotes = quote(event.evidenceIds), grounded = supportedAdjacent(event.title, quotes, context.sourceText)||supportedEventDescriptor(event.title,quotes)||supportedEventOperation(event.title,quotes,context.sourceText,true)
    const original = { entityId: event.tempId, kind: 'event' as const, title: event.title, description: event.description }
    Object.assign(event, prose(audit, original, grounded ? event.title : '待核对事件', grounded ? unique(quotes).join('\n') : '事件内容缺少对应来源依据，请核对。'))
    if (!grounded) {
      event.selected = false; audit.unresolved.push({ entityId: event.tempId, reason: 'EVENT_SOURCE_SUPPORT_MISSING' })
      const id='source-event-evidence:'+event.tempId
      result.conflicts=result.conflicts.filter(c=>c.id!==id)
      result.conflicts.push({id,type:'other',message:'这个活动的内容或原文关联不完整，暂不能直接保存；请查看活动的原文依据。其他依据完整的事项可以单独确认。',entityTempIds:[event.tempId],evidenceIds:event.evidenceIds,requiresDecision:true})
    }
  }
  const title = tasks.length ? tasks[0].title : result.events[0]?.title ?? '通知资料'
  const summary = tasks.length || result.events.length ? `${tasks.length}项任务，${result.events.length}项事件。请核对后确认。` : '未识别到需要执行的任务或事件；原文已保留，可核对并归档。'
  prose(audit, { entityId: 'source', kind: 'source', title: result.sourceSummary.title, description: result.sourceSummary.summary }, title, summary)
  Object.assign(result.sourceSummary, { title, summary })
  retainActionBlocks(result,audit)
  if (audit.unresolved.length) {
    result.quality.needsHumanReview = true
    result.quality.reviewReasons = unique([...result.quality.reviewReasons, '部分首次摘要缺少完整来源依据，请核对标记事项。'])
  }
  audit.activityRoles.invalidEnds=groundActivityRoles(result,context.sourceText,'ends').invalidEnds
  audit.nativePreconditionReview=nativePreconditionIssues(result,context.sourceText)
  for(const risk of audit.nativePreconditionReview){const id='native-precondition:'+risk.taskId;result.conflicts=result.conflicts.filter(c=>c.id!==id);result.conflicts.push({id,type:'other',message:risk.reason,entityTempIds:[risk.taskId],evidenceIds:risk.evidenceIds,requiresDecision:true});result.quality.needsHumanReview=true}
  audit.nativeQualificationReview=nativeQualificationReviews(result,context.sourceText)
  return { result, audit }
}

export interface D26RepresentationGap {
  kind: 'condition' | 'lifecycle' | 'revision' | 'event_task_relation' | 'unresolved_scope'
  entityIds: string[]
  reason: string
}
export interface D26SemanticSidecar {
  version: 'semantic-ordinary-bridge-1.2.0'
  originalSemantic: SemanticInput
  firstSemantic: SemanticInput
  sourceScopeEvidence: Array<{ scopeId: string; evidenceId: string }>
  representationGaps: D26RepresentationGap[]
  displayAudit: D26FirstSuggestionAudit
  eligibilityAudit: ReturnType<typeof groundEligibility>
}

/** Typed projection only. Missing 2.0 vocabulary remains in sidecar and blocks affected confirmations. */
export function bridgeSemanticToRecognitionD26(input: SemanticInput, context: WireContext) {
  const { result: first, audit } = assembleSemanticFirstSuggestionD26(input, context)
  const evidenceId = (scopeId: string) => 'd26-' + scopeId
  const evidenceIds = (scopeIds: string[]) => scopeIds.map(evidenceId)
  const gaps: D26RepresentationGap[] = []
  const eligibilityAudit = groundEligibility(first, context)
  for (const task of first.tasks) {
    const eligibility = eligibilityAudit.decisions.find(d => d.taskId === task.id)
    if (eligibility?.status === 'RETAIN_REVIEW') gaps.push({ kind: 'condition', entityIds: [task.id], reason: eligibility.reason })
    if (task.semantics.status !== 'pending' || task.semantics.validity !== 'active' || task.semantics.polarity !== 'affirmative' || task.semantics.modality !== 'required' || !['addressee', 'addressed_group'].includes(task.semantics.actor)) {
      gaps.push({ kind: 'lifecycle', entityIds: [task.id], reason: '当前状态、执行人或义务类型不能由普通任务字段完整表达。' })
    }
  }
  for (const revision of first.revisions) gaps.push({ kind: 'revision', entityIds: [revision.targetDirectiveId, ...(revision.fromDirectiveId ? [revision.fromDirectiveId] : [])], reason: '取消或替代关系保留原始端点，需核对后才能接受相关事项。' })
  for (const scopeId of first.unresolvedScopeIds) gaps.push({ kind: 'unresolved_scope', entityIds: first.tasks.filter(task => task.propositionScopeIds.includes(scopeId)).map(task => task.id), reason: '存在尚未解决的来源片段。' })
  const blocked = new Set(gaps.flatMap(gap => gap.entityIds))
  const result: RecognitionResult = {
    schemaVersion: '2.0', promptVersion: 'd26-common-bridge-1', modelName: 'engineering-semantic-projection', createdAt: context.referenceTime,
    sourceSummary: { title: first.tasks[0]?.detail.title ?? first.events[0]?.title ?? '通知资料', sourceType: 'text', notificationType: first.tasks.length ? 'uncertain' : first.events.length ? 'event_notice' : 'information_only', summary: `${first.tasks.length}项任务，${first.events.length}项事件。`, requiresAction: first.tasks.length > 0, actionReason: '依据来源中已识别的结构化事实，确认后保存。' },
    projectMatch: { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null, confidence: 1, reasons: ['未主动建立或匹配项目。'] }, projectSuggestion: null, milestones: [],
    standaloneTasks: first.tasks.map(task => ({ ...task.detail, tempId: task.id, actionVerb: task.action.surface, actionObject: task.object.surface, evidenceIds: evidenceIds(task.propositionScopeIds), inferenceLevel: task.inferenceLevel, selected: !blocked.has(task.id) && !audit.unresolved.some(row => row.entityId === task.id) })),
    materials: first.materials.map(({ scopeIds, ...material }) => ({ ...material, evidenceIds: evidenceIds(scopeIds) })),
    timePoints: first.timePoints.map(({ scopeIds, ...point }) => ({ ...point, evidenceIds: evidenceIds(scopeIds) })),
    events: first.events.map(event => ({ tempId: event.tempId, title: event.title, description: event.description, startTimePointTempId: event.startTimePointTempId,
      ...(event.relatedTaskTempIds.length ? { relatedTaskTempIds: [...event.relatedTaskTempIds] } : {}),
      endTimePointTempId: event.endTimePointTempId, location: event.location, confidence: event.confidence, inferenceLevel: event.inferenceLevel,
      evidenceIds: evidenceIds(event.scopeIds), selected: !blocked.has(event.tempId) })),
    evidence: context.index.scopes.map(scope => ({ id: evidenceId(scope.id), sourceId: first.sourceId, quote: scope.text, field: 'description', extractionMethod: 'parser', confidence: 1 })),
    conflicts: [...first.conflicts.map(({ scopeIds, ...conflict }) => ({ ...conflict, evidenceIds: evidenceIds(scopeIds) })), ...gaps.map((gap, i) => ({ id: 'd26-representation-' + i, type: 'other' as const, message: gap.reason, entityTempIds: gap.entityIds, evidenceIds: [], requiresDecision: true }))],
    ambiguities: [], ignoredContent: first.informationScopeIds.flatMap(id => { const scope = context.index.scopes.find(row => row.id === id); return scope ? [{ text: scope.text, reason: 'other' as const }] : [] }),
    quality: { overallConfidence: 1, hierarchyConfidence: 1, dateConfidence: first.timePoints.some(point => point.needsConfirmation) ? 0.5 : 1, evidenceCoverage: 1, duplicateRisk: 0, overFragmentationRisk: 0, missingActionRisk: 0, needsHumanReview: gaps.length > 0 || audit.unresolved.length > 0, reviewReasons: unique(gaps.map(gap => gap.reason)) },
  }
  const sidecar: D26SemanticSidecar = { version: 'semantic-ordinary-bridge-1.2.0', originalSemantic: structuredClone(input), firstSemantic: first,
    sourceScopeEvidence: context.index.scopes.map(scope => ({ scopeId: scope.id, evidenceId: evidenceId(scope.id) })), representationGaps: gaps, displayAudit: audit, eligibilityAudit }
  for(const task of result.standaloneTasks)boundActionField(task,quoteTask(task.evidenceIds),context.index.sourceContent,audit)
  retainActionBlocks(result,audit)
  if(audit.unresolved.length)result.quality.needsHumanReview=true
  function quoteTask(ids:string[]){return result.evidence.filter(e=>ids.includes(e.id)).map(e=>e.quote!).filter(Boolean)}
  return { result, sidecar, audit, representationGaps: gaps }
}
