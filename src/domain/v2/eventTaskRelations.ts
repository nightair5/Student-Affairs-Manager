import type { Event, WorkspaceV8 } from './types'

export const EVENT_TASK_RELATION_VERSION = 'source-event-task-relations-1'
/** A draft relation is not a confirmed task. Resolve only existing canonical
 * entities from this source/draft; partial confirmation never fabricates tasks. */
export function readEventTaskRelations(workspace: WorkspaceV8, event: Event) {
  const v = event.legacyData?.sourceTaskRelations
  if (!v || typeof v !== 'object' || Array.isArray(v) || v.version !== EVENT_TASK_RELATION_VERSION || typeof v.draftId !== 'string' || !Array.isArray(v.taskTempIds)) return []
  const draft = workspace.extractionDrafts.find(d => d.id === v.draftId)
  if (!draft?.result) return []
  const tasks = [...draft.result.standaloneTasks, ...draft.result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  return v.taskTempIds.filter((id): id is string => typeof id === 'string' && tasks.some(t => t.tempId === id)).map(taskTempId => {
    const task = workspace.tasks.find(t => t.id === `task:${draft.id}:${taskTempId}`)
    return { taskTempId, taskId: task?.id ?? null, state: task ? 'confirmed' as const : draft.rejectedEntityTempIds.includes(taskTempId) ? 'rejected' as const : 'pending' as const }
  })
}
