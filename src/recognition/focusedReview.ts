import type { RecognitionResult } from './types'
import type { SourceReviewMetadata } from '../types'

export const FOCUSED_REVIEW_THRESHOLDS = Object.freeze({
  mediumTaskCount: 5,
  highTaskCount: 10,
  longTextCharacters: 12_000,
  longDocumentPages: 8,
  lowOcrConfidence: 0.8,
})

export type FocusedReviewSection = 'source' | 'tasks' | 'materials' | 'timePoints' | 'events'

export type FocusedReviewReasonCode =
  | 'multiple_deadlines'
  | 'multiple_materials'
  | 'event_schedule'
  | 'ambiguities'
  | 'conflicts'
  | 'task_volume'
  | 'long_text'
  | 'long_document'
  | 'low_ocr_confidence'
  | 'quality_flags'

export interface FocusedReviewReason {
  code: FocusedReviewReasonCode
  title: string
  detail: string
  sections: FocusedReviewSection[]
}

export interface FocusedReviewAssessment {
  needsFocusedReview: boolean
  reasons: FocusedReviewReason[]
  expandedSections: FocusedReviewSection[]
  qualityFlags: string[]
  counts: {
    tasks: number
    deadlines: number
    materials: number
    events: number
    ambiguities: number
    conflicts: number
  }
  sourceMetadata: SourceReviewMetadata
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function optionalInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : undefined
}

function optionalConfidence(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined
  if (value <= 1) return value
  if (value <= 100) return value / 100
  return undefined
}

function qualityFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((item) => item.slice(0, 200)))]
}

/**
 * Accepts persisted legacyData as untrusted JSON and returns only bounded UI metadata.
 * Missing fields remain absent so old workspaces keep working without synthetic values.
 */
export function normalizeFocusedReviewSourceMetadata(value: unknown): SourceReviewMetadata {
  const candidate = record(value)
  if (!candidate) return {}
  const sourceType = ['text', 'file', 'image', 'link'].includes(String(candidate.sourceType))
    ? candidate.sourceType as SourceReviewMetadata['sourceType']
    : undefined
  const extractionMethod = ['manual', 'parser', 'ocr', 'web', 'unknown'].includes(String(candidate.extractionMethod))
    ? candidate.extractionMethod as SourceReviewMetadata['extractionMethod']
    : undefined
  const mimeType = typeof candidate.mimeType === 'string' && candidate.mimeType.length <= 200
    ? candidate.mimeType
    : undefined
  const characterCount = optionalInteger(candidate.characterCount, 0, 1_000_000)
  const pageCount = optionalInteger(candidate.pageCount, 1, 10_000)
  const ocrConfidence = optionalConfidence(candidate.ocrConfidence)
  const flags = qualityFlags(candidate.qualityFlags)
  return {
    ...(sourceType ? { sourceType } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(characterCount !== undefined ? { characterCount } : {}),
    ...(pageCount !== undefined ? { pageCount } : {}),
    ...(extractionMethod ? { extractionMethod } : {}),
    ...(ocrConfidence !== undefined ? { ocrConfidence } : {}),
    ...(typeof candidate.partialExtraction === 'boolean'
      ? { partialExtraction: candidate.partialExtraction }
      : {}),
    ...(flags.length ? { qualityFlags: flags } : {}),
  }
}

function allTasks(result: RecognitionResult) {
  return [
    ...result.standaloneTasks,
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks,
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
    ]),
  ]
}

function dedupeSections(reasons: FocusedReviewReason[]): FocusedReviewSection[] {
  const ordered: FocusedReviewSection[] = ['source', 'tasks', 'materials', 'timePoints', 'events']
  const requested = new Set(reasons.flatMap((reason) => reason.sections))
  return ordered.filter((section) => requested.has(section))
}

/**
 * Deterministic UI-only assessment. It never mutates RecognitionResult, selections,
 * or canonical facts; callers may only use the result for prompts and expansion.
 */
export function assessFocusedReview(
  result: RecognitionResult,
  sourceMetadata: SourceReviewMetadata | null | undefined,
): FocusedReviewAssessment {
  const metadata = normalizeFocusedReviewSourceMetadata(sourceMetadata)
  const tasks = allTasks(result)
  const deadlines = result.timePoints.filter((point) => [
    'registration_deadline',
    'submission_deadline',
    'task_deadline',
  ].includes(point.type))
  const flags = [...new Set([
    ...(metadata.qualityFlags ?? []),
    ...(metadata.partialExtraction ? ['文档仅部分提取'] : []),
    ...result.quality.reviewReasons.map((item) => item.trim()).filter(Boolean),
  ])]
  const reasons: FocusedReviewReason[] = []
  const add = (reason: FocusedReviewReason) => reasons.push(reason)

  if (deadlines.length >= 2) add({
    code: 'multiple_deadlines', title: '多个明确截止时间',
    detail: `识别到 ${deadlines.length} 个截止节点，请逐一核对日期、时刻和对应事项。`,
    sections: ['source', 'timePoints'],
  })
  if (result.materials.length >= 2) add({
    code: 'multiple_materials', title: '多项材料要求',
    detail: `识别到 ${result.materials.length} 项材料，请核对格式、数量和提交渠道。`,
    sections: ['source', 'materials'],
  })
  if (result.events.length >= 1) add({
    code: 'event_schedule', title: '包含事件安排',
    detail: `识别到 ${result.events.length} 个事件，请核对开始时间、地点和是否需要创建。`,
    sections: ['source', 'events', 'timePoints'],
  })
  if (result.ambiguities.length >= 1) add({
    code: 'ambiguities', title: '存在待澄清信息',
    detail: `${result.ambiguities.length} 项字段存在歧义，需要依据原文人工选择。`,
    sections: ['source', 'tasks', 'timePoints'],
  })
  if (result.conflicts.length >= 1) add({
    code: 'conflicts', title: '存在识别冲突',
    detail: `${result.conflicts.length} 项结果互相冲突，不会自动替你决定。`,
    sections: ['source', 'tasks', 'timePoints'],
  })
  if (tasks.length >= FOCUSED_REVIEW_THRESHOLDS.mediumTaskCount) add({
    code: 'task_volume', title: tasks.length >= FOCUSED_REVIEW_THRESHOLDS.highTaskCount ? '任务数量较多' : '任务数量中等',
    detail: `共识别 ${tasks.length} 项任务，请检查是否遗漏、重复或拆分过细。`,
    sections: ['source', 'tasks'],
  })
  if ((metadata.characterCount ?? 0) >= FOCUSED_REVIEW_THRESHOLDS.longTextCharacters) add({
    code: 'long_text', title: '原文较长',
    detail: `本次原文约 ${(metadata.characterCount ?? 0).toLocaleString('zh-CN')} 字，建议按依据逐项复核。`,
    sections: ['source'],
  })
  if ((metadata.pageCount ?? 0) >= FOCUSED_REVIEW_THRESHOLDS.longDocumentPages) add({
    code: 'long_document', title: '多页文档',
    detail: `文档共 ${metadata.pageCount} 页，请留意跨页材料、时间和补充说明。`,
    sections: ['source', 'materials', 'timePoints'],
  })
  if (metadata.ocrConfidence !== undefined
    && metadata.ocrConfidence < FOCUSED_REVIEW_THRESHOLDS.lowOcrConfidence) add({
    code: 'low_ocr_confidence', title: 'OCR 文字需校对',
    detail: `本机 OCR 可观测置信度为 ${Math.round(metadata.ocrConfidence * 100)}%，请先核对原文再确认建议。`,
    sections: ['source', 'tasks', 'materials', 'timePoints'],
  })
  if (flags.length >= 1) add({
    code: 'quality_flags', title: '存在质量标记',
    detail: `${flags.length} 项质量标记需要人工复核。`,
    sections: ['source', 'tasks'],
  })

  return {
    needsFocusedReview: reasons.length > 0,
    reasons,
    expandedSections: dedupeSections(reasons),
    qualityFlags: flags,
    counts: {
      tasks: tasks.length,
      deadlines: deadlines.length,
      materials: result.materials.length,
      events: result.events.length,
      ambiguities: result.ambiguities.length,
      conflicts: result.conflicts.length,
    },
    sourceMetadata: metadata,
  }
}
