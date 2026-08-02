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

  it('removes connector noise while preserving six independent events', () => {
    const results = createSuggestions(
      '学院通知：8月3日 9:00参加说明会，11:30前提交报名表和确认函；同日15:00找导师签字。8月5日 20:00提交作品初稿。8月8日晚上8点上传最终版，并在8月9日10:00完成系统确认。',
      'text',
      undefined,
      new Date('2026-08-02T08:00:00+08:00'),
    )

    expect(results).toHaveLength(6)
    expect(results.map((item) => item.title)).toEqual([
      '参加说明会',
      '提交报名表和确认函',
      '找导师签字',
      '提交作品初稿',
      '上传最终版',
      '完成系统确认',
    ])
    expect(results.map((item) => item.deadline)).toEqual([
      '2026-08-03T09:00',
      '2026-08-03T11:30',
      '2026-08-03T15:00',
      '2026-08-05T20:00',
      '2026-08-08T20:00',
      '2026-08-09T10:00',
    ])
  })

  it('creates separate tasks for bullet items under one date heading', () => {
    const results = createSuggestions(
      '比赛通知：8月6日安排如下：\n1. 提交报名表\n2. 联系指导老师\n3. 上传确认函',
      'text',
      undefined,
      new Date('2026-08-02T08:00:00+08:00'),
    )

    expect(results).toHaveLength(3)
    expect(results.map((item) => item.title)).toEqual([
      '提交报名表',
      '联系指导老师',
      '上传确认函',
    ])
    expect(results.every((item) => item.deadline === '2026-08-06T18:00')).toBe(true)
    expect(results.every((item) => item.category === '比赛')).toBe(true)
  })

  it('does not split a time range into duplicate tasks', () => {
    const results = createSuggestions(
      '8月7日 9:00-10:30参加项目说明会；8月7日 18:00提交报名表。',
      'text',
      undefined,
      new Date('2026-08-02T08:00:00+08:00'),
    )

    expect(results).toHaveLength(2)
    expect(results[0].title).toContain('参加项目说明会')
    expect(results[1].title).toBe('提交报名表')
  })

  it('understands relative dates with a deterministic reference time', () => {
    const results = createSuggestions(
      '明天上午9点参加课程答疑，后天20:00提交作业，下周一下午3点联系老师。',
      'text',
      undefined,
      new Date('2026-08-05T08:00:00+08:00'),
    )

    expect(results.map((item) => item.deadline)).toEqual([
      '2026-08-06T09:00',
      '2026-08-07T20:00',
      '2026-08-10T15:00',
    ])
  })

  it('removes greetings, reported speech, emphasis and polite endings from titles', () => {
    const results = createSuggestions(
      '各位同学大家好，老师提醒一下：请大家务必于8月10日18:00前提交报名表，谢谢大家！另外，麻烦各位在8月12日上午9点参加说明会，届时不要迟到哈。',
      'text',
      undefined,
      new Date('2026-08-02T08:00:00+08:00'),
    )

    expect(results).toHaveLength(2)
    expect(results.map((item) => item.title)).toEqual([
      '提交报名表',
      '参加说明会',
    ])
  })

  it('turns object-first chat instructions into concise action titles', () => {
    const results = createSuggestions(
      '友情提醒：明天中午12点前，请同学们把最终版作品上传到系统；后天下午3点需要将确认函发送至学院邮箱，收到请回复。',
      'text',
      undefined,
      new Date('2026-08-02T08:00:00+08:00'),
    )

    expect(results.map((item) => item.title)).toEqual([
      '上传最终版作品到系统',
      '发送确认函至学院邮箱',
    ])
  })

  it('uses the actionable clause instead of surrounding conversational filler', () => {
    const result = createSuggestion(
      '那个，老师说下周一下午2点要核对推免材料，辛苦大家啦。',
      'text',
      undefined,
      new Date('2026-08-02T08:00:00+08:00'),
    )

    expect(result.title).toBe('核对推免材料')
    expect(result.nextAction).toBe('开始处理：核对推免材料')
  })

  it('removes attention prompts and trailing softeners from same-day multi-task messages', () => {
    const results = createSuggestions(
      '老师通知一下哈，请大家务必注意：8月10日 9:00 提交报名表，谢谢；8月10日 14:00 参加说明会哈；8月12日 18:00 前请把确认函上传一下，谢谢。',
      'text',
      undefined,
      new Date('2026-08-02T08:00:00+08:00'),
    )

    expect(results).toHaveLength(3)
    expect(results.map((item) => item.title)).toEqual([
      '提交报名表',
      '参加说明会',
      '上传确认函',
    ])
  })
})
