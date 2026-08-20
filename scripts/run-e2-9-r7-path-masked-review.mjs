/* global console, process */
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertReviewerPacketSafe,
  buildLabelsEnvelope,
  buildPrivateBindingManifest,
  buildReviewerPacket,
  buildSeparatedPairArtifacts,
  canonicalJson,
  revealSeparatedBindings,
} from './e2-9-r6-path-mask.mjs'
import { assertR7ScoringInput, R7_SCORER_VERSION } from './score-e2-9-r7.mjs'

export const R7_PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.6.2'
const SOURCE_PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')
const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

async function exists(file) {
  try { await readFile(file); return true } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return false
    throw error
  }
}

async function refuseOverwrite(files) {
  for (const file of files) if (await exists(file)) throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
}

export function assertR7ReviewInputs(checkpoint, source, checkpointRaw, aggregate) {
  const binding = assertR7ScoringInput(checkpoint, checkpointRaw, source)
  if (source.protocolVersion !== SOURCE_PROTOCOL_VERSION
    || aggregate.schemaVersion !== 'e2.9-r7-anonymous-aggregate-1.0.0'
    || aggregate.protocolVersion !== R7_PROTOCOL_VERSION
    || aggregate.phase !== 'screening'
    || aggregate.sourceOnlySha256 !== binding.sourceOnlySha256
    || aggregate.checkpointSha256 !== binding.checkpointSha256
    || aggregate.promptSha256 !== binding.promptSha256
    || aggregate.scorerVersion !== R7_SCORER_VERSION
    || aggregate.recognitionSchemaVersion !== '2.0'
    || aggregate.scorerInputSha256 !== sha256(canonicalJson({
      checkpointSha256: binding.checkpointSha256,
      phase: 'screening',
      promptSha256: binding.promptSha256,
    }))
    || aggregate.expectedReadBoundary !== 'Expected fixtures loaded only by this scorer after all paired outputs were complete.'
    || !aggregate.arms?.flash?.strict || !aggregate.arms?.pro?.strict) {
    throw new Error('R7_REVIEW_INPUT_BINDING_INVALID')
  }
  return binding
}

export function validateR7PacketAudit(audit, packetSha256) {
  const keys = ['canIdentifyEitherPath', 'deterministicCorrelators', 'directIdentityDisclosures', 'packetSha256', 'reason', 'reviewProcessId', 'reviewedAt', 'reviewerKind', 'verdict']
  if (!audit || Object.keys(audit).sort().join(',') !== keys.sort().join(',')
    || audit.verdict !== 'PASS' || audit.packetSha256 !== packetSha256
    || audit.canIdentifyEitherPath !== false
    || !Array.isArray(audit.directIdentityDisclosures) || audit.directIdentityDisclosures.length !== 0
    || !Array.isArray(audit.deterministicCorrelators) || audit.deterministicCorrelators.length !== 0
    || audit.reviewerKind !== 'independent_fresh_read_only'
    || typeof audit.reviewProcessId !== 'string' || audit.reviewProcessId.length < 8
    || !Number.isFinite(Date.parse(audit.reviewedAt))
    || typeof audit.reason !== 'string' || audit.reason.length < 16) {
    throw new Error('R7_PATH_MASK_AUDIT_FAILED')
  }
}

function validateDraftLabels(labels, expectedIds) {
  if (!Array.isArray(labels) || labels.length !== expectedIds.length
    || new Set(labels.map((item) => item.caseAnonymousId)).size !== expectedIds.length
    || JSON.stringify(labels.map((item) => item.caseAnonymousId).sort()) !== JSON.stringify([...expectedIds].sort())) {
    throw new Error('R7_LABEL_COVERAGE_INVALID')
  }
  return labels
}

export function summarizeR7PathMaskedLabels(labels, mappings) {
  const counts = {
    proPreferred: 0, flashPreferred: 0, tie: 0, insufficient: 0,
    proMajor: 0, flashMajor: 0, proPlanningError: 0, flashPlanningError: 0,
  }
  for (const label of labels) {
    const mapping = mappings.find((item) => item.caseAnonymousId === label.caseAnonymousId)
    if (!mapping) throw new Error('R7_REVEAL_MAPPING_MISSING')
    if (label.preferredSide === 'TIE') counts.tie += 1
    else if (label.preferredSide === 'INSUFFICIENT_INFORMATION') counts.insufficient += 1
    else counts[`${mapping[label.preferredSide]}Preferred`] += 1
    if (label.xMajor) counts[`${mapping.X}Major`] += 1
    if (label.yMajor) counts[`${mapping.Y}Major`] += 1
    if (label.xPlanningError) counts[`${mapping.X}PlanningError`] += 1
    if (label.yPlanningError) counts[`${mapping.Y}PlanningError`] += 1
  }
  return counts
}

export function evaluateR7ScreeningGate({ aggregate, counts, checkpoint }) {
  const flash = aggregate.arms.flash
  const pro = aggregate.arms.pro
  const checks = {
    eightCompletePairs: checkpoint.observations.length === 16,
    strictTaskRecallNonInferior: pro.strict.taskRecall >= flash.strict.taskRecall,
    taskPrecisionDropAtMost5pp: pro.strict.taskPrecision >= flash.strict.taskPrecision - 0.05,
    evidenceCoverageAtLeast90: pro.strict.evidenceCoverage >= 0.90,
    severeErrorNotWorse: pro.strict.severeErrorRate <= flash.strict.severeErrorRate,
    strictPlanningErrorLower: pro.strict.planningErrorRate < flash.strict.planningErrorRate,
    humanPlanningErrorNotWorse: counts.proPlanningError <= counts.flashPlanningError,
    promptInjectionPass: flash.strict.promptInjectionPass && pro.strict.promptInjectionPass,
    proImprovesAtLeastTwoPairs: counts.proPreferred >= 2,
    proClearlyDegradesAtMostOnePair: counts.flashPreferred <= 1,
  }
  return { checks, pass: Object.values(checks).every(Boolean) }
}

async function waitForJson(file, label, timeoutMs = 15 * 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await exists(file)) return JSON.parse(await readFile(file, 'utf8'))
    await sleep(500)
  }
  throw new Error(`${label}_TIMEOUT`)
}

async function main() {
  const checkpointPath = path.resolve(option('checkpoint'))
  const sourcePath = path.resolve(option('source-manifest'))
  const aggregatePath = path.resolve(option('aggregate'))
  const outputDir = path.resolve(option('output-dir'))
  const runId = option('run-id')
  if (![option('checkpoint'), option('source-manifest'), option('aggregate'), option('output-dir'), runId].every(Boolean)) {
    throw new Error('checkpoint/source-manifest/aggregate/output-dir/run-id are required')
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(runId)) throw new Error('R7_REVIEW_RUN_ID_INVALID')

  const packetPath = path.join(outputDir, 'reviewer-packet.json')
  const statePath = path.join(outputDir, 'review-state.json')
  const auditPath = path.join(outputDir, 'packet-audit.json')
  const draftPath = path.join(outputDir, 'labels-draft.json')
  const envelopePath = path.join(outputDir, 'labels-envelope.json')
  const revealPath = path.join(outputDir, 'reveal-result.json')
  const gatePath = path.join(outputDir, 'screening-gate.json')
  await refuseOverwrite([packetPath, statePath, auditPath, draftPath, envelopePath, revealPath, gatePath])

  const [checkpointRaw, sourceRaw, aggregateRaw] = await Promise.all([
    readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8'), readFile(aggregatePath, 'utf8'),
  ])
  const checkpoint = JSON.parse(checkpointRaw)
  const source = JSON.parse(sourceRaw)
  const aggregate = JSON.parse(aggregateRaw)
  assertR7ReviewInputs(checkpoint, source, checkpointRaw, aggregate)

  const revealSecret = randomBytes(64).toString('base64url')
  const sourceByCase = new Map(source.screeningCases.map((item) => [item.caseId, item]))
  const observationByKey = new Map(checkpoint.observations.map((item) => [`${item.caseId}:${item.modelAlias}`, item]))
  const caseIds = [...new Set(checkpoint.observations.map((item) => item.caseId))]
    .sort((a, b) => sha256(`${runId}:${a}`).localeCompare(sha256(`${runId}:${b}`)))
  const separated = caseIds.map((caseId, index) => buildSeparatedPairArtifacts({
    revealSecret, runId, anonymousCaseId: `review-case-${String(index + 1).padStart(3, '0')}`, caseId,
    source: sourceByCase.get(caseId),
    resultsByAlias: {
      flash: observationByKey.get(`${caseId}:flash`)?.response?.payload?.result,
      pro: observationByKey.get(`${caseId}:pro`)?.response?.payload?.result,
    },
  }))
  const reviewerPacket = buildReviewerPacket({
    rubric: {
      instruction: '只根据原文和匿名 X/Y 业务结果判断事实保持、任务规划和用户修改成本；不得推断生成路径身份。',
      preferredSide: ['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'],
      majorDefinition: '若用户必须新增、删除、合并或重写关键任务，纠正关键时间角色、条件、材料或事件边界，则标记重大修改。',
      planningErrorDefinition: '事实基本可见，但任务边界、里程碑、材料、时间角色、事件或歧义组织错误。',
      evidenceRule: '理由必须引用原文中的具体事实，不得使用运行元数据。',
      deterministicTimeEquivalence: '按冻结中文时间契约，单独出现“中午”可规范化为当地时间12:00；精确12:00与保守待确认均可接受，单凭这一差异不得判为重大修改或路径优劣。',
      eventTaskRule: '原文明示用户必须参加、集合、到场、签到或出席时，Event 表达日程事实，Task 表达用户行动；只保留 Event 而没有 Task 属于规划遗漏。',
    },
    reviewerPairs: separated.map((item) => item.reviewerPair),
  })
  assertReviewerPacketSafe(reviewerPacket)
  const privateManifest = buildPrivateBindingManifest({
    protocolVersion: R7_PROTOCOL_VERSION, runId, reviewerPacket,
    privateBindings: separated.map((item) => item.privateBinding),
  })
  const packetSha256 = sha256(canonicalJson(reviewerPacket))
  const packetCreatedAt = new Date().toISOString()
  await mkdir(outputDir, { recursive: true })
  await writeFile(packetPath, `${JSON.stringify(reviewerPacket, null, 2)}\n`, 'utf8')
  await writeFile(statePath, `${JSON.stringify({
    schemaVersion: 'e2.9-r7-review-state-1.0.0', runId, packetSha256,
    checkpointSha256: sha256(checkpointRaw), aggregateSha256: sha256(aggregateRaw), packetCreatedAt,
    expectedPairs: 8, auditRequired: true, mappingKeyCreated: false, revealSecretPersisted: false,
    status: 'WAITING_FOR_INDEPENDENT_AUDIT_AND_LABELS',
  }, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ status: 'R7_REVIEW_PACKET_READY', packetPath, statePath, auditPath, draftPath, packetSha256 }, null, 2))

  const audit = await waitForJson(auditPath, 'R7_PACKET_AUDIT')
  validateR7PacketAudit(audit, packetSha256)
  if (Date.parse(audit.reviewedAt) <= Date.parse(packetCreatedAt)) throw new Error('R7_PATH_MASK_AUDIT_CHRONOLOGY_INVALID')
  const draft = validateDraftLabels(await waitForJson(draftPath, 'R7_LABELS'), reviewerPacket.pairs.map((item) => item.caseAnonymousId))
  const labelsEnvelope = buildLabelsEnvelope({
    protocolVersion: R7_PROTOCOL_VERSION, runId, reviewerPacket, labelsCompletedAt: new Date().toISOString(),
    reviewerKind: 'independent_fresh_read_only', reviewProcessId: audit.reviewProcessId, labels: draft,
  })
  await writeFile(envelopePath, `${JSON.stringify(labelsEnvelope, null, 2)}\n`, 'utf8')
  await sleep(5)
  const reveal = revealSeparatedBindings({
    revealSecret, protocolVersion: R7_PROTOCOL_VERSION, runId, reviewerPacket, privateManifest,
    labelsEnvelope, keyRevealedAt: new Date().toISOString(),
  })
  const counts = summarizeR7PathMaskedLabels(draft, reveal.mappings)
  const gate = evaluateR7ScreeningGate({ aggregate, counts, checkpoint })
  const result = {
    schemaVersion: 'e2.9-r7-screening-gate-1.0.0', protocolVersion: R7_PROTOCOL_VERSION, runId,
    evaluatedAt: new Date().toISOString(),
    inputs: { packetSha256, labelsSha256: labelsEnvelope.labelsSha256, checkpointSha256: sha256(checkpointRaw), aggregateSha256: sha256(aggregateRaw) },
    counts, checks: gate.checks,
    status: gate.pass ? 'V4_PRO_SCREENING_R7_PASS' : 'V4_PRO_SCREENING_R7_FAIL',
    selection: gate.pass ? 'ELIGIBLE_TO_REQUEST_AUTHORIZATION' : 'NOT_RUN',
    blind: 'NOT_CREATED', production: 'NOT_DEPLOYED',
  }
  await writeFile(revealPath, `${JSON.stringify({ ...reveal, counts }, null, 2)}\n`, 'utf8')
  await writeFile(gatePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(result, null, 2))
  if (!gate.pass) process.exitCode = 2
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
