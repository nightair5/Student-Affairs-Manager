import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const SCHEMA_VERSION = 'e2.7-blind-packet-1.0.0'
const SELECTION_VERSION = 'e2.7-p2-source-hash-stratified-1.0.0'
const DEFAULT_PACKET = '.evaluation-cache/e2-7/p2-user-impact-packet.json'
const DEFAULT_MANIFEST = 'docs/e2-path-a-planning/p2-blind-packet-manifest.json'
const DEFAULT_LABELS = 'docs/e2-path-a-planning/p2-user-impact-labels.json'
const DEFAULT_KEY = 'docs/e2-path-a-planning/p2-reveal-key.json'
const PER_SET = 24

const CACHE_CONTRACT = {
  golden: {
    file: 'deepseek-production-golden-g8-regression-2-4-1.json',
    sha256: 'b41145a89ea7ec170624285d396708c90dd6681d133b5e4c386a8ab438fc056c',
  },
  exposed_holdout: {
    file: 'deepseek-production-holdout-g8-regression-2-4-1.json',
    sha256: '15c14c0c709ebc0f4939a023d97af1575093b66f1fa2cb61ffbf8d7c1c83a545',
  },
  development: {
    file: 'deepseek-production-generalization-g8-after-2-4-1.json',
    sha256: '440524fcb27d07256df78ed41565170987c09069fd8b7979f5a51fa305d5a46c',
  },
}

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

function publicRecognition(result) {
  const {
    schemaVersion: _schemaVersion,
    promptVersion: _promptVersion,
    modelName: _modelName,
    createdAt: _createdAt,
    ...semanticOutput
  } = result
  return semanticOutput
}

function assertCacheEntry(entry, fixture, sourceSet) {
  if (!fixture) throw new Error(`Cache case is absent from frozen ${sourceSet} fixtures: ${entry.caseId}`)
  if (entry.status !== 'ok' || !entry.result) return false
  if (entry.provider !== 'deepseek-production') throw new Error(`Provider drift: ${entry.caseId}`)
  if (entry.result.promptVersion !== 'recognition-2.4.1') throw new Error(`Prompt drift: ${entry.caseId}`)
  if (entry.result.modelName !== 'deepseek-v4-flash') throw new Error(`Model drift: ${entry.caseId}`)
  if (entry.result.schemaVersion !== '2.0') throw new Error(`Schema drift: ${entry.caseId}`)
  if (entry.execution?.pipelineVersion !== 'recognition-pipeline-2.2.1') throw new Error(`Pipeline drift: ${entry.caseId}`)
  if (entry.execution?.validatorVersion !== 'recognition-quality-2.1.0') throw new Error(`Validator drift: ${entry.caseId}`)
  if (entry.execution?.repairVersion !== 'recognition-repair-1.1.0') throw new Error(`Repair drift: ${entry.caseId}`)
  if (entry.execution?.routerVersion !== 'recognition-router-1.1.0') throw new Error(`Router drift: ${entry.caseId}`)
  return true
}

async function main() {
  const cacheRoot = option('cache-root')
  const createdAt = option('created-at', new Date().toISOString())
  const packetRelative = option('packet', DEFAULT_PACKET).replaceAll('\\', '/')
  const manifestRelative = option('manifest', DEFAULT_MANIFEST).replaceAll('\\', '/')
  const labelsRelative = option('labels', DEFAULT_LABELS).replaceAll('\\', '/')
  const keyRelative = option('key', DEFAULT_KEY).replaceAll('\\', '/')
  const packetSchema = option('schema-version', SCHEMA_VERSION)
  const selectionVersion = option('selection-version', SELECTION_VERSION)
  const observationPrefix = option('observation-prefix', 'E2P2')
  const packetPath = path.resolve(ROOT, packetRelative)
  const manifestPath = path.resolve(ROOT, manifestRelative)
  const labelsPath = path.resolve(ROOT, labelsRelative)
  const keyPath = path.resolve(ROOT, keyRelative)
  if (!cacheRoot) throw new Error('--cache-root is required')
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('--created-at must be ISO-8601')
  if (!/^[A-Z0-9]+$/u.test(observationPrefix)) throw new Error('--observation-prefix must be uppercase alphanumeric')
  for (const [label, file] of [['packet', packetPath], ['manifest', manifestPath], ['labels', labelsPath], ['reveal key', keyPath]]) {
    if (await exists(file)) throw new Error(`${label} already exists; refusing to overwrite blind chronology: ${file}`)
  }

  const vite = await createServer({
    root: ROOT,
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
  })
  try {
    const [golden, holdout, development] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
    ])
    const fixturesBySet = {
      golden: new Map(golden.recognitionGoldenDataset.map((fixture) => [fixture.id, fixture])),
      exposed_holdout: new Map(holdout.recognitionHoldoutDataset.map((fixture) => [fixture.id, fixture])),
      development: new Map(development.recognitionGeneralizationDevelopmentDataset.map((fixture) => [fixture.id, fixture])),
    }
    const cacheProvenance = {}
    const selected = []
    for (const [sourceSet, contract] of Object.entries(CACHE_CONTRACT)) {
      const cachePath = path.resolve(cacheRoot, contract.file)
      const bytes = await readFile(cachePath)
      const observedHash = sha256(bytes)
      if (observedHash !== contract.sha256) throw new Error(`Cache hash drift for ${contract.file}: ${observedHash}`)
      const entries = JSON.parse(bytes.toString('utf8'))
      if (!Array.isArray(entries)) throw new Error(`Cache must be an array: ${contract.file}`)
      const fixtureMap = fixturesBySet[sourceSet]
      const completed = entries.flatMap((entry) => {
        const fixture = fixtureMap.get(entry.caseId)
        return assertCacheEntry(entry, fixture, sourceSet) ? [{ entry, fixture }] : []
      })
      if (completed.length < PER_SET) throw new Error(`Not enough completed ${sourceSet} rows`)
      completed.sort((left, right) => sha256(`${selectionVersion}\0${sourceSet}\0${left.fixture.rawText}`)
        .localeCompare(sha256(`${selectionVersion}\0${sourceSet}\0${right.fixture.rawText}`)))
      selected.push(...completed.slice(0, PER_SET).map(({ entry, fixture }) => ({ sourceSet, entry, fixture })))
      cacheProvenance[sourceSet] = {
        file: contract.file,
        sha256: observedHash,
        rowCount: entries.length,
        completedCount: completed.length,
        selectedCount: PER_SET,
        generationTimeBinding: 'NOT_OBSERVABLE_IN_LEGACY_CACHE',
      }
    }

    selected.sort((left, right) => sha256(`${selectionVersion}\0all\0${left.fixture.rawText}`)
      .localeCompare(sha256(`${selectionVersion}\0all\0${right.fixture.rawText}`)))
    const observations = selected.map(({ entry, fixture }, index) => {
      const recognition = publicRecognition(entry.result)
      return {
        observationId: `${observationPrefix}-${String(index + 1).padStart(3, '0')}`,
        source: {
          title: fixture.sourceTitle,
          type: fixture.sourceType,
          text: fixture.rawText,
          referenceTime: fixture.referenceTime,
          timezone: fixture.timezone,
        },
        recognition,
        resultSha256: sha256(JSON.stringify(entry.result)),
      }
    })
    const packet = {
      schemaVersion: packetSchema,
      evaluationContractVersion: 'e2.7-evaluation-contract-1.0.0',
      rubricVersion: 'e2.7-user-impact-major-1.0.0',
      createdAt,
      blindedFields: ['caseId', 'sourceSet', 'expected', 'strictScores', 'failures', 'route', 'repair', 'revealKey'],
      instructions: {
        task: 'Judge whether a real user must make a major correction and separately label every required P2 error dimension before relying on this recognition output.',
        labels: ['MAJOR', 'NOT_MAJOR', 'INSUFFICIENT_INFORMATION'],
        rubricPath: 'docs/e2-path-a-planning/P1_EVALUATION_CONTRACT.md',
        doNotInspect: ['frozen expected answers', 'case IDs', 'strict scores', 'reveal mapping'],
        requiredDimensions: ['userImpactMajor', 'planningError', 'factMissing', 'reasonableEquivalent', 'timeRoleError', 'eventTaskError', 'materialTaskError', 'ambiguityMissing'],
      },
      sampleCount: observations.length,
      observations,
    }
    const packetBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`, 'utf8')
    const manifest = {
      schemaVersion: 'e2.7-blind-packet-manifest-1.0.0',
      status: 'PACKET_FROZEN_KEY_NOT_CREATED',
      selectionVersion,
      createdAt,
      packet: {
        ignoredPath: packetRelative,
        sha256: sha256(packetBytes),
        sampleCount: observations.length,
        distribution: { golden: PER_SET, exposed_holdout: PER_SET, development: PER_SET },
        containsExpected: false,
        containsCaseId: false,
      },
      cacheProvenance,
      chronology: {
        labelsStatus: 'NOT_STARTED',
        labelsFrozenCommit: null,
        revealKeyStatus: 'NOT_CREATED',
        revealKeyPath: keyRelative,
      },
      limitations: [
        'Legacy recognition-2.4.1 caches do not contain generation-time source/input/result hashes.',
        'Cache file hashes are frozen here; per-observation source/result hashes are calculated during E2.7 packet preparation.',
      ],
    }
    await mkdir(path.dirname(packetPath), { recursive: true })
    await mkdir(path.dirname(manifestPath), { recursive: true })
    await writeFile(packetPath, packetBytes)
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    process.stdout.write(`${JSON.stringify({ packetPath, manifestPath, packetSha256: manifest.packet.sha256, sampleCount: observations.length }, null, 2)}\n`)
  } finally {
    await vite.close()
  }
}

await main()
