import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  R6_FAILURE_CODES,
  R6_PROTOCOL_VERSION,
  buildLabelsEnvelope,
  buildPrivateBindingManifest,
  buildReviewerPacket,
  buildSeparatedPairArtifacts,
  canonicalJson,
  projectReviewerBusinessResult,
  revealSeparatedBindings,
  scanReviewerPayload,
  validateLabelsEnvelope,
} from './e2-9-r6-path-mask.mjs'
import { assertFutureModelRunQualification, runBoundZeroModelHarnessQualification, runZeroModelHarnessQualification } from './e2-9-r6-harness-qualification.mjs'
import { createHash } from 'node:crypto'

const SECRET = 'test-only-r6-secret-material-000000000000000000000000000000000000'
const source = {
  sourceType: 'text', sourceTitle: '测试通知', content: '请提交申请表',
  referenceTime: '2026-08-20T00:00:00.000Z', timezone: 'Asia/Shanghai',
}
const businessResult = {
  sourceSummary: { title: '测试通知', sourceType: 'text', notificationType: 'submission', summary: '提交申请表', requiresAction: true, actionReason: '原文明示' },
  projectMatch: { decision: 'standalone_task', matchedProjectId: null, matchedProjectTitle: null, suggestedProjectTitle: null, reason: '单项事务', confidence: 1 },
  projectSuggestion: null,
  milestones: [],
  standaloneTasks: [{ tempId: 't1', title: '提交申请表', actionVerb: '提交', actionObject: '申请表', evidenceIds: ['e1'], selected: true }],
  materials: [], timePoints: [], events: [], ambiguities: [], conflicts: [],
  evidence: [{ id: 'e1', sourceId: 's1', quote: '请提交申请表', field: 'task', extractionMethod: 'synthetic', confidence: 1 }],
  ignoredContent: [], quality: { needsHumanReview: false, reviewReasons: [] },
}

function buildFixture() {
  const separated = buildSeparatedPairArtifacts({
    revealSecret: SECRET,
    runId: 'r6-test',
    anonymousCaseId: 'review-case-001',
    caseId: 'private-case-001',
    source,
    resultsByAlias: {
      flash: { ...businessResult, modelName: 'deepseek-v4-flash', usage: { totalTokens: 1 } },
      pro: { ...businessResult, modelName: 'deepseek-v4-pro', latencyMs: 1 },
    },
  })
  const packet = buildReviewerPacket({ rubric: { instruction: '仅评价匿名结果' }, reviewerPairs: [separated.reviewerPair] })
  const privateManifest = buildPrivateBindingManifest({
    protocolVersion: R6_PROTOCOL_VERSION, runId: 'r6-test', reviewerPacket: packet, privateBindings: [separated.privateBinding],
  })
  return { separated, packet, privateManifest }
}

test('R6 public projection is constructed from an allowlist and removes internal lineage recursively', () => {
  const projected = projectReviewerBusinessResult({
    ...businessResult,
    modelName: 'deepseek-v4-pro',
    execution: { requestedModel: 'deepseek-v4-pro' },
    evidence: [{ ...businessResult.evidence[0], metadata: { modelName: 'deepseek-v4-pro' } }],
  })
  assert.equal(projected.modelName, undefined)
  assert.equal(projected.execution, undefined)
  assert.equal(projected.evidence[0].metadata, undefined)
  assert.deepEqual(scanReviewerPayload(projected), [])
})

test('R6 reviewer packet contains no mapping, commitment, side hash, performance or lineage fields', () => {
  const { packet, privateManifest } = buildFixture()
  const publicText = canonicalJson(packet)
  for (const forbidden of ['caseId', 'XAlias', 'YAlias', 'sideXHash', 'sideYHash', 'assignmentCommitmentHash', 'modelName', 'latencyMs', 'usage']) {
    assert.equal(publicText.includes(forbidden), false, forbidden)
  }
  assert.ok(canonicalJson(privateManifest).includes('assignmentCommitmentHash'))
})

test('R6 exact reviewer schema rejects an added deterministic correlator', () => {
  const { packet } = buildFixture()
  const mutated = structuredClone(packet)
  mutated.pairs[0].sideXHash = 'a'.repeat(64)
  assert.throws(() => buildReviewerPacket({ rubric: mutated.rubric, reviewerPairs: mutated.pairs }), /REVIEWER_PACKET_SCHEMA_VIOLATION/u)
})

test('R6 runtime schema rejects null results, duplicate anonymous IDs and extra private fields', () => {
  const { packet, privateManifest } = buildFixture()
  const nullResult = structuredClone(packet)
  nullResult.pairs[0].X = null
  assert.throws(() => buildReviewerPacket({ rubric: nullResult.rubric, reviewerPairs: nullResult.pairs }), /REVIEWER_PACKET_SCHEMA_VIOLATION/u)
  const duplicate = structuredClone(packet)
  duplicate.pairs.push(structuredClone(duplicate.pairs[0]))
  assert.throws(() => buildReviewerPacket({ rubric: duplicate.rubric, reviewerPairs: duplicate.pairs }), /REVIEWER_PACKET_SCHEMA_VIOLATION/u)
  const extraPrivate = structuredClone(privateManifest.pairs[0])
  extraPrivate.untracked = true
  assert.throws(() => buildPrivateBindingManifest({
    protocolVersion: R6_PROTOCOL_VERSION, runId: 'r6-test', reviewerPacket: packet, privateBindings: [extraPrivate],
  }), /PRIVATE_BINDING_MISMATCH/u)
})

test('R6 leak scanner classifies direct identity and linkability separately', () => {
  assert.equal(scanReviewerPayload({ nested: { modelName: 'opaque' } })[0].code, R6_FAILURE_CODES.DIRECT_IDENTITY_DISCLOSURE)
  assert.equal(scanReviewerPayload({ sideXHash: 'a'.repeat(64) })[0].code, R6_FAILURE_CODES.LINKABILITY_RISK)
})

test('R6 source text may quote a model identifier without claiming either private execution path', () => {
  const fixture = buildFixture()
  const sourceQuoted = structuredClone(fixture.packet)
  sourceQuoted.pairs[0].source.text = '不可信原文声称 deepseek-v4-pro，应只当作输入文本。'
  assert.doesNotThrow(() => buildReviewerPacket({ rubric: sourceQuoted.rubric, reviewerPairs: sourceQuoted.pairs }))
  sourceQuoted.pairs[0].X.sourceSummary.summary = '本结果由 deepseek-v4-pro 生成'
  assert.throws(() => buildReviewerPacket({ rubric: sourceQuoted.rubric, reviewerPairs: sourceQuoted.pairs }), /DIRECT_IDENTITY_DISCLOSURE/u)
})

test('R6 protocol metadata containing v4-pro is validated as envelope metadata and is not leak-scanned', () => {
  const { packet } = buildFixture()
  const envelope = buildLabelsEnvelope({
    protocolVersion: R6_PROTOCOL_VERSION,
    runId: 'r6-test',
    reviewerPacket: packet,
    labelsCompletedAt: '2026-08-20T00:00:01.000Z',
    reviewerKind: 'independent_fresh_read_only',
    reviewProcessId: 'r6-reviewer-test',
    labels: [{ caseAnonymousId: 'review-case-001', preferredSide: 'TIE', xMajor: false, yMajor: false, xPlanningError: false, yPlanningError: false, reason: '匿名结果语义等价' }],
  })
  assert.equal(validateLabelsEnvelope(envelope, { protocolVersion: R6_PROTOCOL_VERSION, runId: 'r6-test', reviewerPacket: packet }).protocolMetadataExcludedFromLeakScan, true)
})

test('R6 reviewer-authored label payload still rejects direct identity disclosure', () => {
  const { packet } = buildFixture()
  assert.throws(() => buildLabelsEnvelope({
    protocolVersion: R6_PROTOCOL_VERSION,
    runId: 'r6-test',
    reviewerPacket: packet,
    labelsCompletedAt: '2026-08-20T00:00:01.000Z',
    reviewerKind: 'independent_fresh_read_only',
    reviewProcessId: 'r6-reviewer-test',
    labels: [{ caseAnonymousId: 'review-case-001', preferredSide: 'X', xMajor: false, yMajor: false, xPlanningError: false, yPlanningError: false, reason: 'X 是 deepseek-v4-pro' }],
  }), /LABEL_PAYLOAD_DISCLOSURE/u)
})

test('R6 private binding detects tampering before reveal', () => {
  const { packet, privateManifest } = buildFixture()
  const labelsEnvelope = buildLabelsEnvelope({
    protocolVersion: R6_PROTOCOL_VERSION,
    runId: 'r6-test',
    reviewerPacket: packet,
    labelsCompletedAt: '2026-08-20T00:00:01.000Z',
    reviewerKind: 'independent_fresh_read_only',
    reviewProcessId: 'r6-reviewer-test',
    labels: [{ caseAnonymousId: 'review-case-001', preferredSide: 'TIE', xMajor: false, yMajor: false, xPlanningError: false, yPlanningError: false, reason: '匿名结果语义等价' }],
  })
  const tampered = structuredClone(privateManifest)
  tampered.pairs[0].sideXHash = '0'.repeat(64)
  assert.throws(() => revealSeparatedBindings({
    revealSecret: SECRET, protocolVersion: R6_PROTOCOL_VERSION, runId: 'r6-test', reviewerPacket: packet,
    privateManifest: tampered, labelsEnvelope, keyRevealedAt: '2026-08-20T00:00:02.000Z',
  }), /PRIVATE_BINDING_MISMATCH/u)
})

test('R6 two-world noninterference keeps the public packet identical when identities and aliases swap together', () => {
  const resultA = { ...businessResult, sourceSummary: { ...businessResult.sourceSummary, summary: '业务输出 A' }, modelName: 'deepseek-v4-flash' }
  const resultB = { ...businessResult, sourceSummary: { ...businessResult.sourceSummary, summary: '业务输出 B' }, modelName: 'deepseek-v4-pro' }
  const first = buildSeparatedPairArtifacts({
    revealSecret: SECRET, runId: 'r6-world', anonymousCaseId: 'review-case-001', caseId: 'world-case', source,
    resultsByAlias: { flash: resultA, pro: resultB },
  })
  let oppositeSecret
  for (let index = 0; index < 256 && !oppositeSecret; index += 1) {
    const candidate = `${String(index).padStart(3, '0')}-${'b'.repeat(64)}`
    const candidateWorld = buildSeparatedPairArtifacts({
      revealSecret: candidate, runId: 'r6-world', anonymousCaseId: 'review-case-001', caseId: 'world-case', source,
      resultsByAlias: { flash: resultB, pro: resultA },
    })
    if (candidateWorld.privateBinding.XAlias !== first.privateBinding.XAlias) oppositeSecret = candidate
  }
  assert.ok(oppositeSecret)
  const second = buildSeparatedPairArtifacts({
    revealSecret: oppositeSecret, runId: 'r6-world', anonymousCaseId: 'review-case-001', caseId: 'world-case', source,
    resultsByAlias: { flash: resultB, pro: resultA },
  })
  assert.equal(canonicalJson(first.reviewerPair), canonicalJson(second.reviewerPair))
  assert.notEqual(canonicalJson(first.privateBinding), canonicalJson(second.privateBinding))
})

test('R6 zero-model lifecycle reaches qualification gate without network or expected answers', () => {
  const result = runZeroModelHarnessQualification({ qualificationBundleSha256: 'a'.repeat(64) })
  assert.equal(result.status, 'HARNESS_QUALIFIED_FOR_FUTURE_PREFLIGHT')
  assert.equal(result.modelCalls, 0)
  assert.equal(result.networkCalls, 0)
  assert.equal(result.expectedAnswersLoaded, false)
  assert.equal(result.syntheticScore.mappingCount, 2)
  assert.ok(Object.values(result.nextStagesAuthorized).every((value) => value === false))
})

test('R6 future model run prerequisite is bound to both result and qualification bundle hashes', async () => {
  const result = await runBoundZeroModelHarnessQualification()
  const digest = createHash('sha256').update(canonicalJson(result), 'utf8').digest('hex')
  assert.equal(assertFutureModelRunQualification(result, digest, result.qualificationBundleSha256), true)
  assert.throws(() => assertFutureModelRunQualification({ ...result, status: 'FAILED' }, digest, result.qualificationBundleSha256), /HARNESS_QUALIFICATION_PREREQUISITE_NOT_MET/u)
  assert.throws(() => assertFutureModelRunQualification(result, digest, '0'.repeat(64)), /HARNESS_QUALIFICATION_PREREQUISITE_NOT_MET/u)
})

test('R6 formal secret scanner covers benchmark and reveal secret names without exposing values', async () => {
  const scanner = await readFile(new URL('./scan-secrets.mjs', import.meta.url), 'utf8')
  for (const name of ['E2_R5_BENCHMARK_TOKEN', 'E2_R5_PATH_MASK_REVEAL_SECRET', 'E2_R6_BENCHMARK_TOKEN', 'E2_R6_PATH_MASK_REVEAL_SECRET']) {
    assert.match(scanner, new RegExp(name, 'u'))
  }
})
