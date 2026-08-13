/* global console */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './e2-9-r3-hash.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r3')
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.1.0'

async function main() {
  const [runRaw, aggregateRaw, reviewRaw] = await Promise.all([
    readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'), readFile(path.join(DOCS, 'screening-aggregate.json'), 'utf8'), readFile(path.join(DOCS, 'path-masked-result.json'), 'utf8'),
  ])
  const run = JSON.parse(runRaw)
  const aggregate = JSON.parse(aggregateRaw)
  const review = JSON.parse(reviewRaw)
  if ([run, aggregate, review].some((item) => item.protocolVersion !== PROTOCOL_VERSION) || [aggregate, review].some((item) => item.runManifestSha256 !== run.runManifestSha256)) throw new Error('GATE_INPUT_BINDING_MISMATCH')
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
    schemaVersion: 'e2.9-r3-screening-gate-3.1.0', protocolVersion: PROTOCOL_VERSION,
    runManifestSha256: run.runManifestSha256, evaluatedAt: new Date().toISOString(),
    inputs: { aggregateSha256: sha256(aggregateRaw), pathMaskedResultSha256: sha256(reviewRaw) },
    checks, status: pass ? 'V4_PRO_SCREENING_V3_PASS' : 'V4_PRO_SCREENING_V3_FAIL',
    selection: pass ? 'AWAITING_APPROVAL' : 'NOT_RUN', blind: 'NOT_CREATED',
  }
  await writeFile(path.join(DOCS, 'screening-gate.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(result, null, 2))
}

await main()
