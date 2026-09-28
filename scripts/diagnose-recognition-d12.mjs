import {createHash} from 'node:crypto'
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {scoreCandidate15Diagnostic} from './score-candidate15-diagnostic.mjs'
import {referencesValid} from './score-candidate15-d11.mjs'
import {verifyRecognitionHistory} from './verify-recognition-history.mjs'

export const D12 = 'docs/recognition-optimization/d12-progress'
const D11 = 'docs/recognition-optimization/candidate15/d11-development-20260928a'
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const sha = value => createHash('sha256').update(value).digest('hex')
const check = (value, code) => { if (!value) throw Error('D12_' + code) }

async function loadComponents() {
  const bundle = await build({stdin: {contents: "export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts'; export {adaptCandidate14CommonWire} from './src/experiments/candidate14/commonAdapter.ts';", resolveDir: process.cwd(), loader: 'ts'}, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent'})
  return import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
}

export async function loadD12OracleInputs() {
  const x = await loadComponents(), sources = read('docs/recognition-optimization/candidate15/d8-development/SOURCES.json').sources
  const refs = read('docs/recognition-optimization/candidate15/d9-development/REFERENCES.json').references
  const oracles = read('docs/recognition-optimization/candidate15/d9-development/LEGAL_WIRE_ORACLES.json').oracles
  return Promise.all(refs.map(async ({reference}) => {
    const source = sources.find(s => s.sourceId === reference.sourceId)
    const context = {index: await x.indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText), referenceTime: source.referenceTime, timezone: source.timezone}
    const result = x.adaptCandidate14CommonWire(oracles.find(o => o.sourceId === source.sourceId).wire, context).adapted
    return {reference, result}
  }))
}

export async function loadD11DiagnosticInputs() {
  const x = await loadComponents()
  const binding = read(D11 + '/BINDING.json'), state = read(D11 + '/STATE.json')
  const sources = read('docs/recognition-optimization/candidate15/d8-development/SOURCES.json').sources
  const references = read('docs/recognition-optimization/candidate15/d9-development/REFERENCES.json').references
  const rows = []
  for (const unit of binding.units) {
    const source = sources.find(s => s.sourceId === unit.sourceId)
    const reference = references.find(r => r.sourceId === unit.sourceId).reference
    const path = D11 + '/raw/' + String(unit.ordinal).padStart(2, '0') + '.json'
    const bytes = readFileSync(path), raw = JSON.parse(bytes)
    check(raw.ordinal === unit.ordinal && raw.requestSha256 === unit.requestSha256 && sha(raw.rawHttpText) === raw.responseSha256 && raw.responseSha256 === state.units[unit.ordinal - 1].responseSha256, 'RAW_IDENTITY')
    const context = {index: await x.indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText), referenceTime: source.referenceTime, timezone: source.timezone}
    const response = JSON.parse(raw.rawHttpText)
    check(response.status === 'completed', 'TRANSPORT_UNDETERMINED')
    const wire = JSON.parse(response.output.at(-1).content[0].text)
    const result = x.adaptCandidate14CommonWire(wire, context).adapted
    rows.push({unit, reference, result, referenceValid: referencesValid(result, context.index), rawSha256: sha(bytes), responseSha256: raw.responseSha256})
  }
  check(rows.length === 24, 'DENOMINATOR')
  return rows
}

export async function diagnoseD12() {
  const history = verifyRecognitionHistory(), inputs = await loadD11DiagnosticInputs()
  const prior = read(D11 + '/SCORING_RESULTS.json')
  const cases = inputs.map(({unit, reference, result, referenceValid, rawSha256, responseSha256}) => {
    const diagnostic = scoreCandidate15Diagnostic(reference, result, {referenceValid})
    const old = prior.cases.find(row => row.ordinal === unit.ordinal)
    // Patch isolation: every previously returned result must keep exactly the same rules.
    if (old.score.status !== 'SCORER_EXCEPTION') {
      const {version: oldVersion, ...oldScore} = old.score
      const {version: newVersion, ...newScore} = diagnostic
      check(oldVersion !== newVersion && JSON.stringify(oldScore) === JSON.stringify(newScore), 'UNINTENDED_RULE_CHANGE')
    }
    return {ordinal: unit.ordinal, sourceId: unit.sourceId, arm: unit.arm, rawSha256, responseSha256,
      originalStatus: old.score.status, referenceValid, legacyRuleDiagnostic: diagnostic,
      failedFields: diagnostic.matches.flatMap(m => m.check ? Object.entries(m.check.fields).filter(([,v]) => v.pass === false).map(([field]) => ({expectedId: m.expectedId, field})) : []),
    }
  })
  const arms = Object.fromEntries(['A', 'B'].map(arm => {
    const rows = cases.filter(row => row.arm === arm), fields = {}
    for (const row of rows) for (const {field} of row.failedFields) fields[field] = (fields[field] ?? 0) + 1
    return [arm === 'A' ? 'Candidate03' : 'Candidate15', {
      planned: 12, analyzed: rows.length, schemaValid: 12, referenceValid: rows.filter(r => r.referenceValid).length,
      scoredUnderLegacyRules: rows.filter(r => r.legacyRuleDiagnostic.status === 'SCORED').length,
      completeUnderLegacyRulesAfterCrashFix: rows.filter(r => r.legacyRuleDiagnostic.complete).length,
      failuresByField: fields,
      legacyUnmatchedActionableCount: rows.filter(r => r.legacyRuleDiagnostic.status === 'SCORED').reduce((n,r) => n + r.legacyRuleDiagnostic.severity.forbidden, 0),
      actualProhibitedTaskCount: 'NOT_ADJUDICATED_DO_NOT_INFER_FROM_LEGACY_FORBIDDEN',
    }]
  }))
  return {version: 'd12-posthoc-diagnostic-1', role: 'POSTHOC_SEEN_SYNTHETIC_DIAGNOSTIC', modelCalls: 0,
    originalDecision: prior.decision, originalDecisionChanged: false, newPromotionDecision: 'NOT_EVALUATED',
    limits: ['Only zero-match crash is fixed; legacy matching and reference semantics remain disputed.', 'S04 reference/prompt conflict requires future version adjudication.', 'Legacy Forbidden means unmatched actionable, not proven prohibited action.', 'No independent human labels; no valid human or generalization claim.'],
    recoveredExceptionOrdinals: cases.filter(r => r.originalStatus === 'SCORER_EXCEPTION').map(r => r.ordinal),
    unresolvedScorerExceptions: cases.filter(r => r.legacyRuleDiagnostic.status === 'SCORER_EXCEPTION').length,
    inputs: {d11ScoresSha256: sha(readFileSync(D11 + '/SCORING_RESULTS.json')), referencesSha256: sha(readFileSync('docs/recognition-optimization/candidate15/d9-development/REFERENCES.json')),
      scorerSha256: sha(readFileSync('scripts/score-candidate15-diagnostic.mjs')), sourcesSha256: sha(readFileSync('docs/recognition-optimization/candidate15/d8-development/SOURCES.json'))},
    history, arms, cases,
    humanMetrics: {firstWholeSuggestionAccuracy: 'NOT_OBSERVABLE', correctDispositionRate: 'NOT_OBSERVABLE', lowModificationCorrectDispositionRate: 'NOT_OBSERVABLE', activeEditTime: 'NOT_OBSERVABLE'},
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = process.argv[2]
  check(['--write', '--verify'].includes(arg), 'ARGUMENT')
  const result = await diagnoseD12(), path = D12 + '/POSTHOC_DIAGNOSTIC.json'
  if (arg === '--write') { mkdirSync(D12, {recursive: true}); writeFileSync(path, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'}) }
  else check(JSON.stringify(read(path)) === JSON.stringify(result), 'REPORT_DRIFT')
  console.log(JSON.stringify({role: result.role, modelCalls: 0, recovered: result.recoveredExceptionOrdinals, arms: result.arms, originalDecision: result.originalDecision}))
}
