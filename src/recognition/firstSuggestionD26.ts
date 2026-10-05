import { interpretTimeD26, type D26TimeInterpretation } from '../lib/timeSemanticsD26'
import { adaptModelWire, type WireContext } from '../experiments/realInput01/modelWire'
import type { SemanticInput } from '../experiments/mainline04/semanticContract'
import type { RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2 } from './types'
import { groundEligibility } from './eligibilityGrounding'

export const D26_FIRST_SUGGESTION_VERSION = 'grounded-first-suggestion-1.1.0'
interface ProseRecord { entityId: string; kind: 'task' | 'event' | 'source'; title: string; description: string }
export interface D26FirstSuggestionAudit {
  version: typeof D26_FIRST_SUGGESTION_VERSION
  originalProse: ProseRecord[]
  generatedProse: ProseRecord[]
  times: Array<{ entityId: string; before: TimeFields; after: TimeFields; interpretation: D26TimeInterpretation }>
  unresolved: Array<{ entityId: string; reason: string }>
  role: 'DETERMINISTIC_PRODUCT_ASSEMBLY_NOT_MODEL_OUTPUT'
}
type TimeFields = Pick<TimePointSuggestionV2, 'normalizedValue' | 'timezone' | 'isAllDay' | 'precision' | 'needsConfirmation'>
const fields = (point: TimeFields): TimeFields => ({ normalizedValue: point.normalizedValue, timezone: point.timezone,
  isAllDay: point.isAllDay, precision: point.precision, needsConfirmation: point.needsConfirmation })
const auditRecord = (): D26FirstSuggestionAudit => ({ version: D26_FIRST_SUGGESTION_VERSION, originalProse: [], generatedProse: [], times: [], unresolved: [], role: 'DETERMINISTIC_PRODUCT_ASSEMBLY_NOT_MODEL_OUTPUT' })
const supported = (value: string, quotes: string[]) => Boolean(value.trim()) && quotes.some(quote => quote.includes(value))
const unique = (values: string[]) => [...new Set(values)]
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
function time<T extends TimeFields & { tempId: string; rawText: string; type: TimePointSuggestionV2['type'] }>(point: T, quotes: string[], referenceTime: string, timezone: string, audit: D26FirstSuggestionAudit, inheritedDate?: string, anchorContext = '') {
  const before = fields(point)
  if (!supported(point.rawText, quotes)) {
    audit.unresolved.push({ entityId: point.tempId, reason: 'TIME_SOURCE_SUPPORT_MISSING' })
    Object.assign(point, { normalizedValue: null, isAllDay: false, precision: 'vague', needsConfirmation: true })
    return
  }
  const interpretation = interpretTimeD26(point.rawText, { type: point.type, referenceTime, timezone, inheritedDate,
    sourceContext: [anchorContext, ...quotes.filter(quote => quote.includes(point.rawText)).map(quote => timeClause(point.rawText, quote))].filter(Boolean).join('\n') })
  Object.assign(point, fields(interpretation.point))
  audit.times.push({ entityId: point.tempId, before, after: fields(point), interpretation })
}

type EventAnchorOwner = { tempId: string; startTimePointTempId: string | null; endTimePointTempId: string | null }
type AnchorPoint = { tempId: string; rawText: string; type: TimePointSuggestionV2['type'] }
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
    return interpreted.knownDate ? [{ date: interpreted.knownDate, context: sourceContext }] : []
  })
  // Shared endpoints with disagreeing or absent anchors remain unresolved.
  return owners.length > 0 && anchors.length === owners.length && new Set(anchors.map(anchor => anchor.date)).size === 1 ? anchors[0] : undefined
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
    time(point, quote(point.scopeIds), context.referenceTime, context.timezone, audit, anchor?.date, anchor?.context)
  }
  for (const task of result.tasks) {
    const quotes = quote(task.propositionScopeIds)
    const grounded = supported(task.action.surface, quote([task.action.scopeId])) && supported(task.object.surface, quote([task.object.scopeId]))
    const original = { entityId: task.id, kind: 'task' as const, title: task.detail.title, description: task.detail.description }
    Object.assign(task.detail, prose(audit, original, grounded ? task.action.surface + task.object.surface : '待核对事项',
      grounded ? unique(quotes).join('\n') : '动作或对象缺少对应来源依据，请核对。'))
    if (!grounded) audit.unresolved.push({ entityId: task.id, reason: 'ACTION_OBJECT_SOURCE_SUPPORT_MISSING' })
  }
  for (const event of result.events) {
    const quotes = quote(event.scopeIds), grounded = supported(event.title, quotes)
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
  const result = structuredClone(input), audit = auditRecord()
  const quote = (ids: string[]) => ids.flatMap(id => {
    const evidence = result.evidence.find(row => row.id === id)
    return evidence?.quote && context.sourceText.includes(evidence.quote) ? [evidence.quote] : []
  })
  const pointQuotes = (id: string) => quote(result.timePoints.find(p => p.tempId === id)?.evidenceIds ?? [])
  const eventQuotes = (id: string) => quote(result.events.find(e => e.tempId === id)?.evidenceIds ?? [])
  for (const point of result.timePoints) {
    const heading = citedEventDate(point, result.events, pointQuotes, eventQuotes, context.sourceText, context.referenceTime, context.timezone)
    const anchor = heading ?? eventAnchor(point.tempId, result.events, result.timePoints, pointQuotes, eventQuotes, context.sourceText, context.referenceTime, context.timezone)
    if (heading?.blocked) audit.unresolved.push({ entityId: point.tempId, reason: 'EVENT_DATE_HEADING_NOT_UNAMBIGUOUS' })
    time(point, quote(point.evidenceIds), context.referenceTime, context.timezone, audit, anchor?.date, anchor?.context)
  }
  const tasks: TaskSuggestionV2[] = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  for (const task of tasks) {
    const quotes = quote(task.evidenceIds), grounded = supported(task.actionVerb, quotes) && supported(task.actionObject, quotes)
    const original = { entityId: task.tempId, kind: 'task' as const, title: task.title, description: task.description }
    Object.assign(task, prose(audit, original, grounded ? task.actionVerb + task.actionObject : '待核对事项',
      grounded ? unique(quotes).join('\n') : '动作或对象缺少对应来源依据，请核对。'))
    if (!grounded) { task.selected = false; audit.unresolved.push({ entityId: task.tempId, reason: 'ACTION_OBJECT_SOURCE_SUPPORT_MISSING' }) }
  }
  for (const event of result.events) {
    const quotes = quote(event.evidenceIds), grounded = supported(event.title, quotes)
    const original = { entityId: event.tempId, kind: 'event' as const, title: event.title, description: event.description }
    Object.assign(event, prose(audit, original, grounded ? event.title : '待核对事件', grounded ? unique(quotes).join('\n') : '事件内容缺少对应来源依据，请核对。'))
    if (!grounded) { event.selected = false; audit.unresolved.push({ entityId: event.tempId, reason: 'EVENT_SOURCE_SUPPORT_MISSING' }) }
  }
  const title = tasks.length ? tasks[0].title : result.events[0]?.title ?? '通知资料'
  const summary = tasks.length || result.events.length ? `${tasks.length}项任务，${result.events.length}项事件。请核对后确认。` : '未识别到需要执行的任务或事件；原文已保留，可核对并归档。'
  prose(audit, { entityId: 'source', kind: 'source', title: result.sourceSummary.title, description: result.sourceSummary.summary }, title, summary)
  Object.assign(result.sourceSummary, { title, summary })
  if (audit.unresolved.length) {
    result.quality.needsHumanReview = true
    result.quality.reviewReasons = unique([...result.quality.reviewReasons, '部分首次摘要缺少完整来源依据，请核对标记事项。'])
  }
  return { result, audit }
}

export interface D26RepresentationGap {
  kind: 'condition' | 'lifecycle' | 'revision' | 'event_task_relation' | 'unresolved_scope'
  entityIds: string[]
  reason: string
}
export interface D26SemanticSidecar {
  version: 'semantic-ordinary-bridge-1.1.0'
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
  for (const event of first.events) if (event.relatedTaskTempIds.length) gaps.push({ kind: 'event_task_relation', entityIds: [event.tempId, ...event.relatedTaskTempIds], reason: '事件与任务关系保留在语义记录，普通结构尚不能完整表达。' })
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
      endTimePointTempId: event.endTimePointTempId, location: event.location, confidence: event.confidence, inferenceLevel: event.inferenceLevel,
      evidenceIds: evidenceIds(event.scopeIds), selected: !blocked.has(event.tempId) })),
    evidence: context.index.scopes.map(scope => ({ id: evidenceId(scope.id), sourceId: first.sourceId, quote: scope.text, field: 'description', extractionMethod: 'parser', confidence: 1 })),
    conflicts: [...first.conflicts.map(({ scopeIds, ...conflict }) => ({ ...conflict, evidenceIds: evidenceIds(scopeIds) })), ...gaps.map((gap, i) => ({ id: 'd26-representation-' + i, type: 'other' as const, message: gap.reason, entityTempIds: gap.entityIds, evidenceIds: [], requiresDecision: true }))],
    ambiguities: [], ignoredContent: first.informationScopeIds.flatMap(id => { const scope = context.index.scopes.find(row => row.id === id); return scope ? [{ text: scope.text, reason: 'other' as const }] : [] }),
    quality: { overallConfidence: 1, hierarchyConfidence: 1, dateConfidence: first.timePoints.some(point => point.needsConfirmation) ? 0.5 : 1, evidenceCoverage: 1, duplicateRisk: 0, overFragmentationRisk: 0, missingActionRisk: 0, needsHumanReview: gaps.length > 0 || audit.unresolved.length > 0, reviewReasons: unique(gaps.map(gap => gap.reason)) },
  }
  const sidecar: D26SemanticSidecar = { version: 'semantic-ordinary-bridge-1.1.0', originalSemantic: structuredClone(input), firstSemantic: first,
    sourceScopeEvidence: context.index.scopes.map(scope => ({ scopeId: scope.id, evidenceId: evidenceId(scope.id) })), representationGaps: gaps, displayAudit: audit, eligibilityAudit }
  return { result, sidecar, audit, representationGaps: gaps }
}
