import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyFile,
  decodeTextBytes,
  extractFileContent,
  extractFileEvidence,
  MAX_EXTRACTED_TEXT_LENGTH,
  MAX_LOCAL_FILE_BYTES,
  normalizeExtractedText,
} from './fileExtraction'
import { strToU8, zipSync } from 'fflate'

const terminate = vi.fn(async () => undefined)
const recognize = vi.fn(async () => ({ data: { text: ' 8月10日上午9点参加说明会。 ', confidence: 72 } }))
const getDocument = vi.fn()
type OcrLogger = (event: { status: string; progress: number }) => void
let ocrLogger: OcrLogger | undefined
const createWorker = vi.fn(async (
  _languages: string | string[],
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

function stubCanvas() {
  vi.stubGlobal('window', {
    document: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({}),
      }),
    },
  })
}

function docxFile(documentXml: string, relationships = ''): File {
  const bytes = zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(documentXml),
    'word/_rels/document.xml.rels': strToU8(relationships || '<Relationships/>'),
  })
  return new File([bytes], 'notice.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
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

  it('识别本机安全解析的 DOCX', () => {
    expect(
      classifyFile(
        '通知.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('docx')
  })
})

describe('text decoding and structure', () => {
  it('distinguishes UTF-8 BOM and GB18030 bytes', () => {
    expect(decodeTextBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0xe4, 0xb8, 0xad]))).toEqual({ text: '中', encoding: 'utf-8-bom' })
    expect(decodeTextBytes(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]))).toEqual({ text: '中文', encoding: 'gb18030' })
  })

  it('preserves Markdown headings, lists, tables, quotes and code fences', async () => {
    const markdown = '# 标题\n\n- 材料一\n\n| 时间 | 动作 |\n| --- | --- |\n| 9:00 | 提交 |\n\n> 注意\n\n```text\n不要压平\n```'
    const result = await extractFileContent(new File([markdown], 'notice.md', { type: 'text/markdown' }))
    expect(result).toMatchObject({ status: 'ready', text: markdown, encoding: 'utf-8' })
    expect(result.spans?.length).toBeGreaterThanOrEqual(5)
  })

  it('fails closed instead of passing undecodable mojibake', async () => {
    const result = await extractFileContent(new File([new Uint8Array([0x81])], 'bad.txt', { type: 'text/plain' }))
    expect(result).toMatchObject({ status: 'error', text: '' })
    expect(result.message).toContain('编码')
  })
})

describe('normalizeExtractedText', () => {
  it('清理空字符和过多空行，同时保留段落', () => {
    expect(normalizeExtractedText('第一段\u0000  \n\n\n\n第二段')).toBe(
      '第一段\n\n第二段',
    )
  })

  it('fails closed above the safety ceiling instead of silently keeping only the head', async () => {
    const file = new File(['甲'.repeat(MAX_EXTRACTED_TEXT_LENGTH + 8)], 'long.txt', { type: 'text/plain' })
    const result = await extractFileContent(file)

    expect(result).toMatchObject({ status: 'error', text: '', partialExtraction: true })
    expect(result.qualityFlags).toEqual([expect.stringContaining('未截断')])
    expect(result.message).toContain('没有只取开头')
  })

  it('keeps long content complete in ordered overlapping hashed chunks', async () => {
    const text = Array.from({ length: 900 }, (_, index) => `第${index + 1}项：提交匿名材料。`).join('\n')
    const result = await extractFileContent(new File([text], 'long.txt', { type: 'text/plain' }))
    expect(result).toMatchObject({ status: 'ready', text })
    expect(result.chunks?.length).toBeGreaterThan(2)
    expect(result.chunks?.[0]).toMatchObject({ order: 0, start: 0, overlapBefore: 0 })
    expect(result.chunks?.[1].overlapBefore).toBe(200)
    expect(result.chunks?.at(-1)?.end).toBe(text.length)
    expect(result.chunks?.every((chunk) => /^[a-f0-9]{64}$/u.test(chunk.hash))).toBe(true)
  })
})

describe('DOCX safety and structure', () => {
  it('preserves headings, numbered paragraphs and table cells in document order', async () => {
    const xml = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>报名通知</w:t></w:r></w:p>
      <w:p><w:pPr><w:numPr/></w:pPr><w:r><w:t>填写申请表</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>材料</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>截止时间</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    </w:body></w:document>`
    const result = await extractFileContent(docxFile(xml))
    expect(result).toMatchObject({ status: 'ready', extractionMethod: 'parser' })
    expect(result.text).toContain('# 报名通知')
    expect(result.text).toContain('- 填写申请表')
    expect(result.text).toContain('| 材料 | 截止时间 |')
  })

  it('rejects external relationships before parsing content', async () => {
    const result = await extractFileContent(docxFile(
      '<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>正文</w:t></w:r></w:p></w:body></w:document>',
      '<Relationships><Relationship TargetMode="External" Target="https://example.com/a"/></Relationships>',
    ))
    expect(result).toMatchObject({ status: 'error', text: '' })
    expect(result.message).toContain('外部链接')
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
    expect(createWorker).toHaveBeenCalledWith('chi_sim+eng', 1, expect.objectContaining({ logger: expect.any(Function) }))
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
    stubCanvas()
    const file = new File([new Uint8Array([1, 2, 3])], 'mixed.pdf', { type: 'application/pdf' })

    const result = await extractFileContent(file)

    expect(result).toMatchObject({
      status: 'ready',
      pageCount: 3,
      extractionMethod: 'mixed',
    })
    expect(result.pages?.map((page) => page.route)).toEqual(['parser', 'ocr', 'parser'])
    expect(result.text).toContain('--- 第 2 页 [ocr] ---')
    expect(recognize).toHaveBeenCalledTimes(1)
  })

  it('marks scanned PDF OCR page limits instead of presenting the result as complete', async () => {
    mockPdf(Array.from({ length: 7 }, () => ''))
    stubCanvas()
    const file = new File([new Uint8Array([1, 2, 3])], 'scan.pdf', { type: 'application/pdf' })

    const result = await extractFileContent(file)

    expect(result).toMatchObject({
      status: 'ready',
      pageCount: 7,
      extractionMethod: 'ocr',
      partialExtraction: true,
    })
    expect(result.ocrConfidence).toBeCloseTo(0.72)
    expect(result.qualityFlags).toEqual(expect.arrayContaining([
      expect.stringContaining('1 页为空'),
      expect.stringContaining('超过 6 页'),
    ]))
    expect(result.pages?.map((page) => page.route)).toEqual(['ocr', 'ocr', 'ocr', 'ocr', 'ocr', 'ocr', 'empty'])
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
