import { describe, expect, it } from 'vitest'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  buildActionCandidateClassificationJsonSchema,
  validateActionCandidateClassification,
  type ActionCandidateClassificationResponse,
} from './actionCandidateClassificationContract'
import { indexLocalActionCandidates } from './localActionCandidateIndex'
import { indexImmutableScopesV11 } from './scopeIndexV11'

async function fixture(sourceText = '请保存甲表。请核对乙表。') {
  const index = await indexImmutableScopesV11('contract-source', 'source-v1', sourceText)
  const catalog = await indexLocalActionCandidates(index)
  const response: ActionCandidateClassificationResponse = {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: 'contract-run',
    classifications: catalog.candidates.map((candidate) => ({
      candidateId: candidate.id,
      verdict: 'proposition',
      objectCandidateId: candidate.defaultObjectCandidateId,
    })),
  }
  return { catalog, response }
}

describe('strict action candidate classification contract', () => {
  it('accepts an exact full-ledger response and permits no model-authored action or safety fields', async () => {
    const { catalog, response } = await fixture()
    const result = validateActionCandidateClassification(response, catalog, 'contract-run')
    expect(result).toMatchObject({ valid: true, rootUsable: true, completeness: 'complete', globalIssues: [], candidateIssues: [] })
    expect([...result.validClassifications]).toHaveLength(2)
    const schema = buildActionCandidateClassificationJsonSchema(catalog)
    const classificationsSchema = schema.properties.classifications as {
      items: { oneOf: Array<{ properties: Record<string, unknown> }> }
    }
    const itemProperties = classificationsSchema.items.oneOf[0].properties
    expect(Object.keys(itemProperties).sort()).toEqual(['candidateId', 'objectCandidateId', 'verdict'])
    expect(JSON.stringify(itemProperties)).not.toMatch(/requiresAction|semantics|revision|selected|surface|span/iu)
  })

  it('uses const empty classifications for a zero-candidate catalog', async () => {
    const { catalog } = await fixture('今天晴朗。')
    const schema = buildActionCandidateClassificationJsonSchema(catalog)
    expect(schema.properties.classifications).toEqual({ type: 'array', const: [] })
  })

  it('keeps legal siblings usable when one classification is missing or duplicated', async () => {
    const { catalog, response } = await fixture()
    const missing = structuredClone(response)
    missing.classifications.splice(0, 1)
    const missingResult = validateActionCandidateClassification(missing, catalog, 'contract-run')
    expect(missingResult).toMatchObject({ rootUsable: true, completeness: 'partial' })
    expect(missingResult.candidateIssues.map((issue) => issue.code)).toContain('CANDIDATE_CLASSIFICATION_MISSING')
    expect([...missingResult.validClassifications.keys()]).toEqual([catalog.candidates[1].id])

    const duplicate = structuredClone(response)
    duplicate.classifications.push(structuredClone(duplicate.classifications[0]))
    const duplicateResult = validateActionCandidateClassification(duplicate, catalog, 'contract-run')
    expect(duplicateResult.candidateIssues.map((issue) => issue.code)).toContain('CANDIDATE_CLASSIFICATION_DUPLICATE')
    expect([...duplicateResult.validClassifications.keys()]).toEqual([catalog.candidates[1].id])
  })

  it('isolates unknown IDs, cross-candidate objects and injected candidate fields', async () => {
    const { catalog, response } = await fixture()
    const unknown = structuredClone(response)
    unknown.classifications.push({ candidateId: 'action:unknown', verdict: 'proposition', objectCandidateId: catalog.candidates[0].defaultObjectCandidateId })
    const unknownResult = validateActionCandidateClassification(unknown, catalog, 'contract-run')
    expect(unknownResult.candidateIssues.map((issue) => issue.code)).toContain('UNKNOWN_CANDIDATE_ID')
    expect(unknownResult.validClassifications.size).toBe(2)

    const borrowed = structuredClone(response)
    borrowed.classifications[0].objectCandidateId = catalog.candidates[1].defaultObjectCandidateId
    const borrowedResult = validateActionCandidateClassification(borrowed, catalog, 'contract-run')
    expect(borrowedResult.candidateIssues.map((issue) => issue.code)).toContain('OBJECT_CANDIDATE_INVALID')
    expect([...borrowedResult.validClassifications.keys()]).toEqual([catalog.candidates[1].id])

    const injected = structuredClone(response) as unknown as { classifications: Array<Record<string, unknown>> }
    injected.classifications[0].selected = true
    const injectedResult = validateActionCandidateClassification(injected, catalog, 'contract-run')
    expect(injectedResult.candidateIssues.map((issue) => issue.code)).toContain('CLASSIFICATION_KEYS_INVALID')
    expect([...injectedResult.validClassifications.keys()]).toEqual([catalog.candidates[1].id])
  })

  it('rejects root replay or tampering globally and never exposes partial classifications', async () => {
    const { catalog, response } = await fixture()
    const rebound = structuredClone(response)
    rebound.sourceId = 'other-source'
    const result = validateActionCandidateClassification(rebound, catalog, 'contract-run')
    expect(result).toMatchObject({ valid: false, rootUsable: false, completeness: 'rejected_global' })
    expect(result.globalIssues.map((issue) => issue.code)).toContain('SOURCE_BINDING_MISMATCH')
    expect(result.validClassifications.size).toBe(0)
  })

  it('is independent of classification array order', async () => {
    const { catalog, response } = await fixture()
    const reversed = structuredClone(response)
    reversed.classifications.reverse()
    const result = validateActionCandidateClassification(reversed, catalog, 'contract-run')
    expect(result.valid).toBe(true)
    expect([...result.validClassifications.keys()].sort()).toEqual(catalog.candidates.map((candidate) => candidate.id).sort())
  })
})
