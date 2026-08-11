import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const CACHE_FILES = {
  golden: 'deepseek-production-golden-g8-regression-2-4-1.json',
  exposed_holdout: 'deepseek-production-holdout-g8-regression-2-4-1.json',
  development: 'deepseek-production-generalization-g8-after-2-4-1.json',
}
const DIMENSIONS = ['planningError', 'factMissing', 'reasonableEquivalent', 'timeRoleError', 'eventTaskError', 'materialTaskError', 'ambiguityMissing', 'taskGroupingEquivalent', 'milestoneAliasOnly']

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null
}

function distribution(rows, field) {
  return Object.fromEntries([...new Set(rows.map((row) => row[field]))].sort().map((value) => [value, rows.filter((row) => row[field] === value).length]))
}

async function main() {
  const cacheRoot = option('cache-root')
  const output = option('output', 'docs/e2-path-a-planning/p2b-full-results.json')
  if (!cacheRoot) throw new Error('--cache-root is required')
  const packetBytes = await readFile(path.join(ROOT, '.evaluation-cache/e2-7/p2b-full-packet.json'))
  const labelsBytes = await readFile(path.join(ROOT, 'docs/e2-path-a-planning/p2b-full-labels.json'))
  const keyBytes = await readFile(path.join(ROOT, 'docs/e2-path-a-planning/p2b-reveal-key.json'))
  const packet = JSON.parse(packetBytes.toString('utf8'))
  const labels = JSON.parse(labelsBytes.toString('utf8'))
  const key = JSON.parse(keyBytes.toString('utf8'))
  if (key.packetSha256 !== sha256(packetBytes) || key.labelsSha256 !== sha256(labelsBytes)) throw new Error('P2B hash binding failed')

  const cacheBySet = {}
  for (const [sourceSet, file] of Object.entries(CACHE_FILES)) {
    const entries = JSON.parse(await readFile(path.resolve(cacheRoot, file), 'utf8'))
    cacheBySet[sourceSet] = new Map(entries.map((entry) => [entry.caseId, entry]))
  }
  const labelsById = new Map(labels.labels.map((label) => [label.observationId, label]))
  const observationsById = new Map(packet.observations.map((observation) => [observation.observationId, observation]))

  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [golden, holdout, development, scoring] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtures = new Map([
      ...golden.recognitionGoldenDataset,
      ...holdout.recognitionHoldoutDataset,
      ...development.recognitionGeneralizationDevelopmentDataset,
    ].map((fixture) => [fixture.id, fixture]))
    const rows = key.mapping.map((mapping) => {
      const fixture = fixtures.get(mapping.caseId)
      const cached = cacheBySet[mapping.sourceSet]?.get(mapping.caseId)
      const label = labelsById.get(mapping.observationId)
      const observation = observationsById.get(mapping.observationId)
      if (!fixture || !cached?.result || !label || !observation) throw new Error(`Incomplete row: ${mapping.observationId}`)
      if (sha256(fixture.rawText) !== mapping.sourceSha256) throw new Error(`Source hash drift: ${mapping.observationId}`)
      if (sha256(JSON.stringify(cached.result)) !== mapping.resultSha256 || observation.resultSha256 !== mapping.resultSha256) throw new Error(`Result hash drift: ${mapping.observationId}`)
      const rescored = scoring.scoreRecognitionCase(fixture, 'deepseek-production', cached.result, cached.latencyMs, { tokenUsage: cached.tokenUsage, costUsd: cached.costUsd })
      return {
        observationId: mapping.observationId,
        sourceSet: mapping.sourceSet,
        userImpactMajor: label.userImpactMajor,
        ...Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, label[dimension]])),
        strictMajor: rescored.scores.majorCorrection,
        strictSevere: rescored.scores.severeError,
        taskRecallError: rescored.scores.taskTruePositive < rescored.scores.taskExpected,
        milestoneStructuralError: rescored.scores.milestoneTruePositive < rescored.scores.milestoneExpected
          || rescored.scores.milestonePredicted > rescored.scores.milestoneTruePositive,
      }
    })
    const determinate = rows.filter((row) => row.userImpactMajor !== 'INSUFFICIENT_INFORMATION')
    const confusion = {
      truePositive: determinate.filter((row) => row.strictMajor && row.userImpactMajor === 'MAJOR').length,
      falsePositive: determinate.filter((row) => row.strictMajor && row.userImpactMajor === 'NOT_MAJOR').length,
      falseNegative: determinate.filter((row) => !row.strictMajor && row.userImpactMajor === 'MAJOR').length,
      trueNegative: determinate.filter((row) => !row.strictMajor && row.userImpactMajor === 'NOT_MAJOR').length,
    }
    const strictMajors = determinate.filter((row) => row.strictMajor)
    const taskRecallErrors = rows.filter((row) => row.taskRecallError)
    const milestoneErrors = rows.filter((row) => row.milestoneStructuralError)
    const gate = {
      strictMajorFalsePositiveCount: confusion.falsePositive,
      strictMajorFalseDiscoveryRate: ratio(confusion.falsePositive, confusion.truePositive + confusion.falsePositive),
      strictMajorFalsePositiveRateAcrossHumanNotMajor: ratio(confusion.falsePositive, confusion.falsePositive + confusion.trueNegative),
      taskRecallErrorCount: taskRecallErrors.length,
      taskRecallErrorsWithEquivalentGrouping: taskRecallErrors.filter((row) => row.taskGroupingEquivalent === 'YES').length,
      taskRecallEquivalentGroupingShare: ratio(taskRecallErrors.filter((row) => row.taskGroupingEquivalent === 'YES').length, taskRecallErrors.length),
      milestoneStructuralErrorCount: milestoneErrors.length,
      milestoneErrorsAliasOnly: milestoneErrors.filter((row) => row.milestoneAliasOnly === 'YES').length,
      milestoneAliasOnlyShare: ratio(milestoneErrors.filter((row) => row.milestoneAliasOnly === 'YES').length, milestoneErrors.length),
      genuineFactMissingCount: rows.filter((row) => row.factMissing === 'YES').length,
      genuineFactMissingRate: ratio(rows.filter((row) => row.factMissing === 'YES').length, rows.length),
      factFoundPlanningWrongCount: rows.filter((row) => row.planningError === 'YES' && row.factMissing === 'NO').length,
      factFoundPlanningWrongRate: ratio(rows.filter((row) => row.planningError === 'YES' && row.factMissing === 'NO').length, rows.length),
      strictMajorsReasonableEquivalentCount: strictMajors.filter((row) => row.reasonableEquivalent === 'YES').length,
      strictMajorsReasonableEquivalentShare: ratio(strictMajors.filter((row) => row.reasonableEquivalent === 'YES').length, strictMajors.length),
      evaluationContractMustBeCalibratedBeforeModel: ratio(strictMajors.filter((row) => row.reasonableEquivalent === 'YES').length, strictMajors.length) > 0.25,
    }
    const result = {
      schemaVersion: 'e2.7-p2b-full-results-1.0.0',
      status: 'COMPLETE_EXPOSED_DIAGNOSTIC_ONLY',
      reviewer: labels.reviewer,
      provenance: {
        packetSha256: sha256(packetBytes),
        labelsSha256: sha256(labelsBytes),
        revealKeySha256: sha256(keyBytes),
        labelsFrozenCommit: key.labelsFrozenCommit,
        labelsFrozenCommitTime: key.labelsFrozenCommitTime,
        revealedAt: key.revealedAt,
        chronologyValid: Date.parse(key.revealedAt) > Date.parse(key.labelsFrozenCommitTime),
      },
      totals: {
        sampleCount: rows.length,
        determinateCount: determinate.length,
        userImpactMajorCount: determinate.filter((row) => row.userImpactMajor === 'MAJOR').length,
        userImpactMajorRate: ratio(determinate.filter((row) => row.userImpactMajor === 'MAJOR').length, determinate.length),
        strictMajorCount: rows.filter((row) => row.strictMajor).length,
        strictMajorRate: ratio(rows.filter((row) => row.strictMajor).length, rows.length),
        strictSevereCount: rows.filter((row) => row.strictSevere).length,
        confusion,
        strictMajorPrecisionAgainstUserImpact: ratio(confusion.truePositive, confusion.truePositive + confusion.falsePositive),
        strictMajorRecallAgainstUserImpact: ratio(confusion.truePositive, confusion.truePositive + confusion.falseNegative),
      },
      labelDistributions: {
        userImpactMajor: distribution(rows, 'userImpactMajor'),
        ...Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, distribution(rows, dimension)])),
      },
      p2Gate: gate,
      bySourceSet: Object.fromEntries(Object.keys(CACHE_FILES).map((sourceSet) => {
        const subset = rows.filter((row) => row.sourceSet === sourceSet)
        return [sourceSet, {
          sampleCount: subset.length,
          userImpactMajorCount: subset.filter((row) => row.userImpactMajor === 'MAJOR').length,
          strictMajorCount: subset.filter((row) => row.strictMajor).length,
          planningErrorCount: subset.filter((row) => row.planningError === 'YES').length,
          factMissingCount: subset.filter((row) => row.factMissing === 'YES').length,
          reasonableEquivalentCount: subset.filter((row) => row.reasonableEquivalent === 'YES').length,
        }]
      })),
      limitations: [
        'All 72 sources are already exposed diagnostic data; P2B calibrates evaluation but is not new Blind generalization evidence.',
        'The independent reviewer was an isolated Codex reviewer, not an external human research participant.',
        'Legacy generation-time per-observation hashes are unavailable; frozen cache hashes and post-generation source/result bindings are verified.',
        'Task grouping and milestone alias proportions are reviewer judgments against source/output, not automatic edits to expected answers.',
      ],
    }
    await writeFile(path.resolve(ROOT, output), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    process.stdout.write(`${JSON.stringify({ totals: result.totals, p2Gate: result.p2Gate }, null, 2)}\n`)
  } finally {
    await vite.close()
  }
}

await main()
