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

function counts(values) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]))
}

function humanRates(rows) {
  const determinate = rows.filter((row) => row.userImpactLabel !== 'INSUFFICIENT_INFORMATION')
  const major = determinate.filter((row) => row.userImpactLabel === 'MAJOR').length
  const insufficient = rows.length - determinate.length
  return {
    sampleCount: rows.length,
    determinateCount: determinate.length,
    majorCount: major,
    notMajorCount: determinate.length - major,
    insufficientCount: insufficient,
    primaryRateExcludingInsufficient: ratio(major, determinate.length),
    lowerBoundRate: ratio(major, rows.length),
    upperBoundRate: ratio(major + insufficient, rows.length),
  }
}

async function main() {
  const cacheRoot = option('cache-root')
  const output = option('output', 'docs/e2-path-a-planning/p2-user-impact-results.json')
  if (!cacheRoot) throw new Error('--cache-root is required')
  const packetBytes = await readFile(path.join(ROOT, '.evaluation-cache/e2-7/p2-user-impact-packet.json'))
  const labelsBytes = await readFile(path.join(ROOT, 'docs/e2-path-a-planning/p2-user-impact-labels.json'))
  const keyBytes = await readFile(path.join(ROOT, 'docs/e2-path-a-planning/p2-reveal-key.json'))
  const packet = JSON.parse(packetBytes.toString('utf8'))
  const labels = JSON.parse(labelsBytes.toString('utf8'))
  const key = JSON.parse(keyBytes.toString('utf8'))
  if (key.packetSha256 !== sha256(packetBytes) || key.labelsSha256 !== sha256(labelsBytes)) throw new Error('Blind artifact hash binding failed')

  const cacheBySet = {}
  for (const [sourceSet, file] of Object.entries(CACHE_FILES)) {
    const entries = JSON.parse(await readFile(path.resolve(cacheRoot, file), 'utf8'))
    cacheBySet[sourceSet] = new Map(entries.map((entry) => [entry.caseId, entry]))
  }
  const labelsByObservation = new Map(labels.labels.map((label) => [label.observationId, label]))
  const observationsById = new Map(packet.observations.map((observation) => [observation.observationId, observation]))

  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [golden, holdout, development, scoring] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtureById = new Map([
      ...golden.recognitionGoldenDataset,
      ...holdout.recognitionHoldoutDataset,
      ...development.recognitionGeneralizationDevelopmentDataset,
    ].map((fixture) => [fixture.id, fixture]))
    const rows = key.mapping.map((mapping) => {
      const fixture = fixtureById.get(mapping.caseId)
      const cached = cacheBySet[mapping.sourceSet]?.get(mapping.caseId)
      const label = labelsByObservation.get(mapping.observationId)
      const observation = observationsById.get(mapping.observationId)
      if (!fixture || !cached?.result || !label || !observation) throw new Error(`Incomplete revealed row: ${mapping.observationId}`)
      if (sha256(fixture.rawText) !== mapping.sourceSha256) throw new Error(`Source hash drift: ${mapping.observationId}`)
      if (sha256(JSON.stringify(cached.result)) !== mapping.resultSha256 || observation.resultSha256 !== mapping.resultSha256) {
        throw new Error(`Result hash drift: ${mapping.observationId}`)
      }
      const rescored = scoring.scoreRecognitionCase(fixture, 'deepseek-production', cached.result, cached.latencyMs, {
        tokenUsage: cached.tokenUsage,
        costUsd: cached.costUsd,
      })
      return {
        observationId: mapping.observationId,
        sourceSet: mapping.sourceSet,
        userImpactLabel: label.label,
        userImpactReasons: label.reasons,
        strictMajorCorrection: rescored.scores.majorCorrection,
        strictSevereError: rescored.scores.severeError,
      }
    })
    const determinate = rows.filter((row) => row.userImpactLabel !== 'INSUFFICIENT_INFORMATION')
    const confusion = {
      truePositive: determinate.filter((row) => row.strictMajorCorrection && row.userImpactLabel === 'MAJOR').length,
      falsePositive: determinate.filter((row) => row.strictMajorCorrection && row.userImpactLabel === 'NOT_MAJOR').length,
      falseNegative: determinate.filter((row) => !row.strictMajorCorrection && row.userImpactLabel === 'MAJOR').length,
      trueNegative: determinate.filter((row) => !row.strictMajorCorrection && row.userImpactLabel === 'NOT_MAJOR').length,
    }
    const result = {
      schemaVersion: 'e2.7-p2-user-impact-results-1.0.0',
      status: 'ROUND1_USER_IMPACT_ONLY_INCOMPLETE_FOR_P2_GATE',
      scorer: {
        strict: 'recognition-e2-scoring@70dd976-rescored',
        userImpact: 'e2.7-user-impact-major-1.0.0-independent-blind',
      },
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
        ...humanRates(rows),
        strictMajorCount: rows.filter((row) => row.strictMajorCorrection).length,
        strictMajorRate: ratio(rows.filter((row) => row.strictMajorCorrection).length, rows.length),
        strictSevereCount: rows.filter((row) => row.strictSevereError).length,
        confusion,
        strictAsUserImpactPrecision: ratio(confusion.truePositive, confusion.truePositive + confusion.falsePositive),
        strictAsUserImpactRecall: ratio(confusion.truePositive, confusion.truePositive + confusion.falseNegative),
      },
      bySourceSet: Object.fromEntries(Object.keys(CACHE_FILES).map((sourceSet) => {
        const subset = rows.filter((row) => row.sourceSet === sourceSet)
        return [sourceSet, {
          ...humanRates(subset),
          strictMajorCount: subset.filter((row) => row.strictMajorCorrection).length,
          strictMajorRate: ratio(subset.filter((row) => row.strictMajorCorrection).length, subset.length),
        }]
      })),
      userImpactReasonCounts: counts(rows.flatMap((row) => row.userImpactReasons)),
      disagreements: {
        strictMajorHumanNotMajor: rows.filter((row) => row.strictMajorCorrection && row.userImpactLabel === 'NOT_MAJOR').map((row) => row.observationId),
        strictNotMajorHumanMajor: rows.filter((row) => !row.strictMajorCorrection && row.userImpactLabel === 'MAJOR').map((row) => row.observationId),
        insufficient: rows.filter((row) => row.userImpactLabel === 'INSUFFICIENT_INFORMATION').map((row) => row.observationId),
      },
      limitations: [
        'The 72 sources come from already exposed diagnostic datasets and are not a new Blind Set.',
        'The reviewer was blind to expected answers and strict scores; the primary rate excludes INSUFFICIENT_INFORMATION and bounds are also reported.',
        'Legacy cache generation-time source/input/result hash binding is unavailable; E2.7 binds frozen cache files and recomputed per-observation hashes after generation.',
        'Round 1 labels did not include all separately required P2 dimensions (Planning Error, Fact Missing, Reasonable Equivalent, Time Role, Event/Task, Material/Task, Ambiguity Missing), so this round cannot satisfy the complete P2 gate.',
      ],
    }
    await writeFile(path.resolve(ROOT, output), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    process.stdout.write(`${JSON.stringify(result.totals, null, 2)}\n`)
  } finally {
    await vite.close()
  }
}

await main()
