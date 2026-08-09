import {
  FACT_LEDGER_SCHEMA_VERSION,
  type FactLedger,
  type FactLedgerConditionKind,
  type FactLedgerConstraintKind,
  type FactLedgerMaterialRole,
  type FactLedgerModality,
  type FactLedgerModelPayload,
  type FactLedgerTimePrecision,
  type FactLedgerTimeRole,
} from './types'
import { validateFactLedger } from './validation'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return isString(value) && allowed.includes(value as T)
}

function hasKeys(value: JsonRecord, keys: readonly string[]): boolean {
  return keys.every((key) => key in value) && Object.keys(value).every((key) => keys.includes(key))
}

const modalities: FactLedgerModality[] = ['required', 'conditional', 'optional', 'prohibited', 'informational']
const materialRoles: FactLedgerMaterialRole[] = ['deliverable', 'required_input', 'carry_item', 'reference']
const timeRoles: FactLedgerTimeRole[] = ['registration_deadline', 'submission_deadline', 'task_deadline', 'planned_start', 'event_start', 'event_end', 'result_announcement', 'superseded_deadline', 'other']
const timePrecisions: FactLedgerTimePrecision[] = ['exact', 'date_only', 'range', 'relative', 'vague', 'unknown']
const conditionKinds: FactLedgerConditionKind[] = ['eligibility', 'prerequisite', 'trigger', 'exception', 'sequence']
const constraintKinds: FactLedgerConstraintKind[] = ['format', 'naming', 'quantity', 'channel', 'location', 'dependency', 'other']

function isEvidence(value: unknown): boolean {
  return isRecord(value) && hasKeys(value, ['id', 'quote', 'start', 'end'])
    && isString(value.id) && isString(value.quote) && Number.isInteger(value.start) && Number.isInteger(value.end)
}

function isObligation(value: unknown): boolean {
  return isRecord(value) && hasKeys(value, ['id', 'actor', 'modality', 'actionPredicate', 'object', 'materialIds', 'timeExpressionIds', 'eventIds', 'conditionIds', 'constraintIds', 'evidenceIds'])
    && isString(value.id) && isNullableString(value.actor) && isEnum(value.modality, modalities)
    && isString(value.actionPredicate) && isString(value.object) && isStringArray(value.materialIds)
    && isStringArray(value.timeExpressionIds) && isStringArray(value.eventIds) && isStringArray(value.conditionIds)
    && isStringArray(value.constraintIds) && isStringArray(value.evidenceIds)
}

function isMaterial(value: unknown): boolean {
  return isRecord(value) && hasKeys(value, ['id', 'name', 'role', 'obligationIds', 'constraintIds', 'evidenceIds'])
    && isString(value.id) && isString(value.name) && isEnum(value.role, materialRoles)
    && isStringArray(value.obligationIds) && isStringArray(value.constraintIds) && isStringArray(value.evidenceIds)
}

function isTimeExpression(value: unknown): boolean {
  return isRecord(value) && hasKeys(value, ['id', 'rawText', 'role', 'precision', 'normalizedValue', 'endNormalizedValue', 'timezone', 'needsConfirmation', 'relatedObligationIds', 'relatedEventIds', 'supersedesTimeExpressionId', 'evidenceIds'])
    && isString(value.id) && isString(value.rawText) && isEnum(value.role, timeRoles) && isEnum(value.precision, timePrecisions)
    && isNullableString(value.normalizedValue) && isNullableString(value.endNormalizedValue) && isNullableString(value.timezone)
    && typeof value.needsConfirmation === 'boolean' && isStringArray(value.relatedObligationIds)
    && isStringArray(value.relatedEventIds) && isNullableString(value.supersedesTimeExpressionId) && isStringArray(value.evidenceIds)
}

function isEvent(value: unknown): boolean {
  return isRecord(value) && hasKeys(value, ['id', 'title', 'actor', 'location', 'startTimeExpressionId', 'endTimeExpressionId', 'conditionIds', 'evidenceIds'])
    && isString(value.id) && isString(value.title) && isNullableString(value.actor) && isNullableString(value.location)
    && isNullableString(value.startTimeExpressionId) && isNullableString(value.endTimeExpressionId)
    && isStringArray(value.conditionIds) && isStringArray(value.evidenceIds)
}

function isCondition(value: unknown): boolean {
  return isRecord(value) && hasKeys(value, ['id', 'kind', 'text', 'appliesToFactIds', 'evidenceIds'])
    && isString(value.id) && isEnum(value.kind, conditionKinds) && isString(value.text)
    && isStringArray(value.appliesToFactIds) && isStringArray(value.evidenceIds)
}

function isConstraint(value: unknown): boolean {
  return isRecord(value) && hasKeys(value, ['id', 'kind', 'text', 'appliesToFactIds', 'evidenceIds'])
    && isString(value.id) && isEnum(value.kind, constraintKinds) && isString(value.text)
    && isStringArray(value.appliesToFactIds) && isStringArray(value.evidenceIds)
}

function isAmbiguity(value: unknown): boolean {
  return isRecord(value) && hasKeys(value, ['id', 'code', 'targetFactIds', 'message', 'evidenceIds'])
    && isString(value.id) && isString(value.code) && isStringArray(value.targetFactIds)
    && isString(value.message) && isStringArray(value.evidenceIds)
}

function isPayload(value: unknown): value is FactLedgerModelPayload {
  if (!isRecord(value) || !hasKeys(value, ['schemaVersion', 'obligations', 'materials', 'timeExpressions', 'events', 'conditions', 'constraints', 'ambiguities', 'evidence'])) return false
  return value.schemaVersion === FACT_LEDGER_SCHEMA_VERSION
    && Array.isArray(value.obligations) && value.obligations.every(isObligation)
    && Array.isArray(value.materials) && value.materials.every(isMaterial)
    && Array.isArray(value.timeExpressions) && value.timeExpressions.every(isTimeExpression)
    && Array.isArray(value.events) && value.events.every(isEvent)
    && Array.isArray(value.conditions) && value.conditions.every(isCondition)
    && Array.isArray(value.constraints) && value.constraints.every(isConstraint)
    && Array.isArray(value.ambiguities) && value.ambiguities.every(isAmbiguity)
    && Array.isArray(value.evidence) && value.evidence.every(isEvidence)
}

export function parseFactLedgerJson(
  content: string,
  envelope: Pick<FactLedger, 'referenceTime' | 'timezone' | 'sourceText'>,
): FactLedger {
  let parsed: unknown
  try {
    parsed = JSON.parse(content) as unknown
  } catch {
    throw new Error('FACT_LEDGER_INVALID_JSON')
  }
  if (!isPayload(parsed)) throw new Error('FACT_LEDGER_SCHEMA_INVALID')
  const ledger: FactLedger = { ...parsed, ...envelope }
  const issues = validateFactLedger(ledger)
  if (issues.length > 0) throw new Error(`FACT_LEDGER_VALIDATION_FAILED:${issues.map((issue) => `${issue.code}@${issue.path}`).join(',')}`)
  return ledger
}
