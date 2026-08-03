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

const MAX_TEXT_LENGTH = 50_000
const MAX_PDF_PAGES = 80
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

async function extractPdfText(file: File): Promise<FileExtractionResult> {
  try {
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
    await document.cleanup()

    const text = normalizeExtractedText(pageTexts.join('\n'))
    if (!text) {
      return {
        status: 'needs-input',
        text: '',
        pageCount,
        message: '未读到 PDF 文本层。它可能是扫描件；OCR 尚未接通，请人工补充原文。',
      }
    }

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

export async function extractFileContent(file: File): Promise<FileExtractionResult> {
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

  if (kind === 'pdf') return extractPdfText(file)

  if (kind === 'image') {
    return {
      status: 'needs-input',
      text: '',
      message: '图片已选择，但 OCR 尚未接通。请在下方人工补充截图中的原文。',
    }
  }

  return {
    status: 'unsupported',
    text: '',
    message: '暂不支持此格式。请选择 TXT、Markdown、PDF 或图片。',
  }
}
