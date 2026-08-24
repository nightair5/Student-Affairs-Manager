export const R10_LEDGER_PLAN_VALIDATOR_VERSION = 'e2-r10-ledger-plan-validator-1.1.0'
export const R10_PLANNING_TRACE_SCHEMA_VERSION = 'e2-r10-planning-trace-1.1.0'

export const R10_VALIDATOR_ISSUE_CODES = Object.freeze([
  'MISSING_TASK',
  'MISSING_TIMEPOINT',
  'WRONG_TIME_ROLE',
  'MISSING_AMBIGUITY',
  'EVENT_TASK_CONFUSION',
  'UNSUPPORTED_TASK',
  'FACT_MUTATION',
  'INTEGRITY_FAILURE',
])

const ACTIONABLE_MODALITIES = new Set(['required', 'conditional', 'optional'])
const FACT_COLLECTIONS = Object.freeze({
  obligation: 'obligations',
  material: 'materials',
  timeExpression: 'timeExpressions',
  event: 'events',
  condition: 'conditions',
  constraint: 'constraints',
  ambiguity: 'ambiguities',
})
const ENTITY_TYPES = new Set([
  'task', 'material', 'timePoint', 'event', 'ambiguity', 'quality', 'ignoredContent', 'conflict',
])
const PRIMARY_ENTITY_TYPES = Object.freeze({
  obligation: new Set(['task', 'ignoredContent', 'conflict']),
  material: new Set(['material']),
  timeExpression: new Set(['timePoint', 'ambiguity', 'ignoredContent', 'conflict']),
  event: new Set(['event', 'task']),
  ambiguity: new Set(['ambiguity']),
  condition: new Set(['task', 'material', 'timePoint', 'event', 'ambiguity', 'quality', 'ignoredContent', 'conflict']),
  constraint: new Set(['task', 'material', 'timePoint', 'event', 'quality', 'ignoredContent', 'conflict']),
})
const ALTERNATE_TIME_ROLES = new Set(['superseded_deadline', 'other'])
const ACTIVE_TIME_ROLES = new Set([
  'registration_deadline', 'submission_deadline', 'task_deadline', 'planned_start',
  'event_start', 'event_end', 'result_announcement',
])

function obligationEntityTypeAllowed(modality, entityType) {
  if (ACTIONABLE_MODALITIES.has(modality)) return entityType === 'task'
  if (modality === 'informational') return entityType === 'ignoredContent'
  if (modality === 'prohibited') return entityType === 'conflict'
  return false
}

function factEntityTypeAllowed(factType, fact, entityType) {
  if (factType === 'obligation') return obligationEntityTypeAllowed(fact.modality, entityType)
  return PRIMARY_ENTITY_TYPES[factType].has(entityType)
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function rawString(value) {
  return typeof value === 'string' ? value : ''
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

function strings(value) {
  return array(value).filter((item) => typeof item === 'string' && item.length > 0)
}

function sortedUnique(value) {
  return [...new Set(strings(value))].sort((left, right) => left.localeCompare(right, 'en'))
}

function uniqueInOrder(value) {
  return [...new Set(strings(value))]
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

export function canonicalR10Json(value) {
  return JSON.stringify(canonical(value))
}

export async function canonicalR10Sha256(value) {
  if (!globalThis.crypto?.subtle) throw new Error('WEB_CRYPTO_UNAVAILABLE')
  const bytes = new TextEncoder().encode(canonicalR10Json(value))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function flattenTasks(result) {
  const tasks = [...array(result.standaloneTasks), ...array(result.tasks)]
  for (const milestoneValue of array(result.milestones)) {
    const milestone = record(milestoneValue)
    tasks.push(...array(milestone.tasks))
    for (const workPackageValue of array(milestone.workPackages)) {
      tasks.push(...array(record(workPackageValue).tasks))
    }
  }
  return tasks.map(record)
}

function buildEntityIndex(result, addIssue) {
  const index = new Map()
  const collections = {
    task: flattenTasks(result),
    material: array(result.materials).map(record),
    timePoint: array(result.timePoints).map(record),
    event: array(result.events).map(record),
    ambiguity: array(result.ambiguities).map(record),
    conflict: array(result.conflicts).map(record),
    ignoredContent: array(result.ignoredContent).map(record),
  }

  for (const [entityType, values] of Object.entries(collections)) {
    values.forEach((entity, position) => {
      const nativeId = entityType === 'ambiguity' || entityType === 'conflict' ? text(entity.id) : text(entity.tempId || entity.id)
      const entityId = nativeId || (entityType === 'ignoredContent' ? `ignoredContent:${position}` : '')
      if (!entityId) {
        addIssue('INTEGRITY_FAILURE', {
          entityType, field: 'id', message: `${entityType} projection is missing its RecognitionResult identifier.`,
        })
        return
      }
      const key = `${entityType}:${entityId}`
      if (index.has(key)) {
        addIssue('INTEGRITY_FAILURE', {
          entityType, entityId, field: 'id', message: `Duplicate ${entityType} identifier makes reverse validation ambiguous.`,
        })
        return
      }
      index.set(key, entity)
    })
  }
  if (result.quality && typeof result.quality === 'object' && !Array.isArray(result.quality)) {
    index.set('quality:quality', result.quality)
  }
  return { index, collections }
}

function buildFactIndex(ledger, addIssue) {
  const index = new Map()
  const factsByType = {}
  const globalIds = new Map()
  for (const [factType, collectionName] of Object.entries(FACT_COLLECTIONS)) {
    const collection = ledger[collectionName]
    if (!Array.isArray(collection)) {
      addIssue('INTEGRITY_FAILURE', {
        factType, field: collectionName, message: `Validated FactLedger must contain ${collectionName} as an array.`,
      })
      factsByType[factType] = []
      continue
    }
    factsByType[factType] = collection.map(record)
    for (const fact of factsByType[factType]) {
      const factId = text(fact.id)
      if (!factId) {
        addIssue('INTEGRITY_FAILURE', {
          factType, field: 'id', message: `${factType} is missing its FactLedger identifier.`,
        })
        continue
      }
      if (globalIds.has(factId)) {
        addIssue('INTEGRITY_FAILURE', {
          factType, factId, field: 'id', message: `FactLedger identifier is duplicated across ${globalIds.get(factId)} and ${factType}.`,
        })
      }
      globalIds.set(factId, factType)
      index.set(`${factType}:${factId}`, fact)
    }
  }
  return { index, factsByType, factTypeById: globalIds }
}

function entityEvidenceIds(entity) {
  return strings(record(entity).evidenceIds)
}

function containsAll(container, required) {
  const values = new Set(strings(container))
  return strings(required).every((item) => values.has(item))
}

function sameText(left, right) {
  return text(left) === text(right)
}

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null)
}

function sameStringSet(left, right) {
  return canonicalR10Json(sortedUnique(left)) === canonicalR10Json(sortedUnique(right))
}

function validateDeterministicFields({ actual, expected, fields, factType, factId, entityType, entityId, evidenceIds, addIssue }) {
  for (const field of fields) {
    if (canonicalR10Json(actual[field]) !== canonicalR10Json(expected[field])) {
      addIssue('FACT_MUTATION', {
        factType,
        factId,
        entityType,
        entityId,
        field,
        evidenceIds,
        message: `${entityType} ${field} differs from the deterministic FactLedger projection.`,
      })
    }
  }
}

function actorSegment(actor) {
  return text(actor) ? `适用对象：${rawString(actor)}` : null
}

function conditionIdsByTarget(conditions) {
  const result = new Map()
  for (const condition of conditions) {
    for (const factId of strings(condition.appliesToFactIds)) {
      const ids = result.get(factId) ?? []
      ids.push(text(condition.id))
      result.set(factId, ids)
    }
  }
  return result
}

function effectiveConditionIds(fact, canonicalConditionIdsByTarget) {
  return sortedUnique([
    ...strings(fact.conditionIds),
    ...(canonicalConditionIdsByTarget.get(text(fact.id)) ?? []),
  ])
}

function expectedTaskDescription(obligation, conditions) {
  return [
    `${rawString(obligation.actionPredicate)}${rawString(obligation.object)}`,
    actorSegment(obligation.actor),
    ...conditions.map((item) => `适用条件：${rawString(item.text)}`),
  ].filter(Boolean).join('；')
}

function expectedEventDescription(event, conditions) {
  return [rawString(event.title), actorSegment(event.actor), ...conditions.map((item) => `适用条件：${rawString(item.text)}`)]
    .filter(Boolean).join('；')
}

function expectedInformationalText(obligation) {
  return [actorSegment(obligation.actor), `${rawString(obligation.actionPredicate)}${rawString(obligation.object)}`]
    .filter(Boolean).join('；')
}

function expectedProhibitionText(obligation) {
  const actor = text(obligation.actor)
  return `${actor ? `禁止${rawString(obligation.actor)}：` : '禁止：'}${rawString(obligation.actionPredicate)}${rawString(obligation.object)}`
}

function expectedTraceSemantics(ledger) {
  const byId = (left, right) => left.factId.localeCompare(right.factId, 'en')
  return {
    obligationActors: array(ledger.obligations).map((value) => {
      const item = record(value)
      return { factId: text(item.id), actor: item.actor ?? null }
    }).sort(byId),
    eventActors: array(ledger.events).map((value) => {
      const item = record(value)
      return { factId: text(item.id), actor: item.actor ?? null }
    }).sort(byId),
    timeExpressions: array(ledger.timeExpressions).map((value) => {
      const item = record(value)
      return {
        factId: text(item.id),
        rawText: item.rawText,
        role: item.role,
        precision: item.precision,
        normalizedValue: item.normalizedValue ?? null,
        endNormalizedValue: item.endNormalizedValue ?? null,
        timezone: item.timezone ?? null,
        needsConfirmation: item.needsConfirmation,
        supersedesTimeExpressionId: item.supersedesTimeExpressionId ?? null,
      }
    }).sort(byId),
    conditionApplications: array(ledger.conditions).map((value) => {
      const item = record(value)
      return { factId: text(item.id), appliesToFactIds: sortedUnique(item.appliesToFactIds) }
    }).sort(byId),
    constraintApplications: array(ledger.constraints).map((value) => {
      const item = record(value)
      return { factId: text(item.id), kind: item.kind, appliesToFactIds: sortedUnique(item.appliesToFactIds) }
    }).sort(byId),
    ambiguityTargets: array(ledger.ambiguities).map((value) => {
      const item = record(value)
      return { factId: text(item.id), targetFactIds: sortedUnique(item.targetFactIds) }
    }).sort(byId),
  }
}

function bindingKey(binding) {
  return `${binding.factType}:${binding.factId}`
}

function targetKey(binding) {
  return `${binding.entityType}:${binding.entityId}`
}

function entityTextValues(entityType, entity) {
  const value = record(entity)
  if (entityType === 'task') {
    return [value.title, value.actionVerb, value.actionObject, value.description, ...array(value.completionCriteria)]
  }
  if (entityType === 'material') {
    return [value.name, value.submissionChannel, value.quantity, ...array(value.formatRequirements), ...array(value.namingRequirements)]
  }
  if (entityType === 'timePoint') return [value.rawText]
  if (entityType === 'event') return [value.title, value.description, value.location]
  if (entityType === 'ambiguity' || entityType === 'conflict') return [value.field, value.message, ...array(value.options)]
  if (entityType === 'ignoredContent') return [value.text]
  if (entityType === 'quality') return array(value.reviewReasons)
  return []
}

function entityContainsExactText(entityType, entity, expected) {
  const wanted = text(expected)
  return Boolean(wanted) && entityTextValues(entityType, entity).some((value) => text(String(value ?? '')) === wanted)
}

function entityContainsStructuredText(factType, entityType, entity, expected) {
  if (entityContainsExactText(entityType, entity, expected)) return true
  if (factType === 'condition' && ['task', 'event'].includes(entityType)) {
    return text(record(entity).description).split('；').includes(`适用条件：${rawString(expected)}`)
  }
  return false
}

function evidenceCoveredByResult(fact, resultEvidenceById) {
  return strings(fact.evidenceIds).every((id) => resultEvidenceById.has(id))
}

function evidenceCoveredByEntity(fact, entityType, entity, resultEvidenceById) {
  if (!evidenceCoveredByResult(fact, resultEvidenceById)) return false
  const required = strings(fact.evidenceIds)
  if (required.length === 0) return false
  if (['quality', 'ignoredContent'].includes(entityType)) return true
  return containsAll(entityEvidenceIds(entity), required)
}

function primaryTimeBindings(bindings, entityIndex) {
  return bindings.filter((binding) => binding.entityType === 'timePoint' && entityIndex.has(targetKey(binding)))
}

function alternateTimeBindings(bindings, entityIndex) {
  return bindings.filter((binding) => ['ambiguity', 'ignoredContent', 'conflict'].includes(binding.entityType) && entityIndex.has(targetKey(binding)))
}

function projectedTimezone(fact, envelopeTimezone) {
  return boundedMetadata(fact.timezone, 80, boundedMetadata(envelopeTimezone, 80, 'Asia/Shanghai'))
}

function isSafeImpreciseProjection(fact, projected, envelopeTimezone) {
  return projected.rawText === fact.rawText
    && projected.type === fact.role
    && projected.timezone === projectedTimezone(fact, envelopeTimezone)
    && projected.precision === 'vague'
    && projected.normalizedValue === null
    && projected.needsConfirmation === true
}

function isDirectTimeValueProjection(fact, projected, envelopeTimezone) {
  return projected.rawText === fact.rawText
    && sameNullable(projected.normalizedValue, fact.normalizedValue)
    && projected.timezone === projectedTimezone(fact, envelopeTimezone)
    && projected.precision === fact.precision
    && projected.needsConfirmation === fact.needsConfirmation
}

function timeProjectionHasCorrectValue(fact, projected, envelopeTimezone) {
  if (fact.precision === 'range') {
    return isSafeImpreciseProjection(fact, projected, envelopeTimezone)
  }
  if (fact.precision === 'unknown') {
    return isSafeImpreciseProjection(fact, projected, envelopeTimezone)
      || isDirectTimeValueProjection(fact, projected, envelopeTimezone)
  }
  return isDirectTimeValueProjection(fact, projected, envelopeTimezone)
}

function resultEvidenceIndex(result, ledger, trace, addIssue) {
  const ledgerEvidenceById = new Map()
  const sourceText = typeof ledger.sourceText === 'string' ? ledger.sourceText : ''
  if (!Array.isArray(ledger.evidence)) {
    addIssue('INTEGRITY_FAILURE', { field: 'evidence', message: 'Validated FactLedger must contain evidence as an array.' })
  }
  for (const value of array(ledger.evidence)) {
    const evidence = record(value)
    const id = text(evidence.id)
    if (!id || ledgerEvidenceById.has(id)) {
      addIssue('INTEGRITY_FAILURE', { factType: 'evidence', factId: id || null, field: 'id', message: 'FactLedger evidence identifier is missing or duplicated.' })
      continue
    }
    if (!text(evidence.quote) || !Number.isInteger(evidence.start) || !Number.isInteger(evidence.end)
      || evidence.start < 0 || evidence.end <= evidence.start || sourceText.slice(evidence.start, evidence.end) !== evidence.quote) {
      addIssue('INTEGRITY_FAILURE', { factType: 'evidence', factId: id, field: 'span', message: 'FactLedger evidence is not an exact source span.' })
    }
    ledgerEvidenceById.set(id, evidence)
  }

  const resultEvidenceById = new Map()
  if (!Array.isArray(result.evidence)) {
    addIssue('INTEGRITY_FAILURE', { field: 'result.evidence', message: 'RecognitionResult must contain evidence as an array.' })
  }
  for (const value of array(result.evidence)) {
    const evidence = record(value)
    const id = text(evidence.id)
    if (!id || resultEvidenceById.has(id)) {
      addIssue('INTEGRITY_FAILURE', { entityType: 'evidence', entityId: id || null, field: 'id', message: 'RecognitionResult evidence identifier is missing or duplicated.' })
      continue
    }
    resultEvidenceById.set(id, evidence)
    if (!ledgerEvidenceById.has(id)) {
      addIssue('FACT_MUTATION', {
        factType: 'evidence', factId: id, entityType: 'evidence', entityId: id, field: 'unsupportedEvidence',
        evidenceIds: [id], message: 'RecognitionResult evidence has no validated FactLedger span.',
      })
    }
  }

  for (const [id, evidence] of ledgerEvidenceById) {
    const projected = resultEvidenceById.get(id)
    if (!projected) continue
    const exactLocation = projected.sourceId === trace.sourceId
      && projected.textStart === evidence.start
      && projected.textEnd === evidence.end
    const exactText = projected.quote === evidence.quote && projected.quotedText === evidence.quote
    if (!exactLocation || !exactText) {
      addIssue('FACT_MUTATION', {
        factType: 'evidence', factId: id, entityType: 'evidence', entityId: id, field: 'sourceBinding',
        evidenceIds: [id], message: 'Projected evidence must retain the exact sourceId, span, quote, and quotedText.',
      })
    }
  }
  return { ledgerEvidenceById, resultEvidenceById }
}

function validateTraceSemantics(trace, ledger, addIssue) {
  if (!text(trace.sourceId)) {
    addIssue('INTEGRITY_FAILURE', {
      field: 'trace.sourceId', message: 'PlanningTrace must bind RecognitionResult evidence to one non-empty sourceId.',
    })
  }
  if (canonicalR10Json(trace.semantics) !== canonicalR10Json(expectedTraceSemantics(ledger))) {
    addIssue('INTEGRITY_FAILURE', {
      field: 'trace.semantics',
      message: 'PlanningTrace actor, time, condition, constraint, or ambiguity semantics differ from FactLedger.',
    })
  }
}

function validateFactEvidence(factsByType, ledgerEvidenceById, resultEvidenceById, addIssue) {
  for (const [factType, facts] of Object.entries(factsByType)) {
    for (const fact of facts) {
      const evidenceIds = strings(fact.evidenceIds)
      if (evidenceIds.length === 0 || evidenceIds.some((id) => !ledgerEvidenceById.has(id))) {
        addIssue('INTEGRITY_FAILURE', {
          factType, factId: text(fact.id) || null, field: 'evidenceIds', evidenceIds,
          message: 'Validated FactLedger fact has missing or unknown evidence references.',
        })
      }
      if (evidenceIds.some((id) => !resultEvidenceById.has(id))) {
        addIssue('FACT_MUTATION', {
          factType, factId: text(fact.id) || null, field: 'evidenceIds', evidenceIds,
          message: 'Planner result dropped evidence required by a validated fact.',
        })
      }
    }
  }
}

function validateObligations({
  facts,
  bindingsByFact,
  bindingsByEntity,
  entityIndex,
  resultEvidenceById,
  conditionById,
  canonicalConditionIdsByTarget,
  timeById,
  addIssue,
}) {
  const obligationOrderById = new Map(facts.map((item, index) => [text(item.id), index]))
  const prohibitedIndexById = new Map(facts.filter((item) => item.modality === 'prohibited')
    .map((item, index) => [text(item.id), index]))
  for (const fact of facts) {
    const factId = text(fact.id)
    const allBindings = array(bindingsByFact.get(`obligation:${factId}`))
      .filter((binding) => entityIndex.has(targetKey(binding)))
    const bindings = allBindings
      .filter((binding) => binding.entityType === 'task' && entityIndex.has(targetKey(binding)))
    const actionable = ACTIONABLE_MODALITIES.has(fact.modality)
    if (fact.modality === 'informational') {
      const expectedText = expectedInformationalText(fact)
      const validProjection = allBindings.some((binding) => {
        if (binding.entityType !== 'ignoredContent') return false
        const entity = entityIndex.get(targetKey(binding))
        return record(entity).text === expectedText
          && evidenceCoveredByEntity(fact, binding.entityType, entity, resultEvidenceById)
      })
      if (!validProjection) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, field: 'projection', evidenceIds: strings(fact.evidenceIds),
          message: 'Informational obligation lost its exact action and object in ignored content.',
        })
      }
      continue
    }
    if (fact.modality === 'prohibited') {
      const expectedText = expectedProhibitionText(fact)
      const conflictBindings = allBindings.filter((binding) => binding.entityType === 'conflict')
      const validProjection = conflictBindings.some((binding) => {
        const entity = entityIndex.get(targetKey(binding))
        return record(entity).message === expectedText
          && evidenceCoveredByEntity(fact, binding.entityType, entity, resultEvidenceById)
      })
      if (!validProjection) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, field: 'projection', evidenceIds: strings(fact.evidenceIds),
          message: 'Prohibited obligation lost its exact action, object, or evidence in conflict output.',
        })
      }
      if (conflictBindings.length !== 1) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, field: 'conflictCount', evidenceIds: strings(fact.evidenceIds),
          message: 'One prohibited obligation must project to exactly one Conflict.',
        })
      }
      for (const binding of conflictBindings) {
        validateDeterministicFields({
          actual: entityIndex.get(targetKey(binding)),
          expected: {
            id: `r10-prohibition-${(prohibitedIndexById.get(factId) ?? -1) + 1}`,
            type: 'other',
            message: expectedText,
            entityTempIds: [],
            evidenceIds: sortedUnique(fact.evidenceIds),
            requiresDecision: false,
          },
          fields: ['id', 'type', 'message', 'entityTempIds', 'evidenceIds', 'requiresDecision'],
          factType: 'obligation',
          factId,
          entityType: 'conflict',
          entityId: binding.entityId,
          evidenceIds: strings(fact.evidenceIds),
          addIssue,
        })
      }
      continue
    }
    if (actionable && bindings.length === 0) {
      addIssue('MISSING_TASK', {
        factType: 'obligation', factId, field: 'projection', evidenceIds: strings(fact.evidenceIds),
        message: 'Required, conditional, or optional obligation has no Task projection.',
      })
      continue
    }
    if (actionable && bindings.length > 1) {
      const ordered = [...bindings].sort((left, right) => left.entityId.localeCompare(right.entityId, 'en'))
      for (const extra of ordered.slice(1)) {
        addIssue('UNSUPPORTED_TASK', {
          factType: 'obligation', factId, entityType: 'task', entityId: extra.entityId, field: 'overFragmentation',
          evidenceIds: strings(fact.evidenceIds), message: 'One atomic obligation was projected into more than one Task.',
        })
      }
    }
    for (const binding of bindings) {
      const task = entityIndex.get(targetKey(binding))
      if (!actionable) {
        addIssue('UNSUPPORTED_TASK', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'modality',
          evidenceIds: strings(fact.evidenceIds), message: `A ${fact.modality || 'non-actionable'} fact cannot authorize a Task.`,
        })
        continue
      }
      const action = task.actionVerb ?? task.actionPredicate
      const object = task.actionObject ?? task.object
      if (!sameText(action, fact.actionPredicate)) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'actionPredicate',
          evidenceIds: strings(fact.evidenceIds), message: 'Task action differs from the validated obligation action.',
        })
      }
      if (!sameText(object, fact.object)) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'object',
          evidenceIds: strings(fact.evidenceIds), message: 'Task object differs from the validated obligation object.',
        })
      }
      const taskSourceBindings = array(bindingsByEntity.get(`task:${binding.entityId}`))
        .filter((item) => item.factType === 'obligation' && ACTIONABLE_MODALITIES.has(record(item.fact).modality))
      const taskObligations = taskSourceBindings.map((item) => record(item.fact))
        .sort((left, right) => (obligationOrderById.get(text(left.id)) ?? Number.MAX_SAFE_INTEGER)
          - (obligationOrderById.get(text(right.id)) ?? Number.MAX_SAFE_INTEGER))
      const taskConditionIds = sortedUnique(taskObligations.flatMap((item) => (
        effectiveConditionIds(item, canonicalConditionIdsByTarget)
      )))
      const taskConditions = taskConditionIds.map((id) => conditionById.get(id)).filter(Boolean)
      if (task.title !== `${rawString(fact.actionPredicate)}${rawString(fact.object)}`) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'title',
          evidenceIds: strings(fact.evidenceIds), message: 'Task title contains text not authorized by its obligation action and object.',
        })
      }
      if (task.description !== expectedTaskDescription(fact, taskConditions)) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'description',
          evidenceIds: strings(fact.evidenceIds), message: 'Task description is not the deterministic action, actor, and condition projection.',
        })
      }
      if (text(fact.actor) && !text(task.description).split('；').includes(actorSegment(fact.actor))) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'actor',
          evidenceIds: strings(fact.evidenceIds), message: 'Task dropped or changed the obligation actor.',
        })
      }
      if (array(task.completionCriteria).length !== 0) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'completionCriteria',
          evidenceIds: strings(fact.evidenceIds), message: 'FactLedger does not authorize Planner-generated completion criteria.',
        })
      }
      if (array(task.dependencyTempIds).length !== 0) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'dependencyTempIds',
          evidenceIds: strings(fact.evidenceIds), message: 'FactLedger does not authorize Planner-generated Task dependencies.',
        })
      }
      const expectedEvidenceIds = uniqueInOrder([
        ...taskObligations.flatMap((item) => sortedUnique(item.evidenceIds)),
        ...taskConditions.flatMap((item) => sortedUnique(item.evidenceIds)),
      ])
      if (!sameStringSet(task.evidenceIds, expectedEvidenceIds)) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'evidenceIds',
          evidenceIds: strings(fact.evidenceIds), message: 'Task evidence includes unsupported facts or omits bound obligation/condition evidence.',
        })
      }
      if (!containsAll(task.evidenceIds, fact.evidenceIds)) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'evidenceIds',
          evidenceIds: strings(fact.evidenceIds), message: 'Task does not retain all obligation evidence.',
        })
      }
      const expectedSelected = fact.modality === 'required'
      if (Boolean(task.selected) !== expectedSelected) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'selected',
          evidenceIds: strings(fact.evidenceIds), message: `${fact.modality} Task selected state is not conservative.`,
        })
      }

      for (const materialId of strings(fact.materialIds)) {
        const projectedIds = array(bindingsByFact.get(`material:${materialId}`))
          .filter((item) => item.entityType === 'material' && entityIndex.has(targetKey(item))).map((item) => item.entityId)
        if (projectedIds.length && !projectedIds.some((id) => strings(task.materialTempIds).includes(id))) {
          addIssue('FACT_MUTATION', {
            factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'materialTempIds',
            evidenceIds: strings(fact.evidenceIds), message: `Task lost the material relation to ${materialId}.`,
          })
        }
      }
      for (const timeId of strings(fact.timeExpressionIds)) {
        const projectedIds = array(bindingsByFact.get(`timeExpression:${timeId}`))
          .filter((item) => item.entityType === 'timePoint' && entityIndex.has(targetKey(item))).map((item) => item.entityId)
        if (projectedIds.length && !projectedIds.some((id) => strings(task.timePointTempIds).includes(id))) {
          addIssue('FACT_MUTATION', {
            factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'timePointTempIds',
            evidenceIds: strings(fact.evidenceIds), message: `Task lost the time relation to ${timeId}.`,
          })
        }
      }
      const expectedMaterialTempIds = uniqueInOrder(taskObligations.flatMap((item) => sortedUnique(item.materialIds)))
      const expectedTimePointTempIds = uniqueInOrder(taskObligations.flatMap((item) => sortedUnique(item.timeExpressionIds)))
        .filter((timeId) => ACTIVE_TIME_ROLES.has(timeById.get(timeId)?.role))
      if (!sameStringSet(task.materialTempIds, expectedMaterialTempIds)) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'materialTempIds',
          evidenceIds: strings(fact.evidenceIds), message: 'Task material relations are not exactly supported by bound obligations.',
        })
      }
      if (!sameStringSet(task.timePointTempIds, expectedTimePointTempIds)) {
        addIssue('FACT_MUTATION', {
          factType: 'obligation', factId, entityType: 'task', entityId: binding.entityId, field: 'timePointTempIds',
          evidenceIds: strings(fact.evidenceIds), message: 'Task TimePoint relations are not exactly supported by bound obligations.',
        })
      }
      const first = taskObligations[0]
      if (first) {
        validateDeterministicFields({
          actual: task,
          expected: {
            tempId: `task-from-${first.id}`,
            parentTempId: null,
            hierarchyType: 'task',
            title: `${first.actionPredicate}${first.object}`,
            actionVerb: first.actionPredicate,
            actionObject: first.object,
            description: expectedTaskDescription(first, taskConditions),
            completionCriteria: [],
            estimatedMinutes: null,
            statusSuggestion: 'todo',
            prioritySuggestion: 'medium',
            dependencyTempIds: [],
            materialTempIds: expectedMaterialTempIds,
            timePointTempIds: expectedTimePointTempIds,
            evidenceIds: expectedEvidenceIds,
            confidence: 1,
            inferenceLevel: 'explicit',
            userConfirmationRequired: true,
            selected: first.modality === 'required',
          },
          fields: [
            'tempId', 'parentTempId', 'hierarchyType', 'title', 'actionVerb', 'actionObject', 'description',
            'completionCriteria', 'estimatedMinutes', 'statusSuggestion', 'prioritySuggestion', 'dependencyTempIds',
            'materialTempIds', 'timePointTempIds', 'evidenceIds', 'confidence', 'inferenceLevel',
            'userConfirmationRequired', 'selected',
          ],
          factType: 'obligation',
          factId,
          entityType: 'task',
          entityId: binding.entityId,
          evidenceIds: strings(fact.evidenceIds),
          addIssue,
        })
      }
    }
  }

  for (const [entityKey, taskBindings] of bindingsByEntity) {
    if (!entityKey.startsWith('task:')) continue
    const entityId = entityKey.slice('task:'.length)
    const actionable = taskBindings.some((binding) => {
      if (binding.factType !== 'obligation') return false
      return ACTIONABLE_MODALITIES.has(record(binding.fact).modality)
    })
    if (!actionable) {
      addIssue('UNSUPPORTED_TASK', {
        entityType: 'task', entityId, field: 'sourceObligation', message: 'Task is not bound to a required, conditional, or optional obligation.',
      })
    }
  }
}

function validateUnboundTasks(collections, bindingsByEntity, addIssue) {
  for (const task of collections.task) {
    const entityId = text(task.tempId || task.id)
    if (entityId && !bindingsByEntity.has(`task:${entityId}`)) {
      addIssue('UNSUPPORTED_TASK', {
        entityType: 'task', entityId, field: 'traceBinding', evidenceIds: strings(task.evidenceIds),
        message: 'Task has no PlanningTrace source fact binding.',
      })
    }
  }
}

function validateTimeExpressions({
  facts,
  obligations,
  envelopeTimezone,
  bindingsByFact,
  entityIndex,
  resultEvidenceById,
  addIssue,
}) {
  const obligationById = new Map(obligations.map((item) => [text(item.id), item]))
  const alternateIndexById = new Map(facts.filter((item) => !ACTIVE_TIME_ROLES.has(item.role))
    .map((item, index) => [text(item.id), index]))
  for (const fact of facts) {
    const factId = text(fact.id)
    const allBindings = array(bindingsByFact.get(`timeExpression:${factId}`))
    const timeBindings = primaryTimeBindings(allBindings, entityIndex)
    const alternates = alternateTimeBindings(allBindings, entityIndex)
    if (timeBindings.length === 0) {
      const validAlternate = ALTERNATE_TIME_ROLES.has(fact.role) && alternates.some((binding) => {
        const entity = entityIndex.get(targetKey(binding))
        const exact = binding.entityType === 'ambiguity'
          && evidenceCoveredByEntity(fact, binding.entityType, entity, resultEvidenceById)
          && record(entity).field === fact.role
          && record(entity).message === fact.rawText
        if (exact) {
          validateDeterministicFields({
            actual: entity,
            expected: {
              id: `r10-ambiguity-${(alternateIndexById.get(factId) ?? -1) + 1}`,
              field: fact.role,
              message: fact.rawText,
              options: [],
              evidenceIds: sortedUnique(fact.evidenceIds),
            },
            fields: ['id', 'field', 'message', 'options', 'evidenceIds'],
            factType: 'timeExpression',
            factId,
            entityType: 'ambiguity',
            entityId: binding.entityId,
            evidenceIds: strings(fact.evidenceIds),
            addIssue,
          })
        }
        return exact
      })
      if (!validAlternate) {
        addIssue('MISSING_TIMEPOINT', {
          factType: 'timeExpression', factId, field: 'projection', evidenceIds: strings(fact.evidenceIds),
          message: ALTERNATE_TIME_ROLES.has(fact.role)
            ? 'Non-active time fact lacks an evidence-backed ambiguity, conflict, or ignored-content projection.'
            : 'FactLedger time expression has no TimePoint projection.',
        })
      }
      continue
    }
    if (timeBindings.length !== 1) {
      addIssue('FACT_MUTATION', {
        factType: 'timeExpression', factId, field: 'timePointCount', evidenceIds: strings(fact.evidenceIds),
        message: 'One active time fact must project to exactly one TimePoint.',
      })
    }
    for (const binding of timeBindings) {
      const projected = entityIndex.get(targetKey(binding))
      if (projected.type !== fact.role) {
        addIssue('WRONG_TIME_ROLE', {
          factType: 'timeExpression', factId, entityType: 'timePoint', entityId: binding.entityId, field: 'type',
          evidenceIds: strings(fact.evidenceIds), message: `TimePoint role ${projected.type || '(missing)'} differs from FactLedger role ${fact.role}.`,
        })
      }
      if (!timeProjectionHasCorrectValue(fact, projected, envelopeTimezone)) {
        addIssue('FACT_MUTATION', {
          factType: 'timeExpression', factId, entityType: 'timePoint', entityId: binding.entityId, field: 'timeValue',
          evidenceIds: strings(fact.evidenceIds), message: 'TimePoint value or precision differs from the safe FactLedger projection.',
        })
      }
      if (!evidenceCoveredByEntity(fact, 'timePoint', projected, resultEvidenceById)) {
        addIssue('FACT_MUTATION', {
          factType: 'timeExpression', factId, entityType: 'timePoint', entityId: binding.entityId, field: 'evidenceIds',
          evidenceIds: strings(fact.evidenceIds), message: 'TimePoint does not retain all time evidence.',
        })
      }
      const relatedObligationIds = uniqueInOrder([
        ...sortedUnique(fact.relatedObligationIds),
        ...obligations.filter((item) => strings(item.timeExpressionIds).includes(factId)).map((item) => text(item.id)),
      ])
      const relatedTaskTempIds = uniqueInOrder(relatedObligationIds.flatMap((obligationId) => (
        array(bindingsByFact.get(`obligation:${obligationId}`))
          .filter((item) => item.entityType === 'task' && entityIndex.has(targetKey(item)))
          .map((item) => item.entityId)
      ))).slice(0, 30)
      const relatedMaterialTempIds = uniqueInOrder(relatedObligationIds.flatMap((obligationId) => (
        sortedUnique(obligationById.get(obligationId)?.materialIds)
      ))).slice(0, 30)
      const losesPrecision = ['unknown', 'range'].includes(fact.precision)
      validateDeterministicFields({
        actual: projected,
        expected: {
          tempId: fact.id,
          type: fact.role,
          rawText: fact.rawText,
          normalizedValue: losesPrecision ? null : fact.normalizedValue,
          timezone: projectedTimezone(fact, envelopeTimezone),
          isAllDay: fact.precision === 'date_only',
          precision: losesPrecision ? 'vague' : fact.precision,
          needsConfirmation: losesPrecision ? true : fact.needsConfirmation,
          relatedTaskTempIds,
          relatedMaterialTempIds,
          evidenceIds: sortedUnique(fact.evidenceIds),
          confidence: 1,
          selected: !losesPrecision && fact.normalizedValue !== null && !fact.needsConfirmation,
        },
        fields: [
          'tempId', 'type', 'rawText', 'normalizedValue', 'timezone', 'isAllDay', 'precision',
          'needsConfirmation', 'relatedTaskTempIds', 'relatedMaterialTempIds', 'evidenceIds', 'confidence', 'selected',
        ],
        factType: 'timeExpression',
        factId,
        entityType: 'timePoint',
        entityId: binding.entityId,
        evidenceIds: strings(fact.evidenceIds),
        addIssue,
      })
    }
  }
}

function constraintTargetMaterialIds(constraint, materials, obligations) {
  const materialIds = new Set(materials.map((item) => text(item.id)))
  const obligationById = new Map(obligations.map((item) => [text(item.id), item]))
  return new Set([
    ...strings(constraint.appliesToFactIds).filter((id) => materialIds.has(id)),
    ...materials.filter((material) => strings(material.constraintIds).includes(text(constraint.id))).map((material) => text(material.id)),
    ...strings(constraint.appliesToFactIds).flatMap((id) => strings(obligationById.get(id)?.materialIds)),
  ])
}

function structuredConstraintsForMaterial(materialId, constraints, materials, obligations) {
  const alwaysStructured = constraints.filter((constraint) => (
    ['format', 'naming'].includes(constraint.kind)
      && constraintTargetMaterialIds(constraint, materials, obligations).has(materialId)
  ))
  const singleTargetCandidates = (kind) => constraints.filter((constraint) => {
    if (constraint.kind !== kind) return false
    const targets = constraintTargetMaterialIds(constraint, materials, obligations)
    return targets.size === 1 && targets.has(materialId)
  })
  const channelCandidates = singleTargetCandidates('channel')
  const quantityCandidates = singleTargetCandidates('quantity')
  const channelConstraint = channelCandidates.length === 1
    && text(channelCandidates[0].text) && rawString(channelCandidates[0].text).length <= 100
    ? channelCandidates[0]
    : null
  const parsedQuantity = quantityCandidates.length === 1
    ? strictConstraintQuantity(rawString(quantityCandidates[0].text))
    : null
  const quantityConstraint = parsedQuantity === null ? null : quantityCandidates[0]
  const structuredIds = new Set([
    ...alwaysStructured.map((item) => text(item.id)),
    ...(channelConstraint ? [text(channelConstraint.id)] : []),
    ...(quantityConstraint ? [text(quantityConstraint.id)] : []),
  ])
  return {
    constraints: constraints.filter((constraint) => structuredIds.has(text(constraint.id))),
    channelConstraint,
    quantityConstraint,
    parsedQuantity,
  }
}

function structuredConstraintTargetIds(constraint, constraints, materials, obligations) {
  const targets = [...constraintTargetMaterialIds(constraint, materials, obligations)]
  if (['format', 'naming'].includes(constraint.kind)) return targets
  if (!['quantity', 'channel'].includes(constraint.kind) || targets.length !== 1) return []
  const projection = structuredConstraintsForMaterial(targets[0], constraints, materials, obligations)
  return projection.constraints.some((item) => text(item.id) === text(constraint.id)) ? targets : []
}

function validateMaterials({ facts, obligations, constraints, bindingsByFact, entityIndex, resultEvidenceById, addIssue }) {
  const obligationById = new Map(obligations.map((item) => [text(item.id), item]))
  for (const fact of facts) {
    const factId = text(fact.id)
    const bindings = array(bindingsByFact.get(`material:${factId}`))
      .filter((binding) => binding.entityType === 'material' && entityIndex.has(targetKey(binding)))
    if (bindings.length === 0) {
      addIssue('FACT_MUTATION', {
        factType: 'material', factId, field: 'projection', evidenceIds: strings(fact.evidenceIds),
        message: 'FactLedger material has no Material projection.',
      })
      continue
    }
    if (bindings.length !== 1) {
      addIssue('FACT_MUTATION', {
        factType: 'material', factId, field: 'materialCount', evidenceIds: strings(fact.evidenceIds),
        message: 'One FactLedger material must project to exactly one Material.',
      })
    }
    for (const binding of bindings) {
      const projected = entityIndex.get(targetKey(binding))
      const relatedObligationIds = uniqueInOrder([
        ...sortedUnique(fact.obligationIds),
        ...obligations.filter((item) => strings(item.materialIds).includes(factId)).map((item) => text(item.id)),
      ])
      const expectedRequired = fact.role !== 'reference'
        && relatedObligationIds.some((id) => obligationById.get(id)?.modality === 'required')
      const constraintProjection = structuredConstraintsForMaterial(factId, constraints, facts, obligations)
      const materialConstraints = constraintProjection.constraints
      const relatedTaskTempIds = uniqueInOrder(relatedObligationIds.flatMap((obligationId) => (
        array(bindingsByFact.get(`obligation:${obligationId}`))
          .filter((item) => item.entityType === 'task' && entityIndex.has(targetKey(item)))
          .map((item) => item.entityId)
      ))).slice(0, 30)
      const expectedEvidenceIds = uniqueInOrder([
        ...sortedUnique(fact.evidenceIds),
        ...materialConstraints.flatMap((item) => sortedUnique(item.evidenceIds)),
      ])
      if (!sameText(projected.name, fact.name)) {
        addIssue('FACT_MUTATION', {
          factType: 'material', factId, entityType: 'material', entityId: binding.entityId, field: 'name',
          evidenceIds: strings(fact.evidenceIds), message: 'Material name differs from the validated FactLedger name.',
        })
      }
      if (Boolean(projected.required) !== expectedRequired || Boolean(projected.selected) !== expectedRequired) {
        addIssue('FACT_MUTATION', {
          factType: 'material', factId, entityType: 'material', entityId: binding.entityId, field: 'required',
          evidenceIds: strings(fact.evidenceIds),
          message: 'Material required/selected state is not conservative for required, conditional, optional, or reference use.',
        })
      }
      if (!evidenceCoveredByEntity(fact, 'material', projected, resultEvidenceById)) {
        addIssue('FACT_MUTATION', {
          factType: 'material', factId, entityType: 'material', entityId: binding.entityId, field: 'evidenceIds',
          evidenceIds: strings(fact.evidenceIds), message: 'Material does not retain all source evidence.',
        })
      }
      validateDeterministicFields({
        actual: projected,
        expected: {
          tempId: fact.id,
          name: fact.name,
          required: expectedRequired,
          formatRequirements: materialConstraints.filter((item) => item.kind === 'format').map((item) => item.text),
          namingRequirements: materialConstraints.filter((item) => item.kind === 'naming').map((item) => item.text),
          quantity: constraintProjection.parsedQuantity,
          submissionChannel: constraintProjection.channelConstraint?.text ?? null,
          relatedTaskTempIds,
          evidenceIds: expectedEvidenceIds,
          confidence: 1,
          selected: expectedRequired,
        },
        fields: [
          'tempId', 'name', 'required', 'formatRequirements', 'namingRequirements', 'quantity',
          'submissionChannel', 'relatedTaskTempIds', 'evidenceIds', 'confidence', 'selected',
        ],
        factType: 'material',
        factId,
        entityType: 'material',
        entityId: binding.entityId,
        evidenceIds: strings(fact.evidenceIds),
        addIssue,
      })
    }
  }
}

function validateEvents({
  facts,
  bindingsByFact,
  entityIndex,
  resultEvidenceById,
  conditionById,
  canonicalConditionIdsByTarget,
  timeById,
  addIssue,
}) {
  for (const fact of facts) {
    const factId = text(fact.id)
    const bindings = array(bindingsByFact.get(`event:${factId}`))
    const eventBindings = bindings.filter((binding) => binding.entityType === 'event' && entityIndex.has(targetKey(binding)))
    const taskBindings = bindings.filter((binding) => binding.entityType === 'task' && entityIndex.has(targetKey(binding)))
    for (const binding of taskBindings) {
      addIssue('EVENT_TASK_CONFUSION', {
        factType: 'event', factId, entityType: 'task', entityId: binding.entityId, field: 'entityType',
        evidenceIds: strings(fact.evidenceIds), message: 'An Event fact was projected directly as a Task without an obligation.',
      })
    }
    if (eventBindings.length === 0) {
      addIssue('FACT_MUTATION', {
        factType: 'event', factId, field: 'projection', evidenceIds: strings(fact.evidenceIds),
        message: 'FactLedger Event has no Event projection.',
      })
      continue
    }
    if (eventBindings.length !== 1) {
      addIssue('FACT_MUTATION', {
        factType: 'event', factId, field: 'eventCount', evidenceIds: strings(fact.evidenceIds),
        message: 'One FactLedger event must project to exactly one Event.',
      })
    }
    for (const binding of eventBindings) {
      const projected = entityIndex.get(targetKey(binding))
      const startBindings = fact.startTimeExpressionId
        ? array(bindingsByFact.get(`timeExpression:${fact.startTimeExpressionId}`)).filter((item) => item.entityType === 'timePoint')
        : []
      const endBindings = fact.endTimeExpressionId
        ? array(bindingsByFact.get(`timeExpression:${fact.endTimeExpressionId}`)).filter((item) => item.entityType === 'timePoint')
        : []
      const conditions = effectiveConditionIds(fact, canonicalConditionIdsByTarget)
        .map((id) => conditionById.get(id)).filter(Boolean)
      const mutated = projected.title !== fact.title
        || projected.description !== expectedEventDescription(fact, conditions)
        || !sameNullable(projected.location, fact.location)
        || (startBindings.length > 0 && !startBindings.some((item) => item.entityId === projected.startTimePointTempId))
        || (endBindings.length > 0 && !endBindings.some((item) => item.entityId === projected.endTimePointTempId))
      if (mutated) {
        addIssue('FACT_MUTATION', {
          factType: 'event', factId, entityType: 'event', entityId: binding.entityId, field: 'eventFields',
          evidenceIds: strings(fact.evidenceIds), message: 'Event title, description, actor, location, or time relation differs from FactLedger.',
        })
      }
      if (text(fact.actor) && !text(projected.description).split('；').includes(actorSegment(fact.actor))) {
        addIssue('FACT_MUTATION', {
          factType: 'event', factId, entityType: 'event', entityId: binding.entityId, field: 'actor',
          evidenceIds: strings(fact.evidenceIds), message: 'Event dropped or changed its actor.',
        })
      }
      if (!evidenceCoveredByEntity(fact, 'event', projected, resultEvidenceById)) {
        addIssue('FACT_MUTATION', {
          factType: 'event', factId, entityType: 'event', entityId: binding.entityId, field: 'evidenceIds',
          evidenceIds: strings(fact.evidenceIds), message: 'Event does not retain all source evidence.',
        })
      }
      const expectedEvidenceIds = uniqueInOrder([
        ...sortedUnique(fact.evidenceIds),
        ...conditions.flatMap((item) => sortedUnique(item.evidenceIds)),
      ])
      validateDeterministicFields({
        actual: projected,
        expected: {
          tempId: fact.id,
          title: fact.title,
          description: expectedEventDescription(fact, conditions),
          startTimePointTempId: fact.startTimeExpressionId
            && ACTIVE_TIME_ROLES.has(timeById.get(fact.startTimeExpressionId)?.role) ? fact.startTimeExpressionId : null,
          endTimePointTempId: fact.endTimeExpressionId
            && ACTIVE_TIME_ROLES.has(timeById.get(fact.endTimeExpressionId)?.role) ? fact.endTimeExpressionId : null,
          location: fact.location,
          evidenceIds: expectedEvidenceIds,
          confidence: 1,
          inferenceLevel: 'explicit',
          selected: true,
        },
        fields: [
          'tempId', 'title', 'description', 'startTimePointTempId', 'endTimePointTempId', 'location',
          'evidenceIds', 'confidence', 'inferenceLevel', 'selected',
        ],
        factType: 'event',
        factId,
        entityType: 'event',
        entityId: binding.entityId,
        evidenceIds: strings(fact.evidenceIds),
        addIssue,
      })
    }
  }
}

function validateEventLinkedObligations({ obligations, bindingsByFact, entityIndex, addIssue }) {
  for (const obligation of obligations) {
    if (!ACTIONABLE_MODALITIES.has(obligation.modality) || strings(obligation.eventIds).length === 0) continue
    const taskExists = array(bindingsByFact.get(`obligation:${obligation.id}`))
      .some((binding) => binding.entityType === 'task' && entityIndex.has(targetKey(binding)))
    if (taskExists) continue
    const eventExists = strings(obligation.eventIds).some((eventId) => array(bindingsByFact.get(`event:${eventId}`))
      .some((binding) => binding.entityType === 'event' && entityIndex.has(targetKey(binding))))
    if (eventExists) {
      addIssue('EVENT_TASK_CONFUSION', {
        factType: 'obligation', factId: obligation.id, field: 'eventOnlyProjection', evidenceIds: strings(obligation.evidenceIds),
        message: 'The Event was retained but its explicit attendance/action obligation was not projected as a Task.',
      })
    }
  }
}

function validateAmbiguities({ facts, alternateTimeCount, bindingsByFact, entityIndex, resultEvidenceById, addIssue }) {
  for (let index = 0; index < facts.length; index += 1) {
    const fact = facts[index]
    const factId = text(fact.id)
    const bindings = array(bindingsByFact.get(`ambiguity:${factId}`))
      .filter((binding) => binding.entityType === 'ambiguity' && entityIndex.has(targetKey(binding)))
    if (bindings.length === 0) {
      addIssue('MISSING_AMBIGUITY', {
        factType: 'ambiguity', factId, field: 'projection', evidenceIds: strings(fact.evidenceIds),
        message: 'FactLedger ambiguity has no Ambiguity projection.',
      })
      continue
    }
    if (bindings.length !== 1) {
      addIssue('FACT_MUTATION', {
        factType: 'ambiguity', factId, field: 'ambiguityCount', evidenceIds: strings(fact.evidenceIds),
        message: 'One FactLedger ambiguity must project to exactly one Ambiguity.',
      })
    }
    for (const binding of bindings) {
      const projected = entityIndex.get(targetKey(binding))
      if (!sameText(projected.field, fact.code) || !sameText(projected.message, fact.message)
        || !evidenceCoveredByEntity(fact, 'ambiguity', projected, resultEvidenceById)) {
        addIssue('FACT_MUTATION', {
          factType: 'ambiguity', factId, entityType: 'ambiguity', entityId: binding.entityId, field: 'ambiguityFields',
          evidenceIds: strings(fact.evidenceIds), message: 'Ambiguity code, message, or evidence differs from FactLedger.',
        })
      }
      validateDeterministicFields({
        actual: projected,
        expected: {
          id: `r10-ambiguity-${alternateTimeCount + index + 1}`,
          field: fact.code,
          message: fact.message,
          options: [],
          evidenceIds: sortedUnique(fact.evidenceIds),
        },
        fields: ['id', 'field', 'message', 'options', 'evidenceIds'],
        factType: 'ambiguity',
        factId,
        entityType: 'ambiguity',
        entityId: binding.entityId,
        evidenceIds: strings(fact.evidenceIds),
        addIssue,
      })
    }
  }
}

function validateStructuredFacts({ factType, facts, bindingsByFact, entityIndex, resultEvidenceById, addIssue }) {
  for (const fact of facts) {
    const factId = text(fact.id)
    const bindings = array(bindingsByFact.get(`${factType}:${factId}`))
      .filter((binding) => entityIndex.has(targetKey(binding)))
    const exact = bindings.some((binding) => {
      const entity = entityIndex.get(targetKey(binding))
      return entityContainsStructuredText(factType, binding.entityType, entity, fact.text)
        && evidenceCoveredByEntity(fact, binding.entityType, entity, resultEvidenceById)
    })
    if (!exact) {
      addIssue('FACT_MUTATION', {
        factType, factId, field: 'semanticProjection', evidenceIds: strings(fact.evidenceIds),
        message: `${factType} text is not preserved in an evidence-backed structured projection.`,
      })
    }
  }
}

function validateConstraints({ facts, materials, obligations, bindingsByFact, entityIndex, resultEvidenceById, addIssue }) {
  for (const fact of facts) {
    const factId = text(fact.id)
    const bindings = array(bindingsByFact.get(`constraint:${factId}`))
      .filter((binding) => entityIndex.has(targetKey(binding)))
    const expectedEntityIds = structuredConstraintTargetIds(fact, facts, materials, obligations)
      .sort((left, right) => left.localeCompare(right, 'en'))
    if (expectedEntityIds.length > 0) {
      const materialBindings = bindings.filter((binding) => binding.entityType === 'material')
      const actualEntityIds = materialBindings.map((binding) => binding.entityId)
        .sort((left, right) => left.localeCompare(right, 'en'))
      if (canonicalR10Json(actualEntityIds) !== canonicalR10Json(expectedEntityIds)
        || bindings.some((binding) => binding.entityType !== 'material')) {
        addIssue('FACT_MUTATION', {
          factType: 'constraint', factId, field: 'appliesToFactIds', evidenceIds: strings(fact.evidenceIds),
          message: `${fact.kind} constraint is not projected exclusively to its safely determined Material target.`,
        })
      }
      for (const binding of materialBindings) {
        const entity = entityIndex.get(targetKey(binding))
        const field = fact.kind === 'format'
          ? 'formatRequirements'
          : fact.kind === 'naming'
            ? 'namingRequirements'
            : fact.kind === 'channel'
              ? 'submissionChannel'
              : 'quantity'
        const exactValue = ['format', 'naming'].includes(fact.kind)
          ? array(entity[field]).some((value) => value === fact.text)
          : fact.kind === 'channel'
            ? entity[field] === fact.text
            : entity[field] === strictConstraintQuantity(rawString(fact.text))
        if (!exactValue || !evidenceCoveredByEntity(fact, 'material', entity, resultEvidenceById)) {
          addIssue('FACT_MUTATION', {
            factType: 'constraint', factId, entityType: 'material', entityId: binding.entityId, field,
            evidenceIds: strings(fact.evidenceIds), message: `${fact.kind} constraint text or evidence changed in Material.`,
          })
        }
      }
      continue
    }

    const ignoredBindings = bindings.filter((binding) => binding.entityType === 'ignoredContent')
    const expectedReason = ['format', 'naming'].includes(fact.kind) ? 'format_requirement' : 'other'
    const valid = ignoredBindings.length === 1 && bindings.length === 1
      && record(entityIndex.get(targetKey(ignoredBindings[0]))).text === fact.text
      && record(entityIndex.get(targetKey(ignoredBindings[0]))).reason === expectedReason
      && evidenceCoveredByEntity(fact, 'ignoredContent', entityIndex.get(targetKey(ignoredBindings[0])), resultEvidenceById)
    if (!valid) {
      addIssue('FACT_MUTATION', {
        factType: 'constraint', factId, field: 'projectionKind', evidenceIds: strings(fact.evidenceIds),
        message: `${fact.kind} constraint must use the safe structured projection or remain exact ignored content with its relation in PlanningTrace.`,
      })
    }
  }
}

function validateConditionApplications({ conditions, factTypeById, bindingsByFact, entityIndex, addIssue }) {
  for (const condition of conditions) {
    const conditionBindings = array(bindingsByFact.get(`condition:${text(condition.id)}`))
      .filter((binding) => entityIndex.has(targetKey(binding)))
    for (const targetFactId of strings(condition.appliesToFactIds)) {
      const targetFactType = factTypeById.get(targetFactId)
      const targetBindings = targetFactType
        ? array(bindingsByFact.get(`${targetFactType}:${targetFactId}`)).filter((binding) => entityIndex.has(targetKey(binding)))
        : []
      const relationPreserved = targetBindings.length > 0 && conditionBindings.some((conditionBinding) => (
        targetBindings.some((targetBinding) => targetKey(targetBinding) === targetKey(conditionBinding))
      ))
      if (!relationPreserved) {
        addIssue('FACT_MUTATION', {
          factType: 'condition', factId: text(condition.id), field: 'appliesToFactIds',
          evidenceIds: strings(condition.evidenceIds),
          message: `Condition relation to ${targetFactId} is not preserved on the target projection.`,
        })
      }
    }
  }
}

function validateUnboundFactEntities(collections, bindingsByEntity, addIssue) {
  for (const entityType of ['material', 'timePoint', 'event', 'ambiguity', 'conflict']) {
    for (const entity of collections[entityType]) {
      const entityId = text(entity.tempId || entity.id)
      if (entityId && !bindingsByEntity.has(`${entityType}:${entityId}`)) {
        addIssue('FACT_MUTATION', {
          entityType, entityId, field: 'unsupportedProjection', evidenceIds: strings(entity.evidenceIds),
          message: `${entityType} projection has no PlanningTrace source fact binding.`,
        })
      }
    }
  }
}

function issueSummary(issues) {
  const countsByCode = Object.fromEntries(R10_VALIDATOR_ISSUE_CODES.map((code) => [code, 0]))
  for (const issue of issues) countsByCode[issue.code] += 1
  return {
    issueCount: issues.length,
    countsByCode,
    integrityPassed: countsByCode.INTEGRITY_FAILURE === 0,
    safeToProceed: issues.length === 0,
    noIssue: issues.length === 0,
    status: issues.length === 0 ? 'NO_ISSUE' : 'ISSUES_FOUND',
  }
}

export async function validateR10LedgerPlan({ ledger: ledgerValue, result: resultValue, trace: traceValue, ledgerSha256, resultSha256 }) {
  const ledger = record(ledgerValue)
  const result = record(resultValue)
  const trace = record(traceValue)
  const issues = []
  const issueKeys = new Set()
  const addIssue = (code, details = {}) => {
    const issue = {
      code,
      severity: code === 'INTEGRITY_FAILURE' ? 'error' : 'warning',
      repairable: false,
      factType: details.factType ?? null,
      factId: details.factId ?? null,
      entityType: details.entityType ?? null,
      entityId: details.entityId ?? null,
      field: details.field ?? null,
      evidenceIds: strings(details.evidenceIds),
      message: details.message ?? code,
    }
    const key = canonicalR10Json(issue)
    if (!issueKeys.has(key)) {
      issueKeys.add(key)
      issues.push(issue)
    }
  }

  if (!ledgerValue || typeof ledgerValue !== 'object' || Array.isArray(ledgerValue)) {
    addIssue('INTEGRITY_FAILURE', { field: 'ledger', message: 'Validated FactLedger object is required.' })
  }
  if (!resultValue || typeof resultValue !== 'object' || Array.isArray(resultValue) || result.schemaVersion !== '2.0') {
    addIssue('INTEGRITY_FAILURE', { field: 'result.schemaVersion', message: 'RecognitionResult 2.0 object is required.' })
  }
  for (const name of ['milestones', 'standaloneTasks', 'materials', 'timePoints', 'events', 'evidence', 'conflicts', 'ambiguities', 'ignoredContent']) {
    if (!Array.isArray(result[name])) {
      addIssue('INTEGRITY_FAILURE', { field: `result.${name}`, message: `RecognitionResult ${name} must be an array.` })
    }
  }
  if (trace.schemaVersion !== R10_PLANNING_TRACE_SCHEMA_VERSION) {
    addIssue('INTEGRITY_FAILURE', { field: 'trace.schemaVersion', message: 'R10 PlanningTrace schema version is required.' })
  }
  if (!text(trace.plannerVersion)) {
    addIssue('INTEGRITY_FAILURE', { field: 'trace.plannerVersion', message: 'PlanningTrace must bind a non-empty Planner version.' })
  }
  if (!text(ledger.schemaVersion) || trace.ledgerSchemaVersion !== ledger.schemaVersion) {
    addIssue('INTEGRITY_FAILURE', { field: 'trace.ledgerSchemaVersion', message: 'PlanningTrace ledger schema does not match the validated FactLedger.' })
  }
  if (!Array.isArray(trace.bindings)) {
    addIssue('INTEGRITY_FAILURE', { field: 'trace.bindings', message: 'PlanningTrace bindings must be an array.' })
  }
  validateTraceSemantics(trace, ledger, addIssue)

  try {
    const actualLedgerHash = await canonicalR10Sha256(ledgerValue)
    if (!/^[a-f0-9]{64}$/u.test(text(ledgerSha256).toLowerCase()) || actualLedgerHash !== text(ledgerSha256).toLowerCase()) {
      addIssue('INTEGRITY_FAILURE', { field: 'ledgerSha256', message: 'FactLedger hash does not match the supplied canonical SHA-256.' })
    }
  } catch (error) {
    addIssue('INTEGRITY_FAILURE', { field: 'ledgerSha256', message: `FactLedger hash could not be verified: ${error instanceof Error ? error.message : 'unknown error'}.` })
  }
  try {
    const actualResultHash = await canonicalR10Sha256(resultValue)
    if (!/^[a-f0-9]{64}$/u.test(text(resultSha256).toLowerCase()) || actualResultHash !== text(resultSha256).toLowerCase()) {
      addIssue('INTEGRITY_FAILURE', { field: 'resultSha256', message: 'RecognitionResult hash does not match the supplied canonical SHA-256.' })
    }
  } catch (error) {
    addIssue('INTEGRITY_FAILURE', { field: 'resultSha256', message: `RecognitionResult hash could not be verified: ${error instanceof Error ? error.message : 'unknown error'}.` })
  }

  const { index: factIndex, factsByType, factTypeById } = buildFactIndex(ledger, addIssue)
  const { index: entityIndex, collections } = buildEntityIndex(result, addIssue)
  const { ledgerEvidenceById, resultEvidenceById } = resultEvidenceIndex(result, ledger, trace, addIssue)
  validateFactEvidence(factsByType, ledgerEvidenceById, resultEvidenceById, addIssue)
  const conditionById = new Map(factsByType.condition.map((item) => [text(item.id), item]))
  const canonicalConditionIdsByTarget = conditionIdsByTarget(factsByType.condition)
  const timeById = new Map(factsByType.timeExpression.map((item) => [text(item.id), item]))

  const bindingsByFact = new Map()
  const bindingsByEntity = new Map()
  const seenBindings = new Set()
  for (const value of array(trace.bindings)) {
    const binding = record(value)
    const normalized = {
      factType: text(binding.factType), factId: text(binding.factId),
      entityType: text(binding.entityType), entityId: text(binding.entityId),
    }
    const serialized = canonicalR10Json(normalized)
    if (seenBindings.has(serialized)) {
      addIssue('INTEGRITY_FAILURE', { ...normalized, field: 'trace.bindings', message: 'PlanningTrace contains a duplicate binding.' })
      continue
    }
    seenBindings.add(serialized)
    if (!FACT_COLLECTIONS[normalized.factType] || !normalized.factId || !ENTITY_TYPES.has(normalized.entityType) || !normalized.entityId) {
      addIssue('INTEGRITY_FAILURE', { ...normalized, field: 'trace.bindings', message: 'PlanningTrace binding has an unsupported or missing type/identifier.' })
      continue
    }
    const fact = factIndex.get(bindingKey(normalized))
    const entity = entityIndex.get(targetKey(normalized))
    if (!fact) {
      addIssue('INTEGRITY_FAILURE', { ...normalized, field: 'factId', message: 'PlanningTrace references an unknown FactLedger fact.' })
      continue
    }
    if (!entity) {
      addIssue('INTEGRITY_FAILURE', { ...normalized, field: 'entityId', message: 'PlanningTrace references an unknown RecognitionResult entity.' })
      continue
    }
    if (!factEntityTypeAllowed(normalized.factType, fact, normalized.entityType)) {
      addIssue('INTEGRITY_FAILURE', {
        ...normalized,
        field: 'entityType',
        message: normalized.factType === 'obligation'
          ? `PlanningTrace target is incompatible with ${fact.modality || 'unknown'} obligation modality.`
          : 'PlanningTrace binds a fact to an incompatible entity type.',
      })
      continue
    }
    const enriched = { ...normalized, fact, entity }
    const byFact = bindingsByFact.get(bindingKey(normalized)) ?? []
    byFact.push(enriched)
    bindingsByFact.set(bindingKey(normalized), byFact)
    const byEntity = bindingsByEntity.get(targetKey(normalized)) ?? []
    byEntity.push(enriched)
    bindingsByEntity.set(targetKey(normalized), byEntity)
  }

  validateObligations({
    facts: factsByType.obligation,
    bindingsByFact,
    bindingsByEntity,
    entityIndex,
    resultEvidenceById,
    conditionById,
    canonicalConditionIdsByTarget,
    timeById,
    addIssue,
  })
  validateUnboundTasks(collections, bindingsByEntity, addIssue)
  validateTimeExpressions({
    facts: factsByType.timeExpression,
    obligations: factsByType.obligation,
    envelopeTimezone: ledger.timezone,
    bindingsByFact,
    entityIndex,
    resultEvidenceById,
    addIssue,
  })
  validateMaterials({
    facts: factsByType.material,
    obligations: factsByType.obligation,
    constraints: factsByType.constraint,
    bindingsByFact,
    entityIndex,
    resultEvidenceById,
    addIssue,
  })
  validateEvents({
    facts: factsByType.event,
    bindingsByFact,
    entityIndex,
    resultEvidenceById,
    conditionById,
    canonicalConditionIdsByTarget,
    timeById,
    addIssue,
  })
  validateEventLinkedObligations({ obligations: factsByType.obligation, bindingsByFact, entityIndex, addIssue })
  validateAmbiguities({
    facts: factsByType.ambiguity,
    alternateTimeCount: factsByType.timeExpression.filter((item) => !ACTIVE_TIME_ROLES.has(item.role)).length,
    bindingsByFact,
    entityIndex,
    resultEvidenceById,
    addIssue,
  })
  validateStructuredFacts({ factType: 'condition', facts: factsByType.condition, bindingsByFact, entityIndex, resultEvidenceById, addIssue })
  validateConstraints({
    facts: factsByType.constraint,
    materials: factsByType.material,
    obligations: factsByType.obligation,
    bindingsByFact,
    entityIndex,
    resultEvidenceById,
    addIssue,
  })
  validateConditionApplications({
    conditions: factsByType.condition,
    factTypeById,
    bindingsByFact,
    entityIndex,
    addIssue,
  })
  validateUnboundFactEntities(collections, bindingsByEntity, addIssue)

  issues.sort((left, right) => canonicalR10Json(left).localeCompare(canonicalR10Json(right), 'en'))
  return {
    validatorVersion: R10_LEDGER_PLAN_VALIDATOR_VERSION,
    traceSchemaVersion: R10_PLANNING_TRACE_SCHEMA_VERSION,
    repairable: false,
    ...issueSummary(issues),
    issues,
  }
}
