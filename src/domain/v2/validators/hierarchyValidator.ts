import type { WorkspaceV8 } from '../types'
import type { ValidationIssue } from './issues'

export function validateHierarchy(workspace: WorkspaceV8): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const milestones = new Map(workspace.milestones.map((item) => [item.id, item]))
  const packages = new Map(workspace.workPackages.map((item) => [item.id, item]))
  const tasks = new Map(workspace.tasks.map((item) => [item.id, item]))

  workspace.workPackages.forEach((item, index) => {
    const milestone = milestones.get(item.milestoneId)
    if (milestone && milestone.projectId !== item.projectId) {
      issues.push({ code: 'CROSS_PROJECT_REFERENCE', path: `workPackages[${index}].milestoneId`, message: '工作包与阶段不属于同一项目' })
    }
  })
  workspace.tasks.forEach((item, index) => {
    const milestone = item.milestoneId ? milestones.get(item.milestoneId) : null
    const workPackage = item.workPackageId ? packages.get(item.workPackageId) : null
    if (milestone && item.projectId !== milestone.projectId) {
      issues.push({ code: 'CROSS_PROJECT_REFERENCE', path: `tasks[${index}].milestoneId`, message: '任务与阶段不属于同一项目' })
    }
    if (workPackage && (item.projectId !== workPackage.projectId || (item.milestoneId !== null && item.milestoneId !== workPackage.milestoneId))) {
      issues.push({ code: 'CROSS_PROJECT_REFERENCE', path: `tasks[${index}].workPackageId`, message: '任务、工作包与阶段关系不一致' })
    }
    if (item.parentTaskId === item.id) {
      issues.push({ code: 'SUBTASK_DEPTH', path: `tasks[${index}].parentTaskId`, message: '任务不能以自身为父任务' })
      return
    }
    const parent = item.parentTaskId ? tasks.get(item.parentTaskId) : null
    if (parent?.parentTaskId) {
      issues.push({ code: 'SUBTASK_DEPTH', path: `tasks[${index}].parentTaskId`, message: '子任务最多一层' })
    }
    if (parent && parent.projectId !== item.projectId) {
      issues.push({ code: 'CROSS_PROJECT_REFERENCE', path: `tasks[${index}].parentTaskId`, message: '父子任务必须属于同一项目' })
    }
  })
  return issues
}
