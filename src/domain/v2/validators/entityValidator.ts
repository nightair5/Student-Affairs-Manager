import type { WorkspaceV8 } from '../types'
import type { ValidationIssue } from './issues'

const ENTITY_ARRAYS = [
  'sources', 'sourceVersions', 'recognitionRuns', 'extractionDrafts', 'projects', 'milestones',
  'workPackages', 'tasks', 'materials', 'timePoints', 'events', 'evidenceRefs', 'changeProposals',
  'historyRecords', 'reminderRecords',
] as const

export function validateEntities(workspace: WorkspaceV8): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const globalIds = new Map<string, string>()
  for (const arrayName of ENTITY_ARRAYS) {
    workspace[arrayName].forEach((entity, index) => {
      const path = `${arrayName}[${index}]`
      if (!entity.id.trim()) {
        issues.push({ code: 'REQUIRED_FIELD', path: `${path}.id`, message: '实体 ID 不能为空' })
      } else if (globalIds.has(entity.id)) {
        issues.push({ code: 'DUPLICATE_ID', path: `${path}.id`, message: `ID 与 ${globalIds.get(entity.id)} 重复` })
      } else {
        globalIds.set(entity.id, path)
      }
    })
  }
  workspace.tasks.forEach((task, index) => {
    if (!task.title.trim()) issues.push({ code: 'REQUIRED_FIELD', path: `tasks[${index}].title`, message: '任务标题不能为空' })
    if (!task.status) issues.push({ code: 'REQUIRED_FIELD', path: `tasks[${index}].status`, message: '任务状态不能为空' })
    if (task.estimatedMinutes !== null && (!Number.isFinite(task.estimatedMinutes) || task.estimatedMinutes <= 0)) {
      issues.push({ code: 'REQUIRED_FIELD', path: `tasks[${index}].estimatedMinutes`, message: '预计耗时必须为正数或 null' })
    }
  })
  workspace.projects.forEach((project, index) => {
    if (!project.title.trim()) issues.push({ code: 'REQUIRED_FIELD', path: `projects[${index}].title`, message: '项目标题不能为空' })
  })
  workspace.materials.forEach((material, index) => {
    if (!material.name.trim()) issues.push({ code: 'REQUIRED_FIELD', path: `materials[${index}].name`, message: '材料名称不能为空' })
  })
  return issues
}
