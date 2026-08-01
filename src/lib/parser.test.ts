import { describe, expect, it } from 'vitest'
import { createSuggestion, createSuggestions } from './parser'

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

  it('splits multiple dates into independent suggestions with local evidence', () => {
    const results = createSuggestions(
      '8月3日18:00提交比赛报名表；8月5日20:30交作品初稿；8月8日上午9点参加答辩。',
      'text',
    )

    expect(results).toHaveLength(3)
    expect(results.map((item) => item.deadline)).toEqual([
      '2026-08-03T18:00',
      '2026-08-05T20:30',
      '2026-08-08T09:00',
    ])
    expect(results[0].title).toContain('提交比赛报名表')
    expect(results[1].evidence).toBe('8月5日20:30交作品初稿')
    expect(results[2].description).toContain('参加答辩')
  })

  it('carries the date across multiple times on the same day', () => {
    const results = createSuggestions(
      '8月12日上午9点参加课程汇报，下午3点提交论文，晚上8点回复老师。',
      'text',
    )

    expect(results).toHaveLength(3)
    expect(results.map((item) => item.deadline)).toEqual([
      '2026-08-12T09:00',
      '2026-08-12T15:00',
      '2026-08-12T20:00',
    ])
    expect(results.map((item) => item.title)).toEqual([
      '参加课程汇报',
      '提交论文',
      '回复老师',
    ])
  })

  it('splits consecutive time points even without punctuation', () => {
    const results = createSuggestions(
      '9月1日上午9点开项目会 9月2日14:00提交材料',
      'text',
    )

    expect(results).toHaveLength(2)
    expect(results.map((item) => item.deadline)).toEqual([
      '2026-09-01T09:00',
      '2026-09-02T14:00',
    ])
    expect(results[0].title).toContain('开项目会')
    expect(results[1].title).toContain('提交材料')
  })
})
