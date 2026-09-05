import { describe, expect, it } from 'vitest'
import dataFreezeJson from '../../docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json'
import resultJson from '../../docs/recognition-optimization/rco-5-009-b9-runs/rco-5-009-b9-zero-call-20260904a/result.json'
import { compareExactCountMaps } from './countMapComparison'

const keys = ['accepted_local', 'accepted_model', 'ignored_local', 'ignored_model', 'quarantined'] as const

describe('fixed-key count-map comparison', () => {
  it('treats the frozen B9 ledger maps as equal despite opposite key order', () => {
    const expected = dataFreezeJson.expectedLedgerCounts
    const actual = resultJson.evaluation.counts.actualLedger
    expect(JSON.stringify(expected)).not.toBe(JSON.stringify(actual))
    expect(compareExactCountMaps(expected, actual, keys)).toMatchObject({ exact: true, issues: [] })
  })

  it('rejects a changed value, even when both maps have every allowed key', () => {
    const actual = { ...dataFreezeJson.expectedLedgerCounts, quarantined: 4 }
    expect(compareExactCountMaps(dataFreezeJson.expectedLedgerCounts, actual, keys)).toMatchObject({
      exact: false,
      issues: ['COUNT_VALUE_MISMATCH:quarantined'],
    })
  })

  it('rejects missing and extra keys instead of accepting symmetric omissions', () => {
    const missing = { accepted_local: 11, accepted_model: 2, ignored_local: 1, ignored_model: 2 }
    expect(compareExactCountMaps(missing, missing, keys).exact).toBe(false)
    expect(compareExactCountMaps(dataFreezeJson.expectedLedgerCounts, { ...dataFreezeJson.expectedLedgerCounts, other: 0 }, keys).exact).toBe(false)
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid count %s', (invalid) => {
    const actual = { ...dataFreezeJson.expectedLedgerCounts, accepted_local: invalid }
    expect(compareExactCountMaps(dataFreezeJson.expectedLedgerCounts, actual, keys).exact).toBe(false)
  })
})
