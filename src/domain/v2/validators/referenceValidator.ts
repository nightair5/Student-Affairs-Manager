import type { HistoryEntityType, WorkspaceV8 } from '../types'
import type { ValidationIssue } from './issues'

function requireRef(issues: ValidationIssue[], ids: Set<string>, value: string | null, path: string): void {
  if (value !== null && !ids.has(value)) issues.push({ code: 'MISSING_REFERENCE', path, message: `引用不存在：${value}` })
}

export function validateReferences(workspace: WorkspaceV8): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const sourceIds = new Set(workspace.sources.map((item) => item.id))
  const versionIds = new Set(workspace.sourceVersions.map((item) => item.id))
  const runIds = new Set(workspace.recognitionRuns.map((item) => item.id))
  const draftIds = new Set(workspace.extractionDrafts.map((item) => item.id))
  const projectIds = new Set(workspace.projects.map((item) => item.id))
  const milestoneIds = new Set(workspace.milestones.map((item) => item.id))
  const packageIds = new Set(workspace.workPackages.map((item) => item.id))
  const taskIds = new Set(workspace.tasks.map((item) => item.id))
  const materialIds = new Set(workspace.materials.map((item) => item.id))
  const timePointIds = new Set(workspace.timePoints.map((item) => item.id))
  const eventIds = new Set(workspace.events.map((item) => item.id))
  const evidenceIds = new Set(workspace.evidenceRefs.map((item) => item.id))
  const proposalIds = new Set(workspace.changeProposals.map((item) => item.id))
  const reminderIds = new Set(workspace.reminderRecords.map((item) => item.id))
  const versionsById = new Map(workspace.sourceVersions.map((item) => [item.id, item]))
  const milestonesById = new Map(workspace.milestones.map((item) => [item.id, item]))
  const packagesById = new Map(workspace.workPackages.map((item) => [item.id, item]))
  const tasksById = new Map(workspace.tasks.map((item) => [item.id, item]))
  const materialsById = new Map(workspace.materials.map((item) => [item.id, item]))
  const timePointsById = new Map(workspace.timePoints.map((item) => [item.id, item]))
  const eventsById = new Map(workspace.events.map((item) => [item.id, item]))
  const ownershipIssue = (path: string, message: string) => {
    issues.push({ code: 'CROSS_PROJECT_REFERENCE', path, message })
  }

  workspace.sources.forEach((item, index) => {
    requireRef(issues, versionIds, item.currentVersionId, `sources[${index}].currentVersionId`)
    if (item.workspaceId !== workspace.workspace.id) ownershipIssue(`sources[${index}].workspaceId`, '来源不属于当前工作区')
    const currentVersion = versionsById.get(item.currentVersionId)
    if (currentVersion && currentVersion.sourceId !== item.id) {
      ownershipIssue(`sources[${index}].currentVersionId`, '当前版本不属于该来源')
    }
  })
  workspace.sourceVersions.forEach((item, index) => requireRef(issues, sourceIds, item.sourceId, `sourceVersions[${index}].sourceId`))
  workspace.recognitionRuns.forEach((item, index) => requireRef(issues, versionIds, item.sourceVersionId, `recognitionRuns[${index}].sourceVersionId`))
  workspace.extractionDrafts.forEach((item, index) => requireRef(issues, runIds, item.recognitionRunId, `extractionDrafts[${index}].recognitionRunId`))
  workspace.projects.forEach((item, index) => {
    if (item.workspaceId !== workspace.workspace.id) ownershipIssue(`projects[${index}].workspaceId`, '项目不属于当前工作区')
  })
  workspace.milestones.forEach((item, index) => requireRef(issues, projectIds, item.projectId, `milestones[${index}].projectId`))
  workspace.workPackages.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `workPackages[${index}].projectId`)
    requireRef(issues, milestoneIds, item.milestoneId, `workPackages[${index}].milestoneId`)
    const milestone = milestonesById.get(item.milestoneId)
    if (milestone && milestone.projectId !== item.projectId) {
      ownershipIssue(`workPackages[${index}].milestoneId`, '工作包与阶段不属于同一项目')
    }
  })
  workspace.tasks.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `tasks[${index}].projectId`)
    requireRef(issues, milestoneIds, item.milestoneId, `tasks[${index}].milestoneId`)
    requireRef(issues, packageIds, item.workPackageId, `tasks[${index}].workPackageId`)
    requireRef(issues, taskIds, item.parentTaskId, `tasks[${index}].parentTaskId`)
    item.dependencyIds.forEach((id, dependencyIndex) => requireRef(issues, taskIds, id, `tasks[${index}].dependencyIds[${dependencyIndex}]`))
    const milestone = item.milestoneId ? milestonesById.get(item.milestoneId) : null
    const workPackage = item.workPackageId ? packagesById.get(item.workPackageId) : null
    if (milestone && milestone.projectId !== item.projectId) ownershipIssue(`tasks[${index}].milestoneId`, '任务与阶段不属于同一项目')
    if (workPackage && (workPackage.projectId !== item.projectId || workPackage.milestoneId !== item.milestoneId)) {
      ownershipIssue(`tasks[${index}].workPackageId`, '任务、工作包与阶段归属不一致')
    }
    item.dependencyIds.forEach((id, dependencyIndex) => {
      const dependency = tasksById.get(id)
      if (dependency && dependency.projectId !== item.projectId) {
        ownershipIssue(`tasks[${index}].dependencyIds[${dependencyIndex}]`, '依赖任务与当前任务不属于同一项目')
      }
    })
  })
  workspace.materials.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `materials[${index}].projectId`)
    requireRef(issues, timePointIds, item.deadlineTimePointId, `materials[${index}].deadlineTimePointId`)
    item.relatedTaskIds.forEach((id, taskIndex) => requireRef(issues, taskIds, id, `materials[${index}].relatedTaskIds[${taskIndex}]`))
    item.relatedTaskIds.forEach((id, taskIndex) => {
      const task = tasksById.get(id)
      if (task && task.projectId !== item.projectId) {
        ownershipIssue(`materials[${index}].relatedTaskIds[${taskIndex}]`, '材料与关联任务不属于同一项目')
      }
    })
    const deadline = item.deadlineTimePointId ? timePointsById.get(item.deadlineTimePointId) : null
    if (deadline && deadline.projectId !== item.projectId) {
      ownershipIssue(`materials[${index}].deadlineTimePointId`, '材料与截止时间不属于同一项目')
    }
  })
  workspace.timePoints.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `timePoints[${index}].projectId`)
    requireRef(issues, milestoneIds, item.milestoneId, `timePoints[${index}].milestoneId`)
    requireRef(issues, taskIds, item.taskId, `timePoints[${index}].taskId`)
    requireRef(issues, materialIds, item.materialId, `timePoints[${index}].materialId`)
    requireRef(issues, eventIds, item.eventId, `timePoints[${index}].eventId`)
    item.relatedTaskIds.forEach((id, taskIndex) => requireRef(issues, taskIds, id, `timePoints[${index}].relatedTaskIds[${taskIndex}]`))
    item.relatedMaterialIds.forEach((id, materialIndex) => requireRef(issues, materialIds, id, `timePoints[${index}].relatedMaterialIds[${materialIndex}]`))
    const milestone = item.milestoneId ? milestonesById.get(item.milestoneId) : null
    const task = item.taskId ? tasksById.get(item.taskId) : null
    const material = item.materialId ? materialsById.get(item.materialId) : null
    const event = item.eventId ? eventsById.get(item.eventId) : null
    if (milestone && milestone.projectId !== item.projectId) ownershipIssue(`timePoints[${index}].milestoneId`, '时间点与阶段不属于同一项目')
    if (task && (task.projectId !== item.projectId || (item.milestoneId !== null && task.milestoneId !== item.milestoneId))) {
      ownershipIssue(`timePoints[${index}].taskId`, '时间点与任务的项目或阶段归属不一致')
    }
    if (material && material.projectId !== item.projectId) ownershipIssue(`timePoints[${index}].materialId`, '时间点与材料不属于同一项目')
    if (event && event.projectId !== item.projectId) ownershipIssue(`timePoints[${index}].eventId`, '时间点与事件不属于同一项目')
    item.relatedTaskIds.forEach((id, taskIndex) => {
      const relatedTask = tasksById.get(id)
      if (relatedTask && relatedTask.projectId !== item.projectId) {
        ownershipIssue(`timePoints[${index}].relatedTaskIds[${taskIndex}]`, '时间点与关联任务不属于同一项目')
      }
    })
    item.relatedMaterialIds.forEach((id, materialIndex) => {
      const relatedMaterial = materialsById.get(id)
      if (relatedMaterial && relatedMaterial.projectId !== item.projectId) {
        ownershipIssue(`timePoints[${index}].relatedMaterialIds[${materialIndex}]`, '时间点与关联材料不属于同一项目')
      }
    })
  })
  workspace.events.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `events[${index}].projectId`)
    requireRef(issues, timePointIds, item.startTimePointId, `events[${index}].startTimePointId`)
    requireRef(issues, timePointIds, item.endTimePointId, `events[${index}].endTimePointId`)
    for (const [key, timePointId] of [['startTimePointId', item.startTimePointId], ['endTimePointId', item.endTimePointId]] as const) {
      const timePoint = timePointId ? timePointsById.get(timePointId) : null
      if (timePoint && timePoint.projectId !== item.projectId) {
        ownershipIssue(`events[${index}].${key}`, '事件与时间点不属于同一项目')
      }
    }
  })
  workspace.evidenceRefs.forEach((item, index) => requireRef(issues, versionIds, item.sourceVersionId, `evidenceRefs[${index}].sourceVersionId`))
  workspace.changeProposals.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `changeProposals[${index}].projectId`)
    requireRef(issues, versionIds, item.sourceVersionId, `changeProposals[${index}].sourceVersionId`)
    requireRef(issues, runIds, item.recognitionRunId, `changeProposals[${index}].recognitionRunId`)
  })
  workspace.reminderRecords.forEach((item, index) => requireRef(issues, taskIds, item.taskId, `reminderRecords[${index}].taskId`))

  const historyTargets: Partial<Record<HistoryEntityType, Set<string>>> = {
    source: sourceIds, source_version: versionIds, recognition_run: runIds, extraction_draft: draftIds, project: projectIds,
    milestone: milestoneIds, work_package: packageIds, task: taskIds, material: materialIds,
    time_point: timePointIds, event: eventIds, evidence: evidenceIds, change_proposal: proposalIds, reminder: reminderIds,
  }
  workspace.historyRecords.forEach((item, index) => {
    const targets = historyTargets[item.entityType]
    if (targets) requireRef(issues, targets, item.entityId, `historyRecords[${index}].entityId`)
    requireRef(issues, versionIds, item.sourceVersionId, `historyRecords[${index}].sourceVersionId`)
  })
  return issues
}
