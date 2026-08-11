import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const OUTPUT = '.evaluation-cache/e2-7/p3-planning-audit-packet.json'
const MANIFEST = 'docs/e2-path-a-planning/p3-planning-audit-manifest.json'
const SELECTION_VERSION = 'e2.7-p3-planning-failure-stratified-1.0.0'
const PER_SET = 20
const CACHE_FILES = {
  golden: 'deepseek-production-golden-g8-regression-2-4-1.json',
  exposed_holdout: 'deepseek-production-holdout-g8-regression-2-4-1.json',
  development: 'deepseek-production-generalization-g8-after-2-4-1.json',
}
const CACHE_HASHES = {
  golden: 'b41145a89ea7ec170624285d396708c90dd6681d133b5e4c386a8ab438fc056c',
  exposed_holdout: '15c14c0c709ebc0f4939a023d97af1575093b66f1fa2cb61ffbf8d7c1c83a545',
  development: '440524fcb27d07256df78ed41565170987c09069fd8b7979f5a51fa305d5a46c',
}
const PLANNING_FAILURES = new Set([
  'milestone_missing', 'milestone_spurious', 'task_missing', 'task_spurious', 'task_hierarchy',
  'material_missing', 'material_spurious', 'time_missing', 'time_incorrect', 'time_spurious',
  'event_missing', 'event_spurious', 'ambiguity_missing', 'ambiguity_spurious', 'duplicate',
  'over_fragmentation', 'project_decision',
])

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function exists(file) {
  try { await access(file); return true } catch { return false }
}

function allTasks(result) {
  return [
    ...result.standaloneTasks,
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks,
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
    ]),
  ]
}

function expectedSummary(fixture) {
  return {
    project: fixture.expected.project,
    milestones: fixture.expected.milestones,
    tasks: fixture.expected.tasks,
    materials: fixture.expected.materials,
    timePoints: fixture.expected.timePoints,
    events: fixture.expected.events,
    ambiguities: fixture.expected.ambiguities,
    evidence: fixture.expected.evidence,
  }
}

function predictionSummary(result) {
  return {
    project: {
      decision: result.projectMatch.decision,
      title: result.projectSuggestion?.title.value ?? result.projectMatch.suggestedProjectTitle,
    },
    milestones: result.milestones.map((milestone) => ({
      tempId: milestone.tempId,
      title: milestone.title,
      taskIds: [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)].map((task) => task.tempId),
    })),
    tasks: allTasks(result).map((task) => ({
      tempId: task.tempId,
      parentTempId: task.parentTempId,
      hierarchyType: task.hierarchyType,
      title: task.title,
      actionVerb: task.actionVerb,
      actionObject: task.actionObject,
      materialTempIds: task.materialTempIds,
      timePointTempIds: task.timePointTempIds,
      evidenceIds: task.evidenceIds,
    })),
    materials: result.materials.map((material) => ({
      tempId: material.tempId,
      name: material.name,
      required: material.required,
      submissionChannel: material.submissionChannel,
      relatedTaskTempIds: material.relatedTaskTempIds,
      evidenceIds: material.evidenceIds,
    })),
    timePoints: result.timePoints.map((timePoint) => ({
      tempId: timePoint.tempId,
      type: timePoint.type,
      rawText: timePoint.rawText,
      normalizedValue: timePoint.normalizedValue,
      precision: timePoint.precision,
      needsConfirmation: timePoint.needsConfirmation,
      relatedTaskTempIds: timePoint.relatedTaskTempIds,
      evidenceIds: timePoint.evidenceIds,
    })),
    events: result.events.map((event) => ({
      tempId: event.tempId,
      title: event.title,
      startTimePointTempId: event.startTimePointTempId,
      endTimePointTempId: event.endTimePointTempId,
      location: event.location,
      evidenceIds: event.evidenceIds,
    })),
    ambiguities: result.ambiguities,
    evidence: result.evidence.map((evidence) => ({ id: evidence.id, quote: evidence.quotedText ?? evidence.quote })),
  }
}

async function main() {
  const cacheRoot = option('cache-root')
  if (!cacheRoot) throw new Error('--cache-root is required')
  const outputPath = path.resolve(ROOT, OUTPUT)
  const manifestPath = path.resolve(ROOT, MANIFEST)
  if (await exists(outputPath) || await exists(manifestPath)) throw new Error('P3 packet or manifest already exists; refusing overwrite')
  const createdAt = new Date().toISOString()
  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [golden, holdout, development, scoring] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtureBySet = {
      golden: new Map(golden.recognitionGoldenDataset.map((fixture) => [fixture.id, fixture])),
      exposed_holdout: new Map(holdout.recognitionHoldoutDataset.map((fixture) => [fixture.id, fixture])),
      development: new Map(development.recognitionGeneralizationDevelopmentDataset.map((fixture) => [fixture.id, fixture])),
    }
    const cacheProvenance = {}
    const selected = []
    for (const [sourceSet, file] of Object.entries(CACHE_FILES)) {
      const cacheBytes = await readFile(path.resolve(cacheRoot, file))
      if (sha256(cacheBytes) !== CACHE_HASHES[sourceSet]) throw new Error(`Cache hash drift: ${sourceSet}`)
      const entries = JSON.parse(cacheBytes.toString('utf8'))
      const candidates = entries.flatMap((entry) => {
        const fixture = fixtureBySet[sourceSet].get(entry.caseId)
        if (!fixture || entry.status !== 'ok' || !entry.result) return []
        if (entry.result.promptVersion !== 'recognition-2.4.1' || entry.result.modelName !== 'deepseek-v4-flash') throw new Error(`Path A drift: ${entry.caseId}`)
        const rescored = scoring.scoreRecognitionCase(fixture, 'deepseek-production', entry.result, entry.latencyMs, { tokenUsage: entry.tokenUsage, costUsd: entry.costUsd })
        const planningFailures = rescored.failures.filter((failure) => PLANNING_FAILURES.has(failure.category))
        if (planningFailures.length === 0) return []
        const severityWeight = planningFailures.reduce((sum, failure) => sum + ({ minor: 1, major: 3, severe: 9 }[failure.severity] ?? 0), 0)
        return [{ entry, fixture, rescored, planningFailures, severityWeight }]
      })
      candidates.sort((left, right) => right.severityWeight - left.severityWeight
        || right.planningFailures.length - left.planningFailures.length
        || sha256(`${SELECTION_VERSION}\0${sourceSet}\0${left.fixture.rawText}`).localeCompare(sha256(`${SELECTION_VERSION}\0${sourceSet}\0${right.fixture.rawText}`)))
      if (candidates.length < PER_SET) throw new Error(`Not enough planning failures in ${sourceSet}: ${candidates.length}`)
      selected.push(...candidates.slice(0, PER_SET).map((candidate) => ({ ...candidate, sourceSet })))
      cacheProvenance[sourceSet] = { file, sha256: CACHE_HASHES[sourceSet], rowCount: entries.length, planningFailureCandidates: candidates.length, selectedCount: PER_SET }
    }
    selected.sort((left, right) => left.sourceSet.localeCompare(right.sourceSet) || left.fixture.id.localeCompare(right.fixture.id))
    const rows = selected.map(({ entry, fixture, rescored, planningFailures, sourceSet }) => ({
      caseId: fixture.id,
      sourceSet,
      source: {
        title: fixture.sourceTitle,
        type: fixture.sourceType,
        text: fixture.rawText,
        referenceTime: fixture.referenceTime,
        timezone: fixture.timezone,
        sha256: sha256(fixture.rawText),
      },
      expected: expectedSummary(fixture),
      prediction: predictionSummary(entry.result),
      predictionSha256: sha256(JSON.stringify(entry.result)),
      strict: {
        failures: rescored.failures,
        planningFailures,
        scores: rescored.scores,
      },
      pipelineObservation: {
        route: entry.route,
        repair: entry.repair ? {
          attempted: entry.repair.attempted,
          applied: entry.repair.applied,
          errorCode: entry.repair.errorCode,
          issueCodes: entry.repair.issueCodes,
          changedFields: entry.repair.changedFields,
          beforeScores: entry.repair.beforeScores,
          beforeValidation: entry.repair.beforeValidation,
          afterValidation: entry.repair.afterValidation,
        } : null,
      },
    }))
    const packet = {
      schemaVersion: 'e2.7-p3-planning-audit-packet-1.0.0',
      createdAt,
      selectionVersion: SELECTION_VERSION,
      sampleCount: rows.length,
      distribution: { golden: PER_SET, exposed_holdout: PER_SET, development: PER_SET },
      allowedCategories: [
        'FACT_MISSING', 'FACT_PRESENT_PLANNING_WRONG', 'TASK_OVER_SPLIT', 'TASK_OVER_MERGED', 'TASK_FALSE_POSITIVE', 'TASK_MISSING',
        'MATERIAL_TASK_CONFUSION', 'EVENT_TASK_CONFUSION', 'WRONG_TIME_ROLE', 'WRONG_TIME_VALUE', 'MISSING_AMBIGUITY', 'WRONG_MILESTONE',
        'MILESTONE_ALIAS_ONLY', 'REASONABLE_EQUIVALENT_STRUCTURE', 'VALIDATOR_MISSED', 'REPAIR_HARM', 'ROUTER_UNDER_ROUTED',
        'ROUTER_OVER_ROUTED', 'EVALUATION_MISMATCH',
      ],
      rows,
    }
    const packetBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`, 'utf8')
    const manifest = {
      schemaVersion: 'e2.7-p3-planning-audit-manifest-1.0.0',
      status: 'PACKET_FROZEN_AUDIT_NOT_STARTED',
      createdAt,
      selectionVersion: SELECTION_VERSION,
      packet: { ignoredPath: OUTPUT, sha256: sha256(packetBytes), sampleCount: rows.length, distribution: packet.distribution },
      cacheProvenance,
      expectedPolicy: 'READ_ONLY_NEVER_MODIFY',
      promptModificationAllowed: false,
    }
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, packetBytes)
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    process.stdout.write(`${JSON.stringify({ packetSha256: manifest.packet.sha256, sampleCount: rows.length, candidates: Object.fromEntries(Object.entries(cacheProvenance).map(([set, value]) => [set, value.planningFailureCandidates])) }, null, 2)}\n`)
  } finally {
    await vite.close()
  }
}

await main()
