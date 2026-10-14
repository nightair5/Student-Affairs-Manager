import { parseChineseTimeAst } from '../../lib/timeSemantics'
import type { SemanticTime } from '../mainline04/semanticContract'

/** Convert only the user's quoted time; source/object validation stays in the public correction path. */
export function reviewTimeEvidence(time: SemanticTime, referenceTime: string, timezone: string): SemanticTime {
  const ast = parseChineseTimeAst(time.rawText, { type: time.type, referenceTime, timezone })
  if (ast.issues.some(issue => !['date_missing', 'time_not_found'].includes(issue))) {
    throw new Error('TIME_EVIDENCE_REQUIRES_REVIEW')
  }
  return {
    ...time,
    normalizedValue: ast.normalizedValue,
    isAllDay: ast.isAllDay,
    precision: ast.precision,
    needsConfirmation: ast.needsConfirmation,
    timezone,
  }
}
