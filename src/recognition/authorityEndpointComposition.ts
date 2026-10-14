import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import type { SingleAuthorityFacts } from './sourceContractV5'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const AUTHORITY_ENDPOINT_COMPOSITION_VERSION = 'authority-endpoint-composition-1.0.0'
export const AUTHORITY_CITED_ENDPOINT_COMPOSITION_VERSION = 'authority-endpoint-composition-1.1.0'
const dateOnly = /^\d{4}年\d{1,2}月\d{1,2}日(?:（周[一二三四五六日天]）)?$/u
const clockRange = /^(\d{1,2}):([0-5]\d)\s*[-—–]\s*(\d{1,2}):([0-5]\d)$/u

/** Compose complementary declarations only when their original, adjacent date
 * and clock scopes already belong to the same explicitly named event. No
 * missing endpoint, event/task edge or source date is inferred. */
export function projectAuthorityEndpointComposition(input: unknown, context: WireContext, allowCitedCombined=false) {
  const original = plainJson(input) as SingleAuthorityFacts, projected = structuredClone(original)
  const changes: Array<{ eventId: string; retainedStartId: string; retiredClockStartId: string;
    endId: string; scopeIds: string[]; rawText: string }> = []
  for (const event of projected.events) {
    const owned = (kind: 'event_start' | 'event_end') => projected.timePoints.filter(p => p.type === kind
      && p.owners.length === 1 && p.owners[0].kind === kind && p.owners[0].entityId === event.tempId)
    const starts = owned('event_start'), ends = owned('event_end')
    if (allowCitedCombined && starts.length === 1 && ends.length === 1) {
      const start = starts[0], end = ends[0]
      const scopes = start.scopeIds.map(id => context.index.scopes.find(s => s.id === id)).filter(s => s !== undefined)
      const ds = scopes.find(s => dateOnly.test(s.text)), cs = scopes.find(s => clockRange.test(s.text))
      const range = cs?.text.match(clockRange)
      if (ds && cs && range && scopes.length === 2 && cs.order === ds.order + 1
        && start.rawText === end.rawText && end.scopeIds.length === 2 && end.scopeIds.every(id => start.scopeIds.includes(id))
        && hasLiteralScopeSpan(start.rawText, start.scopeIds, context)
        && event.scopeIds.includes(ds.id) && event.scopeIds.includes(cs.id)
        && +range[1] <= 23 && +range[3] <= 23
        && +range[3] * 60 + +range[4] > +range[1] * 60 + +range[2]
        && !original.conflicts.some(c => c.entityTempIds.includes(start.tempId) || c.entityTempIds.includes(end.tempId))) {
        // The source already supplies both endpoints. Keep the literal clock
        // quote and its adjacent date evidence; no owner or missing time is guessed.
        start.rawText = cs.text; end.rawText = cs.text
        changes.push({ eventId: event.tempId, retainedStartId: start.tempId, retiredClockStartId: '',
          endId: end.tempId, scopeIds: [ds.id, cs.id], rawText: context.index.sourceContent.slice(ds.start, cs.end) })
      }
    }
    if (starts.length !== 2 || ends.length !== 1) continue
    const date = starts.find(p => dateOnly.test(p.rawText)), clock = starts.find(p => clockRange.test(p.rawText)), end = ends[0]
    if (!date || !clock || end.rawText !== clock.rawText || date.scopeIds.length !== 1 || clock.scopeIds.length !== 1
      || end.scopeIds.length !== 1 || end.scopeIds[0] !== clock.scopeIds[0]) continue
    const ds = context.index.scopes.find(s => s.id === date.scopeIds[0]), cs = context.index.scopes.find(s => s.id === clock.scopeIds[0])
    const range = clock.rawText.match(clockRange)!
    const startMinutes = +range[1] * 60 + +range[2], endMinutes = +range[3] * 60 + +range[4]
    if (!ds || !cs || ds.text !== date.rawText || cs.text !== clock.rawText || cs.order !== ds.order + 1
      || !event.scopeIds.includes(ds.id) || !event.scopeIds.includes(cs.id) || +range[1] > 23 || +range[3] > 23
      || endMinutes <= startMinutes || original.conflicts.some(c => c.entityTempIds.includes(clock.tempId))) continue
    const rawText = context.index.sourceContent.slice(ds.start, cs.end), scopeIds = [ds.id, cs.id]
    // Preserve the literal clock quote. The existing time layer uses the
    // explicitly cited, adjacent date heading; concatenating scopes into a
    // synthetic raw quote would make ordinary evidence validation fail.
    date.rawText = clock.rawText; date.scopeIds = scopeIds; date.confidence = Math.min(date.confidence, clock.confidence)
    end.scopeIds = scopeIds
    projected.timePoints = projected.timePoints.filter(p => p.tempId !== clock.tempId)
    changes.push({ eventId: event.tempId, retainedStartId: date.tempId, retiredClockStartId: clock.tempId, endId: end.tempId, scopeIds, rawText })
  }
  return { projected, audit: { version: allowCitedCombined ? AUTHORITY_CITED_ENDPOINT_COMPOSITION_VERSION : AUTHORITY_ENDPOINT_COMPOSITION_VERSION, inferredFacts: 0,
    operation: 'ADJACENT_EXPLICIT_SAME_EVENT_DATE_CLOCK_COMPOSITION', changes, original } }
}
