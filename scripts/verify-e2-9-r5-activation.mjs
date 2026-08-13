/* global console */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { assertR5ActivationBinding, assertRunManifestBinding } from './e2-9-r5-integrity.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r5')
const [runRaw, bundleRaw, activationRaw] = await Promise.all([
  readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'),
  readFile(path.join(DOCS, 'bundle-hash-manifest.json'), 'utf8'),
  readFile(path.join(DOCS, 'preview-activation.json'), 'utf8'),
])
const run = JSON.parse(runRaw)
const bundle = JSON.parse(bundleRaw)
const activation = JSON.parse(activationRaw)
assertRunManifestBinding(run)
assertR5ActivationBinding(activation, run, bundle.bundles.protocolAndDeployment.sha256)
console.log(JSON.stringify({ status: 'PASS', runId: run.runId, runLabel: run.runLabel, mainDeploymentVersion: activation.mainDeploymentVersion, ledgerDeploymentVersion: activation.ledgerDeploymentVersion }, null, 2))
