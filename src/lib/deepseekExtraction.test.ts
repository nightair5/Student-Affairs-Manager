import { describe, expect, it } from 'vitest'
import { createSmartIntakeResult, type DeepSeekExtractionService } from './deepseekExtraction'
import type { ParsedSuggestion } from '../types'

const aiSuggestion: ParsedSuggestion = {
  id: 'ai-1',
  title: '提交报名表',
  category: '比赛',
  deadline: '2026-08-10T18:00',
  estimatedMinutes: 30,
  nextAction: '核对报名表字段',
  description: '提交比赛报名表',
  priority: '中',
  materials: ['报名表'],
  evidence: '8月10日18:00提交报名表',
  confidence: '高',
}

function service(result: ParsedSuggestion[] | Error): DeepSeekExtractionService {
  return {
    status: async () => ({ configured: true, model: 'deepseek-v4-flash' }),
    extract: async () => {
      if (result instanceof Error) throw result
      return result
    },
  }
}

describe('smart intake', () => {
  it('uses DeepSeek suggestions while keeping the source locally traceable', async () => {
    const result = await createSmartIntakeResult({
      sourceType: 'text',
      content: '8月10日18:00提交报名表',
      now: new Date('2026-08-02T08:00:00+08:00'),
    }, service([aiSuggestion]))

    expect(result.method).toBe('deepseek-v4-flash')
    expect(result.source.extractionMethod).toBe('deepseek-v4-flash')
    expect(result.suggestions).toEqual([aiSuggestion])
  })

  it('falls back to local rules without losing the source when the proxy is unavailable', async () => {
    const result = await createSmartIntakeResult({
      sourceType: 'text',
      content: '8月10日18:00提交报名表',
      now: new Date('2026-08-02T08:00:00+08:00'),
    }, service(new Error('DeepSeek 尚未配置服务端密钥。')))

    expect(result.method).toBe('local-rules')
    expect(result.fallbackReason).toContain('尚未配置')
    expect(result.suggestions[0].title).toBe('提交报名表')
  })

  it('does not send a bare link to DeepSeek as if it were webpage content', async () => {
    let called = false
    const proxy: DeepSeekExtractionService = {
      status: async () => ({ configured: true }),
      extract: async () => { called = true; return [aiSuggestion] },
    }
    const result = await createSmartIntakeResult({
      sourceType: 'link', content: '', url: 'https://example.edu/notice', sourceTitle: '学院通知',
    }, proxy)

    expect(called).toBe(false)
    expect(result.method).toBe('local-rules')
    expect(result.fallbackReason).toContain('尚未读取')
  })

  it('sends only server-extracted link text to DeepSeek', async () => {
    let received = ''
    const proxy: DeepSeekExtractionService = {
      status: async () => ({ configured: true }),
      extract: async (input) => { received = input.content; return [aiSuggestion] },
    }
    const result = await createSmartIntakeResult({
      sourceType: 'link',
      content: '8月10日18:00提交报名表',
      url: 'https://example.edu/notice',
      sourceTitle: '学院通知',
    }, proxy)

    expect(received).toBe('8月10日18:00提交报名表')
    expect(result.method).toBe('deepseek-v4-flash')
  })
})
