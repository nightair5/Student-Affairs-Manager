import {
  prepareCanvasForOcr,
  prepareFileImageForOcr,
  routeOcrQuality,
  type OcrMediaKind,
  type OcrPreprocessProfile,
} from './ocrPreprocessing'

export type SupportedFileKind = 'text' | 'docx' | 'pdf' | 'image' | 'unsupported'
export type FileExtractionStatus = 'ready' | 'needs-input' | 'unsupported' | 'error'
export type PageExtractionRoute = 'parser' | 'ocr' | 'empty' | 'error'

export interface ExtractedPage { pageNumber: number; route: PageExtractionRoute; text: string; qualityFlags: string[]; parserText?: string; ocrText?: string }
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
  ocrQualityRoute?: 'accept' | 'review' | 'retake'
  partialExtraction?: boolean
  qualityFlags?: string[]
  pages?: ExtractedPage[]
  spans?: ExtractionSpan[]
  chunks?: ExtractionChunk[]
  contentHash?: string
}
export interface FileExtractionProgress { phase: 'reading' | 'loading-ocr' | 'recognizing'; progress: number; message: string }
export interface LocalExtractionResources { workerPath: string; corePath: string; langPath: string; pdfWorkerPath: string }
export interface FileExtractionOptions {
  onProgress?: (progress: FileExtractionProgress) => void; mediaKind?: OcrMediaKind
  profile?: 'real-input-01'; resources?: LocalExtractionResources; signal?: AbortSignal; timeoutMs?: number
}
export interface FileExtractionEvidence { result: FileExtractionResult; fileHash: string }
export interface FileExtractionEvidenceOptions extends FileExtractionOptions { isCurrent?: () => boolean }

/** Explicit in-memory safety ceiling. Content above it fails closed; it is never head-truncated. */
export const MAX_EXTRACTED_TEXT_LENGTH = 500_000
export const MAX_LOCAL_FILE_BYTES = 20 * 1024 * 1024
const MAX_PDF_PAGES = 80
const MAX_OCR_PDF_PAGES = 6
const CHUNK_SIZE = 4_000
const CHUNK_OVERLAP = 200

const localProfile = (options: FileExtractionOptions) => options.profile === 'real-input-01'
function active(options: FileExtractionOptions) { if (localProfile(options) && options.signal?.aborted) throw Error('LOCAL_READING_CANCELLED') }
function localResources(options: FileExtractionOptions) {
  const resources = options.resources
  if (!resources) throw Error('LOCAL_ASSETS_REQUIRED')
  const urls = Object.values(resources).map(value => new URL(value))
  if (urls.length !== 4 || urls.some(url => url.protocol !== 'http:' || url.hostname !== '127.0.0.1'
    || !url.port || url.username || url.password || url.search || url.hash || !url.pathname.startsWith('/real-input-assets/'))
    || new Set(urls.map(url => url.origin)).size !== 1) throw Error('LOCAL_ASSETS_ONLY')
  return resources
}
async function validateLocalFile(file: File, options: FileExtractionOptions) {
  active(options)
  if (!file.size) throw Error('EMPTY_FILE')
  const mime = file.type.toLowerCase(), name = file.name.toLowerCase()
  if (mime === 'text/plain' || mime === 'text/markdown') {
    if (!/\.(txt|md|markdown)$/.test(name) || file.size > 2 * 1024 * 1024) throw Error('TEXT_TYPE_OR_SIZE')
    return
  }
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  active(options)
  if (mime === 'application/pdf') {
    if (!name.endsWith('.pdf') || new TextDecoder().decode(signature.subarray(0,5)) !== '%PDF-') throw Error('PDF_SIGNATURE')
    localResources(options); return
  }
  if (!['image/png','image/jpeg','image/webp'].includes(mime) || file.size > 10 * 1024 * 1024) throw Error('IMAGE_TYPE_OR_SIZE')
  const valid = mime === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i) => signature[i] === v)
    : mime === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255
      : new TextDecoder().decode(signature.subarray(0,4)) === 'RIFF' && new TextDecoder().decode(signature.subarray(8,12)) === 'WEBP'
  if (!valid) throw Error('IMAGE_SIGNATURE')
  localResources(options)
  const image = await createImageBitmap(file)
  try { active(options); if (!image.width || !image.height || image.width * image.height > 20_000_000) throw Error('IMAGE_PIXELS') }
  finally { image.close() }
}

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
  preserveWhitespace = false,
): Promise<FileExtractionResult> {
  const normalized = preserveWhitespace ? text : normalizeExtractedText(text)
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
  active(options)
  const resources = localProfile(options) ? localResources(options) : undefined
  const { createWorker, OEM } = await import('tesseract.js')
  let pageIndex = 0
  const worker = await createWorker('chi_sim+eng', OEM.LSTM_ONLY, {
    ...(resources ? { workerPath: resources.workerPath, corePath: resources.corePath, langPath: resources.langPath,
      cacheMethod: 'none', workerBlobURL: false, gzip: true } : {}),
    logger: (event) => {
      if (event.status === 'recognizing text') options.onProgress?.({
        phase: 'recognizing', progress: (pageIndex + event.progress) / pageTotal,
        message: pageTotal > 1 ? `正在本机 OCR 第 ${pageIndex + 1}/${pageTotal} 页 ${Math.round(event.progress * 100)}%……` : `正在本机识别图片文字 ${Math.round(event.progress * 100)}%……`,
      })
    },
  })
  if (localProfile(options)) {
    if (options.signal?.aborted) { await worker.terminate(); throw Error('LOCAL_READING_CANCELLED') }
    options.signal?.addEventListener('abort', () => { void worker.terminate().catch(() => undefined) }, { once: true })
  }
  return { worker, setPageIndex: (value: number) => { pageIndex = value } }
}

async function configureOcrWorker(worker: Awaited<ReturnType<typeof createOcrWorker>>['worker'], profile?: OcrPreprocessProfile) {
  if (!profile) return
  const psm = profile.pageSegmentationMode === 'sparse' ? '11' : profile.pageSegmentationMode === 'single-block' ? '6' : '3'
  await worker.setParameters({ tessedit_pageseg_mode: psm as never, preserve_interword_spaces: '1' })
}

function inferredMediaKind(file: File, requested?: OcrMediaKind): OcrMediaKind {
  if (requested) return requested
  if (/(?:截图|screenshot|screen[-_ ]?shot)/iu.test(file.name)) return 'screenshot'
  return /jpe?g$/iu.test(file.type) || /\.jpe?g$/iu.test(file.name) ? 'photo' : 'screenshot'
}

async function extractImageText(file: File, options: FileExtractionOptions): Promise<FileExtractionResult> {
  options.onProgress?.({ phase: 'loading-ocr', progress: 0, message: localProfile(options) ? '正在加载已核验的本机 OCR 资源……' : '正在加载中文 OCR 模型（首次使用需要联网下载模型）……' })
  try {
    const mediaKind = inferredMediaKind(file, options.mediaKind)
    let prepared: Awaited<ReturnType<typeof prepareFileImageForOcr>> | undefined
    try { prepared = await prepareFileImageForOcr(file, mediaKind) } catch { prepared = undefined }
    const { worker } = await createOcrWorker(options)
    try {
      await configureOcrWorker(worker, prepared?.profile)
      const recognition = await worker.recognize(prepared?.canvas ?? file)
      active(options)
      const ocrConfidence = normalizedOcrConfidence(recognition.data.confidence)
      const decision = prepared ? routeOcrQuality(prepared.before, { text: recognition.data.text, confidence: ocrConfidence }) : undefined
      const qualityFlags = [...(prepared?.qualityFlags ?? []), ...(decision?.reasons ?? [])]
      return readyResult(recognition.data.text, {
        extractionMethod: 'ocr',
        ...(localProfile(options) ? { pageCount: 1, pages: [{ pageNumber: 1, route: recognition.data.text.trim() ? 'ocr' as const : 'empty' as const,
          text: normalizeExtractedText(recognition.data.text), ocrText: recognition.data.text, qualityFlags }] } : {}),
        ...(ocrConfidence !== undefined ? { ocrConfidence } : {}),
        ...(decision ? { ocrQualityRoute: decision.route } : {}),
        ...(qualityFlags.length ? { qualityFlags } : {}),
        ...(decision && decision.route !== 'accept' ? { partialExtraction: true } : {}),
        message: decision
          ? `已在本机按${mediaKind === 'screenshot' ? '截图' : mediaKind === 'photo' ? '照片' : '扫描件'}策略完成 OCR。${decision.guidance} 图片本体不会上传或保存。`
          : '已在本机完成 OCR。图片本体不会上传或保存；预处理不可用，请重点核对日期和数字。',
      })
    } finally {
      if (prepared) { prepared.canvas.width = 1; prepared.canvas.height = 1 }
      await worker.terminate()
    }
  } catch {
    return { status: 'error', text: '', message: localProfile(options) ? '本机 OCR 失败或已取消；请核对本机资源，或人工补充原文。图片未上传。' : '本机 OCR 启动失败。请检查网络后重试，或人工补充原文；图片没有发送给 DeepSeek。' }
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
    pdfjs.GlobalWorkerOptions.workerSrc = localProfile(options) ? localResources(options).pdfWorkerPath : new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), ...(localProfile(options) ? { isEvalSupported: false, useSystemFonts: true } : {}) })
    if (localProfile(options)) options.signal?.addEventListener('abort', () => { void loading.destroy().catch(() => undefined) }, { once: true })
    document = await loading.promise
    active(options)
    const pageCount = document.numPages, pageLimit = Math.min(pageCount, localProfile(options) ? 6 : MAX_PDF_PAGES)
    const pages: ExtractedPage[] = []
    const pageObjects = new Map<number, PdfPage>()
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      try {
        active(options)
        const page = await document.getPage(pageNumber); pageObjects.set(pageNumber, page)
        const text = normalizeExtractedText(orderedPdfText((await page.getTextContent()).items))
        const qualityFlags: string[] = []
        if (localProfile(options) && text) {
          try {
            const operators = await page.getOperatorList()
            const imageOps = new Set(Object.entries(pdfjs.OPS).filter(([name]) => /image|paintXObject/i.test(name)).map(([,value]) => value))
            if (operators.fnArray.some(op => imageOps.has(op))) qualityFlags.push('页内存在图像，文本层不能代表全文；请对照本机OCR')
          } catch { qualityFlags.push('无法核实页内覆盖；请对照本机OCR') }
        }
        pages.push({ pageNumber, route: text ? 'parser' : 'empty', text, qualityFlags,
          ...(localProfile(options) ? { parserText: text } : {}) })
      } catch { pages.push({ pageNumber, route: 'error', text: '', qualityFlags: ['该页读取失败'] }) }
    }
    const emptyBeforeOcr = pages.filter((page) => page.route === 'empty')
    const ocrTargets = (localProfile(options) ? pages.filter(page => page.route === 'empty' || page.qualityFlags.length) : emptyBeforeOcr).slice(0, MAX_OCR_PDF_PAGES)
    const confidences: number[] = []
    if (ocrTargets.length) {
      options.onProgress?.({ phase: 'loading-ocr', progress: 0, message: '发现无文本层页面，正在加载本机 OCR……' })
      const { worker, setPageIndex } = await createOcrWorker(options, ocrTargets.length)
      try {
        for (const [index, extractedPage] of ocrTargets.entries()) {
          active(options)
          setPageIndex(index)
          const page = pageObjects.get(extractedPage.pageNumber)
          if (!page) continue
          let canvas: HTMLCanvasElement | undefined
          let prepared: Awaited<ReturnType<typeof prepareCanvasForOcr>> | undefined
          try {
            canvas = await renderPdfPageForOcr(page)
            try { prepared = await prepareCanvasForOcr(canvas, canvas.width, canvas.height, 'scan') } catch { prepared = undefined }
            await configureOcrWorker(worker, prepared?.profile)
            const recognition = await worker.recognize(prepared?.canvas ?? canvas)
            active(options)
            const ocrText = normalizeExtractedText(recognition.data.text)
            if (localProfile(options)) extractedPage.ocrText = recognition.data.text
            if (localProfile(options) && extractedPage.parserText) {
              if (extractedPage.parserText !== ocrText) extractedPage.qualityFlags.push('文本层与OCR不同，两路已保留；必须逐页核对后决定发送文字')
            } else {
              extractedPage.text = ocrText
              extractedPage.route = extractedPage.text ? 'ocr' : 'empty'
            }
            const confidence = normalizedOcrConfidence(recognition.data.confidence)
            if (confidence !== undefined) confidences.push(confidence)
            if (prepared) {
              const decision = routeOcrQuality(prepared.before, { text: extractedPage.text, confidence })
              extractedPage.qualityFlags.push(...prepared.qualityFlags, ...decision.reasons)
            }
          } catch { extractedPage.route = 'error'; extractedPage.qualityFlags.push('该页 OCR 失败') }
          finally {
            if (prepared) { prepared.canvas.width = 1; prepared.canvas.height = 1 }
            if (canvas) { canvas.width = 1; canvas.height = 1 }
          }
        }
      } finally { await worker.terminate() }
    }
    for (const page of pageObjects.values()) page.cleanup()
    const flags = [
      ...(pageCount > pageLimit ? [`PDF 共 ${pageCount} 页，仅在 ${pageLimit} 页安全上限内处理；未处理页没有被声称已提取`] : []),
      ...(pages.some((page) => page.route === 'empty') ? [`${pages.filter((page) => page.route === 'empty').length} 页为空或未识别到文字`] : []),
      ...(pages.some((page) => page.route === 'error') ? [`${pages.filter((page) => page.route === 'error').length} 页提取失败`] : []),
      ...(emptyBeforeOcr.length > MAX_OCR_PDF_PAGES ? [`扫描页超过 ${MAX_OCR_PDF_PAGES} 页 OCR 安全上限`] : []),
      ...pages.flatMap((page) => page.qualityFlags.map((flag) => `第 ${page.pageNumber} 页：${flag}`)),
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

async function extractFileContentInternal(file: File, options: FileExtractionOptions): Promise<FileExtractionResult> {
  if (file.size > MAX_LOCAL_FILE_BYTES) return { status: 'error', text: '', message: '文件超过 20 MB 本机读取上限。请压缩文件，或按页/章节拆分后重试。' }
  if (localProfile(options)) {
    try { await validateLocalFile(file, options) }
    catch { return { status: 'error', text: '', message: '本机读取已拒绝：文件签名、格式、大小、像素、资源或取消状态不符合本实验范围。' } }
  }
  const kind = classifyFile(file.name, file.type)
  if (kind === 'text') {
    try {
      const decoded = decodeTextBytes(new Uint8Array(await file.arrayBuffer()))
      const isMarkdown = /\.(?:md|markdown)$/iu.test(file.name)
      return readyResult(decoded.text, { encoding: decoded.encoding, extractionMethod: 'parser',
        ...(localProfile(options) ? { pageCount: 1, pages: [{ pageNumber: 1, route: 'parser' as const, text: decoded.text, parserText: decoded.text, qualityFlags: [] }] } : {}),
        message: isMarkdown ? `已在本机按 ${decoded.encoding} 读取 Markdown，并保留标题、列表、表格、引用和代码块边界。` : `已在本机按 ${decoded.encoding} 读取文本。文件本体不会保存或上传。` }, localProfile(options))
    } catch { return { status: 'error', text: '', message: '无法可靠判断 TXT/Markdown 编码，已阻止乱码进入识别；请另存为 UTF-8 或人工粘贴。' } }
  }
  if (kind === 'docx') return extractDocxText(file)
  if (kind === 'pdf') return extractPdfText(file, options)
  if (kind === 'image') return extractImageText(file, options)
  return { status: 'unsupported', text: '', message: '暂不支持此格式。请选择 TXT、Markdown、DOCX、PDF 或图片。' }
}

export async function extractFileContent(file: File, options: FileExtractionOptions = {}): Promise<FileExtractionResult> {
  if (!localProfile(options)) return extractFileContentInternal(file, options)
  const controller = new AbortController(), timeout = options.timeoutMs ?? 180000
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 180000) throw Error('LOCAL_TIMEOUT_RANGE')
  const abort = () => controller.abort()
  if (options.signal?.aborted) controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  const copied = { ...options, resources: options.resources ? { ...options.resources } : undefined, signal: controller.signal,
    onProgress: (progress: FileExtractionProgress) => { if (!controller.signal.aborted) options.onProgress?.(progress) } }
  let timer: ReturnType<typeof setTimeout> | undefined
  const stopped = new Promise<FileExtractionResult>(resolve => {
    const stop = () => resolve({ status: 'error', text: '', message: '读取已取消或超时；未完成页面没有被视为已读取，请重新选择文件。' })
    controller.signal.addEventListener('abort', stop, { once: true })
    if (controller.signal.aborted) stop()
    timer = setTimeout(abort, timeout)
  })
  try { return await Promise.race([extractFileContentInternal(file, copied), stopped]) }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort) }
}

/** Collects the persisted text fingerprint together with extraction output. */
export async function extractFileEvidence(file: File, options: FileExtractionEvidenceOptions = {}): Promise<FileExtractionEvidence | null> {
  const isCurrent = options.isCurrent ?? (() => true)
  const result = await extractFileContent(file, {
    ...(localProfile(options) ? { profile: options.profile, resources: options.resources, signal: options.signal, timeoutMs: options.timeoutMs } : {}),
    ...(options.mediaKind ? { mediaKind: options.mediaKind } : {}),
    onProgress: (progress) => { if (isCurrent()) options.onProgress?.(progress) },
  })
  if (!isCurrent()) return null
  let fileHash = ''
  if ((result.status !== 'error' || localProfile(options) && file.size <= MAX_LOCAL_FILE_BYTES) && globalThis.crypto?.subtle) {
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
