import { describe, expect, it } from 'vitest'
import { createSuggestion } from './parser'

describe('demo parser', () => {
  it('infers a competition category and listed materials', () => {
    const result = createSuggestion(
      '比赛报名截止 2026年8月4日18:00，请提交报名表和确认函。',
      'text',
    )
    expect(result.category).toBe('比赛')
    expect(result.materials).toEqual(['报名表', '确认函'])
    expect(result.deadline).toBe('2026-08-04T18:00')
  })

  it('keeps file-only parsing transparent', () => {
    const result = createSuggestion('', 'file', '课程作业说明.pdf')
    expect(result.confidence).toBe('低')
    expect(result.evidence).toContain('课程作业说明.pdf')
  })
})
