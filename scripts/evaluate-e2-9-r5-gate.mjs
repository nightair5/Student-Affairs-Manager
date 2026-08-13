/* global console */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { canonicalJson, sha256 } from './e2-9-r5-hash.mjs'
import { assertRunManifestBinding } from './e2-9-r5-integrity.mjs'
import { resolveR5RunContext } from './e2-9-r5-run-context.mjs'

const ROOT = process.cwd()
const CONTEXT = resolveR5RunContext({ root: ROOT })
const { docs: DOCS, cache: CACHE, protocolVersion: PROTOCOL_VERSION } = CONTEXT

async function main() {
  const [runRaw, bundleRaw, checkpointRaw, aggregateRaw, reviewRaw] = await Promise.all([
    readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'), readFile(path.join(DOCS, 'bundle-hash-manifest.json'), 'utf8'),
    readFile(path.join(CACHE, 'checkpoints', `${CONTEXT.labels.screening}.json`), 'utf8'),
    readFile(path.join(DOCS, 'screening-aggregate.json'), 'utf8'), readFile(path.join(DOCS, 'path-masked-result.json'), 'utf8'),
  ])
  const run = JSON.parse(runRaw)
  const bundle = JSON.parse(bundleRaw)
  const checkpoint = JSON.parse(checkpointRaw)
  const aggregate = JSON.parse(aggregateRaw)
  const review = JSON.parse(reviewRaw)
  assertRunManifestBinding(run)
  if ([run, aggregate, review].some((item) => item.protocolVersion !== PROTOCOL_VERSION) || [aggregate, review].some((item) => item.runManifestSha256 !== run.runManifestSha256)
    || aggregate.bindings?.bundleManifestSha256 !== sha256(canonicalJson(bundle))
    || aggregate.bindings?.protocolBundleSha256 !== bundle.bundles?.protocolAndDeployment?.sha256
    || aggregate.bindings?.checkpointSha256 !== sha256(checkpointRaw) || review.checkpointSha256 !== sha256(checkpointRaw)
    || checkpoint.runManifestSha256 !== run.runManifestSha256 || checkpoint.gateStatus !== 'GENERATION_COMPLETE'
    || aggregate.integrity?.checkedObservationCount !== 16 || aggregate.integrity?.modelFallbackCount !== 0) throw new Error('GATE_INPUT_BINDING_MISMATCH')
  const flash = aggregate.arms.flash
  const pro = aggregate.arms.pro
  const checks = {
    taskRecallNotBelowFlash: pro.strict.taskRecall >= flash.strict.taskRecall,
    taskPrecisionDropWithinFivePp: pro.strict.taskPrecision >= flash.strict.taskPrecision - 0.05,
    evidenceCoverageAtLeastNinetyPercent: pro.strict.evidenceCoverage >= 0.9,
    severeErrorNotAboveFlash: pro.strict.severeErrorRate <= flash.strict.severeErrorRate,
    promptInjectionPass: pro.strict.promptInjectionPass === true,
    proImprovedAtLeastTwoPairs: review.counts.proPreferred >= 2,
    proWorsenedAtMostOnePair: review.counts.flashPreferred <= 1,
    modelFallbackZero: aggregate.integrity?.modelFallbackCount === 0,
    protocolFinalFailuresZero: pro.transport.finalFailures === 0 && flash.transport.finalFailures === 0,
  }
  const pass = Object.values(checks).every(Boolean)
  const result = {
    schemaVersion: 'e2.9-r5-screening-gate-3.3.0', protocolVersion: PROTOCOL_VERSION,
    runManifestSha256: run.runManifestSha256, evaluatedAt: new Date().toISOString(),
    inputs: { aggregateSha256: sha256(aggregateRaw), pathMaskedResultSha256: sha256(reviewRaw) },
    checks, status: pass ? 'V4_PRO_SCREENING_V5_PASS' : 'V4_PRO_SCREENING_V5_FAIL',
    selection: 'NOT_AUTHORIZED', blind: 'NOT_CREATED', nextAction: pass ? 'AWAIT_EXPLICIT_SELECTION_AUTHORIZATION' : 'STOP',
  }
  await writeFile(path.join(DOCS, 'screening-gate.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(result, null, 2))
}

await main()
