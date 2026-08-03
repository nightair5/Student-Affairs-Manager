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
}

export interface FileExtractionProgress {
  phase: 'reading' | 'loading-ocr' | 'recognizing'
  progress: number
  message: string
}

export interface FileExtractionOptions {
  onProgress?: (progress: FileExtractionProgress) => void
}

const MAX_TEXT_LENGTH = 50_000
const MAX_PDF_PAGES = 80
const MAX_OCR_PDF_PAGES = 6
export const MAX_LOCAL_FILE_BYTES = 20 * 1024 * 1024

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
  return text
    .split(String.fromCharCode(0))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
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
      const text = normalizeExtractedText(result.data.text)
      return text
        ? {
            status: 'ready',
            text,
            message: '已在本机完成 OCR。图片本体不会上传或保存；请核对识别文字后再交给 DeepSeek 整理。',
          }
        : {
            status: 'needs-input',
            text: '',
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
      canvas.width = 1
      canvas.height = 1
      page.cleanup()
    }
    const text = normalizeExtractedText(texts.join('\n'))
    return text
      ? {
          status: 'ready',
          text,
          pageCount,
          message: pageCount > pageLimit
            ? `扫描 PDF 已在本机 OCR 前 ${pageLimit} 页（共 ${pageCount} 页）。请核对并补充其余页，文件本体不会上传。`
            : `扫描 PDF 已在本机 OCR ${pageCount} 页。请核对识别文字，文件本体不会上传。`,
        }
      : {
          status: 'needs-input',
          text: '',
          pageCount,
          message: '本机 OCR 未从扫描 PDF 识别到清晰文字，请人工补充原文。',
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

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      pageTexts.push(pageText)
      page.cleanup()
    }
    const text = normalizeExtractedText(pageTexts.join('\n'))
    if (!text) {
      const result = await extractScannedPdfText(document, pageCount, options)
      await document.cleanup()
      return result
    }

    await document.cleanup()

    const truncatedPages = pageCount > pageLimit
    return {
      status: 'ready',
      text,
      pageCount,
      message: truncatedPages
        ? `已在本机读取前 ${pageLimit} 页文本；文件共 ${pageCount} 页，请核对是否遗漏。`
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
      const text = normalizeExtractedText(await file.text())
      return text
        ? {
            status: 'ready',
            text,
            message: '已在本机读取文本。文件本体不会保存或上传。',
          }
        : {
            status: 'needs-input',
            text: '',
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
