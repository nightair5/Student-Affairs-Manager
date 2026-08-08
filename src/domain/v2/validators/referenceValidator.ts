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

  workspace.sources.forEach((item, index) => requireRef(issues, versionIds, item.currentVersionId, `sources[${index}].currentVersionId`))
  workspace.sourceVersions.forEach((item, index) => requireRef(issues, sourceIds, item.sourceId, `sourceVersions[${index}].sourceId`))
  workspace.recognitionRuns.forEach((item, index) => requireRef(issues, versionIds, item.sourceVersionId, `recognitionRuns[${index}].sourceVersionId`))
  workspace.extractionDrafts.forEach((item, index) => requireRef(issues, runIds, item.recognitionRunId, `extractionDrafts[${index}].recognitionRunId`))
  workspace.milestones.forEach((item, index) => requireRef(issues, projectIds, item.projectId, `milestones[${index}].projectId`))
  workspace.workPackages.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `workPackages[${index}].projectId`)
    requireRef(issues, milestoneIds, item.milestoneId, `workPackages[${index}].milestoneId`)
  })
  workspace.tasks.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `tasks[${index}].projectId`)
    requireRef(issues, milestoneIds, item.milestoneId, `tasks[${index}].milestoneId`)
    requireRef(issues, packageIds, item.workPackageId, `tasks[${index}].workPackageId`)
    requireRef(issues, taskIds, item.parentTaskId, `tasks[${index}].parentTaskId`)
    item.dependencyIds.forEach((id, dependencyIndex) => requireRef(issues, taskIds, id, `tasks[${index}].dependencyIds[${dependencyIndex}]`))
  })
  workspace.materials.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `materials[${index}].projectId`)
    requireRef(issues, timePointIds, item.deadlineTimePointId, `materials[${index}].deadlineTimePointId`)
    item.relatedTaskIds.forEach((id, taskIndex) => requireRef(issues, taskIds, id, `materials[${index}].relatedTaskIds[${taskIndex}]`))
  })
  workspace.timePoints.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `timePoints[${index}].projectId`)
    requireRef(issues, milestoneIds, item.milestoneId, `timePoints[${index}].milestoneId`)
    requireRef(issues, taskIds, item.taskId, `timePoints[${index}].taskId`)
    requireRef(issues, materialIds, item.materialId, `timePoints[${index}].materialId`)
    requireRef(issues, eventIds, item.eventId, `timePoints[${index}].eventId`)
  })
  workspace.events.forEach((item, index) => {
    requireRef(issues, projectIds, item.projectId, `events[${index}].projectId`)
    requireRef(issues, timePointIds, item.startTimePointId, `events[${index}].startTimePointId`)
    requireRef(issues, timePointIds, item.endTimePointId, `events[${index}].endTimePointId`)
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
