import { describe, expect, it } from 'vitest'
import { artificialResponse, notices } from '../mainline01/fixtures'
import { parseSemanticInput, SEMANTIC_VERSION } from './semanticContract'

describe('MAINLINE-04 contract; engineering structures, not model gold', () => {
  it('records the unchanged old unknown-condition expressibility gap', () => {
    expect(notices['condition-unknown']).toContain('尚未收到审批结果')
    expect(() => artificialResponse('condition-unknown', 'manual-source')).toThrow('UNREPRESENTABLE_CONDITION_STATE')
  })
  const empty = () => ({ schemaVersion: SEMANTIC_VERSION, sourceId: 'manual-source', sourceVersionId: 'v1',
    sourceFingerprint: 'fingerprint', tasks: [], materials: [], timePoints: [], events: [], revisions: [],
    conflicts: [], informationScopeIds: [], unresolvedScopeIds: [] })
  it('accepts an explicitly empty structural envelope without inventing tasks', () => {
    expect(parseSemanticInput(empty())).toEqual(empty())
  })
  it.each(['selected', 'start', 'evidence', 'stableId', 'Expected', 'score'])('rejects injected root %s', key => {
    expect(() => parseSemanticInput({ ...empty(), [key]: true })).toThrow()
  })
  it('rejects missing fields, sparse arrays, accessors, cycles and foreign prototypes', () => {
    const missing: Record<string, unknown> = empty(); delete missing.revisions
    expect(() => parseSemanticInput(missing)).toThrow()
    expect(() => parseSemanticInput({ ...empty(), tasks: new Array(1) })).toThrow()
    const accessor = empty(); Object.defineProperty(accessor, 'tasks', { get() { throw new Error('GETTER_EXECUTED') } })
    expect(() => parseSemanticInput(accessor)).toThrow('NON_JSON')
    const cycle = empty(); Object.assign(cycle, { tasks: [cycle] })
    expect(() => parseSemanticInput(cycle)).toThrow()
    expect(() => parseSemanticInput(Object.assign(Object.create({ hidden: true }), empty()))).toThrow()
  })
})
