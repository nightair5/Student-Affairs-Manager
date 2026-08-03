import { createSuggestions } from './parser'
import type { ParsedSuggestion, Source, SourceType } from '../types'

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
