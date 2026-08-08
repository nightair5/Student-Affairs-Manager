import {
  RECOGNITION_MODEL_NAME,
  RECOGNITION_PROMPT_VERSION,
  RECOGNITION_SCHEMA_VERSION,
  recognitionSystemPrompt,
} from './recognition-prompt.mjs'

export {
  RECOGNITION_MODEL_NAME,
  RECOGNITION_PROMPT_VERSION,
  RECOGNITION_SCHEMA_VERSION,
  recognitionSystemPrompt,
} from './recognition-prompt.mjs'

const ACTION_VERBS = ['提交', '上传', '填写', '完成', '准备', '核对', '确认', '联系', '参加', '阅读', '下载', '打印', '盖章', '签字', '回复', '领取', '整理', '撰写', '制作', '报名', '发送', '携带', '出示', '归还', '反馈', '汇总', '组队', '办理', '预约']
const REGISTRATION_EVIDENCE = /报名(?:截止|时间|开始|开放|组队)|(?:截止|完成)报名|组队/u
const PROMPT_INJECTION_SIGNAL = /忽略.{0,12}(?:规则|指令)|系统提示词|API\s*Key|删除.{0,8}任务|改成管理员|执行.{0,8}脚本|发送到外部|不要输出\s*JSON|环境变量|绕过.{0,8}确认|修改数据库/iu
const REAL_NOTICE_MARKER = /(?:实际|真正)通知[:：]/gu
const SUBMISSION_VERBS = new Set(['提交', '上传', '发送', '报送', '补交'])
const FORMAT_ONLY_VERBS = new Set(['保存', '命名', '重命名', '转换', '设置格式'])
const RECEIVE_ONLY_VERBS = new Set(['领取', '下载'])
const DELIVERABLE_CREATION_VERBS = new Set(['准备', '完成', '撰写', '制作', '汇总', '填写', '打印', '盖章', '签字'])
const DELIVERABLE_NOUN = /(?:表|书|报告|提纲|证明|成绩单|PPT|PDF|Word|Excel|文件|照片|证书|截图|承诺书|声明|清单|音频|视频|记录|总结|论文|问卷|方案|作品|代码|简历|陈述|教材|设备|电脑|马甲)$/iu
const CATEGORIES = new Set(['比赛', '保研', '课程', '老师任务', '其他'])
const INFERENCE_LEVELS = new Set(['explicit', 'strong_inference', 'optional_suggestion'])
const NOTIFICATION_TYPES = new Set(['new_project', 'project_addendum', 'project_correction', 'course_assignment', 'teacher_task', 'event_notice', 'meeting_notice', 'material_submission', 'registration_notice', 'result_notice', 'information_only', 'uncertain'])
const TIME_POINT_TYPES = new Set(['registration_deadline', 'submission_deadline', 'task_deadline', 'event_start', 'event_end', 'result_announcement', 'planned_start'])

function text(value, limit, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, limit) : fallback
}

function number01(value, fallback = 0.5) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}

function strings(value, limit = 20, itemLimit = 160) {
  return Array.isArray(value) ? [...new Set(value.map((item) => text(item, itemLimit)).filter(Boolean))].slice(0, limit) : []
}

function field(value, fallback, allowedCategories = false) {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const candidate = typeof value === 'string' ? value : record.value
  const raw = allowedCategories && !CATEGORIES.has(candidate) ? '其他' : text(candidate, 300, fallback)
  return {
    value: raw,
    evidenceIds: strings(record.evidenceIds),
    confidence: number01(record.confidence),
    inferenceLevel: INFERENCE_LEVELS.has(record.inferenceLevel) ? record.inferenceLevel : 'strong_inference',
  }
}

function normalizeTask(value, index, evidenceIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  let title = text(value.title, 80)
    .replace(/^(?:各位同学|同学们|请大家|大家|请|务必|记得|麻烦|需要|要求)[:：，,、\s]*/u, '')
    .replace(/(?:请知悉|谢谢配合|谢谢|一下|哦|哈|呀|啦|！|!)+$/gu, '')
    .trim()
  const actionVerb = ACTION_VERBS.find((verb) => title.includes(verb)) || text(value.actionVerb, 20)
  if (actionVerb && !title.startsWith(actionVerb)) title = title.slice(title.indexOf(actionVerb))
  const actionObject = text(value.actionObject, 80) || (actionVerb ? title.slice(actionVerb.length).trim() : title)
  if (!title) return null
  const referencedEvidence = strings(value.evidenceIds).filter((id) => evidenceIds.has(id))
  const inferenceLevel = INFERENCE_LEVELS.has(value.inferenceLevel) ? value.inferenceLevel : referencedEvidence.length ? 'explicit' : 'optional_suggestion'
  return {
    tempId: text(value.tempId, 100, `task-${index + 1}`),
    parentTempId: value.parentTempId === null ? null : text(value.parentTempId, 100) || null,
    hierarchyType: value.hierarchyType === 'subtask' ? 'subtask' : 'task',
    title,
    actionVerb: actionVerb || '核对',
    actionObject: actionObject || title,
    description: text(value.description, 800, title),
    completionCriteria: strings(value.completionCriteria, 12, 160),
    estimatedMinutes: value.estimatedMinutes === null ? null : Number.isFinite(value.estimatedMinutes) ? Math.max(5, Math.min(10_080, Math.round(value.estimatedMinutes))) : 30,
    statusSuggestion: 'todo',
    prioritySuggestion: ['low', 'medium', 'high', 'urgent'].includes(value.prioritySuggestion) ? value.prioritySuggestion : 'medium',
    dependencyTempIds: strings(value.dependencyTempIds),
    materialTempIds: strings(value.materialTempIds),
    timePointTempIds: strings(value.timePointTempIds),
    evidenceIds: referencedEvidence,
    confidence: number01(value.confidence),
    inferenceLevel: actionVerb && actionObject && referencedEvidence.length ? inferenceLevel : 'optional_suggestion',
    userConfirmationRequired: true,
    selected: actionVerb && actionObject && referencedEvidence.length && inferenceLevel === 'explicit',
  }
}

export function normalizeRecognitionResult(raw, sourceContent, nowIso) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.schemaVersion !== '2.0') return null
  const rawEvidence = Array.isArray(raw.evidence) ? raw.evidence : []
  const evidence = rawEvidence.slice(0, 120).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const quote = text(item.quotedText || item.quote, 500)
    if (!quote || !sourceContent.includes(quote)) return []
    return [{ id: text(item.id, 100, `evidence-${index + 1}`), sourceId: 'pending-source', quote, quotedText: quote, field: ['title', 'deadline', 'materials', 'description', 'project', 'milestone', 'event', 'requirement'].includes(item.field) ? item.field : 'description', extractionMethod: 'ai', confidence: number01(item.confidence, 0.8) }]
  })
  const evidenceIds = new Set(evidence.map((item) => item.id))
  const normalizeTasks = (items, limit = 20) => Array.isArray(items) ? items.slice(0, limit).map((item, index) => normalizeTask(item, index, evidenceIds)).filter(Boolean) : []
  const milestones = (Array.isArray(raw.milestones) ? raw.milestones : []).slice(0, 10).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const workPackages = (Array.isArray(item.workPackages) ? item.workPackages : []).slice(0, 8).flatMap((workPackage, packageIndex) => {
      if (!workPackage || typeof workPackage !== 'object' || Array.isArray(workPackage)) return []
      return [{ tempId: text(workPackage.tempId, 100, `work-package-${index + 1}-${packageIndex + 1}`), title: text(workPackage.title || workPackage.name, 100, `工作包 ${packageIndex + 1}`), objective: text(workPackage.objective || workPackage.description, 300), order: Number.isFinite(workPackage.order) ? workPackage.order : packageIndex + 1, evidenceIds: strings(workPackage.evidenceIds).filter((id) => evidenceIds.has(id)), tasks: normalizeTasks(workPackage.tasks || workPackage.actions, 20) }]
    })
    return [{ tempId: text(item.tempId, 100, `milestone-${index + 1}`), title: text(item.title || item.name, 100, `阶段 ${index + 1}`), objective: text(item.objective || item.description, 300), order: Number.isFinite(item.order) ? item.order : index + 1, evidenceIds: strings(item.evidenceIds).filter((id) => evidenceIds.has(id)), workPackages, tasks: normalizeTasks(item.tasks || item.actions, 20) }]
  })
  let standaloneTasks = normalizeTasks(raw.standaloneTasks || raw.tasks, 20)
  const allTasks = () => [...standaloneTasks, ...milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)])]
  const seen = new Set()
  const duplicates = new Set()
  for (const task of allTasks()) {
    const key = `${task.actionVerb}|${task.actionObject}|${task.timePointTempIds.join(',')}`.toLowerCase()
    if (seen.has(key)) duplicates.add(task.tempId)
    else seen.add(key)
  }
  standaloneTasks = standaloneTasks.filter((task) => !duplicates.has(task.tempId))
  milestones.forEach((milestone) => {
    milestone.tasks = milestone.tasks.filter((task) => !duplicates.has(task.tempId))
    milestone.workPackages.forEach((workPackage) => { workPackage.tasks = workPackage.tasks.filter((task) => !duplicates.has(task.tempId)) })
  })
  let materials = (Array.isArray(raw.materials) ? raw.materials : []).slice(0, 60).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !text(item.name, 100)) return []
    return [{ tempId: text(item.tempId, 100, `material-${index + 1}`), name: text(item.name, 100), required: item.required !== false, formatRequirements: strings(item.formatRequirements, 10), namingRequirements: strings(item.namingRequirements, 10), quantity: Number.isFinite(item.quantity) ? Math.max(1, Math.min(100, Math.round(item.quantity))) : null, submissionChannel: text(item.submissionChannel, 100) || null, relatedTaskTempIds: strings(item.relatedTaskTempIds), evidenceIds: strings(item.evidenceIds).filter((id) => evidenceIds.has(id)), confidence: number01(item.confidence), selected: strings(item.evidenceIds).some((id) => evidenceIds.has(id)) }]
  })
  let timePoints = (Array.isArray(raw.timePoints) ? raw.timePoints : []).slice(0, 60).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !TIME_POINT_TYPES.has(item.type)) return []
    const normalizedValue = item.normalizedValue === null || !Number.isNaN(new Date(item.normalizedValue).getTime()) ? item.normalizedValue : null
    const linkedEvidence = strings(item.evidenceIds).filter((id) => evidenceIds.has(id))
    const needsConfirmation = Boolean(item.needsConfirmation) || normalizedValue === null
    return [{ tempId: text(item.tempId, 100, `time-${index + 1}`), type: item.type, rawText: text(item.rawText, 160), normalizedValue, timezone: text(item.timezone, 80, 'Asia/Shanghai'), isAllDay: Boolean(item.isAllDay), precision: ['exact', 'date_only', 'relative', 'vague'].includes(item.precision) ? item.precision : 'vague', needsConfirmation, relatedTaskTempIds: strings(item.relatedTaskTempIds), relatedMaterialTempIds: strings(item.relatedMaterialTempIds), evidenceIds: linkedEvidence, confidence: number01(item.confidence), selected: linkedEvidence.length > 0 && normalizedValue !== null && !needsConfirmation }]
  })
  let events = (Array.isArray(raw.events) ? raw.events : []).slice(0, 30).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !text(item.title, 100)) return []
    const linkedEvidence = strings(item.evidenceIds).filter((id) => evidenceIds.has(id))
    const inferenceLevel = INFERENCE_LEVELS.has(item.inferenceLevel) ? item.inferenceLevel : linkedEvidence.length ? 'explicit' : 'optional_suggestion'
    return [{ tempId: text(item.tempId, 100, `event-${index + 1}`), title: text(item.title, 100), description: text(item.description, 500), startTimePointTempId: text(item.startTimePointTempId, 100) || null, endTimePointTempId: text(item.endTimePointTempId, 100) || null, location: text(item.location, 160) || null, evidenceIds: linkedEvidence, confidence: number01(item.confidence), inferenceLevel, selected: inferenceLevel === 'explicit' && linkedEvidence.length > 0 }]
  })
  const rawMatch = raw.projectMatch && typeof raw.projectMatch === 'object' ? raw.projectMatch : {}
  const decision = ['new_project', 'existing_project', 'standalone_task', 'uncertain'].includes(rawMatch.decision) ? rawMatch.decision : 'uncertain'
  const sourceSummaryRaw = raw.sourceSummary && typeof raw.sourceSummary === 'object' ? raw.sourceSummary : {}
  const normalizeConflicts = (items) => Array.isArray(items) ? items.slice(0, 30).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const type = ['deadline', 'project_match', 'duplicate', 'hierarchy', 'other'].includes(item.type) ? item.type : 'other'
    const message = text(item.message || item.description, 500)
    if (!message) return []
    return [{
      id: text(item.id || item.tempId, 100, `conflict-${index + 1}`),
      type,
      message,
      entityTempIds: strings(item.entityTempIds || item.relatedTempIds),
      evidenceIds: strings(item.evidenceIds).filter((id) => evidenceIds.has(id)),
      requiresDecision: item.requiresDecision !== false,
    }]
  }) : []
  const normalizeAmbiguities = (items) => Array.isArray(items) ? items.slice(0, 30).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const fieldName = text(item.field || item.subject || item.type, 100)
    const message = text(item.message || item.description, 500)
    if (!fieldName || !message) return []
    return [{
      id: text(item.id || item.tempId, 100, `ambiguity-${index + 1}`),
      field: fieldName,
      message,
      options: strings(item.options, 12),
      evidenceIds: strings(item.evidenceIds).filter((id) => evidenceIds.has(id)),
    }]
  }) : []
  const normalizeIgnoredContent = (items) => Array.isArray(items) ? items.slice(0, 30).flatMap((item) => {
    if (typeof item === 'string') return text(item, 500) ? [{ text: text(item, 500), reason: 'other' }] : []
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const ignoredText = text(item.text || item.content, 500)
    if (!ignoredText) return []
    const reason = ['background', 'contact', 'address', 'policy', 'format_requirement', 'other'].includes(item.reason) ? item.reason : 'other'
    return [{ text: ignoredText, reason }]
  }) : []
  const markerMatches = [...sourceContent.matchAll(REAL_NOTICE_MARKER)]
  const lastMarker = markerMatches.at(-1)
  const markerEnd = lastMarker ? (lastMarker.index ?? 0) + lastMarker[0].length : -1
  const trustedActionContent = markerEnd >= 0 && PROMPT_INJECTION_SIGNAL.test(sourceContent.slice(0, markerEnd))
    ? sourceContent.slice(markerEnd)
    : sourceContent
  const explicitActionInSource = ACTION_VERBS.some((verb) => trustedActionContent.includes(verb))
  const informationOnly = sourceSummaryRaw.notificationType === 'information_only' || (sourceSummaryRaw.requiresAction === false && !explicitActionInSource)
  const evidenceById = new Map(evidence.map((item) => [item.id, item]))
  const splitTaskIds = new Map()
  const splitSubmissionTask = (task) => {
    if (!SUBMISSION_VERBS.has(task.actionVerb)) return [task]
    const linkedMaterials = materials.filter((material) => task.materialTempIds.includes(material.tempId) && task.actionObject.includes(material.name))
    if (linkedMaterials.length < 2) return [task]
    const split = linkedMaterials.map((material, index) => ({
      ...task,
      tempId: index === 0 ? task.tempId : `${task.tempId}-part-${index + 1}`,
      title: `${task.actionVerb}${material.name}`,
      actionObject: material.name,
      materialTempIds: [material.tempId],
    }))
    splitTaskIds.set(task.tempId, split.map((item) => item.tempId))
    return split
  }
  standaloneTasks = standaloneTasks.flatMap(splitSubmissionTask)
  milestones.forEach((milestone) => {
    milestone.tasks = milestone.tasks.flatMap(splitSubmissionTask)
    milestone.workPackages.forEach((workPackage) => { workPackage.tasks = workPackage.tasks.flatMap(splitSubmissionTask) })
  })
  if (splitTaskIds.size > 0) {
    const expandIds = (ids) => [...new Set(ids.flatMap((id) => splitTaskIds.get(id) || [id]))]
    materials = materials.map((material) => ({ ...material, relatedTaskTempIds: expandIds(material.relatedTaskTempIds) }))
    timePoints = timePoints.map((timePoint) => ({ ...timePoint, relatedTaskTempIds: expandIds(timePoint.relatedTaskTempIds) }))
  }
  for (const task of allTasks()) {
    if (task.materialTempIds.length > 0 || !DELIVERABLE_CREATION_VERBS.has(task.actionVerb) || !DELIVERABLE_NOUN.test(task.actionObject)) continue
    const tempId = `material-from-${task.tempId}`
    materials.push({
      tempId,
      name: task.actionObject,
      required: true,
      formatRequirements: [],
      namingRequirements: [],
      quantity: null,
      submissionChannel: null,
      relatedTaskTempIds: [task.tempId],
      evidenceIds: [...task.evidenceIds],
      confidence: task.confidence,
      selected: task.evidenceIds.length > 0,
    })
    task.materialTempIds = [tempId]
  }
  const currentTasks = allTasks()
  const hasSupportedAction = (task) => task.evidenceIds.some((id) => {
    const quote = evidenceById.get(id)?.quotedText || ''
    return quote.includes(task.actionVerb)
  })
  const hasTrustedEvidence = (task) => task.evidenceIds.some((id) => trustedActionContent.includes(evidenceById.get(id)?.quotedText || ''))
  const sharesContext = (left, right) => left.evidenceIds.some((id) => right.evidenceIds.includes(id))
    || left.materialTempIds.some((id) => right.materialTempIds.includes(id))
    || left.timePointTempIds.some((id) => right.timePointTempIds.includes(id))
  const eventSupportsTask = (task) => task.actionVerb === '参加' && events.some((event) =>
    event.evidenceIds.some((id) => task.evidenceIds.includes(id))
      || event.title.includes(task.actionObject)
      || task.actionObject.includes(event.title))
  const keepTask = (task) => {
    if (informationOnly || !hasTrustedEvidence(task) || FORMAT_ONLY_VERBS.has(task.actionVerb) || eventSupportsTask(task)) return false
    if (hasSupportedAction(task)) return true
    return !currentTasks.some((candidate) => candidate.tempId !== task.tempId
      && SUBMISSION_VERBS.has(candidate.actionVerb)
      && hasSupportedAction(candidate)
      && sharesContext(task, candidate))
  }
  standaloneTasks = standaloneTasks.filter(keepTask)
  milestones.forEach((milestone) => {
    milestone.tasks = milestone.tasks.filter(keepTask)
    milestone.workPackages.forEach((workPackage) => { workPackage.tasks = workPackage.tasks.filter(keepTask) })
  })
  const survivingTasks = allTasks()
  const survivingTaskIds = new Set(survivingTasks.map((task) => task.tempId))
  if (informationOnly) {
    materials = []
    timePoints = []
    events = []
  } else {
    materials = materials.filter((material) => {
      const relatedTasks = survivingTasks.filter((task) => material.relatedTaskTempIds.includes(task.tempId))
      return relatedTasks.length === 0 || relatedTasks.some((task) => !RECEIVE_ONLY_VERBS.has(task.actionVerb))
    }).map((material) => ({ ...material, relatedTaskTempIds: material.relatedTaskTempIds.filter((id) => survivingTaskIds.has(id)) }))
    const materialIds = new Set(materials.map((material) => material.tempId))
    const eventTimeIds = new Set(events.flatMap((event) => [event.startTimePointTempId, event.endTimePointTempId]).filter(Boolean))
    timePoints = timePoints.map((timePoint) => {
      const relatedTasks = survivingTasks.filter((task) => timePoint.relatedTaskTempIds.includes(task.tempId))
      const relatedEvidenceText = timePoint.evidenceIds.map((id) => evidenceById.get(id)?.quotedText || '').join(' ')
      let type = timePoint.type
      if (!eventTimeIds.has(timePoint.tempId) && !['result_announcement', 'planned_start'].includes(type) && relatedTasks.length > 0) {
        if (relatedTasks.some((task) => task.actionVerb === '报名' || task.actionVerb === '组队') || REGISTRATION_EVIDENCE.test(relatedEvidenceText)) type = 'registration_deadline'
        else if (relatedTasks.some((task) => SUBMISSION_VERBS.has(task.actionVerb))) type = 'submission_deadline'
        else type = 'task_deadline'
      }
      let rawText = timePoint.rawText
      if (rawText && sourceContent.includes(`${rawText}前`) && !rawText.endsWith('前')) rawText = `${rawText}前`
      const normalizedValue = timePoint.precision === 'date_only' && typeof timePoint.normalizedValue === 'string'
        ? timePoint.normalizedValue.match(/^\d{4}-\d{2}-\d{2}/u)?.[0] || timePoint.normalizedValue
        : timePoint.normalizedValue
      return {
        ...timePoint,
        type,
        rawText,
        normalizedValue,
        isAllDay: timePoint.precision === 'date_only' ? true : timePoint.isAllDay,
        relatedTaskTempIds: timePoint.relatedTaskTempIds.filter((id) => survivingTaskIds.has(id)),
        relatedMaterialTempIds: timePoint.relatedMaterialTempIds.filter((id) => materialIds.has(id)),
      }
    })
    const timePointIds = new Set(timePoints.map((timePoint) => timePoint.tempId))
    events = events.map((event) => ({
      ...event,
      startTimePointTempId: event.startTimePointTempId && timePointIds.has(event.startTimePointTempId) ? event.startTimePointTempId : null,
      endTimePointTempId: event.endTimePointTempId && timePointIds.has(event.endTimePointTempId) ? event.endTimePointTempId : null,
    }))
    const taskMaterialIds = new Set(materials.map((material) => material.tempId))
    const taskTimeIds = new Set(timePoints.map((timePoint) => timePoint.tempId))
    const normalizeTaskReferences = (task) => ({ ...task, materialTempIds: task.materialTempIds.filter((id) => taskMaterialIds.has(id)), timePointTempIds: task.timePointTempIds.filter((id) => taskTimeIds.has(id)) })
    standaloneTasks = standaloneTasks.map(normalizeTaskReferences)
    milestones.forEach((milestone) => {
      milestone.tasks = milestone.tasks.map(normalizeTaskReferences)
      milestone.workPackages.forEach((workPackage) => { workPackage.tasks = workPackage.tasks.map(normalizeTaskReferences) })
    })
  }
  const taskCount = allTasks().filter((task) => task.hierarchyType === 'task').length
  const subtaskCount = allTasks().filter((task) => task.hierarchyType === 'subtask').length
  const overFragmented = taskCount > 20 || subtaskCount > 40
  const qualityRaw = raw.quality && typeof raw.quality === 'object' ? raw.quality : {}
  if (overFragmented) allTasks().forEach((task) => { task.selected = false })
  return {
    schemaVersion: '2.0', promptVersion: RECOGNITION_PROMPT_VERSION, modelName: RECOGNITION_MODEL_NAME, createdAt: text(raw.createdAt, 80, nowIso),
    sourceSummary: { title: text(sourceSummaryRaw.title, 160, '未命名来源'), sourceType: text(sourceSummaryRaw.sourceType, 30, 'text'), notificationType: NOTIFICATION_TYPES.has(sourceSummaryRaw.notificationType) ? sourceSummaryRaw.notificationType : 'uncertain', summary: text(sourceSummaryRaw.summary, 800), requiresAction: Boolean(sourceSummaryRaw.requiresAction), actionReason: text(sourceSummaryRaw.actionReason, 300) },
    projectMatch: { decision, matchedProjectId: text(rawMatch.matchedProjectId, 100) || null, suggestedProjectTitle: text(rawMatch.suggestedProjectTitle, 160) || null, confidence: number01(rawMatch.confidence), reasons: strings(rawMatch.reasons, 12) },
    projectSuggestion: raw.projectSuggestion && typeof raw.projectSuggestion === 'object' ? { title: field(raw.projectSuggestion.title, text(rawMatch.suggestedProjectTitle || sourceSummaryRaw.title, 160, '未命名项目')), category: field(raw.projectSuggestion.category, '其他', true), objective: field(raw.projectSuggestion.objective, ''), description: field(raw.projectSuggestion.description, '') } : null,
    milestones, standaloneTasks, materials, timePoints, events, evidence,
    conflicts: informationOnly ? [] : normalizeConflicts(raw.conflicts), ambiguities: informationOnly ? [] : normalizeAmbiguities(raw.ambiguities), ignoredContent: normalizeIgnoredContent(raw.ignoredContent),
    quality: { overallConfidence: number01(qualityRaw.overallConfidence), hierarchyConfidence: number01(qualityRaw.hierarchyConfidence), dateConfidence: number01(qualityRaw.dateConfidence), evidenceCoverage: number01(qualityRaw.evidenceCoverage), duplicateRisk: Math.max(number01(qualityRaw.duplicateRisk, 0), duplicates.size / Math.max(1, taskCount)), overFragmentationRisk: overFragmented ? 1 : number01(qualityRaw.overFragmentationRisk, 0), missingActionRisk: number01(qualityRaw.missingActionRisk, 0), needsHumanReview: Boolean(qualityRaw.needsHumanReview) || overFragmented || decision === 'uncertain', reviewReasons: [...new Set([...strings(qualityRaw.reviewReasons, 20), ...(duplicates.size ? ['存在重复任务，已从默认结果中合并'] : []), ...(overFragmented ? ['任务数量超过安全阈值，可能拆分过细'] : []), ...(decision === 'uncertain' ? ['项目归属不确定'] : [])])] },
  }
}
