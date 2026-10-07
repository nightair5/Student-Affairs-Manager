import type { WireContext } from '../experiments/realInput01/modelWire'
import { plainJson } from '../experiments/mainline04/semanticContract'
import { decodeSingleAuthorityRecording, type SingleAuthorityFacts } from './sourceContractV5'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { sourceWindowsFromSidecar } from './sourceWindowGrounding'
import { projectAuthoritySupportContext } from './authoritySupportContext'
import { projectAuthorityEndpointComposition } from './authorityEndpointComposition'

export const AUTHORITY_ATTRIBUTE_INDEX_VERSION = 'single-authority-attribute-index-1.0.0'
const check = (ok: unknown, code: string) => { if (!ok) throw Error('AUTHORITY_ATTRIBUTE_' + code) }

/** The nested attribute already declares its event. Derive the inverse evidence
 * index without adding a fact, guessing an owner, or rewriting the frozen wire. */
export function projectAuthorityAttributeIndex(input: unknown, context: WireContext) {
  const original = plainJson(input) as SingleAuthorityFacts, projected = structuredClone(original)
  check(Array.isArray(projected.events) && Array.isArray(projected.timePoints) && Array.isArray(projected.scopeAccounting), 'SHAPE')
  const additions: Array<{ eventId: string; attribute: number; scopeIds: string[] }> = []
  for (const e of projected.events) {
    check(Array.isArray(e.scopeIds) && Array.isArray(e.attributes), 'SHAPE')
    for (const [i, a] of e.attributes.entries()) {
      check(typeof a.text === 'string' && Array.isArray(a.scopeIds) && a.scopeIds.length > 0, 'SHAPE')
      for (const id of a.scopeIds) {
        const scope = context.index.scopes.find(s => s.id === id)
        check(scope && scope.text.includes(a.text), 'SOURCE_EVIDENCE')
        const rows = projected.scopeAccounting.filter(r => r.scopeId === id)
        check(rows.length === 1 && ((rows[0].kind === 'information' && rows[0].primaryEntityIds.length === 0)
          || (rows[0].kind === 'event' && rows[0].primaryEntityIds.includes(e.tempId))), 'ACCOUNTING_OWNER')
        // An added attribute index must never make a previously invalid time
        // owner pass the frozen event-time evidence guard.
        check(!projected.timePoints.some(p => p.scopeIds.includes(id) && p.owners.some(o =>
          o.entityId === e.tempId && (o.kind === 'event_start' || o.kind === 'event_end'))
          && !p.scopeIds.some(s => original.events.find(v => v.tempId === e.tempId)?.scopeIds.includes(s))), 'TIME_OWNER')
      }
      const extra = a.scopeIds.filter(id => !e.scopeIds.includes(id))
      if (extra.length) { e.scopeIds.push(...extra); additions.push({ eventId: e.tempId, attribute: i, scopeIds: extra }) }
    }
  }
  return { projected, audit: { version: AUTHORITY_ATTRIBUTE_INDEX_VERSION, operation: 'NESTED_ATTRIBUTE_TO_EVENT_EVIDENCE_INDEX', inferredFacts: 0, additions, original } }
}

export function decodeAuthorityProductRecording(raw: string, context: WireContext, role: 'EngineeringFixture' | 'SingleAuthority' = 'EngineeringFixture') {
  const envelope = JSON.parse(raw)
  const texts = Array.isArray(envelope.output) ? envelope.output.filter((v: { type?: string }) => v.type === 'message')
    .flatMap((v: { content?: { type?: string; text?: string }[] }) => v.content?.filter(c => c.type === 'output_text') ?? []) : []
  check(texts.length === 1 && typeof texts[0].text === 'string', 'RESPONSE_TEXT')
  const support = projectAuthoritySupportContext(JSON.parse(texts[0].text), context)
  const endpoints = projectAuthorityEndpointComposition(support.projected, context)
  const projection = projectAuthorityAttributeIndex(endpoints.projected, context)
  texts[0].text = JSON.stringify(projection.projected)
  const decoded = decodeSingleAuthorityRecording(JSON.stringify(envelope), context, role)
  const first = assembleCurrentFirstSuggestion(decoded.result, { sourceText: context.index.sourceContent, referenceTime: context.referenceTime,
    timezone: context.timezone, sourceWindows: sourceWindowsFromSidecar(decoded.sidecar) })
  return { ...decoded, result: first.result, attributeIndexAudit: projection.audit, sourceWindowGrounding: first.sourceWindowGrounding, sidecar: { ...decoded.sidecar,
    attributeIndexAudit: projection.audit, authoritySupportContextAudit: support.audit, authorityEndpointCompositionAudit: endpoints.audit,
    sourceWindowGrounding: first.sourceWindowGrounding, originalResponse: raw, postComparisonProductVersion: support.audit.version + '/' + endpoints.audit.version } }
}
