import { describe, expect, it } from 'vitest'
import { FACT_LEDGER_SCHEMA_VERSION, type FactLedger } from './types'
import { validateFactLedger } from './validation'

function fixture(): FactLedger {
  const sourceText = '9月10日前提交报名表。'
  return {
    schemaVersion: FACT_LEDGER_SCHEMA_VERSION,
    referenceTime: '2026-08-08T08:00:00+08:00',
    timezone: 'Asia/Shanghai',
    sourceText,
    obligations: [{
      id: 'ob-1', actor: null, modality: 'required', actionPredicate: '提交', object: '报名表',
      materialIds: ['mat-1'], timeExpressionIds: ['time-1'], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['ev-1'],
    }],
    materials: [{ id: 'mat-1', name: '报名表', role: 'deliverable', obligationIds: ['ob-1'], constraintIds: [], evidenceIds: ['ev-1'] }],
    timeExpressions: [{
      id: 'time-1', rawText: '9月10日前', role: 'submission_deadline', precision: 'date_only',
      normalizedValue: '2026-09-10', endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
      relatedObligationIds: ['ob-1'], relatedEventIds: [], supersedesTimeExpressionId: null, evidenceIds: ['ev-1'],
    }],
    events: [], conditions: [], constraints: [], ambiguities: [],
    evidence: [{ id: 'ev-1', quote: sourceText, start: 0, end: sourceText.length }],
  }
}

describe('validateFactLedger', () => {
  it('accepts an evidence-grounded explicit ledger', () => {
    expect(validateFactLedger(fixture())).toEqual([])
  })

  it('rejects unsupported evidence spans', () => {
    const value = fixture()
    value.evidence[0].quote = '不存在的原文'
    expect(validateFactLedger(value).map((issue) => issue.code)).toContain('INVALID_EVIDENCE_SPAN')
  })

  it('rejects duplicate ids across fact collections', () => {
    const value = fixture()
    value.materials[0].id = 'ob-1'
    expect(validateFactLedger(value).map((issue) => issue.code)).toContain('DUPLICATE_ID')
  })

  it('rejects unknown cross-fact references', () => {
    const value = fixture()
    value.obligations[0].materialIds = ['missing-material']
    expect(validateFactLedger(value).map((issue) => issue.code)).toContain('INVALID_REFERENCE')
  })

  it('rejects false precision for relative time', () => {
    const value = fixture()
    value.timeExpressions[0] = {
      ...value.timeExpressions[0], precision: 'relative', normalizedValue: '2026-09-10', needsConfirmation: false,
    }
    expect(validateFactLedger(value).map((issue) => issue.code)).toContain('UNSAFE_TIME_NORMALIZATION')
  })

  it('requires an action predicate, object, and evidence for obligations', () => {
    const value = fixture()
    value.obligations[0] = { ...value.obligations[0], actionPredicate: '', object: '', evidenceIds: [] }
    expect(validateFactLedger(value).map((issue) => issue.code)).toEqual(expect.arrayContaining(['MISSING_ACTION', 'MISSING_EVIDENCE']))
  })
})
