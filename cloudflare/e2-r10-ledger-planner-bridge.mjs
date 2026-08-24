import {
  R10_FACT_LEDGER_SCHEMA_VERSION,
  R10_PLANNER_INPUT_SCHEMA_VERSION,
  assertR10FactLedger,
  assertR10PlannerInput,
} from './e2-r10-factledger-contract.mjs'

export const R10_LEDGER_PLANNER_BRIDGE_VERSION = 'e2-r10-ledger-planner-bridge-1.1.0'
export const R10_BRIDGE_PERMISSIONS = Object.freeze({
  mayReadSourceTextForInference: false,
  mayAddOrDeleteFacts: false,
  mayChangeFactMeaning: false,
  mayChangeTimeRoleOrValue: false,
  mayCloseMissingRelations: false,
  mayDropDanglingReferences: false,
  mayDeduplicateReferences: true,
  stripsSourceText: true,
})

const COLLECTIONS = Object.freeze([
  'obligations', 'materials', 'timeExpressions', 'events', 'conditions', 'constraints', 'ambiguities', 'evidence',
])

const REFERENCE_FIELDS = Object.freeze({
  obligations: ['materialIds', 'timeExpressionIds', 'eventIds', 'conditionIds', 'constraintIds', 'evidenceIds'],
  materials: ['obligationIds', 'constraintIds', 'evidenceIds'],
  timeExpressions: ['relatedObligationIds', 'relatedEventIds', 'evidenceIds'],
  events: ['conditionIds', 'evidenceIds'],
  conditions: ['appliesToFactIds', 'evidenceIds'],
  constraints: ['appliesToFactIds', 'evidenceIds'],
  ambiguities: ['targetFactIds', 'evidenceIds'],
  evidence: [],
})

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'))
}

function cloneCollections(value) {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, structuredClone(value[name])]))
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

function semanticCollections(value) {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, value[name].map((entry) => {
    const copy = structuredClone(entry)
    for (const field of REFERENCE_FIELDS[name]) copy[field] = uniqueSorted(copy[field])
    return copy
  })]))
}

export function r10LedgerSemanticSnapshot(value) {
  return JSON.stringify(canonical(semanticCollections(value)))
}

export function buildR10PlannerInput(ledger) {
  assertR10FactLedger(ledger)
  const before = r10LedgerSemanticSnapshot(ledger)
  const plannerInput = {
    schemaVersion: R10_PLANNER_INPUT_SCHEMA_VERSION,
    ledgerSchemaVersion: R10_FACT_LEDGER_SCHEMA_VERSION,
    referenceTime: ledger.referenceTime,
    timezone: ledger.timezone,
    sourceLength: ledger.sourceText.length,
    ...cloneCollections(ledger),
  }
  for (const name of COLLECTIONS) {
    for (const entry of plannerInput[name]) {
      for (const field of REFERENCE_FIELDS[name]) entry[field] = uniqueSorted(entry[field])
    }
  }
  if (r10LedgerSemanticSnapshot(plannerInput) !== before) throw new Error('R10_BRIDGE_SEMANTIC_MUTATION_FORBIDDEN')
  return assertR10PlannerInput(plannerInput)
}
