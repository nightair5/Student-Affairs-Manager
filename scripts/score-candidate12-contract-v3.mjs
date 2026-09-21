import {
  ReferenceContractError,
  normalize,
  stable,
  validateScorerInputV3,
} from './candidate12-reference-contract.mjs'

export const SCORER_VERSION = 'candidate12-scoring-3.0.0'

const at = (value, path) => path.split('.').reduce((node, key) => node?.[key], value)
const stringSet = value => [...new Set((Array.isArray(value) ? value : []).map(normalize))].sort()
const sameSet = (left, right) => stable(stringSet(left)) === stable(stringSet(right))
const includesAll = (actual, expected) => {
  const values = new Set(stringSet(actual))
  return (Array.isArray(expected) ? expected : []).every(item => values.has(normalize(item)))
}

export function fieldPass(actual, rule) {
  if (!rule || typeof rule !== 'object') throw Error('D3_SCORER_RULE_INVALID')
  if ('equals' in rule) return stable(actual) === stable(rule.equals)
  if ('oneOf' in rule) return rule.oneOf.some(value => stable(actual) === stable(value))
  if ('setEquals' in rule) return sameSet(actual, rule.setEquals)
  if ('containsAll' in rule) return includesAll(actual, rule.containsAll)
  if ('deepContainsAll' in rule) return Array.isArray(actual) && rule.deepContainsAll.every(expected => actual.some(item => {
    if (!item || typeof item !== 'object') return false
    return Object.entries(expected).every(([key, value]) => Array.isArray(value)
      ? includesAll(item[key], value) : stable(item[key]) === stable(value))
  }))
  if ('requiredFragments' in rule) return Array.isArray(actual)
    && rule.requiredFragments.every(fragment => actual.some(value => normalize(value).includes(normalize(fragment))))
  if ('forbiddenFragments' in rule) return Array.isArray(actual)
    && !actual.some(value => rule.forbiddenFragments.some(fragment => normalize(value).includes(normalize(fragment))))
  if ('countEquals' in rule) return Array.isArray(actual) && actual.length === rule.countEquals
  throw Error('D3_SCORER_RULE_UNKNOWN')
}

export function currentActionable(task) {
  return task.semantics?.actor === 'addressee' && task.semantics?.speechAct === 'directive'
    && task.semantics?.polarity === 'affirmative' && task.semantics?.validity === 'active'
    && task.semantics?.status === 'pending' && task.semantics?.modality === 'required'
    && ['true', 'not_applicable'].includes(task.condition?.value)
}

const identity = task => `${task.action}::${task.object}`

function relationType(value) {
  if (value === 'amends') return ['revisionRelations', 'amends']
  if (value === 'cancels') return ['cancellationRelations', 'cancels']
  if (['replaces', 'supersedes'].includes(value)) return ['replacementRelations', 'replaces']
  return null
}

export function candidateTaskFacts(result) {
  const taskMap = new Map(result.tasks.map(task => [task.id, task]))
  const taskIdentity = id => {
    const task = taskMap.get(id)
    return task ? `${task.action?.surface}::${task.object?.surface}` : 'DANGLING'
  }
  const facts = result.tasks.map(task => ({
    id: task.id,
    action: task.action?.surface ?? '',
    object: task.object?.surface ?? '',
    semanticStatus: task.semantics?.status,
    semanticValidity: task.semantics?.validity,
    actionable: currentActionable(task),
    condition: {value: task.condition?.value},
    completionStandard: task.detail?.completionCriteria ?? [],
    materials: (result.materials ?? []).filter(item => item.relatedTaskTempIds?.includes(task.id)).map(item => item.name),
    timePoints: (result.timePoints ?? []).filter(item => item.relatedTaskTempIds?.includes(task.id)).map(item => ({
      rawTexts: [item.rawText],
      normalizedValues: item.normalizedValue == null ? [] : [item.normalizedValue],
      type: item.type === 'submission_deadline' ? 'deadline' : item.type,
      precision: item.precision,
      actionable: item.actionable ?? true,
    })),
    dependencies: (task.detail?.dependencyTempIds ?? []).map(taskIdentity),
    revisionRelations: [],
    cancellationRelations: [],
    replacementRelations: [],
    raw: task,
  }))
  const factsById = new Map(facts.map(item => [item.id, item]))
  for (const relation of result.revisions ?? []) {
    const typed = relationType(relation.type)
    if (!typed) continue
    const [bucket, type] = typed
    const from = relation.fromDirectiveId ?? null
    const target = relation.targetDirectiveId
    const signature = `${type}|${from === null ? 'NONE' : taskIdentity(from)}|${taskIdentity(target)}`
    const owner = from === null ? factsById.get(target) : factsById.get(from)
    if (owner) owner[bucket].push(signature)
  }
  return facts
}

function compatible(gold, prediction) {
  return gold.actionObjectAliases.some(pair => normalize(pair.action) === normalize(prediction.action)
    && normalize(pair.object) === normalize(prediction.object))
}

function canSharePrediction(gold, existingGolds) {
  return existingGolds.every(other => gold.allowedMergeIds.includes(other.id) && other.allowedMergeIds.includes(gold.id)
    && !gold.forbiddenMergeIds.includes(other.id) && !other.forbiddenMergeIds.includes(gold.id))
}

function matchings(gold, predicted, limit) {
  let best = -1, bestUnique = -1, visited = 0, overflow = false
  const maps = [], mapping = [], users = new Map()
  function visit(index, matched) {
    if (++visited > limit) { overflow = true; return }
    if (matched + gold.length - index < best) return
    if (index === gold.length) {
      const unique = new Set(mapping.filter(value => value >= 0)).size
      if (matched > best || (matched === best && unique > bestUnique)) {
        best = matched
        bestUnique = unique
        maps.length = 0
      }
      if (matched === best && unique === bestUnique) maps.push([...mapping])
      return
    }
    for (let candidate = 0; candidate < predicted.length; candidate++) {
      if (!compatible(gold[index], predicted[candidate])) continue
      const existing = users.get(candidate) ?? []
      if (existing.length && !canSharePrediction(gold[index], existing.map(goldIndex => gold[goldIndex]))) continue
      users.set(candidate, [...existing, index])
      mapping.push(candidate)
      visit(index + 1, matched + 1)
      mapping.pop()
      if (existing.length) users.set(candidate, existing); else users.delete(candidate)
      if (overflow) return
    }
    mapping.push(-1)
    visit(index + 1, matched)
    mapping.pop()
  }
  visit(0, 0)
  return {maps, best, bestUnique, overflow}
}

function metric(tp, fp, fn) {
  const precision = tp + fp ? tp / (tp + fp) : 1
  const recall = tp + fn ? tp / (tp + fn) : 1
  return {tp, fp, fn, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0}
}

function invalidReference(error) {
  return {
    scorerVersion: SCORER_VERSION,
    status: 'REFERENCE_CONTRACT_INVALID',
    referenceValid: false,
    schemaValid: null,
    complete: null,
    taskMetrics: null,
    alignment: [],
    issues: [{code: error.code ?? 'D3_REFERENCE_CONTRACT_INVALID', path: error.path ?? '$'}],
    severity: {criticalMajor: 0, major: 0, severe: 1, forbidden: 0, teachingLeak: 0},
    promotionEligible: false,
  }
}

export function scoreCandidate12V3(reference, result, {schemaValid = true, searchLimit = 50000, teachingFingerprints = []} = {}) {
  try { validateScorerInputV3(reference) } catch (error) {
    if (error instanceof ReferenceContractError) return invalidReference(error)
    throw error
  }
  if (!schemaValid || !result || !Array.isArray(result.tasks) || !Array.isArray(result.materials)
    || !Array.isArray(result.timePoints) || !Array.isArray(result.revisions)) {
    return {
      scorerVersion: SCORER_VERSION, status: 'PARSE_OR_SCHEMA_FAILURE', referenceValid: true, schemaValid: false,
      complete: false, taskMetrics: null, alignment: [], issues: [{code: 'D3_PREDICTION_SCHEMA_INVALID', path: '$'}],
      severity: {criticalMajor: 0, major: 0, severe: 1, forbidden: 0, teachingLeak: 0}, promotionEligible: false,
    }
  }
  const ids = result.tasks.map(task => task?.id)
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
    return scoreCandidate12V3(reference, null, {schemaValid: false})
  }
  const predictions = candidateTaskFacts(result)
  const matching = matchings(reference.tasks, predictions, searchLimit)
  if (matching.overflow) return {
    scorerVersion: SCORER_VERSION, status: 'MATCH_LIMIT_ADJUDICATION', referenceValid: true, schemaValid: true,
    complete: null, taskMetrics: null, alignment: [], issues: [{code: 'D3_ADJUDICATION_REQUIRED', path: '$'}],
    severity: {criticalMajor: 0, major: 0, severe: 0, forbidden: 0, teachingLeak: 0}, promotionEligible: false,
  }
  const outcomes = matching.maps.map(mapping => {
    const rows = mapping.map((predictionIndex, goldIndex) => {
      const gold = reference.tasks[goldIndex]
      const prediction = predictionIndex < 0 ? null : predictions[predictionIndex]
      const fields = Object.entries(gold.fields).map(([path, rule]) => ({
        path,
        severity: rule.severity,
        pass: prediction !== null && fieldPass(at(prediction, path), rule),
        reason: prediction === null ? 'PREDICTION_NOT_ALIGNED'
          : fieldPass(at(prediction, path), rule) ? 'FIELD_RULE_MATCH' : 'FIELD_RULE_MISMATCH',
      }))
      return {goldId: gold.id, predictedId: prediction?.id ?? null, predictionIndex, aligned: prediction !== null,
        correct: prediction !== null && fields.every(field => field.pass), fields}
    })
    const signature = stable(rows.map(({goldId, aligned, correct, fields}) => ({goldId, aligned, correct, fields})))
    const quality = rows.reduce((sum, row) => sum + (row.correct ? 1000 : 0) + row.fields.filter(field => field.pass).length, 0)
    return {rows, signature, quality}
  })
  const bestQuality = Math.max(...outcomes.map(item => item.quality), 0)
  const bestOutcomes = outcomes.filter(item => item.quality === bestQuality)
  if (new Set(bestOutcomes.map(item => item.signature)).size > 1) return {
    scorerVersion: SCORER_VERSION, status: 'AMBIGUOUS_MATCH', referenceValid: true, schemaValid: true,
    complete: null, taskMetrics: null, alignment: [], issues: [{code: 'D3_ADJUDICATION_REQUIRED', path: '$'}],
    severity: {criticalMajor: 0, major: 0, severe: 0, forbidden: 0, teachingLeak: 0}, promotionEligible: false,
  }
  const rows = bestOutcomes[0]?.rows ?? []
  const matchedPredictions = new Set(rows.filter(row => row.aligned).map(row => row.predictionIndex))
  const tp = rows.filter(row => row.aligned).length
  const fn = reference.tasks.length - tp
  const fp = predictions.length - matchedPredictions.size
  const failedFields = rows.flatMap(row => row.fields.filter(field => !field.pass))
  const unmatchedGold = rows.filter(row => !row.aligned).length
  const unmatchedPredictions = predictions.filter((_item, index) => !matchedPredictions.has(index))
  const forbidden = unmatchedPredictions.filter(item => item.actionable).length
  const serialized = stable(result)
  const teachingLeak = teachingFingerprints.filter(fragment => fragment && normalize(serialized).includes(normalize(fragment))).length
  const checks = reference.checks.map(check => ({checkId: check.checkId, path: check.path, operator: check.operator,
    pass: fieldPass(at(result, check.path), {[check.operator]: check.value})}))
  const criticalMajor = failedFields.filter(field => field.severity === 'critical_major').length
  const major = failedFields.filter(field => field.severity === 'major').length + unmatchedGold
  const complete = reference.coverage === 'complete' && fn === 0 && fp === 0 && failedFields.length === 0
    && checks.every(check => check.pass) && forbidden === 0 && teachingLeak === 0
  return {
    scorerVersion: SCORER_VERSION,
    status: reference.coverage === 'complete' ? 'SCORED' : 'REFERENCE_INCOMPLETE',
    referenceValid: true,
    schemaValid: true,
    complete: reference.coverage === 'complete' ? complete : null,
    taskMetrics: metric(tp, fp, fn),
    alignment: rows,
    checks,
    issues: reference.coverage === 'partial' ? [{code: 'D3_REFERENCE_INCOMPLETE', path: '$.coverage'}] : [],
    severity: {criticalMajor, major, severe: 0, forbidden, teachingLeak},
    states: {
      actionable: predictions.filter(task => task.actionable).length,
      unknownCondition: predictions.filter(task => task.condition.value === 'unknown').length,
      falseCondition: predictions.filter(task => task.condition.value === 'false').length,
      inactive: predictions.filter(task => ['cancelled', 'superseded', 'expired'].includes(task.semanticValidity)).length,
    },
    promotionEligible: reference.coverage === 'complete' && complete && criticalMajor === 0 && major === 0
      && forbidden === 0 && teachingLeak === 0,
  }
}

export function aggregateCandidate12V3(rows) {
  const determinate = rows.every(row => ['SCORED', 'PARSE_OR_SCHEMA_FAILURE'].includes(row.status))
  const totals = rows.reduce((acc, row) => {
    for (const key of ['tp', 'fp', 'fn']) acc[key] += row.taskMetrics?.[key] ?? 0
    for (const key of ['criticalMajor', 'major', 'severe', 'forbidden', 'teachingLeak']) acc[key] += row.severity?.[key] ?? 0
    return acc
  }, {tp: 0, fp: 0, fn: 0, criticalMajor: 0, major: 0, severe: 0, forbidden: 0, teachingLeak: 0})
  return {
    scorerVersion: SCORER_VERSION,
    sources: rows.length,
    determinate,
    schemaAndReferenceValid: rows.filter(row => row.schemaValid === true && row.referenceValid === true).length,
    completeSources: rows.filter(row => row.complete === true).length,
    taskMetrics: metric(totals.tp, totals.fp, totals.fn),
    severity: Object.fromEntries(['criticalMajor', 'major', 'severe', 'forbidden', 'teachingLeak'].map(key => [key, totals[key]])),
    promotionEligible: rows.length > 0 && determinate && rows.every(row => row.promotionEligible),
    boundary: 'Reference-relative engineering score only; not human accept-and-save conversion or historical D2 promotion evidence.',
  }
}
