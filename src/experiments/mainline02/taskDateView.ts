import { confirmationStateV2 } from '../../domain/v2/confirmationV2'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { isDateOnly, parseBusinessDateTime } from '../../lib/timeSemantics'

export interface TaskDateView {
  kind: 'absent' | 'start_only' | 'dated' | 'review'
  label: string
  noDeadlineProven: boolean
  projectedPendingOnly: boolean
}
export type TaskDateViews = Readonly<Record<string, TaskDateView>>
const review = (): TaskDateView => ({ kind: 'review', label: '时间或来源关系待核对', noDeadlineProven: false, projectedPendingOnly: false })

export function taskDateViews(workspace: WorkspaceV8): TaskDateViews {
  return Object.fromEntries(workspace.tasks.map(task => {
    const result = review()
    try {
      const tempId = task.legacyData?.recognitionTempId
      if (typeof tempId !== 'string') return [task.id, result]
      const owners = workspace.extractionDrafts.filter(draft => draft.acceptedEntityTempIds.includes(tempId)
        && workspace.recognitionRuns.some(run => run.id === draft.recognitionRunId && workspace.sourceVersions.some(version => version.id === run.sourceVersionId && version.sourceId === task.legacyData?.sourceId)))
      if (owners.length !== 1) return [task.id, result]
      const state = confirmationStateV2(workspace, owners[0].id, tempId)
      if (state.blockedReason || task.needsReview) return [task.id, result]
      const materials = workspace.materials.filter(m => m.relatedTaskIds.includes(task.id))
      const materialIds = new Set(materials.map(m => m.id))
      const points = workspace.timePoints.filter(p => p.taskId === task.id || p.relatedTaskIds.includes(task.id)
        || p.relatedMaterialIds.some(id => materialIds.has(id)) || materials.some(m => m.deadlineTimePointId === p.id))
      if (materials.some(m => m.deadlineTimePointId && !points.some(p => p.id === m.deadlineTimePointId))
        || points.some(p => p.needsConfirmation || !p.normalizedValue || (!isDateOnly(p.normalizedValue) && !parseBusinessDateTime(p.normalizedValue, p.timezone ?? workspace.settings.defaultTimezone)))) return [task.id, result]
      const canonicalTempIds = new Set(points.map(p => p.legacyData?.recognitionTempId))
      if (state.timePointTempIds.some(id => !id.startsWith('manual-deadline:') && !canonicalTempIds.has(id))) return [task.id, result]
      const dates = points.filter(p => !['planned_start', 'event_start', 'event_end'].includes(p.type))
      if (dates.length) {
        const priority = ['task_deadline', 'submission_deadline', 'registration_deadline']
        const point = [...dates].sort((a,b) => {
          const ai = priority.indexOf(a.type), bi = priority.indexOf(b.type)
          return (ai < 0 ? 3 : ai) - (bi < 0 ? 3 : bi) || a.normalizedValue!.localeCompare(b.normalizedValue!)
        })[0]
        return [task.id, { kind: 'dated', label: point.normalizedValue + (isDateOnly(point.normalizedValue!) ? '（仅日期）' : '（' + point.timezone + '）'), noDeadlineProven: false, projectedPendingOnly: false }]
      }
      if (points.some(p => p.type !== 'planned_start')) return [task.id, result]
      // Suppress only the legacy projection's invented pending flag, never an explicit stored flag.
      const legacy = task.legacyData?.v7Record
      const hasStoredRisk = legacy && typeof legacy === 'object' && 'riskFlags' in legacy
      return [task.id, { kind: points.length ? 'start_only' : 'absent',
        label: points.length ? '原文仅说明开始时间，未说明截止时间' : '原文未说明截止时间',
        noDeadlineProven: true, projectedPendingOnly: !hasStoredRisk }]
    } catch { return [task.id, result] }
  }))
}
