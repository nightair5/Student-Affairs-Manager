import type { ExtractionDraft as DraftView } from '../../types'
import type { RecognitionResult } from '../../recognition/types'
import { applyDomainCommitPlan, buildDomainCommitPlanV2, selectionFromDraftItems, type DomainCommitPlan } from './domainCommit'
import { workspaceSnapshotHash } from './migration'
import type { CanonicalWorkspaceRepository } from './repository'
import type { WorkspaceV8 } from './types'

export const SOURCE_REVIEW_VERSION = 'source-review-d26-1'
export const PENDING_SOURCE_READBACK = 'source-review:pending-readback'
export interface SourceReviewReceipt { version: typeof SOURCE_REVIEW_VERSION; draftId: string; commitId: string; entityIds: string[]; entityHashes: Record<string,string>; disposition: 'confirmed'|'no_task'|'partial' }
const tasksOf = (r: RecognitionResult) => [...r.standaloneTasks, ...r.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
const revisionOf = (d: WorkspaceV8['extractionDrafts'][number]) => workspaceSnapshotHash({recognitionRunId:d.recognitionRunId,result:d.result,acceptedEntityTempIds:[...d.acceptedEntityTempIds].sort(),rejectedEntityTempIds:[...d.rejectedEntityTempIds].sort()})

/** Selected facts only: an unknown time is preserved, never promoted to an appointment. */
export function sourceReviewProblem(result: RecognitionResult, taskId?: string): string | undefined {
  const tasks = tasksOf(result), task = tasks.find(t => t.tempId === taskId)
  const ids = new Set(task ? [task.tempId, ...task.materialTempIds, ...task.timePointTempIds] : result.events.flatMap(e => [e.tempId, e.startTimePointTempId, e.endTimePointTempId].filter((id): id is string => Boolean(id))))
  const conflict = result.conflicts.find(c => c.requiresDecision && (!c.entityTempIds.length || c.entityTempIds.some(id => ids.has(id))))
  if (conflict) return conflict.message
  if (task && (!task.actionVerb.trim() || !task.actionObject.trim())) return '动作或对象缺失，请依据原文核对。'
  if (task?.dependencyTempIds.some(id => !tasks.some(t => t.tempId === id))) return '前置任务引用不存在，请先修正关联。'
  if (task?.timePointTempIds.some(id => !result.timePoints.some(t => t.tempId === id))) return '时间引用不存在，请先修正关联。'
  for (const p of result.timePoints.filter(p => !taskId || p.relatedTaskTempIds.includes(taskId) || task?.timePointTempIds.includes(p.tempId))) {
    if (p.relatedTaskTempIds.some(id => !tasks.some(t => t.tempId === id))) return '时间关联到不存在的任务。'
    if (task && p.relatedTaskTempIds.includes(task.tempId) !== task.timePointTempIds.includes(p.tempId)) return '时间的两侧关联不一致，请核对原文。'
  }
  if (!taskId && result.events.some(e => [e.startTimePointTempId, e.endTimePointTempId].some(id => id && !result.timePoints.some(p => p.tempId === id)))) return '独立事件引用了不存在的时间。'
  return undefined
}

export function sourceEventProblem(result:RecognitionResult,eventId:string):string|undefined {
  const event=result.events.find(e=>e.tempId===eventId)
  if(!event)return '独立事件不存在。'
  const ids=new Set([eventId,event.startTimePointTempId,event.endTimePointTempId].filter(Boolean))
  const conflict=result.conflicts.find(c=>c.requiresDecision&&(!c.entityTempIds.length||c.entityTempIds.some(id=>ids.has(id))))
  if(conflict)return conflict.message
  if([event.startTimePointTempId,event.endTimePointTempId].some(id=>id&&!result.timePoints.some(p=>p.tempId===id)))return '独立事件引用了不存在的时间。'
  return undefined
}

/** The ordinary compiler uses the existing DomainCommitPlan, including event-only and zero-date sources. */
export function buildSourceReviewPlan(workspace: WorkspaceV8, view: DraftView, itemId?: string, now = new Date().toISOString()): DomainCommitPlan {
  const draft = workspace.extractionDrafts.find(d => d.id === view.id)
  if (!draft?.result) throw Error('SOURCE_REVIEW_DRAFT_REQUIRED')
  const run = workspace.recognitionRuns.find(r => r.id === draft.recognitionRunId)
  const version = workspace.sourceVersions.find(v => v.id === run?.sourceVersionId)
  const source = workspace.sources.find(s => s.id === version?.sourceId)
  if (!version || source?.currentVersionId !== version.id || view.sourceVersionId && view.sourceVersionId !== version.id) throw Error('SOURCE_REVIEW_SOURCE_VERSION_CHANGED')
  // The view must have been persisted through the ordinary repository's three-way CAS.
  if (workspaceSnapshotHash(view.recognitionResult) !== workspaceSnapshotHash(draft.result)) throw Error('SOURCE_REVIEW_DRAFT_CHANGED')
  const items = itemId ? view.items.filter(i => i.id === itemId) : view.items
  const selection = selectionFromDraftItems(draft.result, items)
  selection.rejectedTempIds = view.items.filter(i => i.status === '已拒绝').map(i => i.suggestion.id)
  for (const id of selection.taskTempIds) {
    const problem = sourceReviewProblem(draft.result, id)
    if (problem) throw Error(problem)
  }
  const eventProblems=draft.result.events.filter(e=>e.selected!==false).map(e=>sourceEventProblem(draft.result!,e.tempId)).filter(Boolean)
  selection.eventTempIds = draft.result.events.filter(e => e.selected !== false && !draft.acceptedEntityTempIds.includes(e.tempId) && !sourceEventProblem(draft.result!,e.tempId)).map(e => e.tempId)
  selection.timePointTempIds=selection.timePointTempIds.filter(id=>draft.result!.timePoints.find(p=>p.tempId===id)?.relatedTaskTempIds.some(t=>selection.taskTempIds.includes(t))||selection.eventTempIds.some(e=>{const event=draft.result!.events.find(v=>v.tempId===e);return [event?.startTimePointTempId,event?.endTimePointTempId].includes(id)}))
  for (const id of selection.eventTempIds) for (const time of [draft.result.events.find(e => e.tempId === id)?.startTimePointTempId, draft.result.events.find(e => e.tempId === id)?.endTimePointTempId]) if (time && !selection.timePointTempIds.includes(time)) selection.timePointTempIds.push(time)
  for (const item of items) {
    const override = selection.taskOverrides?.[item.suggestion.id]
    // Compatibility projections can invent a display date. Only actual user edits may override a source date.
    const userChangedDate=(item.history ?? []).some(h => {
      if (h.actor!=='user') return false
      if (h.field==='截止时间') return true
      if (h.field!=='识别建议') return false
      try { return JSON.parse(h.before).deadline!==JSON.parse(h.after).deadline } catch { return false }
    })
    if (override && !userChangedDate) delete override.deadline
    if (override && !override.deadline) delete override.deadline
    if(override&&!(item.history??[]).some(h=>h.actor==='user'&&(h.field==='预计耗时'||h.field==='识别建议'&&(()=>{try{return JSON.parse(h.before).estimatedMinutes!==JSON.parse(h.after).estimatedMinutes}catch{return false}})())))delete override.estimatedMinutes
  }
  if (!selection.taskTempIds.length && !selection.eventTempIds.length) {
    if (eventProblems.length) throw Error(eventProblems[0])
    if (view.items.some(i => i.status === '待确认' && i.selected !== false)) throw Error('SOURCE_REVIEW_SELECTION_REQUIRED')
    return {operationId:`source-review:${draft.id}:${revisionOf(draft)}`,draftRevisionHash:revisionOf(draft),draftId:draft.id,recognitionRunId:draft.recognitionRunId,sourceVersionId:version.id,sourceId:source.id,acceptedEntityTempIds:[],rejectedEntityTempIds:selection.rejectedTempIds ?? [],create:{projects:[],milestones:[],workPackages:[],tasks:[],materials:[],timePoints:[],events:[],evidenceRefs:[],historyRecords:[]}}
  }
  const planningWorkspace = selection.taskTempIds.length ? workspace : {...workspace,extractionDrafts:workspace.extractionDrafts.map(d => d.id === draft.id ? {...d,result:{...draft.result!,projectMatch:{...draft.result!.projectMatch,decision:'standalone_task' as const,matchedProjectId:null}}} : d)}
  const plan = buildDomainCommitPlanV2(planningWorkspace, draft.id, selection, now)
  for(const material of plan.create.materials){
    material.status='unverified'
    material.legacyData={...material.legacyData,availabilityVersion:'ordinary-availability-unobserved-1',availabilityOrigin:'not_observed',sourceReviewDraftId:draft.id}
  }
  for(const p of plan.create.timePoints)if(p.type==='task_deadline'&&p.legacyData?.extractionMethod==='manual'&&!draft.result.timePoints.some(original=>original.type==='task_deadline'&&original.relatedTaskTempIds.some(id=>p.relatedTaskIds.some(taskId=>plan.create.tasks.find(t=>t.id===taskId)?.legacyData?.recognitionTempId===id)))){
    p.type='planned_start'
    p.legacyData={...p.legacyData,meaning:'personal_plan_not_source_deadline'}
  }
  plan.draftRevisionHash = revisionOf(draft)
  plan.operationId = `source-review:${draft.id}:${workspaceSnapshotHash({revision:plan.draftRevisionHash,selection})}`
  return plan
}

/** Pending receipt and canonical facts are written together. A failed read must never cause a second commit. */
export async function commitSourceReview(repository: CanonicalWorkspaceRepository, plan: DomainCommitPlan): Promise<SourceReviewReceipt> {
  const entities=[...plan.create.tasks,...plan.create.events,...plan.create.timePoints,...plan.create.materials]
  const receipt: SourceReviewReceipt = {version:SOURCE_REVIEW_VERSION,draftId:plan.draftId,commitId:plan.operationId,disposition:plan.create.tasks.length?'confirmed':'no_task',entityIds:entities.map(e => e.id),entityHashes:Object.fromEntries(entities.map(e=>[e.id,workspaceSnapshotHash(e)]))}
  await repository.transaction(current => {
    if (current.sources.find(s => s.id === plan.sourceId)?.currentVersionId !== plan.sourceVersionId) throw Error('SOURCE_REVIEW_SOURCE_VERSION_CHANGED')
    const next = applyDomainCommitPlan(current, plan)
    const stored=next.extractionDrafts.find(d=>d.id===plan.draftId)!
    const handled=new Set([...stored.acceptedEntityTempIds,...stored.rejectedEntityTempIds])
    const complete=tasksOf(stored.result!).every(t=>handled.has(t.tempId))&&stored.result!.events.every(e=>handled.has(e.tempId)||e.selected===false)
    receipt.disposition=complete?(tasksOf(stored.result!).some(t=>stored.acceptedEntityTempIds.includes(t.tempId))?'confirmed':'no_task'):'partial'
    const status=complete?'confirmed' as const:'partially_confirmed' as const
    return {...next,sources:next.sources.map(s=>s.id===plan.sourceId?{...s,status}:s),extractionDrafts:next.extractionDrafts.map(d=>d.id===plan.draftId?{...d,status,legacyData:{...d.legacyData,[PENDING_SOURCE_READBACK]:{...receipt}}}:d)}
  })
  return receipt
}

export async function verifySourceReviewReadback(reader: Pick<CanonicalWorkspaceRepository,'load'>, receipt: SourceReviewReceipt): Promise<WorkspaceV8> {
  const current = await reader.load()
  const draft = current?.extractionDrafts.find(d => d.id === receipt.draftId)
  if (!current || !draft?.commitOperationIds.includes(receipt.commitId)) throw Error('SOURCE_REVIEW_READBACK_COMMIT_MISSING')
  const ids = new Set([...current.tasks,...current.events,...current.materials,...current.timePoints].map(e => e.id))
  if (receipt.entityIds.some(id => !ids.has(id))) throw Error('SOURCE_REVIEW_READBACK_ENTITY_MISSING')
  for(const entity of [...current.tasks,...current.events,...current.materials,...current.timePoints])if(receipt.entityHashes[entity.id]&&workspaceSnapshotHash(entity)!==receipt.entityHashes[entity.id])throw Error('SOURCE_REVIEW_READBACK_VALUE_CHANGED')
  return current
}

export async function acknowledgeSourceReadback(repository:CanonicalWorkspaceRepository,receipt:SourceReviewReceipt){
  await repository.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>{
    if(d.id!==receipt.draftId)return d
    const pending=d.legacyData?.[PENDING_SOURCE_READBACK]
    if(!pending||typeof pending!=='object'||Array.isArray(pending)||pending.commitId!==receipt.commitId)throw Error('SOURCE_REVIEW_RECEIPT_CHANGED')
    const legacyData={...d.legacyData};delete legacyData[PENDING_SOURCE_READBACK]
    return {...d,legacyData:{...legacyData,sourceReviewReadback:{...receipt,verifiedAt:new Date().toISOString()}}}
  })}))
}
