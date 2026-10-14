import type { ProjectState, WorkspaceV8 } from './types'

function timeSortValue(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY
  const timestamp = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value)
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

/** Pure, non-persisting projection. TimePoint remains the only deadline fact source. */
export function deriveProjectState(workspace: WorkspaceV8, projectId: string, now = workspace.savedAt): ProjectState {
  const milestones = workspace.milestones
    .filter((item) => item.projectId === projectId && item.status === 'active')
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const tasks = workspace.tasks.filter((item) => item.projectId === projectId && item.status !== 'completed' && item.status !== 'cancelled')
  const taskIds = new Set(tasks.map((item) => item.id))
  const nextDeadline = workspace.timePoints
    .filter((item) => item.projectId === projectId && item.normalizedValue !== null && (item.taskId === null || taskIds.has(item.taskId)))
    .sort((left, right) => timeSortValue(left.normalizedValue) - timeSortValue(right.normalizedValue))[0]
  return {
    projectId,
    currentMilestoneId: milestones[0]?.id ?? null,
    health: tasks.some((task) => task.dependencyIds.some((dependencyId) => tasks.some((candidate) => candidate.id === dependencyId)))
      ? 'blocked'
      : nextDeadline ? 'on_track' : 'unknown',
    nextActionTaskId: tasks[0]?.id ?? null,
    nextDeadlineTimePointId: nextDeadline?.id ?? null,
    lastComputedAt: now,
  }
}
