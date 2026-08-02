import type { IntakeInput, IntakeResult } from './intake'
import { createIntakeResult } from './intake'
import type { ParsedSuggestion } from '../types'

export type SmartExtractionMethod = 'deepseek-v4-flash' | 'local-rules'

export interface SmartIntakeResult extends IntakeResult {
  method: SmartExtractionMethod
  fallbackReason?: string
}

export interface DeepSeekExtractionService {
  status(): Promise<{ configured: boolean; model?: string }>
  extract(input: IntakeInput): Promise<ParsedSuggestion[]>
}

function serverMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback
  const message = (value as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message : fallback
}

function isSuggestion(value: unknown): value is ParsedSuggestion {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<ParsedSuggestion>
  return typeof item.id === 'string'
    && typeof item.title === 'string'
    && ['比赛', '保研', '课程', '老师任务', '其他'].includes(item.category ?? '')
    && typeof item.deadline === 'string'
    && typeof item.estimatedMinutes === 'number'
    && typeof item.nextAction === 'string'
    && typeof item.description === 'string'
    && ['高', '中', '低'].includes(item.priority ?? '')
    && Array.isArray(item.materials)
    && typeof item.evidence === 'string'
    && ['高', '中', '低'].includes(item.confidence ?? '')
}

export class ProxyDeepSeekExtractionService implements DeepSeekExtractionService {
  constructor(private readonly endpoint = '/api/deepseek') {}

  async status(): Promise<{ configured: boolean; model?: string }> {
    try {
      const response = await fetch(`${this.endpoint}/status`, { headers: { Accept: 'application/json' } })
      if (!response.ok) return { configured: false }
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null) return { configured: false }
      const record = data as { configured?: unknown; model?: unknown }
      return {
        configured: record.configured === true,
        model: typeof record.model === 'string' ? record.model : undefined,
      }
    } catch {
      return { configured: false }
    }
  }

  async extract(input: IntakeInput): Promise<ParsedSuggestion[]> {
    const response = await fetch(`${this.endpoint}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sourceType: input.sourceType,
        sourceTitle: input.sourceTitle ?? input.fileName ?? '',
        content: input.content,
        referenceTime: (input.now ?? new Date()).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      }),
    })
    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) throw new Error(serverMessage(data, 'DeepSeek 智能整理暂时不可用'))
    if (typeof data !== 'object' || data === null) throw new Error('DeepSeek 返回了无法识别的结果')
    const suggestions = (data as { suggestions?: unknown }).suggestions
    if (!Array.isArray(suggestions) || !suggestions.length || !suggestions.every(isSuggestion)) {
      throw new Error('DeepSeek 返回的任务结构不完整')
    }
    return suggestions
  }
}

export async function createSmartIntakeResult(
  input: IntakeInput,
  service: DeepSeekExtractionService,
): Promise<SmartIntakeResult> {
  const localResult = createIntakeResult(input)
  if (input.sourceType === 'link') {
    return { ...localResult, method: 'local-rules', fallbackReason: '网页正文尚未抓取，仅保存链接。' }
  }
  try {
    const suggestions = await service.extract(input)
    return {
      source: { ...localResult.source, extractionMethod: 'deepseek-v4-flash' },
      suggestions,
      method: 'deepseek-v4-flash',
    }
  } catch (error) {
    return {
      ...localResult,
      method: 'local-rules',
      fallbackReason: error instanceof Error ? error.message : 'DeepSeek 智能整理暂时不可用',
    }
  }
}
