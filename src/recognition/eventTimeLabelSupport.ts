export const EVENT_TIME_LABEL_SUPPORT_VERSION = 'event-time-label-context-1.0.0'

/** A label is never value evidence. Callers must separately prove an existing
 * event owner, its actual endpoint and the immediately following value scope. */
export function classifyEventTimeLabel(text: string): 'legacy' | 'operation-label' | null {
  const label = text.replace(/[\s，。；,:：;！!]/gu, '')
  if (/^(?:暂停|恢复|活动|开放(?:调整)?|停用|服务|考核|举办)?(?:开始|结束)?(?:时间|时段|日期)$/u.test(label)) return 'legacy'
  // Bounded nominal composition, never arbitrary neighbouring prose. In
  // particular, qualification, instructions and unpublished-value statements
  // are not allowed to serve as a pure label for exact endpoints.
  return /^(?:服务)?(?:暂停|恢复|开放|停用)(?:办理|运行|提供)(?:开始|结束)?(?:时间|时段|日期)$/u.test(label)
    ? 'operation-label' : null
}
