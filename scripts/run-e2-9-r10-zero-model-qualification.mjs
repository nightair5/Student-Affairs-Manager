import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  R10_FACT_LEDGER_CONTRACT_VERSION,
  R10_FACT_LEDGER_SCHEMA_VERSION,
  validateR10FactLedger,
} from '../cloudflare/e2-r10-factledger-contract.mjs'
import {
  R10_BRIDGE_PERMISSIONS,
  R10_LEDGER_PLANNER_BRIDGE_VERSION,
  buildR10PlannerInput,
} from '../cloudflare/e2-r10-ledger-planner-bridge.mjs'
import {
  R10_ISOLATED_PLANNER_VERSION,
  planR10FactLedger,
} from '../cloudflare/e2-r10-isolated-planner.mjs'
import {
  R10_LEDGER_PLAN_VALIDATOR_VERSION,
  canonicalR10Sha256,
  validateR10LedgerPlan,
} from '../cloudflare/e2-r10-ledger-plan-validator.mjs'
import {
  E2_R10_ENDPOINT_PREFIX,
  E2_R10_DEPLOYMENT_EVIDENCE_SCHEMA_VERSION,
  E2_R10_CONTRACT_SCHEMA_VERSION,
  E2_R10_REGISTRATION_SCHEMA_VERSION,
  E2_R10_REQUIRED_CHECK_NAMES,
  E2_R10_REQUIRED_COMPONENT_VERSIONS,
  E2_R10_QUALIFICATION_VERSION,
  runE2R10Qualification,
  sha256Canonical,
  sha256Text,
  validateDeploymentEvidence,
  validateQualificationRegistration,
} from '../cloudflare/e2-r10-qualification-contract.mjs'
import {
  E2_R10_QUALIFICATION_LEDGER_VERSION,
  E2R10QualificationLedger,
} from '../cloudflare/e2-r10-qualification-ledger.mjs'
import { E2_R10_QUALIFICATION_WORKER_VERSION } from '../cloudflare/e2-r10-qualification-worker.mjs'
import {
  R10_PRODUCTION_BASELINE_COMMIT,
  R10_PROTOCOL_VERSION,
  R10_QUALIFICATION_RUN_LABEL,
  buildR10ProtocolBundle,
  buildR10QualificationDeploymentArtifacts,
  buildR10QualificationResult,
  canonicalJson,
  createR10AccessInstrumentation,
  inspectR10ProductionIsolation,
  inspectR10TrackedSource,
  r10PreviewWorkerNameCompatible,
  sha256,
  writeR10ImmutableArtifacts,
} from './e2-9-r10-protocol.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs', 'e2-v4-pro-benchmark-r10')
const writeArtifacts = process.argv.includes('--write=true')
const ZERO_MODEL_NAME = 'r10-zero-model-fixture'
const MODEL_EXECUTION = Object.freeze({
  requestedModel: ZERO_MODEL_NAME,
  returnedModel: ZERO_MODEL_NAME,
  executionModel: ZERO_MODEL_NAME,
  resultModelName: ZERO_MODEL_NAME,
})

function evidence(sourceText, id, quote) {
  const start = sourceText.indexOf(quote)
  if (start < 0) throw new Error(`R10_FIXTURE_EVIDENCE_MISSING:${id}`)
  return { id, quote, start, end: start + quote.length }
}

function submissionLedger() {
  const sourceText = '请在9月10日前提交报名表，文件命名为学号.pdf。'
  return {
    schemaVersion: R10_FACT_LEDGER_SCHEMA_VERSION,
    referenceTime: '2026-08-24T08:00:00+08:00', timezone: 'Asia/Shanghai', sourceText,
    obligations: [{
      id: 'ob-submit', actor: null, modality: 'required', actionPredicate: '提交', object: '报名表',
      materialIds: ['mat-form'], timeExpressionIds: ['time-submit'], eventIds: [], conditionIds: [],
      constraintIds: ['constraint-name'], evidenceIds: ['ev-submit'],
    }],
    materials: [{
      id: 'mat-form', name: '报名表', role: 'deliverable', obligationIds: ['ob-submit'],
      constraintIds: ['constraint-name'], evidenceIds: ['ev-submit'],
    }],
    timeExpressions: [{
      id: 'time-submit', rawText: '9月10日前', role: 'submission_deadline', precision: 'date_only',
      normalizedValue: '2026-09-10', endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
      relatedObligationIds: ['ob-submit'], relatedEventIds: [], supersedesTimeExpressionId: null, evidenceIds: ['ev-time'],
    }],
    events: [], conditions: [],
    constraints: [{
      id: 'constraint-name', kind: 'naming', text: '文件命名为学号.pdf', appliesToFactIds: ['mat-form'], evidenceIds: ['ev-name'],
    }],
    ambiguities: [],
    evidence: [
      evidence(sourceText, 'ev-submit', '提交报名表'),
      evidence(sourceText, 'ev-time', '9月10日前'),
      evidence(sourceText, 'ev-name', '文件命名为学号.pdf'),
    ],
  }
}

function attendanceLedger() {
  const sourceText = '仅入选同学须于9月12日参加说明会，地点另行通知。'
  return {
    schemaVersion: R10_FACT_LEDGER_SCHEMA_VERSION,
    referenceTime: '2026-08-24T08:00:00+08:00', timezone: 'Asia/Shanghai', sourceText,
    obligations: [{
      id: 'ob-attend', actor: '入选同学', modality: 'conditional', actionPredicate: '参加', object: '说明会',
      materialIds: [], timeExpressionIds: ['time-event'], eventIds: ['event-briefing'], conditionIds: ['condition-selected'],
      constraintIds: [], evidenceIds: ['ev-attend'],
    }],
    materials: [],
    timeExpressions: [{
      id: 'time-event', rawText: '9月12日', role: 'event_start', precision: 'date_only', normalizedValue: '2026-09-12',
      endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
      relatedObligationIds: ['ob-attend'], relatedEventIds: ['event-briefing'], supersedesTimeExpressionId: null, evidenceIds: ['ev-time'],
    }],
    events: [{
      id: 'event-briefing', title: '说明会', actor: null, location: null, startTimeExpressionId: 'time-event',
      endTimeExpressionId: null, conditionIds: ['condition-selected'], evidenceIds: ['ev-attend'],
    }],
    conditions: [{
      id: 'condition-selected', kind: 'eligibility', text: '仅入选同学',
      appliesToFactIds: ['ob-attend', 'event-briefing'], evidenceIds: ['ev-condition'],
    }],
    constraints: [],
    ambiguities: [{
      id: 'ambiguity-location', code: 'LOCATION_PENDING', targetFactIds: ['event-briefing'],
      message: '地点尚未确定', evidenceIds: ['ev-location'],
    }],
    evidence: [
      evidence(sourceText, 'ev-condition', '仅入选同学'),
      evidence(sourceText, 'ev-time', '9月12日'),
      evidence(sourceText, 'ev-attend', '参加说明会'),
      evidence(sourceText, 'ev-location', '地点另行通知'),
    ],
  }
}

function informationLedger() {
  const sourceText = '服务窗口将于9月15日暂停办理，仅供知悉。'
  return {
    schemaVersion: R10_FACT_LEDGER_SCHEMA_VERSION,
    referenceTime: '2026-08-24T08:00:00+08:00', timezone: 'Asia/Shanghai', sourceText,
    obligations: [{
      id: 'ob-info', actor: null, modality: 'informational', actionPredicate: '知悉', object: '服务窗口暂停办理',
      materialIds: [], timeExpressionIds: [], eventIds: ['event-info'], conditionIds: [], constraintIds: [], evidenceIds: ['ev-info'],
    }], materials: [],
    timeExpressions: [{
      id: 'time-info', rawText: '9月15日', role: 'event_start', precision: 'date_only', normalizedValue: '2026-09-15',
      endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
      relatedObligationIds: [], relatedEventIds: ['event-info'], supersedesTimeExpressionId: null, evidenceIds: ['ev-info'],
    }],
    events: [{
      id: 'event-info', title: '服务窗口暂停办理', actor: null, location: null, startTimeExpressionId: 'time-info',
      endTimeExpressionId: null, conditionIds: [], evidenceIds: ['ev-info'],
    }],
    conditions: [], constraints: [], ambiguities: [],
    evidence: [evidence(sourceText, 'ev-info', '服务窗口将于9月15日暂停办理')],
  }
}

function policyLedger() {
  const sourceText = '可阅读办事指南，不得转发名单。原截止9月8日已取消，后续时间待定。'
  return {
    schemaVersion: R10_FACT_LEDGER_SCHEMA_VERSION,
    referenceTime: '2026-08-24T08:00:00+08:00', timezone: 'Asia/Shanghai', sourceText,
    obligations: [
      {
        id: 'ob-read', actor: null, modality: 'optional', actionPredicate: '阅读', object: '办事指南',
        materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['ev-read'],
      },
      {
        id: 'ob-forbid', actor: null, modality: 'prohibited', actionPredicate: '转发', object: '名单',
        materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['ev-forbid'],
      },
    ],
    materials: [],
    timeExpressions: [
      {
        id: 'time-old', rawText: '9月8日', role: 'superseded_deadline', precision: 'date_only', normalizedValue: '2026-09-08',
        endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
        relatedObligationIds: [], relatedEventIds: [], supersedesTimeExpressionId: null, evidenceIds: ['ev-old'],
      },
      {
        id: 'time-pending', rawText: '后续时间待定', role: 'other', precision: 'unknown', normalizedValue: null,
        endNormalizedValue: null, timezone: null, needsConfirmation: true,
        relatedObligationIds: [], relatedEventIds: [], supersedesTimeExpressionId: 'time-old', evidenceIds: ['ev-pending'],
      },
    ],
    events: [], conditions: [], constraints: [],
    ambiguities: [{
      id: 'ambiguity-next-time', code: 'TIME_PENDING', targetFactIds: ['time-pending'],
      message: '后续时间尚未确定', evidenceIds: ['ev-pending'],
    }],
    evidence: [
      evidence(sourceText, 'ev-read', '可阅读办事指南'),
      evidence(sourceText, 'ev-forbid', '不得转发名单'),
      evidence(sourceText, 'ev-old', '原截止9月8日已取消'),
      evidence(sourceText, 'ev-pending', '后续时间待定'),
    ],
  }
}

async function runFixture(ledger, ordinal) {
  const issues = validateR10FactLedger(ledger)
  if (issues.length) throw new Error(`R10_FIXTURE_LEDGER_INVALID:${ordinal}:${canonicalJson(issues)}`)
  const plannerInput = buildR10PlannerInput(ledger)
  const hasAction = ledger.obligations.some((item) => ['required', 'conditional', 'optional'].includes(item.modality))
  const { result, planningTrace } = planR10FactLedger(plannerInput, {
    sourceMetadata: {
      sourceId: `r10-zero-model-source-${ordinal}`,
      title: `匿名资格样例 ${ordinal}`,
      sourceType: 'text', notificationType: hasAction ? 'uncertain' : 'information_only', summary: '',
    },
    modelExecution: MODEL_EXECUTION,
    createdAt: ledger.referenceTime,
  })
  const ledgerSha256 = await canonicalR10Sha256(ledger)
  const resultSha256 = await canonicalR10Sha256(result)
  const validation = await validateR10LedgerPlan({ ledger, result, trace: planningTrace, ledgerSha256, resultSha256 })
  if (!validation.safeToProceed || validation.issues.length) {
    throw new Error(`R10_FIXTURE_PLAN_INVALID:${ordinal}:${canonicalJson(validation.issues)}`)
  }
  return { ledger, plannerInput, result, planningTrace, ledgerSha256, resultSha256, validation }
}

async function qualificationRoutesLocked(protocolBundleSha256) {
  const token = 'r10-zero-model-local-qualification-token-material-000000000000000000'
  const tokenHash = await sha256Text(token)
  const ledgerCallerToken = 'r10-zero-model-ledger-caller-token-material-000000000000000000'
  const versionId = '11111111-1111-4111-8111-111111111111'
  const ledgerVersionId = '22222222-2222-4222-8222-222222222222'
  const baseOrigin = 'https://sa-e2-r10-facts-first-qual-preview.example.workers.dev'
  const versionedOrigin = `https://${versionId.slice(0, 8)}-${new URL(baseOrigin).host}`
  let ledgerCalls = 0
  const env = {
    E2_R10_QUALIFICATION_ENABLED: 'true', E2_R10_VERSIONED_PREVIEW_ONLY: 'true',
    E2_R10_QUALIFICATION_PREVIEW_ORIGIN: baseOrigin, E2_R10_QUALIFICATION_TOKEN_SHA256: tokenHash,
    E2_R10_LEDGER_CALLER_TOKEN: ledgerCallerToken,
    E2_R10_PROTOCOL_BUNDLE_SHA256: protocolBundleSha256, E2_R10_QUALIFICATION_RESULT_SHA256: 'a'.repeat(64),
    E2_R10_QUALIFICATION_WORKER_BYTES_SHA256: 'b'.repeat(64),
    E2_R10_QUALIFICATION_WORKER_CONFIG_SHA256: 'c'.repeat(64),
    E2_R10_LEDGER_WORKER_VERSION_ID: ledgerVersionId,
    E2_R10_LEDGER_WORKER_BYTES_SHA256: 'd'.repeat(64),
    E2_R10_LEDGER_WORKER_CONFIG_SHA256: 'e'.repeat(64),
    CF_VERSION_METADATA: { id: versionId, timestamp: '2026-08-24T00:00:00.000Z' },
    E2_R10_QUALIFICATION_LEDGER: { async fetch() { ledgerCalls += 1; throw new Error('LEDGER_MUST_NOT_BE_TOUCHED') } },
  }
  for (const stage of ['readiness', 'smoke', 'screening', 'selection', 'blind', 'production']) {
    const response = await runE2R10Qualification(new Request(`${versionedOrigin}${E2_R10_ENDPOINT_PREFIX}${stage}`, {
      method: 'POST', headers: { origin: versionedOrigin, authorization: `Bearer ${token}` },
    }), env)
    const payload = await response.json()
    if (response.status !== 412 || payload.error !== 'MODEL_PHASE_NOT_AUTHORIZED' || payload.modelCalls !== 0) return false
  }
  return ledgerCalls === 0
}

async function providerModuleAbsent(instrumentation) {
  const files = ['cloudflare/e2-r10-qualification-worker.mjs', 'cloudflare/e2-r10-qualification-contract.mjs']
  for (const relativePath of files) {
    instrumentation.recordFileRead(relativePath)
    const value = await readFile(path.join(root, relativePath), 'utf8')
    if (/(?:api\.deepseek\.com|DEEPSEEK_API_KEY|model-gateway|recognition\.mjs|e2-r7-benchmark)/iu.test(value)) return false
  }
  return true
}

class TransactionalMemoryStorage {
  constructor() {
    this.values = new Map()
    this.queue = Promise.resolve()
  }

  async get(key) {
    return structuredClone(this.values.get(key))
  }

  async transaction(callback) {
    const previous = this.queue
    let release
    this.queue = new Promise((resolve) => { release = resolve })
    await previous
    try {
      return await callback({
        get: async (key) => structuredClone(this.values.get(key)),
        put: async (key, value) => { this.values.set(key, structuredClone(value)) },
      })
    } finally {
      release()
    }
  }
}

function componentVersions() {
  return {
    factLedger: R10_FACT_LEDGER_CONTRACT_VERSION,
    bridge: R10_LEDGER_PLANNER_BRIDGE_VERSION,
    planner: R10_ISOLATED_PLANNER_VERSION,
    validator: R10_LEDGER_PLAN_VALIDATOR_VERSION,
    qualification: E2_R10_QUALIFICATION_VERSION,
    qualificationContract: E2_R10_CONTRACT_SCHEMA_VERSION,
    qualificationWorker: E2_R10_QUALIFICATION_WORKER_VERSION,
    qualificationLedger: E2_R10_QUALIFICATION_LEDGER_VERSION,
    protocol: R10_PROTOCOL_VERSION,
  }
}

function localDeploymentEvidence(artifacts = {}) {
  const qualificationWorkerVersionId = '11111111-1111-4111-8111-111111111111'
  return {
    schemaVersion: E2_R10_DEPLOYMENT_EVIDENCE_SCHEMA_VERSION,
    qualificationWorkerVersionId,
    qualificationWorkerUploadedAt: '2026-08-24T00:00:00.000Z',
    qualificationWorkerVersionedOrigin: `https://${qualificationWorkerVersionId.slice(0, 8)}-sa-e2-r10-facts-first-qual-preview.example.workers.dev`,
    qualificationWorkerBytesSha256: artifacts.qualificationWorkerBytesSha256 ?? 'b'.repeat(64),
    qualificationWorkerConfigSha256: artifacts.qualificationWorkerConfigSha256 ?? 'c'.repeat(64),
    ledgerWorkerVersionId: '22222222-2222-4222-8222-222222222222',
    ledgerWorkerBytesSha256: artifacts.ledgerWorkerBytesSha256 ?? 'd'.repeat(64),
    ledgerWorkerConfigSha256: artifacts.ledgerWorkerConfigSha256 ?? 'e'.repeat(64),
  }
}

async function failureRegistrationRecordsEndToEnd({
  sourceBinding, productionIsolation, protocolBundle, accessCounters, deploymentArtifacts,
}) {
  const checks = Object.fromEntries(E2_R10_REQUIRED_CHECK_NAMES.map((name) => [name, true]))
  checks.factLedgerValidated = false
  const failureResult = buildR10QualificationResult({
    sourceBinding,
    productionIsolation,
    protocolBundle,
    checks,
    componentVersions: componentVersions(),
    accessCounters,
  })
  if (failureResult.status !== 'LOCAL_QUALIFICATION_FAILED_PREVIEW_LOCKED') return false
  const deploymentEvidence = localDeploymentEvidence(deploymentArtifacts)
  const registration = {
    schemaVersion: E2_R10_REGISTRATION_SCHEMA_VERSION,
    runLabel: failureResult.runLabel,
    protocolVersion: R10_PROTOCOL_VERSION,
    qualificationVersion: E2_R10_QUALIFICATION_VERSION,
    expectedWorkerVersionId: deploymentEvidence.qualificationWorkerVersionId,
    protocolBundleSha256: protocolBundle.bundleSha256,
    qualificationResultSha256: await sha256Canonical(failureResult),
    qualificationResult: failureResult,
    deploymentEvidenceSha256: await sha256Canonical(deploymentEvidence),
    deploymentEvidence,
  }
  if (!await validateQualificationRegistration(registration)) return false
  const ledger = new E2R10QualificationLedger({ storage: new TransactionalMemoryStorage() })
  const request = new Request('https://ledger.internal/record', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-e2-r10-run-label': registration.runLabel,
      'x-e2-r10-ledger-worker-version-id': deploymentEvidence.ledgerWorkerVersionId,
      'x-e2-r10-ledger-worker-bytes-sha256': deploymentEvidence.ledgerWorkerBytesSha256,
      'x-e2-r10-ledger-worker-config-sha256': deploymentEvidence.ledgerWorkerConfigSha256,
    },
    body: JSON.stringify(registration),
  })
  const response = await ledger.fetch(request)
  const payload = await response.json()
  return response.status === 201
    && payload.ledgerState === 'R10_QUALIFICATION_FAILURE_RECORDED_MODEL_PHASES_LOCKED'
}

async function qualificationConfigChecks(instrumentation) {
  const previewPath = 'wrangler.e2-r10-qualification-preview.jsonc'
  const ledgerPath = 'wrangler.e2-r10-qualification-ledger.jsonc'
  instrumentation.recordFileRead(previewPath)
  instrumentation.recordFileRead(ledgerPath)
  const [preview, ledger] = await Promise.all([
    readFile(path.join(root, previewPath), 'utf8').then(JSON.parse),
    readFile(path.join(root, ledgerPath), 'utf8').then(JSON.parse),
  ])
  return {
    qualificationWorkerPreviewNameCompatible: r10PreviewWorkerNameCompatible(
      preview.name,
      preview.vars?.E2_R10_QUALIFICATION_PREVIEW_ORIGIN,
    ),
    qualificationWorkerRouteIsolated: preview.workers_dev === true
      && preview.preview_urls === true && Array.isArray(preview.routes) && preview.routes.length === 0,
    qualificationLedgerPrivate: ledger.workers_dev === false
      && ledger.preview_urls === false && Array.isArray(ledger.routes) && ledger.routes.length === 0,
    ledgerCallerAuthenticationEnforced: !Object.hasOwn(preview.vars ?? {}, 'E2_R10_LEDGER_CALLER_TOKEN')
      && !Object.hasOwn(ledger.vars ?? {}, 'E2_R10_LEDGER_CALLER_TOKEN_SHA256'),
  }
}

async function main() {
  const instrumentation = createR10AccessInstrumentation()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (...args) => instrumentation.networkCall(() => originalFetch(...args))
  const ledgers = [submissionLedger(), attendanceLedger(), informationLedger(), policyLedger()]
  const runs = []
  const fixtureErrors = []
  try {
    for (const [index, ledger] of ledgers.entries()) {
      try {
        runs.push(await runFixture(ledger, index + 1))
      } catch (error) {
        fixtureErrors.push(error instanceof Error ? error.message : String(error))
      }
    }

    const sourceBinding = inspectR10TrackedSource(root)
    const productionIsolation = await inspectR10ProductionIsolation(root)
    const protocolBundle = await buildR10ProtocolBundle(root)
    const deploymentArtifacts = await buildR10QualificationDeploymentArtifacts(root)
    const configChecks = await qualificationConfigChecks(instrumentation)
    const accessCounters = instrumentation.snapshot()
    const checks = Object.fromEntries(E2_R10_REQUIRED_CHECK_NAMES.map((name) => [name, false]))
    Object.assign(checks, {
      sourceCommitFull: /^[a-f0-9]{40}$/u.test(sourceBinding.sourceCommit),
      sourceTreeBound: /^[a-f0-9]{40}$/u.test(sourceBinding.sourceTree),
      sourceManifestBound: /^[a-f0-9]{64}$/u.test(sourceBinding.sourceManifestSha256),
      sourceWorktreeClean: sourceBinding.worktreeClean,
      protocolFilesTracked: sourceBinding.protocolFilesTracked,
      protocolBundleBound: /^[a-f0-9]{64}$/u.test(protocolBundle.bundleSha256) && !/^0{64}$/u.test(protocolBundle.bundleSha256),
      productionDependencyManifestBound: productionIsolation.matched
        && productionIsolation.baselineCommit === R10_PRODUCTION_BASELINE_COMMIT,
      factLedgerValidated: runs.length === ledgers.length
        && fixtureErrors.length === 0 && runs.every((item) => validateR10FactLedger(item.ledger).length === 0),
      bridgeStripsSourceText: runs.length === ledgers.length
        && runs.every((item) => !Object.hasOwn(item.plannerInput, 'sourceText')),
      bridgeHasNoSemanticPermission: R10_BRIDGE_PERMISSIONS.mayAddOrDeleteFacts === false
        && R10_BRIDGE_PERMISSIONS.mayChangeFactMeaning === false && R10_BRIDGE_PERMISSIONS.mayChangeTimeRoleOrValue === false,
      plannerValidated: runs.length === ledgers.length && runs.every((item) => item.validation.safeToProceed),
      validatorNoIssue: runs.length === ledgers.length && runs.every((item) => item.validation.status === 'NO_ISSUE'),
      pureInformationHasZeroTask: runs[2]?.result.standaloneTasks.length === 0,
      informationalFactPreserved: runs[2]?.result.ignoredContent.some((item) => (
        item.text === '知悉服务窗口暂停办理' && item.reason === 'background'
      )) === true,
      optionalTaskIsUnselected: runs[3]?.result.standaloneTasks.some((item) => item.actionVerb === '阅读' && item.selected === false) === true,
      prohibitedFactIsNotTask: runs[3] !== undefined
        && !runs[3].result.standaloneTasks.some((item) => item.actionVerb === '转发')
        && runs[3].result.conflicts.some((item) => item.message.includes('转发名单')),
      unsupportedTimeRoleNotForged: runs[3]?.result.timePoints.length === 0
        && runs[3]?.result.ambiguities.some((item) => item.field === 'superseded_deadline') === true,
      evidenceSpansPreserved: runs.length === ledgers.length && runs.every((item) => item.result.evidence.every((entry) => (
        Number.isInteger(entry.textStart) && Number.isInteger(entry.textEnd) && entry.sourceId.startsWith('r10-zero-model-source-')
      ))),
      serverModelIdentityInjected: runs.length === ledgers.length && runs.every((item) => item.result.modelName === ZERO_MODEL_NAME),
      qualificationProviderModuleAbsent: await providerModuleAbsent(instrumentation),
      laterModelStagesLocked: await qualificationRoutesLocked(protocolBundle.bundleSha256),
      accessCountersInstrumented: accessCounters.modelCalls === 0
        && accessCounters.upstreamNetworkCalls === 0 && accessCounters.expectedAnswerReads === 0,
      ...configChecks,
      deploymentEvidenceSchemaValidated: validateDeploymentEvidence(localDeploymentEvidence(deploymentArtifacts)),
    })
    checks.registrationFailurePathValidated = await failureRegistrationRecordsEndToEnd({
      sourceBinding, productionIsolation, protocolBundle, accessCounters, deploymentArtifacts,
    })

    const finalAccessCounters = instrumentation.snapshot()
    checks.accessCountersInstrumented = finalAccessCounters.modelCalls === 0
      && finalAccessCounters.upstreamNetworkCalls === 0 && finalAccessCounters.expectedAnswerReads === 0
  const qualificationResult = buildR10QualificationResult({
      sourceBinding,
      productionIsolation,
    protocolBundle,
      componentVersions: componentVersions(),
    checks,
      accessCounters: finalAccessCounters,
  })
  const qualificationResultSha256 = await sha256Canonical(qualificationResult)
    const gateRelativePath = 'docs/e2-v4-pro-benchmark-r10/screening-gate.json'
    instrumentation.recordFileRead(gateRelativePath)
    const gateRaw = await readFile(path.join(root, gateRelativePath), 'utf8')
  const evidence = {
      schemaVersion: 'e2.9-r10-zero-model-evidence-1.2.1',
    protocolVersion: R10_PROTOCOL_VERSION,
    runLabel: R10_QUALIFICATION_RUN_LABEL,
      sourceCommit: sourceBinding.sourceCommit,
      sourceTree: sourceBinding.sourceTree,
      sourceManifestSha256: sourceBinding.sourceManifestSha256,
      productionIsolationManifestSha256: productionIsolation.manifestSha256,
    protocolBundleSha256: protocolBundle.bundleSha256,
    qualificationResultSha256,
    screeningGateSha256: sha256(canonicalJson(JSON.parse(gateRaw))),
    syntheticCaseCount: runs.length,
      accessCounters: finalAccessCounters,
      modelCalls: finalAccessCounters.modelCalls,
      upstreamNetworkCalls: finalAccessCounters.upstreamNetworkCalls,
      expectedAnswersLoaded: finalAccessCounters.expectedAnswerReads > 0,
      worktreeCleanAtQualificationStart: sourceBinding.worktreeClean,
      protocolFilesTrackedAtSourceCommit: sourceBinding.protocolFilesTracked,
      deploymentArtifacts,
  }

  if (writeArtifacts) {
      if (!sourceBinding.worktreeClean || !sourceBinding.protocolFilesTracked) {
        throw new Error('R10_EVIDENCE_WRITE_REQUIRES_COMMITTED_CLEAN_IMPLEMENTATION')
      }
    await mkdir(docsDir, { recursive: true })
    await writeR10ImmutableArtifacts([
      { path: path.join(docsDir, 'protocol-bundle-c.json'), contents: `${JSON.stringify(protocolBundle, null, 2)}\n` },
      { path: path.join(docsDir, 'qualification-result-c.json'), contents: `${JSON.stringify(qualificationResult, null, 2)}\n` },
      { path: path.join(docsDir, 'qualification-evidence-c.json'), contents: `${JSON.stringify(evidence, null, 2)}\n` },
    ])
  }
  process.stdout.write(`${JSON.stringify({ qualificationResult, evidence }, null, 2)}\n`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
