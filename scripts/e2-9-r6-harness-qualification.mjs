import {
  R6_FAILURE_CODES,
  R6_PROTOCOL_VERSION,
  buildLabelsEnvelope,
  buildPrivateBindingManifest,
  buildReviewerPacket,
  buildSeparatedPairArtifacts,
  canonicalJson,
  revealSeparatedBindings,
} from './e2-9-r6-path-mask.mjs'
import { createHash } from 'node:crypto'
import { hashBundle } from './e2-9-r5-hash.mjs'
import { buildR6DeploymentProjection } from './e2-9-r6-deployment-contract.mjs'

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')

const TEST_ONLY_REVEAL_SECRET = 'test-only-r6-harness-qualification-secret-material-0000000000000000000000'
const RUN_ID = 'e29r6-synthetic-qualification'
const LABELS_COMPLETED_AT = '2026-08-20T00:00:01.000Z'
const KEY_REVEALED_AT = '2026-08-20T00:00:02.000Z'
export const R6_QUALIFICATION_BUNDLE_FILES = Object.freeze([
  'cloudflare/recognition-prompt.mjs',
  'cloudflare/recognition.mjs',
  'cloudflare/recognition-quality.mjs',
  'cloudflare/model-gateway.mjs',
  'cloudflare/e2-v4-pro-benchmark.mjs',
  'cloudflare/worker.mjs',
  'cloudflare/e2-r6-harness.mjs',
  'cloudflare/e2-r6-qualification-worker.mjs',
  'cloudflare/e2-r6-qualification-ledger.mjs',
  'scripts/e2-9-r5-hash.mjs',
  'scripts/e2-9-r6-path-mask.mjs',
  'scripts/e2-9-r6-harness-qualification.mjs',
  'scripts/e2-9-r6-harness-qualification.node.mjs',
  'scripts/e2-9-r6-deployment-contract.mjs',
  'scripts/e2-9-r6-screening-review.node.mjs',
  'scripts/run-e2-9-r1.mjs',
  'scripts/score-e2-9-r1.mjs',
  'scripts/merge-e2-9-r1-checkpoints.mjs',
  'scripts/run-e2-9-r6-path-masked-review.mjs',
  'scripts/run-e2-9-r6-preview-preflight.mjs',
  'docs/e2-v4-pro-benchmark-r6/reviewer-packet.schema.json',
  'docs/e2-v4-pro-benchmark-r6/private-binding-manifest.schema.json',
  'docs/e2-v4-pro-benchmark-r6/path-masked-labels.schema.json',
  'docs/e2-v4-pro-benchmark-r6/preview-deployment-contract.json',
  'src/recognition/e2/scoring.ts',
  'src/recognition/e2/semanticEquivalence.ts',
  'wrangler.e2-r6-ledger.jsonc',
])

const baseResult = (title, actionObject) => ({
  sourceSummary: {
    title,
    sourceType: 'text',
    notificationType: 'material_submission',
    summary: `提交${actionObject}`,
    requiresAction: true,
    actionReason: '原文明示提交要求',
  },
  projectMatch: {
    decision: 'standalone_task',
    matchedProjectId: null,
    matchedProjectTitle: null,
    suggestedProjectTitle: null,
    reason: '单项事务',
    confidence: 0.9,
  },
  projectSuggestion: null,
  milestones: [],
  standaloneTasks: [{
    tempId: 'task-1', title: `提交${actionObject}`, actionVerb: '提交', actionObject,
    evidenceIds: ['evidence-1'], selected: true,
  }],
  materials: [],
  timePoints: [],
  events: [],
  ambiguities: [],
  conflicts: [],
  evidence: [{
    id: 'evidence-1', sourceId: 'synthetic-source', quote: `请提交${actionObject}`, quotedText: `请提交${actionObject}`,
    field: 'task', extractionMethod: 'synthetic', confidence: 1,
  }],
  ignoredContent: [],
  quality: { needsHumanReview: false, reviewReasons: [] },
})

export function runZeroModelHarnessQualification({ qualificationBundleSha256 = 'UNBOUND', deploymentConfigProjectionSha256 = 'UNBOUND' } = {}) {
  const cases = [
    { caseId: 'synthetic-001', title: '材料提交通知', content: '请提交申请表', object: '申请表' },
    { caseId: 'synthetic-002', title: '证明提交通知', content: '请提交在读证明', object: '在读证明' },
  ]
  const separated = cases.map((fixture, index) => buildSeparatedPairArtifacts({
    revealSecret: TEST_ONLY_REVEAL_SECRET,
    runId: RUN_ID,
    anonymousCaseId: `review-case-${String(index + 1).padStart(3, '0')}`,
    caseId: fixture.caseId,
    source: {
      sourceType: 'text', sourceTitle: fixture.title, content: fixture.content,
      referenceTime: '2026-08-20T00:00:00.000Z', timezone: 'Asia/Shanghai',
    },
    resultsByAlias: {
      flash: { ...baseResult(fixture.title, fixture.object), modelName: 'deepseek-v4-flash', execution: { requestedModel: 'deepseek-v4-flash' } },
      pro: { ...baseResult(fixture.title, fixture.object), modelName: 'deepseek-v4-pro', execution: { requestedModel: 'deepseek-v4-pro' } },
    },
  }))
  const reviewerPacket = buildReviewerPacket({
    rubric: {
      instruction: '只根据原文和匿名 X/Y 业务结果判断；不得获取外部运行材料。',
      labels: ['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'],
    },
    reviewerPairs: separated.map((item) => item.reviewerPair),
  })
  const privateManifest = buildPrivateBindingManifest({
    protocolVersion: R6_PROTOCOL_VERSION,
    runId: RUN_ID,
    reviewerPacket,
    privateBindings: separated.map((item) => item.privateBinding),
  })
  const labels = reviewerPacket.pairs.map((pair) => ({
    caseAnonymousId: pair.caseAnonymousId,
    preferredSide: 'TIE',
    xMajor: false,
    yMajor: false,
    xPlanningError: false,
    yPlanningError: false,
    reason: '合成结果在允许观察面内语义等价',
  }))
  const labelsEnvelope = buildLabelsEnvelope({
    protocolVersion: R6_PROTOCOL_VERSION,
    runId: RUN_ID,
    reviewerPacket,
    labelsCompletedAt: LABELS_COMPLETED_AT,
    reviewerKind: 'independent_fresh_read_only',
    reviewProcessId: 'synthetic-r6-qualification',
    labels,
  })
  const reveal = revealSeparatedBindings({
    revealSecret: TEST_ONLY_REVEAL_SECRET,
    protocolVersion: R6_PROTOCOL_VERSION,
    runId: RUN_ID,
    reviewerPacket,
    privateManifest,
    labelsEnvelope,
    keyRevealedAt: KEY_REVEALED_AT,
  })
  const syntheticScore = {
    pairCount: labels.length,
    ties: labels.filter((item) => item.preferredSide === 'TIE').length,
    mappingCount: reveal.mappings.length,
  }
  const gatePass = syntheticScore.pairCount === 2 && syntheticScore.ties === 2 && syntheticScore.mappingCount === 2
  return {
    schemaVersion: 'e2.9-r6-harness-qualification-result-1.0.0',
    protocolVersion: R6_PROTOCOL_VERSION,
    runId: RUN_ID,
    modelCalls: 0,
    networkCalls: 0,
    expectedAnswersLoaded: false,
    qualificationBundleSha256,
    deploymentConfigProjectionSha256,
    reviewerPacketSha256: sha256(canonicalJson(reviewerPacket)),
    privateManifestSha256: sha256(canonicalJson(privateManifest)),
    labelsSha256: labelsEnvelope.labelsSha256,
    publicPacketFields: ['schemaVersion', 'pathMaskVersion', 'rubric', 'pairs[].caseAnonymousId', 'pairs[].source', 'pairs[].X', 'pairs[].Y'],
    privateOnlyFields: ['caseId', 'XAlias', 'YAlias', 'sideXHash', 'sideYHash', 'assignmentCommitmentHash'],
    protocolMetadataExcludedFromLabelLeakScan: true,
    failureTaxonomy: Object.values(R6_FAILURE_CODES),
    stageSequence: ['SYNTHETIC_GENERATION', 'PUBLIC_PROJECTION', 'LABEL_FREEZE', 'PRIVATE_REVEAL', 'SYNTHETIC_SCORING', 'QUALIFICATION_GATE'],
    syntheticScore,
    status: gatePass ? 'HARNESS_QUALIFIED_FOR_FUTURE_PREFLIGHT' : 'HARNESS_QUALIFICATION_FAILED',
    nextStagesAuthorized: {
      modelReadiness: false,
      smoke: false,
      screening: false,
      selection: false,
      blind: false,
      production: false,
    },
  }
}

export async function runBoundZeroModelHarnessQualification({ root = process.cwd() } = {}) {
  const [bundle, deployment] = await Promise.all([
    hashBundle(root, R6_QUALIFICATION_BUNDLE_FILES),
    buildR6DeploymentProjection({ root }),
  ])
  return runZeroModelHarnessQualification({ qualificationBundleSha256: bundle.sha256, deploymentConfigProjectionSha256: deployment.sha256 })
}

export function assertFutureModelRunQualification(record, expectedQualificationSha256, expectedBundleSha256) {
  if (record?.status !== 'HARNESS_QUALIFIED_FOR_FUTURE_PREFLIGHT' || record.modelCalls !== 0 || record.networkCalls !== 0
    || record.qualificationBundleSha256 !== expectedBundleSha256
    || sha256(canonicalJson(record)) !== expectedQualificationSha256) {
    const error = new Error('HARNESS_QUALIFICATION_PREREQUISITE_NOT_MET')
    error.code = R6_FAILURE_CODES.HARNESS_INTEGRATION_FAILURE
    throw error
  }
  return true
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/gu, '/')}`).href) {
  console.log(JSON.stringify(await runBoundZeroModelHarnessQualification(), null, 2))
}
