import type { TimePointSuggestionV2 } from '../recognition/types'
import { timePointDisplayValue } from '../recognition/recognitionModePresentation'

/** Presentation only: keep uncertainty and date precision; never infer an endpoint. */
export function reviewEventTime(start?: TimePointSuggestionV2, end?: TimePointSuggestionV2): string {
  if (!start && !end) return '原文未说明时间'
  const label = (point: TimePointSuggestionV2) => point.needsConfirmation
    ? `${point.rawText || timePointDisplayValue(point.normalizedValue, '')}（待核对）`
    : timePointDisplayValue(point.normalizedValue, point.rawText)
  if (!start) return `结束：${label(end!)}`
  if (!end) return `${label(start)} · 结束时间未说明`
  const a = start.normalizedValue, b = end.normalizedValue
  if (!start.needsConfirmation && !end.needsConfirmation && a && b
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(a) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(b)
    && a.slice(0, 10) === b.slice(0, 10)) return `${label(start)}–${b.slice(11)}`
  return `${label(start)} → ${label(end)}`
}
