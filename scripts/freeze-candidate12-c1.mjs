import {build} from 'esbuild'
import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {pathToFileURL} from 'node:url'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

const OUTPUT = 'docs/recognition-optimization/candidate12/c1-freeze/FREEZE.json'
const B1_MANIFEST = 'docs/recognition-optimization/candidate11/b1-preparation/MANIFEST.json'
const B2_ANALYSIS = 'docs/recognition-optimization/candidate11/b2-development-20260921a/ANALYSIS.json'
const B2_EXECUTION = 'docs/recognition-optimization/candidate11/b2-development-20260921a/EXECUTION_LEDGER.json'
const AUTHORITY_LEDGER = resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const EXPECTED = {
  b1: 'af1f1d2427eec1795691e1d4a62056a614bac72f0254103667632b341794744e',
  ledger: '2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e',
  ledgerRows: 693,
  ledgerTail: '13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd',
}
const COMPONENTS = [
  'src/experiments/realInput01/candidate12.ts',
  'src/experiments/realInput01/candidate12.test.ts',
  'src/experiments/realInput01/candidate03.ts',
  'src/experiments/realInput01/modelWire.ts',
  'src/experiments/mainline04/semanticContract.ts',
  'scripts/score-candidate11-recognition.mjs',
  'scripts/freeze-candidate12-c1.mjs',
]

const hash = value => createHash('sha256').update(value).digest('hex')
const check = (value, code) => { if (!value) throw Error(code) }
const json = value => JSON.stringify(value, null, 2) + '\n'

async function loadApi(root) {
  const bundled = await build({stdin: {contents: `
    export {buildCandidate12Request,CANDIDATE12_VERSION,CANDIDATE12_STATUS,CANDIDATE12_RULE_IDS} from './src/experiments/realInput01/candidate12.ts';
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
  `, resolveDir: root, loader: 'ts'}, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent'})
  return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
}

export async function buildCandidate12Freeze(root = process.cwd(), generatedAt = new Date().toISOString()) {
  const componentHashes = Object.fromEntries(COMPONENTS.map(path => [path, hash(readFileSync(resolve(root, path)))]))
  const b1Bytes = readFileSync(resolve(root, B1_MANIFEST))
  const b2AnalysisBytes = readFileSync(resolve(root, B2_ANALYSIS))
  const b2ExecutionBytes = readFileSync(resolve(root, B2_EXECUTION))
  const b2Analysis = JSON.parse(b2AnalysisBytes)
  const b2Execution = JSON.parse(b2ExecutionBytes)
  const ledgerBytes = readFileSync(AUTHORITY_LEDGER)
  const ledgerRows = ledgerBytes.toString('utf8').trimEnd().split('\n').map(JSON.parse)
  const protection = verifyProtectedFiles(root)
  check(hash(b1Bytes) === EXPECTED.b1, 'B1_MANIFEST_DRIFT')
  check(b2Analysis.decision === 'REJECT_CANDIDATE11' && b2Analysis.operational.actualCalls === 24, 'B2_ANALYSIS_DRIFT')
  check(b2Execution.units.length === 24 && b2Execution.units.every(unit => unit.settlement.status === 'settled'), 'B2_EXECUTION_DRIFT')
  check(ledgerRows.length === EXPECTED.ledgerRows && hash(ledgerBytes) === EXPECTED.ledger && ledgerRows.at(-1).hash === EXPECTED.ledgerTail, 'AUTHORITY_LEDGER_DRIFT')
  check(protection.count === 84, 'PROTECTED_FILES_DRIFT')

  const api = await loadApi(root)
  const source = '请完成候选冻结检查。'
  const context = {index: await api.indexImmutableScopesV11('c12-freeze', 'c12-freeze-v1', source), referenceTime: '2026-09-21T19:00:00+08:00', timezone: 'Asia/Shanghai'}
  const first = await api.buildCandidate12Request(context)
  const second = await api.buildCandidate12Request(context)
  check(first.serialized === second.serialized && isDeepStrictEqual(first.metadata, second.metadata), 'CANDIDATE12_NONDETERMINISTIC')
  check(first.metadata.quality === 'ENGINEERING_FROZEN_MODEL_NOT_RUN' && first.metadata.exampleVersion === null, 'CANDIDATE12_STATUS')
  const candidateBundleSha = hash(json({componentHashes, candidateVersion: first.metadata.candidateVersion, promptSha: first.metadata.promptSha,
    schemaSha: first.metadata.schemaSha, ruleIds: first.metadata.ruleIds, modelConfig: first.metadata.modelConfig}))
  return {
    version: 'candidate12-c1-development-freeze-1.0.0',
    status: 'CANDIDATE12_ENGINEERING_FROZEN_MODEL_NOT_RUN',
    generatedAt,
    candidateVersion: first.metadata.candidateVersion,
    promptVersion: first.metadata.promptVersion,
    ruleIds: first.metadata.ruleIds,
    modelConfig: first.metadata.modelConfig,
    promptSha: first.metadata.promptSha,
    exampleSha: first.metadata.exampleSha,
    schemaSha: first.metadata.schemaSha,
    freezeProbeRequestSha: first.metadata.requestSha,
    freezeProbeRequestBytes: Buffer.byteLength(first.serialized),
    candidateBundleSha,
    componentHashes,
    evidence: {
      b1ManifestSha: hash(b1Bytes),
      b2AnalysisSha: hash(b2AnalysisBytes),
      b2ExecutionSha: hash(b2ExecutionBytes),
      b2Decision: b2Analysis.decision,
      b2Calls: b2Analysis.operational.actualCalls,
      protectedFiles: protection.count,
      authorityLedger: {path: AUTHORITY_LEDGER, rows: ledgerRows.length, bytes: ledgerBytes.length, sha256: hash(ledgerBytes), tail: ledgerRows.at(-1).hash},
    },
    independence: {
      sourceOfChanges: 'B2_SEEN_DEVELOPMENT_ERROR_FAMILIES_ONLY',
      holdoutSourcesObserved: 0,
      holdoutExpectedObserved: 0,
      independentHumanLabelsObserved: 0,
    },
    operations: {modelCalls: 0, secretReads: 0, ledgerWrites: 0, grants: 0, reserves: 0, settlements: 0},
    prohibitions: ['MODEL_DISPATCH', 'SECRET_READ', 'LEDGER_WRITE', 'HOLDOUT_EXPECTED_AUTHORING_BY_AGENT', 'DEFAULT_CANDIDATE_CHANGE', 'MERGE', 'DEPLOY'],
  }
}

export async function writeCandidate12Freeze(root = process.cwd()) {
  const output = await buildCandidate12Freeze(root)
  const target = resolve(root, OUTPUT)
  mkdirSync(dirname(target), {recursive: true})
  writeFileSync(target, json(output), {flag: 'wx'})
  return output
}

export async function verifyCandidate12Freeze(root = process.cwd()) {
  const target = resolve(root, OUTPUT)
  check(existsSync(target), 'CANDIDATE12_FREEZE_MISSING')
  const frozen = JSON.parse(readFileSync(target, 'utf8'))
  const rebuilt = await buildCandidate12Freeze(root, frozen.generatedAt)
  check(json(rebuilt) === readFileSync(target, 'utf8'), 'CANDIDATE12_FREEZE_DRIFT')
  return rebuilt
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  check(args.length === 1 && ['--write', '--verify'].includes(args[0]), 'ARGUMENT')
  const result = args[0] === '--write' ? await writeCandidate12Freeze() : await verifyCandidate12Freeze()
  console.log(JSON.stringify({status: result.status, candidateVersion: result.candidateVersion, candidateBundleSha: result.candidateBundleSha,
    modelCalls: result.operations.modelCalls, ledger: result.evidence.authorityLedger, protectedFiles: result.evidence.protectedFiles}))
}
