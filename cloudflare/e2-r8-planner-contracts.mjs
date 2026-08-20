export const R8_FACT_CONTRACT_VERSION = 'e2-r8-fact-contract-1.0.0'
export const R8_PLAN_CONTRACT_VERSION = 'e2-r8-plan-contract-1.0.0'
export const R8_ENTITY_CONTRACT_VERSIONS = Object.freeze({
  Fact: 'e2-r8-fact-1.0.0', Task: 'e2-r8-task-1.0.0', Event: 'e2-r8-event-1.0.0',
  Material: 'e2-r8-material-1.0.0', TimePoint: 'e2-r8-timepoint-1.0.0',
  Condition: 'e2-r8-condition-1.0.0', Ambiguity: 'e2-r8-ambiguity-1.0.0',
})
export const R8_ENTITY_AUTHORITY = Object.freeze({
  Fact: 'extractor', Task: 'planner', Event: 'extractor', Material: 'extractor',
  TimePoint: 'extractor', Condition: 'extractor', Ambiguity: 'extractor',
})

export const R8_FACT_KINDS = Object.freeze([
  'obligation', 'material', 'timePoint', 'event', 'condition', 'ambiguity', 'evidence',
])
export const R8_MODALITIES = Object.freeze(['required', 'conditional', 'optional', 'prohibited', 'informational'])
export const R8_TIME_ROLES = Object.freeze([
  'registration_deadline', 'submission_deadline', 'task_deadline', 'event_start',
  'event_end', 'result_announcement', 'planned_start',
])
export const R8_TIME_PRECISIONS = Object.freeze(['exact', 'date_only', 'relative', 'vague'])
export const R8_CONDITION_KINDS = Object.freeze(['eligibility', 'prerequisite', 'trigger', 'exception', 'sequence'])

function duplicateIds(graph) {
  const ids = [
    ...graph.obligations, ...graph.materials, ...graph.timePoints, ...graph.events,
    ...graph.conditions, ...graph.ambiguities, ...graph.evidence,
  ].map((item) => item.id)
  return ids.filter((id, index) => ids.indexOf(id) !== index)
}

function exactEvidence(graph, item) {
  return item.evidenceIds.length > 0 && item.evidenceIds.every((id) => {
    const evidence = graph.evidence.find((entry) => entry.id === id)
    return evidence && graph.sourceText.slice(evidence.start, evidence.end) === evidence.quote
  })
}

function missingReferences(values, allowed) {
  return values.filter((id) => !allowed.has(id))
}

export function validateR8FactGraph(graph) {
  const issues = []
  if (!graph || typeof graph !== 'object' || graph.schemaVersion !== R8_FACT_CONTRACT_VERSION) {
    return [{ code: 'FACT_SCHEMA_VERSION', path: '$', message: 'R8 fact contract version is required.' }]
  }
  for (const name of ['obligations', 'materials', 'timePoints', 'events', 'conditions', 'ambiguities', 'evidence']) {
    if (!Array.isArray(graph[name])) issues.push({ code: 'FACT_COLLECTION_REQUIRED', path: name, message: `${name} must be an array.` })
  }
  if (issues.length) return issues
  for (const id of duplicateIds(graph)) issues.push({ code: 'FACT_DUPLICATE_ID', path: id, message: 'Fact IDs must be globally unique.' })

  const obligationIds = new Set(graph.obligations.map((item) => item.id))
  const materialIds = new Set(graph.materials.map((item) => item.id))
  const timeIds = new Set(graph.timePoints.map((item) => item.id))
  const eventIds = new Set(graph.events.map((item) => item.id))
  const conditionIds = new Set(graph.conditions.map((item) => item.id))
  const allFactIds = new Set([...obligationIds, ...materialIds, ...timeIds, ...eventIds, ...conditionIds])

  for (const item of graph.evidence) {
    if (!item.quote || item.start < 0 || item.end <= item.start || graph.sourceText.slice(item.start, item.end) !== item.quote) {
      issues.push({ code: 'FACT_EVIDENCE_NOT_LITERAL', path: item.id, message: 'Evidence must be an exact source span.' })
    }
  }
  for (const item of graph.obligations) {
    if (!R8_MODALITIES.includes(item.modality) || !item.actionPredicate || !item.object) {
      issues.push({ code: 'FACT_OBLIGATION_INVALID', path: item.id, message: 'Obligation requires modality, action predicate, and object.' })
    }
    if (!exactEvidence(graph, item)) issues.push({ code: 'FACT_EVIDENCE_MISSING', path: item.id, message: 'Obligation requires literal evidence.' })
    for (const [field, values, allowed] of [
      ['materialIds', item.materialIds, materialIds], ['timePointIds', item.timePointIds, timeIds],
      ['eventIds', item.eventIds, eventIds], ['conditionIds', item.conditionIds, conditionIds],
    ]) {
      if (missingReferences(values, allowed).length) issues.push({ code: 'FACT_REFERENCE_INVALID', path: `${item.id}.${field}`, message: 'Unknown fact reference.' })
    }
  }
  for (const item of graph.materials) {
    if (!item.name || !['deliverable', 'required_input', 'carry_item', 'reference'].includes(item.role) || !exactEvidence(graph, item)) {
      issues.push({ code: 'FACT_MATERIAL_INVALID', path: item.id, message: 'Material requires a role and literal evidence.' })
    }
    if (missingReferences(item.obligationIds, obligationIds).length) issues.push({ code: 'FACT_REFERENCE_INVALID', path: `${item.id}.obligationIds`, message: 'Unknown obligation reference.' })
  }
  for (const item of graph.timePoints) {
    if (!R8_TIME_ROLES.includes(item.role) || !R8_TIME_PRECISIONS.includes(item.precision) || !exactEvidence(graph, item)) {
      issues.push({ code: 'FACT_TIME_INVALID', path: item.id, message: 'TimePoint requires role, precision, and literal evidence.' })
    }
    if (['relative', 'vague'].includes(item.precision) && (item.normalizedValue !== null || !item.needsConfirmation)) {
      issues.push({ code: 'FACT_FALSE_TIME_PRECISION', path: item.id, message: 'Relative and vague time must remain null and require confirmation.' })
    }
    if (missingReferences(item.relatedObligationIds, obligationIds).length || missingReferences(item.relatedEventIds, eventIds).length) {
      issues.push({ code: 'FACT_REFERENCE_INVALID', path: item.id, message: 'Unknown time relation.' })
    }
  }
  for (const item of graph.events) {
    if (!item.title || !exactEvidence(graph, item)) issues.push({ code: 'FACT_EVENT_INVALID', path: item.id, message: 'Event requires a title and literal evidence.' })
    if (item.startTimePointId && !timeIds.has(item.startTimePointId)) issues.push({ code: 'FACT_REFERENCE_INVALID', path: `${item.id}.startTimePointId`, message: 'Unknown start time.' })
    if (item.endTimePointId && !timeIds.has(item.endTimePointId)) issues.push({ code: 'FACT_REFERENCE_INVALID', path: `${item.id}.endTimePointId`, message: 'Unknown end time.' })
    if (missingReferences(item.conditionIds, conditionIds).length) issues.push({ code: 'FACT_REFERENCE_INVALID', path: `${item.id}.conditionIds`, message: 'Unknown condition.' })
  }
  for (const item of graph.conditions) {
    if (!R8_CONDITION_KINDS.includes(item.kind) || !item.text || !exactEvidence(graph, item)) issues.push({ code: 'FACT_CONDITION_INVALID', path: item.id, message: 'Condition requires kind, text, and literal evidence.' })
    if (missingReferences(item.appliesToFactIds, allFactIds).length) issues.push({ code: 'FACT_REFERENCE_INVALID', path: `${item.id}.appliesToFactIds`, message: 'Unknown condition target.' })
  }
  for (const item of graph.ambiguities) {
    if (!item.code || !item.message || !exactEvidence(graph, item)) issues.push({ code: 'FACT_AMBIGUITY_INVALID', path: item.id, message: 'Ambiguity requires code, message, and literal evidence.' })
    if (missingReferences(item.targetFactIds, allFactIds).length) issues.push({ code: 'FACT_REFERENCE_INVALID', path: `${item.id}.targetFactIds`, message: 'Unknown ambiguity target.' })
  }
  return issues
}

export function assertR8FactGraph(graph) {
  const issues = validateR8FactGraph(graph)
  if (issues.length) throw new Error(`R8_FACT_GRAPH_INVALID:${issues.map((item) => `${item.code}@${item.path}`).join(',')}`)
  return graph
}
