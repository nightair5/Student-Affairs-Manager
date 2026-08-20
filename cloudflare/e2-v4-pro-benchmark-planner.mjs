import { normalizeRecognitionResult, recognitionSystemPrompt } from './recognition.mjs'

export const E2_V4_PRO_BENCHMARK_PROMPT_VERSION = 'recognition-2.4.1-r7-preview'
export const E2_V4_PRO_BENCHMARK_PIPELINE_VERSION = 'recognition-pipeline-2.2.2-r7-preview'
export const E2_V4_PRO_BENCHMARK_NORMALIZER_VERSION = 'e2-v4-pro-benchmark-normalizer-2.2.0'
export const E2_V4_PRO_BENCHMARK_PLANNER_VERSION = 'e2-v4-pro-benchmark-planner-1.0.0'

const PRODUCTION_EVENT_RULE = '参加会议/答辩/培训只建立 Event，不再重复建立“参加……”Task；只有来源明确要求准备产出才另建 Task。'
const BENCHMARK_EVENT_RULE = 'Event 记录日程事实，Task 记录用户必须完成的行动。原文明示必须参加、集合、到场、签到、出席或上岗时，建立 Event 并同时建立对应 Task；同句另有签到、提交、携带等独立动作时分别保留。仅纯信息事件不建 Task。'

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

function tasksFrom(result) {
  return [
    ...result.standaloneTasks,
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks,
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
    ]),
  ]
}

function rawTasksFrom(raw) {
  const milestones = Array.isArray(raw?.milestones) ? raw.milestones : []
  return [
    ...(Array.isArray(raw?.standaloneTasks) ? raw.standaloneTasks : Array.isArray(raw?.tasks) ? raw.tasks : []),
    ...milestones.flatMap((milestone) => [
      ...(Array.isArray(milestone?.tasks) ? milestone.tasks : Array.isArray(milestone?.actions) ? milestone.actions : []),
      ...(Array.isArray(milestone?.workPackages) ? milestone.workPackages : []).flatMap((workPackage) =>
        Array.isArray(workPackage?.tasks) ? workPackage.tasks : Array.isArray(workPackage?.actions) ? workPackage.actions : []),
    ]),
  ].filter((task) => task && typeof task === 'object' && !Array.isArray(task))
}

export function benchmarkPlannerSystemPrompt() {
  const productionPrompt = recognitionSystemPrompt()
  if (!productionPrompt.includes(PRODUCTION_EVENT_RULE)) throw new Error('BENCHMARK_PROMPT_BASE_DRIFT')
  return `${productionPrompt.replace(PRODUCTION_EVENT_RULE, BENCHMARK_EVENT_RULE)}\n\n实验 Planner 补充契约：保留原文明示动作中最外层、最早出现的谓词，不得因词表顺序改写为宾语内部动词。Task、Material、TimePoint 的已输出引用必须双向一致；只允许连接已经输出且有证据的实体，不得为补关系创造新事实。适用对象、时间或地点条件不能确认时，必须输出 ambiguity。`
}

function restoreEvidenceBoundPredicates(raw, result, sourceContent) {
  const rawById = new Map(rawTasksFrom(raw)
    .filter((task) => typeof task.tempId === 'string' && task.tempId.trim())
    .map((task) => [task.tempId.trim(), task]))
  const evidenceById = new Map(result.evidence.map((item) => [item.id, item.quotedText || item.quote || '']))
  for (const task of tasksFrom(result)) {
    const sourceTask = rawById.get(task.tempId)
    const rawVerb = typeof sourceTask?.actionVerb === 'string' ? sourceTask.actionVerb.trim().slice(0, 20) : ''
    const rawTitle = typeof sourceTask?.title === 'string' ? sourceTask.title.trim().slice(0, 80) : ''
    const rawObject = typeof sourceTask?.actionObject === 'string' ? sourceTask.actionObject.trim().slice(0, 80) : ''
    const evidenceSupportsVerb = task.evidenceIds.some((id) => (evidenceById.get(id) || '').includes(rawVerb))
    if (!rawVerb || !rawTitle || !rawTitle.includes(rawVerb) || !sourceContent.includes(rawVerb) || !evidenceSupportsVerb) continue
    task.actionVerb = rawVerb
    task.title = rawTitle
    task.actionObject = rawObject || rawTitle.slice(rawTitle.indexOf(rawVerb) + rawVerb.length).trim() || rawTitle
  }
}

function closeExistingRelations(result) {
  const tasks = tasksFrom(result)
  const taskById = new Map(tasks.map((task) => [task.tempId, task]))
  const materialById = new Map(result.materials.map((material) => [material.tempId, material]))
  const timePointById = new Map(result.timePoints.map((timePoint) => [timePoint.tempId, timePoint]))

  for (const task of tasks) {
    task.materialTempIds = uniqueSorted(task.materialTempIds.filter((id) => materialById.has(id)))
    task.timePointTempIds = uniqueSorted(task.timePointTempIds.filter((id) => timePointById.has(id)))
  }
  for (const material of result.materials) {
    material.relatedTaskTempIds = uniqueSorted(material.relatedTaskTempIds.filter((id) => taskById.has(id)))
  }
  for (const timePoint of result.timePoints) {
    timePoint.relatedTaskTempIds = uniqueSorted(timePoint.relatedTaskTempIds.filter((id) => taskById.has(id)))
    timePoint.relatedMaterialTempIds = uniqueSorted(timePoint.relatedMaterialTempIds.filter((id) => materialById.has(id)))
  }

  for (const material of result.materials) {
    for (const taskId of material.relatedTaskTempIds) taskById.get(taskId).materialTempIds.push(material.tempId)
  }
  for (const task of tasks) {
    for (const materialId of task.materialTempIds) materialById.get(materialId).relatedTaskTempIds.push(task.tempId)
    for (const timePointId of task.timePointTempIds) timePointById.get(timePointId).relatedTaskTempIds.push(task.tempId)
  }
  for (const timePoint of result.timePoints) {
    for (const taskId of timePoint.relatedTaskTempIds) taskById.get(taskId).timePointTempIds.push(timePoint.tempId)
    for (const taskId of timePoint.relatedTaskTempIds) {
      for (const materialId of taskById.get(taskId).materialTempIds) timePoint.relatedMaterialTempIds.push(materialId)
    }
  }

  for (const task of tasks) {
    task.materialTempIds = uniqueSorted(task.materialTempIds)
    task.timePointTempIds = uniqueSorted(task.timePointTempIds)
  }
  for (const material of result.materials) material.relatedTaskTempIds = uniqueSorted(material.relatedTaskTempIds)
  for (const timePoint of result.timePoints) {
    timePoint.relatedTaskTempIds = uniqueSorted(timePoint.relatedTaskTempIds)
    timePoint.relatedMaterialTempIds = uniqueSorted(timePoint.relatedMaterialTempIds)
  }
}

export function normalizeBenchmarkRecognitionResult(raw, sourceContent, nowIso) {
  const result = normalizeRecognitionResult(raw, sourceContent, nowIso)
  if (!result) return null
  restoreEvidenceBoundPredicates(raw, result, sourceContent)
  closeExistingRelations(result)
  result.promptVersion = E2_V4_PRO_BENCHMARK_PROMPT_VERSION
  return result
}

export function validateBenchmarkPlannerContract(result, sourceContent) {
  const issues = []
  const tasks = tasksFrom(result)
  if (result.sourceSummary.requiresAction && result.events.length > 0 && tasks.length === 0) {
    issues.push('MISSING_REQUIRED_EVENT_TASK')
  }
  const conditionalAction = /(?:仅|只限|仅限).{0,40}(?:执行|参加|提交|办理|填写|出席|到场|集合|上岗)/u.test(sourceContent)
  if (conditionalAction && result.ambiguities.length === 0) issues.push('MISSING_CONDITION_AMBIGUITY')

  const taskById = new Map(tasks.map((task) => [task.tempId, task]))
  const materialById = new Map(result.materials.map((material) => [material.tempId, material]))
  const timePointById = new Map(result.timePoints.map((timePoint) => [timePoint.tempId, timePoint]))
  for (const task of tasks) {
    if (task.materialTempIds.some((id) => !materialById.get(id)?.relatedTaskTempIds.includes(task.tempId))) issues.push('TASK_MATERIAL_RELATION_ASYMMETRIC')
    if (task.timePointTempIds.some((id) => !timePointById.get(id)?.relatedTaskTempIds.includes(task.tempId))) issues.push('TASK_TIME_RELATION_ASYMMETRIC')
  }
  for (const material of result.materials) {
    if (material.relatedTaskTempIds.some((id) => !taskById.get(id)?.materialTempIds.includes(material.tempId))) issues.push('MATERIAL_TASK_RELATION_ASYMMETRIC')
  }
  for (const timePoint of result.timePoints) {
    if (timePoint.relatedTaskTempIds.some((id) => !taskById.get(id)?.timePointTempIds.includes(timePoint.tempId))) issues.push('TIME_TASK_RELATION_ASYMMETRIC')
  }
  return uniqueSorted(issues)
}
