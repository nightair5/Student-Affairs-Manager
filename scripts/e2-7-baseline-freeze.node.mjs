import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const manifestPath = 'docs/e2-path-a-planning/path-a-baseline-manifest.json'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalLf(value) {
  return value.toString('utf8').replace(/\r\n?/gu, '\n')
}

function baselineFile(manifest, file) {
  return execFileSync('git', ['show', `${manifest.commit}:${file}`], { encoding: null })
}

async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'))
}

test('E2.7 baseline commit and rejected FactLedger tag are immutable', async () => {
  const manifest = await loadManifest()
  assert.equal(execFileSync('git', ['rev-parse', manifest.commit], { encoding: 'utf8' }).trim(), manifest.commit)
  assert.equal(execFileSync('git', ['rev-parse', manifest.rejectedFactLedger.tag], { encoding: 'utf8' }).trim(), manifest.rejectedFactLedger.taggedCommit)
  assert.equal(manifest.rejectedFactLedger.conclusion, 'FACTLEDGER NOT SUPPORTED')
  assert.equal(manifest.rejectedFactLedger.productionEligible, false)
})

test('all exposed E2.7 inputs retain their frozen hashes and roles', async () => {
  const manifest = await loadManifest()
  const expectedCounts = { golden: 110, exposedHoldout: 40, generalizationDevelopment: 108, e26ComplexDiagnostic: 24 }
  for (const [name, dataset] of Object.entries(manifest.datasetFreeze)) {
    const source = await readFile(dataset.sourceFile)
    assert.equal(sha256(canonicalLf(source)), dataset.canonicalLfSha256, `${name} content drift`)
    assert.equal(dataset.sampleCount, expectedCounts[name])
    assert.match(dataset.role, /^exposed-/u)
  }
  assert.equal(manifest.blindEligibility, false)
})

test('Path A baseline versions and source hashes resolve at the frozen commit', async () => {
  const manifest = await loadManifest()
  for (const [file, expectedHash] of Object.entries(manifest.baselineSourceHashes)) {
    assert.equal(sha256(baselineFile(manifest, file)), expectedHash, `${file} baseline drift`)
  }
  const expectedVersions = {
    'cloudflare/recognition-prompt.mjs': [manifest.pathA.promptVersion, manifest.pathA.model],
    'cloudflare/model-gateway.mjs': [manifest.pathA.pipelineVersion],
    'cloudflare/recognition-quality.mjs': [manifest.pathA.validatorVersion],
    'cloudflare/recognition-repair.mjs': [manifest.pathA.repairVersion, manifest.pathA.repairPatchVersion],
    'cloudflare/complexity-router.mjs': [manifest.pathA.routerVersion],
  }
  for (const [file, versions] of Object.entries(expectedVersions)) {
    const source = baselineFile(manifest, file).toString('utf8')
    for (const version of versions) assert.ok(source.includes(version), `${file} is missing ${version}`)
  }
})

test('frozen Path A baseline has no FactLedger experiment runtime endpoint', async () => {
  const manifest = await loadManifest()
  const worker = baselineFile(manifest, 'cloudflare/worker.mjs').toString('utf8')
  assert.equal(worker.includes('/api/experiments/e2-factledger'), false)
  assert.equal(manifest.preview.factLedgerEndpointPresent, false)
  assert.equal(manifest.preview.factLedgerBearerSecretPresent, false)
  assert.deepEqual(manifest.preview.routes, [])
  assert.equal(manifest.productionDeploymentPerformed, false)
})
