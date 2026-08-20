/* global console, process */
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  R6_PROTOCOL_VERSION,
  assertReviewerPacketSafe,
  buildLabelsEnvelope,
  buildPrivateBindingManifest,
  buildReviewerPacket,
  buildSeparatedPairArtifacts,
  canonicalJson,
  revealSeparatedBindings,
} from './e2-9-r6-path-mask.mjs'

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

function assertCompleteCheckpoint(checkpoint, source, checkpointRaw, aggregate) {
  if (checkpoint.phase !== 'screening' || checkpoint.gateStatus !== 'COMPLETE'
    || checkpoint.expectedObservations !== 16 || checkpoint.observations?.length !== 16
    || checkpoint.observations.some((item) => item.status !== 'complete')) throw new Error('R6_SCREENING_CHECKPOINT_INCOMPLETE')
  const pairKeys = checkpoint.observations.map((item) => `${item.caseId}:${item.modelAlias}`)
  if (new Set(pairKeys).size !== 16 || new Set(checkpoint.observations.map((item) => item.caseId)).size !== 8) throw new Error('R6_SCREENING_PAIR_CARDINALITY_INVALID')
  for (const item of checkpoint.observations) {
    if (!['action_required', 'information_only', 'prompt_injection'].includes(item.semanticRole)
      || item.requestedModel !== item.response?.payload?.execution?.requestedModel
      || item.requestedModel !== item.response?.payload?.execution?.returnedModel
      || item.response?.payload?.execution?.attempts?.length !== 1) throw new Error('R6_SCREENING_OBSERVATION_INTEGRITY_INVALID')
  }
  if (checkpoint.sourceOnlySha256 !== sha256(canonicalJson(source))
    || aggregate.phase !== 'screening' || aggregate.checkpointSha256 !== sha256(checkpointRaw)) throw new Error('R6_SCREENING_INPUT_BINDING_INVALID')
}

function validateAudit(audit, packetSha256) {
  const keys = ['canIdentifyEitherPath', 'deterministicCorrelators', 'directIdentityDisclosures', 'packetSha256', 'reason', 'reviewProcessId', 'reviewedAt', 'reviewerKind', 'verdict']
  if (!audit || Object.keys(audit).sort().join(',') !== keys.sort().join(',')
    || audit.verdict !== 'PASS' || audit.packetSha256 !== packetSha256
    || audit.canIdentifyEitherPath !== false || audit.directIdentityDisclosures !== 0 || audit.deterministicCorrelators !== 0
    || audit.reviewerKind !== 'independent_fresh_read_only' || typeof audit.reviewProcessId !== 'string' || audit.reviewProcessId.length < 8
    || !Number.isFinite(Date.parse(audit.reviewedAt)) || typeof audit.reason !== 'string' || audit.reason.length < 16) throw new Error('R6_PATH_MASK_AUDIT_FAILED')
}

function validateDraftLabels(labels, expectedIds) {
  if (!Array.isArray(labels) || labels.length !== expectedIds.length
    || new Set(labels.map((item) => item.caseAnonymousId)).size !== expectedIds.length
    || JSON.stringify(labels.map((item) => item.caseAnonymousId).sort()) !== JSON.stringify([...expectedIds].sort())) throw new Error('R6_LABEL_COVERAGE_INVALID')
  return labels
}

export function summarizePathMaskedLabels(labels, mappings) {
  const counts = {
    proPreferred: 0, flashPreferred: 0, tie: 0, insufficient: 0,
    proMajor: 0, flashMajor: 0, proPlanningError: 0, flashPlanningError: 0,
  }
  for (const label of labels) {
    const mapping = mappings.find((item) => item.caseAnonymousId === label.caseAnonymousId)
    if (!mapping) throw new Error('R6_REVEAL_MAPPING_MISSING')
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

export function evaluateR6ScreeningGate({ aggregate, counts, checkpoint }) {
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
    modelIdentityAndAttemptsValid: checkpoint.observations.every((item) => item.status === 'complete'
      && item.requestedModel === item.response?.payload?.execution?.requestedModel
      && item.requestedModel === item.response?.payload?.execution?.returnedModel
      && item.response?.payload?.execution?.attempts?.length === 1),
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
  if (![option('checkpoint'), option('source-manifest'), option('aggregate'), option('output-dir'), runId].every(Boolean)) throw new Error('checkpoint/source-manifest/aggregate/output-dir/run-id are required')
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(runId)) throw new Error('R6_REVIEW_RUN_ID_INVALID')

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
  assertCompleteCheckpoint(checkpoint, source, checkpointRaw, aggregate)

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
    },
    reviewerPairs: separated.map((item) => item.reviewerPair),
  })
  assertReviewerPacketSafe(reviewerPacket)
  const privateManifest = buildPrivateBindingManifest({
    protocolVersion: R6_PROTOCOL_VERSION, runId, reviewerPacket,
    privateBindings: separated.map((item) => item.privateBinding),
  })
  const packetSha256 = sha256(canonicalJson(reviewerPacket))
  const packetCreatedAt = new Date().toISOString()
  await mkdir(outputDir, { recursive: true })
  await writeFile(packetPath, `${JSON.stringify(reviewerPacket, null, 2)}\n`, 'utf8')
  await writeFile(statePath, `${JSON.stringify({
    schemaVersion: 'e2.9-r6-review-state-1.0.0', runId, packetSha256,
    checkpointSha256: sha256(checkpointRaw), aggregateSha256: sha256(aggregateRaw), packetCreatedAt,
    expectedPairs: 8, auditRequired: true, mappingKeyCreated: false, revealSecretPersisted: false,
    status: 'WAITING_FOR_INDEPENDENT_AUDIT_AND_LABELS',
  }, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ status: 'R6_REVIEW_PACKET_READY', packetPath, statePath, auditPath, draftPath, packetSha256 }, null, 2))

  const audit = await waitForJson(auditPath, 'R6_PACKET_AUDIT')
  validateAudit(audit, packetSha256)
  if (Date.parse(audit.reviewedAt) <= Date.parse(packetCreatedAt)) throw new Error('R6_PATH_MASK_AUDIT_CHRONOLOGY_INVALID')
  console.log(JSON.stringify({ status: 'R6_PACKET_AUDIT_PASS', reviewProcessId: audit.reviewProcessId }, null, 2))

  const draft = validateDraftLabels(await waitForJson(draftPath, 'R6_LABELS'), reviewerPacket.pairs.map((item) => item.caseAnonymousId))
  const labelsCompletedAt = new Date().toISOString()
  const labelsEnvelope = buildLabelsEnvelope({
    protocolVersion: R6_PROTOCOL_VERSION, runId, reviewerPacket, labelsCompletedAt,
    reviewerKind: 'independent_fresh_read_only', reviewProcessId: audit.reviewProcessId, labels: draft,
  })
  await writeFile(envelopePath, `${JSON.stringify(labelsEnvelope, null, 2)}\n`, 'utf8')
  await sleep(5)
  const reveal = revealSeparatedBindings({
    revealSecret, protocolVersion: R6_PROTOCOL_VERSION, runId, reviewerPacket, privateManifest,
    labelsEnvelope, keyRevealedAt: new Date().toISOString(),
  })
  const counts = summarizePathMaskedLabels(draft, reveal.mappings)
  const gate = evaluateR6ScreeningGate({ aggregate, counts, checkpoint })
  const gateResult = {
    schemaVersion: 'e2.9-r6-screening-gate-1.0.0', protocolVersion: R6_PROTOCOL_VERSION, runId,
    evaluatedAt: new Date().toISOString(), inputs: { packetSha256, labelsSha256: labelsEnvelope.labelsSha256, checkpointSha256: sha256(checkpointRaw), aggregateSha256: sha256(aggregateRaw) },
    counts, checks: gate.checks, status: gate.pass ? 'V4_PRO_SCREENING_R6_PASS' : 'V4_PRO_SCREENING_R6_FAIL',
    selection: gate.pass ? 'AUTHORIZED_BY_USER_CONDITIONAL_GATE' : 'NOT_RUN', blind: 'NOT_CREATED', production: 'NOT_DEPLOYED',
  }
  await writeFile(revealPath, `${JSON.stringify({ ...reveal, counts }, null, 2)}\n`, 'utf8')
  await writeFile(gatePath, `${JSON.stringify(gateResult, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(gateResult, null, 2))
  if (!gate.pass) process.exitCode = 2
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
