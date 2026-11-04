import type {Task} from '../types'

/** A presentation-only chain. The original tasks and their dependencies are
 * never changed: completion, editing and undo still operate on each task. */
export function linearTaskWorkflows(
  tasks: readonly Task[],
  visibleIds: ReadonlySet<string>,
  linkedTaskIds: ReadonlySet<string>,
  now = new Date(),
): Task[][] {
  const byId = new Map(tasks.map(task => [task.id, task]))
  const children = new Map<string, string[]>()
  for (const task of tasks) for (const id of new Set(task.dependencyIds ?? [])) {
    const ids = children.get(id) ?? []
    ids.push(task.id)
    children.set(id, ids)
  }
  const sourcesFor = (task: Task) => [...new Set(task.sourceIds.filter(Boolean))]
  const eligible = (task: Task) => {
    const sources = sourcesFor(task)
    const snoozed = task.snoozedUntil && Date.parse(task.snoozedUntil) > now.getTime()
    return sources.length === 1 && !snoozed && !task.sourceChoice &&
      !task.parentTaskId && task.hierarchyType !== 'subtask' && !linkedTaskIds.has(task.id) &&
      (task.status === '已完成' || visibleIds.has(task.id))
  }
  const next = new Map<string, Task>()
  for (const child of tasks) {
    const dependencies = [...new Set(child.dependencyIds ?? [])]
    if (dependencies.length !== 1 || !eligible(child)) continue
    const parent = byId.get(dependencies[0])
    if (!parent || parent.id === child.id || !eligible(parent) || children.get(parent.id)?.length !== 1 || (children.get(child.id)?.length ?? 0) > 1) continue
    if (sourcesFor(parent)[0] !== sourcesFor(child)[0]) continue
    // An unresolved upstream dependency must not disappear into the group.
    if ((parent.dependencyIds?.length ?? 0) > 1 || (!(parent.dependencyIds?.length) && parent.dependencies.length)) continue
    next.set(parent.id, child)
  }
  const incoming = new Set([...next.values()].map(task => task.id))
  const groups: Task[][] = []
  for (const [rootId] of next) {
    if (incoming.has(rootId)) continue
    const root = byId.get(rootId)!
    // Do not hide a missing or separately visible prerequisite of the root.
    if (root.dependencyIds?.length) continue
    const chain = [root], visited = new Set([root.id])
    let current = root
    while (next.has(current.id)) {
      const child = next.get(current.id)!
      if (visited.has(child.id)) break
      chain.push(child); visited.add(child.id); current = child
    }
    if (chain.length > 1 && chain.some(task => task.status !== '已完成' && visibleIds.has(task.id))) groups.push(chain)
  }
  return groups
}
