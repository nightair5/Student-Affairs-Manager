import { describe, expect, it } from 'vitest'
import { createIntakeResult } from './intake'

describe('intake result', () => {
  it('creates one traceable source and multiple independent suggestions', () => {
    const result = createIntakeResult({
      sourceType: 'text',
      content: '8月3日9:00参加说明会，8月4日18:00提交报名表。',
      now: new Date('2026-08-02T08:00:00+08:00'),
    })

    expect(result.source.title).toBe('手动粘贴消息')
    expect(result.source.content).toContain('参加说明会')
    expect(result.suggestions).toHaveLength(2)
  })
})
