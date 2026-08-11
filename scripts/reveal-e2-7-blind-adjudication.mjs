import { createHash } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const DEFAULT_PACKET = '.evaluation-cache/e2-7/p2-user-impact-packet.json'
const DEFAULT_MANIFEST = 'docs/e2-path-a-planning/p2-blind-packet-manifest.json'
const DEFAULT_LABELS = 'docs/e2-path-a-planning/p2-user-impact-labels.json'
const DEFAULT_KEY = 'docs/e2-path-a-planning/p2-reveal-key.json'

function option(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function exists(file) {
  try { await access(file); return true } catch { return false }
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

async function main() {
  const packetPath = path.resolve(ROOT, option('packet', DEFAULT_PACKET))
  const manifestPath = path.resolve(ROOT, option('manifest', DEFAULT_MANIFEST))
  const labelsRelative = option('labels', DEFAULT_LABELS).replaceAll('\\', '/')
  const labelsPath = path.resolve(ROOT, labelsRelative)
  const keyPath = path.resolve(ROOT, option('key', DEFAULT_KEY))
  if (await exists(keyPath)) throw new Error(`Reveal key already exists: ${keyPath}`)
  if (!await exists(labelsPath)) throw new Error('Labels must exist before reveal')
  if (git('status', '--porcelain', '--', labelsRelative)) throw new Error('Labels must be committed and clean before reveal')
  const labelsCommit = git('log', '-1', '--format=%H', '--', labelsRelative)
  if (!labelsCommit) throw new Error('Labels do not have a Git freeze commit')
  const labelsCommitTime = git('show', '-s', '--format=%aI', labelsCommit)

  const packetBytes = await readFile(packetPath)
  const labelsBytes = await readFile(labelsPath)
  const packet = JSON.parse(packetBytes.toString('utf8'))
  const labels = JSON.parse(labelsBytes.toString('utf8'))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (sha256(packetBytes) !== manifest.packet.sha256) throw new Error('Packet hash no longer matches frozen manifest')
  if (labels.packetSha256 !== manifest.packet.sha256) throw new Error('Labels are not bound to the frozen packet')
  if (labels.labels.length !== packet.observations.length) throw new Error('Label count does not match packet')

  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [golden, holdout, development] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
    ])
    const fixtures = [
      ...golden.recognitionGoldenDataset.map((fixture) => ({ sourceSet: 'golden', fixture })),
      ...holdout.recognitionHoldoutDataset.map((fixture) => ({ sourceSet: 'exposed_holdout', fixture })),
      ...development.recognitionGeneralizationDevelopmentDataset.map((fixture) => ({ sourceSet: 'development', fixture })),
    ]
    const byText = new Map(fixtures.map((entry) => [entry.fixture.rawText, entry]))
    if (byText.size !== fixtures.length) throw new Error('Frozen fixtures contain duplicate source texts; text-only reveal is ambiguous')
    const mapping = packet.observations.map((observation) => {
      const match = byText.get(observation.source.text)
      if (!match) throw new Error(`No frozen fixture matches ${observation.observationId}`)
      return {
        observationId: observation.observationId,
        caseId: match.fixture.id,
        sourceSet: match.sourceSet,
        sourceSha256: sha256(match.fixture.rawText),
        resultSha256: observation.resultSha256,
      }
    })
    const revealedAt = new Date().toISOString()
    if (Date.parse(revealedAt) <= Date.parse(labelsCommitTime)) throw new Error('Reveal time must be after the labels freeze commit')
    const key = {
      schemaVersion: 'e2.7-reveal-key-1.0.0',
      revealedAt,
      packetSha256: sha256(packetBytes),
      labelsSha256: sha256(labelsBytes),
      labelsFrozenCommit: labelsCommit,
      labelsFrozenCommitTime: labelsCommitTime,
      mapping,
    }
    await writeFile(keyPath, `${JSON.stringify(key, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    process.stdout.write(`${JSON.stringify({ keyPath, revealedAt, labelsCommit, mappingCount: mapping.length }, null, 2)}\n`)
  } finally {
    await vite.close()
  }
}

await main()
