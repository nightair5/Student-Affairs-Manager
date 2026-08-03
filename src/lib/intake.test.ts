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
    expect(result.source.extractionMethod).toBe('local-rules')
    expect(result.suggestions).toHaveLength(2)
  })


  it('keeps non-binary file metadata for duplicate checks and traceability', () => {
    const result = createIntakeResult({
      sourceType: 'file',
      content: '通知正文',
      fileName: '通知.txt',
      mimeType: 'text/plain',
      fileSize: 128,
      fileHash: 'abc123',
      now: new Date('2026-08-02T08:00:00+08:00'),
    })
    expect(result.source).toMatchObject({
      originalFileName: '通知.txt',
      mimeType: 'text/plain',
      fileSize: 128,
      fileHash: 'abc123',
    })
  })

  it('keeps an authorized link and its extracted text as separate traceable fields', () => {
    const result = createIntakeResult({
      sourceType: 'link',
      url: 'https://notice.example/item',
      sourceTitle: '学院通知',
      content: '8月10日18:00提交报名表',
      now: new Date('2026-08-02T08:00:00+08:00'),
    })
    expect(result.source.url).toBe('https://notice.example/item')
    expect(result.source.rawText).toBe('8月10日18:00提交报名表')
    expect(result.suggestions[0].title).toBe('提交报名表')
  })
})
