/* global console, process */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildR8FactGraphFromCachedRaw } from '../cloudflare/e2-r8-cache-fact-adapter.mjs'
import { normalizeR8FactGraphReferences } from '../cloudflare/e2-r8-restricted-normalizer.mjs'
import { planR9RecognitionResult } from '../cloudflare/e2-r9-isolated-planner.mjs'
import { compareR9FactGraphSnapshots, evaluateR9SemanticIntegrity } from '../cloudflare/e2-r9-semantic-integrity.mjs'

const FROZEN_CHECKPOINT_SHA256 = '0886afb941eeb74d80d9ed35601ee50447c0e4b464310ac197fd39df006fa336'
const FROZEN_SOURCE_MANIFEST_SHA256 = '115b43f98d0ca56cac522d0272ed10894fa0cc2a185562d0c10ce4bff7aca12f'
const FROZEN_CANDIDATE_CANONICAL_SHA256 = 'f8a7ea4d138ecb7effd42ae239b6962feb4a0633d9b896c2534d96d2085df608'

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

const canonicalJson = (value) => JSON.stringify(canonical(value))
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')

async function refuseOverwrite(file) {
  try {
    await readFile(file)
    throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
}

async function main() {
  const checkpointPath = path.resolve(option('checkpoint'))
  const sourcePath = path.resolve(option('source-manifest'))
  const candidatePath = path.resolve(option('candidate-checkpoint'))
  const privateOutput = path.resolve(option('private-output'))
  const publicOutput = path.resolve(option('public-output'))
  if (![option('checkpoint'), option('source-manifest'), option('candidate-checkpoint'), option('private-output'), option('public-output')].every(Boolean)) {
    throw new Error('R91_CACHE_INTEGRITY_OPTIONS_REQUIRED')
  }
  await Promise.all([refuseOverwrite(privateOutput), refuseOverwrite(publicOutput)])
  const [checkpointRaw, sourceRaw, candidateRaw] = await Promise.all([
    readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8'), readFile(candidatePath, 'utf8'),
  ])
  if (sha256(checkpointRaw) !== FROZEN_CHECKPOINT_SHA256 || sha256(sourceRaw) !== FROZEN_SOURCE_MANIFEST_SHA256) {
    throw new Error('R91_FROZEN_INPUT_HASH_MISMATCH')
  }
  const checkpoint = JSON.parse(checkpointRaw)
  const source = JSON.parse(sourceRaw)
  const candidate = JSON.parse(candidateRaw)
  if (sha256(canonicalJson(candidate)) !== FROZEN_CANDIDATE_CANONICAL_SHA256) throw new Error('R91_CANDIDATE_CHECKPOINT_HASH_MISMATCH')
  if (checkpoint.observations?.length !== 16 || source.screeningCases?.length !== 8 || candidate.observations?.length !== 16
    || candidate.modelCalls !== 0 || candidate.networkRequests !== 0 || candidate.expectedAnswersRead !== false) {
    throw new Error('R91_FROZEN_INPUT_INVALID')
  }
  if (new Set(candidate.observations.map((item) => item.observationId)).size !== 16) throw new Error('R91_OBSERVATION_ID_DUPLICATE')
  const sourceById = new Map(source.screeningCases.map((item) => [item.caseId, item]))
  const baselineById = new Map(checkpoint.observations.map((item) => [item.observationId, item]))
  const details = candidate.observations.map((observation) => {
    const baseline = baselineById.get(observation.observationId)
    const input = sourceById.get(observation.caseId)
    if (!baseline || !input || baseline.caseId !== observation.caseId
      || sha256(canonicalJson(observation.result)) !== observation.resultSha256) throw new Error('R91_OBSERVATION_BINDING_INVALID')
    const rawOutput = baseline.response.payload.rawOutput
    if (sha256(rawOutput) !== baseline.response.payload.execution.rawOutputSha256) throw new Error('R91_RAW_OUTPUT_HASH_DRIFT')
    const graph = normalizeR8FactGraphReferences(buildR8FactGraphFromCachedRaw({
      raw: JSON.parse(rawOutput), sourceText: input.content, referenceTime: input.referenceTime, timezone: input.timezone,
    }))
    const before = structuredClone(graph)
    const replanned = planR9RecognitionResult(graph, {
      modelName: baseline.response.payload.result.modelName,
      createdAt: baseline.response.payload.result.createdAt,
    })
    const graphIssues = compareR9FactGraphSnapshots(before, graph)
    const semantic = evaluateR9SemanticIntegrity(observation.result, before)
    return {
      observationId: observation.observationId,
      caseId: observation.caseId,
      factGraphSha256: sha256(canonicalJson(before)),
      candidateResultSha256: sha256(canonicalJson(observation.result)),
      deterministicReplanMatchesFrozenCandidate: sha256(canonicalJson(replanned)) === sha256(canonicalJson(observation.result)),
      graphIssues,
      semanticIssues: semantic.issues,
    }
  })
  const checks = {
    sixteenObservations: details.length === 16,
    eightSourcesPaired: new Set(details.map((item) => item.caseId)).size === 8,
    deterministicReplan: details.every((item) => item.deterministicReplanMatchesFrozenCandidate),
    factGraphImmutable: details.every((item) => item.graphIssues.length === 0),
    semanticProjectionExactWithinDeclaredEquivalence: details.every((item) => item.semanticIssues.length === 0),
    productionRecognitionGenerationCallsZero: true,
    expectedAnswersExcluded: true,
    zeroNetworkRequests: true,
  }
  const generatedAt = new Date().toISOString()
  const privateResult = {
    schemaVersion: 'e2.9-r9.1-cache-integrity-private-1.0.0', generatedAt,
    inputs: {
      checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw),
      candidateCheckpointSha256: sha256(canonicalJson(candidate)),
    },
    checks,
    issueCounts: {
      graphMutation: details.reduce((sum, item) => sum + item.graphIssues.length, 0),
      semanticProjection: details.reduce((sum, item) => sum + item.semanticIssues.length, 0),
    },
    details,
  }
  const publicResult = {
    schemaVersion: 'e2.9-r9.1-cache-integrity-public-1.0.0', generatedAt,
    observationCount: details.length, uniqueSourceCases: new Set(details.map((item) => item.caseId)).size,
    modelCalls: 0, networkRequests: 0, expectedAnswersRead: false,
    inputs: privateResult.inputs, checks, issueCounts: privateResult.issueCounts,
    scope: 'harness integrity hardening only; R9 frozen Gate and model quality results are unchanged',
    screening: 'NOT_RUN', selection: 'NOT_RUN', blind: 'NOT_CREATED', production: 'NOT_DEPLOYED',
  }
  await Promise.all([mkdir(path.dirname(privateOutput), { recursive: true }), mkdir(path.dirname(publicOutput), { recursive: true })])
  await Promise.all([
    writeFile(privateOutput, `${JSON.stringify(privateResult, null, 2)}\n`, 'utf8'),
    writeFile(publicOutput, `${JSON.stringify(publicResult, null, 2)}\n`, 'utf8'),
  ])
  console.log(JSON.stringify(publicResult, null, 2))
  if (!Object.values(checks).every(Boolean)) process.exitCode = 2
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
