import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  E2_R10_FACT_EXTRACTION_SYSTEM_PROMPT,
  E2_R10_SCREENING_PROTOCOL_VERSION,
  E2_R10_SCREENING_RUN_LABEL,
  canonicalJson,
} from '../cloudflare/e2-r10-screening-contract.mjs'
import { recognitionSystemPrompt } from '../cloudflare/recognition.mjs'

const ROOT = new URL('../', import.meta.url)
const BUNDLE_PATH = 'docs/e2-v4-pro-benchmark-r10/screening-protocol-1.0.0/protocol-bundle.json'
const CASE_PATH = 'docs/e2-v4-pro-benchmark-r10/screening-protocol-1.0.0/case-manifest.json'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function raw(relativePath) {
  return readFile(new URL(relativePath, ROOT))
}

async function json(relativePath) {
  return JSON.parse(await raw(relativePath))
}

test('R10 Screening bundle binds every executable, contract, Gate and deployment file', async () => {
  const bundle = await json(BUNDLE_PATH)
  assert.equal(bundle.schemaVersion, 'e2.9-r10-screening-protocol-bundle-1.0.0')
  assert.equal(bundle.protocolVersion, E2_R10_SCREENING_PROTOCOL_VERSION)
  assert.equal(bundle.runLabel, E2_R10_SCREENING_RUN_LABEL)
  assert.equal(bundle.status, 'FROZEN_BEFORE_MODEL_CALLS')
  assert.equal(bundle.modelCallAuthorization, 'NOT_AUTHORIZED')
  assert.equal(bundle.maximumCallsIfSeparatelyAuthorized, 16)
  assert.equal(new Set(bundle.files.map((item) => item.path)).size, bundle.files.length)
  for (const item of bundle.files) assert.equal(sha256(await raw(item.path)), item.sha256, item.path)
})
test('R10 binds actual runtime prompt bytes instead of treating a module-source hash as runtime bytes', async () => {
  const bundle = await json(BUNDLE_PATH)
  assert.equal(sha256(recognitionSystemPrompt()), bundle.bindings.pathARuntimePromptSha256)
  assert.equal(sha256(E2_R10_FACT_EXTRACTION_SYSTEM_PROMPT), bundle.bindings.pathBRuntimePromptSha256)
  assert.equal(sha256(await raw('cloudflare/recognition-prompt.mjs')), bundle.bindings.pathAModuleSourceSha256)
  assert.notEqual(bundle.bindings.pathARuntimePromptSha256, bundle.bindings.pathAModuleSourceSha256)
})

test('R10 exact eight-case source-only manifest is Expected-free and deterministically paired', async () => {
  const [bundle, manifest, parentRaw] = await Promise.all([
    json(BUNDLE_PATH), json(CASE_PATH), raw('.evaluation-cache/e2-9-r1/protocol-2.0.0/source-only-manifest.json'),
  ])
  const parent = JSON.parse(parentRaw)
  assert.equal(sha256(parentRaw), bundle.bindings.sourceOnlyParentRawSha256)
  const forbidden = /"(?:expected|answer|answers|gold|golden|target|targets|label|labels|score|scores|forbidden)"\s*:/iu
  assert.doesNotMatch(parentRaw.toString('utf8'), forbidden)
  assert.equal(parent.screeningCases.length, 8)
  assert.equal(manifest.cases.length, 8)
  assert.equal(manifest.observations.length, 16)
  assert.equal(sha256(await raw(CASE_PATH)), bundle.bindings.caseManifestRawSha256)
  const byCase = new Map()
  for (const observation of manifest.observations) {
    const arms = byCase.get(observation.caseId) ?? new Set()
    arms.add(observation.arm)
    byCase.set(observation.caseId, arms)
  }
  assert.equal(byCase.size, 8)
  assert.equal([...byCase.values()].every((arms) => arms.size === 2 && arms.has('A') && arms.has('B')), true)
})

test('R10 Gate is frozen by canonical hash and never auto-authorizes later stages', async () => {
  const [bundle, parentGate, gate, review] = await Promise.all([
    json(BUNDLE_PATH), json('docs/e2-v4-pro-benchmark-r10/screening-gate.json'),
    json('docs/e2-v4-pro-benchmark-r10/screening-protocol-1.0.0/gate-contract.json'),
    json('docs/e2-v4-pro-benchmark-r10/screening-protocol-1.0.0/review-contract.json'),
  ])
  assert.equal(sha256(canonicalJson(parentGate)), bundle.bindings.parentGateCanonicalSha256)
  assert.equal(gate.parentGateSha256, bundle.bindings.parentGateCanonicalSha256)
  assert.equal(gate.selectionAutomaticallyAuthorized, false)
  assert.equal(gate.blindAutomaticallyAuthorized, false)
  assert.equal(gate.productionAutomaticallyAuthorized, false)
  assert.equal(review.reviewerEligibility.hasNotSeenMapping, true)
  assert.equal(review.revealPrerequisites.length, 4)
})

test('R10 Preview deployment has no routes, keeps stable traffic on a zero-model bootstrap and stores no secrets in Git', async () => {
  const [front, ledger, bootstrap, worker, bootstrapWorker] = await Promise.all([
    json('wrangler.e2-r10-screening-preview.jsonc'), json('wrangler.e2-r10-screening-ledger.jsonc'),
    json('wrangler.e2-r10-screening-bootstrap.jsonc'), raw('cloudflare/e2-r10-screening-worker.mjs'),
    raw('cloudflare/e2-r10-screening-bootstrap.mjs'),
  ])
  assert.deepEqual(front.routes, [])
  assert.deepEqual(ledger.routes, [])
  assert.deepEqual(bootstrap.routes, [])
  assert.equal(front.name, bootstrap.name)
  assert.equal(front.vars.E2_R10_SCREENING_ENABLED, 'true')
  assert.equal(front.vars.E2_R10_SCREENING_PROTOCOL_BUNDLE_SHA256, '0'.repeat(64))
  assert.equal(Object.hasOwn(front.vars, 'DEEPSEEK_API_KEY'), false)
  assert.equal(Object.hasOwn(front.vars, 'E2_R10_SCREENING_TOKEN_SHA256'), false)
  assert.equal(Object.hasOwn(front.vars, 'E2_R10_SCREENING_LEDGER_CALLER_TOKEN'), false)
  assert.match(worker.toString('utf8'), /executeScreeningObservation/u)
  assert.doesNotMatch(bootstrapWorker.toString('utf8'), /deepseek|executeScreeningObservation|fetch\s*\(\s*['"]https:/iu)
})

test('R10 generation process has no Expected/scorer imports and scorer opens Expected only after complete-generation assertion', async () => {
  const [runner, scorer] = await Promise.all([
    raw('scripts/run-e2-9-r10-screening.mjs'), raw('scripts/score-e2-9-r10-screening.mjs'),
  ])
  const runnerText = runner.toString('utf8')
  assert.doesNotMatch(runnerText, /goldenDataset|holdoutDataset|generalizationDataset|scoreRecognitionCase/u)
  const scorerText = scorer.toString('utf8')
  const assertionIndex = scorerText.indexOf('assertR10ScoringInput(checkpoint')
  const expectedLoadIndex = scorerText.indexOf("vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts')")
  assert.equal(assertionIndex > 0, true)
  assert.equal(expectedLoadIndex > assertionIndex, true)
})

test('R10 remains isolated from Production runtime and business persistence', async () => {
  const [productionWorker, productionConfig, screeningWorker] = await Promise.all([
    raw('cloudflare/worker.mjs'), raw('wrangler.jsonc'), raw('cloudflare/e2-r10-screening-worker.mjs'),
  ])
  assert.doesNotMatch(productionWorker.toString('utf8'), /e2-r10-screening/u)
  assert.doesNotMatch(productionConfig.toString('utf8'), /e2-r10-screening/u)
  assert.doesNotMatch(screeningWorker.toString('utf8'), /Workspace|DomainCommitPlan|Repository|Migration|IndexedDB|student-affairs\.site/iu)
})
