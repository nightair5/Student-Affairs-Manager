import { describe, expect, it } from 'vitest'
import { canSubmitIntake, createIntakeResult, type IntakeSubmissionState } from './intake'

const fileSubmission = (overrides: Partial<IntakeSubmissionState> = {}): IntakeSubmissionState => ({
  manualMode: false,
  manualTitle: '',
  manualDeadline: '',
  manualNextAction: '',
  sourceType: 'file',
  content: '',
  fileStatus: 'idle',
  fileName: '通知.pdf',
  linkUrl: '',
  ...overrides,
})

describe('intake submission gate', () => {
  it('allows an OCR error after the user supplies non-empty source text', () => {
    expect(canSubmitIntake(fileSubmission({
      sourceType: 'image',
      fileName: '截图.png',
      fileStatus: 'error',
      content: '  8 月 10 日前提交报名表。  ',
    }))).toBe(true)
  })

  it('allows a scanned or damaged PDF error after the user supplies non-empty source text', () => {
    expect(canSubmitIntake(fileSubmission({
      fileStatus: 'error',
      content: '请于 8 月 12 日参加说明会。',
    }))).toBe(true)
  })

  it('keeps extraction errors blocked while the manual source text is empty', () => {
    expect(canSubmitIntake(fileSubmission({ fileStatus: 'error', content: ' \n\t ' }))).toBe(false)
  })

  it('keeps submission blocked while local extraction is still reading', () => {
    expect(canSubmitIntake(fileSubmission({
      fileStatus: 'reading',
      content: '用户提前输入的原文',
    }))).toBe(false)
  })
})

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
