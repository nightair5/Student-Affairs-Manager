function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function normalize(value) {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[\s\p{P}\p{S}和及与的]/gu, '')
    : ''
}

function overlaps(left, right) {
  const a = normalize(left)
  const b = normalize(right)
  return Boolean(a && b && (a.includes(b) || b.includes(a)))
}

function flattenTasks(result) {
  const tasks = [...array(result.standaloneTasks), ...array(result.tasks)]
  for (const milestoneValue of array(result.milestones)) {
    const milestone = record(milestoneValue)
    tasks.push(...array(milestone.tasks))
    for (const workPackageValue of array(milestone.workPackages)) {
      tasks.push(...array(record(workPackageValue).tasks))
    }
  }
  return tasks.map(record)
}

function taskRepresentsObligation(task, obligation) {
  if (obligation.sourceTaskId && task.tempId === obligation.sourceTaskId) return true
  const predicate = task.actionVerb || task.actionPredicate || ''
  const object = task.actionObject || task.object || task.title || ''
  return normalize(predicate) === normalize(obligation.actionPredicate) && overlaps(object, obligation.object)
}

function factBySourceId(resultValues, sourceId, semanticValue, fields) {
  return array(resultValues).some((value) => {
    const item = record(value)
    if (sourceId && item.tempId === sourceId) return true
    return fields.some((field) => overlaps(item[field], semanticValue))
  })
}

function evidenceIntersects(left, right) {
  const ids = new Set(array(left).filter((value) => typeof value === 'string'))
  return array(right).some((id) => ids.has(id))
}

function ambiguityRepresents(resultAmbiguities, ambiguity) {
  return array(resultAmbiguities).some((value) => {
    const item = record(value)
    return item.id === ambiguity.id
      || evidenceIntersects(item.evidenceIds, ambiguity.evidenceIds)
      || overlaps(item.message, ambiguity.message)
  })
}

function conditionRepresents(resultAmbiguities, condition) {
  return array(resultAmbiguities).some((value) => {
    const item = record(value)
    if (evidenceIntersects(item.evidenceIds, condition.evidenceIds)) return true
    const message = normalize(item.message)
    const conditionText = normalize(condition.text)
    if (message && conditionText && (message.includes(conditionText) || conditionText.includes(message))) return true
    const anchor = condition.text.match(/(?:已录用|符合|满足|通过|未通过|仅限|只限|如果|若)([^，。；]{2,24})/u)?.[0]
    return Boolean(anchor && normalize(item.message).includes(normalize(anchor)))
  })
}

function ratio(numerator, denominator, empty = 1) {
  return denominator ? numerator / denominator : empty
}

export function evaluateR8ContractCoverage(resultValue, graph) {
  const result = record(resultValue)
  const tasks = flattenTasks(result)
  const obligationsCovered = graph.obligations.filter((obligation) => tasks.some((task) => taskRepresentsObligation(task, obligation))).length
  const materialsCovered = graph.materials.filter((material) => factBySourceId(result.materials, material.sourceMaterialId, material.name, ['name'])).length
  const timesCovered = graph.timePoints.filter((timePoint) => factBySourceId(result.timePoints, timePoint.sourceTimePointId, timePoint.rawText, ['rawText'])).length
  const timeRolesCorrect = graph.timePoints.filter((timePoint) => array(result.timePoints).some((value) => {
    const item = record(value)
    const sameFact = item.tempId === timePoint.sourceTimePointId || overlaps(item.rawText, timePoint.rawText)
    return sameFact && item.type === timePoint.role
  })).length
  const eventsCovered = graph.events.filter((event) => factBySourceId(result.events, event.sourceEventId, event.title, ['title'])).length
  const conditionsCovered = graph.conditions.filter((condition) => conditionRepresents(result.ambiguities, condition)).length
  const ambiguitiesCovered = graph.ambiguities.filter((ambiguity) => ambiguityRepresents(result.ambiguities, ambiguity)).length
  const unsupportedTasks = tasks.filter((task) => !graph.obligations.some((obligation) => taskRepresentsObligation(task, obligation))).length
  const falsePrecisionTimes = array(result.timePoints).filter((value) => {
    const item = record(value)
    return ['relative', 'vague'].includes(item.precision) && (item.normalizedValue !== null || item.needsConfirmation !== true)
  }).length
  const totalFacts = graph.obligations.length + graph.materials.length + graph.timePoints.length
    + graph.events.length + graph.conditions.length + graph.ambiguities.length
  const coveredFacts = obligationsCovered + materialsCovered + timesCovered + eventsCovered
    + conditionsCovered + ambiguitiesCovered

  return {
    counts: {
      obligations: graph.obligations.length, obligationsCovered,
      materials: graph.materials.length, materialsCovered,
      timePoints: graph.timePoints.length, timePointsCovered: timesCovered, timeRolesCorrect,
      events: graph.events.length, eventsCovered,
      conditions: graph.conditions.length, conditionsCovered,
      ambiguities: graph.ambiguities.length, ambiguitiesCovered,
      totalFacts, coveredFacts, factLosses: totalFacts - coveredFacts,
      plannedTasks: tasks.length, unsupportedTasks, falsePrecisionTimes,
    },
    rates: {
      obligationCoverage: ratio(obligationsCovered, graph.obligations.length),
      materialCoverage: ratio(materialsCovered, graph.materials.length),
      timePointCoverage: ratio(timesCovered, graph.timePoints.length),
      timeRoleAccuracy: ratio(timeRolesCorrect, graph.timePoints.length),
      eventCoverage: ratio(eventsCovered, graph.events.length),
      conditionCoverage: ratio(conditionsCovered, graph.conditions.length),
      ambiguityCoverage: ratio(ambiguitiesCovered, graph.ambiguities.length),
      factCoverage: ratio(coveredFacts, totalFacts),
      factLossRate: ratio(totalFacts - coveredFacts, totalFacts, 0),
      unsupportedTaskRate: ratio(unsupportedTasks, tasks.length, 0),
      falsePrecisionTimeRate: ratio(falsePrecisionTimes, array(result.timePoints).length, 0),
    },
  }
}

export function aggregateR8ContractCoverage(values) {
  const countNames = [
    'obligations', 'obligationsCovered', 'materials', 'materialsCovered', 'timePoints', 'timePointsCovered',
    'timeRolesCorrect', 'events', 'eventsCovered', 'conditions', 'conditionsCovered', 'ambiguities',
    'ambiguitiesCovered', 'totalFacts', 'coveredFacts', 'factLosses', 'plannedTasks', 'unsupportedTasks',
    'falsePrecisionTimes',
  ]
  const counts = Object.fromEntries(countNames.map((name) => [name, values.reduce((sum, value) => sum + value.counts[name], 0)]))
  return {
    counts,
    rates: {
      obligationCoverage: ratio(counts.obligationsCovered, counts.obligations),
      materialCoverage: ratio(counts.materialsCovered, counts.materials),
      timePointCoverage: ratio(counts.timePointsCovered, counts.timePoints),
      timeRoleAccuracy: ratio(counts.timeRolesCorrect, counts.timePoints),
      eventCoverage: ratio(counts.eventsCovered, counts.events),
      conditionCoverage: ratio(counts.conditionsCovered, counts.conditions),
      ambiguityCoverage: ratio(counts.ambiguitiesCovered, counts.ambiguities),
      factCoverage: ratio(counts.coveredFacts, counts.totalFacts),
      factLossRate: ratio(counts.factLosses, counts.totalFacts, 0),
      unsupportedTaskRate: ratio(counts.unsupportedTasks, counts.plannedTasks, 0),
      falsePrecisionTimeRate: ratio(counts.falsePrecisionTimes, counts.timePoints, 0),
    },
  }
}

export function assertR8PlannedResultContract(result, graph) {
  const coverage = evaluateR8ContractCoverage(result, graph)
  const issues = []
  if (coverage.counts.factLosses > 0) issues.push(`FACT_LOSS:${coverage.counts.factLosses}`)
  if (coverage.counts.unsupportedTasks > 0) issues.push(`UNSUPPORTED_TASK:${coverage.counts.unsupportedTasks}`)
  if (coverage.counts.falsePrecisionTimes > 0) issues.push(`FALSE_TIME_PRECISION:${coverage.counts.falsePrecisionTimes}`)
  if (issues.length) throw new Error(`R8_PLANNED_RESULT_CONTRACT_INVALID:${issues.join(',')}`)
  return result
}
