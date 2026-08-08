export const RECOGNITION_REPAIR_VERSION = 'recognition-repair-1.0.0'
const REPAIRABLE_CODES = new Set(['MISSING_EVIDENCE', 'MISSING_TIMEPOINT', 'FALSE_PRECISION', 'MISSING_TIME_AMBIGUITY', 'MISSING_MATERIAL', 'MISSING_EVENT', 'MISSING_MILESTONE'])

function allTasks(result) { return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)])] }
function taskMap(result) { return new Map(allTasks(result).map((task) => [task.tempId, task])) }
export function shouldAttemptRecognitionRepair(report) { return report.issues.some((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code)) }
export function buildRecognitionRepairInstruction(report) {
  const issues = report.issues.filter((issue) => issue.repairable && REPAIRABLE_CODES.has(issue.code))
  return `这是唯一一次结构修复。只修复下列问题，不得重做或扩写整个结果：${JSON.stringify(issues)}。保留所有原有 tempId、实体和用户可见语义；不得删除任务，不得新增原文不支持的事实。新增内容必须引用来源逐字证据。模糊时间只能降为 null + needsConfirmation。返回完整 RecognitionResult 2.0 JSON。repairVersion=${RECOGNITION_REPAIR_VERSION}。`
}
function mergeUnique(base, candidate, key) { const keys = new Set(base.map(key)); return [...base, ...candidate.filter((item) => { const value = key(item); if (!value || keys.has(value)) return false; keys.add(value); return true })] }

export function mergeRecognitionRepair(base, candidate, report, sourceContent) {
  const allowed = new Set(report.issues.filter((issue) => issue.repairable).map((issue) => issue.code))
  const evidence = allowed.has('MISSING_EVIDENCE') || allowed.has('MISSING_TIMEPOINT') || allowed.has('MISSING_MATERIAL') || allowed.has('MISSING_EVENT') ? mergeUnique(base.evidence, candidate.evidence.filter((item) => sourceContent.includes(item.quotedText || item.quote || '')), (item) => item.id) : base.evidence
  const evidenceIds = new Set(evidence.map((item) => item.id))
  const baseTaskMap = taskMap(base)
  const candidateTaskMap = taskMap(candidate)
  const validTaskIds = new Set(baseTaskMap.keys())
  const materials = allowed.has('MISSING_MATERIAL') ? mergeUnique(base.materials, candidate.materials.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && item.relatedTaskTempIds.every((id) => validTaskIds.has(id))), (item) => item.name.trim().toLowerCase()) : base.materials
  const materialIds = new Set(materials.map((item) => item.tempId))
  const safeCandidateTimes = candidate.timePoints.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && item.relatedTaskTempIds.every((id) => validTaskIds.has(id)) && item.relatedMaterialTempIds.every((id) => materialIds.has(id)))
  let timePoints = allowed.has('MISSING_TIMEPOINT') ? mergeUnique(base.timePoints, safeCandidateTimes, (item) => item.rawText.replace(/\s/gu, '').toLowerCase()) : [...base.timePoints]
  if (allowed.has('FALSE_PRECISION')) { const replacement = new Map(safeCandidateTimes.filter((item) => (item.precision === 'vague' || item.precision === 'relative') && item.normalizedValue === null && item.needsConfirmation).map((item) => [item.tempId, item])); timePoints = timePoints.map((item) => replacement.get(item.tempId) ?? item) }
  const timePointIds = new Set(timePoints.map((item) => item.tempId))
  const events = allowed.has('MISSING_EVENT') ? mergeUnique(base.events, candidate.events.filter((item) => item.evidenceIds.some((id) => evidenceIds.has(id)) && (!item.startTimePointTempId || timePointIds.has(item.startTimePointTempId)) && (!item.endTimePointTempId || timePointIds.has(item.endTimePointTempId))), (item) => `${item.title.trim().toLowerCase()}|${item.startTimePointTempId ?? ''}`) : base.events
  const ambiguities = allowed.has('MISSING_TIME_AMBIGUITY') || allowed.has('FALSE_PRECISION') ? mergeUnique(base.ambiguities, candidate.ambiguities.filter((item) => item.evidenceIds.every((id) => evidenceIds.has(id))), (item) => `${item.field}|${item.message}`) : base.ambiguities
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
