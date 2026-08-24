import { execFileSync } from 'node:child_process'
import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  E2_R10_REQUIRED_CHECK_NAMES,
  E2_R10_REQUIRED_COMPONENT_VERSIONS,
} from '../cloudflare/e2-r10-qualification-contract.mjs'

export const R10_PROTOCOL_VERSION = 'e2-9-r10-facts-first-protocol-1.1.5'
export const R10_QUALIFICATION_RESULT_VERSION = 'e2-9-r10-zero-model-qualification-1.1.5'
export const R10_QUALIFICATION_RUN_LABEL = 'e29r10-zero-model-qualification-20260824-g'
export const R10_PRODUCTION_BASELINE_COMMIT = 'ef52d6b572e89faaaa9a18823df41b526aef3b8d'

export const R10_QUALIFICATION_ARTIFACT_PATHS = Object.freeze({
  result: 'docs/e2-v4-pro-benchmark-r10/qualification-result-g.json',
  evidence: 'docs/e2-v4-pro-benchmark-r10/qualification-evidence-g.json',
  preview: 'docs/e2-v4-pro-benchmark-r10/preview-qualification-g.json',
  independentReview: 'docs/e2-v4-pro-benchmark-r10/independent-review-g.json',
  gate: 'docs/e2-v4-pro-benchmark-r10/screening-gate.json',
})

export const R10_STAGE_ORDER = Object.freeze([
  'ZERO_MODEL_IMPLEMENTATION',
  'LOCAL_QUALIFIED',
  'PREVIEW_QUALIFIED',
  'SCREENING_AUTHORIZED',
  'SCREENING_GENERATION_FROZEN',
  'SCREENING_SCORED',
  'SCREENING_ADJUDICATED',
  'SCREENING_GATE_PASS',
])

export const R10_PROTOCOL_BUNDLE_FILES = Object.freeze([
  'cloudflare/e2-r10-factledger-contract.mjs',
  'cloudflare/e2-r10-ledger-planner-bridge.mjs',
  'cloudflare/e2-r10-isolated-planner.mjs',
  'cloudflare/e2-r10-ledger-plan-validator.mjs',
  'cloudflare/e2-r10-qualification-contract.mjs',
  'cloudflare/e2-r10-qualification-worker.mjs',
  'cloudflare/e2-r10-qualification-ledger.mjs',
  'cloudflare/e2-r10-pipeline-tests.mjs',
  'cloudflare/e2-r10-validator-tests.mjs',
  'cloudflare/e2-r10-qualification-tests.mjs',
  'scripts/e2-9-r10-protocol.mjs',
  'scripts/e2-9-r10-protocol.node.mjs',
  'scripts/run-e2-9-r10-zero-model-qualification.mjs',
  'scripts/deploy-e2-9-r10-qualification-preview.ps1',
  'wrangler.e2-r10-qualification-preview.jsonc',
  'wrangler.e2-r10-qualification-ledger.jsonc',
  'docs/e2-v4-pro-benchmark-r10/PROTOCOL.md',
  'docs/e2-v4-pro-benchmark-r10/screening-gate.json',
  'docs/e2-v4-pro-benchmark-r10/screening-plan.json',
  'package.json',
])

const PRODUCTION_FIXED_FILES = Object.freeze([
  'index.html',
  'package-lock.json',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'wrangler.jsonc',
])

const SCREENING_AUTHORIZATION_FIELDS = Object.freeze([
  'authorized',
  'blindAuthorized',
  'callCap',
  'deploymentEvidenceSha256',
  'gateSha256',
  'independentReviewSha256',
  'ledgerWorkerVersionId',
  'previewQualificationSha256',
  'productionAuthorized',
  'productionIsolationManifestSha256',
  'protocolBundleSha256',
  'protocolVersion',
  'qualificationEvidenceSha256',
  'qualificationResultSha256',
  'qualificationRunLabel',
  'qualificationWorkerVersionId',
  'qualifiedSourceCommit',
  'qualifiedSourceManifestSha256',
  'qualifiedSourceTree',
  'selectionAuthorized',
])

const LOCKED_MODEL_STAGE_NAMES = Object.freeze([
  'readiness',
  'smoke',
  'screening',
  'selection',
  'blind',
  'production',
])

export const R10_INDEPENDENT_REVIEW_CHECK_NAMES = Object.freeze([
  'reviewerDidNotReceivePathMapping',
  'reviewerDidNotModifyArtifacts',
  'protocolBundleMatchesQualifiedBundle',
  'screeningGateMatchesFrozenGate',
  'qualificationResultHashMatches',
  'qualificationEvidenceHashMatches',
  'previewQualificationHashMatches',
  'deploymentEvidenceHashMatches',
  'qualificationWorkerVersionMatches',
  'ledgerWorkerVersionMatches',
  'frontQualificationVersionHasZeroStableTraffic',
  'ledgerQualifiedVersionIsSoleActiveVersion',
  'allLaterStagesRemainLocked',
  'zeroModelCallsObserved',
  'zeroExpectedAnswerReadsObserved',
  'productionRemainsUndeployed',
])

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function validBoundSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) && !/^0{64}$/u.test(value)
}

export function safeHashEqual(left, right) {
  if (!validBoundSha256(left) || !validBoundSha256(right)) return false
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}

export function r10PreviewWorkerNameCompatible(name, origin) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 54 || !/^[a-z0-9-]+$/u.test(name)) return false
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'https:'
      && parsed.pathname === '/'
      && parsed.search === ''
      && parsed.hash === ''
      && parsed.hostname.startsWith(`${name}.`)
  } catch {
    return false
  }
}

export function assertR10ImmutableArtifact(existing, candidate, artifactPath = 'artifact') {
  if (existing === null) return 'CREATE'
  if (existing === candidate) return 'IDENTICAL'
  throw new Error(`R10_LOCAL_ARTIFACT_IMMUTABLE:${artifactPath}`)
}

export async function writeR10ImmutableArtifacts(entries) {
  const prepared = []
  for (const entry of entries) {
    let existing = null
    try {
      existing = await readFile(entry.path, 'utf8')
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'ENOENT')) throw error
    }
    const action = assertR10ImmutableArtifact(existing, entry.contents, entry.path)
    prepared.push({ ...entry, action })
  }
  for (const entry of prepared.filter((item) => item.action === 'CREATE')) {
    try {
      await writeFile(entry.path, entry.contents, { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'EEXIST')) throw error
      const existing = await readFile(entry.path, 'utf8')
      assertR10ImmutableArtifact(existing, entry.contents, entry.path)
    }
  }
  return prepared.map(({ path: artifactPath, action }) => ({ path: artifactPath, action }))
}

function execGit(root, args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
}

function exactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  return actual.length === expected.length && actual.every((item, index) => item === expected[index])
}

function projectedConfig(relativePath, bytes) {
  const config = JSON.parse(bytes.toString('utf8'))
  const redactedKeys = relativePath === 'wrangler.e2-r10-qualification-preview.jsonc'
    ? [
      'E2_R10_PROTOCOL_BUNDLE_SHA256',
      'E2_R10_QUALIFICATION_RESULT_SHA256',
      'E2_R10_QUALIFICATION_WORKER_BYTES_SHA256',
      'E2_R10_QUALIFICATION_WORKER_CONFIG_SHA256',
      'E2_R10_LEDGER_WORKER_VERSION_ID',
      'E2_R10_LEDGER_WORKER_BYTES_SHA256',
      'E2_R10_LEDGER_WORKER_CONFIG_SHA256',
    ]
    : relativePath === 'wrangler.e2-r10-qualification-ledger.jsonc'
      ? [
        'E2_R10_LEDGER_WORKER_BYTES_SHA256',
        'E2_R10_LEDGER_WORKER_CONFIG_SHA256',
      ]
      : []
  for (const key of redactedKeys) {
    if (Object.hasOwn(config.vars ?? {}, key)) config.vars[key] = '<BOUND_AT_VERSION_UPLOAD>'
  }
  return Buffer.from(canonicalJson(config), 'utf8')
}

export async function buildR10ProtocolBundle(root) {
  const files = []
  for (const relativePath of R10_PROTOCOL_BUNDLE_FILES) {
    const bytes = await readFile(path.join(root, relativePath))
    const isWranglerConfig = relativePath.startsWith('wrangler.e2-r10-qualification-')
    const projection = isWranglerConfig ? projectedConfig(relativePath, bytes) : bytes
    files.push({
      path: relativePath.replaceAll('\\', '/'),
      sha256: sha256(projection),
      projectionRule: isWranglerConfig
        ? 'canonical-config-with-version-upload-bindings-redacted'
        : 'raw-bytes',
    })
  }
  const projection = { protocolVersion: R10_PROTOCOL_VERSION, files }
  return { ...projection, bundleSha256: sha256(canonicalJson(projection)) }
}

function parseGitTree(raw) {
  return raw.split('\0').filter(Boolean).map((record) => {
    const match = record.match(/^(\d+)\s+(\w+)\s+([a-f0-9]+)\t([\s\S]+)$/u)
    if (!match) throw new Error('R10_GIT_TREE_RECORD_INVALID')
    return { mode: match[1], type: match[2], objectId: match[3], path: match[4].replaceAll('\\', '/') }
  })
}

export function inspectR10TrackedSource(root) {
  const sourceCommit = execGit(root, ['rev-parse', '--verify', 'HEAD']).trim()
  const sourceTree = execGit(root, ['rev-parse', '--verify', 'HEAD^{tree}']).trim()
  const entries = parseGitTree(execGit(root, ['ls-tree', '-r', '-z', '--full-tree', 'HEAD']))
  const sourceManifest = {
    schemaVersion: 'e2.9-r10-git-tree-manifest-1.0.0',
    objectFormat: execGit(root, ['rev-parse', '--show-object-format']).trim(),
    sourceCommit,
    sourceTree,
    entries,
  }
  const status = execGit(root, ['status', '--porcelain=v1', '--untracked-files=all'])
  const trackedPaths = new Set(entries.map((entry) => entry.path))
  const protocolFilesTracked = R10_PROTOCOL_BUNDLE_FILES.every((relativePath) => trackedPaths.has(relativePath))
  return {
    sourceCommit,
    sourceTree,
    sourceManifestSha256: sha256(canonicalJson(sourceManifest)),
    trackedFileCount: entries.length,
    worktreeClean: status.length === 0,
    protocolFilesTracked,
    dirtyEntryCount: status ? status.trimEnd().split(/\r?\n/u).length : 0,
  }
}

export function assertR10CommittedSource(root) {
  const source = inspectR10TrackedSource(root)
  if (!/^[a-f0-9]{40}$/u.test(source.sourceCommit)
    || !/^[a-f0-9]{40}$/u.test(source.sourceTree)
    || !validBoundSha256(source.sourceManifestSha256)
    || !source.worktreeClean
    || !source.protocolFilesTracked) {
    throw new Error('R10_COMMITTED_CLEAN_SOURCE_REQUIRED')
  }
  return source
}

function extractRelativeModuleSpecifiers(source) {
  const matches = []
  for (const match of source.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"](\.[^'"]+)['"]/gu)) {
    matches.push(match[1])
  }
  return matches
}

function resolveModulePath(importer, specifier) {
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier))
  if (resolved.startsWith('../') || path.posix.isAbsolute(resolved)) throw new Error('R10_PRODUCTION_MODULE_OUTSIDE_REPOSITORY')
  return path.posix.extname(resolved) ? resolved : `${resolved}.mjs`
}

async function productionModuleGraph(entryPath, readBytes) {
  const pending = [entryPath]
  const entries = []
  const visited = new Set()
  while (pending.length > 0) {
    const current = pending.pop()
    if (visited.has(current)) continue
    visited.add(current)
    const bytes = await readBytes(current)
    entries.push({ path: current, sha256: sha256(bytes), projectionRule: 'raw-bytes' })
    for (const specifier of extractRelativeModuleSpecifiers(bytes.toString('utf8'))) {
      pending.push(resolveModulePath(current, specifier))
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path))
}

export async function buildR10QualificationDeploymentArtifacts(root) {
  const readWorktreeBytes = async (relativePath) => readFile(path.join(root, relativePath))
  const [qualificationModules, ledgerModules, qualificationConfig, ledgerConfig] = await Promise.all([
    productionModuleGraph('cloudflare/e2-r10-qualification-worker.mjs', readWorktreeBytes),
    productionModuleGraph('cloudflare/e2-r10-qualification-ledger.mjs', readWorktreeBytes),
    readFile(path.join(root, 'wrangler.e2-r10-qualification-preview.jsonc')),
    readFile(path.join(root, 'wrangler.e2-r10-qualification-ledger.jsonc')),
  ])
  const qualificationBytesManifest = {
    schemaVersion: 'e2.9-r10-upload-module-bytes-manifest-1.0.0',
    worker: 'qualification',
    modules: qualificationModules.map(({ path: modulePath, sha256: moduleSha256 }) => ({
      path: modulePath,
      sha256: moduleSha256,
    })),
  }
  const ledgerBytesManifest = {
    schemaVersion: 'e2.9-r10-upload-module-bytes-manifest-1.0.0',
    worker: 'ledger',
    modules: ledgerModules.map(({ path: modulePath, sha256: moduleSha256 }) => ({
      path: modulePath,
      sha256: moduleSha256,
    })),
  }
  return {
    schemaVersion: 'e2.9-r10-qualification-deployment-artifacts-1.0.0',
    qualificationWorkerBytesSha256: sha256(canonicalJson(qualificationBytesManifest)),
    qualificationWorkerConfigSha256: sha256(projectedConfig('wrangler.e2-r10-qualification-preview.jsonc', qualificationConfig)),
    qualificationWorkerModuleCount: qualificationModules.length,
    ledgerWorkerBytesSha256: sha256(canonicalJson(ledgerBytesManifest)),
    ledgerWorkerConfigSha256: sha256(projectedConfig('wrangler.e2-r10-qualification-ledger.jsonc', ledgerConfig)),
    ledgerWorkerModuleCount: ledgerModules.length,
  }
}

function productionPackageProjection(raw) {
  const packageJson = JSON.parse(raw)
  return {
    name: packageJson.name,
    version: packageJson.version,
    type: packageJson.type,
    buildScript: packageJson.scripts?.build,
    dependencies: packageJson.dependencies ?? {},
    devDependencies: packageJson.devDependencies ?? {},
  }
}

function baselineProductionPaths(root, commit) {
  const paths = execGit(root, ['ls-tree', '-r', '--name-only', commit, '--', 'src', 'public'])
    .split(/\r?\n/u).filter(Boolean).map((item) => item.replaceAll('\\', '/'))
  return [...new Set([...paths, ...PRODUCTION_FIXED_FILES])].sort()
}

async function worktreeProductionPaths(root) {
  const paths = execGit(root, ['ls-files', '-co', '--exclude-standard', '--', 'src', 'public'])
    .split(/\r?\n/u).filter(Boolean).map((item) => item.replaceAll('\\', '/'))
  return [...new Set([...paths, ...PRODUCTION_FIXED_FILES])].sort()
}

async function buildProductionManifest({ root, source, commit }) {
  const treeEntries = source === 'commit'
    ? new Map(parseGitTree(execGit(root, ['ls-tree', '-r', '-z', '--full-tree', commit]))
      .map((entry) => [entry.path, entry]))
    : null
  const readBytes = source === 'commit'
    ? async (relativePath) => execGit(root, ['show', `${commit}:${relativePath}`], { encoding: null })
    : async (relativePath) => readFile(path.join(root, relativePath))
  const rawPaths = source === 'commit'
    ? baselineProductionPaths(root, commit)
    : await worktreeProductionPaths(root)
  const entries = []
  for (const relativePath of rawPaths) {
    if (treeEntries) {
      const treeEntry = treeEntries.get(relativePath)
      if (!treeEntry || treeEntry.type !== 'blob') throw new Error(`R10_PRODUCTION_TREE_ENTRY_MISSING:${relativePath}`)
      entries.push({
        path: relativePath,
        gitBlobObjectId: treeEntry.objectId,
        projectionRule: 'committed-git-blob-object-id',
      })
    } else {
      const bytes = await readBytes(relativePath)
      entries.push({ path: relativePath, sha256: sha256(bytes), projectionRule: 'raw-bytes' })
    }
  }
  const packageBytes = await readBytes('package.json')
  entries.push({
    path: 'package.json#production-projection',
    sha256: sha256(canonicalJson(productionPackageProjection(packageBytes.toString('utf8')))),
    projectionRule: 'name-version-type-build-dependencies-devDependencies',
  })
  const workerModules = await productionModuleGraph('cloudflare/worker.mjs', readBytes)
  for (const entry of workerModules) entries.push({ ...entry, projectionRule: 'production-worker-module-raw-bytes' })
  entries.sort((left, right) => left.path.localeCompare(right.path))
  const manifest = {
    schemaVersion: 'e2.9-r10-production-dependency-deployment-manifest-1.0.0',
    baselineCommit: R10_PRODUCTION_BASELINE_COMMIT,
    entries,
  }
  return { ...manifest, manifestSha256: sha256(canonicalJson(manifest)) }
}

export async function inspectR10ProductionIsolation(root) {
  const baseline = await buildProductionManifest({ root, source: 'commit', commit: R10_PRODUCTION_BASELINE_COMMIT })
  const currentCommit = execGit(root, ['rev-parse', '--verify', 'HEAD']).trim()
  const current = await buildProductionManifest({ root, source: 'commit', commit: currentCommit })
  const baselineByPath = new Map(baseline.entries.map((entry) => [entry.path, entry]))
  const currentByPath = new Map(current.entries.map((entry) => [entry.path, entry]))
  const mismatchedPaths = [...new Set([...baselineByPath.keys(), ...currentByPath.keys()])]
    .filter((entryPath) => canonicalJson(baselineByPath.get(entryPath)) !== canonicalJson(currentByPath.get(entryPath)))
    .sort()
  const protectedPaths = new Set([...baselineByPath.keys(), ...currentByPath.keys()]
    .map((entryPath) => entryPath.replace(/#production-projection$/u, '')))
  const dirtyProtectedPaths = execGit(root, ['status', '--porcelain=v1', '--untracked-files=all'])
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.slice(3).replaceAll('\\', '/'))
    .filter((entryPath) => entryPath !== 'package.json' && (
      protectedPaths.has(entryPath)
      || entryPath.startsWith('src/')
      || entryPath.startsWith('public/')
    ))
  const baselinePackage = productionPackageProjection(execGit(root, ['show', `${R10_PRODUCTION_BASELINE_COMMIT}:package.json`]))
  const worktreePackage = productionPackageProjection(await readFile(path.join(root, 'package.json'), 'utf8'))
  if (canonicalJson(baselinePackage) !== canonicalJson(worktreePackage)) mismatchedPaths.push('package.json#production-projection')
  mismatchedPaths.push(...dirtyProtectedPaths)
  const uniqueMismatches = [...new Set(mismatchedPaths)].sort()
  return {
    baselineCommit: R10_PRODUCTION_BASELINE_COMMIT,
    manifestSha256: baseline.manifestSha256,
    entryCount: baseline.entries.length,
    workerModuleCount: baseline.entries.filter((entry) => entry.projectionRule === 'production-worker-module-raw-bytes').length,
    matched: baseline.manifestSha256 === current.manifestSha256
      && canonicalJson(baseline.entries) === canonicalJson(current.entries)
      && uniqueMismatches.length === 0,
    currentManifestSha256: current.manifestSha256,
    mismatchedPaths: uniqueMismatches,
  }
}

export async function assertR10ProductionIsolation(root) {
  const isolation = await inspectR10ProductionIsolation(root)
  if (!isolation.matched) throw new Error('R10_PRODUCTION_ISOLATION_MANIFEST_MISMATCH')
  return isolation
}

export function assertR10StageTransition(current, next) {
  const currentIndex = R10_STAGE_ORDER.indexOf(current)
  const nextIndex = R10_STAGE_ORDER.indexOf(next)
  if (currentIndex < 0 || nextIndex !== currentIndex + 1) throw new Error(`R10_STAGE_TRANSITION_FORBIDDEN:${current}->${next}`)
  return next
}

export function assertR10ModelIdentity(execution) {
  const values = [execution?.requestedModel, execution?.returnedModel, execution?.executionModel, execution?.resultModelName]
  if (values.some((value) => typeof value !== 'string' || !value.trim()) || new Set(values).size !== 1) {
    throw new Error('R10_MODEL_IDENTITY_MISMATCH')
  }
  return values[0]
}

export function assertR10AppendOnlyObservation(existing, candidate) {
  if (!existing) return candidate
  if (canonicalJson(existing) !== canonicalJson(candidate)) throw new Error('R10_OBSERVATION_IMMUTABLE')
  throw new Error('R10_OBSERVATION_ALREADY_RECORDED')
}

function everyBooleanFalse(value, keys) {
  return value && exactKeys(value, keys) && keys.every((key) => value[key] === false)
}

function everyStatus(value, keys, expectedStatus) {
  return value && exactKeys(value, keys) && keys.every((key) => value[key] === expectedStatus)
}

function assertR10ScreeningAuthorizationShape(value) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
  if (!exactKeys(value, SCREENING_AUTHORIZATION_FIELDS)
    || value.protocolVersion !== R10_PROTOCOL_VERSION
    || value.qualificationRunLabel !== R10_QUALIFICATION_RUN_LABEL
    || value.authorized !== true || value.callCap !== 16
    || value.selectionAuthorized !== false || value.blindAuthorized !== false || value.productionAuthorized !== false
    || !/^[a-f0-9]{40}$/u.test(value.qualifiedSourceCommit)
    || !/^[a-f0-9]{40}$/u.test(value.qualifiedSourceTree)
    || !uuidPattern.test(value.qualificationWorkerVersionId)
    || !uuidPattern.test(value.ledgerWorkerVersionId)
    || [
      value.protocolBundleSha256,
      value.gateSha256,
      value.qualificationResultSha256,
      value.qualificationEvidenceSha256,
      value.previewQualificationSha256,
      value.deploymentEvidenceSha256,
      value.independentReviewSha256,
      value.qualifiedSourceManifestSha256,
      value.productionIsolationManifestSha256,
    ].some((item) => !validBoundSha256(item))) {
    throw new Error('R10_SCREENING_NOT_AUTHORIZED')
  }
}

export function assertR10ScreeningQualificationBinding(value, artifacts) {
  assertR10ScreeningAuthorizationShape(value)
  const {
    protocolBundle,
    gate,
    qualificationResult,
    qualificationEvidence,
    previewQualification,
    independentReview,
  } = artifacts ?? {}
  if (!protocolBundle || !gate || !qualificationResult || !qualificationEvidence
    || !previewQualification || !previewQualification.deploymentEvidence || !independentReview) {
    throw new Error('R10_SCREENING_QUALIFICATION_ARTIFACT_MISSING')
  }

  const recomputedGateSha256 = sha256(canonicalJson(gate))
  const recomputedResultSha256 = sha256(canonicalJson(qualificationResult))
  const recomputedEvidenceSha256 = sha256(canonicalJson(qualificationEvidence))
  const recomputedPreviewSha256 = sha256(canonicalJson(previewQualification))
  const recomputedReviewSha256 = sha256(canonicalJson(independentReview))
  const recomputedDeploymentEvidenceSha256 = sha256(canonicalJson(previewQualification.deploymentEvidence))
  const sharedProtocolValues = [
    protocolBundle.protocolVersion,
    qualificationResult.protocolVersion,
    qualificationEvidence.protocolVersion,
    previewQualification.protocolVersion,
    independentReview.protocolVersion,
  ]
  const sharedRunLabels = [
    qualificationResult.runLabel,
    qualificationEvidence.runLabel,
    previewQualification.runLabel,
    independentReview.runLabel,
  ]
  const sharedBundleHashes = [
    protocolBundle.bundleSha256,
    qualificationResult.protocolBundleSha256,
    qualificationEvidence.protocolBundleSha256,
    previewQualification.protocolBundleSha256,
    independentReview.protocolBundleSha256,
  ]
  const independentChecksPass = independentReview.checks
    && exactKeys(independentReview.checks, R10_INDEPENDENT_REVIEW_CHECK_NAMES)
    && R10_INDEPENDENT_REVIEW_CHECK_NAMES.every((name) => independentReview.checks[name] === 'PASS')
  const bindingsMatch = [
    [value.protocolBundleSha256, protocolBundle.bundleSha256],
    [value.gateSha256, recomputedGateSha256],
    [value.qualificationResultSha256, recomputedResultSha256],
    [value.qualificationEvidenceSha256, recomputedEvidenceSha256],
    [value.previewQualificationSha256, recomputedPreviewSha256],
    [value.independentReviewSha256, recomputedReviewSha256],
    [qualificationEvidence.qualificationResultSha256, recomputedResultSha256],
    [qualificationEvidence.screeningGateSha256, recomputedGateSha256],
    [previewQualification.qualificationResultSha256, recomputedResultSha256],
    [previewQualification.deploymentEvidenceSha256, value.deploymentEvidenceSha256],
    [previewQualification.deploymentEvidenceSha256, recomputedDeploymentEvidenceSha256],
    [independentReview.qualificationResultSha256, recomputedResultSha256],
    [independentReview.qualificationEvidenceSha256, recomputedEvidenceSha256],
    [independentReview.previewQualificationSha256, recomputedPreviewSha256],
    [independentReview.deploymentEvidenceSha256, value.deploymentEvidenceSha256],
    [independentReview.screeningGateSha256, recomputedGateSha256],
  ].every(([left, right]) => safeHashEqual(left, right))

  const qualificationCountersZero = qualificationResult.modelCalls === 0
    && qualificationResult.upstreamNetworkCalls === 0
    && qualificationResult.expectedAnswersLoaded === false
    && qualificationResult.accessCounters?.modelCalls === 0
    && qualificationResult.accessCounters?.upstreamNetworkCalls === 0
    && qualificationResult.accessCounters?.expectedAnswerReads === 0
    && qualificationEvidence.modelCalls === 0
    && qualificationEvidence.upstreamNetworkCalls === 0
    && qualificationEvidence.expectedAnswersLoaded === false
    && qualificationEvidence.accessCounters?.modelCalls === 0
    && qualificationEvidence.accessCounters?.upstreamNetworkCalls === 0
    && qualificationEvidence.accessCounters?.expectedAnswerReads === 0
    && previewQualification.modelCalls === 0
    && previewQualification.upstreamNetworkCalls === 0
    && previewQualification.expectedAnswerReads === 0
    && independentReview.modelCalls === 0
    && independentReview.expectedAnswerReads === 0

  const qualificationIsClosed = qualificationResult.status === 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE'
    && everyBooleanFalse(qualificationResult.nextStages, LOCKED_MODEL_STAGE_NAMES)
    && everyStatus(previewQualification.lockedStageStatuses, LOCKED_MODEL_STAGE_NAMES, 412)
    && previewQualification.recordStatus === 201
    && previewQualification.idempotentReplayStatus === 200
    && previewQualification.stateStatus === 200
    && previewQualification.wrongOriginStatus === 403
    && previewQualification.wrongAuthenticationStatus === 401
    && previewQualification.contractStableReads >= 3
    && previewQualification.qualificationWorkerStableTrafficPercentage === 0
    && previewQualification.ledgerWorkerActiveTrafficPercentage === 100
    && previewQualification.productionSiteConfigChanged === false
    && previewQualification.productionDeployment === 'NOT_DEPLOYED'
    && previewQualification.screeningAuthorization === 'NOT_AUTHORIZED'

  const reviewIsIndependent = independentReview.schemaVersion === 'e2.9-r10-independent-qualification-review-1.0.0'
    && independentReview.overallStatus === 'PASS'
    && Array.isArray(independentReview.findings) && independentReview.findings.length === 0
    && independentReview.reviewer?.forkTurns === 'none'
    && independentReview.reviewer?.receivedPathMapping === false
    && independentReview.reviewer?.modifiedArtifacts === false
    && independentReview.reviewer?.readOnly === true
    && independentChecksPass

  const identityMatches = value.qualifiedSourceCommit === qualificationResult.sourceCommit
    && value.qualifiedSourceTree === qualificationResult.sourceTree
    && value.qualifiedSourceManifestSha256 === qualificationResult.sourceManifestSha256
    && value.productionIsolationManifestSha256 === qualificationResult.productionIsolationManifestSha256
    && qualificationEvidence.sourceCommit === qualificationResult.sourceCommit
    && qualificationEvidence.sourceTree === qualificationResult.sourceTree
    && qualificationEvidence.sourceManifestSha256 === qualificationResult.sourceManifestSha256
    && qualificationEvidence.productionIsolationManifestSha256 === qualificationResult.productionIsolationManifestSha256
    && previewQualification.sourceCommit === qualificationResult.sourceCommit
    && independentReview.sourceCommit === qualificationResult.sourceCommit
    && independentReview.sourceTree === qualificationResult.sourceTree
    && independentReview.sourceManifestSha256 === qualificationResult.sourceManifestSha256
    && independentReview.productionIsolationManifestSha256 === qualificationResult.productionIsolationManifestSha256
    && value.qualificationWorkerVersionId === previewQualification.qualificationWorkerVersionId
    && value.qualificationWorkerVersionId === independentReview.qualificationWorkerVersionId
    && value.qualificationWorkerVersionId === previewQualification.deploymentEvidence?.qualificationWorkerVersionId
    && value.ledgerWorkerVersionId === previewQualification.ledgerWorkerVersionId
    && value.ledgerWorkerVersionId === independentReview.ledgerWorkerVersionId
    && value.ledgerWorkerVersionId === previewQualification.deploymentEvidence?.ledgerWorkerVersionId
    && qualificationEvidence.deploymentArtifacts?.qualificationWorkerBytesSha256
      === previewQualification.deploymentEvidence?.qualificationWorkerBytesSha256
    && qualificationEvidence.deploymentArtifacts?.qualificationWorkerConfigSha256
      === previewQualification.deploymentEvidence?.qualificationWorkerConfigSha256
    && qualificationEvidence.deploymentArtifacts?.ledgerWorkerBytesSha256
      === previewQualification.deploymentEvidence?.ledgerWorkerBytesSha256
    && qualificationEvidence.deploymentArtifacts?.ledgerWorkerConfigSha256
      === previewQualification.deploymentEvidence?.ledgerWorkerConfigSha256
    && sharedProtocolValues.every((item) => item === R10_PROTOCOL_VERSION)
    && sharedRunLabels.every((item) => item === R10_QUALIFICATION_RUN_LABEL)
    && sharedBundleHashes.every((item) => safeHashEqual(item, value.protocolBundleSha256))

  if (!bindingsMatch || !qualificationCountersZero || !qualificationIsClosed
    || !reviewIsIndependent || !identityMatches) {
    throw new Error('R10_SCREENING_QUALIFICATION_BINDING_MISMATCH')
  }
  return value
}

export async function assertR10ScreeningAuthorization(value, { root } = {}) {
  if (!root) throw new Error('R10_SCREENING_NOT_AUTHORIZED')
  assertR10ScreeningAuthorizationShape(value)
  const [protocolBundle, gateRaw, resultRaw, evidenceRaw, previewRaw, reviewRaw] = await Promise.all([
    buildR10ProtocolBundle(root),
    readFile(path.join(root, R10_QUALIFICATION_ARTIFACT_PATHS.gate), 'utf8'),
    readFile(path.join(root, R10_QUALIFICATION_ARTIFACT_PATHS.result), 'utf8'),
    readFile(path.join(root, R10_QUALIFICATION_ARTIFACT_PATHS.evidence), 'utf8'),
    readFile(path.join(root, R10_QUALIFICATION_ARTIFACT_PATHS.preview), 'utf8'),
    readFile(path.join(root, R10_QUALIFICATION_ARTIFACT_PATHS.independentReview), 'utf8'),
  ]).catch(() => { throw new Error('R10_SCREENING_QUALIFICATION_ARTIFACT_MISSING') })
  return assertR10ScreeningQualificationBinding(value, {
    protocolBundle,
    gate: JSON.parse(gateRaw),
    qualificationResult: JSON.parse(resultRaw),
    qualificationEvidence: JSON.parse(evidenceRaw),
    previewQualification: JSON.parse(previewRaw),
    independentReview: JSON.parse(reviewRaw),
  })
}

export function createR10AccessInstrumentation() {
  const counters = { modelCalls: 0, upstreamNetworkCalls: 0, expectedAnswerReads: 0 }
  return Object.freeze({
    async modelCall(operation) {
      counters.modelCalls += 1
      return operation()
    },
    async networkCall(operation) {
      counters.upstreamNetworkCalls += 1
      return operation()
    },
    recordFileRead(relativePath) {
      if (/(?:expected|golden|holdout|blind|answer[-_.]?key)/iu.test(relativePath)) counters.expectedAnswerReads += 1
    },
    snapshot() {
      return Object.freeze({ ...counters })
    },
  })
}

export function buildR10QualificationResult({
  sourceBinding,
  productionIsolation,
  protocolBundle,
  checks,
  componentVersions,
  accessCounters,
}) {
  if (!sourceBinding || !/^[a-f0-9]{40}$/u.test(sourceBinding.sourceCommit ?? '')
    || !/^[a-f0-9]{40}$/u.test(sourceBinding.sourceTree ?? '')
    || !validBoundSha256(sourceBinding.sourceManifestSha256)
    || !productionIsolation || productionIsolation.baselineCommit !== R10_PRODUCTION_BASELINE_COMMIT
    || !validBoundSha256(productionIsolation.manifestSha256)
    || protocolBundle?.protocolVersion !== R10_PROTOCOL_VERSION
    || !validBoundSha256(protocolBundle?.bundleSha256)
    || !exactKeys(componentVersions, Object.keys(E2_R10_REQUIRED_COMPONENT_VERSIONS))
    || Object.entries(E2_R10_REQUIRED_COMPONENT_VERSIONS).some(([key, version]) => componentVersions[key] !== version)
    || !exactKeys(checks, E2_R10_REQUIRED_CHECK_NAMES)
    || Object.values(checks).some((passed) => typeof passed !== 'boolean')
    || !exactKeys(accessCounters, ['expectedAnswerReads', 'modelCalls', 'upstreamNetworkCalls'])
    || Object.values(accessCounters).some((count) => !Number.isInteger(count) || count < 0)) {
    throw new Error('R10_QUALIFICATION_EVIDENCE_INVALID')
  }
  const passed = Object.values(checks).every(Boolean)
    && accessCounters.modelCalls === 0
    && accessCounters.upstreamNetworkCalls === 0
    && accessCounters.expectedAnswerReads === 0
  return {
    schemaVersion: R10_QUALIFICATION_RESULT_VERSION,
    protocolVersion: R10_PROTOCOL_VERSION,
    runLabel: R10_QUALIFICATION_RUN_LABEL,
    status: passed
      ? 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE'
      : 'LOCAL_QUALIFICATION_FAILED_PREVIEW_LOCKED',
    sourceCommit: sourceBinding.sourceCommit,
    sourceTree: sourceBinding.sourceTree,
    sourceManifestSha256: sourceBinding.sourceManifestSha256,
    productionIsolationManifestSha256: productionIsolation.manifestSha256,
    protocolBundleSha256: protocolBundle.bundleSha256,
    componentVersions,
    checks,
    accessCounters,
    modelCalls: accessCounters.modelCalls,
    upstreamNetworkCalls: accessCounters.upstreamNetworkCalls,
    expectedAnswersLoaded: accessCounters.expectedAnswerReads > 0,
    nextStages: {
      readiness: false,
      smoke: false,
      screening: false,
      selection: false,
      blind: false,
      production: false,
    },
  }
}
