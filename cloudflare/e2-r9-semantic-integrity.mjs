function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value))
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function actionText(value) {
  return text(value).toLowerCase().replace(/[\s\p{P}\p{S}和及与并的]/gu, '')
}

function sameSet(left, right) {
  return canonicalJson([...new Set(array(left))].sort()) === canonicalJson([...new Set(array(right))].sort())
}

function containsAll(container, required) {
  const values = new Set(array(container))
  return array(required).every((item) => values.has(item))
}

function flattenTasks(result) {
  const tasks = [...array(result.standaloneTasks), ...array(result.tasks)]
  for (const milestoneValue of array(result.milestones)) {
    const milestone = record(milestoneValue)
    tasks.push(...array(milestone.tasks))
    for (const workPackageValue of array(milestone.workPackages)) tasks.push(...array(record(workPackageValue).tasks))
  }
  return tasks.map(record)
}

function issue(kind, factId, code, field) {
  return { kind, factId, code, field }
}

function obligationIssues(result, graph) {
  const tasks = flattenTasks(result)
  return graph.obligations.flatMap((fact) => {
    const task = tasks.find((candidate) => (
      actionText(candidate.actionVerb || candidate.actionPredicate) === actionText(fact.actionPredicate)
      && actionText(candidate.actionObject || candidate.object) === actionText(fact.object)
      && containsAll(candidate.evidenceIds, fact.evidenceIds)
    ))
    return task ? [] : [issue('obligation', fact.id, 'SEMANTIC_PROJECTION_MISSING', 'action+object+evidence')]
  })
}

function materialIssues(result, graph) {
  return graph.materials.flatMap((fact) => {
    const projected = array(result.materials).map(record).find((item) => item.tempId === fact.sourceMaterialId)
    if (!projected) return [issue('material', fact.id, 'SEMANTIC_PROJECTION_MISSING', 'tempId')]
    const fields = [
      ['name', text(projected.name) === text(fact.name)],
      ['required', projected.required === fact.required],
      ['formatRequirements', sameSet(projected.formatRequirements, fact.formatRequirements)],
      ['namingRequirements', sameSet(projected.namingRequirements, fact.namingRequirements)],
      ['quantity', projected.quantity === fact.quantity],
      ['submissionChannel', projected.submissionChannel === fact.submissionChannel],
      ['evidenceIds', containsAll(projected.evidenceIds, fact.evidenceIds)],
    ]
    return fields.filter(([, valid]) => !valid).map(([field]) => issue('material', fact.id, 'SEMANTIC_PROJECTION_MUTATED', field))
  })
}

function timePointIssues(result, graph) {
  return graph.timePoints.flatMap((fact) => {
    const projected = array(result.timePoints).map(record).find((item) => item.tempId === fact.sourceTimePointId)
    if (!projected) return [issue('timePoint', fact.id, 'SEMANTIC_PROJECTION_MISSING', 'tempId')]
    const fields = [
      ['role', projected.type === fact.role], ['rawText', text(projected.rawText) === text(fact.rawText)],
      ['normalizedValue', projected.normalizedValue === fact.normalizedValue], ['timezone', projected.timezone === fact.timezone],
      ['isAllDay', projected.isAllDay === fact.isAllDay], ['precision', projected.precision === fact.precision],
      ['needsConfirmation', projected.needsConfirmation === fact.needsConfirmation],
      ['evidenceIds', containsAll(projected.evidenceIds, fact.evidenceIds)],
    ]
    return fields.filter(([, valid]) => !valid).map(([field]) => issue('timePoint', fact.id, 'SEMANTIC_PROJECTION_MUTATED', field))
  })
}

function eventIssues(result, graph) {
  return graph.events.flatMap((fact) => {
    const projected = array(result.events).map(record).find((item) => item.tempId === fact.sourceEventId)
    if (!projected) return [issue('event', fact.id, 'SEMANTIC_PROJECTION_MISSING', 'tempId')]
    const fields = [
      ['title', text(projected.title) === text(fact.title)], ['description', text(projected.description) === text(fact.description)],
      ['location', projected.location === fact.location],
      ['startTimePoint', projected.startTimePointTempId === (fact.startTimePointId?.replace(/^time:/u, '') ?? null)],
      ['endTimePoint', projected.endTimePointTempId === (fact.endTimePointId?.replace(/^time:/u, '') ?? null)],
      ['inferenceLevel', projected.inferenceLevel === fact.inferenceLevel],
      ['evidenceIds', containsAll(projected.evidenceIds, fact.evidenceIds)],
    ]
    return fields.filter(([, valid]) => !valid).map(([field]) => issue('event', fact.id, 'SEMANTIC_PROJECTION_MUTATED', field))
  })
}

function ambiguityFamily(code, message) {
  const value = `${text(code)} ${text(message)}`
  if (/(?:条件|资格|适用|录用|入选|符合|满足|通过|eligib|applicab|condition)/iu.test(value)) return 'applicability'
  if (/(?:时间|日期|截止|公布|何时|time|date|deadline)/iu.test(value)) return 'time'
  if (/(?:责任|对象|谁|范围|actor|owner|scope)/iu.test(value)) return 'scope'
  return 'other'
}

function ambiguityIssues(result, graph) {
  const projected = array(result.ambiguities).map(record)
  return graph.ambiguities.flatMap((fact) => {
    const sameId = projected.find((item) => item.id === fact.id)
    const equivalentMerge = projected.find((item) => (
      containsAll(item.evidenceIds, fact.evidenceIds)
      && ambiguityFamily(item.field, item.message) === ambiguityFamily(fact.code, fact.message)
    ))
    const match = sameId || equivalentMerge
    if (!match) return [issue('ambiguity', fact.id, 'SEMANTIC_PROJECTION_MISSING', 'meaning+evidence')]
    if (!containsAll(match.evidenceIds, fact.evidenceIds)) return [issue('ambiguity', fact.id, 'SEMANTIC_PROJECTION_MUTATED', 'evidenceIds')]
    if (sameId && ambiguityFamily(match.field, match.message) !== ambiguityFamily(fact.code, fact.message)) {
      return [issue('ambiguity', fact.id, 'SEMANTIC_PROJECTION_MUTATED', 'semanticFamily')]
    }
    return []
  })
}

function conditionIssues(result, graph) {
  const projected = array(result.ambiguities).map(record)
  return graph.conditions.flatMap((fact) => {
    const represented = projected.some((item) => (
      containsAll(item.evidenceIds, fact.evidenceIds)
      && ambiguityFamily(item.field, item.message) === 'applicability'
    ))
    return represented ? [] : [issue('condition', fact.id, 'SEMANTIC_PROJECTION_MISSING', 'applicability+evidence')]
  })
}

export function compareR9FactGraphSnapshots(before, after) {
  return canonicalJson(before) === canonicalJson(after)
    ? []
    : [issue('factGraph', '$', 'FACT_GRAPH_MUTATED', 'canonicalSnapshot')]
}

export function evaluateR9SemanticIntegrity(result, graph) {
  const issues = [
    ...obligationIssues(result, graph), ...materialIssues(result, graph), ...timePointIssues(result, graph),
    ...eventIssues(result, graph), ...conditionIssues(result, graph), ...ambiguityIssues(result, graph),
  ]
  return {
    issueCount: issues.length,
    missingCount: issues.filter((item) => item.code === 'SEMANTIC_PROJECTION_MISSING').length,
    mutationCount: issues.filter((item) => item.code === 'SEMANTIC_PROJECTION_MUTATED').length,
    issues,
  }
}

export function assertR9SemanticIntegrity(result, graph) {
  const integrity = evaluateR9SemanticIntegrity(result, graph)
  if (integrity.issueCount) throw new Error(`R9_SEMANTIC_INTEGRITY_INVALID:${canonicalJson(integrity.issues)}`)
  return result
}
