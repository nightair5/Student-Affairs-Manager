import type { WorkspaceV8 } from '../types'
import type { ValidationIssue } from './issues'

export function validateDependencies(workspace: WorkspaceV8): ValidationIssue[] {
  const graph = new Map(workspace.tasks.map((task) => [task.id, task.dependencyIds]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const issues: ValidationIssue[] = []
  const reported = new Set<string>()

  const visit = (id: string, path: string[]) => {
    if (visiting.has(id)) {
      const start = path.indexOf(id)
      const cycle = [...path.slice(start), id]
      const key = [...new Set(cycle)].sort().join('|')
      if (!reported.has(key)) {
        reported.add(key)
        issues.push({ code: 'DEPENDENCY_CYCLE', path: 'tasks', message: `任务依赖形成循环：${cycle.join(' -> ')}` })
      }
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of graph.get(id) ?? []) {
      if (graph.has(dependency)) visit(dependency, [...path, id])
    }
    visiting.delete(id)
    visited.add(id)
  }
  workspace.tasks.forEach((task) => visit(task.id, []))
  return issues
}
