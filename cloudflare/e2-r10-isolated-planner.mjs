import { assertR10PlannerInput } from './e2-r10-factledger-contract.mjs'

export const R10_ISOLATED_PLANNER_VERSION = 'e2-r10-isolated-planner-1.1.0'
export const R10_PLANNING_TRACE_SCHEMA_VERSION = 'e2-r10-planning-trace-1.1.0'
export const R10_RECOGNITION_PROMPT_VERSION = 'fact-ledger-planner-1.0.0'
export const R10_CONSTRAINT_PROJECTION_POLICY = Object.freeze({
  materialStructuredKinds: Object.freeze(['format', 'naming', 'quantity', 'channel']),
  conditionallyStructuredKinds: Object.freeze(['quantity', 'channel']),
  traceOnlyKinds: Object.freeze(['location', 'dependency', 'other']),
  unsafeRepresentation: 'ignoredContent',
  quantityParser: 'single-explicit-number-plus-unit-1-to-100',
  channelMapping: 'single-constraint-single-material-exact-text',
})

const ACTIVE_TASK_MODALITIES = new Set(['required', 'conditional', 'optional'])
const ACTION_SIGNAL_MODALITIES = new Set(['required', 'conditional', 'optional'])
const RECOGNITION_TIME_ROLES = new Set([
  'registration_deadline', 'submission_deadline', 'task_deadline', 'planned_start',
  'event_start', 'event_end', 'result_announcement',
])
const NOTIFICATION_TYPES = new Set([
  'new_project', 'project_addendum', 'project_correction', 'course_assignment', 'teacher_task',
  'event_notice', 'meeting_notice', 'material_submission', 'registration_notice', 'result_notice',
  'information_only', 'uncertain',
])

function unique(values) {
  return [...new Set(values)]
}

function sorted(values) {
  return unique(values).sort((left, right) => left.localeCompare(right, 'en'))
}

function boundedMetadata(value, limit, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback
}

const BASIC_CHINESE_DIGITS = Object.freeze({
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
})
const QUANTITY_EXPRESSION_PATTERN = /(?<![0-9一二三四五六七八九十百])(100|[1-9]\d?|一百|[一二三四五六七八九]十[一二三四五六七八九]?|十[一二三四五六七八九]?|[一二三四五六七八九])\s*(份|件|个|套|张|本|册|项|页|袋|盒|封)(?![0-9一二三四五六七八九十百])/gu

function parseBasicQuantityNumber(token) {
  if (/^\d+$/u.test(token)) return Number(token)
  if (token === '一百') return 100
  if (!token.includes('十')) return BASIC_CHINESE_DIGITS[token] ?? null
  const [tensText, onesText] = token.split('十')
  const tens = tensText ? BASIC_CHINESE_DIGITS[tensText] : 1
  const ones = onesText ? BASIC_CHINESE_DIGITS[onesText] : 0
  return Number.isInteger(tens) && Number.isInteger(ones) ? tens * 10 + ones : null
}

function strictConstraintQuantity(value) {
  if (typeof value !== 'string') return null
  const matches = [...value.matchAll(QUANTITY_EXPRESSION_PATTERN)]
  if (matches.length !== 1) return null
  const quantity = parseBasicQuantityNumber(matches[0][1])
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 100 ? quantity : null
}

function assertFactText(value, limit, path) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new Error(`R10_RECOGNITION_CAPACITY_EXCEEDED:${path}:${limit}`)
  }
  return value
}

function assertFactId(value, path) {
  return assertFactText(value, 100, path)
}

function outputEvidenceIds(ids) {
  if (ids.length > 20) throw new Error('R10_RECOGNITION_CAPACITY_EXCEEDED:evidenceIds:20')
  return [...ids]
}

function factRelations(plannerInput) {
  const materialToObligations = new Map(plannerInput.materials.map((item) => [item.id, new Set(item.obligationIds)]))
  const timeToObligations = new Map(plannerInput.timeExpressions.map((item) => [item.id, new Set(item.relatedObligationIds)]))
  for (const obligation of plannerInput.obligations) {
    obligation.materialIds.forEach((id) => materialToObligations.get(id)?.add(obligation.id))
    obligation.timeExpressionIds.forEach((id) => timeToObligations.get(id)?.add(obligation.id))
  }
  return { materialToObligations, timeToObligations }
}

function conditionIdsByTarget(conditions) {
  const result = new Map()
  for (const condition of conditions) {
    for (const factId of condition.appliesToFactIds) {
      const ids = result.get(factId) ?? []
      ids.push(condition.id)
      result.set(factId, ids)
    }
  }
  return result
}

function effectiveConditionIds(fact, canonicalConditionIdsByTarget) {
  return sorted([
    ...(Array.isArray(fact.conditionIds) ? fact.conditionIds : []),
    ...(canonicalConditionIdsByTarget.get(fact.id) ?? []),
  ])
}

function actorSegment(actor) {
  return typeof actor === 'string' && actor.trim() ? `适用对象：${actor}` : null
}

function taskDescription(obligation, conditions) {
  return [
    `${obligation.actionPredicate}${obligation.object}`,
    actorSegment(obligation.actor),
    ...conditions.map((item) => `适用条件：${item.text}`),
  ].filter(Boolean).join('；')
}

function eventDescription(event, conditions) {
  return [event.title, actorSegment(event.actor), ...conditions.map((item) => `适用条件：${item.text}`)]
    .filter(Boolean).join('；')
}

function informationalText(obligation) {
  return [actorSegment(obligation.actor), `${obligation.actionPredicate}${obligation.object}`].filter(Boolean).join('；')
}

function prohibitionText(obligation) {
  const actor = typeof obligation.actor === 'string' && obligation.actor.trim() ? obligation.actor : null
  return `${actor ? `禁止${actor}：` : '禁止：'}${obligation.actionPredicate}${obligation.object}`
}

function traceSemantics(plannerInput) {
  const byId = (left, right) => left.factId.localeCompare(right.factId, 'en')
  return {
    obligationActors: plannerInput.obligations.map((item) => ({ factId: item.id, actor: item.actor })).sort(byId),
    eventActors: plannerInput.events.map((item) => ({ factId: item.id, actor: item.actor })).sort(byId),
    timeExpressions: plannerInput.timeExpressions.map((item) => ({
      factId: item.id,
      rawText: item.rawText,
      role: item.role,
      precision: item.precision,
      normalizedValue: item.normalizedValue,
      endNormalizedValue: item.endNormalizedValue,
      timezone: item.timezone,
      needsConfirmation: item.needsConfirmation,
      supersedesTimeExpressionId: item.supersedesTimeExpressionId,
    })).sort(byId),
    conditionApplications: plannerInput.conditions.map((item) => ({
      factId: item.id,
      appliesToFactIds: sorted(item.appliesToFactIds),
    })).sort(byId),
    constraintApplications: plannerInput.constraints.map((item) => ({
      factId: item.id,
      kind: item.kind,
      appliesToFactIds: sorted(item.appliesToFactIds),
    })).sort(byId),
    ambiguityTargets: plannerInput.ambiguities.map((item) => ({
      factId: item.id,
      targetFactIds: sorted(item.targetFactIds),
    })).sort(byId),
  }
}

function obligationGroupingKey(obligation, canonicalConditionIdsByTarget) {
  return JSON.stringify({
    modality: obligation.modality,
    actor: obligation.actor,
    actionPredicate: obligation.actionPredicate,
    object: obligation.object,
    materialIds: sorted(obligation.materialIds),
    timeExpressionIds: sorted(obligation.timeExpressionIds),
    eventIds: sorted(obligation.eventIds),
    conditionIds: effectiveConditionIds(obligation, canonicalConditionIdsByTarget),
    constraintIds: sorted(obligation.constraintIds),
  })
}

function groupTaskObligations(obligations, canonicalConditionIdsByTarget) {
  const groups = new Map()
  for (const obligation of obligations.filter((item) => ACTIVE_TASK_MODALITIES.has(item.modality))) {
    const key = obligationGroupingKey(obligation, canonicalConditionIdsByTarget)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(obligation)
  }
  return [...groups.values()]
}

function standardTimeProjection(timeExpression, timezone) {
  if (!RECOGNITION_TIME_ROLES.has(timeExpression.role)) return null
  const precision = timeExpression.precision === 'unknown' || timeExpression.precision === 'range'
    ? 'vague'
    : timeExpression.precision
  const losesPrecision = ['unknown', 'range'].includes(timeExpression.precision)
  return {
    tempId: assertFactId(timeExpression.id, `timeExpressions.${timeExpression.id}.id`),
    type: timeExpression.role,
    rawText: assertFactText(timeExpression.rawText, 160, `timeExpressions.${timeExpression.id}.rawText`),
    normalizedValue: losesPrecision ? null : timeExpression.normalizedValue,
    timezone: boundedMetadata(timeExpression.timezone, 80, boundedMetadata(timezone, 80, 'Asia/Shanghai')),
    isAllDay: timeExpression.precision === 'date_only',
    precision,
    needsConfirmation: losesPrecision ? true : timeExpression.needsConfirmation,
    relatedTaskTempIds: [],
    relatedMaterialTempIds: [],
    evidenceIds: outputEvidenceIds(timeExpression.evidenceIds),
    confidence: 1,
    selected: !losesPrecision && timeExpression.normalizedValue !== null && !timeExpression.needsConfirmation,
  }
}

function sourceMetadata(value) {
  const metadata = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const sourceId = boundedMetadata(metadata.sourceId, 100)
  if (!sourceId) throw new Error('R10_SOURCE_METADATA_INVALID:sourceId')
  return {
    sourceId,
    title: boundedMetadata(metadata.title, 160, '未命名来源'),
    sourceType: boundedMetadata(metadata.sourceType, 30, 'text'),
    notificationType: NOTIFICATION_TYPES.has(metadata.notificationType) ? metadata.notificationType : 'uncertain',
    summary: typeof metadata.summary === 'string' ? metadata.summary.trim().slice(0, 800) : '',
  }
}

function injectedModelName(value) {
  const execution = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const names = [execution.requestedModel, execution.returnedModel, execution.executionModel, execution.resultModelName]
    .map((item) => boundedMetadata(item, 80))
  if (names.some((item) => !item) || new Set(names).size !== 1) throw new Error('R10_MODEL_IDENTITY_MISMATCH')
  return names[0]
}

function taskFromGroup(group, index, materialIds, activeTimeIds, conditionById, canonicalConditionIdsByTarget) {
  const first = group[0]
  const obligationIds = group.map((item) => item.id)
  const taskId = assertFactId(`task-from-${first.id}`, `obligations.${first.id}.taskId`)
  const conditionIds = unique(group.flatMap((item) => effectiveConditionIds(item, canonicalConditionIdsByTarget)))
  const conditions = conditionIds.map((id) => conditionById.get(id)).filter(Boolean)
  const evidenceIds = outputEvidenceIds(unique([
    ...group.flatMap((item) => item.evidenceIds),
    ...conditions.flatMap((item) => item.evidenceIds),
  ]))
  const linkedMaterials = unique(group.flatMap((item) => item.materialIds)).filter((id) => materialIds.has(id))
  const linkedTimes = unique(group.flatMap((item) => item.timeExpressionIds)).filter((id) => activeTimeIds.has(id))
  const actionVerb = assertFactText(first.actionPredicate, 20, `obligations.${first.id}.actionPredicate`)
  const actionObject = assertFactText(first.object, 80, `obligations.${first.id}.object`)
  return {
    obligationIds,
    task: {
      tempId: taskId,
      parentTempId: null,
      hierarchyType: 'task',
      title: assertFactText(`${first.actionPredicate}${first.object}`, 80, `tasks[${index}].title`),
      actionVerb,
      actionObject,
      description: assertFactText(taskDescription(first, conditions), 800, `tasks[${index}].description`),
      completionCriteria: [],
      estimatedMinutes: null,
      statusSuggestion: 'todo',
      prioritySuggestion: 'medium',
      dependencyTempIds: [],
      materialTempIds: linkedMaterials,
      timePointTempIds: linkedTimes,
      evidenceIds,
      confidence: 1,
      inferenceLevel: 'explicit',
      userConfirmationRequired: true,
      selected: group.some((item) => item.modality === 'required'),
    },
  }
}

function addBinding(bindings, factType, factId, entityType, entityId) {
  if (!bindings.some((item) => item.factType === factType && item.factId === factId
    && item.entityType === entityType && item.entityId === entityId)) {
    bindings.push({ factType, factId, entityType, entityId })
  }
}

function buildEvidence(plannerInput, sourceId) {
  if (plannerInput.evidence.length > 120) throw new Error('R10_RECOGNITION_CAPACITY_EXCEEDED:evidence:120')
  return plannerInput.evidence.map((entry) => ({
    id: assertFactId(entry.id, `evidence.${entry.id}.id`),
    sourceId,
    textStart: entry.start,
    textEnd: entry.end,
    quote: assertFactText(entry.quote, 500, `evidence.${entry.id}.quote`),
    quotedText: entry.quote,
    field: 'requirement',
    extractionMethod: 'ai',
    confidence: 1,
  }))
}

export function planR10FactLedger(plannerInput, {
  sourceMetadata: sourceMetadataValue = {},
  modelExecution,
  createdAt = plannerInput?.referenceTime,
} = {}) {
  assertR10PlannerInput(plannerInput)
  const metadata = sourceMetadata(sourceMetadataValue)
  const modelName = injectedModelName(modelExecution)
  const { sourceId, ...summaryMetadata } = metadata
  const bindings = []
  const relations = factRelations(plannerInput)

  const activeTimeOutputs = plannerInput.timeExpressions.flatMap((item) => {
    const projected = standardTimeProjection(item, plannerInput.timezone)
    return projected ? [projected] : []
  })
  if (activeTimeOutputs.length > 60) throw new Error('R10_RECOGNITION_CAPACITY_EXCEEDED:timePoints:60')
  const activeTimeIds = new Set(activeTimeOutputs.map((item) => item.tempId))

  const canonicalConditionIdsByTarget = conditionIdsByTarget(plannerInput.conditions)
  const taskGroups = groupTaskObligations(plannerInput.obligations, canonicalConditionIdsByTarget)
  const materialIds = new Set(plannerInput.materials.map((item) => item.id))
  const conditionById = new Map(plannerInput.conditions.map((item) => [item.id, item]))
  const taskGroupsWithOutput = taskGroups.map((group, index) => taskFromGroup(
    group,
    index,
    materialIds,
    activeTimeIds,
    conditionById,
    canonicalConditionIdsByTarget,
  ))
  const taskByObligationId = new Map()
  taskGroupsWithOutput.forEach(({ obligationIds, task }) => obligationIds.forEach((id) => taskByObligationId.set(id, task)))
  taskGroupsWithOutput.forEach(({ obligationIds, task }) => obligationIds.forEach((id) => addBinding(bindings, 'obligation', id, 'task', task.tempId)))
  taskGroupsWithOutput.forEach(({ obligationIds, task }) => {
    const conditionIds = unique(obligationIds.flatMap((id) => (
      effectiveConditionIds(
        plannerInput.obligations.find((item) => item.id === id) ?? {},
        canonicalConditionIdsByTarget,
      )
    )))
    conditionIds.forEach((id) => addBinding(bindings, 'condition', id, 'task', task.tempId))
  })
  const conflicts = plannerInput.obligations.filter((item) => item.modality === 'prohibited').map((item, index) => {
    const output = {
      id: `r10-prohibition-${index + 1}`,
      type: 'other',
      message: assertFactText(prohibitionText(item), 500, `obligations.${item.id}.prohibition`),
      entityTempIds: [],
      evidenceIds: outputEvidenceIds(item.evidenceIds),
      requiresDecision: false,
    }
    addBinding(bindings, 'obligation', item.id, 'conflict', output.id)
    return output
  })
  const obligationById = new Map(plannerInput.obligations.map((item) => [item.id, item]))
  const materialIdSet = new Set(plannerInput.materials.map((item) => item.id))
  const constraintTargetMaterialIds = (constraint) => new Set([
    ...constraint.appliesToFactIds.filter((id) => materialIdSet.has(id)),
    ...plannerInput.materials.filter((material) => material.constraintIds.includes(constraint.id)).map((material) => material.id),
    ...constraint.appliesToFactIds.flatMap((id) => obligationById.get(id)?.materialIds ?? []),
  ])
  const singleTargetConstraintsForMaterial = (kind, materialId) => plannerInput.constraints.filter((constraint) => {
    if (constraint.kind !== kind) return false
    const targets = constraintTargetMaterialIds(constraint)
    return targets.size === 1 && targets.has(materialId)
  })
  const structuredConstraintsForMaterial = (material) => {
    const alwaysStructured = plannerInput.constraints.filter((constraint) => (
      ['format', 'naming'].includes(constraint.kind) && constraintTargetMaterialIds(constraint).has(material.id)
    ))
    const channelCandidates = singleTargetConstraintsForMaterial('channel', material.id)
    const quantityCandidates = singleTargetConstraintsForMaterial('quantity', material.id)
    const channelConstraint = channelCandidates.length === 1
      && channelCandidates[0].text.trim() && channelCandidates[0].text.length <= 100
      ? channelCandidates[0]
      : null
    const parsedQuantity = quantityCandidates.length === 1
      ? strictConstraintQuantity(quantityCandidates[0].text)
      : null
    const quantityConstraint = parsedQuantity === null ? null : quantityCandidates[0]
    const structuredIds = new Set([
      ...alwaysStructured.map((item) => item.id),
      ...(channelConstraint ? [channelConstraint.id] : []),
      ...(quantityConstraint ? [quantityConstraint.id] : []),
    ])
    return {
      constraints: plannerInput.constraints.filter((constraint) => structuredIds.has(constraint.id)),
      channelConstraint,
      quantityConstraint,
      parsedQuantity,
    }
  }
  if (plannerInput.materials.length > 60) throw new Error('R10_RECOGNITION_CAPACITY_EXCEEDED:materials:60')
  const materials = plannerInput.materials.map((material) => {
    const relatedObligationIds = [...(relations.materialToObligations.get(material.id) ?? [])]
    const relatedTasks = relatedObligationIds
      .map((id) => taskByObligationId.get(id)?.tempId).filter(Boolean)
    const constraintProjection = structuredConstraintsForMaterial(material)
    const constraints = constraintProjection.constraints
    const conservativelyRequired = material.role !== 'reference'
      && relatedObligationIds.some((id) => obligationById.get(id)?.modality === 'required')
    const output = {
      tempId: assertFactId(material.id, `materials.${material.id}.id`),
      name: assertFactText(material.name, 100, `materials.${material.id}.name`),
      required: conservativelyRequired,
      formatRequirements: constraints.filter((item) => item.kind === 'format').map((item) => item.text),
      namingRequirements: constraints.filter((item) => item.kind === 'naming').map((item) => item.text),
      quantity: constraintProjection.parsedQuantity,
      submissionChannel: constraintProjection.channelConstraint?.text ?? null,
      relatedTaskTempIds: unique(relatedTasks).slice(0, 30),
      evidenceIds: outputEvidenceIds(unique([
        ...material.evidenceIds,
        ...constraints.flatMap((item) => item.evidenceIds),
      ])),
      confidence: 1,
      selected: conservativelyRequired,
    }
    if (output.formatRequirements.length > 10 || output.namingRequirements.length > 10) {
      throw new Error(`R10_RECOGNITION_CAPACITY_EXCEEDED:materials.${material.id}.requirements:10`)
    }
    addBinding(bindings, 'material', material.id, 'material', output.tempId)
    constraints.forEach((item) => {
      addBinding(bindings, 'constraint', item.id, 'material', output.tempId)
    })
    return output
  })

  for (const timePoint of activeTimeOutputs) {
    const timeFact = plannerInput.timeExpressions.find((item) => item.id === timePoint.tempId)
    const obligationIds = [...(relations.timeToObligations.get(timePoint.tempId) ?? [])]
    timePoint.relatedTaskTempIds = unique(obligationIds.map((id) => taskByObligationId.get(id)?.tempId).filter(Boolean)).slice(0, 30)
    timePoint.relatedMaterialTempIds = unique(obligationIds.flatMap((obligationId) => (
      plannerInput.obligations.find((item) => item.id === obligationId)?.materialIds ?? []
    ))).filter((id) => materialIds.has(id)).slice(0, 30)
    addBinding(bindings, 'timeExpression', timeFact.id, 'timePoint', timePoint.tempId)
  }

  if (plannerInput.events.length > 30) throw new Error('R10_RECOGNITION_CAPACITY_EXCEEDED:events:30')
  const events = plannerInput.events.map((event) => {
    const eventConditions = effectiveConditionIds(event, canonicalConditionIdsByTarget)
      .map((id) => conditionById.get(id)).filter(Boolean)
    const output = {
      tempId: assertFactId(event.id, `events.${event.id}.id`),
      title: assertFactText(event.title, 100, `events.${event.id}.title`),
      description: assertFactText(eventDescription(event, eventConditions), 500, `events.${event.id}.description`),
      startTimePointTempId: event.startTimeExpressionId && activeTimeIds.has(event.startTimeExpressionId) ? event.startTimeExpressionId : null,
      endTimePointTempId: event.endTimeExpressionId && activeTimeIds.has(event.endTimeExpressionId) ? event.endTimeExpressionId : null,
      location: event.location === null ? null : assertFactText(event.location, 160, `events.${event.id}.location`),
      evidenceIds: outputEvidenceIds(unique([...event.evidenceIds, ...eventConditions.flatMap((item) => item.evidenceIds)])),
      confidence: 1,
      inferenceLevel: 'explicit',
      selected: true,
    }
    addBinding(bindings, 'event', event.id, 'event', output.tempId)
    eventConditions.forEach((item) => addBinding(bindings, 'condition', item.id, 'event', output.tempId))
    return output
  })

  const ambiguities = []
  const pushAmbiguity = (factType, factId, field, message, evidenceIds) => {
    const output = {
      id: `r10-ambiguity-${ambiguities.length + 1}`,
      field: assertFactText(field, 100, `${factType}.${factId}.field`),
      message: assertFactText(message, 500, `${factType}.${factId}.message`),
      options: [],
      evidenceIds: outputEvidenceIds(evidenceIds),
    }
    ambiguities.push(output)
    addBinding(bindings, factType, factId, 'ambiguity', output.id)
  }
  plannerInput.timeExpressions.filter((item) => !RECOGNITION_TIME_ROLES.has(item.role)).forEach((item) => {
    pushAmbiguity('timeExpression', item.id, item.role, item.rawText, item.evidenceIds)
  })
  plannerInput.ambiguities.forEach((item) => pushAmbiguity('ambiguity', item.id, item.code, item.message, item.evidenceIds))

  const ignoredContent = []
  for (const obligation of plannerInput.obligations.filter((item) => item.modality === 'informational')) {
    const ignoredIndex = ignoredContent.length
    ignoredContent.push({
      text: assertFactText(
        informationalText(obligation),
        500,
        `obligations.${obligation.id}.informationalProjection`,
      ),
      reason: 'background',
    })
    addBinding(bindings, 'obligation', obligation.id, 'ignoredContent', `ignoredContent:${ignoredIndex}`)
  }
  const projectedConstraintIds = new Set(bindings.filter((item) => item.factType === 'constraint').map((item) => item.factId))
  for (const constraint of plannerInput.constraints.filter((item) => !projectedConstraintIds.has(item.id))) {
    const ignoredIndex = ignoredContent.length
    ignoredContent.push({
      text: assertFactText(constraint.text, 500, `constraints.${constraint.id}.text`),
      reason: ['format', 'naming'].includes(constraint.kind) ? 'format_requirement' : 'other',
    })
    addBinding(bindings, 'constraint', constraint.id, 'ignoredContent', `ignoredContent:${ignoredIndex}`)
  }
  for (const condition of plannerInput.conditions) {
    for (const targetFactId of condition.appliesToFactIds) {
      bindings.filter((item) => item.factId === targetFactId).forEach((target) => {
        addBinding(bindings, 'condition', condition.id, target.entityType, target.entityId)
      })
    }
  }
  const projectedConditionIds = new Set(bindings.filter((item) => item.factType === 'condition').map((item) => item.factId))
  for (const condition of plannerInput.conditions.filter((item) => !projectedConditionIds.has(item.id))) {
    const ignoredIndex = ignoredContent.length
    ignoredContent.push({ text: condition.text, reason: 'policy' })
    addBinding(bindings, 'condition', condition.id, 'ignoredContent', `ignoredContent:${ignoredIndex}`)
  }
  if (ambiguities.length > 30) throw new Error('R10_RECOGNITION_CAPACITY_EXCEEDED:ambiguities:30')
  if (ignoredContent.length > 30) throw new Error('R10_RECOGNITION_CAPACITY_EXCEEDED:ignoredContent:30')

  const requiredOrConditionalCount = plannerInput.obligations.filter((item) => ACTIVE_TASK_MODALITIES.has(item.modality)).length
  const actionSignalCount = plannerInput.obligations.filter((item) => ACTION_SIGNAL_MODALITIES.has(item.modality)).length
  const conditionalOrOptional = plannerInput.obligations.some((item) => ['conditional', 'optional'].includes(item.modality))
  const needsHumanReview = ambiguities.length > 0 || conditionalOrOptional
  const reviewReasons = unique([
    ...(ambiguities.length ? ['存在需确认的时间、条件或原文歧义'] : []),
    ...(conditionalOrOptional ? ['存在条件性或可选行动，需用户确认适用性'] : []),
  ])
  const duplicateCount = requiredOrConditionalCount - taskGroupsWithOutput.length
  const result = {
    schemaVersion: '2.0',
    promptVersion: R10_RECOGNITION_PROMPT_VERSION,
    modelName,
    createdAt: boundedMetadata(createdAt, 80, plannerInput.referenceTime),
    sourceSummary: {
      ...summaryMetadata,
      requiresAction: actionSignalCount > 0,
      actionReason: actionSignalCount > 0
        ? 'FactLedger 包含必做、条件性或可选行动；这些行动按保守选中规则投影为任务。'
        : 'FactLedger 未包含可投影的用户行动。',
    },
    projectMatch: {
      decision: 'uncertain', matchedProjectId: null, suggestedProjectTitle: null,
      confidence: 0, reasons: ['R10 隔离 Planner 不执行项目匹配'],
    },
    projectSuggestion: null,
    milestones: [],
    standaloneTasks: taskGroupsWithOutput.map((item) => item.task),
    materials,
    timePoints: activeTimeOutputs,
    events,
    evidence: buildEvidence(plannerInput, sourceId),
    conflicts,
    ambiguities,
    ignoredContent,
    quality: {
      overallConfidence: 1,
      hierarchyConfidence: 1,
      dateConfidence: plannerInput.timeExpressions.some((item) => item.needsConfirmation || ['range', 'unknown'].includes(item.precision)) ? 0 : 1,
      evidenceCoverage: 1,
      duplicateRisk: requiredOrConditionalCount ? duplicateCount / requiredOrConditionalCount : 0,
      overFragmentationRisk: 0,
      missingActionRisk: requiredOrConditionalCount > 0 && taskGroupsWithOutput.length === 0 ? 1 : 0,
      needsHumanReview,
      reviewReasons,
    },
  }
  const planningTrace = {
    schemaVersion: R10_PLANNING_TRACE_SCHEMA_VERSION,
    ledgerSchemaVersion: plannerInput.ledgerSchemaVersion,
    plannerVersion: R10_ISOLATED_PLANNER_VERSION,
    sourceId,
    semantics: traceSemantics(plannerInput),
    bindings,
  }
  return { result, planningTrace }
}
