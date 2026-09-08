import type { WorkspaceV8 } from '../../domain/v2/types'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import type { reviewAdapter } from '../mainline02/reviewAdapter'
import type { TaskDateViews, TaskDateView } from '../mainline02/taskDateView'
import { isDateOnly } from '../../lib/timeSemantics'
import { stateOfRuntime as stateOf, life, relatedAssets, canAct, editTimeSupport, semanticRevision,
  effectiveStateFacts, effectiveReview, REAL_STATE_VERSION, liveReviewIdentity, isCurrentDraft, titleReviewProblem, materialReviewProblem, hasPendingDateConsent, type AnySemanticState as SemanticState } from './semanticState'

export const timeLabel = (value: string | null, timezone: string) => !value ? '时间待核对'
  : value + (isDateOnly(value) ? '（仅日期）' : '（' + timezone + '）')
export function semanticDates(workspace: WorkspaceV8): TaskDateViews {
  return Object.fromEntries(workspace.tasks.map(task => {
    const state = stateOf(workspace, String(task.legacyData?.mainline05DraftId))
    const original = effectiveStateFacts(state).facts.tasks.find(t => t.id === task.legacyData?.recognitionTempId)!
    const points = workspace.timePoints.filter(t => t.relatedTaskIds.includes(task.id))
    const deadline = points.filter(t => !['planned_start','event_start','event_end'].includes(t.type))
      .sort((a,b) => (a.normalizedValue??'').localeCompare(b.normalizedValue??''))
    let view: TaskDateView
    if (points.some(t => t.needsConfirmation || !t.normalizedValue) || (!points.length && original.coverage.time !== 'not_stated')) {
      view = {kind:'review',label:hasPendingDateConsent(state,original.id)
        ? '日期待定 · '+points.map(t=>t.rawText).join('；')+'（已明确接受，仍需补充日期）':'时间尚待核对',noDeadlineProven:false,projectedPendingOnly:false}
    } else if (deadline.length) view = {kind:'dated',label:timeLabel(deadline[0].normalizedValue,state.context.timezone),noDeadlineProven:false,projectedPendingOnly:false}
    else view = {kind:points.length?'start_only':'absent',label:points.length?'原文仅说明开始/事件时间，未说明截止时间':'原文未说明截止时间',
      noDeadlineProven:true,projectedPendingOnly:true}
    return [task.id,view]
  }))
}
export function pendingDateTaskIds(workspace:WorkspaceV8): string[] {
  return workspace.tasks.filter(t=>hasPendingDateConsent(stateOf(workspace,String(t.legacyData?.mainline05DraftId)),String(t.legacyData?.recognitionTempId))).map(t=>t.id)
}
function draftView(workspace: WorkspaceV8, draftId: string, choices: Readonly<Record<string,boolean>> = {}): ReturnType<typeof reviewAdapter> {
  const failed=workspace.extractionDrafts.find(d=>d.id===draftId)
  if(failed?.status==='failed'&&failed.legacyData?.realInputPending&&!failed.legacyData.mainline05)
    return {revision:semanticRevision(workspace),states:{},draft:{...workspaceV8ToLegacyView(workspace).drafts.find(d=>d.id===draftId)!,items:[]}}
  const state = stateOf(workspace,draftId), current = life(state), base = workspaceV8ToLegacyView(workspace).drafts.find(d=>d.id===draftId)!
  const input = effectiveStateFacts(state).facts, review = effectiveReview(state)
  const live = state.version === REAL_STATE_VERSION
  const reviewed = (id: string) => !live || (current.reviewed?.[id] === liveReviewIdentity(state, id, current.values))
  const states: ReturnType<typeof reviewAdapter>['states'] = {}
  const prerequisites = (id: string) => {
    const task = input.tasks.find(t => t.id === id)
    return task ? [...task.detail.dependencyTempIds, ...(task.detail.parentTempId ? [task.detail.parentTempId] : [])] : []
  }
  const selected = new Map<string, boolean>(), visiting = new Set<string>()
  const choose = (id: string): boolean => {
    if (selected.has(id)) return selected.get(id)!
    if (visiting.has(id)) return false
    const item = review.items.find(i => i.tempId === id), disposition = current.dispositions[id]
    const key = 'draft-item:' + draftId + ':' + id
    const requested = Object.hasOwn(choices, key) ? choices[key] : Boolean(!live && item?.defaultSelected && disposition === 'pending')
    visiting.add(id)
    const value = Boolean(requested && canAct(state, id) && reviewed(id) && (!live || isCurrentDraft(workspace, draftId)) && ['pending', 'deferred'].includes(disposition)
      && prerequisites(id).every(dep => current.dispositions[dep] === 'confirmed' || choose(dep)))
    visiting.delete(id); selected.set(id, value); return value
  }
  const items = input.tasks.map(task => {
    const id = 'draft-item:' + draftId + ':' + task.id, item = review.items.find(i=>i.tempId===task.id)!
    const assets = relatedAssets(input,[task.id]), support = editTimeSupport(state,task.id)
    const originalDate = support.points.filter(p=>!['planned_start','event_start','event_end'].includes(p.type))
    const disposition = current.dispositions[task.id]
    const dependenciesReady = prerequisites(task.id).every(dep => current.dispositions[dep] === 'confirmed' || choose(dep))
    const blockedReason = live && !isCurrentDraft(workspace, draftId) ? '来源或识别版本已更新，旧未确认建议已过期；已确认任务保留。'
      : materialReviewProblem(state,task.id) ? materialReviewProblem(state,task.id)
      : !canAct(state,task.id) ? '原文行动条件、状态或依据需核对：' + (item.issues.join('、') || item.requiresAction)
      : disposition === 'rejected' ? '你已明确选择不需要'
      : live && titleReviewProblem(current.values[task.id].title) ? titleReviewProblem(current.values[task.id].title)
      : !reviewed(task.id) ? (live && state.operations.some(o => o.correction?.change.kind === 'surface' && o.correction.change.taskId === task.id)
        ? '动作或对象已修改，请核对当前标题与动作对象一致；自定义标题保留。明确点击“本项事实已核对”后再选择。'
        : '请查看完整事实和依据，明确点击“本项事实已核对”后再选择。')
      : !dependenciesReady ? '前置任务尚未确认或未在本次勾选；请先核对前置任务。' : undefined
    const value = current.values[task.id].deadline
    const defaultSelected = !live && item.defaultSelected && disposition === 'pending' && dependenciesReady
    const edited = state.operations.some(o=>o.kind==='edit'&&o.field==='deadline'&&o.taskIds[0]===task.id)
    states[id] = { defaultSelected, blockedReason, dateEditBlockedReason: support.allowed ? undefined : '本轮不支持修改开始、事件、共享或多个时间；原始时间仍完整保留。',
      materialTempIds:[...assets.materials],timePointTempIds:assets.times.size?[...assets.times]:value?['manual-deadline:'+task.id]:[],
      value,edited,originalDate:originalDate.length===1?originalDate[0].normalizedValue??'':'',
      dateLabel:hasPendingDateConsent(state,task.id)?'日期待定 · '+input.timePoints.filter(t=>assets.times.has(t.tempId)).map(t=>t.rawText).join('；')
        :blockedReason&&!materialReviewProblem(state,task.id)?'待核对：不能当作无日期确认':value?timeLabel(value,state.context.timezone)+(edited?' · 用户修改':'')
        :assets.times.size?'原文仅说明开始/事件时间，完整时间见依据':'原文未说明截止时间 · 可无日期确认' }
    return {id,status:disposition==='confirmed'?'已确认' as const:disposition==='rejected'?'已拒绝' as const:'待确认' as const,
      selected:!blockedReason && choose(task.id),
      updatedAt:base.updatedAt,history:[],suggestion:{ id:task.id,title:current.values[task.id].title,category:'其他' as const,deadline:value,
        estimatedMinutes:task.detail.estimatedMinutes??30,nextAction:task.action.surface+task.object.surface,description:task.detail.description,
        priority:task.detail.prioritySuggestion==='high'||task.detail.prioritySuggestion==='urgent'?'高' as const:task.detail.prioritySuggestion==='low'?'低' as const:'中' as const,
        materials:input.materials.filter(m=>assets.materials.has(m.tempId)).map(m=>m.name),
        evidence:item.evidence.map(e=>e.quote).join('\n'),confidence:'高' as const}}
  })
  return { revision:semanticRevision(workspace),states,draft:{...base,items,recognitionResult:undefined} }
}
export const semanticReview = draftView
export function semanticView(workspace:WorkspaceV8): ReturnType<typeof workspaceV8ToLegacyView> {
  const view = workspaceV8ToLegacyView(workspace)
  return {...view,drafts:view.drafts.map(d=>d.workflowStatus==='processing'||d.workflowStatus==='failed'?d:draftView(workspace,d.id).draft),
    tasks:view.tasks.map(task=>{
      const canonical = workspace.tasks.find(t=>t.id===task.id)!, state=stateOf(workspace,String(canonical.legacyData?.mainline05DraftId))
      const original=effectiveStateFacts(state).facts.tasks.find(t=>t.id===canonical.legacyData?.recognitionTempId)!
      const points=workspace.timePoints.filter(t=>t.relatedTaskIds.includes(task.id)&&!['planned_start','event_start','event_end'].includes(t.type))
        .sort((a,b)=>(a.normalizedValue??'').localeCompare(b.normalizedValue??''))
      return {...task,deadline:points[0]?.normalizedValue??'',priority:original.detail.prioritySuggestion==='high'||original.detail.prioritySuggestion==='urgent'?'高'
        :original.detail.prioritySuggestion==='low'?'低':'中',
        sourceIds:[state.sourceId],nextAction:canonical.nextAction??'',description:canonical.description??'',reminders:[]}
    })}
}
export function stateForEntity(workspace:WorkspaceV8,id:string):SemanticState {
  const entity=[...workspace.tasks,...workspace.events].find(e=>e.id===id)
  return stateOf(workspace,String(entity?.legacyData?.mainline05DraftId))
}
