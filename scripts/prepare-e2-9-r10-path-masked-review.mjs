/* global console, process */
import { randomBytes, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { E2_R10_SCREENING_PROTOCOL_VERSION, E2_R10_SCREENING_RUN_LABEL } from '../cloudflare/e2-r10-screening-contract.mjs'
import { assertR10ScoringInput } from './score-e2-9-r10-screening.mjs'

export const E2_R10_PATH_MASK_VERSION = 'e2-r10-path-mask-1.0.0'
const ROOT = process.cwd()
const DEFAULT_CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r10', 'screening-protocol-1.0.0', E2_R10_SCREENING_RUN_LABEL)
const MANIFEST_PATH = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-protocol-1.0.0', 'case-manifest.json')
const BUNDLE_PATH = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-protocol-1.0.0', 'protocol-bundle.json')
const FORBIDDEN_IDENTITY = /(?:deepseek|flash|factledger|fact.?ledger|planner|single.?pass|path\s*[ab]|arm\s*[ab]|recognition-2\.|e2-r10|r10-|promptversion|pipelineversion|modelname|strict.?score|expected|golden|holdout)/iu

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function compactResult(result) {
  const tasks = [
    ...(result.milestones ?? []).flatMap((milestone) => milestone.tasks ?? []),
    ...(result.standaloneTasks ?? []),
  ]
  return {
    requiresAction: result.sourceSummary?.requiresAction ?? null,
    summary: result.sourceSummary?.summary ?? '',
    tasks: tasks.map((item) => ({
      title: item.title ?? '', actionVerb: item.actionVerb ?? '', actionObject: item.actionObject ?? '',
      description: item.description ?? '', selected: item.selected ?? null,
    })),
    milestones: (result.milestones ?? []).map((item) => ({ title: item.title ?? '', objective: item.objective ?? '' })),
    materials: (result.materials ?? []).map((item) => ({
      name: item.name ?? '', required: item.required ?? null, quantity: item.quantity ?? null,
      formatRequirements: item.formatRequirements ?? [], namingRequirements: item.namingRequirements ?? [], submissionChannel: item.submissionChannel ?? null,
    })),
    timePoints: (result.timePoints ?? []).map((item) => ({
      type: item.type ?? '', rawText: item.rawText ?? '', normalizedValue: item.normalizedValue ?? null,
      precision: item.precision ?? '', needsConfirmation: item.needsConfirmation ?? null,
    })),
    events: (result.events ?? []).map((item) => ({ title: item.title ?? '', description: item.description ?? '', location: item.location ?? null })),
    ambiguities: (result.ambiguities ?? []).map((item) => ({ field: item.field ?? '', message: item.message ?? '', options: item.options ?? [] })),
    conflicts: (result.conflicts ?? []).map((item) => ({ type: item.type ?? '', message: item.message ?? '' })),
    ignoredContent: (result.ignoredContent ?? []).map((item) => ({ text: item.text ?? '', reason: item.reason ?? '' })),
    evidenceQuotes: (result.evidence ?? []).map((item) => item.quote ?? item.quotedText ?? '').filter(Boolean),
  }
}

export function auditMaskedPacket(packet) {
  const serialized = JSON.stringify(packet)
  const findings = []
  if (FORBIDDEN_IDENTITY.test(serialized)) findings.push('IDENTITY_TOKEN_PRESENT')
  const optionKeysValid = packet.cases?.every((item) => Object.keys(item.options ?? {}).sort().join(',') === 'X,Y')
  if (!optionKeysValid) findings.push('OPTION_KEYS_INVALID')
  if (packet.cases?.length !== 8) findings.push('CASE_COUNT_INVALID')
  if (new Set(packet.cases?.map((item) => item.caseAlias)).size !== 8) findings.push('CASE_ALIAS_DUPLICATE')
  return { status: findings.length ? 'FAIL' : 'PASS', findings, identityLeakCount: findings.filter((item) => item === 'IDENTITY_TOKEN_PRESENT').length }
}

async function writeCreateOnce(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  try {
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
    throw error
  }
}

async function main() {
  const checkpointPath = path.resolve(option('checkpoint', path.join(DEFAULT_CACHE, 'generation-checkpoint.json')))
  const packetPath = path.resolve(option('packet', path.join(DEFAULT_CACHE, 'path-masked', 'reviewer-packet.json')))
  const labelsPath = path.resolve(option('labels', path.join(DEFAULT_CACHE, 'path-masked', 'labels-draft.json')))
  const revealPath = path.resolve(option('reveal-key', path.join(DEFAULT_CACHE, 'path-masked', 'reveal-key.json')))
  const auditPath = path.resolve(option('audit', path.join(DEFAULT_CACHE, 'path-masked', 'packet-audit.json')))
  const [checkpointRaw, manifestRaw, bundleRaw] = await Promise.all([
    readFile(checkpointPath, 'utf8'), readFile(MANIFEST_PATH, 'utf8'), readFile(BUNDLE_PATH, 'utf8'),
  ])
  const checkpoint = JSON.parse(checkpointRaw)
  const manifest = JSON.parse(manifestRaw)
  const bindings = assertR10ScoringInput(checkpoint, checkpointRaw, manifest, manifestRaw, bundleRaw)
  const sourceParent = JSON.parse(await readFile(path.join(ROOT, '.evaluation-cache', 'e2-9-r1', 'protocol-2.0.0', 'source-only-manifest.json'), 'utf8'))
  const sourceById = new Map(sourceParent.screeningCases.map((item) => [item.caseId, item]))
  const outputByCaseArm = new Map(checkpoint.observations.map((item) => [`${item.caseId}:${item.arm}`, item.response.payload.result]))
  const randomKey = randomBytes(32).toString('hex')
  const mapping = {}
  const cases = manifest.cases.map((item, index) => {
    const caseAlias = `C${String(index + 1).padStart(2, '0')}`
    const xArm = Number.parseInt(sha256(`${randomKey}:${caseAlias}`).slice(0, 2), 16) % 2 === 0 ? 'A' : 'B'
    const yArm = xArm === 'A' ? 'B' : 'A'
    mapping[caseAlias] = { X: xArm, Y: yArm, caseId: item.caseId }
    const source = sourceById.get(item.caseId)
    if (!source) throw new Error(`SOURCE_MISSING:${item.caseId}`)
    return {
      caseAlias,
      source: { sourceType: source.sourceType, sourceTitle: source.sourceTitle, content: source.content, referenceTime: source.referenceTime, timezone: source.timezone },
      options: { X: compactResult(outputByCaseArm.get(`${item.caseId}:${xArm}`)), Y: compactResult(outputByCaseArm.get(`${item.caseId}:${yArm}`)) },
    }
  })
  const packet = {
    schemaVersion: E2_R10_PATH_MASK_VERSION,
    packetId: `masked-${sha256(randomKey).slice(0, 20)}`,
    frozenInputBindings: bindings,
    instructions: {
      reviewerEligibility: 'Reviewer must not access the reveal key, generation checkpoint, strict scores, model/path metadata or prior conclusions before labels are frozen.',
      questions: [
        'Which option better satisfies the actual user need?',
        'Does either option omit an explicit fact?',
        'Does either option require a major user correction?',
        'Does either option contain a planning error, unsupported fact or unnecessary over-splitting?',
        'Is the visible evidence adequate for the proposed entities?',
      ],
    },
    cases,
  }
  const audit = { schemaVersion: 'e2.9-r10-path-mask-audit-1.0.0', packetSha256: sha256(JSON.stringify(packet)), ...auditMaskedPacket(packet) }
  if (audit.status !== 'PASS') throw new Error(`PATH_MASK_AUDIT_FAILED:${audit.findings.join(',')}`)
  const labels = {
    schemaVersion: 'e2.9-r10-path-mask-labels-1.0.0',
    packetId: packet.packetId,
    reviewerId: null,
    mappingAccessAttestation: null,
    frozenAt: null,
    cases: cases.map((item) => ({
      caseAlias: item.caseAlias,
      preferred: null,
      options: Object.fromEntries(['X', 'Y'].map((side) => [side, {
        userImpactMajor: null,
        factMissing: null,
        planningError: null,
        overFragmented: null,
        unsupportedFact: null,
        evidenceAdequate: null,
      }])),
      reason: null,
    })),
    allowedValues: {
      preferred: ['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'],
      yesNoUncertain: ['YES', 'NO', 'UNCERTAIN'],
      evidenceAdequate: ['YES', 'NO', 'UNCERTAIN'],
    },
  }
  const reveal = {
    schemaVersion: 'e2.9-r10-path-mask-reveal-key-1.0.0',
    packetId: packet.packetId,
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    mapping,
    revealAuthorized: false,
  }
  await Promise.all([
    writeCreateOnce(packetPath, packet),
    writeCreateOnce(labelsPath, labels),
    writeCreateOnce(revealPath, reveal),
    writeCreateOnce(auditPath, audit),
  ])
  console.log(JSON.stringify({ status: 'PATH_MASK_PACKET_READY', packetPath, packetSha256: sha256(await readFile(packetPath)), labelsPath, revealPath, auditPath, audit }, null, 2))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
