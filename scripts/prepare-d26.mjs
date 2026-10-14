import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { makeD26ReferenceData } from './d26-reference-data.mjs'
import { d26Components } from './d26-components.mjs'
import { scoreD26, D26_SCORER, D26_SELECTOR } from './d26-scoring.mjs'

export const D26_ROOT = 'docs/recognition-optimization/d26-correction'
export const D26_BATCH = 'D26-C17-C18-DEVELOPMENT-R1'
export const sha = value => createHash('sha256').update(value).digest('hex')
// Source components are UTF-8 text. Only CRLF checkout translation is normalized;
// frozen request/artifact bytes and all semantic content remain byte-bound.
export const componentSha = value => sha(value.toString('utf8').replace(/\r\n/gu, '\n'))
export const json = value => JSON.stringify(value, null, 2) + '\n'
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const check = (value, code) => { if (!value) throw Error('D26_PREPARE_' + code) }

export async function makeD26() {
  const artifacts = await makeD26ReferenceData(), x = await d26Components()
  const sources = artifacts['SOURCES.json'].sources, references = artifacts['REFERENCES.json'].references
  const oracles = artifacts['LEGAL_WIRE_ORACLES.json'].oracles, roundtrip = []
  check(sources.length === 8 && references.length === 8 && oracles.length === 8, 'DATA_COUNT')
  for (const source of sources) {
    const reference = references.find(row => row.sourceId === source.sourceId)
    const wire = oracles.find(row => row.sourceId === source.sourceId).wire
    const context = { index: await x.indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText), referenceTime: source.referenceTime, timezone: source.timezone }
    const positive = scoreD26(reference, x.adaptModelWireD26(wire, context).adapted)
    check(positive.completeStatus === true, 'SOURCE_SUPPORTED_POSITIVE_' + source.sourceId + '_' + JSON.stringify({ risks: positive.risks, disputes: positive.disputes }))
    const negative = structuredClone(wire)
    if (source.target === 'S09_EVENT') { negative.events = []; negative.timePoints = [] }
    else if (source.target === 'S06_PREREQUISITE') negative.tasks[1].condition = { value: 'true', conditionScopeIds: [context.index.scopes[1].id], factScopeIds: [] }
    else if (source.target === 'S05_GRAPH') negative.tasks[0].detail.timePointTempIds = []
    else if (source.target === 'CONTROL_MATERIAL_PRECISE') negative.materials[0].formatRequirements = ['DOCX']
    else negative.tasks.pop()
    let bad, negativeError = null
    try { bad = scoreD26(reference, x.adaptModelWireD26(negative, context).adapted) }
    catch (error) { negativeError = String(error.message).slice(0, 200); bad = { completeStatus: false, risks: [{ kind: 'INVALID_RELATION_OR_SCHEMA' }] } }
    check(bad.completeStatus === false, 'CRITICAL_NEGATIVE_' + source.sourceId)
    const reordered = structuredClone(wire); reordered.tasks.reverse(); reordered.informationScopeIds.reverse()
    check(scoreD26(reference, x.adaptModelWireD26(reordered, context).adapted).completeStatus === true, 'LEGAL_ORDER_' + source.sourceId)
    roundtrip.push({ sourceId: source.sourceId, positive: 'PASS', negative: 'DETECTED', negativeRisks: bad.risks, negativeError, orderInvariant: 'PASS', evidenceRole: 'ENGINEERING_ORACLE_NOT_NEW_MODEL_OUTPUT' })
  }
  const referenceSha256 = sha(json(artifacts['REFERENCES.json'])), requests = []
  for (const [index, source] of sources.entries()) {
    const context = { index: await x.indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText), referenceTime: source.referenceTime, timezone: source.timezone }
    const baseline = await x.buildCandidate17Request(context), challenger = await x.buildCandidate18Request(context)
    const bodies = { A: { ...baseline.body, model: 'deepseek-flash' }, B: { ...challenger.body, model: 'deepseek-flash' } }
    const parameters = body => ({ ...body, input: [body.input[1]], text: undefined })
    check(JSON.stringify(parameters(bodies.A)) === JSON.stringify(parameters(bodies.B)), 'UNEQUAL_COMMON_INPUT_PARAMETERS')
    for (const arm of index % 2 === 0 ? ['A', 'B'] : ['B', 'A']) {
      const body = bodies[arm], ordinal = requests.length + 1
      check(!/\bexpected\b/iu.test(JSON.stringify(body)), 'REFERENCE_IN_REQUEST')
      const identity = { batch: D26_BATCH, ordinal, sourceId: source.sourceId, sourceSha256: source.sourceSha256, arm,
        candidate: arm === 'A' ? 'Candidate17' : 'Candidate18', requestSha256: sha(JSON.stringify(body)), referenceSha256,
        model: 'deepseek-flash', scorer: D26_SCORER, commonLayer: 'D26_TIME_AND_FIRST_DISPLAY' }
      requests.push({ ...identity, unitIdentitySha256: sha(JSON.stringify(identity)), body, dispatchAuthorized: false, status: 'NOT_RUN' })
    }
  }
  artifacts['ROUNDTRIP_RESULTS.json'] = { version: 'd26-roundtrip-1', role: 'ZERO_CALL_ENGINEERING_CHECK', roundtrip }
  artifacts['PREPARED_REQUEST_IDENTITIES.json'] = { version: 'd26-identities-1', dispatchAuthorized: false, status: 'NOT_RUN', requests }
  artifacts['PRE_REGISTRATION.json'] = { version: D26_SELECTOR, batch: D26_BATCH, baseline: 'Candidate17 unchanged frozen prompt and wire', challenger: 'Candidate18 unchanged source-facts-3 prompt; existing explicit-edge assembly',
    comparison: 'TWO_GENERATION_PIPELINES_WITH_COMMON_D26_ADAPTER_DISPLAY_SCORER', sources: 8, units: 16, order: '4 AB / 4 BA', scorer: D26_SCORER,
    sourcePurpose: 'SEEN_D25_SOURCES_REUSED_DEVELOPMENT_NOT_HOLDOUT', humanTruth: 'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',
    fixed: ['sourceText', 'sourceReferenceTime', 'timezone', 'model=deepseek-flash', 'temperature=0', 'reasoning=none', 'max_output_tokens=8192', 'common source-time assertions', 'common D26 time/display assembly', 'common D26 scorer'],
    experimental: ['C17 prompt and wire versus C18 prompt and explicit-edge envelope; original raw retained'],
    referenceRule: 'Source-authored semantic values; only stable scope/ID mappings are mechanical. No adapter-derived expected values.',
    denominatorPolicy: '8 sources per arm; first actual HTTP answer retained; transport/parse/schema/semantic failures and unresolved remain in denominator',
    reporting: ['original model answer', 'deterministic conversion and first user display', 'manual final correction separately; NOT_APPLIED in paired run'],
    selector: D26_SELECTOR, thresholds: { developmentImprovement: 'whole-correct net > 0 without new critical risk', targetedProgress: 'target risks decrease without whole net gain or new critical risk', mixed: 'improvement alongside regression or new critical risk', noImprovement: 'no demonstrated gain', incomplete: 'unknown or missing can change conclusion' },
    forbidden: ['automatic retry', 'repair', 'verifier', 'connection probe', 'answer-based source selection', 'default candidate promotion'], dispatchAuthorized: false }
  const entries = ['scripts/prepare-d26.mjs', 'scripts/d26-executor.mjs', 'scripts/score-d26.mjs', 'scripts/serve-d26-ordinary.mjs', 'src/main.tsx', 'src/App.tsx', 'cloudflare/worker.mjs',
    'src/experiments/realInput01/candidate17.ts', 'src/experiments/realInput01/candidate18.ts', 'src/experiments/realInput01/modelWire.ts', 'src/recognition/firstSuggestionD26.ts', 'src/lib/timeSemanticsD26.ts']
  const graph = await build({ entryPoints: entries, bundle: true, packages: 'external', write: false, metafile: true, outdir: 'memory', platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent' })
  const components = [...new Set([...Object.keys(graph.metafile.inputs), 'scripts/d26-components.mjs', 'scripts/d26-scoring.mjs', 'scripts/d26-reference-data.mjs',
    ...['SOURCES.json', 'REFERENCES.json', 'LEGAL_WIRE_ORACLES.json'].map(name => 'docs/recognition-optimization/d25-accuracy/' + name), 'package-lock.json', 'package.json'])].sort()
  artifacts['MANIFEST.json'] = { version: 'd26-development-freeze-1', batch: D26_BATCH, status: 'NOT_RUN', dispatchAuthorized: false, modelCalls: 0, sourceCount: 8, requestCount: 16, order: { AB: 4, BA: 4 }, scorer: D26_SCORER,
    componentHashMode: 'SHA256_UTF8_CRLF_TO_LF_NO_OTHER_NORMALIZATION',
    components: components.map(path => ({ path, sha256: componentSha(readFileSync(path)) })), artifacts: Object.entries(artifacts).map(([path, value]) => ({ path, sha256: sha(json(value)) })) }
  return artifacts
}

export function verifyD26(root = D26_ROOT) {
  const manifest = read(join(root, 'MANIFEST.json'))
  check(manifest.batch === D26_BATCH && manifest.sourceCount === 8 && manifest.requestCount === 16 && manifest.dispatchAuthorized === false && manifest.status === 'NOT_RUN', 'MANIFEST_SCOPE')
  check(manifest.componentHashMode === 'SHA256_UTF8_CRLF_TO_LF_NO_OTHER_NORMALIZATION', 'COMPONENT_HASH_MODE')
  for (const file of manifest.components) {
    check(componentSha(readFileSync(file.path)) === file.sha256, 'FROZEN_COMPONENT_DRIFT_' + file.path)
  }
  for (const file of manifest.artifacts.map(row => ({ ...row, path: join(root, row.path) }))) {
    check(sha(readFileSync(file.path)) === file.sha256, 'FROZEN_DRIFT_' + file.path)
  }
  const data = read(join(root, 'PREPARED_REQUEST_IDENTITIES.json')), requests = data.requests
  check(data.dispatchAuthorized === false && data.status === 'NOT_RUN' && requests.length === 16 && new Set(requests.map(row => row.unitIdentitySha256)).size === 16, 'IDENTITY_COUNT')
  for (const [index, row] of requests.entries()) {
    const { unitIdentitySha256, body, status, dispatchAuthorized, ...identity } = row
    check(row.batch === D26_BATCH && row.ordinal === index + 1 && status === 'NOT_RUN' && dispatchAuthorized === false
      && sha(JSON.stringify(identity)) === unitIdentitySha256 && sha(JSON.stringify(body)) === row.requestSha256, 'IDENTITY_OR_BODY_DRIFT')
  }
  return { status: 'FROZEN_NOT_RUN', units: 16, manifestSha256: sha(readFileSync(join(root, 'MANIFEST.json'))), identitiesSha256: sha(readFileSync(join(root, 'PREPARED_REQUEST_IDENTITIES.json'))) }
}

export function writeD26Freeze(artifacts, root = D26_ROOT) {
  // Validate every path before the first write. Existing frozen files are never replaced.
  for (const name of Object.keys(artifacts)) check(!existsSync(join(root, name)), 'ALREADY_FROZEN_' + name)
  mkdirSync(root, { recursive: true })
  for (const [name, value] of Object.entries(artifacts)) writeFileSync(join(root, name), json(value), { flag: 'wx' })
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === '--write') { writeD26Freeze(await makeD26()); console.log(JSON.stringify(verifyD26())) }
  else if (process.argv[2] === '--verify') console.log(JSON.stringify(verifyD26()))
  else throw Error('D26_PREPARE_MODE_REQUIRED')
}
