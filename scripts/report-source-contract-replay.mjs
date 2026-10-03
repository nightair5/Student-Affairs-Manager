import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { sourceContractComponents } from './source-contract-components.mjs'
const x = await sourceContractComponents(), sha = s => createHash('sha256').update(s).digest('hex')
const sources = JSON.parse(readFileSync('docs/recognition-optimization/d26-correction/SOURCES.json', 'utf8')).sources
const report = JSON.parse(readFileSync('.data/d26-authorized-20261003/COMPARISON_REPORT.json', 'utf8').replace(/^\uFEFF/u, ''))
if (report.status !== 'COMPLETE_DEFINITE_COMPARISON' || report.units.length !== 16 || new Set(report.units.map(u => u.ordinal)).size !== 16) throw Error('D26_COMPLETE_16_REQUIRED')
const cases = []
for (const unit of report.units) {
  const bytes = readFileSync('.data/d26/execution/raw/' + String(unit.ordinal).padStart(2, '0') + '.json'), raw = JSON.parse(bytes)
  const source = sources.find(s => s.sourceId === unit.sourceId)
  if (sha(raw.rawHttpText) !== unit.responseSha256 || raw.requestSha256 !== unit.requestSha256 || sha(source.sourceText) !== source.sourceSha256) throw Error('RECORDED_SHA_DRIFT')
  const original = report.cases.find(c => c.ordinal === unit.ordinal)
  const base = { ordinal: unit.ordinal, sourceId: unit.sourceId, candidate: unit.candidate, rawFileSha256: sha(bytes), responseSha256: unit.responseSha256, requestSha256: unit.requestSha256, sourceSha256: source.sourceSha256, referenceTime: source.referenceTime, originalFrozenScore: original.score }
  const context = { index: await x.indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText), referenceTime: source.referenceTime, timezone: source.timezone }
  try {
    const decoded = x.decodeSourceContractRecording(raw.rawHttpText, unit.candidate, context)
    const taskProblems = decoded.result.standaloneTasks.map(t => ({ id: t.tempId, title: t.title, problem: x.sourceReviewProblem(decoded.result, t.tempId) ?? null }))
    const eventProblems = decoded.result.events.map(e => ({ id: e.tempId, title: e.title, problem: x.sourceEventProblem(decoded.result, e.tempId) ?? null }))
    const pending = taskProblems.some(t => t.problem) || eventProblems.some(e => e.problem) || decoded.coverageAudit.unknownCoverage.length > 0
    cases.push({ ...base, status: pending ? 'KNOWN_FACTS_SHOWN_WITH_BLOCKED_ITEMS' : 'FACTS_PROJECTABLE_NOT_SEMANTIC_SCORE', taskProblems, eventProblems, result: decoded.result, originalAdapted: decoded.originalAdapted, conversion: decoded.conversion, coverageAudit: decoded.coverageAudit, sidecar: decoded.sidecar, sourceRenderedEvents: decoded.sourceRenderedEvents, inferredFacts: 0, semanticCorrectness: 'NOT_REJUDGED', humanCorrections: 'NOT_APPLICABLE' })
  } catch (error) { cases.push({ ...base, status: 'REJECTED_PRESERVE_SOURCE_AND_RAW', code: error.message, semanticCorrectness: 'NOT_SCOREABLE', humanCorrections: 'NOT_APPLICABLE' }) }
}
const output = { version: x.SOURCE_CONTRACT_VERSION, role: 'POST_COMPARISON_OFFLINE_PROGRAM_DIAGNOSTIC', denominator: 16, modelCalls: 0, grant: 0, reserve: 0, settle: 0, originalComparisonChanged: false, newModelAccuracy: 'NOT_OBSERVABLE', humanMetrics: 'NOT_OBSERVABLE', referenceRole: 'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL', titleFreeProseLeakage: 'NOT_ADJUDICATED', byArm: Object.fromEntries(['Candidate17', 'Candidate18'].map(candidate => { const rows = cases.filter(c => c.candidate === candidate); return [candidate, { denominator: rows.length, projectable: rows.filter(c => c.status !== 'REJECTED_PRESERVE_SOURCE_AND_RAW').length, blockedOrPending: rows.filter(c => c.status === 'KNOWN_FACTS_SHOWN_WITH_BLOCKED_ITEMS').length, rejected: rows.filter(c => c.status === 'REJECTED_PRESERVE_SOURCE_AND_RAW').length }] })), cases }
if (process.argv.includes('--verify')) {
  const saved = JSON.parse(readFileSync('docs/recognition-optimization/source-contract-consistency/REPLAY_DIAGNOSTIC.json', 'utf8'))
  if (JSON.stringify(saved) !== JSON.stringify(output)) throw Error('SOURCE_CONTRACT_DIAGNOSTIC_DRIFT')
  console.log(JSON.stringify({ status: 'READ_ONLY_VERIFIED', denominator: 16, byArm: output.byArm, modelCalls: 0, ledgerWrites: 0 }))
} else console.log(JSON.stringify(output, null, 2))
