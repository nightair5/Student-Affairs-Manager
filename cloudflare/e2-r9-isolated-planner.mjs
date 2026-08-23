import { planR8RecognitionResult } from './e2-r8-isolated-planner.mjs'
import { assertR8FactGraph } from './e2-r8-planner-contracts.mjs'
import { assertR9PlannedResultContract } from './e2-r9-contract-replay-metrics.mjs'

export const R9_ISOLATED_PLANNER_VERSION = 'e2-r9-isolated-planner-1.0.0'
export const R9_PLAN_CONTRACT_VERSION = 'e2-r9-plan-contract-1.0.0'

function normalizeBusinessText(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/[\s\p{P}\p{S}和及与并的]/gu, '') : ''
}

function unique(values) {
  return [...new Set(values)]
}

function evidenceQuotes(graph, ids) {
  const allowed = new Set(ids)
  return graph.evidence.filter((item) => allowed.has(item.id)).map((item) => item.quote)
}

function quoteOverlap(left, right) {
  return left.some((a) => right.some((b) => a.includes(b) || b.includes(a)))
}

function obligationsEquivalent(graph, left, right) {
  if (normalizeBusinessText(left.actionPredicate) !== normalizeBusinessText(right.actionPredicate)) return false
  if (normalizeBusinessText(left.object) !== normalizeBusinessText(right.object)) return false
  const sharedEvent = left.eventIds.some((id) => right.eventIds.includes(id))
  const sharedLiteral = quoteOverlap(evidenceQuotes(graph, left.evidenceIds), evidenceQuotes(graph, right.evidenceIds))
  return sharedEvent || sharedLiteral
}

function mergeObligation(target, source) {
  target.materialIds = unique([...target.materialIds, ...source.materialIds])
  target.timePointIds = unique([...target.timePointIds, ...source.timePointIds])
  target.eventIds = unique([...target.eventIds, ...source.eventIds])
  target.conditionIds = unique([...target.conditionIds, ...source.conditionIds])
  target.evidenceIds = unique([...target.evidenceIds, ...source.evidenceIds])
  target.confidence = Math.max(target.confidence, source.confidence)
  if (target.provenance !== 'cached_model_task' && source.provenance === 'cached_model_task') {
    const semantic = {
      materialIds: target.materialIds, timePointIds: target.timePointIds, eventIds: target.eventIds,
      conditionIds: target.conditionIds, evidenceIds: target.evidenceIds, confidence: target.confidence,
    }
    Object.assign(target, source, semantic)
  }
}

function collapseEquivalentObligations(graph) {
  const collapsed = []
  const canonicalIdByOriginalId = new Map()
  for (const obligation of graph.obligations) {
    const existing = collapsed.find((item) => obligationsEquivalent(graph, item, obligation))
    if (existing) {
      mergeObligation(existing, obligation)
      canonicalIdByOriginalId.set(obligation.id, existing.id)
    } else {
      const copy = structuredClone(obligation)
      collapsed.push(copy)
      canonicalIdByOriginalId.set(obligation.id, copy.id)
    }
  }
  return { obligations: collapsed, canonicalIdByOriginalId }
}

function redirectPlannerViewReferences(graph, canonicalIdByOriginalId) {
  const redirect = (ids) => unique(ids.map((id) => canonicalIdByOriginalId.get(id) ?? id))
  for (const material of graph.materials) material.obligationIds = redirect(material.obligationIds)
  for (const timePoint of graph.timePoints) timePoint.relatedObligationIds = redirect(timePoint.relatedObligationIds)
  for (const condition of graph.conditions) condition.appliesToFactIds = redirect(condition.appliesToFactIds)
  for (const ambiguity of graph.ambiguities) ambiguity.targetFactIds = redirect(ambiguity.targetFactIds)
  const retainedIds = new Set(graph.obligations.map((item) => item.id))
  for (const obligation of graph.obligations) {
    if (obligation.parentObligationId) obligation.parentObligationId = canonicalIdByOriginalId.get(obligation.parentObligationId) ?? obligation.parentObligationId
    if (obligation.parentObligationId === obligation.id || !retainedIds.has(obligation.parentObligationId)) obligation.parentObligationId = null
  }
}

function ambiguityRelatesToCondition(graph, ambiguity, condition) {
  if (ambiguity.targetFactIds.includes(condition.id)) return true
  const ambiguityEvidence = evidenceQuotes(graph, ambiguity.evidenceIds)
  const conditionEvidence = evidenceQuotes(graph, condition.evidenceIds)
  if (!quoteOverlap(ambiguityEvidence, conditionEvidence)) return false
  return /(?:适用|条件|资格|录用|入选|符合|满足|通过)/u.test(ambiguity.message)
}

function collapseEquivalentAmbiguities(graph) {
  const remaining = graph.ambiguities.map((item) => structuredClone(item))
  const output = []
  const consumed = new Set()
  for (const condition of graph.conditions) {
    const related = remaining.filter((item) => !consumed.has(item.id) && ambiguityRelatesToCondition(graph, item, condition))
    if (related.length === 0) continue
    const preferred = related.find((item) => item.code !== 'CONDITION_APPLICABILITY_UNKNOWN') ?? related[0]
    const merged = structuredClone(preferred)
    merged.evidenceIds = unique(related.flatMap((item) => item.evidenceIds))
    merged.targetFactIds = unique([...related.flatMap((item) => item.targetFactIds), condition.id])
    merged.options = unique(related.flatMap((item) => item.options))
    output.push(merged)
    related.forEach((item) => consumed.add(item.id))
  }
  output.push(...remaining.filter((item) => !consumed.has(item.id)))
  return output
}

function flattenTasks(result) {
  return [
    ...(Array.isArray(result.standaloneTasks) ? result.standaloneTasks : []),
    ...(Array.isArray(result.milestones) ? result.milestones.flatMap((milestone) => [
      ...(Array.isArray(milestone.tasks) ? milestone.tasks : []),
      ...(Array.isArray(milestone.workPackages) ? milestone.workPackages.flatMap((workPackage) => workPackage.tasks ?? []) : []),
    ]) : []),
  ]
}

function taskMatches(task, obligation) {
  return normalizeBusinessText(task.actionVerb) === normalizeBusinessText(obligation.actionPredicate)
    && normalizeBusinessText(task.actionObject) === normalizeBusinessText(obligation.object)
}

export function planR9RecognitionResult(graph, options = {}) {
  assertR8FactGraph(graph)
  const plannerView = structuredClone(graph)
  const collapsed = collapseEquivalentObligations(graph)
  plannerView.obligations = collapsed.obligations
  plannerView.ambiguities = collapseEquivalentAmbiguities(graph)
  redirectPlannerViewReferences(plannerView, collapsed.canonicalIdByOriginalId)
  const result = planR8RecognitionResult(plannerView, options)
  for (const task of flattenTasks(result)) {
    const obligations = graph.obligations.filter((item) => taskMatches(task, item))
    if (obligations.some((item) => item.provenance === 'literal_source_action')) {
      task.inferenceLevel = 'explicit'
      task.selected = obligations.some((item) => item.modality === 'required')
    }
  }
  result.plannerContractVersion = R9_PLAN_CONTRACT_VERSION
  result.quality.duplicateRisk = Math.max(0, graph.obligations.length - plannerView.obligations.length)
  return assertR9PlannedResultContract(result, graph)
}
