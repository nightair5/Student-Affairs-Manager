import { isRecognitionResult } from '../../recognition/schema'
import type { RecognitionResult } from '../../recognition/types'

export const LEGACY_DIAGNOSTIC_COMPATIBILITY = 'legacy-draft-diagnostics-1'
const reasons = new Set(['background', 'contact', 'address', 'policy', 'format_requirement', 'other'])
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max: number, empty = false): value is string => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0)
const strings = (value: unknown, max: number): value is string[] => Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string')

/** Only used while migrating a backed-up v7 snapshot. Never repairs model facts,
 * current v8 records, references, or a live provider response. The caller retains
 * the complete original draft in legacyData.v7Record and the v7 backup. */
export function repairLegacyDraftDiagnostics(value: unknown): { result: RecognitionResult; paths: string[]; blocksConfirmation: boolean } | null {
  if (isRecognitionResult(value) || !record(value) || !Array.isArray(value.ambiguities) || !Array.isArray(value.ignoredContent)) return null
  const candidate = structuredClone(value)
  const paths: string[] = []
  let blocksConfirmation = false
  candidate.ambiguities = value.ambiguities.map((item, index) => {
    if (record(item) && text(item.id, 100) && text(item.field, 100) && text(item.message, 500)
      && strings(item.options, 20) && strings(item.evidenceIds, 20)) return item
    paths.push(`ambiguities[${index}]`)
    blocksConfirmation = true
    const old = record(item) ? item : {}
    return {
      id: text(old.id, 100) ? old.id : `legacy-diagnostic-${index}`,
      field: text(old.field, 100) ? old.field : '旧版核对说明',
      message: text(old.message, 500) ? old.message : text(old.question, 500) ? old.question : '这条旧版说明无法完整还原，请查看原文后核对。',
      options: strings(old.options, 20) ? old.options : [],
      evidenceIds: strings(old.evidenceIds, 20) ? old.evidenceIds : [],
    }
  })
  candidate.ignoredContent = value.ignoredContent.map((item, index) => {
    if (record(item) && text(item.text, 1000, true) && reasons.has(String(item.reason))) return item
    paths.push(`ignoredContent[${index}]`)
    const old = record(item) ? item : {}
    return {
      text: text(old.text, 1000, true) ? old.text : text(old.content, 1000, true) ? old.content : text(old.quote, 1000, true) ? old.quote : '',
      reason: reasons.has(String(old.reason)) ? old.reason : 'other',
    }
  })
  // This also proves there are no other schema, reference, or semantic failures.
  if (!paths.length || !isRecognitionResult(candidate)) return null
  if (blocksConfirmation) {
    let id = 'legacy-diagnostic-review'
    while (candidate.conflicts.some(item => item.id === id)) id += '-1'
    candidate.conflicts.push({
      id, type: 'other', message: '这份旧建议的核对说明尚未还原，请查看原文或重新识别后再添加。',
      entityTempIds: [], evidenceIds: [], requiresDecision: true,
    })
  }
  candidate.quality = { ...candidate.quality, needsHumanReview: true,
    reviewReasons: [...candidate.quality.reviewReasons.slice(0, 19), '旧版附注已兼容，原始记录完整保留。'] }
  return isRecognitionResult(candidate) ? { result: candidate, paths, blocksConfirmation } : null
}
