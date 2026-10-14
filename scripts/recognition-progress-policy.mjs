import {readFileSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

// Future-only workflow routing. This never authorizes calls, studies, or deployment.
export const PROGRESS_POLICY_VERSION = 'recognition-progress-policy-1'
const routes = Object.freeze({
  SCORER_EXCEPTION: ['comparableQualityClaim', 'frozenComparisonPreparation'],
  REFERENCE_CONTRACT_DISPUTE: ['comparableQualityClaim', 'frozenComparisonPreparation'],
  DANGLING_ENTITY_REFERENCE: ['affectedCanonicalConfirmation'],
  HUMAN_LABELS_MISSING: ['independentQualityClaim'],
  HUMAN_TRIAL_MISSING: ['humanBenefitClaim'],
  ACCOUNTING_UNCERTAIN: ['paidDispatch'],
  SOURCE_OR_DATABASE_UNSAFE: ['engineeringReplay', 'affectedCanonicalConfirmation', 'humanStudy'],
  NEW_RELEVANT_TEST_FAILURE: ['engineeringDelivery'],
})

export function routeRecognitionBlockers(issues) {
  if (!Array.isArray(issues)) throw Error('PROGRESS_ISSUES_REQUIRED')
  const lanes = Object.fromEntries(['engineeringDelivery', 'engineeringReplay', 'comparableQualityClaim',
    'frozenComparisonPreparation', 'affectedCanonicalConfirmation', 'independentQualityClaim',
    'humanBenefitClaim', 'paidDispatch', 'humanStudy'].map(name => [name, {blockedBy: []}]))
  const ids = new Set()
  for (const issue of issues) {
    if (!issue?.id || ids.has(issue.id) || !routes[issue.kind] || !issue.evidence) throw Error('PROGRESS_ISSUE_INVALID')
    ids.add(issue.id)
    for (const lane of routes[issue.kind]) lanes[lane].blockedBy.push({id: issue.id, evidence: issue.evidence, scope: issue.scope ?? 'declared artifact'})
  }
  for (const lane of Object.values(lanes)) lane.status = lane.blockedBy.length ? 'BLOCKED_ON_LISTED_DEPENDENCY' : 'NO_LISTED_BLOCKER_NOT_ACCEPTANCE'
  return {version: PROGRESS_POLICY_VERSION, lanes, historicalGateDecisionChanged: false,
    authorizations: {paidDispatch: false, humanStudy: false, defaultReplacement: false, deployment: false},
    interpretation: 'No listed blocker does not certify completion or grant permission. Each lane still needs its own evidence.'}
}

export function currentD12Workstreams() {
  const root = 'docs/recognition-optimization/d12-progress'
  const queue = JSON.parse(readFileSync(root + '/ADJUDICATION_QUEUE.json'))
  const issues = queue.items.map(item => ({id: item.id,
    kind: item.status === 'CONFIRMED_REFERENCE_VALIDATION_FAILURE' ? 'DANGLING_ENTITY_REFERENCE' : 'REFERENCE_CONTRACT_DISPUTE',
    evidence: root + '/ADJUDICATION_QUEUE.json#' + item.id, scope: item.sources.join(',')}))
  issues.push({id: 'independent-labels', kind: 'HUMAN_LABELS_MISSING', evidence: 'No independent human material supplied'},
    {id: 'human-trials', kind: 'HUMAN_TRIAL_MISSING', evidence: 'No registered human trials run'})
  return {role: 'ENGINEERING_WORK_ROUTING_NOT_QUALITY_GATE', ...routeRecognitionBlockers(issues),
    currentCompletion: {engineeringReplay: 'NOT_RUN_D12', engineeringDelivery: 'SEE_VALIDATION',
      newCandidateQuality: 'NOT_EVALUATED', formalSemanticScorer: 'FUTURE_VERSION_REQUIRED'}}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = process.argv[2], path = 'docs/recognition-optimization/d12-progress/WORKSTREAM_STATUS.json'
  if (!['--write', '--verify'].includes(arg)) throw Error('PROGRESS_ARGUMENT')
  const result = currentD12Workstreams()
  if (arg === '--write') writeFileSync(path, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'})
  else if (JSON.stringify(JSON.parse(readFileSync(path))) !== JSON.stringify(result)) throw Error('PROGRESS_REPORT_DRIFT')
  console.log(JSON.stringify({lanes: result.lanes, authorizations: result.authorizations, currentCompletion: result.currentCompletion}))
}
