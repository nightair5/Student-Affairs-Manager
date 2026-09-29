import type { WorkspaceV8 } from '../../domain/v2/types'
import type { FactChange } from '../realInput01/factCorrections'
import { effectiveStateFacts, life, stateOfRuntime } from '../mainline05/semanticState'
import { stableJson } from '../mainline04/semanticContract'

const same = (a: unknown, b: unknown) => stableJson(a ?? null) === stableJson(b ?? null)
const isD20 = (name: string) => /^rco-mainline-01-02-i1-real-input-d20-review-session-p[1-9][0-9]{0,2}$/.test(name)

function snapshot(revision: string, latest: WorkspaceV8, draftId: string): WorkspaceV8 | null {
  try {
    if (revision.length > 3_000_000) return null
    const before = JSON.parse(revision) as WorkspaceV8
    const oldDraft = before.extractionDrafts.find(row => row.id === draftId), newDraft = latest.extractionDrafts.find(row => row.id === draftId)
    const oldRun = before.recognitionRuns.find(row => row.id === oldDraft?.recognitionRunId), newRun = latest.recognitionRuns.find(row => row.id === newDraft?.recognitionRunId)
    const oldVersion = before.sourceVersions.find(row => row.id === oldRun?.sourceVersionId), newVersion = latest.sourceVersions.find(row => row.id === newRun?.sourceVersionId)
    const oldSource = before.sources.find(row => row.id === oldVersion?.sourceId), newSource = latest.sources.find(row => row.id === newVersion?.sourceId)
    if (!oldSource || !newSource || oldSource.id !== newSource.id || oldSource.currentVersionId !== newSource.currentVersionId
      || oldRun?.id !== newRun?.id || oldVersion?.id !== newVersion?.id || !oldDraft || !newDraft) return null
    return before
  } catch { return null }
}

function taskRead(workspace: WorkspaceV8, draftId: string, id: string) {
  const state = stateOfRuntime(workspace, draftId), facts = effectiveStateFacts(state).facts
  const task = facts.tasks.find(row => row.id === id)
  if (!task) return null
  const related = new Set(task.detail.materialTempIds), timeIds = new Set(task.detail.timePointTempIds)
  return { task, value: life(state).values[id], disposition: life(state).dispositions[id],
    materials: facts.materials.filter(row => related.has(row.tempId) || row.relatedTaskTempIds.includes(id)),
    times: facts.timePoints.filter(row => timeIds.has(row.tempId) || row.relatedTaskTempIds.includes(id)),
    revisions: facts.revisions.filter(row => row.targetDirectiveId === id || row.fromDirectiveId === id) }
}

export function canRebaseD20Task(name: string, revision: string, latest: WorkspaceV8, draftId: string, taskIds: string[]) {
  if (!isD20(name)) return false
  const before = snapshot(revision, latest, draftId)
  if (!before) return false
  try { return taskIds.every(id => same(taskRead(before,draftId,id),taskRead(latest,draftId,id))) } catch { return false }
}

export function canRebaseD20Source(name: string, revision: string, latest: WorkspaceV8, draftId: string, taskIds: string[]) {
  if (!canRebaseD20Task(name,revision,latest,draftId,taskIds)) return false
  const before=snapshot(revision,latest,draftId)
  if(!before)return false
  try {
    const read=(workspace:WorkspaceV8)=>{
      const state=stateOfRuntime(workspace,draftId),facts=effectiveStateFacts(state).facts
      const events=facts.events.filter(row=>!row.relatedTaskTempIds.length)
      const timeIds=new Set(events.flatMap(row=>[row.startTimePointTempId,row.endTimePointTempId].filter((id):id is string=>Boolean(id))))
      return {events,times:facts.timePoints.filter(row=>timeIds.has(row.tempId)),reviewed:life(state).independentEventsReviewedAt??null}
    }
    return same(read(before),read(latest))
  } catch { return false }
}

export function canRebaseD20Correction(name: string, revision: string, latest: WorkspaceV8, draftId: string, change: FactChange) {
  if (!isD20(name)) return false
  const before = snapshot(revision, latest, draftId)
  if (!before) return false
  try {
    const a = effectiveStateFacts(stateOfRuntime(before,draftId)).facts, b = effectiveStateFacts(stateOfRuntime(latest,draftId)).facts
    if ('taskId' in change) return same(taskRead(before,draftId,change.taskId),taskRead(latest,draftId,change.taskId))
    if (change.kind === 'independent_event') return same(a.events.find(row=>row.tempId===change.eventId),b.events.find(row=>row.tempId===change.eventId))
      && same(a.timePoints.filter(row=>[a.events.find(event=>event.tempId===change.eventId)?.startTimePointTempId,a.events.find(event=>event.tempId===change.eventId)?.endTimePointTempId].includes(row.tempId)),
        b.timePoints.filter(row=>[b.events.find(event=>event.tempId===change.eventId)?.startTimePointTempId,b.events.find(event=>event.tempId===change.eventId)?.endTimePointTempId].includes(row.tempId)))
    if (change.kind === 'independent_time') return same(a.timePoints.find(row=>row.tempId===change.timeId),b.timePoints.find(row=>row.tempId===change.timeId))
      && same(a.events.filter(row=>[row.startTimePointTempId,row.endTimePointTempId].includes(change.timeId)),b.events.filter(row=>[row.startTimePointTempId,row.endTimePointTempId].includes(change.timeId)))
    if (change.kind === 'material') return same(a.materials.find(row=>row.tempId===change.materialId),b.materials.find(row=>row.tempId===change.materialId))
      && same(a.tasks.filter(row=>row.detail.materialTempIds.includes(change.materialId)||a.materials.find(m=>m.tempId===change.materialId)?.relatedTaskTempIds.includes(row.id)),
        b.tasks.filter(row=>row.detail.materialTempIds.includes(change.materialId)||b.materials.find(m=>m.tempId===change.materialId)?.relatedTaskTempIds.includes(row.id)))
    // Structural additions and relation graph edits require a fresh source-level review.
    return false
  } catch { return false }
}
