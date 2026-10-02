import { d26Components } from './d26-components.mjs'
import { scoreD26, selectD26, D26_SCORER } from './d26-scoring.mjs'

/** Read-only evaluation of one immutable HTTP response; no retry, repair or model calls. */
export async function evaluateRawD26(source, reference, raw, candidate, components) {
  const x = components ?? await d26Components()
  const context = { index: await x.indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText), referenceTime: source.referenceTime, timezone: source.timezone }
  let parsed = null, conversion = null, first = null, originalFacts = null, error = null
  try {
    if (raw.httpStatus !== 200) throw Error('TRANSPORT_FAILURE')
    const response = JSON.parse(raw.rawHttpText)
    originalFacts = JSON.parse(response.output.at(-1).content[0].text)
    if (candidate === 'Candidate18') {
      const result = x.convertCandidate18Envelope(raw.rawHttpText, context)
      conversion = result.conversion
      parsed = x.parseModelEnvelope(result.convertedHttpText, context, 'deepseek-flash')
    } else if (candidate === 'Candidate17') parsed = x.parseModelEnvelope(raw.rawHttpText, context, 'deepseek-flash')
    else throw Error('UNKNOWN_CANDIDATE')
    first = x.assembleSemanticFirstSuggestionD26(parsed.adaptedResponse, context)
  } catch (cause) { error = String(cause.message ?? cause).slice(0, 240) }
  const rejected = { version: D26_SCORER, status: 'REJECTED_OUTPUT', completeStatus: false, structuredCompleteStatus: false,
    firstDisplayCompleteStatus: false, risks: [{ kind: 'TRANSPORT_PARSE_SCHEMA_OR_ASSEMBLY_FAILURE' }], riskUnits: ['TRANSPORT_PARSE_SCHEMA_OR_ASSEMBLY_FAILURE'], riskIdentityStatus: 'MAPPED', disputes: [] }
  return { originalFacts, programConversion: conversion, originalAdaptedFacts: parsed?.adaptedResponse ?? null,
    originalAnswerScore: parsed ? scoreD26(reference, parsed.adaptedResponse) : rejected,
    productFirstFacts: first?.result ?? null, firstDisplayAudit: first?.audit ?? null,
    score: first ? scoreD26(reference, first.result) : rejected, error, humanEdits: 'NOT_APPLIED' }
}
export function summarizeD26Cases(sources, cases) {
  const sourceIds = new Set(sources.map(source => source.sourceId)), slots = new Set()
  if (sources.length !== 8 || sourceIds.size !== 8) throw Error('D26_SCORE_SOURCE_DENOMINATOR_INVALID')
  for (const row of cases) {
    const slot = row.sourceId + ':' + row.arm
    if (!sourceIds.has(row.sourceId) || !['A', 'B'].includes(row.arm) || slots.has(slot)) throw Error('D26_SCORE_DUPLICATE_OR_UNKNOWN_UNIT')
    slots.add(slot)
  }
  const pairs = sources.map(source => {
    const A = cases.find(row => row.sourceId === source.sourceId && row.arm === 'A')?.score
    const B = cases.find(row => row.sourceId === source.sourceId && row.arm === 'B')?.score
    return { sourceId: source.sourceId, target: source.target, A, B,
      outcome: !A || !B || A.completeStatus === 'UNKNOWN' || B.completeStatus === 'UNKNOWN' ? 'UNKNOWN'
        : A.completeStatus === B.completeStatus ? 'TIE' : B.completeStatus ? 'IMPROVED' : 'REGRESSED' }
  })
  return { version: 'd26-comparison-1', scope: 'SEEN_DEVELOPMENT_NOT_HOLDOUT_NOT_ORDINARY_DEFAULT_MODEL', pairs,
    decision: selectD26(pairs, 8), arms: Object.fromEntries(['A', 'B'].map(arm => {
      const rows = cases.filter(row => row.arm === arm)
      return [arm === 'A' ? 'Candidate17' : 'Candidate18', { denominator: 8, observed: rows.length,
        firstWholeCorrect: rows.filter(row => row.score.completeStatus === true).length,
        structuredChecksPassed: rows.filter(row => row.score.structuredCompleteStatus === true).length,
        unknown: rows.filter(row => row.score.completeStatus === 'UNKNOWN').length + Math.max(0, 8 - rows.length) }]
    })), humanMetrics: 'NOT_OBSERVABLE', providerActualUsd: 'NOT_OBSERVABLE' }
}
