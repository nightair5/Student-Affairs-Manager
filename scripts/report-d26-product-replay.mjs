import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { recordedComponents } from './d26-recorded-components.mjs'
const x = await recordedComponents()
const sources = JSON.parse(readFileSync('docs/recognition-optimization/d26-correction/SOURCES.json', 'utf8')).sources
const report = JSON.parse(readFileSync('.data/d26-authorized-20261003/COMPARISON_REPORT.json', 'utf8').replace(/^\uFEFF/u, ''))
if (report.status !== 'COMPLETE_DEFINITE_COMPARISON') throw Error('D26_COMPLETE_REPORT_REQUIRED')
const sha = s => createHash('sha256').update(s).digest('hex'), cases = []
for (const unit of report.units) {
  const raw = JSON.parse(readFileSync('.data/d26/execution/raw/' + String(unit.ordinal).padStart(2, '0') + '.json', 'utf8'))
  if (sha(raw.rawHttpText) !== unit.responseSha256 || raw.requestSha256 !== unit.requestSha256) throw Error('D26_RAW_DRIFT')
  const source = sources.find(s => s.sourceId === unit.sourceId), context = { index: await x.indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText), referenceTime: source.referenceTime, timezone: source.timezone }
  try { const decoded = x.decodeRecordedD26(raw.rawHttpText, unit.candidate, context, true)
    cases.push({ ordinal: unit.ordinal, sourceId: unit.sourceId, candidate: unit.candidate, status: 'PROJECTABLE_NOT_NEW_MODEL_SCORE', result: decoded.result, semanticSidecar: decoded.sidecar, conversion: decoded.conversion, sourceRenderedEvents: decoded.sourceRenderedEvents })
  } catch (error) { cases.push({ ordinal: unit.ordinal, sourceId: unit.sourceId, candidate: unit.candidate, status: 'REJECTED_PRESERVE_SOURCE_AND_RAW', code: error.message }) }
}
console.log(JSON.stringify({ version: x.RECORDED_PROJECTION_VERSION, role: 'POST_COMPARISON_OFFLINE_DIAGNOSTIC', modelCalls: 0, denominator: 16, originalComparisonChanged: false, cases }, null, 2))
