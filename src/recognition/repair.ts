import type { RecognitionResult, TaskSuggestionV2 } from './types'
import type { RecognitionQualityIssue, RecognitionQualityReport } from './qualityValidator'

export const RECOGNITION_REPAIR_VERSION = 'recognition-repair-1.1.0'
export const RECOGNITION_REPAIR_PATCH_VERSION = 'recognition-repair-patch-1.0.0'

const REPAIRABLE_CODES = new Set<RecognitionQualityIssue['code']>([
  'INVALID_EVIDENCE', 'MISSING_TIMEPOINT', 'POSSIBLE_FALSE_PRECISION', 'MISSING_AMBIGUITY',
  'MISSING_MATERIAL', 'EVENT_TASK_CONFUSION',
])

export interface RecognitionRepairPatch {
  contractVersion: typeof RECOGNITION_REPAIR_PATCH_VERSION
  issueCodes: RecognitionQualityIssue['code'][]
  evidence: RecognitionResult['evidence']
  materials: RecognitionResult['materials']
  timePoints: RecognitionResult['timePoints']
  events: RecognitionResult['events']
  ambiguities: RecognitionResult['ambiguities']
  taskReferenceUpdates: Array<{
    taskTempId: string
    evidenceIds: string[]
    materialTempIds: string[]
    timePointTempIds: string[]
  }>
}

const PATCH_FIELDS = new Set(['contractVersion', 'issueCodes', 'evidence', 'materials', 'timePoints', 'events', 'ambiguities', 'taskReferenceUpdates'])
const PATCH_ARRAY_FIELDS = ['issueCodes', 'evidence', 'materials', 'timePoints', 'events', 'ambiguities', 'taskReferenceUpdates'] as const

function allTasks(result: RecognitionResult): TaskSuggestionV2[] {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [
    ...milestone.tasks,
    ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
  ])]
}

function taskMap(result: RecognitionResult): Map<string, TaskSuggestionV2> {
  return new Map(allTasks(result).map((task) => [task.tempId, task]))
}

export function shouldAttemptRecognitionRepair(report: RecognitionQualityReport): boolean {
  return report.issues.some((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code))
}

export function buildRecognitionRepairInstruction(report: RecognitionQualityReport): string {
  const issues = report.issues.filter((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code))
  return `这是唯一一次 issue-scoped 结构修复，只处理这些问题：${JSON.stringify(issues)}。不要重新生成 RecognitionResult，不要返回 Project、Milestone、WorkPackage、Task、sourceSummary、projectMatch 或 quality。只返回严格 JSON patch：{contractVersion:"${RECOGNITION_REPAIR_PATCH_VERSION}",issueCodes:[],evidence:[],materials:[],timePoints:[],events:[],ambiguities:[],taskReferenceUpdates:[]}。允许修改范围仅为问题对应的 Evidence、Material、TimePoint、Event、Ambiguity 以及既有 Task 的引用数组；taskReferenceUpdates 每项只能含 taskTempId,evidenceIds,materialTempIds,timePointTempIds。保留所有既有实体，不得删除或重写任务，不得新增无逐字证据的事实。模糊时间只能降为 normalizedValue=null + needsConfirmation=true。repairVersion=${RECOGNITION_REPAIR_VERSION}。`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function replaceById<T>(base: T[], patch: T[], id: (item: T) => string): T[] {
  const replacements = new Map(patch.map((item) => [id(item), item]))
  const baseIds = new Set(base.map(id))
  return [...base.map((item) => replacements.get(id(item)) ?? item), ...patch.filter((item) => !baseIds.has(id(item)))]
}

function updateTaskReferences(result: RecognitionResult, updates: RecognitionRepairPatch['taskReferenceUpdates']): Pick<RecognitionResult, 'standaloneTasks' | 'milestones'> {
  const byId = new Map(updates.map((update) => [update.taskTempId, update]))
  const updateTask = (task: TaskSuggestionV2): TaskSuggestionV2 => {
    const update = byId.get(task.tempId)
    if (!update) return task
    return {
      ...task,
      evidenceIds: [...new Set([...task.evidenceIds, ...update.evidenceIds])],
      materialTempIds: [...new Set([...task.materialTempIds, ...update.materialTempIds])],
      timePointTempIds: [...new Set([...task.timePointTempIds, ...update.timePointTempIds])],
    }
  }
  return {
    standaloneTasks: result.standaloneTasks.map(updateTask),
    milestones: result.milestones.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map(updateTask),
      workPackages: milestone.workPackages.map((workPackage) => ({ ...workPackage, tasks: workPackage.tasks.map(updateTask) })),
    })),
  }
}

export function createRecognitionRepairCandidate(
  base: RecognitionResult,
  raw: unknown,
  report: RecognitionQualityReport,
): RecognitionResult | null {
  if (!isRecord(raw) || Object.keys(raw).some((key) => !PATCH_FIELDS.has(key))) return null
  if (raw.contractVersion !== RECOGNITION_REPAIR_PATCH_VERSION) return null
  if (PATCH_ARRAY_FIELDS.some((field) => !Array.isArray(raw[field]))) return null
  const allowedCodes = new Set(report.issues.filter((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code)).map((issue) => issue.code))
  const issueCodes = raw.issueCodes as unknown[]
  if (issueCodes.some((code) => typeof code !== 'string' || !allowedCodes.has(code as RecognitionQualityIssue['code']))) return null
  const updates = raw.taskReferenceUpdates as unknown[]
  if (updates.length > 40 || updates.some((value) => !isRecord(value)
    || Object.keys(value).some((key) => !['taskTempId', 'evidenceIds', 'materialTempIds', 'timePointTempIds'].includes(key))
    || typeof value.taskTempId !== 'string'
    || !Array.isArray(value.evidenceIds)
    || !Array.isArray(value.materialTempIds)
    || !Array.isArray(value.timePointTempIds)
    || [...value.evidenceIds, ...value.materialTempIds, ...value.timePointTempIds].some((id) => typeof id !== 'string'))) return null
  const patch = raw as unknown as RecognitionRepairPatch
  if (patch.evidence.length > 80 || patch.materials.length > 40 || patch.timePoints.length > 40 || patch.events.length > 20 || patch.ambiguities.length > 40) return null
  const taskReferences = updateTaskReferences(base, patch.taskReferenceUpdates)
  return {
    ...base,
    ...taskReferences,
    evidence: replaceById(base.evidence, patch.evidence, (item) => item.id),
    materials: replaceById(base.materials, patch.materials, (item) => item.tempId),
    timePoints: replaceById(base.timePoints, patch.timePoints, (item) => item.tempId),
    events: replaceById(base.events, patch.events, (item) => item.tempId),
    ambiguities: replaceById(base.ambiguities, patch.ambiguities, (item) => item.id),
  }
}

function mergeUnique<T>(base: T[], candidate: T[], key: (item: T) => string): T[] {
  const keys = new Set(base.map(key))
  return [...base, ...candidate.filter((item) => {
    const value = key(item)
    if (!value || keys.has(value)) return false
    keys.add(value)
    return true
  })]
}

export function mergeRecognitionRepair(
  base: RecognitionResult,
  candidate: RecognitionResult,
  report: RecognitionQualityReport,
  sourceContent: string,
): RecognitionResult {
  const allowed = new Set(report.issues.filter((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code)).map((issue) => issue.code))
  const evidence = allowed.has('INVALID_EVIDENCE') || allowed.has('MISSING_TIMEPOINT') || allowed.has('MISSING_MATERIAL') || allowed.has('EVENT_TASK_CONFUSION')
    ? mergeUnique(base.evidence, candidate.evidence.filter((item) => sourceContent.includes(item.quotedText || item.quote || '')), (item) => item.id)
    : base.evidence
  const evidenceIds = new Set(evidence.map((item) => item.id))
  const baseTaskMap = taskMap(base)
  const candidateTaskMap = taskMap(candidate)
  const validTaskIds = new Set(baseTaskMap.keys())

  const materials = allowed.has('MISSING_MATERIAL')
    ? mergeUnique(base.materials, candidate.materials.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && item.relatedTaskTempIds.every((id) => validTaskIds.has(id))), (item) => item.name.trim().toLowerCase())
    : base.materials
  const materialIds = new Set(materials.map((item) => item.tempId))
  const safeCandidateTimes = candidate.timePoints.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && item.relatedTaskTempIds.every((id) => validTaskIds.has(id)) && item.relatedMaterialTempIds.every((id) => materialIds.has(id)))
  let timePoints = allowed.has('MISSING_TIMEPOINT')
    ? mergeUnique(base.timePoints, safeCandidateTimes, (item) => item.rawText.replace(/\s/gu, '').toLowerCase())
    : [...base.timePoints]
  if (allowed.has('POSSIBLE_FALSE_PRECISION')) {
    const replacement = new Map(safeCandidateTimes.filter((item) => (item.precision === 'vague' || item.precision === 'relative') && item.normalizedValue === null && item.needsConfirmation).map((item) => [item.tempId, item]))
    timePoints = timePoints.map((item) => replacement.get(item.tempId) ?? item)
  }
  const timePointIds = new Set(timePoints.map((item) => item.tempId))
  const events = allowed.has('EVENT_TASK_CONFUSION')
    ? mergeUnique(base.events, candidate.events.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && (!item.startTimePointTempId || timePointIds.has(item.startTimePointTempId)) && (!item.endTimePointTempId || timePointIds.has(item.endTimePointTempId))), (item) => `${item.title.trim().toLowerCase()}|${item.startTimePointTempId ?? ''}`)
    : base.events
  const ambiguities = allowed.has('MISSING_AMBIGUITY') || allowed.has('POSSIBLE_FALSE_PRECISION')
    ? mergeUnique(base.ambiguities, candidate.ambiguities.filter((item) => item.evidenceIds.every((id) => evidenceIds.has(id))), (item) => `${item.field}|${item.message}`)
    : base.ambiguities

  let milestones = base.milestones
  let standaloneTasks = base.standaloneTasks
  if (allowed.has('MISSING_MILESTONE') && base.milestones.length === 0 && candidate.milestones.length > 0) {
    const moved = new Set<string>()
    const repairedMilestones = candidate.milestones.flatMap((milestone) => {
      const tasks = milestone.tasks.flatMap((task) => {
        const existing = baseTaskMap.get(task.tempId)
        if (!existing) return []
        moved.add(existing.tempId)
        return [existing]
      })
      const workPackages = milestone.workPackages.flatMap((workPackage) => {
        const packageTasks = workPackage.tasks.flatMap((task) => {
          const existing = baseTaskMap.get(task.tempId)
          if (!existing) return []
          moved.add(existing.tempId)
          return [existing]
        })
        return packageTasks.length ? [{ ...workPackage, tasks: packageTasks }] : []
      })
      if (!tasks.length && !workPackages.length) return []
      return [{ ...milestone, tasks, workPackages }]
    })
    if (repairedMilestones.length && moved.size) {
      milestones = repairedMilestones
      standaloneTasks = standaloneTasks.filter((task) => !moved.has(task.tempId))
    }
  }

  const newMaterialIds = new Set(materials.filter((item) => !base.materials.some((baseItem) => baseItem.tempId === item.tempId)).map((item) => item.tempId))
  const newTimeIds = new Set(timePoints.filter((item) => !base.timePoints.some((baseItem) => baseItem.tempId === item.tempId)).map((item) => item.tempId))
  const enrichTask = (task: TaskSuggestionV2): TaskSuggestionV2 => {
    const candidateTask = candidateTaskMap.get(task.tempId)
    if (!candidateTask) return task
    return {
      ...task,
      materialTempIds: [...new Set([...task.materialTempIds, ...candidateTask.materialTempIds.filter((id) => newMaterialIds.has(id))])],
      timePointTempIds: [...new Set([...task.timePointTempIds, ...candidateTask.timePointTempIds.filter((id) => newTimeIds.has(id))])],
      evidenceIds: [...new Set([...task.evidenceIds, ...candidateTask.evidenceIds.filter((id) => evidenceIds.has(id))])],
    }
  }
  milestones = milestones.map((milestone) => ({
    ...milestone,
    evidenceIds: [...new Set([...milestone.evidenceIds, ...(candidate.milestones.find((item) => item.tempId === milestone.tempId)?.evidenceIds ?? []).filter((id) => evidenceIds.has(id))])],
    tasks: milestone.tasks.map(enrichTask),
    workPackages: milestone.workPackages.map((workPackage) => ({ ...workPackage, tasks: workPackage.tasks.map(enrichTask) })),
  }))
  standaloneTasks = standaloneTasks.map(enrichTask)
  return { ...base, milestones, standaloneTasks, materials, timePoints, events, evidence, ambiguities }
}
