import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { canonicalJson, sha256 } from './e2-9-r1-hash.mjs'

const HASH = /^[a-f0-9]{64}$/u

function fail(message) {
  throw new Error(`R6_DEPLOYMENT_CONTRACT_INVALID:${message}`)
}

function assertEqual(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(label)
}

export async function buildR6DeploymentProjection({ root = process.cwd() } = {}) {
  const [contract, qualification, main] = await Promise.all([
    readFile(path.join(root, 'docs', 'e2-v4-pro-benchmark-r6', 'preview-deployment-contract.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'wrangler.e2-r6-preview.jsonc'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'wrangler.jsonc'), 'utf8').then(JSON.parse),
  ])
  const preview = main.env?.preview
  if (contract.protocolVersion !== 'e2-9-v4-pro-protocol-3.5.0') fail('protocol')
  if (contract.modelPhaseRoutes !== 'locked' || contract.productionRoutes !== 'absent') fail('route-policy')
  assertEqual({
    name: qualification.name, main: qualification.main, workersDev: qualification.workers_dev,
    previewUrls: qualification.preview_urls, routes: qualification.routes,
    versionMetadataBinding: qualification.version_metadata?.binding,
  }, contract.qualificationWorker, 'qualification-worker')
  assertEqual({
    E2_R6_HARNESS_ENABLED: qualification.vars?.E2_R6_HARNESS_ENABLED,
    E2_R6_VERSIONED_PREVIEW_ONLY: qualification.vars?.E2_R6_VERSIONED_PREVIEW_ONLY,
  }, contract.qualificationFlags, 'qualification-flags')
  assertEqual(qualification.services, [{ binding: contract.ledgerServiceBinding, service: 'student-affairs-e2-r6-qualification-ledger-preview' }], 'ledger-service')
  for (const key of ['E2_R6_QUALIFICATION_BUNDLE_SHA256', 'E2_R6_QUALIFICATION_RESULT_SHA256']) {
    if (!HASH.test(qualification.vars?.[key] ?? '')) fail(`qualification-${key}`)
  }
  assertEqual({
    name: preview?.name, main: main.main, workersDev: preview?.workers_dev,
    routes: preview?.routes, versionMetadataBinding: preview?.version_metadata?.binding,
  }, contract.modelPreviewWorker, 'model-preview-worker')
  for (const key of contract.modelPreviewDisabledFlags) if (preview?.vars?.[key] !== 'false') fail(`model-preview-flag-${key}`)
  for (const key of contract.modelPreviewDisabledFlags) if (main.vars?.[key] !== undefined) fail(`production-flag-${key}`)
  if (!Array.isArray(main.routes) || main.routes.length === 0 || preview?.routes?.length !== 0) fail('route-boundary')

  const projection = {
    schemaVersion: 'e2.9-r6-deployment-projection-1.0.0',
    protocolVersion: contract.protocolVersion,
    qualification: {
      worker: contract.qualificationWorker,
      flags: contract.qualificationFlags,
      origin: qualification.vars.E2_R6_PREVIEW_ORIGIN,
      ledgerService: qualification.services[0],
      dynamicHashBindings: contract.dynamicBindings,
    },
    modelPreview: {
      worker: contract.modelPreviewWorker,
      disabledFlags: Object.fromEntries(contract.modelPreviewDisabledFlags.map((key) => [key, preview.vars[key]])),
      origin: preview.vars.E2_R6_PREVIEW_ORIGIN,
      dynamicHashBindings: contract.dynamicBindings.filter((key) => key.includes('QUALIFICATION_')),
    },
    routePolicy: { modelPhases: contract.modelPhaseRoutes, productionExperimentalRoutes: contract.productionRoutes },
    production: { experimentalFlagsAbsent: true, routeCount: main.routes.length },
  }
  return { projection, sha256: sha256(canonicalJson(projection)) }
}
