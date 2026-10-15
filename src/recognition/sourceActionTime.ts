import type { RecognitionResult } from './types'
import { taskActionText } from '../lib/taskActionText'

export const SOURCE_ACTION_TIME_VERSION = 'source-action-time-role-1.0.3'
export interface SourceActionTimeDeclaration { id: string; owners: Array<{ kind: 'task'; entityId: string }> }
export interface SourceActionTimeDecision { id: string; ownerIds: string[]; beforeType: string; role: 'task_action_time'; reason: 'EXPLICIT_GENERATION_ROLE' | 'CITED_ACTION_AT_TIME'; quotes: string[] }
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

/** A source appointment is neither a deadline nor a personal plan. Reuse the
 * v8 start-point representation and retain its distinct role in the audit. */
export function groundSourceActionTimes(input: RecognitionResult, sourceText: string, declarations: SourceActionTimeDeclaration[] = []) {
  const result = structuredClone(input), decisions: SourceActionTimeDecision[] = [], rejectedDeadlineRoles: Array<{id:string;ownerIds:string[];rawText:string;beforeValue:string|null;reason:string}> = []
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  for (const p of result.timePoints) {
    // A cited calendar interval is not a scalar cutoff. With one model point,
    // keep the real interval and local risk; never fabricate its missing pair.
    if (p.type.endsWith('_deadline') && /^(?:\d{4}年)?\d{1,2}月\d{1,2}日?\s*[-—–至到]\s*(?:(?:\d{4}年)?\d{1,2}月)?\d{1,2}日$/u.test(p.rawText)) {
      const cited=result.evidence.filter(e=>p.evidenceIds.includes(e.id)&&e.quote&&sourceText.includes(e.quote)&&e.quote.includes(p.rawText)).map(e=>e.quote!)
      const window=cited.some(q=>q.split(/[。；\n]/u).some(clause=>clause.includes(p.rawText)&&/在|期间|窗口|开放/u.test(clause)&&!/截止|截至|最迟|不晚于|之前|以前/u.test(clause)))
      if(window){
        const ids=[p.tempId,...p.relatedTaskTempIds,...p.relatedMaterialTempIds]
        rejectedDeadlineRoles.push({id:p.tempId,ownerIds:ids.slice(1),rawText:p.rawText,beforeValue:p.normalizedValue,reason:'CITED_WINDOW_IS_NOT_A_SCALAR_DEADLINE'})
        Object.assign(p,{normalizedValue:null,precision:'vague' as const,isAllDay:false,needsConfirmation:true,selected:false})
        result.quality.needsHumanReview=true
        const id='source-window-cutoff-role:'+p.tempId
        result.conflicts=result.conflicts.filter(c=>c.id!==id)
        result.conflicts.push({id,type:'other',message:'原答把办理日期区间放成了截止；原文窗口已保留，尚未形成完整起止，不能作为确定截止或安排。',entityTempIds:ids,evidenceIds:p.evidenceIds,requiresDecision:true})
        continue
      }
    }
    const declaration = declarations.find(d => d.id === p.tempId)
    if(!declaration&&/(?:\d{1,2}:[0-5]\d)\s*[-—–至到]\s*\d{1,2}:[0-5]\d/u.test(p.rawText))continue
    if (!declaration && !['task_deadline','submission_deadline','registration_deadline','event_start'].includes(p.type)) continue
    const owners = tasks.filter(t => p.relatedTaskTempIds.includes(t.tempId) && t.timePointTempIds.includes(p.tempId))
    const quotes = result.evidence.filter(e => p.evidenceIds.includes(e.id) && e.quote && sourceText.includes(e.quote)).map(e => ({id:e.id,text:e.quote!}))
    const valid = owners.length > 0 && !p.relatedMaterialTempIds.length && !result.events.some(e => [e.startTimePointTempId,e.endTimePointTempId].includes(p.tempId))
      && (!declaration || declaration.owners.length === owners.length && declaration.owners.every(o => o.kind === 'task' && owners.some(t => t.tempId === o.entityId)))
      && owners.every(t => quotes.some(q => t.evidenceIds.includes(q.id) && q.text.split(/[，。；\n]/u).some(clause => {
        // No inference across unrelated clauses, a deadline/negation/condition,
        // or a clock borrowed from another object. The closed action must follow.
        if (/前|截止|最迟|之前|截至|不要|不得|禁止|无需|如果|若|是否/u.test(clause)) return false
        const action=escaped(taskActionText(t.actionVerb,t.actionObject))
        return new RegExp(`(?:于|在)${escaped(p.rawText)}(?:到|至)[^，。；\\n]{1,40}${action}(?:[。！!]?|$)$`, 'u').test(clause)
          || new RegExp(`(?:于|在)${escaped(p.rawText)}${action}(?:[。！!]?|$)$`, 'u').test(clause)
      })))
    if (!valid) {
      if (declaration) result.conflicts.push({id:'source-action-time:'+p.tempId,type:'other',message:'指定办理时刻与事项或原文依据不一致；保留时间，关联事项待核对。',entityTempIds:[p.tempId,...p.relatedTaskTempIds],evidenceIds:p.evidenceIds,requiresDecision:true})
      continue
    }
    decisions.push({id:p.tempId,ownerIds:owners.map(t=>t.tempId),beforeType:p.type,role:'task_action_time',reason:declaration?'EXPLICIT_GENERATION_ROLE':'CITED_ACTION_AT_TIME',quotes:quotes.map(q=>q.text)})
    p.type='event_start'
  }
  return {result,audit:{version:SOURCE_ACTION_TIME_VERSION,operation:'SOURCE_APPOINTMENT_NOT_DEADLINE_OR_PERSONAL_PLAN',inferredFacts:0,decisions,rejectedDeadlineRoles}}
}

export function sourceActionTimesFromSidecar(sidecar: unknown): SourceActionTimeDeclaration[] {
  if (!sidecar || typeof sidecar !== 'object' || !('factRoleAudit' in sidecar)) return []
  const audit=sidecar.factRoleAudit
  if(!audit||typeof audit!=='object'||!('actionTimes' in audit)||!Array.isArray(audit.actionTimes))return []
  return audit.actionTimes as SourceActionTimeDeclaration[]
}
