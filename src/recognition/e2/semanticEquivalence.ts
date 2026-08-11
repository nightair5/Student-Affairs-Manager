export const SEMANTIC_EQUIVALENCE_VERSION = 'e2.7-semantic-equivalence-1.0.0'

export type SemanticEntityKind = 'task' | 'milestone' | 'material' | 'event' | 'timePoint' | 'channel'

export type SemanticEquivalenceCategory =
  | 'TASK_TITLE_ALIAS'
  | 'TASK_GROUPING_EQUIVALENT'
  | 'TASK_SPLIT_EQUIVALENT'
  | 'MILESTONE_ALIAS'
  | 'MILESTONE_GROUPING_EQUIVALENT'
  | 'MATERIAL_ALIAS'
  | 'EVENT_TITLE_ALIAS'
  | 'DATE_ONLY_EQUIVALENT'
  | 'CHANNEL_ALIAS'

export interface SemanticPreservationChecks {
  actionPredicate: boolean
  object: boolean
  actor: boolean
  modality: boolean
  condition: boolean
  deadline: boolean
  channel: boolean
  independentCompletion: boolean
  eventTaskBoundary: boolean
  literalEvidence: boolean
  taskCoverage: boolean
  timePointCoverage: boolean
  eventCoverage: boolean
  order: boolean
  timeRole: boolean
  timeValue: boolean
  uncertainty: boolean
  relation: boolean
}

export interface SemanticEquivalenceDecision {
  category: SemanticEquivalenceCategory
  entityKind: SemanticEntityKind
  expectedKeys: string[]
  actualIds: string[]
  approved: boolean
  checks: SemanticPreservationChecks
  rationale: string
  reviewerId: string
}

export interface SemanticEntityScoreInput {
  entityKind: SemanticEntityKind
  expectedKeys: string[]
  actualIds: string[]
  strictMatchedExpectedKeys: string[]
  strictMatchedActualIds: string[]
  decisions: SemanticEquivalenceDecision[]
}

export interface SemanticEntityScore {
  version: typeof SEMANTIC_EQUIVALENCE_VERSION
  entityKind: SemanticEntityKind
  expectedCount: number
  predictedCount: number
  matchedExpectedCount: number
  matchedActualCount: number
  precision: number
  recall: number
  acceptedDecisionCount: number
  rejected: Array<{ category: SemanticEquivalenceCategory; reason: string }>
}

const CATEGORY_KIND: Record<SemanticEquivalenceCategory, SemanticEntityKind> = {
  TASK_TITLE_ALIAS: 'task',
  TASK_GROUPING_EQUIVALENT: 'task',
  TASK_SPLIT_EQUIVALENT: 'task',
  MILESTONE_ALIAS: 'milestone',
  MILESTONE_GROUPING_EQUIVALENT: 'milestone',
  MATERIAL_ALIAS: 'material',
  EVENT_TITLE_ALIAS: 'event',
  DATE_ONLY_EQUIVALENT: 'timePoint',
  CHANNEL_ALIAS: 'channel',
}

const TASK_FACT_CHECKS: Array<keyof SemanticPreservationChecks> = [
  'actionPredicate',
  'object',
  'actor',
  'modality',
  'condition',
  'deadline',
  'channel',
  'independentCompletion',
  'eventTaskBoundary',
  'literalEvidence',
]

const MILESTONE_FACT_CHECKS: Array<keyof SemanticPreservationChecks> = [
  'taskCoverage',
  'timePointCoverage',
  'eventCoverage',
  'order',
  'eventTaskBoundary',
  'literalEvidence',
]

const TIME_FACT_CHECKS: Array<keyof SemanticPreservationChecks> = [
  'timeRole',
  'timeValue',
  'uncertainty',
  'relation',
  'literalEvidence',
]

function uniqueNonEmpty(values: string[]): boolean {
  return values.length > 0 && values.every((value) => value.trim().length > 0) && new Set(values).size === values.length
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator
}

export function validateSemanticEquivalenceDecision(
  decision: SemanticEquivalenceDecision,
): { valid: true } | { valid: false; reason: string } {
  if (!decision.approved) return { valid: false, reason: 'decision_not_approved' }
  if (CATEGORY_KIND[decision.category] !== decision.entityKind) return { valid: false, reason: 'category_entity_mismatch' }
  if (!uniqueNonEmpty(decision.expectedKeys) || !uniqueNonEmpty(decision.actualIds)) {
    return { valid: false, reason: 'empty_or_duplicate_identity' }
  }
  if (!decision.reviewerId.trim() || !decision.rationale.trim()) return { valid: false, reason: 'missing_review_provenance' }
  if (!decision.checks.literalEvidence) return { valid: false, reason: 'literal_evidence_not_preserved' }
  if (!decision.checks.eventTaskBoundary) return { valid: false, reason: 'event_task_boundary_changed' }

  if (decision.entityKind === 'task') {
    const failed = TASK_FACT_CHECKS.find((check) => !decision.checks[check])
    if (failed) return { valid: false, reason: `task_fact_not_preserved:${failed}` }
  }
  if (decision.entityKind === 'milestone') {
    const failed = MILESTONE_FACT_CHECKS.find((check) => !decision.checks[check])
    if (failed) return { valid: false, reason: `milestone_fact_not_preserved:${failed}` }
  }
  if (decision.entityKind === 'timePoint') {
    const failed = TIME_FACT_CHECKS.find((check) => !decision.checks[check])
    if (failed) return { valid: false, reason: `time_fact_not_preserved:${failed}` }
  }
  if (decision.entityKind === 'material' && !decision.checks.object) {
    return { valid: false, reason: 'material_object_not_preserved' }
  }
  if (decision.entityKind === 'event' && !decision.checks.eventCoverage) {
    return { valid: false, reason: 'event_fact_not_preserved:eventCoverage' }
  }
  if (decision.entityKind === 'channel' && !decision.checks.channel) {
    return { valid: false, reason: 'channel_not_preserved' }
  }
  if (decision.category === 'TASK_GROUPING_EQUIVALENT'
    && (decision.expectedKeys.length < 2 || decision.actualIds.length !== 1)) {
    return { valid: false, reason: 'invalid_task_grouping_cardinality' }
  }
  if (decision.category === 'TASK_SPLIT_EQUIVALENT'
    && (decision.expectedKeys.length !== 1 || decision.actualIds.length < 2)) {
    return { valid: false, reason: 'invalid_task_split_cardinality' }
  }
  if (decision.category === 'MILESTONE_GROUPING_EQUIVALENT'
    && decision.expectedKeys.length < 2 && decision.actualIds.length < 2) {
    return { valid: false, reason: 'invalid_milestone_grouping_cardinality' }
  }
  if (['TASK_TITLE_ALIAS', 'MILESTONE_ALIAS', 'MATERIAL_ALIAS', 'EVENT_TITLE_ALIAS', 'DATE_ONLY_EQUIVALENT', 'CHANNEL_ALIAS'].includes(decision.category)
    && (decision.expectedKeys.length !== 1 || decision.actualIds.length !== 1)) {
    return { valid: false, reason: 'alias_requires_one_to_one' }
  }
  return { valid: true }
}

export function scoreSemanticEntity(input: SemanticEntityScoreInput): SemanticEntityScore {
  const expectedUniverse = new Set(input.expectedKeys)
  const actualUniverse = new Set(input.actualIds)
  const matchedExpected = new Set(input.strictMatchedExpectedKeys.filter((key) => expectedUniverse.has(key)))
  const matchedActual = new Set(input.strictMatchedActualIds.filter((id) => actualUniverse.has(id)))
  const rejected: SemanticEntityScore['rejected'] = []
  let acceptedDecisionCount = 0

  for (const decision of input.decisions) {
    const validity = validateSemanticEquivalenceDecision(decision)
    if (!validity.valid) {
      rejected.push({ category: decision.category, reason: validity.reason })
      continue
    }
    if (decision.entityKind !== input.entityKind) {
      rejected.push({ category: decision.category, reason: 'score_entity_mismatch' })
      continue
    }
    if (decision.expectedKeys.some((key) => !expectedUniverse.has(key))
      || decision.actualIds.some((id) => !actualUniverse.has(id))) {
      rejected.push({ category: decision.category, reason: 'identity_outside_case' })
      continue
    }
    decision.expectedKeys.forEach((key) => matchedExpected.add(key))
    decision.actualIds.forEach((id) => matchedActual.add(id))
    acceptedDecisionCount += 1
  }

  return {
    version: SEMANTIC_EQUIVALENCE_VERSION,
    entityKind: input.entityKind,
    expectedCount: expectedUniverse.size,
    predictedCount: actualUniverse.size,
    matchedExpectedCount: matchedExpected.size,
    matchedActualCount: matchedActual.size,
    precision: ratio(matchedActual.size, actualUniverse.size),
    recall: ratio(matchedExpected.size, expectedUniverse.size),
    acceptedDecisionCount,
    rejected,
  }
}
