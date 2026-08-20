import { R8_FACT_CONTRACT_VERSION, assertR8FactGraph } from './e2-r8-planner-contracts.mjs'

const ACTION_PREDICATES = Object.freeze([
  '打包上传', '完成签到', '提交', '上传', '填写', '完成', '准备', '核对', '确认', '联系',
  '参加', '阅读', '下载', '打印', '盖章', '签字', '回复', '领取', '整理', '撰写', '制作',
  '报名', '发送', '携带', '出示', '归还', '反馈', '汇总', '组队', '办理', '预约', '报送',
  '确定', '集合', '到场', '签到', '出席', '上岗', '走台', '演出', '进行',
])
const SUBMISSION_PREDICATES = new Set(['提交', '上传', '打包上传', '发送', '报送', '填写', '准备', '完成', '汇总', '撰写', '制作'])
const ATTENDANCE_PREDICATES = new Set(['参加', '集合', '到场', '签到', '出席', '上岗', '走台', '演出', '进行'])
const CONDITION_SIGNAL = /^(?:仅|只限|仅限|如|若|如果|通过|未|除非)|(?:后方可|后才能|后再|之后)/u

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function text(value, limit = 500, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, limit) : fallback
}

function strings(value, limit = 30) {
  return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))].slice(0, limit) : []
}

function number01(value, fallback = 0.8) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}

function sourceFragments(sourceText) {
  const fragments = []
  const pattern = /[^，,；;。！？!\n]+/gu
  for (const match of sourceText.matchAll(pattern)) {
    const quote = match[0].trim()
    if (!quote) continue
    const rawStart = match.index ?? 0
    const leading = match[0].indexOf(quote)
    fragments.push({ quote, start: rawStart + leading, end: rawStart + leading + quote.length })
  }
  return fragments
}

function exactEvidence(raw, sourceText) {
  const evidence = []
  const usedIds = new Set()
  for (const [index, item] of (Array.isArray(raw.evidence) ? raw.evidence : []).entries()) {
    const value = record(item)
    const quote = text(value.quotedText || value.quote)
    const start = quote ? sourceText.indexOf(quote) : -1
    if (!quote || start < 0) continue
    let id = text(value.id, 100, `raw-evidence-${index + 1}`)
    while (usedIds.has(id)) id = `${id}-${index + 1}`
    usedIds.add(id)
    evidence.push({
      id, quote, start, end: start + quote.length,
      field: text(value.field, 40, 'description'), confidence: number01(value.confidence),
    })
  }
  return evidence
}

function flattenRawTasks(raw) {
  const tasks = []
  const milestones = Array.isArray(raw.milestones) ? raw.milestones : []
  for (const task of Array.isArray(raw.standaloneTasks) ? raw.standaloneTasks : Array.isArray(raw.tasks) ? raw.tasks : []) {
    tasks.push({ value: task, placement: { kind: 'standalone' } })
  }
  for (const [milestoneIndex, milestoneValue] of milestones.entries()) {
    const milestone = record(milestoneValue)
    for (const task of Array.isArray(milestone.tasks) ? milestone.tasks : []) {
      tasks.push({ value: task, placement: { kind: 'milestone', milestoneIndex } })
    }
    for (const [workPackageIndex, workPackageValue] of (Array.isArray(milestone.workPackages) ? milestone.workPackages : []).entries()) {
      const workPackage = record(workPackageValue)
      for (const task of Array.isArray(workPackage.tasks) ? workPackage.tasks : []) {
        tasks.push({ value: task, placement: { kind: 'workPackage', milestoneIndex, workPackageIndex } })
      }
    }
  }
  return tasks
}

function validEvidenceIds(value, allowed) {
  return strings(value).filter((id) => allowed.has(id))
}

function overlaps(left, right) {
  const normalize = (value) => value.replace(/[\s\p{P}\p{S}和及与]/gu, '')
  const normalizedLeft = normalize(left)
  const normalizedRight = normalize(right)
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
}

function clauseAction(fragment) {
  const positions = ACTION_PREDICATES.flatMap((predicate) => {
    const index = fragment.quote.indexOf(predicate)
    return index >= 0 ? [{ predicate, index }] : []
  }).sort((left, right) => left.index - right.index || right.predicate.length - left.predicate.length)
  const first = positions[0]
  if (!first) return null
  const object = fragment.quote.slice(first.index + first.predicate.length)
    .replace(/^(?:好|完|清楚|相关|相应|个人|本人的|本项目的|本团队的|其|该)/u, '')
    .replace(/(?:前|后|内)$/u, '')
    .trim()
    .slice(0, 80)
  if (!object) return null
  return { predicate: first.predicate, object }
}

function inferMaterialRole(material, obligations) {
  const related = obligations.filter((item) => material.obligationIds.includes(item.id))
  if (related.some((item) => item.actionPredicate === '携带' || item.actionPredicate === '出示')) return 'carry_item'
  if (related.some((item) => SUBMISSION_PREDICATES.has(item.actionPredicate))) return 'deliverable'
  return material.required ? 'required_input' : 'reference'
}

export function buildR8FactGraphFromCachedRaw({ raw, sourceText, referenceTime, timezone }) {
  const source = text(sourceText, 24_000)
  const rawRecord = record(raw)
  const evidence = exactEvidence(rawRecord, source)
  const evidenceIds = new Set(evidence.map((item) => item.id))
  const rawTaskFacts = flattenRawTasks(rawRecord)
  const obligations = []
  const taskIdMap = new Map()
  for (const [index, entry] of rawTaskFacts.entries()) {
    const task = record(entry.value)
    const actionPredicate = text(task.actionVerb, 20)
    const object = text(task.actionObject, 80)
    const taskEvidenceIds = validEvidenceIds(task.evidenceIds, evidenceIds)
    if (!actionPredicate || !object || taskEvidenceIds.length === 0) continue
    const sourceTaskId = text(task.tempId, 100, `task-${index + 1}`)
    const id = `obligation:${sourceTaskId}`
    taskIdMap.set(sourceTaskId, id)
    obligations.push({
      id, actor: null, modality: 'required', actionPredicate, object,
      materialIds: [], timePointIds: [], eventIds: [], conditionIds: [], evidenceIds: taskEvidenceIds,
      sourceTaskId, placement: entry.placement, confidence: number01(task.confidence), provenance: 'cached_model_task',
    })
  }

  const rawMaterials = Array.isArray(rawRecord.materials) ? rawRecord.materials : []
  const materialIdMap = new Map()
  const materials = rawMaterials.flatMap((value, index) => {
    const item = record(value)
    const name = text(item.name, 100)
    const itemEvidenceIds = validEvidenceIds(item.evidenceIds, evidenceIds)
    if (!name || itemEvidenceIds.length === 0) return []
    const sourceId = text(item.tempId, 100, `material-${index + 1}`)
    const id = `material:${sourceId}`
    materialIdMap.set(sourceId, id)
    return [{
      id, sourceMaterialId: sourceId, name, role: 'reference', required: item.required !== false,
      formatRequirements: strings(item.formatRequirements, 10), namingRequirements: strings(item.namingRequirements, 10),
      quantity: Number.isFinite(item.quantity) ? Math.max(1, Math.min(100, Math.round(item.quantity))) : null,
      submissionChannel: text(item.submissionChannel, 100) || null,
      obligationIds: strings(item.relatedTaskTempIds).map((taskId) => taskIdMap.get(taskId)).filter(Boolean),
      evidenceIds: itemEvidenceIds, confidence: number01(item.confidence),
    }]
  })

  const rawTimes = Array.isArray(rawRecord.timePoints) ? rawRecord.timePoints : []
  const timeIdMap = new Map()
  const timePoints = rawTimes.flatMap((value, index) => {
    const item = record(value)
    if (!['registration_deadline', 'submission_deadline', 'task_deadline', 'event_start', 'event_end', 'result_announcement', 'planned_start'].includes(item.type)) return []
    const rawText = text(item.rawText, 160)
    const itemEvidenceIds = validEvidenceIds(item.evidenceIds, evidenceIds)
    if (!rawText || itemEvidenceIds.length === 0) return []
    const sourceId = text(item.tempId, 100, `time-${index + 1}`)
    const id = `time:${sourceId}`
    timeIdMap.set(sourceId, id)
    const precision = ['exact', 'date_only', 'relative', 'vague'].includes(item.precision) ? item.precision : 'vague'
    const parsedValue = item.normalizedValue === null || (typeof item.normalizedValue === 'string' && !Number.isNaN(Date.parse(item.normalizedValue))) ? item.normalizedValue : null
    const uncertain = ['relative', 'vague'].includes(precision)
    return [{
      id, sourceTimePointId: sourceId, role: item.type, rawText,
      normalizedValue: uncertain ? null : parsedValue,
      timezone: text(item.timezone, 80, timezone || 'Asia/Shanghai'),
      isAllDay: Boolean(item.isAllDay), precision, needsConfirmation: uncertain || Boolean(item.needsConfirmation) || parsedValue === null,
      relatedObligationIds: strings(item.relatedTaskTempIds).map((taskId) => taskIdMap.get(taskId)).filter(Boolean),
      relatedMaterialIds: strings(item.relatedMaterialTempIds).map((materialId) => materialIdMap.get(materialId)).filter(Boolean),
      relatedEventIds: [], evidenceIds: itemEvidenceIds, confidence: number01(item.confidence),
    }]
  })

  const rawEvents = Array.isArray(rawRecord.events) ? rawRecord.events : []
  const eventIdMap = new Map()
  const events = rawEvents.flatMap((value, index) => {
    const item = record(value)
    const title = text(item.title, 100)
    const itemEvidenceIds = validEvidenceIds(item.evidenceIds, evidenceIds)
    if (!title || itemEvidenceIds.length === 0) return []
    const sourceId = text(item.tempId, 100, `event-${index + 1}`)
    const id = `event:${sourceId}`
    eventIdMap.set(sourceId, id)
    return [{
      id, sourceEventId: sourceId, title, description: text(item.description, 500), location: text(item.location, 160) || null,
      startTimePointId: timeIdMap.get(text(item.startTimePointTempId, 100)) || null,
      endTimePointId: timeIdMap.get(text(item.endTimePointTempId, 100)) || null,
      conditionIds: [], evidenceIds: itemEvidenceIds, confidence: number01(item.confidence),
      inferenceLevel: ['explicit', 'strong_inference', 'optional_suggestion'].includes(item.inferenceLevel) ? item.inferenceLevel : 'explicit',
    }]
  })

  for (const obligation of obligations) {
    const sourceTask = record(rawTaskFacts.find((entry) => text(record(entry.value).tempId, 100) === obligation.sourceTaskId)?.value)
    obligation.materialIds = strings(sourceTask.materialTempIds).map((id) => materialIdMap.get(id)).filter(Boolean)
    obligation.timePointIds = strings(sourceTask.timePointTempIds).map((id) => timeIdMap.get(id)).filter(Boolean)
    obligation.eventIds = events.filter((event) => event.evidenceIds.some((id) => obligation.evidenceIds.includes(id))
      && (overlaps(event.title, obligation.object) || ATTENDANCE_PREDICATES.has(obligation.actionPredicate))).map((event) => event.id)
  }
  for (const material of materials) material.role = inferMaterialRole(material, obligations)
  for (const timePoint of timePoints) {
    for (const event of events) {
      if ([event.startTimePointId, event.endTimePointId].includes(timePoint.id)) timePoint.relatedEventIds.push(event.id)
    }
  }

  const rawSummary = record(rawRecord.sourceSummary)
  const requiresAction = rawSummary.requiresAction === true
  if (requiresAction) {
    for (const [index, fragment] of sourceFragments(source).entries()) {
      const action = clauseAction(fragment)
      if (!action) continue
      const matchingEvent = events.find((event) => overlaps(event.title, action.object))
      if (ATTENDANCE_PREDICATES.has(action.predicate) && !matchingEvent) continue
      const plannedPredicate = action.predicate === '进行' && matchingEvent ? '参加' : action.predicate
      const plannedObject = matchingEvent ? matchingEvent.title : action.object
      const alreadyFound = obligations.some((item) => item.actionPredicate === plannedPredicate && overlaps(item.object, plannedObject))
      if (alreadyFound) continue
      const contextObligation = obligations.find((item) => item.evidenceIds.some((id) => {
        const itemEvidence = evidence.find((entry) => entry.id === id)
        return itemEvidence?.quote.includes(fragment.quote)
      }))
      const evidenceId = `source-action-evidence-${index + 1}`
      if (!evidenceIds.has(evidenceId)) {
        evidence.push({ id: evidenceId, quote: fragment.quote, start: fragment.start, end: fragment.end, field: 'requirement', confidence: 1 })
        evidenceIds.add(evidenceId)
      }
      obligations.push({
        id: `obligation:source-${index + 1}`, actor: null,
        modality: CONDITION_SIGNAL.test(fragment.quote) ? 'conditional' : 'required',
        actionPredicate: plannedPredicate, object: plannedObject,
        materialIds: [], timePointIds: matchingEvent?.startTimePointId ? [matchingEvent.startTimePointId] : contextObligation?.timePointIds ?? [],
        eventIds: matchingEvent ? [matchingEvent.id] : [], conditionIds: [], evidenceIds: [evidenceId],
        sourceTaskId: null, placement: contextObligation?.placement ?? { kind: 'standalone' },
        parentObligationId: contextObligation?.id ?? null,
        confidence: 0.85, provenance: 'literal_source_action',
      })
    }
  }

  for (const timePoint of timePoints) {
    if (timePoint.relatedEventIds.length > 0 || ['result_announcement', 'planned_start'].includes(timePoint.role)) continue
    const linked = obligations.filter((item) => item.timePointIds.includes(timePoint.id))
    if (linked.some((item) => item.actionPredicate === '报名' || item.actionPredicate === '组队')) timePoint.role = 'registration_deadline'
    else if (linked.some((item) => ['提交', '上传', '打包上传', '发送', '报送'].includes(item.actionPredicate))) timePoint.role = 'submission_deadline'
    else if (linked.length > 0) timePoint.role = 'task_deadline'
  }

  const conditions = []
  for (const [index, fragment] of sourceFragments(source).entries()) {
    if (!CONDITION_SIGNAL.test(fragment.quote) || /^仅供知悉/u.test(fragment.quote) || !requiresAction) continue
    const evidenceId = `source-condition-evidence-${index + 1}`
    if (!evidenceIds.has(evidenceId)) {
      evidence.push({ id: evidenceId, quote: fragment.quote, start: fragment.start, end: fragment.end, field: 'requirement', confidence: 1 })
      evidenceIds.add(evidenceId)
    }
    conditions.push({
      id: `condition:${index + 1}`, kind: /^(?:仅|只限|仅限)/u.test(fragment.quote) ? 'eligibility' : 'trigger',
      text: fragment.quote, appliesToFactIds: [...obligations.map((item) => item.id), ...events.map((item) => item.id)], evidenceIds: [evidenceId],
    })
  }
  for (const obligation of obligations) obligation.conditionIds = conditions.map((item) => item.id)
  for (const event of events) event.conditionIds = conditions.map((item) => item.id)

  const ambiguities = (Array.isArray(rawRecord.ambiguities) ? rawRecord.ambiguities : []).flatMap((value, index) => {
    const item = record(value)
    const message = text(item.message || item.description, 500)
    const itemEvidenceIds = validEvidenceIds(item.evidenceIds, evidenceIds)
    if (!message || itemEvidenceIds.length === 0) return []
    return [{
      id: `ambiguity:${text(item.id || item.tempId, 80, String(index + 1))}`, code: text(item.field || item.type, 100, 'UNSPECIFIED'),
      message, options: strings(item.options, 12), targetFactIds: [], evidenceIds: itemEvidenceIds,
    }]
  })
  for (const [index, condition] of conditions.entries()) {
    const represented = ambiguities.some((item) => item.message.includes(condition.text)
      || item.evidenceIds.some((evidenceId) => condition.evidenceIds.includes(evidenceId)))
    if (!represented) ambiguities.push({
      id: `ambiguity:condition-${index + 1}`, code: 'CONDITION_APPLICABILITY_UNKNOWN',
      message: `需确认当前用户是否满足条件：${condition.text}`, options: ['满足条件', '不满足条件'],
      targetFactIds: [condition.id], evidenceIds: condition.evidenceIds,
    })
  }

  return assertR8FactGraph({
    schemaVersion: R8_FACT_CONTRACT_VERSION,
    sourceText: source, referenceTime: text(referenceTime, 80), timezone: text(timezone, 80, 'Asia/Shanghai'),
    sourceSummary: {
      title: text(rawSummary.title, 160, '未命名来源'), sourceType: text(rawSummary.sourceType, 30, 'text'),
      notificationType: text(rawSummary.notificationType, 40, 'uncertain'), summary: text(rawSummary.summary, 800),
      requiresAction, actionReason: text(rawSummary.actionReason, 300),
    },
    projectMatch: record(rawRecord.projectMatch), projectSuggestion: rawRecord.projectSuggestion ?? null,
    hierarchyHints: Array.isArray(rawRecord.milestones) ? rawRecord.milestones : [],
    ignoredContent: Array.isArray(rawRecord.ignoredContent) ? rawRecord.ignoredContent : [],
    obligations, materials, timePoints, events, conditions, ambiguities, evidence,
  })
}
