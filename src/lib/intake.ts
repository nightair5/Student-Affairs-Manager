import { createSuggestions } from './parser'
import type { ParsedSuggestion, Source, SourceType } from '../types'
import type { FileExtractionStatus } from './fileExtraction'

export type IntakeFileStatus = FileExtractionStatus | 'idle' | 'reading'

export interface IntakeSubmissionState {
  manualMode: boolean
  manualTitle: string
  manualDeadline: string
  manualNextAction: string
  sourceType: SourceType
  content: string
  fileStatus: IntakeFileStatus
  fileName: string
  linkUrl: string
}

export interface IntakeInput {
  sourceType: SourceType
  content: string
  sourceTitle?: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  fileHash?: string
  url?: string
  manualSuggestion?: ParsedSuggestion
  now?: Date
}

export interface IntakeResult {
  source: Source
  suggestions: ParsedSuggestion[]
}

export function canSubmitIntake({
  manualMode,
  manualTitle,
  manualDeadline,
  manualNextAction,
  sourceType,
  content,
  fileStatus,
  fileName,
  linkUrl,
}: IntakeSubmissionState): boolean {
  if (manualMode) {
    return Boolean(manualTitle.trim() && manualDeadline && manualNextAction.trim())
  }

  if (sourceType === 'file' || sourceType === 'image') {
    if (fileStatus === 'idle' || fileStatus === 'reading' || fileStatus === 'unsupported') return false
    return Boolean(fileName && content.trim())
  }

  if (sourceType === 'link') {
    return Boolean(linkUrl.trim() && content.trim())
  }

  return Boolean(content.trim())
}

export function createIntakeResult({
  sourceType,
  content,
  sourceTitle,
  fileName,
  mimeType,
  fileSize,
  fileHash,
  url,
  manualSuggestion,
  now = new Date(),
}: IntakeInput): IntakeResult {
  const cleanContent = content.trim().slice(0, 50_000)
  const title = sourceTitle?.trim()
    || fileName?.trim()
    || (sourceType === 'link' ? '网页通知链接' : '手动粘贴消息')
  return {
    source: {
      id: `source-${now.getTime()}`,
      type: sourceType,
      title,
      contentPreview: cleanContent.slice(0, 500),
      content: cleanContent || undefined,
      rawText: cleanContent || undefined,
      url: sourceType === 'link' ? url?.trim() : undefined,
      originalFileName: fileName?.trim() || undefined,
      mimeType: mimeType || undefined,
      fileSize,
      fileHash,
      status: 'needs_review',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      extractionStatus: '待确认',
      extractionMethod: 'local-rules',
      parserVersion: 'local-rules-v2',
    },
    suggestions: manualSuggestion ? [{ ...manualSuggestion }] : createSuggestions(cleanContent, sourceType, title, now),
  }
}
