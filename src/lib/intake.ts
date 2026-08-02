import { createSuggestions } from './parser'
import type { ParsedSuggestion, Source, SourceType } from '../types'

export interface IntakeInput {
  sourceType: SourceType
  content: string
  sourceTitle?: string
  fileName?: string
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
      content: sourceType === 'link' ? undefined : cleanContent,
      url: sourceType === 'link' ? cleanContent : undefined,
      createdAt: now.toISOString(),
      extractionStatus: '待确认',
    },
    suggestions: createSuggestions(cleanContent, sourceType, title, now),
  }
}
