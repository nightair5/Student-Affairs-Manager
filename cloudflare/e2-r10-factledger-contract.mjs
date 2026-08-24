export const R10_FACT_LEDGER_SCHEMA_VERSION = 'e2.5-fact-ledger-1.0.0'
export const R10_FACT_LEDGER_CONTRACT_VERSION = 'e2-r10-fact-ledger-contract-1.1.0'
export const R10_PLANNER_INPUT_SCHEMA_VERSION = 'e2-r10-planner-input-1.1.0'

export const R10_MODALITIES = Object.freeze(['required', 'conditional', 'optional', 'prohibited', 'informational'])
export const R10_MATERIAL_ROLES = Object.freeze(['deliverable', 'required_input', 'carry_item', 'reference'])
export const R10_TIME_ROLES = Object.freeze([
  'registration_deadline', 'submission_deadline', 'task_deadline', 'planned_start',
  'event_start', 'event_end', 'result_announcement', 'superseded_deadline', 'other',
])
export const R10_TIME_PRECISIONS = Object.freeze(['exact', 'date_only', 'range', 'relative', 'vague', 'unknown'])
export const R10_CONDITION_KINDS = Object.freeze(['eligibility', 'prerequisite', 'trigger', 'exception', 'sequence'])
export const R10_CONSTRAINT_KINDS = Object.freeze(['format', 'naming', 'quantity', 'channel', 'location', 'dependency', 'other'])

const LEDGER_COLLECTIONS = Object.freeze([
  'obligations', 'materials', 'timeExpressions', 'events', 'conditions', 'constraints', 'ambiguities', 'evidence',
])

const FACT_KEYS = Object.freeze({
  obligations: ['id', 'actor', 'modality', 'actionPredicate', 'object', 'materialIds', 'timeExpressionIds', 'eventIds', 'conditionIds', 'constraintIds', 'evidenceIds'],
  materials: ['id', 'name', 'role', 'obligationIds', 'constraintIds', 'evidenceIds'],
  timeExpressions: ['id', 'rawText', 'role', 'precision', 'normalizedValue', 'endNormalizedValue', 'timezone', 'needsConfirmation', 'relatedObligationIds', 'relatedEventIds', 'supersedesTimeExpressionId', 'evidenceIds'],
  events: ['id', 'title', 'actor', 'location', 'startTimeExpressionId', 'endTimeExpressionId', 'conditionIds', 'evidenceIds'],
  conditions: ['id', 'kind', 'text', 'appliesToFactIds', 'evidenceIds'],
  constraints: ['id', 'kind', 'text', 'appliesToFactIds', 'evidenceIds'],
  ambiguities: ['id', 'code', 'targetFactIds', 'message', 'evidenceIds'],
  evidence: ['id', 'quote', 'start', 'end'],
})

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function isString(value) {
  return typeof value === 'string'
}

function isNullableString(value) {
  return value === null || isString(value)
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isString)
}

function hasOnlyKeys(value, expected) {
  const keys = Object.keys(value)
  return expected.every((key) => keys.includes(key)) && keys.every((key) => expected.includes(key))
}

function issue(code, path, message) {
  return { code, path, message }
}

function validateShape(name, value) {
  if (!record(value) || !hasOnlyKeys(value, FACT_KEYS[name])) return false
  switch (name) {
    case 'obligations':
      return isString(value.id) && isNullableString(value.actor) && R10_MODALITIES.includes(value.modality)
        && isString(value.actionPredicate) && isString(value.object) && isStringArray(value.materialIds)
        && isStringArray(value.timeExpressionIds) && isStringArray(value.eventIds) && isStringArray(value.conditionIds)
        && isStringArray(value.constraintIds) && isStringArray(value.evidenceIds)
    case 'materials':
      return isString(value.id) && isString(value.name) && R10_MATERIAL_ROLES.includes(value.role)
        && isStringArray(value.obligationIds) && isStringArray(value.constraintIds) && isStringArray(value.evidenceIds)
    case 'timeExpressions':
      return isString(value.id) && isString(value.rawText) && R10_TIME_ROLES.includes(value.role)
        && R10_TIME_PRECISIONS.includes(value.precision) && isNullableString(value.normalizedValue)
        && isNullableString(value.endNormalizedValue) && isNullableString(value.timezone)
        && typeof value.needsConfirmation === 'boolean' && isStringArray(value.relatedObligationIds)
        && isStringArray(value.relatedEventIds) && isNullableString(value.supersedesTimeExpressionId)
        && isStringArray(value.evidenceIds)
    case 'events':
      return isString(value.id) && isString(value.title) && isNullableString(value.actor) && isNullableString(value.location)
        && isNullableString(value.startTimeExpressionId) && isNullableString(value.endTimeExpressionId)
        && isStringArray(value.conditionIds) && isStringArray(value.evidenceIds)
    case 'conditions':
      return isString(value.id) && R10_CONDITION_KINDS.includes(value.kind) && isString(value.text)
        && isStringArray(value.appliesToFactIds) && isStringArray(value.evidenceIds)
    case 'constraints':
      return isString(value.id) && R10_CONSTRAINT_KINDS.includes(value.kind) && isString(value.text)
        && isStringArray(value.appliesToFactIds) && isStringArray(value.evidenceIds)
    case 'ambiguities':
      return isString(value.id) && isString(value.code) && isStringArray(value.targetFactIds)
        && isString(value.message) && isStringArray(value.evidenceIds)
    case 'evidence':
      return isString(value.id) && isString(value.quote) && Number.isInteger(value.start) && Number.isInteger(value.end)
    default:
      return false
  }
}

function validateLedgerLike(value, { plannerInput = false } = {}) {
  const ledger = record(value)
  const issues = []
  if (!ledger) return [issue('STRUCTURE', '$', 'FactLedger must be an object.')]
  const header = plannerInput
    ? ['schemaVersion', 'ledgerSchemaVersion', 'referenceTime', 'timezone', 'sourceLength']
    : ['schemaVersion', 'referenceTime', 'timezone', 'sourceText']
  const expectedTopKeys = [...header, ...LEDGER_COLLECTIONS]
  if (!hasOnlyKeys(ledger, expectedTopKeys)) {
    issues.push(issue('STRUCTURE', '$', `Expected only: ${expectedTopKeys.join(',')}.`))
  }
  if (plannerInput) {
    if (ledger.schemaVersion !== R10_PLANNER_INPUT_SCHEMA_VERSION) {
      issues.push(issue('SCHEMA_VERSION', 'schemaVersion', `Expected ${R10_PLANNER_INPUT_SCHEMA_VERSION}.`))
    }
    if (!Number.isInteger(ledger.sourceLength) || ledger.sourceLength < 0) {
      issues.push(issue('SOURCE_LENGTH', 'sourceLength', 'Planner input sourceLength must be a non-negative integer.'))
    }
    if (ledger.ledgerSchemaVersion !== R10_FACT_LEDGER_SCHEMA_VERSION) {
      issues.push(issue('LEDGER_SCHEMA_VERSION', 'ledgerSchemaVersion', `Expected ${R10_FACT_LEDGER_SCHEMA_VERSION}.`))
    }
    if ('sourceText' in ledger) issues.push(issue('SOURCE_TEXT_FORBIDDEN', 'sourceText', 'Planner input must not contain source text.'))
  } else if (ledger.schemaVersion !== R10_FACT_LEDGER_SCHEMA_VERSION) {
    issues.push(issue('SCHEMA_VERSION', 'schemaVersion', `Expected ${R10_FACT_LEDGER_SCHEMA_VERSION}.`))
  }
  if (!isString(ledger.referenceTime) || !isString(ledger.timezone)) {
    issues.push(issue('ENVELOPE', '$', 'referenceTime and timezone must be strings.'))
  }
  if (!plannerInput && !isString(ledger.sourceText)) issues.push(issue('ENVELOPE', 'sourceText', 'sourceText must be a string.'))

  for (const name of LEDGER_COLLECTIONS) {
    if (!Array.isArray(ledger[name])) {
      issues.push(issue('COLLECTION_REQUIRED', name, `${name} must be an array.`))
      continue
    }
    ledger[name].forEach((entry, index) => {
      if (!validateShape(name, entry)) issues.push(issue('FACT_SHAPE', `${name}[${index}]`, `Invalid ${name} entry.`))
    })
  }
  if (issues.some((item) => ['COLLECTION_REQUIRED', 'FACT_SHAPE'].includes(item.code))) return issues

  const allIds = new Set()
  for (const name of LEDGER_COLLECTIONS) {
    ledger[name].forEach((entry, index) => {
      if (!entry.id.trim()) issues.push(issue('EMPTY_ID', `${name}[${index}].id`, 'Fact id must not be empty.'))
      if (allIds.has(entry.id)) issues.push(issue('DUPLICATE_ID', `${name}[${index}].id`, `Duplicate id ${entry.id}.`))
      allIds.add(entry.id)
    })
  }

  const ids = Object.fromEntries(LEDGER_COLLECTIONS.map((name) => [name, new Set(ledger[name].map((entry) => entry.id))]))
  const factIds = new Set([
    ...ids.obligations, ...ids.materials, ...ids.timeExpressions, ...ids.events, ...ids.conditions, ...ids.constraints,
  ])
  const checkRefs = (values, allowed, path) => values.forEach((id, index) => {
    if (!allowed.has(id)) issues.push(issue('INVALID_REFERENCE', `${path}[${index}]`, `Unknown id ${id}.`))
  })
  const checkEvidence = (entry, path) => {
    if (entry.evidenceIds.length === 0) issues.push(issue('MISSING_EVIDENCE', `${path}.evidenceIds`, 'Every fact requires evidence.'))
    checkRefs(entry.evidenceIds, ids.evidence, `${path}.evidenceIds`)
  }

  ledger.evidence.forEach((entry, index) => {
    const sourceLength = plannerInput ? ledger.sourceLength : ledger.sourceText.length
    if (entry.quote.length === 0 || entry.start < 0 || entry.end <= entry.start || entry.end > sourceLength) {
      issues.push(issue('INVALID_EVIDENCE_SPAN', `evidence[${index}]`, 'Evidence must be non-empty, ordered, and bounded by the source.'))
    } else if (!plannerInput && ledger.sourceText.slice(entry.start, entry.end) !== entry.quote) {
      issues.push(issue('INVALID_EVIDENCE_SPAN', `evidence[${index}]`, 'Evidence must exactly match its source span.'))
    }
  })
  ledger.obligations.forEach((entry, index) => {
    const path = `obligations[${index}]`
    if (!entry.actionPredicate.trim() || !entry.object.trim()) issues.push(issue('MISSING_ACTION', path, 'Obligation requires actionPredicate and object.'))
    checkRefs(entry.materialIds, ids.materials, `${path}.materialIds`)
    checkRefs(entry.timeExpressionIds, ids.timeExpressions, `${path}.timeExpressionIds`)
    checkRefs(entry.eventIds, ids.events, `${path}.eventIds`)
    checkRefs(entry.conditionIds, ids.conditions, `${path}.conditionIds`)
    checkRefs(entry.constraintIds, ids.constraints, `${path}.constraintIds`)
    checkEvidence(entry, path)
  })
  ledger.materials.forEach((entry, index) => {
    const path = `materials[${index}]`
    if (!entry.name.trim()) issues.push(issue('MATERIAL_NAME', `${path}.name`, 'Material name must not be empty.'))
    checkRefs(entry.obligationIds, ids.obligations, `${path}.obligationIds`)
    checkRefs(entry.constraintIds, ids.constraints, `${path}.constraintIds`)
    checkEvidence(entry, path)
  })
  ledger.timeExpressions.forEach((entry, index) => {
    const path = `timeExpressions[${index}]`
    if (!entry.rawText.trim()) issues.push(issue('TIME_TEXT', `${path}.rawText`, 'Time rawText must not be empty.'))
    if (['relative', 'vague', 'unknown'].includes(entry.precision)
      && (entry.normalizedValue !== null || entry.endNormalizedValue !== null || entry.needsConfirmation !== true)) {
      issues.push(issue('UNSAFE_TIME_NORMALIZATION', path, 'Relative, vague, and unknown time must remain null and require confirmation.'))
    }
    if (entry.precision === 'range' && (entry.normalizedValue === null || entry.endNormalizedValue === null)) {
      issues.push(issue('INVALID_TIME_RANGE', path, 'A normalized range requires both endpoints.'))
    }
    checkRefs(entry.relatedObligationIds, ids.obligations, `${path}.relatedObligationIds`)
    checkRefs(entry.relatedEventIds, ids.events, `${path}.relatedEventIds`)
    if (entry.supersedesTimeExpressionId !== null) checkRefs([entry.supersedesTimeExpressionId], ids.timeExpressions, `${path}.supersedesTimeExpressionId`)
    checkEvidence(entry, path)
  })
  ledger.events.forEach((entry, index) => {
    const path = `events[${index}]`
    if (!entry.title.trim()) issues.push(issue('EVENT_TITLE', `${path}.title`, 'Event title must not be empty.'))
    if (entry.startTimeExpressionId !== null) checkRefs([entry.startTimeExpressionId], ids.timeExpressions, `${path}.startTimeExpressionId`)
    if (entry.endTimeExpressionId !== null) checkRefs([entry.endTimeExpressionId], ids.timeExpressions, `${path}.endTimeExpressionId`)
    checkRefs(entry.conditionIds, ids.conditions, `${path}.conditionIds`)
    checkEvidence(entry, path)
  })
  ledger.conditions.forEach((entry, index) => {
    checkRefs(entry.appliesToFactIds, factIds, `conditions[${index}].appliesToFactIds`)
    checkEvidence(entry, `conditions[${index}]`)
  })
  ledger.constraints.forEach((entry, index) => {
    checkRefs(entry.appliesToFactIds, factIds, `constraints[${index}].appliesToFactIds`)
    checkEvidence(entry, `constraints[${index}]`)
  })
  ledger.ambiguities.forEach((entry, index) => {
    checkRefs(entry.targetFactIds, factIds, `ambiguities[${index}].targetFactIds`)
    checkEvidence(entry, `ambiguities[${index}]`)
  })
  return issues
}

export function validateR10FactLedger(value) {
  return validateLedgerLike(value)
}

export function assertR10FactLedger(value) {
  const issues = validateR10FactLedger(value)
  if (issues.length) throw new Error(`R10_FACT_LEDGER_INVALID:${issues.map((item) => `${item.code}@${item.path}`).join(',')}`)
  return value
}

export function validateR10PlannerInput(value) {
  return validateLedgerLike(value, { plannerInput: true })
}

export function assertR10PlannerInput(value) {
  const issues = validateR10PlannerInput(value)
  if (issues.length) throw new Error(`R10_PLANNER_INPUT_INVALID:${issues.map((item) => `${item.code}@${item.path}`).join(',')}`)
  return value
}
