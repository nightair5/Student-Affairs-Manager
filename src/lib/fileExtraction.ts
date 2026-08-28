export type SupportedFileKind = 'text' | 'pdf' | 'image' | 'unsupported'

export type FileExtractionStatus =
  | 'ready'
  | 'needs-input'
  | 'unsupported'
  | 'error'

export interface FileExtractionResult {
  status: FileExtractionStatus
  text: string
  message: string
  pageCount?: number
  extractionMethod?: 'parser' | 'ocr'
  /** Actual OCR engine confidence normalized to 0..1 when observable. */
  ocrConfidence?: number
  partialExtraction?: boolean
  qualityFlags?: string[]
}

export interface FileExtractionProgress {
  phase: 'reading' | 'loading-ocr' | 'recognizing'
  progress: number
  message: string
}

export interface FileExtractionOptions {
  onProgress?: (progress: FileExtractionProgress) => void
}

export interface FileExtractionEvidence {
  result: FileExtractionResult
  fileHash: string
}

export interface FileExtractionEvidenceOptions extends FileExtractionOptions {
  /** A generation/token guard supplied by the UI that selected this file. */
  isCurrent?: () => boolean
}

export const MAX_EXTRACTED_TEXT_LENGTH = 50_000
const MAX_PDF_PAGES = 80
const MAX_OCR_PDF_PAGES = 6
export const MAX_LOCAL_FILE_BYTES = 20 * 1024 * 1024

function normalizedOcrConfidence(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value / 100
    : undefined
}

interface NormalizedExtractedText {
  text: string
  truncated: boolean
}

function normalizeExtractedTextWithEvidence(text: string): NormalizedExtractedText {
  const normalized = text
    .split(String.fromCharCode(0))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return {
    text: normalized.slice(0, MAX_EXTRACTED_TEXT_LENGTH),
    truncated: normalized.length > MAX_EXTRACTED_TEXT_LENGTH,
  }
}

function partialEvidence(qualityFlags: string[]): Pick<FileExtractionResult, 'partialExtraction' | 'qualityFlags'> {
  const flags = [...new Set(qualityFlags)]
  return flags.length ? { partialExtraction: true, qualityFlags: flags } : {}
}

function textTruncatedFlag(): string {
  return `提取文字超过 ${MAX_EXTRACTED_TEXT_LENGTH.toLocaleString('en-US')} 字，已截断`
}

export function classifyFile(name: string, mimeType: string): SupportedFileKind {
  const lowerName = name.toLowerCase()
  if (
    mimeType.startsWith('text/') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.markdown')
  ) {
    return 'text'
  }
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  return 'unsupported'
}

export function normalizeExtractedText(text: string): string {
  return normalizeExtractedTextWithEvidence(text).text
}

async function extractImageText(file: File, options: FileExtractionOptions): Promise<FileExtractionResult> {
  options.onProgress?.({ phase: 'loading-ocr', progress: 0, message: '正在加载中文 OCR 模型（首次使用需要联网下载模型）……' })
  try {
    const { createWorker, OEM } = await import('tesseract.js')
    const worker = await createWorker(['chi_sim', 'eng'], OEM.LSTM_ONLY, {
      logger: (event) => {
        if (event.status === 'recognizing text') {
          options.onProgress?.({
            phase: 'recognizing',
            progress: event.progress,
            message: `正在本机识别图片文字 ${Math.round(event.progress * 100)}%……`,
          })
        }
      },
    })
    try {
      const result = await worker.recognize(file)
      const normalized = normalizeExtractedTextWithEvidence(result.data.text)
      const flags = normalized.truncated ? [textTruncatedFlag()] : []
      const ocrConfidence = normalizedOcrConfidence(result.data.confidence)
      return normalized.text
        ? {
            status: 'ready',
            text: normalized.text,
            extractionMethod: 'ocr',
            ...(ocrConfidence !== undefined ? { ocrConfidence } : {}),
            ...partialEvidence(flags),
            message: normalized.truncated
              ? `已在本机完成 OCR，但文字超过 ${MAX_EXTRACTED_TEXT_LENGTH.toLocaleString('zh-CN')} 字，仅保留前段；请补充核对后再整理。`
              : '已在本机完成 OCR。图片本体不会上传或保存；请核对识别文字后再交给 DeepSeek 整理。',
          }
        : {
            status: 'needs-input',
            text: '',
            extractionMethod: 'ocr',
            ...(ocrConfidence !== undefined ? { ocrConfidence } : {}),
            message: '本机 OCR 未识别到清晰文字，请换更清晰的图片或人工补充原文。',
          }
    } finally {
      await worker.terminate()
    }
  } catch {
    return {
      status: 'error',
      text: '',
      message: '本机 OCR 启动失败。请检查网络后重试，或人工补充原文；图片没有发送给 DeepSeek。',
    }
  }
}

async function extractScannedPdfText(
  document: Awaited<ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']>,
  pageCount: number,
  options: FileExtractionOptions,
): Promise<FileExtractionResult> {
  const pageLimit = Math.min(pageCount, MAX_OCR_PDF_PAGES)
  options.onProgress?.({ phase: 'loading-ocr', progress: 0, message: 'PDF 没有文本层，正在加载本地 OCR……' })
  const { createWorker, OEM } = await import('tesseract.js')
  let currentPage = 0
  const worker = await createWorker(['chi_sim', 'eng'], OEM.LSTM_ONLY, {
    logger: (event) => {
      if (event.status === 'recognizing text') {
        const progress = (currentPage + event.progress) / pageLimit
        options.onProgress?.({
          phase: 'recognizing',
          progress,
          message: `正在本机 OCR 第 ${currentPage + 1}/${pageLimit} 页 ${Math.round(event.progress * 100)}%……`,
        })
      }
    },
  })
  try {
    const texts: string[] = []
    const confidences: number[] = []
    let confidenceFullyObservable = true
    for (currentPage = 0; currentPage < pageLimit; currentPage += 1) {
      const page = await document.getPage(currentPage + 1)
      const viewport = page.getViewport({ scale: 1.6 })
      const canvas = window.document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('CANVAS_UNAVAILABLE')
      await page.render({ canvas, canvasContext: context, viewport }).promise
      const result = await worker.recognize(canvas)
      texts.push(result.data.text)
      const confidence = normalizedOcrConfidence(result.data.confidence)
      if (confidence === undefined) confidenceFullyObservable = false
      else confidences.push(confidence)
      canvas.width = 1
      canvas.height = 1
      page.cleanup()
    }
    const normalized = normalizeExtractedTextWithEvidence(texts.join('\n'))
    const flags = [
      ...(pageCount > pageLimit ? [`扫描 PDF 共 ${pageCount} 页，本机 OCR 仅处理前 ${pageLimit} 页`] : []),
      ...(normalized.truncated ? [textTruncatedFlag()] : []),
    ]
    const ocrConfidence = confidenceFullyObservable && confidences.length === pageLimit && pageLimit > 0
      ? confidences.reduce((total, value) => total + value, 0) / confidences.length
      : undefined
    return normalized.text
      ? {
          status: 'ready',
          text: normalized.text,
          pageCount,
          extractionMethod: 'ocr',
          ...(ocrConfidence !== undefined ? { ocrConfidence } : {}),
          ...partialEvidence(flags),
          message: flags.length
            ? `扫描 PDF 已在本机 OCR 前 ${pageLimit} 页（共 ${pageCount} 页），且存在未完整提取内容。请核对并补充后再整理。`
            : `扫描 PDF 已在本机 OCR ${pageCount} 页。请核对识别文字，文件本体不会上传。`,
        }
      : {
          status: 'needs-input',
          text: '',
          pageCount,
          extractionMethod: 'ocr',
          ...(ocrConfidence !== undefined ? { ocrConfidence } : {}),
          ...partialEvidence(flags),
          message: pageCount > pageLimit
            ? `本机 OCR 仅检查了扫描 PDF 前 ${pageLimit}/${pageCount} 页，且未识别到清晰文字；请人工补充完整原文。`
            : '本机 OCR 未从扫描 PDF 识别到清晰文字，请人工补充原文。',
        }
  } finally {
    await worker.terminate()
  }
}

async function extractPdfText(file: File, options: FileExtractionOptions): Promise<FileExtractionResult> {
  try {
    options.onProgress?.({ phase: 'reading', progress: 0, message: '正在本机读取 PDF 文本层……' })
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    const document = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise
    const pageCount = document.numPages
    const pageLimit = Math.min(pageCount, MAX_PDF_PAGES)
    const pageTexts: string[] = []
    let emptyTextPageCount = 0

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      if (!pageText.trim()) emptyTextPageCount += 1
      pageTexts.push(pageText)
      page.cleanup()
    }
    const normalized = normalizeExtractedTextWithEvidence(pageTexts.join('\n'))
    if (!normalized.text) {
      const result = await extractScannedPdfText(document, pageCount, options)
      await document.cleanup()
      return result
    }

    await document.cleanup()

    const truncatedPages = pageCount > pageLimit
    const mixedEmptyTextPages = emptyTextPageCount > 0 && emptyTextPageCount < pageLimit
    const flags = [
      ...(truncatedPages ? [`PDF 共 ${pageCount} 页，本机文本层仅读取前 ${pageLimit} 页`] : []),
      ...(mixedEmptyTextPages ? [`PDF 前 ${pageLimit} 页中有 ${emptyTextPageCount} 页未读到文本层，可能含扫描内容`] : []),
      ...(normalized.truncated ? [textTruncatedFlag()] : []),
    ]
    return {
      status: 'ready',
      text: normalized.text,
      pageCount,
      extractionMethod: 'parser',
      ...partialEvidence(flags),
      message: flags.length
        ? `已在本机读取 PDF 文本层，但发现 ${flags.length} 项不完整证据；请核对空白页、页数限制或截断内容。`
        : `已在本机读取 ${pageCount} 页文本，请在生成建议前核对原文。`,
    }
  } catch {
    return {
      status: 'error',
      text: '',
      message: 'PDF 读取失败。文件可能已加密、损坏或格式不受支持，请改为粘贴原文。',
    }
  }
}

export async function extractFileContent(
  file: File,
  options: FileExtractionOptions = {},
): Promise<FileExtractionResult> {
  if (file.size > MAX_LOCAL_FILE_BYTES) {
    return {
      status: 'error',
      text: '',
      message: '文件超过 20 MB 本机读取上限。请压缩文件，或只粘贴与任务有关的原文。',
    }
  }
  const kind = classifyFile(file.name, file.type)

  if (kind === 'text') {
    try {
      const normalized = normalizeExtractedTextWithEvidence(await file.text())
      const flags = normalized.truncated ? [textTruncatedFlag()] : []
      return normalized.text
        ? {
          status: 'ready',
          text: normalized.text,
          extractionMethod: 'parser',
          ...partialEvidence(flags),
          message: normalized.truncated
            ? `已在本机读取文本，但内容超过 ${MAX_EXTRACTED_TEXT_LENGTH.toLocaleString('zh-CN')} 字，仅保留前段；请补充核对。`
            : '已在本机读取文本。文件本体不会保存或上传。',
          }
        : {
          status: 'needs-input',
          text: '',
          extractionMethod: 'parser',
          message: '文件没有可读取的文字，请人工补充原文。',
          }
    } catch {
      return {
        status: 'error',
        text: '',
        message: '文本文件读取失败，请改为粘贴原文。',
      }
    }
  }

  if (kind === 'pdf') return extractPdfText(file, options)

  if (kind === 'image') return extractImageText(file, options)

  return {
    status: 'unsupported',
    text: '',
    message: '暂不支持此格式。请选择 TXT、Markdown、PDF 或图片。',
  }
}

/**
 * Collects the persisted text fingerprint together with extraction output.
 * A stale generation returns null and is never allowed to emit progress or a hash.
 */
export async function extractFileEvidence(
  file: File,
  options: FileExtractionEvidenceOptions = {},
): Promise<FileExtractionEvidence | null> {
  const isCurrent = options.isCurrent ?? (() => true)
  const result = await extractFileContent(file, {
    onProgress: (progress) => {
      if (isCurrent()) options.onProgress?.(progress)
    },
  })
  if (!isCurrent()) return null

  let fileHash = ''
  if (result.status !== 'error' && globalThis.crypto?.subtle) {
    try {
      const bytes = await file.arrayBuffer()
      if (!isCurrent()) return null
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
      if (!isCurrent()) return null
      fileHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    } catch {
      fileHash = ''
    }
  }
  return isCurrent() ? { result, fileHash } : null
}
