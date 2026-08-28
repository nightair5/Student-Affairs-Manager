import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyFile,
  extractFileContent,
  extractFileEvidence,
  MAX_EXTRACTED_TEXT_LENGTH,
  MAX_LOCAL_FILE_BYTES,
  normalizeExtractedText,
} from './fileExtraction'

const terminate = vi.fn(async () => undefined)
const recognize = vi.fn(async () => ({ data: { text: ' 8月10日上午9点参加说明会。 ', confidence: 72 } }))
const getDocument = vi.fn()
type OcrLogger = (event: { status: string; progress: number }) => void
let ocrLogger: OcrLogger | undefined
const createWorker = vi.fn(async (
  _languages: string[],
  _oem: number,
  options?: { logger?: OcrLogger },
) => {
  ocrLogger = options?.logger
  return { recognize, terminate }
})

vi.mock('tesseract.js', () => ({
  OEM: { LSTM_ONLY: 1 },
  createWorker,
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument,
}))

function mockPdf(pageTexts: string[]) {
  const pages = pageTexts.map((text) => ({
    cleanup: vi.fn(),
    getTextContent: vi.fn(async () => ({ items: text ? [{ str: text }] : [] })),
    getViewport: vi.fn(() => ({ width: 100, height: 120 })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
  }))
  const document = {
    numPages: pages.length,
    cleanup: vi.fn(async () => undefined),
    getPage: vi.fn(async (pageNumber: number) => pages[pageNumber - 1]),
  }
  getDocument.mockReturnValue({ promise: Promise.resolve(document) })
  return document
}

beforeEach(() => {
  recognize.mockReset()
  recognize.mockResolvedValue({ data: { text: ' 8月10日上午9点参加说明会。 ', confidence: 72 } })
  terminate.mockClear()
  createWorker.mockClear()
  ocrLogger = undefined
  getDocument.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('keeps the bounded text while extraction reports truncation separately', async () => {
    const file = new File(['甲'.repeat(MAX_EXTRACTED_TEXT_LENGTH + 8)], 'long.txt', { type: 'text/plain' })
    const result = await extractFileContent(file)

    expect(result.text).toHaveLength(MAX_EXTRACTED_TEXT_LENGTH)
    expect(result).toMatchObject({ status: 'ready', partialExtraction: true })
    expect(result.qualityFlags).toEqual([expect.stringContaining('50,000')])
    expect(result.message).toContain('仅保留前段')
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
      extractionMethod: 'ocr',
      ocrConfidence: 0.72,
    })
    expect(messages[0]).toContain('OCR 模型')
    expect(recognize).toHaveBeenCalledWith(file)
    expect(terminate).toHaveBeenCalled()
  })

  it.each([101, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not clamp invalid OCR confidence %s into a plausible value',
    async (confidence) => {
      recognize.mockResolvedValueOnce({ data: { text: '需要人工核对', confidence } })
      const file = new File([new Uint8Array([1])], 'notice.png', { type: 'image/png' })

      const result = await extractFileContent(file)

      expect(result.status).toBe('ready')
      expect(result.ocrConfidence).toBeUndefined()
    },
  )

  it.each([[0, 0], [100, 1]])('keeps valid OCR boundary confidence %s as %s', async (confidence, expected) => {
    recognize.mockResolvedValueOnce({ data: { text: '需要人工核对', confidence } })
    const file = new File([new Uint8Array([1])], 'notice.png', { type: 'image/png' })

    await expect(extractFileContent(file)).resolves.toMatchObject({ ocrConfidence: expected })
  })

  it('marks a mixed PDF with empty text-layer pages as partial evidence', async () => {
    mockPdf(['第一页通知正文', '', '第三页补充说明'])
    const file = new File([new Uint8Array([1, 2, 3])], 'mixed.pdf', { type: 'application/pdf' })

    const result = await extractFileContent(file)

    expect(result).toMatchObject({
      status: 'ready',
      pageCount: 3,
      extractionMethod: 'parser',
      partialExtraction: true,
    })
    expect(result.qualityFlags).toEqual([expect.stringContaining('1 页未读到文本层')])
    expect(result.message).toContain('不完整证据')
    expect(recognize).not.toHaveBeenCalled()
  })

  it('marks scanned PDF OCR page limits instead of presenting the result as complete', async () => {
    mockPdf(Array.from({ length: 7 }, () => ''))
    vi.stubGlobal('window', {
      document: {
        createElement: () => ({
          width: 0,
          height: 0,
          getContext: () => ({}),
        }),
      },
    })
    const file = new File([new Uint8Array([1, 2, 3])], 'scan.pdf', { type: 'application/pdf' })

    const result = await extractFileContent(file)

    expect(result).toMatchObject({
      status: 'ready',
      pageCount: 7,
      extractionMethod: 'ocr',
      partialExtraction: true,
    })
    expect(result.ocrConfidence).toBeCloseTo(0.72)
    expect(result.qualityFlags).toEqual([expect.stringContaining('仅处理前 6 页')])
    expect(recognize).toHaveBeenCalledTimes(6)
  })

  it('drops a stale generation before its extraction result can be returned', async () => {
    let resolveText: (value: string) => void = () => undefined
    const text = new Promise<string>((resolve) => { resolveText = resolve })
    const file = new File([], 'first.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'text', { value: () => text })
    let current = true

    const pending = extractFileEvidence(file, { isCurrent: () => current })
    current = false
    resolveText('旧文件正文')

    await expect(pending).resolves.toBeNull()
  })

  it('suppresses progress emitted by a stale OCR generation', async () => {
    let resolveRecognition: (value: { data: { text: string; confidence: number } }) => void = () => undefined
    const recognition = new Promise<{ data: { text: string; confidence: number } }>((resolve) => {
      resolveRecognition = resolve
    })
    recognize.mockReturnValueOnce(recognition)
    const file = new File([new Uint8Array([1])], 'first.png', { type: 'image/png' })
    const messages: string[] = []
    let current = true

    const pending = extractFileEvidence(file, {
      isCurrent: () => current,
      onProgress: ({ message }) => messages.push(message),
    })
    await vi.waitFor(() => expect(ocrLogger).toBeTypeOf('function'))
    ocrLogger?.({ status: 'recognizing text', progress: 0.25 })
    const currentMessageCount = messages.length
    current = false
    ocrLogger?.({ status: 'recognizing text', progress: 0.75 })
    resolveRecognition({ data: { text: '旧文件正文', confidence: 72 } })

    await expect(pending).resolves.toBeNull()
    expect(messages).toHaveLength(currentMessageCount)
  })

  it('drops a stale generation while its hash is still pending', async () => {
    let resolveBytes: (value: ArrayBuffer) => void = () => undefined
    let markHashStarted: () => void = () => undefined
    const hashStarted = new Promise<void>((resolve) => { markHashStarted = resolve })
    const bytes = new Promise<ArrayBuffer>((resolve) => { resolveBytes = resolve })
    const file = new File([], 'first.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'text', { value: async () => '旧文件正文' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => {
        markHashStarted()
        return bytes
      },
    })
    let current = true

    const pending = extractFileEvidence(file, { isCurrent: () => current })
    await hashStarted
    current = false
    resolveBytes(new Uint8Array([1, 2, 3]).buffer)

    await expect(pending).resolves.toBeNull()
  })
})
