import {normalize, stable} from './candidate12-reference-contract.mjs'
import {validateScorerInputV4} from './compile-candidate13-reference-v4.mjs'

export const D5_SCORER_VERSION = 'candidate13-scoring-4.1.0'

const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
  return typeof value === 'string' ? normalize(value) : value
}
const set = values => [...new Set((values ?? []).map(normalize))].sort()
const sameSet = (a, b) => stable(set(a)) === stable(set(b))
const sameDeepSet = (a, b) => Array.isArray(a) && Array.isArray(b)
  && stable(a.map(canonical).map(stable).sort()) === stable(b.map(canonical).map(stable).sort())
const identity = task => `${task.action}::${task.object}`

export function currentActionableV4(task) {
  return task.semantics?.actor === 'addressee' && task.semantics?.speechAct === 'directive'
    && task.semantics?.polarity === 'affirmative' && task.semantics?.validity === 'active'
    && task.semantics?.status === 'pending' && task.semantics?.modality === 'required'
    && ['true', 'not_applicable'].includes(task.condition?.value)
}

function candidateFacts(result) {
  const taskMap = new Map(result.tasks.map(task => [task.id, task]))
  const endpoint = id => {
    const task = taskMap.get(id)
    return task ? `${task.action?.surface ?? ''}::${task.object?.surface ?? ''}` : 'DANGLING'
  }
  const facts = result.tasks.map(task => ({
    id: task.id,
    action: task.action?.surface ?? '',
    object: task.object?.surface ?? '',
    semanticStatus: task.semantics?.status,
    semanticValidity: task.semantics?.validity,
    actionable: currentActionableV4(task),
    conditionValue: task.condition?.value,
    completionStandard: task.detail?.completionCriteria ?? [],
    materials: (result.materials ?? []).filter(item => item.relatedTaskTempIds?.includes(task.id)).map(item => ({
      name: item.name, required: item.required, formatRequirements: item.formatRequirements ?? [],
      namingRequirements: item.namingRequirements ?? [],
    })),
    timePoints: (result.timePoints ?? []).filter(item => item.relatedTaskTempIds?.includes(task.id)).map(item => ({
      rawTexts: [item.rawText], normalizedValues: item.normalizedValue == null ? [] : [item.normalizedValue],
      type: item.type === 'submission_deadline' ? 'deadline' : item.type,
      precision: item.precision,
    })),
    dependencies: (task.detail?.dependencyTempIds ?? []).map(endpoint),
    revisionRelations: [], cancellationRelations: [], replacementRelations: [], raw: task,
  }))
  const byId = new Map(facts.map(item => [item.id, item]))
  for (const relation of result.revisions ?? []) {
    const bucket = relation.type === 'amends' ? 'revisionRelations'
      : relation.type === 'cancels' ? 'cancellationRelations'
        : ['replaces', 'supersedes'].includes(relation.type) ? 'replacementRelations' : null
    if (!bucket) continue
    const kind = relation.type === 'amends' ? 'amends' : relation.type === 'cancels' ? 'cancels' : 'replaces'
    const from = relation.fromDirectiveId ?? null
    const signature = `${kind}|${from === null ? 'NONE' : endpoint(from)}|${endpoint(relation.targetDirectiveId)}|${relation.effective}`
    const owner = byId.get(from === null ? relation.targetDirectiveId : from)
    if (owner) owner[bucket].push(signature)
  }
  return facts
}

const compatible = (gold, prediction) => gold.actionObjectAliases.some(pair =>
  normalize(pair.action) === normalize(prediction.action) && normalize(pair.object) === normalize(prediction.object))
const canShare = (gold, others) => others.every(other => gold.allowedMergeIds.includes(other.id)
  && other.allowedMergeIds.includes(gold.id) && !gold.forbiddenMergeIds.includes(other.id)
  && !other.forbiddenMergeIds.includes(gold.id))

function maximumMatchings(gold, predicted, limit) {
  let best = -1, visits = 0, overflow = false
  const maps = [], mapping = [], users = new Map()
  function visit(index, matched) {
    if (++visits > limit) { overflow = true; return }
    if (matched + gold.length - index < best) return
    if (index === gold.length) {
      if (matched > best) { best = matched; maps.length = 0 }
      if (matched === best) maps.push([...mapping])
      return
    }
    for (let candidate = 0; candidate < predicted.length; candidate++) {
      if (!compatible(gold[index], predicted[candidate])) continue
      const prior = users.get(candidate) ?? []
      if (prior.length && !canShare(gold[index], prior.map(i => gold[i]))) continue
      users.set(candidate, [...prior, index]); mapping.push(candidate); visit(index + 1, matched + 1); mapping.pop()
      if (prior.length) users.set(candidate, prior); else users.delete(candidate)
      if (overflow) return
    }
    mapping.push(-1); visit(index + 1, matched); mapping.pop()
  }
  visit(0, 0)
  return {best, maps, overflow}
}

const fieldRows = (gold, prediction) => {
  const pairs = [
    ['semanticStatus', prediction?.semanticStatus === gold.expected.semanticStatus, 'critical_major'],
    ['semanticValidity', prediction?.semanticValidity === gold.expected.semanticValidity, 'critical_major'],
    ['actionable', prediction?.actionable === gold.expected.actionable, 'critical_major'],
    ['condition.value', prediction?.conditionValue === gold.expected.conditionValue, 'critical_major'],
    ['completionStandard', sameSet(prediction?.completionStandard, gold.expected.completionStandard), 'major'],
    ['materials', sameDeepSet(prediction?.materials, gold.expected.materials), 'major'],
    ['timePoints', sameDeepSet(prediction?.timePoints, gold.expected.timePoints), 'major'],
    ['dependencies', sameSet(prediction?.dependencies, gold.expected.dependencies), 'major'],
    ['revisionRelations', sameSet(prediction?.revisionRelations, gold.expected.revisionRelations), 'critical_major'],
    ['cancellationRelations', sameSet(prediction?.cancellationRelations, gold.expected.cancellationRelations), 'critical_major'],
    ['replacementRelations', sameSet(prediction?.replacementRelations, gold.expected.replacementRelations), 'critical_major'],
  ]
  return pairs.map(([path, pass, severity]) => ({path, pass: Boolean(prediction) && pass, severity,
    reason: !prediction ? 'PREDICTION_NOT_ALIGNED' : pass ? 'FIELD_EXACT_MATCH' : 'FIELD_EXACT_MISMATCH'}))
}

function forbiddenViolation(gold, prediction, inference) {
  if (!prediction) return false
  const path = inference.assertion.path
  const projected = path === 'actions' ? [prediction.action]
    : path === 'objects' ? [prediction.object]
      : path === 'semanticStatus' ? prediction.semanticStatus
        : path === 'semanticValidity' ? prediction.semanticValidity
          : path === 'actionable' ? prediction.actionable
            : path === 'condition.value' ? prediction.conditionValue
              : path === 'completionStandard.accepted' ? prediction.completionStandard
                : path === 'dependencies' ? prediction.dependencies : undefined
  const value = inference.assertion.value
  if (inference.assertion.operator === 'equals') return stable(canonical(projected)) === stable(canonical(value))
  if (inference.assertion.operator === 'contains') return Array.isArray(projected) && projected.some(item => normalize(item) === normalize(value))
  if (inference.assertion.operator === 'setEquals') return sameSet(projected, value)
  return false
}

const metric = (tp, fp, fn) => {
  const precision = tp + fp ? tp / (tp + fp) : 1
  const recall = tp + fn ? tp / (tp + fn) : 1
  return {tp, fp, fn, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0}
}
const failure = (reference, code, status = 'PARSE_OR_SCHEMA_FAILURE') => ({
  scorerVersion: D5_SCORER_VERSION, status, referenceValid: true, schemaValid: false, complete: false,
  taskMetrics: metric(0, 0, reference.tasks.length), alignment: [], issues: [{code, path: '$'}],
  severity: {criticalMajor: 0, major: reference.tasks.length, severe: 1, forbidden: 0, teachingLeak: 0}, promotionEligible: false,
})

export function scoreCandidate13V4(reference, result, {schemaValid, searchLimit = 50000, teachingFingerprints = []} = {}) {
  try { validateScorerInputV4(reference) } catch (error) {
    return {scorerVersion: D5_SCORER_VERSION, status: 'REFERENCE_CONTRACT_INVALID', referenceValid: false,
      schemaValid: null, complete: null, taskMetrics: null, alignment: [], issues: [{code: error.message, path: '$'}],
      severity: {criticalMajor: 0, major: 0, severe: 1, forbidden: 0, teachingLeak: 0}, promotionEligible: false}
  }
  if (schemaValid !== true || !result || !Array.isArray(result.tasks) || !Array.isArray(result.materials)
    || !Array.isArray(result.timePoints) || !Array.isArray(result.revisions)) return failure(reference, 'D5_PREDICTION_SCHEMA_INVALID')
  const ids = result.tasks.map(task => task?.id)
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) return failure(reference, 'D5_PREDICTION_TASK_ID_INVALID')
  const predictions = candidateFacts(result)
  const matching = maximumMatchings(reference.tasks, predictions, searchLimit)
  if (matching.overflow) return {...failure(reference, 'D5_MATCH_LIMIT_ADJUDICATION', 'MATCH_LIMIT_ADJUDICATION'), schemaValid: true, complete: null}
  const signatures = new Set(matching.maps.map(map => stable(map)))
  if (signatures.size > 1) return {...failure(reference, 'D5_AMBIGUOUS_MATCH', 'AMBIGUOUS_MATCH'), schemaValid: true, complete: null,
    severity: {criticalMajor: 0, major: 0, severe: 0, forbidden: 0, teachingLeak: 0}}
  const mapping = matching.maps[0] ?? reference.tasks.map(() => -1)
  const rows = mapping.map((predictionIndex, goldIndex) => {
    const gold = reference.tasks[goldIndex], prediction = predictionIndex < 0 ? null : predictions[predictionIndex]
    const fields = fieldRows(gold, prediction)
    const forbiddenInferences = gold.forbiddenInferences.filter(item => forbiddenViolation(gold, prediction, item))
      .map(item => ({code: item.code, path: item.assertion.path}))
    return {goldId: gold.id, predictedId: prediction?.id ?? null, predictionIndex,
      aligned: prediction !== null, correct: prediction !== null && fields.every(field => field.pass) && forbiddenInferences.length === 0,
      fields, forbiddenInferences}
  })
  const matched = new Set(rows.filter(row => row.aligned).map(row => row.predictionIndex))
  const tp = rows.filter(row => row.aligned).length, fn = reference.tasks.length - tp, fp = predictions.length - matched.size
  const failed = rows.flatMap(row => row.fields.filter(field => !field.pass))
  const forbiddenAssertions = rows.reduce((sum, row) => sum + row.forbiddenInferences.length, 0)
  const forbiddenTasks = predictions.filter((item, index) => !matched.has(index) && item.actionable).length
  const serialized = stable(result)
  const teachingLeak = teachingFingerprints.filter(value => value && normalize(serialized).includes(normalize(value))).length
  const checks = reference.checks.map(check => {
    const actual = check.path === 'tasks' ? result.tasks : check.path === 'tasks.length' ? result.tasks.length : undefined
    const pass = check.operator === 'countEquals' ? Array.isArray(actual) && actual.length === check.value
      : check.operator === 'equals' ? stable(actual) === stable(check.value)
        : check.operator === 'oneOf' ? check.value.includes(actual) : false
    return {checkId: check.checkId, path: check.path, operator: check.operator, pass}
  })
  const criticalMajor = failed.filter(field => field.severity === 'critical_major').length
  const major = failed.filter(field => field.severity === 'major').length + fn
  const forbidden = forbiddenAssertions + forbiddenTasks
  const complete = reference.coverage === 'complete' && fn === 0 && fp === 0 && failed.length === 0
    && checks.every(check => check.pass) && forbidden === 0 && teachingLeak === 0
  return {
    scorerVersion: D5_SCORER_VERSION, status: reference.coverage === 'complete' ? 'SCORED' : 'REFERENCE_INCOMPLETE',
    referenceValid: true, schemaValid: true, complete: reference.coverage === 'complete' ? complete : null,
    taskMetrics: metric(tp, fp, fn), alignment: rows, checks,
    issues: rows.flatMap(row => row.forbiddenInferences.map(item => ({code: 'D5_FORBIDDEN_INFERENCE', path: item.path, rule: item.code}))),
    severity: {criticalMajor, major, severe: 0, forbidden, teachingLeak}, promotionEligible: Boolean(complete),
  }
}

export function aggregateCandidate13V4(rows) {
  const determinate = rows.every(row => ['SCORED', 'PARSE_OR_SCHEMA_FAILURE'].includes(row.status))
  const totals = rows.reduce((acc, row) => {
    for (const key of ['tp', 'fp', 'fn']) acc[key] += row.taskMetrics?.[key] ?? 0
    for (const key of ['criticalMajor', 'major', 'severe', 'forbidden', 'teachingLeak']) acc[key] += row.severity?.[key] ?? 0
    return acc
  }, {tp: 0, fp: 0, fn: 0, criticalMajor: 0, major: 0, severe: 0, forbidden: 0, teachingLeak: 0})
  return {scorerVersion: D5_SCORER_VERSION, sources: rows.length, determinate,
    schemaAndReferenceValid: rows.filter(row => row.schemaValid && row.referenceValid).length,
    completeSources: rows.filter(row => row.complete === true).length, taskMetrics: metric(totals.tp, totals.fp, totals.fn),
    severity: Object.fromEntries(['criticalMajor', 'major', 'severe', 'forbidden', 'teachingLeak'].map(key => [key, totals[key]])),
    promotionEligible: rows.length > 0 && determinate && rows.every(row => row.promotionEligible),
    boundary: 'Synthetic Development engineering score only; human correctness and user conversion remain NOT_OBSERVABLE.'}
}
