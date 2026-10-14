// Pure, bounded scorer. No transport, credentials, ledger or filesystem imports.
export const SCORER_VERSION = 'candidate11-scoring-2.0.0'
export const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/gu, '').trim()
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const at = (value, path) => path.split('.').reduce((node, key) => node?.[key], value)
const aliases = (value, allowed) => allowed.some(alias => normalize(value) === normalize(alias))
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b)
  && stable([...new Set(a.map(normalize))].sort()) === stable([...new Set(b.map(normalize))].sort())

export function fieldPass(actual, rule) {
  if (!rule || typeof rule !== 'object') throw Error('C11_SCORER_RULE_INVALID')
  if ('equals' in rule) return stable(actual) === stable(rule.equals)
  if ('oneOf' in rule) return rule.oneOf.some(value => stable(actual) === stable(value))
  if ('setEquals' in rule) return sameSet(actual, rule.setEquals)
  // Explicit adjudication constraints, never used to establish task identity.
  if ('forbiddenFragments' in rule) return Array.isArray(actual)
    && !actual.some(value => rule.forbiddenFragments.some(fragment => normalize(value).includes(normalize(fragment))))
  if ('requiredFragments' in rule) return Array.isArray(actual)
    && rule.requiredFragments.every(fragment => actual.some(value => normalize(value).includes(normalize(fragment))))
  throw Error('C11_SCORER_RULE_UNKNOWN')
}

export function currentActionable(task) {
  return task.semantics?.actor === 'addressee' && task.semantics?.speechAct === 'directive'
    && task.semantics?.polarity === 'affirmative' && task.semantics?.validity === 'active'
    && task.semantics?.status === 'pending' && task.semantics?.modality === 'required'
    && ['true', 'not_applicable'].includes(task.condition?.value)
}

export function taskFacts(result, task) {
  const tasks = new Map(result.tasks.map(item => [item.id, item]))
  const target = id => { const item = tasks.get(id); return item ? `${normalize(item.action.surface)}:${normalize(item.object.surface)}` : 'DANGLING' }
  return { ...task, actionable: currentActionable(task),
    dependencies: (task.detail?.dependencyTempIds ?? []).map(target).sort(),
    times: (task.detail?.timePointTempIds ?? []).map(id => {
      const time = (result.timePoints ?? []).find(value => value.tempId === id)
      return time ? { rawText: time.rawText, normalizedValue: time.normalizedValue, type: time.type } : 'DANGLING'
    }),
    timeRaw: (task.detail?.timePointTempIds ?? []).map(id => (result.timePoints ?? []).find(t => t.tempId === id)?.rawText ?? 'DANGLING'),
    materials: (result.materials ?? []).filter(item => item.relatedTaskTempIds?.includes(task.id)).map(item => item.name).sort(),
  }
}

function compatible(gold, prediction) {
  return aliases(prediction.action?.surface, gold.actions) && aliases(prediction.object?.surface, gold.objects)
    && (gold.actor === undefined || prediction.semantics?.actor === gold.actor)
    && (!gold.scopeIds || gold.scopeIds.some(id => prediction.propositionScopeIds?.includes(id)))
}

// Enumerate maximum-cardinality compatible mappings, bounded fail-closed.
// IDs and order never decide field correctness. Different optimal conclusions
// require adjudication; excessive combinatorics also require adjudication.
function matchings(gold, predicted, limit) {
  let best = -1, visited = 0, overflow = false
  const maps = [], mapping = [], used = new Set()
  function visit(index, matched) {
    if (++visited > limit) { overflow = true; return }
    if (matched + gold.length - index < best) return
    if (index === gold.length) {
      if (matched > best) { best = matched; maps.length = 0 }
      if (matched === best) maps.push([...mapping])
      return
    }
    for (let j = 0; j < predicted.length; j++) if (!used.has(j) && compatible(gold[index], predicted[j])) {
      used.add(j); mapping.push(j); visit(index + 1, matched + 1); mapping.pop(); used.delete(j)
      if (overflow) return
    }
    mapping.push(-1); visit(index + 1, matched); mapping.pop()
  }
  visit(0, 0)
  return { maps, best, overflow }
}

function validateReference(reference) {
  if (!reference || !Array.isArray(reference.tasks) || !['complete', 'partial'].includes(reference.coverage)) throw Error('C11_REFERENCE_INVALID')
  const ids = new Set()
  for (const item of reference.tasks) {
    if (!item.id || ids.has(item.id) || !item.actions?.length || !item.objects?.length) throw Error('C11_REFERENCE_IDENTITY_INVALID')
    ids.add(item.id)
    for (const rule of Object.values(item.fields ?? {})) fieldPass(undefined, rule)
  }
}

export function scoreCandidate11(reference, result, { schemaValid = true, searchLimit = 50000 } = {}) {
  validateReference(reference)
  const denominator = { plannedSources: 1, expectedTasks: reference.tasks.length }
  if (!result || !Array.isArray(result.tasks) || !schemaValid) return {
    scorerVersion: SCORER_VERSION, status: 'PARSE_OR_SCHEMA_FAILURE', ...denominator,
    complete: false, taskMetrics: null, alignment: [], issues: ['PREDICTED_ENTITY_COUNT_NOT_COMPUTABLE'],
  }
  const ids = result.tasks.map(task => task?.id)
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) return scoreCandidate11(reference, null)
  const candidates = result.tasks.map(task => taskFacts(result, task))
  const matching = matchings(reference.tasks, candidates, searchLimit)
  const outcomes = matching.maps.map(mapping => {
    const rows = mapping.map((prediction, index) => {
      const gold = reference.tasks[index], item = candidates[prediction]
      const fields = Object.entries(gold.fields ?? {}).map(([path, rule]) => ({path, pass: prediction >= 0 && fieldPass(at(item, path), rule)}))
      return {goldId:gold.id, predictedId:prediction < 0 ? null : item.id, aligned:prediction >= 0,
        correct:prediction >= 0 && fields.every(field => field.pass), fields}
    })
    return {rows, signature:stable(rows.map(({goldId, aligned, correct, fields}) => ({goldId, aligned, correct, fields})).sort((a,b)=>a.goldId.localeCompare(b.goldId)))}
  })
  if (matching.overflow || new Set(outcomes.map(value => value.signature)).size > 1) return {
    scorerVersion:SCORER_VERSION, status:matching.overflow ? 'MATCH_LIMIT_ADJUDICATION' : 'AMBIGUOUS_MATCH', ...denominator,
    complete:null, taskMetrics:null, alignment:[], issues:['ADJUDICATION_REQUIRED'],
  }
  const rows = outcomes[0]?.rows ?? [], aligned = rows.filter(row=>row.aligned).length, correct = rows.filter(row=>row.correct).length
  const predicted = candidates.length, expected = reference.tasks.length
  const checks = (reference.checks ?? []).map(check => ({name:check.name,pass:fieldPass(at(result,check.path),check.rule)}))
  const knownChecksPass = aligned === expected && aligned === predicted && correct === expected && checks.every(check=>check.pass)
  const metric = tp => ({tp,fp:predicted-tp,fn:expected-tp,precision:predicted ? tp/predicted : null,recall:expected ? tp/expected : null})
  return {scorerVersion:SCORER_VERSION,status:reference.coverage === 'partial' ? 'REFERENCE_INCOMPLETE' : 'SCORED',...denominator,
    complete:reference.coverage === 'complete' ? knownChecksPass : null, knownChecksPass,
    taskMetrics:{expected,predicted,alignedPairs:aligned,correctPairs:correct,alignment:metric(aligned),correctness:metric(correct)},
    alignment:rows, checks, issues:reference.coverage === 'partial' ? ['REFERENCE_INCOMPLETE'] : [],
    states:{actionable:candidates.filter(task=>task.actionable).length,unknownCondition:candidates.filter(task=>task.condition?.value==='unknown').length,
      falseCondition:candidates.filter(task=>task.condition?.value==='false').length,inactive:candidates.filter(task=>['cancelled','superseded'].includes(task.semantics?.validity)).length}}
}

export function aggregateCandidate11(rows) {
  return {plannedSources:rows.length, completeCases:rows.filter(row=>row.complete===true).length,
    completeCaseRate:rows.length && rows.every(row=>row.complete!==null) ? rows.filter(row=>row.complete===true).length/rows.length : null,
    verifiedCorrectLowerBound:rows.length ? rows.filter(row=>row.complete===true).length/rows.length : null,
    definitive:rows.every(row=>['SCORED','PARSE_OR_SCHEMA_FAILURE'].includes(row.status)),
    unresolved:rows.filter(row=>row.complete===null).length,
    failures:rows.filter(row=>row.status==='PARSE_OR_SCHEMA_FAILURE').length,
    promotionAllowed:rows.length>0 && rows.every(row=>row.status==='SCORED'),
    boundary:'Engineering/reference-relative scores, not human conversion or independent model validation.'}
}
