import { addDateOnlyDays, parseChineseTimeAst, type ChineseTimeAst, type ChineseTimeAstOptions } from './timeSemantics'

export const D26_TIME_VERSION = 'source-time-semantics-2.1.0'
export interface D26TimeInterpretation {
  version: typeof D26_TIME_VERSION
  point: ChineseTimeAst
  knownDate: string | null
  dayPeriod: string | null
  certainty: 'stated' | 'tentative' | 'unannounced' | 'partial'
  sourceContext: string
  conversions: Array<'END_OF_DAY_24_00'>
}

/** New common layer; the old parser and its frozen callers are left intact. */
export function interpretTimeD26(rawText: string, options: ChineseTimeAstOptions & { sourceContext?: string }): D26TimeInterpretation {
  const context = options.sourceContext ?? rawText
  let point = parseChineseTimeAst(rawText, options)
  const conversions: D26TimeInterpretation['conversions'] = []
  // 24:00 denotes the end of the stated calendar day. Only a single literal
  // endpoint qualifies; malformed clocks, ranges and period-qualified clocks
  // retain the old parser's uncertainty. Never change the preserved raw quote.
  const clocks = [...rawText.matchAll(/\d{1,2}\s*[:：]\s*\d{2}/gu)]
  if (clocks.length === 1 && /(?<!\d)24\s*[:：]\s*00(?!\d|[:：])/u.test(rawText)
    && !/凌晨|清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|晚/u.test(rawText)) {
    const parsed = parseChineseTimeAst(rawText.replace(/24\s*[:：]\s*00/u, '00:00'), options)
    if (parsed.normalizedValue?.endsWith('T00:00') && !parsed.needsConfirmation && !parsed.rangeEndNormalizedValue) {
      const next = addDateOnlyDays(parsed.normalizedValue.slice(0, 10), 1)
      if (next) {
        point = { ...parsed, rawText, normalizedValue: next + 'T00:00', evidenceSpan: { start: 0, end: rawText.length } }
        conversions.push('END_OF_DAY_24_00')
      }
    }
  }
  // Context must be the cited time clause, never the entire unrelated notice.
  const tentative = /暂定|拟定|预计|可能|尚未确定|待确定/u.test(context)
  const unannounced = /(?:时间|日期|时刻).{0,6}(?:未公布|尚未公布|待公布|另行通知)|(?:未公布|尚未公布|另行通知).{0,6}(?:时间|日期|时刻)/u.test(rawText)
    || /^(?:尚未公布|未公布|待公布|另行通知)$/u.test(rawText.trim())
  const dayPeriod = rawText.match(/凌晨|清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|晚/u)?.[0] ?? null
  const partialClock = Boolean(dayPeriod && point.timeKind !== 'clock')
  if (unannounced) {
    point.normalizedValue = null
    point.rangeEndNormalizedValue = null
    point.isAllDay = false
    point.precision = 'vague'
    point.needsConfirmation = true
    point.issues.push('time_unannounced')
  } else if (partialClock || tentative) {
    // A known date survives; a period is not an all-day event or an invented clock.
    point.isAllDay = partialClock ? false : point.isAllDay
    point.precision = partialClock ? 'vague' : point.precision
    point.needsConfirmation = true
    if (partialClock) point.issues.push('day_period_without_clock')
    if (tentative) point.issues.push('tentative_time')
  }
  return { version: D26_TIME_VERSION, point, knownDate: point.normalizedValue?.slice(0, 10) ?? null,
    dayPeriod, certainty: unannounced ? 'unannounced' : tentative ? 'tentative' : point.needsConfirmation ? 'partial' : 'stated', sourceContext: context, conversions }
}
