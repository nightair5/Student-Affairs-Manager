import type { EventSuggestion, RecognitionResult } from './types'
import { citedCourseScope, courseTaskSupported } from './citedCourseScope'
import { citedAlternativeObligations } from './nativeConditionalObligation'
import { existingHandlingWindows } from './handlingWindowSupport'

export const CITED_OPPORTUNITY_PROJECTION_VERSION = 'cited-opportunity-view-1.0.0'
export interface OpportunityDecision {
  rule: 'EXISTING_LEARNING_PERIOD_NOT_FIXED_ATTENDANCE' | 'EXISTING_ALTERNATIVE_RECEIPT_WINDOW_NOT_FIXED_ATTENDANCE'
  event: EventSuggestion
  taskIds: string[]
  pointIds: string[]
  evidenceIds: string[]
  retainedAttributes?: Array<{ taskId: string; field: 'learningPlatform'; value: string; evidenceIds: string[] }>
}

/** Machine-generated opportunity views may repeat an already owned task
 * interval as an event. Keep its full original declaration in audit, retain
 * every canonical point, and expose it as a task window. Manual/legacy views
 * are intentionally preserved; this is not a migration of confirmed data. */
export function projectCitedOpportunityViews(result: RecognitionResult, source: string, referenceTime: string, timezone: string) {
  const decisions: OpportunityDecision[] = []
  if (!result.promptVersion.startsWith('recognition-product-contract-')) return { version: CITED_OPPORTUNITY_PROJECTION_VERSION, decisions }
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  const courseScope = citedCourseScope(structuredClone(result), source), alternatives = citedAlternativeObligations(result, source)
  const alternativeTasks = new Set(alternatives.flatMap(a => [a.taskId, a.alternativeTaskId!]))
  const windows = existingHandlingWindows(result, source, referenceTime, timezone).rows
  for (const event of result.events) {
    const owners = tasks.filter(t => event.relatedTaskTempIds?.includes(t.tempId))
    if (!owners.length || owners.length !== new Set(event.relatedTaskTempIds).size
      || result.conflicts.some(c => c.requiresDecision && c.entityTempIds.includes(event.tempId))) continue
    const points = [event.startTimePointTempId, event.endTimePointTempId].map(id => result.timePoints.find(p => p.tempId === id))
    if (points.some(p => !p || !p.normalizedValue || p.needsConfirmation) || points[0]!.type !== 'event_start' || points[1]!.type !== 'event_end'
      || result.events.some(e => e !== event && [e.startTimePointTempId, e.endTimePointTempId].some(id => id && [event.startTimePointTempId, event.endTimePointTempId].includes(id)))) continue
    if (owners.some(t => points.some(p => !t.timePointTempIds.includes(p!.tempId) || !p!.relatedTaskTempIds.includes(t.tempId)))
      || points.some(p => p!.relatedTaskTempIds.length !== owners.length)) continue
    const learning = courseScope.decisions.find(d => d.entityId === event.tempId && d.rule === 'EXISTING_COURSE_LABELLED_EVENT')
    const platformProof = event.location === null ? [] : result.evidence.filter(e => event.evidenceIds.includes(e.id)
      && e.quote && source.includes(e.quote) && source.indexOf(e.quote) === source.lastIndexOf(e.quote)
      && e.quote.includes(event.location! + '提供的MOOC') && !/不是|并非|不由/u.test(e.quote))
    const learningWindow = learning && event.title.endsWith('网络学习') && (event.location === null || platformProof.length === 1) && points.every(p => p!.precision === 'date_only')
      && owners.every(t => courseTaskSupported(t, courseScope)) && !/集中|直播|授课|上课|必须参加|统一参加|固定时段|现场|集合|教室|课程表/u.test(learning.context)
      && owners.every(t => windows.some(w => w.taskId === t.tempId && w.kind === 'DATE_ONLY_PERIOD' && w.eventIds.includes(event.tempId)))
    const receiptWindow = owners.length === 1 && owners[0].actionVerb === '领取' && alternativeTasks.has(owners[0].tempId)
      && (event.title === owners[0].actionObject + '领取' || event.title === owners[0].actionObject + '补领')
      && windows.some(w => w.taskId === owners[0].tempId && w.eventIds.length === 1 && w.eventIds[0] === event.tempId)
    if (!learningWindow && !receiptWindow) continue
    const retainedAttributes: NonNullable<OpportunityDecision['retainedAttributes']> = []
    if (learningWindow && event.location !== null && owners.some(task =>
      new Set([...task.evidenceIds, ...platformProof.map(e => e.id)].flatMap(id => result.evidence.filter(e => e.id === id).map(e => e.sourceId))).size !== 1)) continue
    if (learningWindow && event.location !== null) for (const task of owners) {
      task.evidenceIds = [...new Set([...task.evidenceIds, ...platformProof.map(e => e.id)])]
      retainedAttributes.push({ taskId: task.tempId, field: 'learningPlatform', value: event.location, evidenceIds: platformProof.map(e => e.id) })
    }
    decisions.push({ rule: learningWindow ? 'EXISTING_LEARNING_PERIOD_NOT_FIXED_ATTENDANCE' : 'EXISTING_ALTERNATIVE_RECEIPT_WINDOW_NOT_FIXED_ATTENDANCE',
      event: structuredClone(event), taskIds: owners.map(t => t.tempId), pointIds: points.map(p => p!.tempId), evidenceIds: [...event.evidenceIds],
      ...(retainedAttributes.length ? { retainedAttributes } : {}) })
  }
  const removed = new Set(decisions.map(d => d.event.tempId))
  result.events = result.events.filter(e => !removed.has(e.tempId))
  return { version: CITED_OPPORTUNITY_PROJECTION_VERSION, decisions }
}
