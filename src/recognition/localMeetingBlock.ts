import {localActionNeedsDecision} from './localNoticeFacts'

/** A bare attendance verb is not a name. Use only one event named in this quote. */
export function localNamedMeeting(text: string): string | null {
  if (localActionNeedsDecision(text)) return null
  if ([...text.matchAll(/召开|举行|举办|(?<!召)开/gu)].length !== 1) return null
  const names = [...text.matchAll(/(?:召开|举行|举办|开)(?:\s*(?:\d+|[一二三四五六七八九十]+)分钟(?:左右)?的)?\s*([^，,；;。！？\n]{1,30}?(?:说明会|研讨会|交流会|大会|会议|班会|讲座))(?=[，,；;。！？\n]|$)/gu)].map(match => match[1].trim())
  return names.length === 1 ? names[0] : null
}

/** Local fallback only. Bind labelled meeting fields within one contiguous block. */
export function localMeetingBlock(text: string, quote: string): { title: string; timeText: string; quote: string; location: string | null } | null {
  // Do not cut an eligibility, cancellation or revision clause away from its fields.
  // These notices retain the existing conservative path and the full source for review.
  if (localActionNeedsDecision(text) || /更正|原定|延期|改为|更改|调整|暂定|另行通知/u.test(text)) return null
  const pattern = /(?:^|\n)[ \t]*会议主题[：:]\s*([^\n]+)\n(?:[ \t]*\n)*[ \t]*会议时间[：:]\s*([^\n]+)(?:\n[ \t]*会议地点[：:]\s*([^\n]+))?/gu
  const matches = [...text.matchAll(pattern)].filter(match => {
    const block = match[0].trim(), time = match[2].trim()
    return quote.includes(time) || (quote.trim().length > 8 && block.includes(quote.trim()) && quote.includes('会议时间'))
  })
  if (matches.length !== 1) return null
  const match = matches[0], title = match[1].trim(), timeText = match[2].trim()
  if (!title || title.length > 80 || /取消|禁止|不再|另行通知|改为|更改|调整|暂定/u.test(match[0])) return null
  return { title, timeText, quote: match[0].trim(), location: match[3]?.trim() ?? null }
}
