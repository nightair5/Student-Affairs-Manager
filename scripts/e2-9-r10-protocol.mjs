import { execFileSync } from 'node:child_process'
import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  E2_R10_REQUIRED_CHECK_NAMES,
  E2_R10_REQUIRED_COMPONENT_VERSIONS,
} from '../cloudflare/e2-r10-qualification-contract.mjs'

export const R10_PROTOCOL_VERSION = 'e2-9-r10-facts-first-protocol-1.1.2'
export const R10_QUALIFICATION_RESULT_VERSION = 'e2-9-r10-zero-model-qualification-1.1.2'
export const R10_QUALIFICATION_RUN_LABEL = 'e29r10-zero-model-qualification-20260824-d'
export const R10_PRODUCTION_BASELINE_COMMIT = 'ef52d6b572e89faaaa9a18823df41b526aef3b8d'

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
  'gateSha256',
  'productionAuthorized',
  'protocolBundleSha256',
  'protocolVersion',
  'selectionAuthorized',
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

export async function assertR10ScreeningAuthorization(value, { root } = {}) {
  if (!root || !exactKeys(value, SCREENING_AUTHORIZATION_FIELDS)
    || value.protocolVersion !== R10_PROTOCOL_VERSION || value.authorized !== true || value.callCap !== 16
    || value.selectionAuthorized !== false || value.blindAuthorized !== false || value.productionAuthorized !== false
    || !validBoundSha256(value.protocolBundleSha256) || !validBoundSha256(value.gateSha256)) {
    throw new Error('R10_SCREENING_NOT_AUTHORIZED')
  }
  const [protocolBundle, gateRaw] = await Promise.all([
    buildR10ProtocolBundle(root),
    readFile(path.join(root, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-gate.json'), 'utf8'),
  ])
  const recomputedGateSha256 = sha256(canonicalJson(JSON.parse(gateRaw)))
  if (!safeHashEqual(value.protocolBundleSha256, protocolBundle.bundleSha256)
    || !safeHashEqual(value.gateSha256, recomputedGateSha256)) {
    throw new Error('R10_SCREENING_BINDING_MISMATCH')
  }
  return value
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
