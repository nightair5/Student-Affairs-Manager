import {
  FACT_LEDGER_SCHEMA_VERSION,
  type FactLedger,
  type FactLedgerValidationIssue,
} from './types'

function addIssue(
  issues: FactLedgerValidationIssue[],
  code: FactLedgerValidationIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message })
}

export function validateFactLedger(ledger: FactLedger): FactLedgerValidationIssue[] {
  const issues: FactLedgerValidationIssue[] = []
  if (ledger.schemaVersion !== FACT_LEDGER_SCHEMA_VERSION) {
    addIssue(issues, 'SCHEMA_VERSION', 'schemaVersion', `Expected ${FACT_LEDGER_SCHEMA_VERSION}`)
  }

  const collections = [
    ['obligations', ledger.obligations],
    ['materials', ledger.materials],
    ['timeExpressions', ledger.timeExpressions],
    ['events', ledger.events],
    ['conditions', ledger.conditions],
    ['constraints', ledger.constraints],
    ['ambiguities', ledger.ambiguities],
    ['evidence', ledger.evidence],
  ] as const
  const allIds = new Set<string>()
  collections.forEach(([name, entries]) => entries.forEach((entry, index) => {
    if (allIds.has(entry.id)) addIssue(issues, 'DUPLICATE_ID', `${name}[${index}].id`, `Duplicate id ${entry.id}`)
    allIds.add(entry.id)
  }))

  const evidenceIds = new Set(ledger.evidence.map((entry) => entry.id))
  ledger.evidence.forEach((entry, index) => {
    if (entry.start < 0 || entry.end <= entry.start || ledger.sourceText.slice(entry.start, entry.end) !== entry.quote) {
      addIssue(issues, 'INVALID_EVIDENCE_SPAN', `evidence[${index}]`, 'Evidence must be an exact source substring at the declared span')
    }
  })

  const checkEvidence = (ids: string[], path: string): void => {
    if (ids.length === 0) addIssue(issues, 'MISSING_EVIDENCE', path, 'Every fact requires literal source evidence')
    ids.forEach((id, index) => {
      if (!evidenceIds.has(id)) addIssue(issues, 'INVALID_REFERENCE', `${path}[${index}]`, `Unknown evidence id ${id}`)
    })
  }
  const checkReferences = (ids: string[], allowed: Set<string>, path: string): void => ids.forEach((id, index) => {
    if (!allowed.has(id)) addIssue(issues, 'INVALID_REFERENCE', `${path}[${index}]`, `Unknown referenced id ${id}`)
  })

  const obligationIds = new Set(ledger.obligations.map((entry) => entry.id))
  const materialIds = new Set(ledger.materials.map((entry) => entry.id))
  const timeIds = new Set(ledger.timeExpressions.map((entry) => entry.id))
  const eventIds = new Set(ledger.events.map((entry) => entry.id))
  const conditionIds = new Set(ledger.conditions.map((entry) => entry.id))
  const constraintIds = new Set(ledger.constraints.map((entry) => entry.id))

  ledger.obligations.forEach((entry, index) => {
    const path = `obligations[${index}]`
    if (!entry.actionPredicate.trim() || !entry.object.trim()) {
      addIssue(issues, 'MISSING_ACTION', path, 'Obligation requires an explicit action predicate and object')
    }
    checkReferences(entry.materialIds, materialIds, `${path}.materialIds`)
    checkReferences(entry.timeExpressionIds, timeIds, `${path}.timeExpressionIds`)
    checkReferences(entry.eventIds, eventIds, `${path}.eventIds`)
    checkReferences(entry.conditionIds, conditionIds, `${path}.conditionIds`)
    checkReferences(entry.constraintIds, constraintIds, `${path}.constraintIds`)
    checkEvidence(entry.evidenceIds, `${path}.evidenceIds`)
  })

  ledger.materials.forEach((entry, index) => {
    const path = `materials[${index}]`
    checkReferences(entry.obligationIds, obligationIds, `${path}.obligationIds`)
    checkReferences(entry.constraintIds, constraintIds, `${path}.constraintIds`)
    checkEvidence(entry.evidenceIds, `${path}.evidenceIds`)
  })

  ledger.timeExpressions.forEach((entry, index) => {
    const path = `timeExpressions[${index}]`
    if (['relative', 'vague', 'unknown'].includes(entry.precision)
      && (entry.normalizedValue !== null || entry.endNormalizedValue !== null || !entry.needsConfirmation)) {
      addIssue(issues, 'UNSAFE_TIME_NORMALIZATION', path, 'Relative, vague, and unknown time must remain null and require confirmation')
    }
    if (entry.precision === 'range' && (entry.normalizedValue === null || entry.endNormalizedValue === null)) {
      addIssue(issues, 'INVALID_TIME_RANGE', path, 'Exact ranges require both start and end values')
    }
    checkReferences(entry.relatedObligationIds, obligationIds, `${path}.relatedObligationIds`)
    checkReferences(entry.relatedEventIds, eventIds, `${path}.relatedEventIds`)
    if (entry.supersedesTimeExpressionId !== null) checkReferences([entry.supersedesTimeExpressionId], timeIds, `${path}.supersedesTimeExpressionId`)
    checkEvidence(entry.evidenceIds, `${path}.evidenceIds`)
  })

  ledger.events.forEach((entry, index) => {
    const path = `events[${index}]`
    if (entry.startTimeExpressionId !== null) checkReferences([entry.startTimeExpressionId], timeIds, `${path}.startTimeExpressionId`)
    if (entry.endTimeExpressionId !== null) checkReferences([entry.endTimeExpressionId], timeIds, `${path}.endTimeExpressionId`)
    checkReferences(entry.conditionIds, conditionIds, `${path}.conditionIds`)
    checkEvidence(entry.evidenceIds, `${path}.evidenceIds`)
  })

  const factIds = new Set([...obligationIds, ...materialIds, ...timeIds, ...eventIds, ...conditionIds, ...constraintIds])
  ledger.conditions.forEach((entry, index) => {
    checkReferences(entry.appliesToFactIds, factIds, `conditions[${index}].appliesToFactIds`)
    checkEvidence(entry.evidenceIds, `conditions[${index}].evidenceIds`)
  })
  ledger.constraints.forEach((entry, index) => {
    checkReferences(entry.appliesToFactIds, factIds, `constraints[${index}].appliesToFactIds`)
    checkEvidence(entry.evidenceIds, `constraints[${index}].evidenceIds`)
  })
  ledger.ambiguities.forEach((entry, index) => {
    checkReferences(entry.targetFactIds, factIds, `ambiguities[${index}].targetFactIds`)
    checkEvidence(entry.evidenceIds, `ambiguities[${index}].evidenceIds`)
  })

  return issues
}
