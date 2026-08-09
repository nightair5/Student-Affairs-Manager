export const RECOGNITION_VALIDATOR_VERSION = 'recognition-quality-2.1.0'

const SENTINEL_DATE = /(?:1970-01-01|1900-01-01|9999-12-31)/u
const DATE_TOKEN = /(?:(?:20\d{2}[年/.-])?\s*\d{1,2}\s*(?:月|[-/.])\s*\d{1,2}\s*(?:日|号)?|[一二三四五六七八九十]{1,3}月[一二三四五六七八九十]{1,3}[日号]?|今天|明天|后天|大后天|本周[一二三四五六日天]?|下周[一二三四五六日天]?|本月底|月底|月末|近期|稍后|另行通知|待定)(?:[^，。；\n]{0,24})/gu
const OBLIGATION_CUE = /(?:须|需|应|务必|请|要求|不可|不得|方可|逾期不|不再受理|窗口(?:将)?关闭|接收截至|受理至|以.+为准)/u
const ACTION_RELATION = /(?:提交|上传|填写|完成|准备|核对|确认|联系|阅读|下载|打印|盖章|签字|回复|领取|整理|撰写|制作|报名|携带|出示|汇报|预约|认证|报到|缴纳|选择|登记|寄送|送达|交验|核验|提供|报送|递交|申领|领取)/u
const MATERIAL_RELATION = /(?:准备|取得|获取|填写|制作|携带|出示|提交|上传|寄送|送达|交验|核验|提供|报送|递交|凭|自备|备妥)/u
const MATERIAL_OBJECT = /(?:资料|材料|附件|凭证|证件|文档|文件|作品|成果|表单|表格|清单|证明|报告|照片|截图|原件|复印件|电子版|纸质版|二维码|学生证|身份证|校园卡|申请书|承诺书|声明|成绩单|PPT|PDF|Word|Excel)/iu
const REFERENCE_ONLY = /(?:仅供参考|供查阅|无需提交|不用提交|不作为.+材料|只需阅读|无须携带)/u
const EVENT_CUE = /(?:参加|出席|到场)[^。；\n]{0,30}(?:会议|答辩|培训|面试|路演|活动|测试|考试|汇报)|(?:会议|答辩|培训|面试|路演|活动|测试|考试|汇报)[^。；\n]{0,30}(?:召开|举行|开始|安排|定于)/u
const INFORMATION_ONLY = /(?:仅供知悉|无需操作|不需要操作|不必处理|系统维护|开放时间说明)/u

function allTasks(result) {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)])]
}

function normalized(value) {
  return value.replace(/[\s，。；、:：前后内至到于]/gu, '').toLowerCase()
}

function sourceTimeTokens(sourceContent) {
  return [...sourceContent.matchAll(DATE_TOKEN)].map((match) => match[0].trim()).filter(Boolean)
}

function sourceSegments(sourceContent) { return sourceContent.split(/[。！？；\n]+/u).map((segment) => segment.trim()).filter(Boolean) }
function semanticActionSignals(sourceContent) { return sourceSegments(sourceContent).filter((segment) => !INFORMATION_ONLY.test(segment) && (ACTION_RELATION.test(segment) || (OBLIGATION_CUE.test(segment) && /[^\s，,：:]{2,}/u.test(segment)))) }
function hasMaterialObligation(sourceContent) { return sourceSegments(sourceContent).some((segment) => !REFERENCE_ONLY.test(segment) && MATERIAL_RELATION.test(segment) && MATERIAL_OBJECT.test(segment)) }

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
    if (!task.actionVerb.trim() || !task.actionObject.trim()) add({ code: 'FALSE_ACTION', severity: 'warning', repairable: false, message: '任务不满足“动作 + 明确对象”，需人工复核。', entityId: task.tempId, evidence: task.title })
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
  const actionSignals = semanticActionSignals(sourceContent)
  if (result.sourceSummary.requiresAction && actionSignals.length > 0 && tasks.length === 0) add({ code: 'MISSING_ACTION', severity: 'warning', repairable: false, message: '来源表达了用户义务或可执行动作，但结果没有 Task。', entityId: null, evidence: actionSignals[0] })
  if (hasMaterialObligation(sourceContent) && result.materials.length === 0) add({ code: 'MISSING_MATERIAL', severity: 'warning', repairable: true, message: '来源表达了需准备、取得、携带、提交或核验的对象，但结果没有 Material。', entityId: null, evidence: null })
  if (EVENT_CUE.test(sourceContent) && result.events.length === 0) add({ code: 'MISSING_EVENT', severity: 'warning', repairable: true, message: '来源包含参加型安排，但结果没有 Event。', entityId: null, evidence: null })
  if (result.projectMatch.decision === 'new_project' && sourceTimeTokens(sourceContent).length >= 3 && result.milestones.length === 0) add({ code: 'MISSING_MILESTONE', severity: 'warning', repairable: true, message: '复杂新项目缺少可解释阶段。', entityId: null, evidence: null })
  if (tasks.length > Math.max(5, actionSignals.length + 3)) add({ code: 'OVER_FRAGMENTATION', severity: 'warning', repairable: false, message: '任务数量明显高于来源中的语义动作单元，需人工复核。', entityId: null, evidence: String(tasks.length) })
  return { validatorVersion: RECOGNITION_VALIDATOR_VERSION, valid: !issues.some((issue) => issue.severity === 'error'), repairRecommended: issues.some((issue) => issue.repairable), issues }
}

export function annotateRecognitionQuality(result, report) {
  if (!report.issues.length) return result
  const reviewReasons = [...new Set([...result.quality.reviewReasons, ...report.issues.map((issue) => `${issue.code}: ${issue.message}`)])].slice(0, 20)
  return { ...result, quality: { ...result.quality, needsHumanReview: true, missingActionRisk: report.issues.some((issue) => issue.code === 'FALSE_ACTION' || issue.code === 'MISSING_ACTION') ? Math.max(result.quality.missingActionRisk, 0.8) : result.quality.missingActionRisk, overFragmentationRisk: report.issues.some((issue) => issue.code === 'OVER_FRAGMENTATION') ? Math.max(result.quality.overFragmentationRisk, 0.8) : result.quality.overFragmentationRisk, reviewReasons } }
}
