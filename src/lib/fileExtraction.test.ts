import { describe, expect, it, vi } from 'vitest'
import { classifyFile, extractFileContent, MAX_LOCAL_FILE_BYTES, normalizeExtractedText } from './fileExtraction'

const terminate = vi.fn(async () => undefined)
const recognize = vi.fn(async () => ({ data: { text: ' 8月10日上午9点参加说明会。 ' } }))

vi.mock('tesseract.js', () => ({
  OEM: { LSTM_ONLY: 1 },
  createWorker: vi.fn(async () => ({ recognize, terminate })),
}))

describe('classifyFile', () => {
  it('识别文本、PDF 和图片', () => {
    expect(classifyFile('通知.txt', '')).toBe('text')
    expect(classifyFile('通知.MD', '')).toBe('text')
    expect(classifyFile('通知', 'application/pdf')).toBe('pdf')
    expect(classifyFile('截图.png', 'image/png')).toBe('image')
  })

  it('拒绝未接通的 Office 文件', () => {
    expect(
      classifyFile(
        '通知.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('unsupported')
  })
})

describe('normalizeExtractedText', () => {
  it('清理空字符和过多空行，同时保留段落', () => {
    expect(normalizeExtractedText('第一段\u0000  \n\n\n\n第二段')).toBe(
      '第一段\n\n第二段',
    )
  })
})

describe('file safety limits', () => {
  it('rejects oversized files before parsing', async () => {
    const file = new File([new Uint8Array(MAX_LOCAL_FILE_BYTES + 1)], 'large.txt', { type: 'text/plain' })
    await expect(extractFileContent(file)).resolves.toMatchObject({
      status: 'error',
      text: '',
    })
  })

  it('runs image OCR locally and returns editable text', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'notice.png', { type: 'image/png' })
    const messages: string[] = []
    const result = await extractFileContent(file, {
      onProgress: ({ message }) => messages.push(message),
    })

    expect(result).toMatchObject({
      status: 'ready',
      text: '8月10日上午9点参加说明会。',
    })
    expect(messages[0]).toContain('OCR 模型')
    expect(recognize).toHaveBeenCalledWith(file)
    expect(terminate).toHaveBeenCalled()
  })
})
