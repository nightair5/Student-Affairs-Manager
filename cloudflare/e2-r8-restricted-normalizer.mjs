import { assertR8FactGraph } from './e2-r8-planner-contracts.mjs'

export const R8_RESTRICTED_NORMALIZER_VERSION = 'e2-r8-restricted-normalizer-1.0.0'
export const R8_NORMALIZER_PERMISSIONS = Object.freeze({
  mayAddOrDeleteFacts: false,
  mayChangeActionPredicateOrObject: false,
  mayChangeTimeRoleOrValue: false,
  mayChangeConditionOrAmbiguityMeaning: false,
  mayDeduplicateReferences: true,
  mayDropDanglingReferences: true,
  mayCloseExistingBidirectionalRelations: true,
})

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

function semanticSnapshot(graph) {
  return JSON.stringify(canonical({
    obligations: graph.obligations.map((item) => ({
      id: item.id, actor: item.actor, modality: item.modality,
      actionPredicate: item.actionPredicate, object: item.object, evidenceIds: item.evidenceIds,
    })),
    materials: graph.materials.map((item) => ({ id: item.id, name: item.name, role: item.role, required: item.required, evidenceIds: item.evidenceIds })),
    timePoints: graph.timePoints.map((item) => ({
      id: item.id, role: item.role, rawText: item.rawText, normalizedValue: item.normalizedValue,
      precision: item.precision, needsConfirmation: item.needsConfirmation, evidenceIds: item.evidenceIds,
    })),
    events: graph.events.map((item) => ({ id: item.id, title: item.title, location: item.location, evidenceIds: item.evidenceIds })),
    conditions: graph.conditions.map((item) => ({ id: item.id, kind: item.kind, text: item.text, evidenceIds: item.evidenceIds })),
    ambiguities: graph.ambiguities.map((item) => ({ id: item.id, code: item.code, message: item.message, options: item.options, evidenceIds: item.evidenceIds })),
    evidence: graph.evidence,
  }))
}

function uniqueSorted(values, allowed) {
  return [...new Set(values.filter((id) => allowed.has(id)))].sort((left, right) => left.localeCompare(right, 'en'))
}

export function normalizeR8FactGraphReferences(graph) {
  assertR8FactGraph(graph)
  const normalized = structuredClone(graph)
  const before = semanticSnapshot(normalized)
  const obligationIds = new Set(normalized.obligations.map((item) => item.id))
  const materialIds = new Set(normalized.materials.map((item) => item.id))
  const timeIds = new Set(normalized.timePoints.map((item) => item.id))
  const eventIds = new Set(normalized.events.map((item) => item.id))
  const conditionIds = new Set(normalized.conditions.map((item) => item.id))

  for (const item of normalized.obligations) {
    item.materialIds = uniqueSorted(item.materialIds, materialIds)
    item.timePointIds = uniqueSorted(item.timePointIds, timeIds)
    item.eventIds = uniqueSorted(item.eventIds, eventIds)
    item.conditionIds = uniqueSorted(item.conditionIds, conditionIds)
  }
  for (const item of normalized.materials) item.obligationIds = uniqueSorted(item.obligationIds, obligationIds)
  for (const item of normalized.timePoints) {
    item.relatedObligationIds = uniqueSorted(item.relatedObligationIds, obligationIds)
    item.relatedMaterialIds = uniqueSorted(item.relatedMaterialIds, materialIds)
    item.relatedEventIds = uniqueSorted(item.relatedEventIds, eventIds)
  }
  for (const item of normalized.events) item.conditionIds = uniqueSorted(item.conditionIds, conditionIds)

  const obligationById = new Map(normalized.obligations.map((item) => [item.id, item]))
  const materialById = new Map(normalized.materials.map((item) => [item.id, item]))
  const timeById = new Map(normalized.timePoints.map((item) => [item.id, item]))
  for (const material of normalized.materials) {
    for (const obligationId of material.obligationIds) obligationById.get(obligationId).materialIds.push(material.id)
  }
  for (const obligation of normalized.obligations) {
    for (const materialId of obligation.materialIds) materialById.get(materialId).obligationIds.push(obligation.id)
    for (const timeId of obligation.timePointIds) timeById.get(timeId).relatedObligationIds.push(obligation.id)
  }
  for (const timePoint of normalized.timePoints) {
    for (const obligationId of timePoint.relatedObligationIds) obligationById.get(obligationId).timePointIds.push(timePoint.id)
  }
  for (const item of normalized.obligations) {
    item.materialIds = uniqueSorted(item.materialIds, materialIds)
    item.timePointIds = uniqueSorted(item.timePointIds, timeIds)
  }
  for (const item of normalized.materials) item.obligationIds = uniqueSorted(item.obligationIds, obligationIds)
  for (const item of normalized.timePoints) item.relatedObligationIds = uniqueSorted(item.relatedObligationIds, obligationIds)

  if (semanticSnapshot(normalized) !== before) throw new Error('R8_NORMALIZER_SEMANTIC_MUTATION_FORBIDDEN')
  return assertR8FactGraph(normalized)
}
