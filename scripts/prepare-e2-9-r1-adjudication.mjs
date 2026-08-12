/* global console, process */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha256 } from './e2-9-r1-hash.mjs'

const ROOT = process.cwd()
const PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'
const MASK_SEED = 'e2-9-r1-path-mask-v1'

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function allTasks(result) {
  return [...(result.standaloneTasks ?? []), ...(result.milestones ?? []).flatMap((milestone) => [...(milestone.tasks ?? []), ...(milestone.workPackages ?? []).flatMap((workPackage) => workPackage.tasks ?? [])])]
}

function project(result) {
  return {
    projectMatch: result.projectMatch,
    projectSuggestion: result.projectSuggestion,
    milestones: result.milestones,
    tasks: allTasks(result),
    materials: result.materials,
    timePoints: result.timePoints,
    events: result.events,
    ambiguities: result.ambiguities,
    evidence: result.evidence,
  }
}

function maskedOrder(caseIds) {
  return [...caseIds].sort((a, b) => sha256(`${MASK_SEED}:order:${a}`).localeCompare(sha256(`${MASK_SEED}:order:${b}`)))
}

export function xAliasFor(caseId) {
  return Number.parseInt(sha256(`${MASK_SEED}:arm:${caseId}`).slice(0, 2), 16) % 2 === 0 ? 'flash' : 'pro'
}

async function main() {
  const checkpointPath = path.resolve(ROOT, option('checkpoint'))
  const sourcePath = path.resolve(ROOT, option('source-manifest'))
  const packetPath = path.resolve(ROOT, option('packet'))
  const manifestPath = path.resolve(ROOT, option('manifest'))
  if (![checkpointPath, sourcePath, packetPath, manifestPath].every(Boolean)) throw new Error('checkpoint/source-manifest/packet/manifest are required')
  const [checkpointRaw, sourceRaw] = await Promise.all([readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8')])
  const checkpoint = JSON.parse(checkpointRaw)
  const source = JSON.parse(sourceRaw)
  if (checkpoint.protocolVersion !== PROTOCOL_VERSION || checkpoint.gateStatus !== 'COMPLETE' || checkpoint.observations.some((item) => item.status !== 'complete')) throw new Error('Complete generation is required before packet creation')
  const cases = checkpoint.phase === 'screening' ? source.screeningCases : source.selectionCases
  const byCase = new Map(checkpoint.observations.map((item) => [`${item.caseId}:${item.modelAlias}`, item]))
  const observations = maskedOrder(cases.map((item) => item.caseId)).map((caseId, index) => {
    const fixture = cases.find((item) => item.caseId === caseId)
    const xAlias = xAliasFor(caseId)
    const yAlias = xAlias === 'flash' ? 'pro' : 'flash'
    return {
      observationId: `E29R1-${checkpoint.phase.toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
      source: { sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, content: fixture.content, referenceTime: fixture.referenceTime, timezone: fixture.timezone },
      X: project(byCase.get(`${caseId}:${xAlias}`).response.payload.result),
      Y: project(byCase.get(`${caseId}:${yAlias}`).response.payload.result),
    }
  })
  const packet = {
    schemaVersion: 'e2.9-r1-path-masked-packet-1.0.0', protocolVersion: PROTOCOL_VERSION, phase: checkpoint.phase,
    forbiddenReviewerContext: ['model mapping', 'model ID', 'strict score', 'expected answer', 'caseId', 'run order', 'repository files outside this packet and label schema'],
    instructions: 'Judge only the source and X/Y outputs. Reconstruct required actions from source; preserve actor, modality, condition, deadline, channel, event/task boundary and literal evidence. Do not infer model identity.',
    observations,
  }
  const labelSchema = {
    schemaVersion: 'e2.9-r1-path-masked-labels-1.0.0',
    requiredTopLevel: ['schemaVersion', 'phase', 'labelsCompletedAt', 'reviewer', 'labels'],
    labelFields: {
      observationId: 'packet observation ID', preferred: ['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'],
      xUserImpactMajor: ['MAJOR', 'NOT_MAJOR', 'INSUFFICIENT_INFORMATION'], yUserImpactMajor: ['MAJOR', 'NOT_MAJOR', 'INSUFFICIENT_INFORMATION'],
      xPlanningError: ['YES', 'NO', 'INSUFFICIENT_INFORMATION'], yPlanningError: ['YES', 'NO', 'INSUFFICIENT_INFORMATION'],
      sourceRequiredActions: 'array of {id,description,evidence}',
      xTaskJudgments: 'array of {taskId,matchedSourceActionIds,correct,preservationChecks,rationale}', yTaskJudgments: 'same as X',
      preservationChecks: ['actionPredicate', 'object', 'actor', 'modality', 'condition', 'deadline', 'channel', 'independentCompletion', 'eventTaskBoundary', 'literalEvidence'],
      obviousDegradation: ['X', 'Y', 'NEITHER', 'INSUFFICIENT_INFORMATION'], rationale: 'source-grounded rationale', evidence: 'literal source evidence',
    },
  }
  await mkdir(path.dirname(packetPath), { recursive: true })
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8')
  const manifest = { schemaVersion: 'e2.9-r1-path-masked-packet-manifest-1.0.0', protocolVersion: PROTOCOL_VERSION, phase: checkpoint.phase, observationCount: observations.length, checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw), packetSha256: sha256(await readFile(packetPath, 'utf8')), labelSchema, mappingKeyCreated: false }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ phase: checkpoint.phase, observations: observations.length, packet: path.relative(ROOT, packetPath), packetSha256: manifest.packetSha256, manifest: path.relative(ROOT, manifestPath), mappingKeyCreated: false }, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
