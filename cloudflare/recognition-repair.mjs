export const RECOGNITION_REPAIR_VERSION = 'recognition-repair-1.1.0'
export const RECOGNITION_REPAIR_PATCH_VERSION = 'recognition-repair-patch-1.0.0'
const REPAIRABLE_CODES = new Set(['MISSING_EVIDENCE', 'INVALID_EVIDENCE', 'MISSING_TIMEPOINT', 'FALSE_PRECISION', 'POSSIBLE_FALSE_PRECISION', 'MISSING_TIME_AMBIGUITY', 'MISSING_AMBIGUITY', 'MISSING_MATERIAL', 'MISSING_EVENT', 'EVENT_TASK_CONFUSION'])
const PATCH_FIELDS = new Set(['contractVersion', 'issueCodes', 'evidence', 'materials', 'timePoints', 'events', 'ambiguities', 'taskReferenceUpdates'])
const PATCH_ARRAY_FIELDS = ['issueCodes', 'evidence', 'materials', 'timePoints', 'events', 'ambiguities', 'taskReferenceUpdates']

function allTasks(result) { return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)])] }
function taskMap(result) { return new Map(allTasks(result).map((task) => [task.tempId, task])) }
export function shouldAttemptRecognitionRepair(report) { return report.issues.some((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code)) }
export function buildRecognitionRepairInstruction(report) {
  const issues = report.issues.filter((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code))
  return `这是唯一一次 issue-scoped 结构修复，只处理这些问题：${JSON.stringify(issues)}。不要重新生成 RecognitionResult，不要返回 Project、Milestone、WorkPackage、Task、sourceSummary、projectMatch 或 quality。只返回严格 JSON patch：{contractVersion:"${RECOGNITION_REPAIR_PATCH_VERSION}",issueCodes:[],evidence:[],materials:[],timePoints:[],events:[],ambiguities:[],taskReferenceUpdates:[]}。允许修改范围仅为问题对应的 Evidence、Material、TimePoint、Event、Ambiguity 以及既有 Task 的引用数组；taskReferenceUpdates 每项只能含 taskTempId,evidenceIds,materialTempIds,timePointTempIds。保留所有既有实体，不得删除或重写任务，不得新增无逐字证据的事实。模糊时间只能降为 normalizedValue=null + needsConfirmation=true。repairVersion=${RECOGNITION_REPAIR_VERSION}。`
}
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function replaceById(base, patch, id) { const replacements = new Map(patch.map((item) => [id(item), item])); const baseIds = new Set(base.map(id)); return [...base.map((item) => replacements.get(id(item)) ?? item), ...patch.filter((item) => !baseIds.has(id(item)))] }
function updateTaskReferences(result, updates) {
  const byId = new Map(updates.map((update) => [update.taskTempId, update]))
  const updateTask = (task) => { const update = byId.get(task.tempId); return update ? { ...task, evidenceIds: [...new Set([...task.evidenceIds, ...update.evidenceIds])], materialTempIds: [...new Set([...task.materialTempIds, ...update.materialTempIds])], timePointTempIds: [...new Set([...task.timePointTempIds, ...update.timePointTempIds])] } : task }
  return { standaloneTasks: result.standaloneTasks.map(updateTask), milestones: result.milestones.map((milestone) => ({ ...milestone, tasks: milestone.tasks.map(updateTask), workPackages: milestone.workPackages.map((workPackage) => ({ ...workPackage, tasks: workPackage.tasks.map(updateTask) })) })) }
}
export function createRecognitionRepairCandidate(base, raw, report) {
  if (!isRecord(raw) || Object.keys(raw).some((key) => !PATCH_FIELDS.has(key)) || raw.contractVersion !== RECOGNITION_REPAIR_PATCH_VERSION || PATCH_ARRAY_FIELDS.some((field) => !Array.isArray(raw[field]))) return null
  const allowedCodes = new Set(report.issues.filter((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code)).map((issue) => issue.code))
  if (raw.issueCodes.some((code) => typeof code !== 'string' || !allowedCodes.has(code))) return null
  if (raw.taskReferenceUpdates.length > 40 || raw.taskReferenceUpdates.some((value) => !isRecord(value) || Object.keys(value).some((key) => !['taskTempId', 'evidenceIds', 'materialTempIds', 'timePointTempIds'].includes(key)) || typeof value.taskTempId !== 'string' || !Array.isArray(value.evidenceIds) || !Array.isArray(value.materialTempIds) || !Array.isArray(value.timePointTempIds) || [...value.evidenceIds, ...value.materialTempIds, ...value.timePointTempIds].some((id) => typeof id !== 'string'))) return null
  if (raw.evidence.length > 80 || raw.materials.length > 40 || raw.timePoints.length > 40 || raw.events.length > 20 || raw.ambiguities.length > 40) return null
  const taskReferences = updateTaskReferences(base, raw.taskReferenceUpdates)
  return { ...base, ...taskReferences, evidence: replaceById(base.evidence, raw.evidence, (item) => item.id), materials: replaceById(base.materials, raw.materials, (item) => item.tempId), timePoints: replaceById(base.timePoints, raw.timePoints, (item) => item.tempId), events: replaceById(base.events, raw.events, (item) => item.tempId), ambiguities: replaceById(base.ambiguities, raw.ambiguities, (item) => item.id) }
}
function mergeUnique(base, candidate, key) { const keys = new Set(base.map(key)); return [...base, ...candidate.filter((item) => { const value = key(item); if (!value || keys.has(value)) return false; keys.add(value); return true })] }

export function mergeRecognitionRepair(base, candidate, report, sourceContent) {
  const allowed = new Set(report.issues.filter((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code)).map((issue) => issue.code))
  const evidence = allowed.has('MISSING_EVIDENCE') || allowed.has('INVALID_EVIDENCE') || allowed.has('MISSING_TIMEPOINT') || allowed.has('MISSING_MATERIAL') || allowed.has('MISSING_EVENT') || allowed.has('EVENT_TASK_CONFUSION') ? mergeUnique(base.evidence, candidate.evidence.filter((item) => sourceContent.includes(item.quotedText || item.quote || '')), (item) => item.id) : base.evidence
  const evidenceIds = new Set(evidence.map((item) => item.id))
  const baseTaskMap = taskMap(base)
  const candidateTaskMap = taskMap(candidate)
  const validTaskIds = new Set(baseTaskMap.keys())
  const materials = allowed.has('MISSING_MATERIAL') ? mergeUnique(base.materials, candidate.materials.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && item.relatedTaskTempIds.every((id) => validTaskIds.has(id))), (item) => item.name.trim().toLowerCase()) : base.materials
  const materialIds = new Set(materials.map((item) => item.tempId))
  const safeCandidateTimes = candidate.timePoints.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && item.relatedTaskTempIds.every((id) => validTaskIds.has(id)) && item.relatedMaterialTempIds.every((id) => materialIds.has(id)))
  let timePoints = allowed.has('MISSING_TIMEPOINT') ? mergeUnique(base.timePoints, safeCandidateTimes, (item) => item.rawText.replace(/\s/gu, '').toLowerCase()) : [...base.timePoints]
  if (allowed.has('FALSE_PRECISION') || allowed.has('POSSIBLE_FALSE_PRECISION')) { const replacement = new Map(safeCandidateTimes.filter((item) => (item.precision === 'vague' || item.precision === 'relative') && item.normalizedValue === null && item.needsConfirmation).map((item) => [item.tempId, item])); timePoints = timePoints.map((item) => replacement.get(item.tempId) ?? item) }
  const timePointIds = new Set(timePoints.map((item) => item.tempId))
  const events = allowed.has('MISSING_EVENT') || allowed.has('EVENT_TASK_CONFUSION') ? mergeUnique(base.events, candidate.events.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && (!item.startTimePointTempId || timePointIds.has(item.startTimePointTempId)) && (!item.endTimePointTempId || timePointIds.has(item.endTimePointTempId))), (item) => `${item.title.trim().toLowerCase()}|${item.startTimePointTempId ?? ''}`) : base.events
  const ambiguities = allowed.has('MISSING_TIME_AMBIGUITY') || allowed.has('MISSING_AMBIGUITY') || allowed.has('FALSE_PRECISION') || allowed.has('POSSIBLE_FALSE_PRECISION') ? mergeUnique(base.ambiguities, candidate.ambiguities.filter((item) => item.evidenceIds.every((id) => evidenceIds.has(id))), (item) => `${item.field}|${item.message}`) : base.ambiguities
  let milestones = base.milestones
  let standaloneTasks = base.standaloneTasks
  if (allowed.has('MISSING_MILESTONE') && base.milestones.length === 0 && candidate.milestones.length > 0) {
    const moved = new Set()
    const repairedMilestones = candidate.milestones.flatMap((milestone) => {
      const tasks = milestone.tasks.flatMap((task) => { const existing = baseTaskMap.get(task.tempId); if (!existing) return []; moved.add(existing.tempId); return [existing] })
      const workPackages = milestone.workPackages.flatMap((workPackage) => { const packageTasks = workPackage.tasks.flatMap((task) => { const existing = baseTaskMap.get(task.tempId); if (!existing) return []; moved.add(existing.tempId); return [existing] }); return packageTasks.length ? [{ ...workPackage, tasks: packageTasks }] : [] })
      return tasks.length || workPackages.length ? [{ ...milestone, tasks, workPackages }] : []
    })
    if (repairedMilestones.length && moved.size) { milestones = repairedMilestones; standaloneTasks = standaloneTasks.filter((task) => !moved.has(task.tempId)) }
  }
  const newMaterialIds = new Set(materials.filter((item) => !base.materials.some((baseItem) => baseItem.tempId === item.tempId)).map((item) => item.tempId))
  const newTimeIds = new Set(timePoints.filter((item) => !base.timePoints.some((baseItem) => baseItem.tempId === item.tempId)).map((item) => item.tempId))
  const enrichTask = (task) => { const candidateTask = candidateTaskMap.get(task.tempId); return candidateTask ? { ...task, materialTempIds: [...new Set([...task.materialTempIds, ...candidateTask.materialTempIds.filter((id) => newMaterialIds.has(id))])], timePointTempIds: [...new Set([...task.timePointTempIds, ...candidateTask.timePointTempIds.filter((id) => newTimeIds.has(id))])], evidenceIds: [...new Set([...task.evidenceIds, ...candidateTask.evidenceIds.filter((id) => evidenceIds.has(id))])] } : task }
  milestones = milestones.map((milestone) => ({ ...milestone, evidenceIds: [...new Set([...milestone.evidenceIds, ...(candidate.milestones.find((item) => item.tempId === milestone.tempId)?.evidenceIds ?? []).filter((id) => evidenceIds.has(id))])], tasks: milestone.tasks.map(enrichTask), workPackages: milestone.workPackages.map((workPackage) => ({ ...workPackage, tasks: workPackage.tasks.map(enrichTask) })) }))
  standaloneTasks = standaloneTasks.map(enrichTask)
  return { ...base, milestones, standaloneTasks, materials, timePoints, events, evidence, ambiguities }
}
