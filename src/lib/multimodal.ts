export const MULTIMODAL_MODEL_NAME = 'deepseek-v4-flash-vision-exp'
export const MULTIMODAL_PROMPT_VERSION = 'recognition-multimodal-exp-1.0.0'
export const MAX_MULTIMODAL_IMAGES = 4
export const MAX_MULTIMODAL_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_MULTIMODAL_TOTAL_BYTES = 10 * 1024 * 1024

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

const IMAGE_TYPE_BY_EXTENSION: Record<string, MultimodalImageMimeType> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export type MultimodalImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export interface MultimodalImageInput {
  dataUrl: string
  mimeType: MultimodalImageMimeType
  label: string
  byteLength: number
  pageNumber?: number
}

export interface MultimodalInput {
  consent: true
  mode: 'image' | 'pdf-pages'
  ocrTextIncluded: true
  images: MultimodalImageInput[]
}

export interface PdfPageSelectionResult {
  pages: number[]
  error?: string
}

export interface PrepareMultimodalOptions {
  pdfPages?: number[]
  onProgress?: (message: string) => void
}

function imageMimeType(file: File): MultimodalImageMimeType | null {
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) return file.type as MultimodalImageMimeType
  const lowerName = file.name.toLowerCase()
  const extension = Object.keys(IMAGE_TYPE_BY_EXTENSION).find((candidate) => lowerName.endsWith(candidate))
  return extension ? IMAGE_TYPE_BY_EXTENSION[extension] : null
}

export function isSupportedMultimodalImage(file: File): boolean {
  return imageMimeType(file) !== null
}

export function parsePdfPageSelection(
  value: string,
  pageCount: number,
  maxPages = MAX_MULTIMODAL_IMAGES,
): PdfPageSelectionResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { pages: [], error: '无法确认 PDF 页数。' }
  const cleanValue = value.trim()
  if (!cleanValue) return { pages: [], error: '请至少选择 1 页。' }

  const pages = new Set<number>()
  for (const rawPart of cleanValue.split(/[，,、\s]+/u).filter(Boolean)) {
    const range = rawPart.match(/^(\d+)(?:\s*[-—]\s*(\d+))?$/u)
    if (!range) return { pages: [], error: '页码格式无效，请使用“1,3”或“2-4”。' }
    const start = Number(range[1])
    const end = Number(range[2] ?? range[1])
    if (start < 1 || end < start || end > pageCount) {
      return { pages: [], error: `页码需在 1–${pageCount} 之间。` }
    }
    for (let page = start; page <= end; page += 1) {
      pages.add(page)
      if (pages.size > maxPages) return { pages: [], error: `本次最多发送 ${maxPages} 页。` }
    }
  }
  return { pages: [...pages].sort((left, right) => left - right) }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return globalThis.btoa(binary)
}

async function blobToImageInput(
  blob: Blob,
  mimeType: MultimodalImageMimeType,
  label: string,
  pageNumber?: number,
): Promise<MultimodalImageInput> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.byteLength > MAX_MULTIMODAL_IMAGE_BYTES) {
    throw new Error('单张图片超过 8 MB 实验上限，请压缩或裁剪后重试。')
  }
  return {
    dataUrl: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
    mimeType,
    label: label.slice(0, 160),
    byteLength: bytes.byteLength,
    ...(pageNumber === undefined ? {} : { pageNumber }),
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PDF 页面转换失败，请改为截图后重试。'))
    }, 'image/jpeg', 0.9)
  })
}

async function preparePdfPages(
  file: File,
  pages: number[],
  onProgress?: (message: string) => void,
): Promise<MultimodalImageInput[]> {
  if (!pages.length || pages.length > MAX_MULTIMODAL_IMAGES) {
    throw new Error(`请选择 1–${MAX_MULTIMODAL_IMAGES} 个 PDF 页面。`)
  }
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    if (pages.some((page) => page < 1 || page > document.numPages)) {
      throw new Error(`所选页码需在 1–${document.numPages} 之间。`)
    }
    const images: MultimodalImageInput[] = []
    for (const [index, pageNumber] of pages.entries()) {
      onProgress?.(`正在本机准备 PDF 第 ${pageNumber} 页（${index + 1}/${pages.length}）……`)
      const page = await document.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(2, 1_800 / Math.max(baseViewport.width, baseViewport.height))
      const viewport = page.getViewport({ scale: Math.max(1, scale) })
      const canvas = window.document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('浏览器无法准备 PDF 页面，请改为截图后重试。')
      await page.render({ canvas, canvasContext: context, viewport }).promise
      const image = await blobToImageInput(
        await canvasToJpeg(canvas),
        'image/jpeg',
        `${file.name} · 第 ${pageNumber} 页`,
        pageNumber,
      )
      images.push(image)
      canvas.width = 1
      canvas.height = 1
      page.cleanup()
    }
    return images
  } finally {
    await document.cleanup()
  }
}

export async function prepareMultimodalInput(
  file: File,
  options: PrepareMultimodalOptions = {},
): Promise<MultimodalInput> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const images = isPdf
    ? await preparePdfPages(file, options.pdfPages ?? [], options.onProgress)
    : await (async () => {
        const mimeType = imageMimeType(file)
        if (!mimeType) throw new Error('多模态实验仅支持 JPEG、PNG、GIF 或 WebP 图片。')
        options.onProgress?.('正在本机准备本次图片；不会写入工作区……')
        return [await blobToImageInput(file, mimeType, file.name)]
      })()

  const totalBytes = images.reduce((total, image) => total + image.byteLength, 0)
  if (totalBytes > MAX_MULTIMODAL_TOTAL_BYTES) {
    throw new Error('本次图片合计超过 10 MB 实验上限，请减少页面或压缩图片。')
  }
  return {
    consent: true,
    mode: isPdf ? 'pdf-pages' : 'image',
    ocrTextIncluded: true,
    images,
  }
}
