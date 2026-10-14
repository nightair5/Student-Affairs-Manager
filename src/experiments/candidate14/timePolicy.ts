import { parseChineseTimeAst } from '../../lib/timeSemantics'
import type { SemanticInput } from '../mainline04/semanticContract'

export const CANDIDATE14_TIME_POLICY_VERSION = 'candidate14-time-policy-1.1.0' as const
const tentative = /(暂定|拟于|拟定|预计|计划于|另行通知|待通知|待定|暂未确定)/u
const broadPeriod = /(清晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|凌晨)/u
const explicitClock = /(?:(?:\d{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:点|时)(?:\s*(?:半|\d{1,2}分))?|\d{1,2}\s*[:：]\s*\d{2})/u

export function normalizeCandidate14Time(
  rawText: string,
  type: SemanticInput['timePoints'][number]['type'],
  referenceTime: string,
  timezone: string,
) {
  const base = parseChineseTimeAst(rawText, { type, referenceTime, timezone })
  const isTentative = tentative.test(rawText)
  const periodWithoutClock = broadPeriod.test(rawText) && !explicitClock.test(rawText)
  const unknown = /(另行通知|待通知|待定|暂未确定)/u.test(rawText)
  const nonAllDayPeriod = unknown || periodWithoutClock
  return {
    ...base,
    normalizedValue: unknown ? null : base.normalizedValue,
    isAllDay: nonAllDayPeriod ? false : base.isAllDay,
    precision: unknown || periodWithoutClock ? 'vague' as const : base.precision,
    needsConfirmation: base.needsConfirmation || isTentative || periodWithoutClock || unknown,
    uncertainty: unknown ? 'unknown' as const : isTentative ? 'tentative' as const : periodWithoutClock ? 'broad_period' as const : 'none' as const,
  }
}
