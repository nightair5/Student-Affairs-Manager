export type SupportedFileKind = 'text' | 'docx' | 'pdf' | 'image' | 'unsupported'
export type FileExtractionStatus = 'ready' | 'needs-input' | 'unsupported' | 'error'
export type PageExtractionRoute = 'parser' | 'ocr' | 'empty' | 'error'

export interface ExtractedPage { pageNumber: number; route: PageExtractionRoute; text: string; qualityFlags: string[] }
export interface ExtractionSpan { id: string; order: number; pageNumber?: number; start: number; end: number; text: string; hash: string }
export interface ExtractionChunk { id: string; order: number; start: number; end: number; overlapBefore: number; text: string; hash: string; duplicateOf?: string }
export interface FileExtractionResult {
  status: FileExtractionStatus
  text: string
  message: string
  pageCount?: number
  extractionMethod?: 'parser' | 'ocr' | 'mixed'
  encoding?: 'utf-8' | 'utf-8-bom' | 'gb18030'
  ocrConfidence?: number
  partialExtraction?: boolean
  qualityFlags?: string[]
  pages?: ExtractedPage[]
  spans?: ExtractionSpan[]
  chunks?: ExtractionChunk[]
  contentHash?: string
}
export interface FileExtractionProgress { phase: 'reading' | 'loading-ocr' | 'recognizing'; progress: number; message: string }
export interface FileExtractionOptions { onProgress?: (progress: FileExtractionProgress) => void }
export interface FileExtractionEvidence { result: FileExtractionResult; fileHash: string }
export interface FileExtractionEvidenceOptions extends FileExtractionOptions { isCurrent?: () => boolean }

/** Explicit in-memory safety ceiling. Content above it fails closed; it is never head-truncated. */
export const MAX_EXTRACTED_TEXT_LENGTH = 500_000
export const MAX_LOCAL_FILE_BYTES = 20 * 1024 * 1024
const MAX_PDF_PAGES = 80
const MAX_OCR_PDF_PAGES = 6
const CHUNK_SIZE = 4_000
const CHUNK_OVERLAP = 200

function normalizedOcrConfidence(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value / 100 : undefined
}

function normalizeLineEndings(text: string): string {
  return text.replaceAll('\u0000', '').replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

export function normalizeExtractedText(text: string): string {
  return normalizeLineEndings(text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function hasMojibake(text: string): boolean {
  const replacementCount = (text.match(/\uFFFD/gu) ?? []).length
  const suspiciousCount = (text.match(/(?:锟斤拷|烫烫烫|屯屯屯|Ã.|Â.|鈥[\u0080-\uFFFF]?)/gu) ?? []).length
  const controlCount = [...text].filter((character) => {
    const code = character.charCodeAt(0)
    return code < 32 && character !== '\n' && character !== '\t'
  }).length
  return replacementCount > 0 || suspiciousCount > 1 || controlCount > Math.max(2, text.length * 0.002)
}

export function decodeTextBytes(bytes: Uint8Array): { text: string; encoding: FileExtractionResult['encoding'] } {
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const utf8Bytes = hasUtf8Bom ? bytes.subarray(3) : bytes
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(utf8Bytes)
    if (!hasMojibake(text)) return { text, encoding: hasUtf8Bom ? 'utf-8-bom' : 'utf-8' }
  } catch { /* try legacy Chinese encoding */ }
  try {
    const text = new TextDecoder('gb18030', { fatal: true }).decode(bytes)
    if (!hasMojibake(text)) return { text, encoding: 'gb18030' }
  } catch { /* fail closed below */ }
  throw new Error('TEXT_ENCODING_UNCERTAIN')
}

async function sha256Text(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function buildStructure(text: string, pages?: ExtractedPage[]): Promise<Pick<FileExtractionResult, 'spans' | 'chunks' | 'contentHash'>> {
  const spans: ExtractionSpan[] = []
  let cursor = 0
  const blocks = pages?.length
    ? pages.filter((page) => page.text).map((page) => ({ text: page.text, pageNumber: page.pageNumber }))
    : text.split(/\n{2,}/u).filter(Boolean).map((block) => ({ text: block, pageNumber: undefined }))
  for (const [order, block] of blocks.entries()) {
    const found = text.indexOf(block.text, cursor)
    const start = found >= 0 ? found : cursor
    const end = start + block.text.length
    const hash = await sha256Text(block.text)
    spans.push({ id: `span-${order + 1}-${hash.slice(0, 12)}`, order, pageNumber: block.pageNumber, start, end, text: block.text, hash })
    cursor = end
  }
  const chunks: ExtractionChunk[] = []
  const firstByHash = new Map<string, string>()
  let start = 0
  let order = 0
  while (start < text.length) {
    const end = Math.min(text.length, start + CHUNK_SIZE)
    const chunkText = text.slice(start, end)
    const hash = await sha256Text(chunkText)
    const id = `chunk-${order + 1}-${hash.slice(0, 12)}`
    chunks.push({ id, order, start, end, overlapBefore: order === 0 ? 0 : Math.min(CHUNK_OVERLAP, start), text: chunkText, hash, ...(firstByHash.has(hash) ? { duplicateOf: firstByHash.get(hash) } : {}) })
    if (!firstByHash.has(hash)) firstByHash.set(hash, id)
    if (end === text.length) break
    start = end - CHUNK_OVERLAP
    order += 1
  }
  return { spans, chunks, contentHash: await sha256Text(text) }
}

async function readyResult(
  text: string,
  result: Omit<FileExtractionResult, 'status' | 'text' | 'message' | 'spans' | 'chunks' | 'contentHash'> & { message: string },
): Promise<FileExtractionResult> {
  const normalized = normalizeExtractedText(text)
  if (!normalized) return { status: 'needs-input', text: '', ...result, message: '文件没有可读取的文字，请人工补充原文。' }
  if (normalized.length > MAX_EXTRACTED_TEXT_LENGTH) {
    return {
      status: 'error', text: '', ...result, partialExtraction: true,
      qualityFlags: [...new Set([...(result.qualityFlags ?? []), `提取文字超过 ${MAX_EXTRACTED_TEXT_LENGTH.toLocaleString('zh-CN')} 字安全上限，未截断也未继续处理`])],
      message: `文件文字超过 ${MAX_EXTRACTED_TEXT_LENGTH.toLocaleString('zh-CN')} 字本机安全上限。系统没有只取开头；请按页或章节拆分后重试。`,
    }
  }
  return { status: 'ready', text: normalized, ...result, ...(await buildStructure(normalized, result.pages)) }
}

export function classifyFile(name: string, mimeType: string): SupportedFileKind {
  const lowerName = name.toLowerCase()
  if (lowerName.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (mimeType.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) return 'text'
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  return 'unsupported'
}

function decodeXmlEntities(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&')
    .replace(/&#(\d+);/gu, (_, value: string) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/giu, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 16)))
}

function parseDocxDocumentXml(xml: string): string {
  const output: string[] = []
  let paragraph = '', paragraphStyle = '', numbered = false, inParagraph = false, inText = false, inTable = false, cellText = ''
  let rowCells: string[] = []
  for (const token of xml.match(/<[^>]+>|[^<]+/gu) ?? []) {
    if (token.startsWith('<')) {
      const lower = token.toLowerCase()
      if (/^<w:tbl(?:\s|>)/u.test(lower)) inTable = true
      else if (/^<\/w:tbl>/u.test(lower)) inTable = false
      else if (/^<w:p(?:\s|>)/u.test(lower)) { inParagraph = true; paragraph = ''; paragraphStyle = ''; numbered = false }
      else if (/^<\/w:p>/u.test(lower)) {
        const clean = paragraph.trim()
        if (clean) {
          const headingMatch = paragraphStyle.match(/heading\s*([1-6])/iu)
          const rendered = headingMatch ? `${'#'.repeat(Number(headingMatch[1]))} ${clean}` : numbered ? `- ${clean}` : clean
          if (inTable) cellText = [cellText, rendered].filter(Boolean).join(' '); else output.push(rendered)
        }
        inParagraph = false
      } else if (/^<w:t(?:\s|>)/u.test(lower)) inText = true
      else if (/^<\/w:t>/u.test(lower)) inText = false
      else if (inParagraph && /^<w:tab\b/u.test(lower)) paragraph += '\t'
      else if (inParagraph && /^<w:br\b/u.test(lower)) paragraph += '\n'
      else if (inParagraph && /^<w:numpr(?:\s|\/|>)/u.test(lower)) numbered = true
      else if (inParagraph && /^<w:pstyle\b/u.test(lower)) paragraphStyle = token.match(/w:val=["']([^"']+)/iu)?.[1] ?? ''
      else if (/^<\/w:tc>/u.test(lower)) { rowCells.push(cellText.trim()); cellText = '' }
      else if (/^<\/w:tr>/u.test(lower)) { output.push(`| ${rowCells.join(' | ')} |`); rowCells = [] }
    } else if (inParagraph && inText) paragraph += decodeXmlEntities(token)
  }
  return output.join('\n\n')
}

function assertSafeDocxArchive(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let entryCount = 0
  let totalUncompressed = 0
  for (let offset = 0; offset + 46 <= bytes.length;) {
    if (view.getUint32(offset, true) !== 0x02014b50) { offset += 1; continue }
    entryCount += 1
    const flags = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    if ((flags & 1) !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) throw new Error('DOCX_ENCRYPTED_OR_ZIP64')
    totalUncompressed += uncompressedSize
    if (entryCount > 500 || totalUncompressed > 8 * 1024 * 1024) throw new Error('DOCX_ARCHIVE_LIMIT')
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    offset += 46 + nameLength + extraLength + commentLength
  }
  if (entryCount === 0) throw new Error('DOCX_CENTRAL_DIRECTORY_MISSING')
}

async function extractDocxText(file: File): Promise<FileExtractionResult> {
  try {
    const { unzipSync, strFromU8 } = await import('fflate')
    const bytes = new Uint8Array(await file.arrayBuffer())
    assertSafeDocxArchive(bytes)
    const entries = unzipSync(bytes)
    const names = Object.keys(entries)
    if (names.some((name) => /(?:vbaproject\.bin|embeddings\/|oleobject)/iu.test(name))) return { status: 'error', text: '', message: 'DOCX 含宏或嵌入对象，已按安全规则拒绝解析。' }
    if (names.filter((name) => name.endsWith('.rels')).some((name) => /TargetMode\s*=\s*["']External["']/iu.test(strFromU8(entries[name])))) return { status: 'error', text: '', message: 'DOCX 含外部链接或远程资源，已按安全规则拒绝解析。' }
    const documentXml = entries['word/document.xml']
    if (!documentXml) return { status: 'error', text: '', message: 'DOCX 缺少主文档结构，可能损坏或不受支持。' }
    return readyResult(parseDocxDocumentXml(strFromU8(documentXml)), { extractionMethod: 'parser', message: '已在本机安全读取 DOCX 段落、标题、编号和表格；未执行任何文件内容。' })
  } catch {
    return { status: 'error', text: '', message: 'DOCX 读取失败。文件可能已加密、损坏、超限或结构不受支持。' }
  }
}

async function createOcrWorker(options: FileExtractionOptions, pageTotal = 1) {
  const { createWorker, OEM } = await import('tesseract.js')
  let pageIndex = 0
  const worker = await createWorker(['chi_sim', 'eng'], OEM.LSTM_ONLY, {
    logger: (event) => {
      if (event.status === 'recognizing text') options.onProgress?.({
        phase: 'recognizing', progress: (pageIndex + event.progress) / pageTotal,
        message: pageTotal > 1 ? `正在本机 OCR 第 ${pageIndex + 1}/${pageTotal} 页 ${Math.round(event.progress * 100)}%……` : `正在本机识别图片文字 ${Math.round(event.progress * 100)}%……`,
      })
    },
  })
  return { worker, setPageIndex: (value: number) => { pageIndex = value } }
}

async function extractImageText(file: File, options: FileExtractionOptions): Promise<FileExtractionResult> {
  options.onProgress?.({ phase: 'loading-ocr', progress: 0, message: '正在加载中文 OCR 模型（首次使用需要联网下载模型）……' })
  try {
    const { worker } = await createOcrWorker(options)
    try {
      const recognition = await worker.recognize(file)
      const ocrConfidence = normalizedOcrConfidence(recognition.data.confidence)
      return readyResult(recognition.data.text, { extractionMethod: 'ocr', ...(ocrConfidence !== undefined ? { ocrConfidence } : {}), message: '已在本机完成 OCR。图片本体不会上传或保存；请核对识别文字后再整理。' })
    } finally { await worker.terminate() }
  } catch {
    return { status: 'error', text: '', message: '本机 OCR 启动失败。请检查网络后重试，或人工补充原文；图片没有发送给 DeepSeek。' }
  }
}

type PdfDocument = Awaited<ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']>
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>

function orderedPdfText(items: Awaited<ReturnType<PdfPage['getTextContent']>>['items']): string {
  const textItems = items.filter((item): item is Extract<typeof item, { str: string }> => 'str' in item && Boolean(item.str.trim()))
  if (!textItems.some((item) => Array.isArray(item.transform))) return textItems.map((item) => item.str).join(' ')
  return [...textItems].sort((a, b) => {
    const ay = a.transform?.[5] ?? 0, by = b.transform?.[5] ?? 0
    return Math.abs(ay - by) > 3 ? by - ay : (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0)
  }).map((item) => item.str).join(' ')
}

async function renderPdfPageForOcr(page: PdfPage) {
  const viewport = page.getViewport({ scale: 1.8 })
  const canvas = window.document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('CANVAS_UNAVAILABLE')
  await page.render({ canvas, canvasContext: context, viewport }).promise
  return canvas
}

async function extractPdfText(file: File, options: FileExtractionOptions): Promise<FileExtractionResult> {
  let document: PdfDocument | undefined
  try {
    options.onProgress?.({ phase: 'reading', progress: 0, message: '正在本机逐页读取 PDF……' })
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pageCount = document.numPages, pageLimit = Math.min(pageCount, MAX_PDF_PAGES)
    const pages: ExtractedPage[] = []
    const pageObjects = new Map<number, PdfPage>()
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      try {
        const page = await document.getPage(pageNumber); pageObjects.set(pageNumber, page)
        const text = normalizeExtractedText(orderedPdfText((await page.getTextContent()).items))
        pages.push({ pageNumber, route: text ? 'parser' : 'empty', text, qualityFlags: [] })
      } catch { pages.push({ pageNumber, route: 'error', text: '', qualityFlags: ['该页读取失败'] }) }
    }
    const emptyBeforeOcr = pages.filter((page) => page.route === 'empty')
    const ocrTargets = emptyBeforeOcr.slice(0, MAX_OCR_PDF_PAGES)
    const confidences: number[] = []
    if (ocrTargets.length) {
      options.onProgress?.({ phase: 'loading-ocr', progress: 0, message: '发现无文本层页面，正在加载本机 OCR……' })
      const { worker, setPageIndex } = await createOcrWorker(options, ocrTargets.length)
      try {
        for (const [index, extractedPage] of ocrTargets.entries()) {
          setPageIndex(index)
          const page = pageObjects.get(extractedPage.pageNumber)
          if (!page) continue
          try {
            const canvas = await renderPdfPageForOcr(page)
            const recognition = await worker.recognize(canvas)
            extractedPage.text = normalizeExtractedText(recognition.data.text)
            extractedPage.route = extractedPage.text ? 'ocr' : 'empty'
            const confidence = normalizedOcrConfidence(recognition.data.confidence)
            if (confidence !== undefined) confidences.push(confidence)
            canvas.width = 1; canvas.height = 1
          } catch { extractedPage.route = 'error'; extractedPage.qualityFlags.push('该页 OCR 失败') }
        }
      } finally { await worker.terminate() }
    }
    for (const page of pageObjects.values()) page.cleanup()
    const flags = [
      ...(pageCount > pageLimit ? [`PDF 共 ${pageCount} 页，仅在 ${MAX_PDF_PAGES} 页安全上限内处理；未处理页没有被声称已提取`] : []),
      ...(pages.some((page) => page.route === 'empty') ? [`${pages.filter((page) => page.route === 'empty').length} 页为空或未识别到文字`] : []),
      ...(pages.some((page) => page.route === 'error') ? [`${pages.filter((page) => page.route === 'error').length} 页提取失败`] : []),
      ...(emptyBeforeOcr.length > MAX_OCR_PDF_PAGES ? [`扫描页超过 ${MAX_OCR_PDF_PAGES} 页 OCR 安全上限`] : []),
    ]
    const text = pages.filter((page) => page.text).map((page) => `--- 第 ${page.pageNumber} 页 [${page.route}] ---\n${page.text}`).join('\n\n')
    const methods = new Set(pages.filter((page) => page.text).map((page) => page.route))
    const extractionMethod = methods.size > 1 ? 'mixed' : methods.has('ocr') ? 'ocr' : 'parser'
    const ocrConfidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : undefined
    return readyResult(text, {
      pageCount, pages, extractionMethod, ...(ocrConfidence !== undefined ? { ocrConfidence } : {}),
      ...(flags.length ? { partialExtraction: true, qualityFlags: flags } : {}),
      message: flags.length ? `PDF 已逐页提取，但有 ${flags.length} 项覆盖或质量限制；请按页核对后再整理。` : `已在本机逐页读取 ${pageCount} 页；页码与提取方式已保留。`,
    })
  } catch {
    return { status: 'error', text: '', message: 'PDF 读取失败。文件可能已加密、损坏或格式不受支持，请改为粘贴原文。' }
  } finally { await document?.cleanup().catch(() => undefined) }
}

export async function extractFileContent(file: File, options: FileExtractionOptions = {}): Promise<FileExtractionResult> {
  if (file.size > MAX_LOCAL_FILE_BYTES) return { status: 'error', text: '', message: '文件超过 20 MB 本机读取上限。请压缩文件，或按页/章节拆分后重试。' }
  const kind = classifyFile(file.name, file.type)
  if (kind === 'text') {
    try {
      const decoded = decodeTextBytes(new Uint8Array(await file.arrayBuffer()))
      const isMarkdown = /\.(?:md|markdown)$/iu.test(file.name)
      return readyResult(decoded.text, { encoding: decoded.encoding, extractionMethod: 'parser', message: isMarkdown ? `已在本机按 ${decoded.encoding} 读取 Markdown，并保留标题、列表、表格、引用和代码块边界。` : `已在本机按 ${decoded.encoding} 读取文本。文件本体不会保存或上传。` })
    } catch { return { status: 'error', text: '', message: '无法可靠判断 TXT/Markdown 编码，已阻止乱码进入识别；请另存为 UTF-8 或人工粘贴。' } }
  }
  if (kind === 'docx') return extractDocxText(file)
  if (kind === 'pdf') return extractPdfText(file, options)
  if (kind === 'image') return extractImageText(file, options)
  return { status: 'unsupported', text: '', message: '暂不支持此格式。请选择 TXT、Markdown、DOCX、PDF 或图片。' }
}

/** Collects the persisted text fingerprint together with extraction output. */
export async function extractFileEvidence(file: File, options: FileExtractionEvidenceOptions = {}): Promise<FileExtractionEvidence | null> {
  const isCurrent = options.isCurrent ?? (() => true)
  const result = await extractFileContent(file, { onProgress: (progress) => { if (isCurrent()) options.onProgress?.(progress) } })
  if (!isCurrent()) return null
  let fileHash = ''
  if (result.status !== 'error' && globalThis.crypto?.subtle) {
    try {
      const bytes = await file.arrayBuffer()
      if (!isCurrent()) return null
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
      if (!isCurrent()) return null
      fileHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    } catch { fileHash = '' }
  }
  return isCurrent() ? { result, fileHash } : null
}
