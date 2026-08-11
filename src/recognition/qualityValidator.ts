import type { RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2 } from './types'

export const RECOGNITION_VALIDATOR_VERSION = 'recognition-quality-2.2.0'

export type RecognitionQualityIssueCode =
  | 'MISSING_TASK'
  | 'MISSING_MATERIAL'
  | 'MISSING_TIMEPOINT'
  | 'WRONG_TIME_ROLE'
  | 'POSSIBLE_FALSE_PRECISION'
  | 'MISSING_AMBIGUITY'
  | 'EVENT_TASK_CONFUSION'
  | 'MATERIAL_TASK_CONFUSION'
  | 'POSSIBLE_FALSE_ACTION'
  | 'INVALID_EVIDENCE'
  | 'INVALID_REFERENCE'
  | 'OVER_FRAGMENTATION'
  | 'OVER_MERGING'
  | 'DUPLICATE_ID'
  | 'SUBTASK_DEPTH_EXCEEDED'
  // Legacy repair codes remain in the type until the P8 repair ablation.
  | 'MISSING_EVIDENCE'
  | 'FALSE_PRECISION'
  | 'MISSING_TIME_AMBIGUITY'
  | 'MISSING_EVENT'
  | 'MISSING_ACTION'
  | 'FALSE_ACTION'
  | 'MISSING_MILESTONE'

export interface RecognitionQualityIssue {
  code: RecognitionQualityIssueCode
  severity: 'warning' | 'error'
  repairable: boolean
  message: string
  entityId: string | null
  evidence: string | null
}

export interface RecognitionQualityReport {
  validatorVersion: typeof RECOGNITION_VALIDATOR_VERSION
  valid: boolean
  repairRecommended: boolean
  issues: RecognitionQualityIssue[]
}

const SENTINEL_DATE = /(?:1970-01-01|1900-01-01|9999-12-31)/u
const DATE_TOKEN = /(?:(?:20\d{2}年)?\s*\d{1,2}\s*(?:月|[-/.])\s*\d{1,2}\s*(?:日|号)?|[一二三四五六七八九十]{1,3}月[一二三四五六七八九十]{1,3}[日号]?|今天|明天|后天|大后天|本周[一二三四五六日天]?|下周[一二三四五六日天]?|本月底|本月末|月底|月末|近期|稍后|另行通知|待定)(?:[^，。；\n]{0,24})/gu
const TIME_CUE = /(?:下周|本周|第[一二三四五六七八九十\d]+周|具体时段|时间表尚未公布|时间双方商定|具体哪天|另行通知|待定)/u
const MATERIAL_OBJECT = /(?:资料|材料|附件|凭证|证件|文档|文件|作品|成果|表单|表格|清单|名单|证明|报告|初稿|定稿|反思|问题|照片|截图|原件|复印件|电子版|纸质版|二维码|学生证|身份证|校园卡|申请书|承诺书|声明|成绩单|PPT|PDF|Word|Excel|源代码|说明书|节目单|档案袋)/iu
const EVENT_NOUN = /(?:面谈|访谈|测试|复核|会议|答辩|培训|面试|路演|活动|汇报|例会|交流|演出|走台|验收|补测)/u
const REFERENCE_ONLY = /(?:仅供参考|供查询|无需提交|不用提交|不作为办理材料|只需阅读|无须携带|无需[^，。；]{0,8}准备)/u

function allTasks(result: RecognitionResult): TaskSuggestionV2[] {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [
    ...milestone.tasks,
    ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
  ])]
}

function compact(value: string): string {
  return value.replace(/[\s，。；、：:（）()《》“”"'前后内至到]/gu, '').toLowerCase()
}

function sourceSegments(sourceContent: string): string[] {
  return sourceContent.split(/[。！？；，,\n]+/u).map((segment) => segment.trim()).filter(Boolean)
}

function segmentForRaw(sourceContent: string, rawText: string): string {
  const direct = sourceSegments(sourceContent).find((segment) => segment.includes(rawText))
  if (direct) return direct
  const raw = compact(rawText)
  return sourceSegments(sourceContent).find((segment) => compact(segment).includes(raw)) ?? sourceContent
}

function sourceTimeTokens(sourceContent: string): string[] {
  return [...sourceContent.matchAll(DATE_TOKEN)].map((match) => match[0].trim()).filter(Boolean)
}

function taskText(task: TaskSuggestionV2): string {
  return `${task.title} ${task.actionVerb} ${task.actionObject}`
}

function ambiguityText(result: RecognitionResult): string {
  return result.ambiguities.map((item) => `${item.field} ${item.message}`).join(' ')
}

function expectedTimeRole(
  sourceContent: string,
  item: TimePointSuggestionV2,
): TimePointSuggestionV2['type'] | 'not_time' | null {
  const segment = segmentForRaw(sourceContent, item.rawText)
  if (/另行通知/u.test(item.rawText) && /(?:地点|教室|场地)[^，。；]{0,8}另行通知/u.test(segment)) return 'not_time'
  if (/(?:报名受理|报名截止|停止报名|填写报名(?:信息|问卷)|完成报名|报名组队|报名参赛|组队)/u.test(segment)) return 'registration_deadline'
  if (/(?:提交|上传|报送|交付|补交|收件|填写[^，。；]{0,10}(?:申请表|确认表))/u.test(segment)) return 'submission_deadline'
  if (!/回复是否参加/u.test(segment) && /(?:参加|举行|进行|面试|培训|答辩|交流|汇报|测试|复核|验收|补测)/u.test(segment)) return 'event_start'
  if (item.type === 'task_deadline' && /(?:日至|日到|—|-)/u.test(item.rawText) && !/(?:截止|前)/u.test(segment)) return 'planned_start'
  if (item.type === 'task_deadline' && /近期/u.test(item.rawText) && /(?:联系|预约)/u.test(segment)) return 'planned_start'
  return null
}

function missingActionEvidence(sourceContent: string, tasks: TaskSuggestionV2[]): string[] {
  const text = tasks.map(taskText).join(' ')
  const missing: string[] = []
  const check = (sourcePattern: RegExp, taskPattern: RegExp) => {
    const segment = sourceSegments(sourceContent).find((value) => sourcePattern.test(value))
    if (segment && !taskPattern.test(text)) missing.push(segment)
  }
  check(/(?:自备)[^，。；]{1,24}/u, /(?:自备|携带|带上)/u)
  check(/(?:需|须|并)?(?:携带|带)(?!来)[^，。；]{1,24}/u, /(?:携带|带上|自备)/u)
  check(/出示[^，。；]{1,24}/u, /出示/u)
  check(/复核[^，。；]{0,30}(?:并|后).{0,12}提交/u, /复核/u)
  check(/回复是否参加/u, /回复/u)
  check(/(?:完成)?签到/u, /签到/u)
  check(/各[^，。；]{0,16}(?:日前|前)报名/u, /(?:报名|填写报名)/u)
  return [...new Set(missing)]
}

function taskHasCoveredMaterial(task: TaskSuggestionV2, result: RecognitionResult): boolean {
  if (!MATERIAL_OBJECT.test(task.actionObject) && !MATERIAL_OBJECT.test(task.title)) return true
  if (/(?:资料|材料|文件|申请材料|报销材料)$/u.test(task.actionObject.trim())) return result.materials.length > 0
  return result.materials.some((material) => {
    const materialName = compact(material.name)
    const object = compact(`${task.actionObject}${task.title}`)
    return materialName.length >= 2 && (object.includes(materialName) || materialName.includes(object))
  })
}

function hasMissingMaterial(result: RecognitionResult, sourceContent: string, tasks: TaskSuggestionV2[]): string | null {
  for (const task of tasks) {
    if (/(?:提交|报送|上传|补交|携带|出示|准备)/u.test(task.actionVerb) && !taskHasCoveredMaterial(task, result)) return task.title
  }
  const container = sourceContent.match(/装入([^，。；]{1,12}(?:袋|盒|夹))/u)?.[1]
  if (container && !result.materials.some((material) => compact(container).includes(compact(material.name)) || compact(material.name).includes(compact(container)))) return container
  if (result.sourceSummary.requiresAction
    && result.materials.length === 0
    && !REFERENCE_ONLY.test(sourceContent)
    && /(?:提交|上传|报送|补交|携带|出示|须凭|需凭|准备)/u.test(sourceContent)
    && MATERIAL_OBJECT.test(sourceContent)) return sourceContent
  return null
}

function hasConditionAmbiguityGap(sourceContent: string, result: RecognitionResult): boolean {
  const sourceCondition = sourceContent.match(/(?:入选同学|入围团队|录用者|进入复赛的团队|入围陈述)/u)?.[0]
  if (!sourceCondition) return false
  const text = ambiguityText(result)
  const conditionRoot = sourceCondition.replace(/(?:同学|团队|者|陈述)/gu, '')
  return !text.includes(conditionRoot) && !/(?:仅限|是否).{0,12}(?:团队|参与者|同学)/u.test(text)
}

function hasCorrectionAmbiguityGap(sourceContent: string, result: RecognitionResult): boolean {
  if (!/(?:更正|调整至|延长到|原[^，。；]{0,16}现|材料不变[^，。；]{0,16}新增|补交截止)/u.test(sourceContent)) return false
  return !/(?:更正|调整|延长|原定|原收件|新增|补交|新旧)/u.test(ambiguityText(result))
}

function hasUncertainEventAmbiguityGap(sourceContent: string, result: RecognitionResult): boolean {
  if (result.timePoints.length > 0) return false
  if (!EVENT_NOUN.test(sourceContent) || !TIME_CUE.test(sourceContent)) return false
  return !/(?:时间|时段|日期|哪天|尚未|未定|通知|商定)/u.test(ambiguityText(result))
}

export function validateRecognitionQuality(
  result: RecognitionResult,
  sourceContent: string,
): RecognitionQualityReport {
  const issues: RecognitionQualityIssue[] = []
  const seen = new Set<string>()
  const add = (issue: RecognitionQualityIssue) => {
    const key = `${issue.code}:${issue.entityId ?? ''}:${issue.evidence ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      issues.push(issue)
    }
  }
  const tasks = allTasks(result)
  const materials = new Map(result.materials.map((item) => [item.tempId, item]))
  const timePoints = new Map(result.timePoints.map((item) => [item.tempId, item]))
  const evidence = new Map(result.evidence.map((item) => [item.id, item]))
  const taskMap = new Map(tasks.map((item) => [item.tempId, item]))
  const ids = [
    ...tasks.map((item) => item.tempId),
    ...result.materials.map((item) => item.tempId),
    ...result.timePoints.map((item) => item.tempId),
    ...result.events.map((item) => item.tempId),
    ...result.milestones.map((item) => item.tempId),
    ...result.milestones.flatMap((item) => item.workPackages.map((workPackage) => workPackage.tempId)),
    ...result.evidence.map((item) => item.id),
  ]
  const idSet = new Set<string>()
  ids.forEach((id) => {
    if (idSet.has(id)) add({ code: 'DUPLICATE_ID', severity: 'error', repairable: false, message: `ID 重复：${id}`, entityId: id, evidence: null })
    idSet.add(id)
  })

  const checkEvidence = (entityId: string, evidenceIds: string[]) => {
    if (!evidenceIds.length) add({ code: 'INVALID_EVIDENCE', severity: 'error', repairable: true, message: '实体缺少来源证据。', entityId, evidence: null })
    evidenceIds.forEach((id) => {
      if (!evidence.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `证据引用不存在：${id}`, entityId, evidence: id })
    })
  }
  result.evidence.forEach((item) => {
    const quote = item.quotedText || item.quote || ''
    if (!quote || !sourceContent.includes(quote)) add({ code: 'INVALID_EVIDENCE', severity: 'error', repairable: false, message: '证据不是来源正文中的连续逐字段落。', entityId: item.id, evidence: quote || null })
  })
  result.milestones.forEach((item) => {
    checkEvidence(item.tempId, item.evidenceIds)
    item.workPackages.forEach((workPackage) => checkEvidence(workPackage.tempId, workPackage.evidenceIds))
  })
  tasks.forEach((task) => {
    checkEvidence(task.tempId, task.evidenceIds)
    if (!task.actionVerb.trim() || !task.actionObject.trim()) {
      add({ code: 'POSSIBLE_FALSE_ACTION', severity: 'warning', repairable: false, message: '任务不满足“动作 + 明确对象”，需人工复核。', entityId: task.tempId, evidence: task.title })
    }
    if (task.hierarchyType === 'subtask') {
      const parent = task.parentTempId ? taskMap.get(task.parentTempId) : undefined
      if (!parent || parent.hierarchyType === 'subtask') add({ code: 'SUBTASK_DEPTH_EXCEEDED', severity: 'error', repairable: false, message: 'Subtask 必须且只能指向顶层 Task。', entityId: task.tempId, evidence: task.parentTempId })
    }
    task.dependencyTempIds.forEach((id) => {
      if (!taskMap.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `任务依赖不存在：${id}`, entityId: task.tempId, evidence: id })
    })
    task.materialTempIds.forEach((id) => {
      if (!materials.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `材料引用不存在：${id}`, entityId: task.tempId, evidence: id })
    })
    task.timePointTempIds.forEach((id) => {
      if (!timePoints.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `时间引用不存在：${id}`, entityId: task.tempId, evidence: id })
    })
  })
  result.materials.forEach((item) => {
    checkEvidence(item.tempId, item.evidenceIds)
    item.relatedTaskTempIds.forEach((id) => {
      if (!taskMap.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `材料关联任务不存在：${id}`, entityId: item.tempId, evidence: id })
    })
  })
  result.timePoints.forEach((item) => {
    checkEvidence(item.tempId, item.evidenceIds)
    if ((item.normalizedValue && SENTINEL_DATE.test(item.normalizedValue)) || SENTINEL_DATE.test(item.rawText)
      || ((item.precision === 'relative' || item.precision === 'vague') && (item.normalizedValue !== null || !item.needsConfirmation))) {
      add({ code: 'POSSIBLE_FALSE_PRECISION', severity: 'error', repairable: true, message: '模糊、相对或未知时间可能被伪装为精确值。', entityId: item.tempId, evidence: item.rawText })
    }
    const expectedRole = expectedTimeRole(sourceContent, item)
    if (expectedRole && (expectedRole === 'not_time' || item.type !== expectedRole)) {
      add({ code: 'WRONG_TIME_ROLE', severity: 'warning', repairable: false, message: `时间表达与上下文角色不一致；上下文指向 ${expectedRole}。`, entityId: item.tempId, evidence: item.rawText })
    }
  })
  result.events.forEach((item) => {
    checkEvidence(item.tempId, item.evidenceIds)
    for (const id of [item.startTimePointTempId, item.endTimePointTempId].filter((value): value is string => Boolean(value))) {
      if (!timePoints.has(id)) add({ code: 'INVALID_REFERENCE', severity: 'error', repairable: false, message: `Event 时间引用不存在：${id}`, entityId: item.tempId, evidence: id })
    }
  })

  if (result.timePoints.length === 0) {
    const timeTokens = sourceTimeTokens(sourceContent)
    const missingScheduledEventTime = EVENT_NOUN.test(sourceContent) && TIME_CUE.test(sourceContent)
    if ((result.sourceSummary.requiresAction && timeTokens.length > 0) || missingScheduledEventTime) {
      add({ code: 'MISSING_TIMEPOINT', severity: 'warning', repairable: true, message: '来源中存在未结构化的时间表达。', entityId: null, evidence: timeTokens[0] ?? sourceContent })
    }
  }

  const missingActions = missingActionEvidence(sourceContent, tasks)
  const distinctMaterialActionsMerged = /(?:出示)[^，。；]{1,20}(?:并|及)(?:交|提交)/u.test(sourceContent)
    && tasks.length <= 1
    && !tasks.some((task) => /(?:出示|提交|交付)/u.test(taskText(task)))
  if (missingActions.length && !distinctMaterialActionsMerged) add({ code: 'MISSING_TASK', severity: 'warning', repairable: false, message: '来源中的独立用户行动没有对应 Task。', entityId: null, evidence: missingActions[0] })
  if (result.sourceSummary.requiresAction && tasks.length === 0 && /(?:须|应|请|窗口[^，。；]{0,16}关闭|逾期[^，。；]{0,16}不再受理)/u.test(sourceContent)) {
    add({ code: 'MISSING_TASK', severity: 'warning', repairable: false, message: '来源表达了用户义务，但结果没有 Task。', entityId: null, evidence: sourceContent })
  }
  if (missingActions.some((value) => /(?:携带|带|出示)/u.test(value)) && result.materials.length > 0) {
    add({ code: 'MATERIAL_TASK_CONFUSION', severity: 'warning', repairable: false, message: '材料已被发现，但携带或出示行动没有正确组织为 Task。', entityId: null, evidence: missingActions.find((value) => /(?:携带|带|出示)/u.test(value)) ?? null })
  }
  const missingMaterial = hasMissingMaterial(result, sourceContent, tasks)
  if (missingMaterial) add({ code: 'MISSING_MATERIAL', severity: 'warning', repairable: true, message: '明确业务材料未进入 Material 列表。', entityId: null, evidence: missingMaterial })

  tasks.forEach((task) => {
    const text = taskText(task)
    if ((/查看.{0,8}附件/u.test(text) && !/(?:请|需|须).{0,8}(?:查看|阅读).{0,8}附件/u.test(sourceContent))
      || /报名(?:开放|截止时间)/u.test(text)
      || (/^(?:参加|参加活动)$/u.test(task.title.trim()) && /回复是否参加/u.test(sourceContent))
      || (/准备.{0,12}问题清单/u.test(text) && /带.{0,12}问题清单/u.test(sourceContent))) {
      add({ code: 'POSSIBLE_FALSE_ACTION', severity: 'warning', repairable: false, message: '输出 Task 可能把状态、参考信息或不同动作误写为用户行动。', entityId: task.tempId, evidence: task.title })
    }
  })

  const noEventForScheduledActivity = result.events.length === 0
    && /(?:面谈预计|体育测试安排|预约访谈|会复核|参加[^，。；]{0,20}(?:培训|面试|答辩|会议|活动|汇报|测试))/u.test(sourceContent)
  const signInOnlyInEvent = /签到/u.test(sourceContent)
    && !tasks.some((task) => /签到/u.test(taskText(task)))
    && result.events.some((event) => /签到/u.test(event.title))
  const duplicateEventTask = result.events.some((event) => tasks.some((task) => {
    const eventTitle = compact(event.title)
    const title = compact(task.title)
    return /(?:参加|集合|上岗)/u.test(taskText(task))
      && eventTitle.length >= 4
      && title.length >= 4
      && (eventTitle.includes(title) || title.includes(eventTitle))
  }))
  if (noEventForScheduledActivity || signInOnlyInEvent || duplicateEventTask) {
    add({ code: 'EVENT_TASK_CONFUSION', severity: 'warning', repairable: true, message: 'Event 与用户可执行 Task 的边界可能错误。', entityId: null, evidence: null })
  }

  if (distinctMaterialActionsMerged) {
    add({ code: 'OVER_MERGING', severity: 'warning', repairable: false, message: '多个独立动作被合并为笼统 Task。', entityId: tasks[0]?.tempId ?? null, evidence: sourceContent })
    add({ code: 'MATERIAL_TASK_CONFUSION', severity: 'warning', repairable: false, message: '材料对应的出示与提交动作边界丢失。', entityId: tasks[0]?.tempId ?? null, evidence: sourceContent })
  }

  if (hasConditionAmbiguityGap(sourceContent, result)
    || hasCorrectionAmbiguityGap(sourceContent, result)
    || hasUncertainEventAmbiguityGap(sourceContent, result)) {
    add({ code: 'MISSING_AMBIGUITY', severity: 'warning', repairable: true, message: '条件、更正或待定事件缺少对应 Ambiguity。', entityId: null, evidence: null })
  }

  const sourceActionCount = sourceSegments(sourceContent).filter((segment) => !REFERENCE_ONLY.test(segment) && /(?:提交|上传|填写|完成|准备|携带|出示|回复|报名|领取|签到|复核)/u.test(segment)).length
  if (tasks.length > Math.max(5, sourceActionCount + 3)) add({ code: 'OVER_FRAGMENTATION', severity: 'warning', repairable: false, message: '任务数量明显高于来源中的语义动作单元，需人工复核。', entityId: null, evidence: String(tasks.length) })

  return {
    validatorVersion: RECOGNITION_VALIDATOR_VERSION,
    valid: !issues.some((issue) => issue.severity === 'error'),
    repairRecommended: issues.some((issue) => issue.repairable),
    issues,
  }
}

export function annotateRecognitionQuality(
  result: RecognitionResult,
  report: RecognitionQualityReport,
): RecognitionResult {
  if (!report.issues.length) return result
  const reviewReasons = [...new Set([
    ...result.quality.reviewReasons,
    ...report.issues.map((issue) => `${issue.code}: ${issue.message}`),
  ])].slice(0, 20)
  return {
    ...result,
    quality: {
      ...result.quality,
      needsHumanReview: true,
      missingActionRisk: report.issues.some((issue) => issue.code === 'POSSIBLE_FALSE_ACTION' || issue.code === 'MISSING_TASK') ? Math.max(result.quality.missingActionRisk, 0.8) : result.quality.missingActionRisk,
      overFragmentationRisk: report.issues.some((issue) => issue.code === 'OVER_FRAGMENTATION') ? Math.max(result.quality.overFragmentationRisk, 0.8) : result.quality.overFragmentationRisk,
      reviewReasons,
    },
  }
}
