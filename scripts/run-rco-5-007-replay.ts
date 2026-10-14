import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ScopeReferenceCandidate } from '../src/recognition/scopeReferenceContract'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import { formLocalTaskSuggestions, reduceModelCandidate, validateLocalTaskFormation } from '../src/recognition/taskFormationPolicyV2'
import { verifyRco5007Freeze } from './rco-5-007-integrity.mjs'

interface SourceOnlyCase {
  id: string
  sourceTitle: string
  sourceText: string
  sourceVersionId: string
  referenceTime: string
  timezone: string
}

interface SourceOnlyInput {
  schemaVersion: string
  sourceDatasetId: string
  sourceDatasetSha256: string
  containsExpected: false
  cases: SourceOnlyCase[]
}

interface RawRecord {
  caseId: string
  role: string
  status: string
  parsed?: ScopeReferenceCandidate
  contentSha256?: string
}

interface RawResults {
  runId: string
  records: RawRecord[]
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceInputPath = resolve(root, 'docs/recognition-optimization/rco-5-007-replay/b1-source-input.json')
const rawResultsPath = resolve(root, 'docs/recognition-optimization/rco-5-006-b1-runs/rco-5-006-b1-m1-20260903b/raw-results.json')
const outputPath = resolve(root, 'docs/recognition-optimization/rco-5-007-replay/predictions.json')

if (process.argv.includes('--verified')) await verifyRco5007Freeze(root, 'prediction')

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

const [sourceBytes, rawBytes] = await Promise.all([readFile(sourceInputPath), readFile(rawResultsPath)])
const sourceInput = JSON.parse(sourceBytes.toString('utf8')) as SourceOnlyInput
const raw = JSON.parse(rawBytes.toString('utf8')) as RawResults
if (sourceInput.containsExpected !== false || JSON.stringify(sourceInput).includes('"expected"')) throw new Error('EXPECTED_LEAK_IN_PREDICTOR_INPUT')
if (sourceInput.cases.length !== 12) throw new Error('SOURCE_CASE_COUNT_NOT_12')

const candidateRecords = raw.records.filter((record) => record.role === 'candidate')
if (candidateRecords.length !== 12) throw new Error('CANDIDATE_RECORD_COUNT_NOT_12')

const cases = []
for (const sourceCase of sourceInput.cases) {
  const record = candidateRecords.find((item) => item.caseId === sourceCase.id)
  if (!record?.parsed || record.status !== 'completed') throw new Error(`CANDIDATE_UNAVAILABLE:${sourceCase.id}`)
  const scopeIndex = await indexImmutableScopesV11(sourceCase.id, sourceCase.sourceVersionId, sourceCase.sourceText)
  const reduced = reduceModelCandidate(record.parsed)
  const result = formLocalTaskSuggestions(scopeIndex, reduced)
  const issues = validateLocalTaskFormation(result, scopeIndex)
  cases.push({
    caseId: sourceCase.id,
    candidateContentSha256: record.contentSha256 ?? null,
    scopeIndex: {
      sourceId: scopeIndex.sourceId,
      sourceVersionId: scopeIndex.sourceVersionId,
      sourceFingerprint: scopeIndex.sourceFingerprint,
      scopes: scopeIndex.scopes.map(({ id, order, start, end, text, contentHash }) => ({ id, order, start, end, text, contentHash })),
    },
    reducedInput: reduced,
    result,
    validation: { valid: issues.length === 0, issues },
  })
}

const output = {
  schemaVersion: 'rco-5-007-replay-predictions-1.0.0',
  authorizationId: 'RCO-5-007',
  classification: 'SEEN_DIAGNOSTIC_REPLAY',
  generatedAt: 'DETERMINISTIC_ZERO_CALL_REPLAY',
  sourceRunId: raw.runId,
  inputIntegrity: {
    sourceOnlyInputSha256: sha256(sourceBytes),
    rawResultsSha256: sha256(rawBytes),
    sourceDatasetSha256: sourceInput.sourceDatasetSha256,
  },
  accounting: {
    modelCalls: 0,
    networkRequests: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
  },
  authority: {
    modelFieldsAcceptedAsFinalDecision: [],
    locallyGenerated: ['taskBoundaries', 'semantics', 'requiresAction', 'selected', 'explanationOwnership'],
  },
  cases,
}
const invalidCases = cases.filter((item) => !item.validation.valid)
if (invalidCases.length > 0) {
  console.error(JSON.stringify(invalidCases.map((item) => ({ caseId: item.caseId, issues: item.validation.issues })), null, 2))
  throw new Error('LOCAL_FORMATION_VALIDATION_FAILED')
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, cases: cases.length, validCases: cases.filter((item) => item.validation.valid).length, accounting: output.accounting }))
