import { isDateOnly, isValidTimeZone, parseBusinessDateTime, resolveWorkspaceTimeZone } from '../../../lib/timeSemantics'
import type { WorkspaceV8 } from '../types'
import type { ValidationIssue } from './issues'

const SENTINEL_PATTERN = /^(?:1900-01-01|1970-01-01|9999-12-31)(?:T|$)/u

function issue(path: string, message: string, code: ValidationIssue['code'] = 'INVALID_TIME'): ValidationIssue {
  return { code, path, message }
}

export function validateTimes(workspace: WorkspaceV8): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const defaultTimezone = resolveWorkspaceTimeZone(workspace.settings.defaultTimezone)
  if (!isValidTimeZone(workspace.settings.defaultTimezone)) {
    issues.push(issue('settings.defaultTimezone', '工作区默认时区必须是有效 IANA timezone'))
  }
  workspace.timePoints.forEach((point, index) => {
    const path = `timePoints[${index}]`
    if (point.normalizedValue && SENTINEL_PATTERN.test(point.normalizedValue)) {
      issues.push(issue(`${path}.normalizedValue`, '未知时间不得使用 sentinel date', 'SENTINEL_DATE'))
    }
    if (point.precision === 'vague' || point.precision === 'relative') {
      if (point.normalizedValue !== null || !point.needsConfirmation) {
        issues.push(issue(path, '模糊或相对时间必须使用 null 且 needsConfirmation=true'))
      }
      return
    }
    if (point.normalizedValue === null) {
      issues.push(issue(`${path}.normalizedValue`, '精确时间或日期不能为空'))
      return
    }
    if (point.precision === 'date_only') {
      if (!point.isAllDay || !isDateOnly(point.normalizedValue)) {
        issues.push(issue(path, 'date_only 必须是有效 YYYY-MM-DD 且 isAllDay=true'))
      }
      return
    }
    if (point.isAllDay || !point.timezone) {
      issues.push(issue(path, 'exact 时间必须包含 timezone 且 isAllDay=false'))
      return
    }
    if (!isValidTimeZone(point.timezone)) {
      issues.push(issue(`${path}.timezone`, 'exact 时间的 timezone 无效'))
      return
    }
    if (!parseBusinessDateTime(point.normalizedValue, point.timezone || defaultTimezone)) {
      issues.push(issue(`${path}.normalizedValue`, 'exact 时间不是有效的带时区或可按声明时区解释的日期时间'))
    }
  })
  const instantFields = [
    ['workspace.createdAt', workspace.workspace.createdAt],
    ['workspace.updatedAt', workspace.workspace.updatedAt],
    ['savedAt', workspace.savedAt],
  ] as const
  instantFields.forEach(([path, value]) => {
    if (Number.isNaN(new Date(value).getTime())) issues.push(issue(path, '系统时间戳无效'))
  })
  const entityTimestamps: Array<[string, string | null]> = [
    ...workspace.sources.flatMap((item, index) => [[`sources[${index}].createdAt`, item.createdAt], [`sources[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.sourceVersions.map((item, index): [string, string] => [`sourceVersions[${index}].createdAt`, item.createdAt]),
    ...workspace.recognitionRuns.flatMap((item, index) => [[`recognitionRuns[${index}].startedAt`, item.startedAt], [`recognitionRuns[${index}].completedAt`, item.completedAt]] as Array<[string, string | null]>),
    ...workspace.extractionDrafts.flatMap((item, index) => [[`extractionDrafts[${index}].createdAt`, item.createdAt], [`extractionDrafts[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.projects.flatMap((item, index) => [[`projects[${index}].createdAt`, item.createdAt], [`projects[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.milestones.flatMap((item, index) => [[`milestones[${index}].createdAt`, item.createdAt], [`milestones[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.workPackages.flatMap((item, index) => [[`workPackages[${index}].createdAt`, item.createdAt], [`workPackages[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.tasks.flatMap((item, index) => [[`tasks[${index}].createdAt`, item.createdAt], [`tasks[${index}].updatedAt`, item.updatedAt], [`tasks[${index}].snoozedUntil`, item.snoozedUntil]] as Array<[string, string | null]>),
    ...workspace.materials.flatMap((item, index) => [[`materials[${index}].createdAt`, item.createdAt], [`materials[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.timePoints.flatMap((item, index) => [[`timePoints[${index}].createdAt`, item.createdAt], [`timePoints[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.events.flatMap((item, index) => [[`events[${index}].createdAt`, item.createdAt], [`events[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.evidenceRefs.map((item, index): [string, string] => [`evidenceRefs[${index}].createdAt`, item.createdAt]),
    ...workspace.changeProposals.flatMap((item, index) => [[`changeProposals[${index}].createdAt`, item.createdAt], [`changeProposals[${index}].updatedAt`, item.updatedAt]] as Array<[string, string]>),
    ...workspace.historyRecords.map((item, index): [string, string] => [`historyRecords[${index}].changedAt`, item.changedAt]),
    ...workspace.reminderRecords.flatMap((item, index) => [[`reminderRecords[${index}].scheduledAt`, item.scheduledAt], [`reminderRecords[${index}].sentAt`, item.sentAt]] as Array<[string, string | null]>),
  ]
  entityTimestamps.forEach(([path, value]) => {
    if (value !== null && Number.isNaN(new Date(value).getTime())) issues.push(issue(path, '实体时间戳无效'))
  })
  return issues
}
