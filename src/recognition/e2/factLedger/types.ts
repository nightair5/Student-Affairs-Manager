export const FACT_LEDGER_SCHEMA_VERSION = 'e2.5-fact-ledger-1.0.0' as const

export type FactLedgerModality = 'required' | 'conditional' | 'optional' | 'prohibited' | 'informational'

export type FactLedgerMaterialRole = 'deliverable' | 'required_input' | 'carry_item' | 'reference'

export type FactLedgerTimeRole =
  | 'registration_deadline'
  | 'submission_deadline'
  | 'task_deadline'
  | 'planned_start'
  | 'event_start'
  | 'event_end'
  | 'result_announcement'
  | 'superseded_deadline'
  | 'other'

export type FactLedgerTimePrecision = 'exact' | 'date_only' | 'range' | 'relative' | 'vague' | 'unknown'

export type FactLedgerConditionKind = 'eligibility' | 'prerequisite' | 'trigger' | 'exception' | 'sequence'

export type FactLedgerConstraintKind = 'format' | 'naming' | 'quantity' | 'channel' | 'location' | 'dependency' | 'other'

export interface FactLedgerEvidence {
  id: string
  quote: string
  start: number
  end: number
}

export interface FactLedgerObligation {
  id: string
  actor: string | null
  modality: FactLedgerModality
  actionPredicate: string
  object: string
  materialIds: string[]
  timeExpressionIds: string[]
  eventIds: string[]
  conditionIds: string[]
  constraintIds: string[]
  evidenceIds: string[]
}

export interface FactLedgerMaterial {
  id: string
  name: string
  role: FactLedgerMaterialRole
  obligationIds: string[]
  constraintIds: string[]
  evidenceIds: string[]
}

export interface FactLedgerTimeExpression {
  id: string
  rawText: string
  role: FactLedgerTimeRole
  precision: FactLedgerTimePrecision
  normalizedValue: string | null
  endNormalizedValue: string | null
  timezone: string | null
  needsConfirmation: boolean
  relatedObligationIds: string[]
  relatedEventIds: string[]
  supersedesTimeExpressionId: string | null
  evidenceIds: string[]
}

export interface FactLedgerEvent {
  id: string
  title: string
  actor: string | null
  location: string | null
  startTimeExpressionId: string | null
  endTimeExpressionId: string | null
  conditionIds: string[]
  evidenceIds: string[]
}

export interface FactLedgerCondition {
  id: string
  kind: FactLedgerConditionKind
  text: string
  appliesToFactIds: string[]
  evidenceIds: string[]
}

export interface FactLedgerConstraint {
  id: string
  kind: FactLedgerConstraintKind
  text: string
  appliesToFactIds: string[]
  evidenceIds: string[]
}

export interface FactLedgerAmbiguity {
  id: string
  code: string
  targetFactIds: string[]
  message: string
  evidenceIds: string[]
}

export interface FactLedger {
  schemaVersion: typeof FACT_LEDGER_SCHEMA_VERSION
  referenceTime: string
  timezone: string
  sourceText: string
  obligations: FactLedgerObligation[]
  materials: FactLedgerMaterial[]
  timeExpressions: FactLedgerTimeExpression[]
  events: FactLedgerEvent[]
  conditions: FactLedgerCondition[]
  constraints: FactLedgerConstraint[]
  ambiguities: FactLedgerAmbiguity[]
  evidence: FactLedgerEvidence[]
}

export interface FactLedgerValidationIssue {
  code:
    | 'SCHEMA_VERSION'
    | 'DUPLICATE_ID'
    | 'MISSING_ACTION'
    | 'MISSING_EVIDENCE'
    | 'INVALID_EVIDENCE_SPAN'
    | 'INVALID_REFERENCE'
    | 'UNSAFE_TIME_NORMALIZATION'
    | 'INVALID_TIME_RANGE'
  path: string
  message: string
}
