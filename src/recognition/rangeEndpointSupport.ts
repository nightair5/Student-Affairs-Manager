import { interpretTimeD26 } from '../lib/timeSemanticsD26'
import type { TimePointSuggestionV2 } from './types'

/** A closed, explicitly cited event range may omit the repeated year/month.
 * Expand only its already-declared endpoint, never discover a missing entity.
 * A backwards omitted-year range, wrong endpoint type, or multiple candidates
 * stays unsupported. Callers restrict quotes to the unique existing owner. */
export function rangeEndpointSupport(rawText: string, type: TimePointSuggestionV2['type'], quotes: string[], referenceTime: string, timezone: string) {
  if (!['event_start', 'event_end'].includes(type) || !/^\d{4}年\d{1,2}月\d{1,2}日$/u.test(rawText)) return null
  const matches = [...new Set(quotes)].flatMap(quote => [...quote.matchAll(/(?<!\d)(\d{4})年(\d{1,2})月(\d{1,2})日\s*[-—–至到]\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日(?!\d)/gu)].map(m => ({quote,m})))
  if (matches.length !== 1) return null
  const {quote,m} = matches[0], left = `${m[1]}年${m[2]}月${m[3]}日`, right = `${m[4] ?? m[1]}年${m[5] ?? m[2]}月${m[6]}日`
  const a = interpretTimeD26(left,{type:'event_start',referenceTime,timezone}).point
  const b = interpretTimeD26(right,{type:'event_end',referenceTime,timezone}).point
  if (!a.normalizedValue || !b.normalizedValue || a.needsConfirmation || b.needsConfirmation || b.normalizedValue < a.normalizedValue) return null
  const expanded = type === 'event_start' ? left : right
  if (interpretTimeD26(rawText,{type,referenceTime,timezone}).point.normalizedValue !== (type === 'event_start' ? a : b).normalizedValue) return null
  return {quote, literalRange:m[0], expanded, rule:'CITED_SAME_EVENT_RANGE_ENDPOINT' as const}
}
