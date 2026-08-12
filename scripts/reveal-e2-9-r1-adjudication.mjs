/* global console, process */
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './e2-9-r1-hash.mjs'
import { xAliasFor } from './prepare-e2-9-r1-adjudication.mjs'

const ROOT = process.cwd()
const PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function allTaskIds(side) {
  return (side.tasks ?? []).map((task) => task.tempId)
}

function semanticCounts(label, sideName, side) {
  const judgments = label[`${sideName.toLowerCase()}TaskJudgments`]
  const expectedIds = new Set(label.sourceRequiredActions.map((item) => item.id))
  const actualIds = new Set(allTaskIds(side))
  if (!Array.isArray(judgments)) throw new Error(`${label.observationId} missing ${sideName} judgments`)
  const matchedExpected = new Set()
  const correctActual = new Set()
  for (const judgment of judgments) {
    if (!actualIds.has(judgment.taskId)) throw new Error(`${label.observationId} judgment task outside ${sideName}`)
    const checks = judgment.preservationChecks ?? {}
    const preserved = ['actionPredicate', 'object', 'actor', 'modality', 'condition', 'deadline', 'channel', 'independentCompletion', 'eventTaskBoundary', 'literalEvidence'].every((key) => checks[key] === true)
    if (judgment.correct && preserved) {
      correctActual.add(judgment.taskId)
      for (const id of judgment.matchedSourceActionIds ?? []) if (expectedIds.has(id)) matchedExpected.add(id)
    }
  }
  return { expected: expectedIds.size, predicted: actualIds.size, matchedExpected: matchedExpected.size, matchedActual: correctActual.size }
}

function ratio(n, d) { return d ? n / d : 1 }

async function main() {
  const packetPath = path.resolve(ROOT, option('packet'))
  const labelsPath = path.resolve(ROOT, option('labels'))
  const checkpointPath = path.resolve(ROOT, option('checkpoint'))
  const keyPath = path.resolve(ROOT, option('key'))
  const resultsPath = path.resolve(ROOT, option('results'))
  if (![packetPath, labelsPath, checkpointPath, keyPath, resultsPath].every(Boolean)) throw new Error('packet/labels/checkpoint/key/results are required')
  const [packetRaw, labelsRaw, checkpointRaw] = await Promise.all([readFile(packetPath, 'utf8'), readFile(labelsPath, 'utf8'), readFile(checkpointPath, 'utf8')])
  const packet = JSON.parse(packetRaw)
  const labels = JSON.parse(labelsRaw)
  const checkpoint = JSON.parse(checkpointRaw)
  if (packet.protocolVersion !== PROTOCOL_VERSION || checkpoint.protocolVersion !== PROTOCOL_VERSION || labels.phase !== checkpoint.phase) throw new Error('Protocol/phase mismatch')
  const committedLabels = execFileSync('git', ['show', `HEAD:${path.relative(ROOT, labelsPath).replaceAll('\\', '/')}`], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
  if (sha256(committedLabels) !== sha256(labelsRaw)) throw new Error('Labels must be committed at HEAD before reveal')
  const labelsCompletedAt = new Date(labels.labelsCompletedAt)
  if (Number.isNaN(labelsCompletedAt.getTime())) throw new Error('Invalid labelsCompletedAt')
  const caseIds = [...new Set(checkpoint.observations.map((item) => item.caseId))]
  const orderedCaseIds = [...caseIds].sort((a, b) => sha256(`e2-9-r1-path-mask-v1:order:${a}`).localeCompare(sha256(`e2-9-r1-path-mask-v1:order:${b}`)))
  const keyRevealedAt = new Date().toISOString()
  if (!(labelsCompletedAt.getTime() < new Date(keyRevealedAt).getTime())) throw new Error('labelsCompletedAt must precede keyRevealedAt')
  const mappings = orderedCaseIds.map((caseId, index) => {
    const xAlias = xAliasFor(caseId)
    return { observationId: `E29R1-${checkpoint.phase.toUpperCase()}-${String(index + 1).padStart(3, '0')}`, caseId, X: xAlias, Y: xAlias === 'flash' ? 'pro' : 'flash' }
  })
  const key = { schemaVersion: 'e2.9-r1-reveal-key-1.0.0', protocolVersion: PROTOCOL_VERSION, phase: checkpoint.phase, packetSha256: sha256(packetRaw), labelsSha256: sha256(labelsRaw), labelsCompletedAt: labels.labelsCompletedAt, keyRevealedAt, chronologyPass: true, mappings }
  const packetById = new Map(packet.observations.map((item) => [item.observationId, item]))
  const labelsById = new Map(labels.labels.map((item) => [item.observationId, item]))
  if (labelsById.size !== mappings.length) throw new Error('Labels do not cover every observation exactly once')
  const perModel = { flash: { expected: 0, predicted: 0, matchedExpected: 0, matchedActual: 0, major: 0, planning: 0, wins: 0, losses: 0, degraded: 0 }, pro: { expected: 0, predicted: 0, matchedExpected: 0, matchedActual: 0, major: 0, planning: 0, wins: 0, losses: 0, degraded: 0 } }
  for (const mapping of mappings) {
    const packetItem = packetById.get(mapping.observationId)
    const label = labelsById.get(mapping.observationId)
    if (!packetItem || !label) throw new Error(`Missing packet/label: ${mapping.observationId}`)
    for (const side of ['X', 'Y']) {
      const alias = mapping[side]
      const counts = semanticCounts(label, side, packetItem[side])
      for (const keyName of Object.keys(counts)) perModel[alias][keyName] += counts[keyName]
      if (label[`${side.toLowerCase()}UserImpactMajor`] === 'MAJOR') perModel[alias].major += 1
      if (label[`${side.toLowerCase()}PlanningError`] === 'YES') perModel[alias].planning += 1
      if (label.preferred === side) { perModel[alias].wins += 1; perModel[mapping[side === 'X' ? 'Y' : 'X']].losses += 1 }
      if (label.obviousDegradation === side) perModel[alias].degraded += 1
    }
  }
  const arms = Object.fromEntries(Object.entries(perModel).map(([alias, value]) => [alias, { semanticTaskPrecision: ratio(value.matchedActual, value.predicted), semanticTaskRecall: ratio(value.matchedExpected, value.expected), userImpactMajorCount: value.major, userImpactMajorRate: ratio(value.major, mappings.length), planningErrorCount: value.planning, planningErrorRate: ratio(value.planning, mappings.length), wins: value.wins, losses: value.losses, obviousDegradationCount: value.degraded }]))
  const results = { schemaVersion: 'e2.9-r1-path-masked-results-1.0.0', protocolVersion: PROTOCOL_VERSION, phase: checkpoint.phase, labelsCompletedAt: labels.labelsCompletedAt, keyRevealedAt, chronologyPass: true, observationCount: mappings.length, arms }
  await mkdir(path.dirname(keyPath), { recursive: true })
  await mkdir(path.dirname(resultsPath), { recursive: true })
  await writeFile(keyPath, `${JSON.stringify(key, null, 2)}\n`, 'utf8')
  await writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ phase: checkpoint.phase, chronologyPass: true, labelsSha256: key.labelsSha256, key: path.relative(ROOT, keyPath), results: path.relative(ROOT, resultsPath), arms }, null, 2))
}

await main()
