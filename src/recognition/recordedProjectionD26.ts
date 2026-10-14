import { convertCandidate18Envelope, type SourceFacts } from '../experiments/realInput01/sourceFactsV3'
import { parseModelEnvelope, type WireContext } from '../experiments/realInput01/modelWire'
import { bridgeSemanticToRecognitionD26 } from './firstSuggestionD26'
import type { ImmutableScopeIndex } from './scopeReferenceContract'

export const RECORDED_PROJECTION_VERSION = 'recorded-source-accounting-projection-1' as const

/** Only rebind scope identities of identical source text, never entity IDs or values. */
export function rebindRecordedScopes(rawHttpText: string, before: ImmutableScopeIndex, after: ImmutableScopeIndex) {
  if (before.sourceContent !== after.sourceContent || before.scopes.length !== after.scopes.length || before.scopes.some((s, i) => s.text !== after.scopes[i].text || s.start !== after.scopes[i].start || s.end !== after.scopes[i].end)) throw Error('RECORDED_SOURCE_SCOPE_DRIFT')
  const mapping = new Map(before.scopes.map((s, i) => [s.id, after.scopes[i].id]))
  const map = (value: unknown, bindings: Map<string, string>, key = ''): unknown => {
    if (Array.isArray(value)) return value.map(v => map(v, bindings, key))
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, map(v, bindings, k)]))
    return typeof value === 'string' && /^(?:scopeId|scopeIds|.*ScopeIds)$/u.test(key) ? bindings.get(value) ?? value : value
  }
  const envelope = JSON.parse(rawHttpText), facts = JSON.parse(envelope.output[0].content[0].text), rebound = map(facts, mapping)
  if (JSON.stringify(map(rebound, new Map([...mapping].map(([a, b]) => [b, a])))) !== JSON.stringify(facts)) throw Error('RECORDED_REBIND_NOT_REVERSIBLE')
  envelope.output[0].content[0].text = JSON.stringify(rebound)
  return { reboundHttpText: JSON.stringify(envelope), mapping: [...mapping], operation: 'IDENTICAL_SOURCE_SCOPE_ID_REBIND_ONLY' }
}

/** A post-comparison representation projection, never a repair of absent facts.
 * A primary action/event may explicitly cite its supported material/time. Keep
 * those citations in audit while projecting the typed primary accounting view.
 * Wrong IDs, wrong scopes, absent primaries and invalid coverage still fail. */
export function projectRecordedAccounting(rawHttpText: string, context: WireContext) {
  const envelope = JSON.parse(rawHttpText)
  const text = envelope.output?.[0]?.content?.[0]?.text
  if (typeof text !== 'string') throw Error('RECORDED_RESPONSE_TEXT_REQUIRED')
  const original: SourceFacts = JSON.parse(text), projected = structuredClone(original)
  const extras: Array<{ scopeId: string; primaryIds: string[]; supportedSecondaryIds: string[] }> = []
  const primaries = new Map<string, { kind: 'action' | 'event'; scopes: string[] }>([
    ...original.tasks.map(t => [t.id, { kind: 'action', scopes: t.propositionScopeIds }] as const),
    ...original.events.map(e => [e.tempId, { kind: 'event', scopes: e.scopeIds }] as const),
  ])
  const secondaries = new Map([...original.materials, ...original.timePoints].map(e => [e.tempId, e.scopeIds]))
  for (const row of projected.scopeAccounting) {
    if (!Array.isArray(row.entityIds) || new Set(row.entityIds).size !== row.entityIds.length) throw Error('RECORDED_ACCOUNTING_DUPLICATE_REFERENCE')
    if (row.kind !== 'action' && row.kind !== 'event') continue
    const primaryIds = row.entityIds.filter(id => primaries.get(id)?.kind === row.kind && primaries.get(id)?.scopes.includes(row.scopeId))
    const supportedSecondaryIds = row.entityIds.filter(id => secondaries.get(id)?.includes(row.scopeId))
    if (!primaryIds.length || primaryIds.length + supportedSecondaryIds.length !== row.entityIds.length) throw Error('RECORDED_ACCOUNTING_UNSUPPORTED_REFERENCE')
    if (supportedSecondaryIds.length) {
      extras.push({ scopeId: row.scopeId, primaryIds, supportedSecondaryIds })
      row.entityIds = primaryIds
    }
  }
  envelope.output[0].content[0].text = JSON.stringify(projected)
  const converted = convertCandidate18Envelope(JSON.stringify(envelope), context)
  return { ...converted, projectionAudit: { version: RECORDED_PROJECTION_VERSION, role: 'POST_COMPARISON_PROGRAM_CONVERSION', extras, inferredFacts: 0, originalFacts: original, projectedAccounting: projected.scopeAccounting } }
}

export function decodeRecordedD26(rawHttpText: string, candidate: 'Candidate17' | 'Candidate18', context: WireContext, projection = false) {
  const conversion = candidate === 'Candidate18'
    ? projection ? projectRecordedAccounting(rawHttpText, context) : convertCandidate18Envelope(rawHttpText, context)
    : null
  const parsed = parseModelEnvelope(conversion?.convertedHttpText ?? rawHttpText, context, 'deepseek-flash')
  const bridge = bridgeSemanticToRecognitionD26(parsed.adaptedResponse, context)
  // A compressed event name can be rendered as its already-cited source clause.
  // Never create an event, change its object, or join unrelated source clauses.
  const sourceRenderedEvents: Array<{ entityId: string; originalTitle: string; renderedTitle: string }> = []
  for (const event of bridge.result.events) {
    const original = parsed.adaptedResponse.events.find(e => e.tempId === event.tempId)!
    if (event.title !== '待核对事件') continue
    const scope = context.index.scopes.find(s => original.scopeIds.includes(s.id) && orderedSubsequence(original.title, s.text))
    if (!scope) continue
    event.title = scope.text.replace(/[，。；]+$/u, '')
    event.description = scope.text
    event.selected = !bridge.representationGaps.some(g => g.entityIds.includes(event.tempId))
    sourceRenderedEvents.push({ entityId: event.tempId, originalTitle: original.title, renderedTitle: event.title })
  }
  return { ...bridge, result: { ...bridge.result, modelName: `${candidate} 固定录制（非实时调用）` }, originalAdapted: parsed.adaptedResponse,
    conversion: conversion ? { version: conversion.conversion.version, ...('projectionAudit' in conversion ? { projectionAudit: conversion.projectionAudit } : {}) } : null,
    sourceRenderedEvents }
}

function orderedSubsequence(title: string, quote: string) {
  if (!title.trim()) return false
  // Do not accept deletion or addition of negation as title compression.
  if (/不|未|无|取消|终止/u.test(title) !== /不|未|无|取消|终止/u.test(quote)) return false
  let cursor = 0
  for (const character of title) { const next = quote.indexOf(character, cursor); if (next < 0) return false; cursor = next + character.length }
  return true
}
