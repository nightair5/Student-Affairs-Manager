export const RECOGNITION_VALIDATOR_VERSION = 'recognition-quality-2.0.0'

const ACTION_VERBS = ['提交', '上传', '填写', '完成', '准备', '核对', '确认', '联系', '参加', '阅读', '下载', '打印', '盖章', '签字', '回复', '领取', '整理', '撰写', '制作', '报名', '携带', '出示', '汇报', '预约']
const SENTINEL_DATE = /(?:1970-01-01|1900-01-01|9999-12-31)/u
const DATE_TOKEN = /(?:\d{1,2}\s*月\s*\d{1,2}\s*日|今天|明天|后天|本周[一二三四五六日天]|下周[一二三四五六日天]|月底|月末|近期|另行通知|待定)(?:[^，。；\n]{0,24})/gu
const MATERIAL_CUE = /(?:提交|上传|携带|出示|填写|准备|报送|补交)[^。；\n]{0,50}(?:表|书|报告|证明|成绩单|PPT|PDF|Word|Excel|文件|照片|证书|截图|承诺书|声明|清单|音频|视频|材料)/iu
const EVENT_CUE = /(?:参加|召开|举行|出席|进行)[^。；\n]{0,40}(?:会议|答辩|培训|面试|路演|活动|测试|分享会|汇报)/u

function allTasks(result) {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)])]
}

function normalized(value) {
  return value.replace(/[\s，。；、:：前后内至到于]/gu, '').toLowerCase()
}

function sourceTimeTokens(sourceContent) {
  return [...sourceContent.matchAll(DATE_TOKEN)].map((match) => match[0].trim()).filter(Boolean)
}

export function validateRecognitionQuality(result, sourceContent) {
  const issues = []
  const seen = new Set()
  const add = (issue) => {
    const key = `${issue.code}:${issue.entityId ?? ''}:${issue.evidence ?? ''}`
    if (!seen.has(key)) { seen.add(key); issues.push(issue) }
  }
  const tasks = allTasks(result)
  const materials = new Map(result.materials.map((item) => [item.tempId, item]))
  const timePoints = new Map(result.timePoints.map((item) => [item.tempId, item]))
  const evidence = new Map(result.evidence.map((item) => [item.id, item]))
  const taskMap = new Map(tasks.map((item) => [item.tempId, item]))
  const ids = [...tasks.map((item) => item.tempId), ...result.materials.map((item) => item.tempId), ...result.timePoints.map((item) => item.tempId), ...result.events.map((item) => item.tempId), ...result.milestones.map((item) => item.tempId), ...result.milestones.flatMap((item) => item.workPackages.map((workPackage) => workPackage.tempId)), ...result.evidence.map((item) => item.id)]
  const idSet = new Set()
  ids.forEach((id) => { if (idSet.has(id)) add({ code: 'DUPLICATE_ID', severity: 'error', repairable: false, message: `ID 重复：${id}`, entityId: id, evidence: null }); idSet.add(id) })
  const checkEvidence = (entityId, evidenceIds) => {
    if (!evidenceIds.length) add({ code: 'MISSING_EVIDENCE', severity: 'error', repairable: true, message: '实体缺少来源证据。', entityId, evidence: null })
    evidenceIds.forEach((id) => { if (!evidence.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `证据引用不存在：${id}`, entityId, evidence: id }) })
  }
  result.evidence.forEach((item) => { const quote = item.quotedText || item.quote || ''; if (!quote || !sourceContent.includes(quote)) add({ code: 'EVIDENCE_NOT_SUPPORTED', severity: 'error', repairable: false, message: '证据不是来源正文中的连续逐字段落。', entityId: item.id, evidence: quote || null }) })
  result.milestones.forEach((item) => { checkEvidence(item.tempId, item.evidenceIds); item.workPackages.forEach((workPackage) => checkEvidence(workPackage.tempId, workPackage.evidenceIds)) })
  tasks.forEach((task) => {
    checkEvidence(task.tempId, task.evidenceIds)
    if (!ACTION_VERBS.some((verb) => task.title.includes(verb)) || !task.actionObject.trim()) add({ code: 'FALSE_ACTION', severity: 'warning', repairable: true, message: '任务不满足“动作 + 明确对象”。', entityId: task.tempId, evidence: task.title })
    if (task.hierarchyType === 'subtask') { const parent = task.parentTempId ? taskMap.get(task.parentTempId) : undefined; if (!parent || parent.hierarchyType === 'subtask') add({ code: 'SUBTASK_DEPTH_EXCEEDED', severity: 'error', repairable: false, message: 'Subtask 必须且只能指向顶层 Task。', entityId: task.tempId, evidence: task.parentTempId }) }
    task.dependencyTempIds.forEach((id) => { if (!taskMap.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `任务依赖不存在：${id}`, entityId: task.tempId, evidence: id }) })
    task.materialTempIds.forEach((id) => { if (!materials.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `材料引用不存在：${id}`, entityId: task.tempId, evidence: id }) })
    task.timePointTempIds.forEach((id) => { if (!timePoints.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `时间引用不存在：${id}`, entityId: task.tempId, evidence: id }) })
  })
  result.materials.forEach((item) => { checkEvidence(item.tempId, item.evidenceIds); item.relatedTaskTempIds.forEach((id) => { if (!taskMap.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `材料关联任务不存在：${id}`, entityId: item.tempId, evidence: id }) }) })
  result.timePoints.forEach((item) => {
    checkEvidence(item.tempId, item.evidenceIds)
    if ((item.normalizedValue && SENTINEL_DATE.test(item.normalizedValue)) || SENTINEL_DATE.test(item.rawText)) add({ code: 'FALSE_PRECISION', severity: 'error', repairable: true, message: '未知时间使用了哨兵日期。', entityId: item.tempId, evidence: item.normalizedValue })
    if ((item.precision === 'relative' || item.precision === 'vague') && (item.normalizedValue !== null || !item.needsConfirmation)) add({ code: 'FALSE_PRECISION', severity: 'error', repairable: true, message: '模糊或相对时间不得伪装为精确值。', entityId: item.tempId, evidence: item.rawText })
    if ((item.precision === 'relative' || item.precision === 'vague') && !result.ambiguities.some((ambiguity) => ambiguity.evidenceIds.some((id) => item.evidenceIds.includes(id)))) add({ code: 'MISSING_TIME_AMBIGUITY', severity: 'warning', repairable: true, message: '模糊时间缺少对应 Ambiguity。', entityId: item.tempId, evidence: item.rawText })
  })
  result.events.forEach((item) => { checkEvidence(item.tempId, item.evidenceIds); [item.startTimePointTempId, item.endTimePointTempId].filter(Boolean).forEach((id) => { if (!timePoints.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `Event 时间引用不存在：${id}`, entityId: item.tempId, evidence: id }) }) })
  const representedTimes = result.timePoints.map((item) => normalized(item.rawText))
  sourceTimeTokens(sourceContent).forEach((token) => { const key = normalized(token); if (key && !representedTimes.some((actual) => actual.includes(key) || key.includes(actual))) add({ code: 'MISSING_TIMEPOINT', severity: 'warning', repairable: true, message: '来源中存在未结构化的时间表达。', entityId: null, evidence: token }) })
  if (MATERIAL_CUE.test(sourceContent) && result.materials.length === 0) add({ code: 'MISSING_MATERIAL', severity: 'warning', repairable: true, message: '来源包含材料动作，但结果没有 Material。', entityId: null, evidence: null })
  if (EVENT_CUE.test(sourceContent) && result.events.length === 0) add({ code: 'MISSING_EVENT', severity: 'warning', repairable: true, message: '来源包含参加型安排，但结果没有 Event。', entityId: null, evidence: null })
  if (result.projectMatch.decision === 'new_project' && sourceTimeTokens(sourceContent).length >= 3 && result.milestones.length === 0) add({ code: 'MISSING_MILESTONE', severity: 'warning', repairable: true, message: '复杂新项目缺少可解释阶段。', entityId: null, evidence: null })
  const explicitActionCount = ACTION_VERBS.reduce((count, verb) => count + (sourceContent.match(new RegExp(verb, 'gu'))?.length ?? 0), 0)
  if (tasks.length > Math.max(5, explicitActionCount + 3)) add({ code: 'OVER_FRAGMENTATION', severity: 'warning', repairable: true, message: '任务数量明显高于来源中的动作数量。', entityId: null, evidence: String(tasks.length) })
  return { validatorVersion: RECOGNITION_VALIDATOR_VERSION, valid: !issues.some((issue) => issue.severity === 'error'), repairRecommended: issues.some((issue) => issue.repairable), issues }
}

export function annotateRecognitionQuality(result, report) {
  if (!report.issues.length) return result
  const reviewReasons = [...new Set([...result.quality.reviewReasons, ...report.issues.map((issue) => `${issue.code}: ${issue.message}`)])].slice(0, 20)
  return { ...result, quality: { ...result.quality, needsHumanReview: true, missingActionRisk: report.issues.some((issue) => issue.code === 'FALSE_ACTION') ? Math.max(result.quality.missingActionRisk, 0.8) : result.quality.missingActionRisk, overFragmentationRisk: report.issues.some((issue) => issue.code === 'OVER_FRAGMENTATION') ? Math.max(result.quality.overFragmentationRisk, 0.8) : result.quality.overFragmentationRisk, reviewReasons } }
}
