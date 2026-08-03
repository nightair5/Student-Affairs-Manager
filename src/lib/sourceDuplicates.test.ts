import { describe, expect, it } from 'vitest'
import type { Source } from '../types'
import { findDuplicateSources } from './sourceDuplicates'

const source = (id: string, title: string, contentPreview: string): Source => ({
  id,
  type: 'text',
  title,
  contentPreview,
  createdAt: '2026-08-01T10:00:00+08:00',
  extractionStatus: '待确认',
})

describe('findDuplicateSources', () => {
  it('提示标题和正文高度相似的来源', () => {
    const incoming = source('new', '学院推免通知', '8 月 12 日前提交成绩单和个人陈述')
    const existing = source('old', '学院推免通知', '8月12日前提交成绩单和个人陈述。')
    expect(findDuplicateSources(incoming, [existing])[0]).toMatchObject({
      sourceId: 'old',
      reason: '标题相同，正文摘要也可能重复',
    })
  })

  it('不把普通相似词误判为重复来源', () => {
    const incoming = source('new', '课程作业', '周五提交阅读笔记')
    const existing = source('old', '比赛报名', '周五提交团队报名表')
    expect(findDuplicateSources(incoming, [existing])).toEqual([])
  })

  it('优先识别完全相同的文件指纹和规范化链接', () => {
    const fileIncoming = { ...source('file-new', '新文件名', '短摘要'), type: 'file' as const, fileHash: 'same-hash' }
    const fileExisting = { ...source('file-old', '旧文件名', '另一摘要'), type: 'file' as const, fileHash: 'same-hash' }
    expect(findDuplicateSources(fileIncoming, [fileExisting])[0]?.reason).toBe('文件指纹完全相同')

    const linkIncoming = { ...source('link-new', '链接', ''), type: 'link' as const, url: 'https://example.com/notice/?b=2&a=1#top' }
    const linkExisting = { ...source('link-old', '另一个标题', ''), type: 'link' as const, url: 'https://example.com/notice?a=1&b=2' }
    expect(findDuplicateSources(linkIncoming, [linkExisting])[0]?.reason).toBe('网页链接相同')
  })
})
