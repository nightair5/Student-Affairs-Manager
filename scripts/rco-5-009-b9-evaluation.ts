export type B9LocalDisposition = 'local_proposition' | 'local_non_task' | 'needs_model'
export type B9ResponseVerdict = 'proposition' | 'mention_only' | 'uncertain'
export type B9LedgerStatus = 'accepted_local' | 'accepted_model' | 'ignored_local' | 'ignored_model' | 'quarantined'
export type B9SemanticLabel = 'CURRENT' | 'HISTORICAL' | 'SUPERSEDED' | 'UNKNOWN' | 'CONDITION_UNKNOWN'
export type B9ConditionStatus = 'none' | 'attached_unique' | 'no_match' | 'ambiguous'
export type B9ConditionTruth = 'none' | 'true' | 'false' | 'unknown'

export interface B9Semantics {
  actor: 'addressee' | 'addressed_group' | 'issuer' | 'third_party' | 'unknown'
  speechAct: 'directive' | 'assertive' | 'interrogative' | 'hypothetical' | 'quoted' | 'unknown'
  polarity: 'affirmative' | 'negative' | 'uncertain'
  tense: 'future' | 'present' | 'past' | 'unknown'
  status: 'pending' | 'completed' | 'cancelled' | 'unknown'
  validity: 'active' | 'superseded' | 'uncertain'
  modality: 'required' | 'recommended' | 'optional' | 'informational' | 'unknown'
}

export const B9_SEMANTICS_BY_LABEL: Record<B9SemanticLabel, B9Semantics> = {
  CURRENT: {
    actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future',
    status: 'pending', validity: 'active', modality: 'required',
  },
  HISTORICAL: {
    actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'past',
    status: 'unknown', validity: 'uncertain', modality: 'required',
  },
  SUPERSEDED: {
    actor: 'addressee', speechAct: 'directive', polarity: 'negative', tense: 'past',
    status: 'cancelled', validity: 'superseded', modality: 'required',
  },
  UNKNOWN: {
    actor: 'unknown', speechAct: 'unknown', polarity: 'uncertain', tense: 'unknown',
    status: 'unknown', validity: 'uncertain', modality: 'unknown',
  },
  CONDITION_UNKNOWN: {
    actor: 'addressee', speechAct: 'hypothetical', polarity: 'uncertain', tense: 'future',
    status: 'unknown', validity: 'uncertain', modality: 'required',
  },
}

export interface B9ExpectedCandidate {
  key: string
  action: string
  occurrence: number
  object: string | null
  localDisposition: B9LocalDisposition
  responseVerdict: B9ResponseVerdict
  responseObject: 'own' | string | null
}

export interface B9ExpectedTask {
  candidateKey: string
  action: string
  object: string
  semanticLabel: B9SemanticLabel
  selected: boolean
}

export interface B9ExpectedRevisionRelation {
  kind: 'cancels' | 'supersedes' | 'amends'
  targetCandidateKey: string
  replacementCandidateKeys: string[]
  evidenceScopeTexts: string[]
  resolution: 'shared_scope' | 'same_scope_position' | 'adjacent_unique_referent'
}

export interface B9ExpectedCase {
  id: string
  coverageTags: string[]
  sourceText: string
  expected: {
    candidates: B9ExpectedCandidate[]
    tasks: B9ExpectedTask[]
    requiresAction: boolean | null
    responseContractComplete: boolean
    semanticCoverageComplete: boolean
    expectedIssueCodes: string[]
    revisionRelations: B9ExpectedRevisionRelation[]
    unresolvedRevisionScopeTexts: string[]
    suppressedRevisionScopeTexts: string[]
  }
}

export interface B9ActualObjectCandidate {
  id: string
  surface: string
  sourceStart: number
  sourceEnd: number
  sourceSlice: string
}

export interface B9ActualCandidate {
  key: string | null
  candidateId: string
  action: string
  occurrence: number
  actionSourceStart: number
  actionSourceEnd: number
  actionSourceSlice: string
  objectCandidates: B9ActualObjectCandidate[]
  defaultObjectCandidateId: string | null
  localDisposition: B9LocalDisposition
  clauseRole: 'directive' | 'condition_antecedent' | 'assertion' | 'quoted_or_example' | 'unclassified'
  currentness: 'current' | 'historical' | 'completed' | 'unknown'
  conditionStatus: B9ConditionStatus
  conditionTruth: B9ConditionTruth
  responseVerdict: B9ResponseVerdict
  responseObjectCandidateId: string | null
  responseObjectOwnerKey: string | null
}

export interface B9ActualLedgerEntry {
  candidateKey: string | null
  candidateId: string
  status: B9LedgerStatus
  objectCandidateId: string | null
  reasonCodes: string[]
}

export interface B9ActualTask {
  candidateKey: string | null
  id: string
  originCandidateId: string
  occurrenceId: string
  action: string
  actionSourceStart: number
  actionSourceEnd: number
  actionSourceSlice: string
  object: string
  objectCandidateId: string
  objectSourceStart: number
  objectSourceEnd: number
  objectSourceSlice: string
  semantics: B9Semantics
  selected: boolean
  needsConfirmation: boolean
  conditionStatus: B9ConditionStatus
  conditionTruth: B9ConditionTruth
}

export interface B9ActualRevisionRelation extends B9ExpectedRevisionRelation {
  targetCandidateKey: string
  replacementCandidateKeys: string[]
  referentType: string | null
}

export interface B9ActualCase {
  caseId: string
  sourceText: string
  sourceFingerprint: string
  candidatePolicyVersion: string
  candidates: B9ActualCandidate[]
  ledger: B9ActualLedgerEntry[]
  tasks: B9ActualTask[]
  requiresAction: boolean | null
  responseContractComplete: boolean
  semanticCoverageComplete: boolean
  issueCodes: string[]
  materializerIssueCodes: string[]
  runnerIssueCodes: string[]
  revisionRelations: B9ActualRevisionRelation[]
  unresolvedRevisionScopeTexts: string[]
  suppressedRevisionScopeTexts: string[]
  unresolvedActionScopeTexts: string[]
  unsafeDefaultSelections: string[]
}

export interface B9MetricCount {
  passed: number
  total: number
  value: number
}

export interface B9CaseEvaluation {
  caseId: string
  passed: boolean
  failures: string[]
  counts: {
    expectedCandidates: number
    actualCandidates: number
    expectedTasks: number
    actualTasks: number
    expectedRelations: number
    actualRelations: number
  }
  checks: Record<string, boolean>
  scoreParts: Record<string, { passed: number; total: number }>
}

export interface B9FixedZeroCallGate {
  candidateIdentityExact: number
  actionSpanExact: number
  singletonOrEmptyObjectSpanExact: number
  ledgerDispositionExact: number
  acceptedCandidateTaskBijectionExact: number
  taskSemanticExact: number
  taskSelectedExact: number
  requiresActionExact: number
  responseContractCompletenessExact: number
  semanticCoverageCompletenessExact: number
  revisionUncertaintyExact: number
  resolvedRevisionRelationExact: number
  safeDefaultRecall: number
  unsafeDefaultSelectionsMaximum: number
  siblingSurvivalRate: number
}

export interface B9EvaluationResult {
  schemaVersion: 'rco-5-009-b9-evaluation-1.0.0'
  gate: 'PASS' | 'FAIL'
  gateFailures: string[]
  counts: {
    expectedCases: number
    actualCases: number
    expectedCandidates: number
    actualCandidates: number
    expectedLedger: Record<B9LedgerStatus, number>
    actualLedger: Record<B9LedgerStatus, number>
    expectedTasks: number
    actualTasks: number
    expectedSelectedTasks: number
    actualSelectedTasks: number
    expectedRevisionRelations: number
    actualRevisionRelations: number
    expectedIssueCodes: number
    actualIssueCodes: number
  }
  metrics: {
    caseIdentityExact: number
    sourceFingerprintExact: number
    candidatePolicyVersionExact: number
    candidateIdentityExact: number
    candidateDispositionExact: number
    actionSpanExact: number
    singletonOrEmptyObjectSpanExact: number
    inputFixtureTransportExact: number
    ledgerDispositionExact: number
    acceptedCandidateTaskBijectionExact: number
    taskSemanticExact: number
    taskSelectedExact: number
    requiresActionExact: number
    responseContractCompletenessExact: number
    semanticCoverageCompletenessExact: number
    expectedIssueCodesExact: number
    materializerValidationExact: number
    revisionUncertaintyExact: number
    resolvedRevisionRelationExact: number
    unresolvedActionScopeExact: number
    outOfVocabularyUnresolvedActionExact: number
    conditionUnknownExact: number
    safeDefaultRecall: number
    siblingSurvivalRate: number
    unsafeDefaultSelections: number
    extraDefaultSelections: number
  }
  metricCounts: Record<string, B9MetricCount>
  cases: B9CaseEvaluation[]
}

const LEDGER_STATUSES: B9LedgerStatus[] = ['accepted_local', 'accepted_model', 'ignored_local', 'ignored_model', 'quarantined']
const B9_EXPECTED_CANDIDATE_POLICY_VERSION = 'local-action-candidate-policy-1.2.0'

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sorted(values: string[]): string[] {
  return [...values].sort()
}

function metric(passed: number, total: number): B9MetricCount {
  return { passed, total, value: total === 0 ? 1 : passed / total }
}

function sourceFingerprintFor(expected: B9ExpectedCase): string {
  const digest = createHash('sha256').update(`${expected.id}\u0000source-v1\u0000${expected.sourceText}`).digest('hex')
  return `sha256:${digest}`
}

function candidateIdFor(expected: B9ExpectedCase, sourceStart: number, sourceEnd: number): string {
  return `action:${B9_EXPECTED_CANDIDATE_POLICY_VERSION}:${sourceFingerprintFor(expected).slice(7, 19)}:${sourceStart}:${sourceEnd}`
}

function objectIdFor(expected: B9ExpectedCase, object: B9ActualObjectCandidate): string {
  return `object:${sourceFingerprintFor(expected).slice(7, 19)}:${object.sourceStart}:${object.sourceEnd}`
}

export function expectedB9LedgerStatus(candidate: B9ExpectedCandidate): B9LedgerStatus {
  if (candidate.localDisposition === 'local_non_task') return 'ignored_local'
  if (candidate.localDisposition === 'local_proposition') return candidate.object === null ? 'quarantined' : 'accepted_local'
  if (candidate.responseVerdict === 'mention_only') return 'ignored_model'
  if (candidate.responseVerdict === 'proposition' && candidate.responseObject === 'own' && candidate.object !== null) return 'accepted_model'
  return 'quarantined'
}

export function expectedB9UnresolvedActionScopeTexts(expected: B9ExpectedCase): string[] {
  return expected.coverageTags.includes('out_of_vocabulary') ? [expected.sourceText] : []
}

function frozenOccurrenceRange(sourceText: string, action: string, occurrence: number): { start: number; end: number } | null {
  let start = -1
  for (let position = 0; position < occurrence; position += 1) start = sourceText.indexOf(action, start + 1)
  return start < 0 ? null : { start, end: start + action.length }
}

function uniqueByKey<T>(values: T[], key: (value: T) => string | null): Map<string, T> {
  const counts = new Map<string, number>()
  for (const value of values) {
    const id = key(value)
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return new Map(values.flatMap((value) => {
    const id = key(value)
    return id !== null && counts.get(id) === 1 ? [[id, value] as const] : []
  }))
}

function scoreCase(expected: B9ExpectedCase, actual: B9ActualCase): B9CaseEvaluation {
  const expectedCandidates = expected.expected.candidates
  const expectedTasks = expected.expected.tasks
  const actualCandidateByKey = uniqueByKey(actual.candidates, (candidate) => candidate.key)
  const actualLedgerByKey = uniqueByKey(actual.ledger, (entry) => entry.candidateKey)
  const actualTaskByKey = uniqueByKey(actual.tasks, (task) => task.candidateKey)
  const candidateDenominator = Math.max(expectedCandidates.length, actual.candidates.length)
  const taskDenominator = Math.max(expectedTasks.length, actual.tasks.length)
  let candidateIdentityPassed = 0
  let candidateDispositionPassed = 0
  let actionSpanPassed = 0
  let objectSpanPassed = 0
  let inputFixtureTransportPassed = 0
  let ledgerPassed = 0

  for (const expectedCandidate of expectedCandidates) {
    const candidate = actualCandidateByKey.get(expectedCandidate.key)
    if (!candidate) continue
    const frozenRange = frozenOccurrenceRange(expected.sourceText, expectedCandidate.action, expectedCandidate.occurrence)
    const identityExact = candidate.action === expectedCandidate.action
      && candidate.occurrence === expectedCandidate.occurrence
      && frozenRange !== null
      && candidate.actionSourceStart === frozenRange.start
      && candidate.actionSourceEnd === frozenRange.end
      && candidate.candidateId === candidateIdFor(expected, frozenRange.start, frozenRange.end)
    if (identityExact) candidateIdentityPassed += 1
    if (candidate.localDisposition === expectedCandidate.localDisposition) candidateDispositionPassed += 1
    if (frozenRange !== null
      && candidate.action === expectedCandidate.action
      && candidate.actionSourceStart === frozenRange.start
      && candidate.actionSourceEnd === frozenRange.end
      && candidate.actionSourceSlice === expectedCandidate.action
      && actual.sourceText.slice(candidate.actionSourceStart, candidate.actionSourceEnd) === expectedCandidate.action) {
      actionSpanPassed += 1
    }
    const object = candidate.objectCandidates[0]
    const objectExact = expectedCandidate.object === null
      ? candidate.objectCandidates.length === 0 && candidate.defaultObjectCandidateId === null
      : candidate.objectCandidates.length === 1
        && object.surface === expectedCandidate.object
        && object.sourceSlice === expectedCandidate.object
        && actual.sourceText.slice(object.sourceStart, object.sourceEnd) === expectedCandidate.object
        && object.id === objectIdFor(expected, object)
        && candidate.defaultObjectCandidateId === object.id
    if (objectExact) objectSpanPassed += 1
    const expectedOwnerKey = expectedCandidate.responseObject === 'own' ? expectedCandidate.key : expectedCandidate.responseObject
    const expectedOwnerCandidate = expectedOwnerKey === null ? null : actualCandidateByKey.get(expectedOwnerKey) ?? null
    const expectedResponseObjectId = expectedOwnerCandidate?.objectCandidates.length === 1
      ? expectedOwnerCandidate.objectCandidates[0].id
      : null
    const responseObjectIsOwnedByCandidate = candidate.responseObjectCandidateId !== null
      && candidate.objectCandidates.some((object) => object.id === candidate.responseObjectCandidateId)
    const actualResponseObjectOtherOwners = candidate.responseObjectCandidateId === null
      ? []
      : actual.candidates.filter((owner) => owner.candidateId !== candidate.candidateId
        && owner.objectCandidates.some((object) => object.id === candidate.responseObjectCandidateId))
    const actualResponseOwnerKey = responseObjectIsOwnedByCandidate
      ? candidate.key
      : actualResponseObjectOtherOwners.length === 1 ? actualResponseObjectOtherOwners[0].key : null
    const responseExact = candidate.responseVerdict === expectedCandidate.responseVerdict
      && candidate.responseObjectOwnerKey === actualResponseOwnerKey
      && actualResponseOwnerKey === expectedOwnerKey
      && candidate.responseObjectCandidateId === expectedResponseObjectId
    if (responseExact) inputFixtureTransportPassed += 1
    const ledger = actualLedgerByKey.get(expectedCandidate.key)
    const expectedStatus = expectedB9LedgerStatus(expectedCandidate)
    const expectedLedgerObjectId = expectedStatus === 'accepted_local' || expectedStatus === 'accepted_model'
      ? object?.id ?? null
      : null
    if (ledger
      && ledger.candidateId === candidate.candidateId
      && ledger.status === expectedStatus
      && ledger.objectCandidateId === expectedLedgerObjectId) {
      ledgerPassed += 1
    }
  }

  const expectedAccepted = expectedCandidates.filter((candidate) => {
    const status = expectedB9LedgerStatus(candidate)
    return status === 'accepted_local' || status === 'accepted_model'
  })
  const actualAccepted = actual.ledger.filter((entry) => entry.status === 'accepted_local' || entry.status === 'accepted_model')
  const acceptedDenominator = Math.max(expectedAccepted.length, actualAccepted.length, actual.tasks.length)
  let taskBijectionPassed = 0
  for (const accepted of expectedAccepted) {
    const candidate = actualCandidateByKey.get(accepted.key)
    const task = actualTaskByKey.get(accepted.key)
    const object = candidate?.objectCandidates[0]
    if (candidate && task && object
      && task.id === `task:${candidate.candidateId}`
      && task.originCandidateId === candidate.candidateId
      && task.occurrenceId === candidate.candidateId
      && task.action === candidate.action
      && task.actionSourceStart === candidate.actionSourceStart
      && task.actionSourceEnd === candidate.actionSourceEnd
      && task.actionSourceSlice === candidate.actionSourceSlice
      && task.object === object.surface
      && task.objectCandidateId === object.id
      && task.objectSourceStart === object.sourceStart
      && task.objectSourceEnd === object.sourceEnd
      && task.objectSourceSlice === object.sourceSlice) {
      taskBijectionPassed += 1
    }
  }

  let semanticPassed = 0
  let selectedPassed = 0
  for (const expectedTask of expectedTasks) {
    const task = actualTaskByKey.get(expectedTask.candidateKey)
    if (task && task.action === expectedTask.action && task.object === expectedTask.object
      && jsonEqual(task.semantics, B9_SEMANTICS_BY_LABEL[expectedTask.semanticLabel])) {
      semanticPassed += 1
    }
    if (task && task.selected === expectedTask.selected && task.needsConfirmation === !expectedTask.selected) selectedPassed += 1
  }

  const expectedRelations = expected.expected.revisionRelations
  const actualRelations = actual.revisionRelations.map((relation) => ({
    kind: relation.kind,
    targetCandidateKey: relation.targetCandidateKey,
    replacementCandidateKeys: relation.replacementCandidateKeys,
    evidenceScopeTexts: relation.evidenceScopeTexts,
    resolution: relation.resolution,
  }))
  const revisionUncertaintyExact = jsonEqual(actual.unresolvedRevisionScopeTexts, expected.expected.unresolvedRevisionScopeTexts)
    && jsonEqual(actual.suppressedRevisionScopeTexts, expected.expected.suppressedRevisionScopeTexts)
  const relationExact = jsonEqual(actualRelations, expectedRelations)
  const issueCodesExact = jsonEqual(sorted(actual.issueCodes), sorted(expected.expected.expectedIssueCodes))
  const unresolvedActionExact = jsonEqual(actual.unresolvedActionScopeTexts, expectedB9UnresolvedActionScopeTexts(expected))
  const conditionUnknownExact = !expected.coverageTags.includes('condition_unknown') || expectedCandidates.every((candidate) => {
    const actualCandidate = actualCandidateByKey.get(candidate.key)
    const task = actualTaskByKey.get(candidate.key)
    return Boolean(actualCandidate
      && actualCandidate.conditionStatus === 'no_match'
      && actualCandidate.conditionTruth === 'unknown'
      && task
      && task.conditionStatus === 'no_match'
      && task.conditionTruth === 'unknown')
  })
  const badResponseKeys = new Set(expectedCandidates
    .filter((candidate) => typeof candidate.responseObject === 'string' && candidate.responseObject !== 'own')
    .map((candidate) => candidate.key))
  const legalSiblingTasks = badResponseKeys.size === 0 ? [] : expectedTasks.filter((task) => !badResponseKeys.has(task.candidateKey))
  const siblingSurvivors = legalSiblingTasks.filter((expectedTask) => {
    const task = actualTaskByKey.get(expectedTask.candidateKey)
    return Boolean(task && task.action === expectedTask.action && task.object === expectedTask.object)
  }).length
  const expectedSelected = expectedTasks.filter((task) => task.selected)
  const safeDefaultHits = expectedSelected.filter((expectedTask) => actualTaskByKey.get(expectedTask.candidateKey)?.selected === true).length
  const expectedSelectedKeys = new Set(expectedSelected.map((task) => task.candidateKey))
  const extraDefaultSelections = actual.tasks.filter((task) => task.selected && (task.candidateKey === null || !expectedSelectedKeys.has(task.candidateKey))).length

  const checks: Record<string, boolean> = {
    caseIdentityExact: actual.caseId === expected.id && actual.sourceText === expected.sourceText,
    sourceFingerprintExact: actual.sourceFingerprint === sourceFingerprintFor(expected),
    candidatePolicyVersionExact: actual.candidatePolicyVersion === B9_EXPECTED_CANDIDATE_POLICY_VERSION,
    candidateSetExact: candidateDenominator === expectedCandidates.length && candidateIdentityPassed === candidateDenominator,
    candidateDispositionExact: candidateDispositionPassed === candidateDenominator,
    actionSpanExact: actionSpanPassed === candidateDenominator,
    singletonOrEmptyObjectSpanExact: objectSpanPassed === candidateDenominator,
    inputFixtureTransportExact: inputFixtureTransportPassed === candidateDenominator,
    ledgerDispositionExact: ledgerPassed === candidateDenominator && actual.ledger.length === expectedCandidates.length,
    acceptedCandidateTaskBijectionExact: taskBijectionPassed === acceptedDenominator
      && expectedAccepted.length === expectedTasks.length,
    taskSemanticExact: semanticPassed === taskDenominator,
    taskSelectedExact: selectedPassed === taskDenominator,
    requiresActionExact: actual.requiresAction === expected.expected.requiresAction,
    responseContractCompletenessExact: actual.responseContractComplete === expected.expected.responseContractComplete,
    semanticCoverageCompletenessExact: actual.semanticCoverageComplete === expected.expected.semanticCoverageComplete,
    expectedIssueCodesExact: issueCodesExact,
    materializerValidationExact: actual.materializerIssueCodes.length === 0 && actual.runnerIssueCodes.length === 0,
    revisionUncertaintyExact,
    resolvedRevisionRelationExact: relationExact,
    unresolvedActionScopeExact: unresolvedActionExact,
    conditionUnknownExact,
    unsafeDefaultSelectionsExact: actual.unsafeDefaultSelections.length === 0 && extraDefaultSelections === 0,
  }
  const scoreParts: Record<string, { passed: number; total: number }> = {
    candidateIdentityExact: { passed: candidateIdentityPassed, total: candidateDenominator },
    candidateDispositionExact: { passed: candidateDispositionPassed, total: candidateDenominator },
    actionSpanExact: { passed: actionSpanPassed, total: candidateDenominator },
    singletonOrEmptyObjectSpanExact: { passed: objectSpanPassed, total: candidateDenominator },
    inputFixtureTransportExact: { passed: inputFixtureTransportPassed, total: candidateDenominator },
    ledgerDispositionExact: { passed: ledgerPassed, total: candidateDenominator },
    acceptedCandidateTaskBijectionExact: { passed: taskBijectionPassed, total: acceptedDenominator },
    taskSemanticExact: { passed: semanticPassed, total: taskDenominator },
    taskSelectedExact: { passed: selectedPassed, total: taskDenominator },
    safeDefaultRecall: { passed: safeDefaultHits, total: expectedSelected.length },
    siblingSurvivalRate: { passed: siblingSurvivors, total: legalSiblingTasks.length },
  }
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
  return {
    caseId: expected.id,
    passed: failures.length === 0,
    failures,
    counts: {
      expectedCandidates: expectedCandidates.length,
      actualCandidates: actual.candidates.length,
      expectedTasks: expectedTasks.length,
      actualTasks: actual.tasks.length,
      expectedRelations: expectedRelations.length,
      actualRelations: actualRelations.length,
    },
    checks,
    scoreParts,
  }
}

function emptyActual(expected: B9ExpectedCase): B9ActualCase {
  return {
    caseId: expected.id,
    sourceText: '',
    sourceFingerprint: '',
    candidatePolicyVersion: '',
    candidates: [],
    ledger: [],
    tasks: [],
    requiresAction: null,
    responseContractComplete: false,
    semanticCoverageComplete: false,
    issueCodes: [],
    materializerIssueCodes: ['MISSING_ACTUAL_CASE'],
    runnerIssueCodes: ['MISSING_ACTUAL_CASE'],
    revisionRelations: [],
    unresolvedRevisionScopeTexts: [],
    suppressedRevisionScopeTexts: [],
    unresolvedActionScopeTexts: [],
    unsafeDefaultSelections: [],
  }
}

function ledgerCountsFromExpected(cases: B9ExpectedCase[]): Record<B9LedgerStatus, number> {
  const counts = Object.fromEntries(LEDGER_STATUSES.map((status) => [status, 0])) as Record<B9LedgerStatus, number>
  for (const candidate of cases.flatMap((item) => item.expected.candidates)) counts[expectedB9LedgerStatus(candidate)] += 1
  return counts
}

function ledgerCountsFromActual(cases: B9ActualCase[]): Record<B9LedgerStatus, number> {
  const counts = Object.fromEntries(LEDGER_STATUSES.map((status) => [status, 0])) as Record<B9LedgerStatus, number>
  for (const entry of cases.flatMap((item) => item.ledger)) counts[entry.status] += 1
  return counts
}

export function evaluateB9ZeroCall(
  expectedCases: B9ExpectedCase[],
  actualCases: B9ActualCase[],
  frozenGate: B9FixedZeroCallGate,
): B9EvaluationResult {
  const actualById = uniqueByKey(actualCases, (item) => item.caseId)
  const caseEvaluations = expectedCases.map((expected) => scoreCase(expected, actualById.get(expected.id) ?? emptyActual(expected)))
  const metricNames = [
    'candidateIdentityExact',
    'candidateDispositionExact',
    'actionSpanExact',
    'singletonOrEmptyObjectSpanExact',
    'inputFixtureTransportExact',
    'ledgerDispositionExact',
    'acceptedCandidateTaskBijectionExact',
    'taskSemanticExact',
    'taskSelectedExact',
    'safeDefaultRecall',
    'siblingSurvivalRate',
  ] as const
  const metricCounts: Record<string, B9MetricCount> = {}
  for (const name of metricNames) {
    const parts = caseEvaluations.map((item) => item.scoreParts[name]).filter((part) => part !== undefined)
    metricCounts[name] = metric(parts.reduce((sum, part) => sum + part.passed, 0), parts.reduce((sum, part) => sum + part.total, 0))
  }
  const booleanMetric = (name: string, predicate: (expected: B9ExpectedCase) => boolean = () => true): B9MetricCount => {
    const applicable = expectedCases.map((expected, position) => ({ expected, evaluation: caseEvaluations[position] })).filter(({ expected }) => predicate(expected))
    return metric(applicable.filter(({ evaluation }) => evaluation.checks[name]).length, applicable.length)
  }
  metricCounts.caseIdentityExact = metric(
    caseEvaluations.filter((evaluation) => evaluation.checks.caseIdentityExact).length,
    Math.max(expectedCases.length, actualCases.length),
  )
  metricCounts.sourceFingerprintExact = booleanMetric('sourceFingerprintExact')
  metricCounts.candidatePolicyVersionExact = booleanMetric('candidatePolicyVersionExact')
  metricCounts.requiresActionExact = booleanMetric('requiresActionExact')
  metricCounts.responseContractCompletenessExact = booleanMetric('responseContractCompletenessExact')
  metricCounts.semanticCoverageCompletenessExact = booleanMetric('semanticCoverageCompletenessExact')
  metricCounts.expectedIssueCodesExact = booleanMetric('expectedIssueCodesExact')
  metricCounts.materializerValidationExact = booleanMetric('materializerValidationExact')
  metricCounts.revisionUncertaintyExact = booleanMetric('revisionUncertaintyExact')
  metricCounts.resolvedRevisionRelationExact = booleanMetric('resolvedRevisionRelationExact')
  metricCounts.unresolvedActionScopeExact = booleanMetric('unresolvedActionScopeExact')
  metricCounts.outOfVocabularyUnresolvedActionExact = booleanMetric('unresolvedActionScopeExact', (expected) => expected.coverageTags.includes('out_of_vocabulary'))
  metricCounts.conditionUnknownExact = booleanMetric('conditionUnknownExact', (expected) => expected.coverageTags.includes('condition_unknown'))

  const expectedTasks = expectedCases.flatMap((item) => item.expected.tasks)
  const actualTasks = actualCases.flatMap((item) => item.tasks)
  const unsafeDefaultSelections = actualCases.reduce((sum, item) => sum + item.unsafeDefaultSelections.length, 0)
  const expectedSelectedKeysByCase = new Map(expectedCases.map((item) => [item.id, new Set(item.expected.tasks.filter((task) => task.selected).map((task) => task.candidateKey))]))
  const extraDefaultSelections = actualCases.reduce((sum, item) => sum + item.tasks.filter((task) => task.selected
    && (task.candidateKey === null || !expectedSelectedKeysByCase.get(item.caseId)?.has(task.candidateKey))).length, 0)
  const metrics: B9EvaluationResult['metrics'] = {
    caseIdentityExact: metricCounts.caseIdentityExact.value,
    sourceFingerprintExact: metricCounts.sourceFingerprintExact.value,
    candidatePolicyVersionExact: metricCounts.candidatePolicyVersionExact.value,
    candidateIdentityExact: metricCounts.candidateIdentityExact.value,
    candidateDispositionExact: metricCounts.candidateDispositionExact.value,
    actionSpanExact: metricCounts.actionSpanExact.value,
    singletonOrEmptyObjectSpanExact: metricCounts.singletonOrEmptyObjectSpanExact.value,
    inputFixtureTransportExact: metricCounts.inputFixtureTransportExact.value,
    ledgerDispositionExact: metricCounts.ledgerDispositionExact.value,
    acceptedCandidateTaskBijectionExact: metricCounts.acceptedCandidateTaskBijectionExact.value,
    taskSemanticExact: metricCounts.taskSemanticExact.value,
    taskSelectedExact: metricCounts.taskSelectedExact.value,
    requiresActionExact: metricCounts.requiresActionExact.value,
    responseContractCompletenessExact: metricCounts.responseContractCompletenessExact.value,
    semanticCoverageCompletenessExact: metricCounts.semanticCoverageCompletenessExact.value,
    expectedIssueCodesExact: metricCounts.expectedIssueCodesExact.value,
    materializerValidationExact: metricCounts.materializerValidationExact.value,
    revisionUncertaintyExact: metricCounts.revisionUncertaintyExact.value,
    resolvedRevisionRelationExact: metricCounts.resolvedRevisionRelationExact.value,
    unresolvedActionScopeExact: metricCounts.unresolvedActionScopeExact.value,
    outOfVocabularyUnresolvedActionExact: metricCounts.outOfVocabularyUnresolvedActionExact.value,
    conditionUnknownExact: metricCounts.conditionUnknownExact.value,
    safeDefaultRecall: metricCounts.safeDefaultRecall.value,
    siblingSurvivalRate: metricCounts.siblingSurvivalRate.value,
    unsafeDefaultSelections,
    extraDefaultSelections,
  }
  const counts: B9EvaluationResult['counts'] = {
    expectedCases: expectedCases.length,
    actualCases: actualCases.length,
    expectedCandidates: expectedCases.reduce((sum, item) => sum + item.expected.candidates.length, 0),
    actualCandidates: actualCases.reduce((sum, item) => sum + item.candidates.length, 0),
    expectedLedger: ledgerCountsFromExpected(expectedCases),
    actualLedger: ledgerCountsFromActual(actualCases),
    expectedTasks: expectedTasks.length,
    actualTasks: actualTasks.length,
    expectedSelectedTasks: expectedTasks.filter((task) => task.selected).length,
    actualSelectedTasks: actualTasks.filter((task) => task.selected).length,
    expectedRevisionRelations: expectedCases.reduce((sum, item) => sum + item.expected.revisionRelations.length, 0),
    actualRevisionRelations: actualCases.reduce((sum, item) => sum + item.revisionRelations.length, 0),
    expectedIssueCodes: expectedCases.reduce((sum, item) => sum + item.expected.expectedIssueCodes.length, 0),
    actualIssueCodes: actualCases.reduce((sum, item) => sum + item.issueCodes.length, 0),
  }
  const gateFailures: string[] = []
  const minimums: Array<[keyof B9FixedZeroCallGate, number]> = [
    ['candidateIdentityExact', metrics.candidateIdentityExact],
    ['actionSpanExact', metrics.actionSpanExact],
    ['singletonOrEmptyObjectSpanExact', metrics.singletonOrEmptyObjectSpanExact],
    ['ledgerDispositionExact', metrics.ledgerDispositionExact],
    ['acceptedCandidateTaskBijectionExact', metrics.acceptedCandidateTaskBijectionExact],
    ['taskSemanticExact', metrics.taskSemanticExact],
    ['taskSelectedExact', metrics.taskSelectedExact],
    ['requiresActionExact', metrics.requiresActionExact],
    ['responseContractCompletenessExact', metrics.responseContractCompletenessExact],
    ['semanticCoverageCompletenessExact', metrics.semanticCoverageCompletenessExact],
    ['revisionUncertaintyExact', metrics.revisionUncertaintyExact],
    ['resolvedRevisionRelationExact', metrics.resolvedRevisionRelationExact],
    ['safeDefaultRecall', metrics.safeDefaultRecall],
    ['siblingSurvivalRate', metrics.siblingSurvivalRate],
  ]
  for (const [name, value] of minimums) if (value < frozenGate[name]) gateFailures.push(`${name}:${value}<${frozenGate[name]}`)
  if (metrics.unsafeDefaultSelections > frozenGate.unsafeDefaultSelectionsMaximum) {
    gateFailures.push(`unsafeDefaultSelections:${metrics.unsafeDefaultSelections}>${frozenGate.unsafeDefaultSelectionsMaximum}`)
  }
  const additionalExactMetrics: Array<[keyof B9EvaluationResult['metrics'], number]> = [
    ['caseIdentityExact', metrics.caseIdentityExact],
    ['sourceFingerprintExact', metrics.sourceFingerprintExact],
    ['candidatePolicyVersionExact', metrics.candidatePolicyVersionExact],
    ['candidateDispositionExact', metrics.candidateDispositionExact],
    ['inputFixtureTransportExact', metrics.inputFixtureTransportExact],
    ['expectedIssueCodesExact', metrics.expectedIssueCodesExact],
    ['materializerValidationExact', metrics.materializerValidationExact],
    ['unresolvedActionScopeExact', metrics.unresolvedActionScopeExact],
    ['outOfVocabularyUnresolvedActionExact', metrics.outOfVocabularyUnresolvedActionExact],
    ['conditionUnknownExact', metrics.conditionUnknownExact],
  ]
  for (const [name, value] of additionalExactMetrics) if (value !== 1) gateFailures.push(`${name}:${value}!=1`)
  if (metrics.extraDefaultSelections !== 0) gateFailures.push(`extraDefaultSelections:${metrics.extraDefaultSelections}!=0`)
  return {
    schemaVersion: 'rco-5-009-b9-evaluation-1.0.0',
    gate: gateFailures.length === 0 ? 'PASS' : 'FAIL',
    gateFailures,
    counts,
    metrics,
    metricCounts,
    cases: caseEvaluations,
  }
}
import { createHash } from 'node:crypto'
