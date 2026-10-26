import type { CanonicalWorkspaceRepository } from './repository'
import type { JsonValue, TimePoint } from './types'
import { recentDirectBatches } from './directIntake'
import { workspaceSnapshotHash } from './migration'
import { isDateOnly, parseBusinessDateTime } from '../../lib/timeSemantics'

/** A user-selected work date. Source deadlines, windows and evidence are never edited. */
export async function setTaskSchedule(repository: CanonicalWorkspaceRepository, taskId: string, value: string, now = new Date().toISOString()): Promise<void> {
  if (value && (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/u.test(value) || !isDateOnly(value) && !parseBusinessDateTime(value))) throw Error('请选择有效日期')
  await repository.transaction(workspace => {
    const task = workspace.tasks.find(candidate => candidate.id === taskId)
    if (!task) throw Error('这项待办已经不存在')
    const previous = workspace.timePoints.filter(point => point.type === 'planned_start' && (point.taskId === taskId || point.relatedTaskIds.includes(taskId)))
    const baseId = `time:${taskId}:personal-date`
    const ownedOnly = (point: TimePoint) => (!point.taskId || point.taskId === taskId) && !point.eventId && !point.materialId && !point.relatedMaterialIds.length && point.relatedTaskIds.every(id => id === taskId)
    const id = workspace.timePoints.some(point => point.id === baseId && !ownedOnly(point)) ? `${baseId}:${workspaceSnapshotHash({ value, now }).slice(0, 10)}` : baseId
    const previousIds = new Set(previous.map(point => point.id))
    const timePoints = workspace.timePoints.flatMap(point => !previousIds.has(point.id) ? [point] : ownedOnly(point) ? [] : [{ ...point, taskId: point.taskId === taskId ? null : point.taskId, relatedTaskIds: point.relatedTaskIds.filter(id => id !== taskId) }])
    if (value) timePoints.push({ id, projectId: task.projectId, milestoneId: null, taskId, eventId: null, materialId: null, relatedTaskIds: [taskId], relatedMaterialIds: [], type: 'planned_start', rawText: '', normalizedValue: value, timezone: isDateOnly(value) ? null : workspace.settings.defaultTimezone, isAllDay: isDateOnly(value), precision: isDateOnly(value) ? 'date_only' : 'exact', needsConfirmation: false, createdAt: previous.find(point => point.id === id)?.createdAt ?? now, updatedAt: now, legacyData: { personalDate: { version: 'personal-date-1', actor: 'user' } } })
    const history = { id: `history:personal-date:${workspaceSnapshotHash({ taskId, value, now })}`, entityType: 'task' as const, entityId: taskId, action: 'updated' as const, fieldName: 'personalSchedule', before: JSON.parse(JSON.stringify(previous)) as JsonValue, after: value || null, actor: 'user' as const, reason: value ? '用户安排处理日期，原文截止保持' : '用户清除个人安排，原文截止保持', sourceVersionId: null, changedAt: now }
    const batch = recentDirectBatches(workspace).find(batch => batch.status === 'active' && batch.items.some(item => item.id === taskId))
    return { ...workspace, timePoints, tasks: workspace.tasks.map(candidate => candidate.id === taskId ? { ...candidate, updatedAt: now, version: candidate.version + 1 } : candidate), historyRecords: [...workspace.historyRecords, history], extractionDrafts: batch ? workspace.extractionDrafts.map(draft => draft.id !== batch.draftId ? draft : { ...draft, legacyData: { ...draft.legacyData, directBatch: JSON.parse(JSON.stringify({ ...batch, created: { ...batch.created, timePoints: [...new Set([...(batch.created.timePoints ?? []), ...(value ? [id] : [])])], historyRecords: [...(batch.created.historyRecords ?? []), history.id] } })) as JsonValue } }) : workspace.extractionDrafts }
  })
}
