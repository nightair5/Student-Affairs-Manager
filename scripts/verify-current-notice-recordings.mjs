// Read-only regression: original scores/raw/paid state are never rewritten.
import { readFileSync, writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { publicNoticeRecordedScene, historicalCandidate19Controls } from './public-notice-recorded-readonly.mjs'
import { publicNoticeComponents } from './public-notice-components.mjs'
const root = 'docs/recognition-optimization/candidate19-public-development'
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const scene = publicNoticeRecordedScene(), components = await publicNoticeComponents()
const previous = read(root + '/OLD_12_DIAGNOSTIC.json').cases
const paid = read(root + '/paid-evidence/POST_CONVERSION_DIAGNOSTIC.json')
const cases = []
for (const record of [...scene.recordings, ...historicalCandidate19Controls()]) {
  const context = { index: await components.indexImmutableScopesV11(record.sourceId, record.sourceVersionId, record.sourceText), referenceTime: record.referenceTime, timezone: record.timezone }
  const first = components.assembleCurrentFirstSuggestion(components.decodeCurrentSourceRecording(record.rawHttpText, record.candidate, context).result, { sourceText: record.sourceText, referenceTime: record.referenceTime, timezone: record.timezone }).result
  const prior = record.ordinal < 200 ? paid.known.find(row => row.sourceId === record.sourceId) : previous.find(row => row.ordinal === record.ordinal - 200)
  if (!prior || prior.responseSha256 !== record.responseSha256 || !isDeepStrictEqual(prior.firstSuggestion, first)) throw Error('CURRENT_NOTICE_PRIOR_FACT_DRIFT_' + record.ordinal)
  cases.push({ ordinal: record.ordinal, sourceId: record.sourceId, candidate: record.candidate, responseSha256: record.responseSha256, firstSuggestionEqual: true })
}
const report = { version: 'current-notice-old-recording-regression-1', role: 'POST_OUTPUT_ENGINEERING_NOT_NEW_MODEL_SCORE', modelCalls: 0, ledgerWrites: 0, oldScoresUnchanged: 'v11 C17 2/6 C19 1/6 MIXED_PROGRESS', policyAuditVersionChanged: true, cases }
const path = root + '/current-notice-mainline/OLD_RECORDING_REGRESSION.json'
if (process.argv[2] === '--write') writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
else if (process.argv[2] !== '--verify' || !isDeepStrictEqual(read(path), report)) throw Error('CURRENT_NOTICE_REGRESSION_MODE_OR_DRIFT')
console.log(JSON.stringify({ verified: cases.length, firstFactsEqual: true, policyAuditsVersioned: true, modelCalls: 0, ledgerWrites: 0 }))
