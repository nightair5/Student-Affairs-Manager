export type OcrMediaKind = 'screenshot' | 'photo' | 'scan'
export type OcrQualityRoute = 'accept' | 'review' | 'retake'

export interface PixelQuality {
  width: number
  height: number
  meanLuminance: number
  contrast: number
  sharpness: number
  darkClippingRatio: number
  whiteRatio: number
  contentBounds: { x: number; y: number; width: number; height: number }
  contentTouchesEdge: boolean
  perspectiveRisk: boolean
}

export interface OcrPreprocessProfile {
  mediaKind: OcrMediaKind
  scale: number
  grayscale: boolean
  contrastStretch: boolean
  medianDenoise: boolean
  cropWhitespace: boolean
  pageSegmentationMode: 'auto' | 'sparse' | 'single-block'
  orientation: 'exif-normalized'
}

export interface OcrQualityDecision {
  route: OcrQualityRoute
  reasons: string[]
  guidance: string
}

export interface PreparedOcrCanvas {
  canvas: HTMLCanvasElement
  profile: OcrPreprocessProfile
  before: PixelQuality
  estimatedBytes: number
  qualityFlags: string[]
}

const MAX_OUTPUT_PIXELS = 16_000_000

function luminance(data: Uint8ClampedArray, offset: number): number {
  return 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]
}

export function analyzeOcrPixels(data: Uint8ClampedArray, width: number, height: number): PixelQuality {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) throw new Error('INVALID_IMAGE_DATA')
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 250_000)))
  let count = 0, sum = 0, squareSum = 0, edgeSum = 0, edgeCount = 0, dark = 0, white = 0
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * 4
      const value = luminance(data, offset)
      sum += value; squareSum += value * value; count += 1
      if (value < 18) dark += 1
      if (value > 245) white += 1
      const saturation = Math.max(data[offset], data[offset + 1], data[offset + 2]) - Math.min(data[offset], data[offset + 1], data[offset + 2])
      if (value < 242 || saturation > 18) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
      if (x + stride < width) { edgeSum += Math.abs(value - luminance(data, offset + stride * 4)); edgeCount += 1 }
      if (y + stride < height) { edgeSum += Math.abs(value - luminance(data, offset + stride * width * 4)); edgeCount += 1 }
    }
  }
  const meanLuminance = sum / count
  const bounds = maxX < minX || maxY < minY
    ? { x: 0, y: 0, width, height }
    : { x: minX, y: minY, width: Math.min(width - minX, maxX - minX + stride), height: Math.min(height - minY, maxY - minY + stride) }
  const left = bounds.x, right = width - bounds.x - bounds.width, top = bounds.y, bottom = height - bounds.y - bounds.height
  const contentTouchesEdge = left < width * 0.01 || right < width * 0.01 || top < height * 0.01 || bottom < height * 0.01
  const perspectiveRisk = Math.abs(left - right) > width * 0.18 || Math.abs(top - bottom) > height * 0.18
  return {
    width, height, meanLuminance,
    contrast: Math.sqrt(Math.max(0, squareSum / count - meanLuminance * meanLuminance)),
    sharpness: edgeCount ? edgeSum / edgeCount : 0,
    darkClippingRatio: dark / count,
    whiteRatio: white / count,
    contentBounds: bounds,
    contentTouchesEdge,
    perspectiveRisk,
  }
}

export function selectOcrProfile(mediaKind: OcrMediaKind, quality: PixelQuality): OcrPreprocessProfile {
  const desiredScale = mediaKind === 'scan'
    ? 1
    : mediaKind === 'screenshot'
    ? (Math.min(quality.width, quality.height) < 900 ? 3 : 2)
    : Math.min(quality.width, quality.height) < 1200 ? 2.5 : 2
  const safeScale = Math.max(1, Math.min(desiredScale, Math.sqrt(MAX_OUTPUT_PIXELS / (quality.contentBounds.width * quality.contentBounds.height))))
  return {
    mediaKind,
    scale: Number(safeScale.toFixed(2)),
    grayscale: mediaKind !== 'scan',
    contrastStretch: mediaKind !== 'scan' && quality.contrast < 72,
    // Live adversarial evidence showed automatic median denoise can erase thin
    // Chinese strokes. Keep it available for explicit ablation, never auto-route it.
    medianDenoise: false,
    cropWhitespace: mediaKind === 'screenshot' && !quality.contentTouchesEdge && quality.whiteRatio > 0.35,
    // AUTO retained for photos/scans: the component ablation showed forcing a
    // single block can merge rows and corrupt late-night date digits.
    pageSegmentationMode: 'auto',
    orientation: 'exif-normalized',
  }
}

export function transformOcrPixels(data: Uint8ClampedArray, contrastStretch: boolean, medianDenoise: boolean, grayscale = true): Uint8ClampedArray {
  if (!grayscale && !contrastStretch && !medianDenoise) return new Uint8ClampedArray(data)
  const gray = new Uint8ClampedArray(data.length)
  const values: number[] = []
  for (let offset = 0; offset < data.length; offset += 4) {
    const value = Math.round(luminance(data, offset))
    values.push(value)
    gray[offset] = value; gray[offset + 1] = value; gray[offset + 2] = value; gray[offset + 3] = data[offset + 3]
  }
  if (contrastStretch && values.length) {
    const sorted = [...values].sort((a, b) => a - b)
    const low = sorted[Math.floor(sorted.length * 0.01)]
    const high = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99))]
    if (high - low >= 20) {
      for (let offset = 0; offset < gray.length; offset += 4) {
        const value = Math.max(0, Math.min(255, Math.round(((gray[offset] - low) * 255) / (high - low))))
        gray[offset] = value; gray[offset + 1] = value; gray[offset + 2] = value
      }
    }
  }
  if (medianDenoise && values.length >= 9) {
    // Conservative one-dimensional median removes isolated sensor speckles without
    // crossing text rows. Geometry-changing deskew/perspective is intentionally not automatic.
    for (let offset = 4; offset < gray.length - 4; offset += 4) {
      const median = [gray[offset - 4], gray[offset], gray[offset + 4]].sort((a, b) => a - b)[1]
      gray[offset] = median; gray[offset + 1] = median; gray[offset + 2] = median
    }
  }
  return gray
}

export function routeOcrQuality(quality: PixelQuality, ocr: { text: string; confidence?: number }): OcrQualityDecision {
  const reasons: string[] = []
  let score = 0
  const escalate = (next: OcrQualityRoute, reason: string) => {
    reasons.push(reason)
    score = Math.max(score, next === 'retake' ? 2 : next === 'review' ? 1 : 0)
  }
  if (Math.min(quality.width, quality.height) < 480) escalate('retake', '图片分辨率过低')
  else if (Math.min(quality.width, quality.height) < 800) escalate('review', '图片分辨率偏低')
  if (quality.contrast < 18) escalate('retake', '文字与背景对比度过低')
  else if (quality.contrast < 30) escalate('review', '文字与背景对比度偏低')
  if (quality.sharpness < 3.5) escalate('retake', '图片明显模糊')
  else if (quality.sharpness < 7) escalate('review', '图片清晰度偏低')
  if (quality.darkClippingRatio > 0.22) escalate('retake', '暗部大面积丢失')
  if (quality.contentTouchesEdge) escalate('review', '正文贴近边缘，可能被裁掉')
  if (quality.perspectiveRisk) escalate('review', '拍摄角度可能倾斜；未自动拉伸以免抹掉字符')
  if (!ocr.text.trim()) escalate('retake', '没有识别到可核对文字')
  else if (ocr.text.trim().length < 12) escalate('review', '识别文字过少')
  if (ocr.confidence !== undefined && ocr.confidence < 0.55) escalate('review', 'OCR 置信度偏低')
  const route: OcrQualityRoute = score >= 2 ? 'retake' : score === 1 ? 'review' : 'accept'
  return {
    route,
    reasons: [...new Set(reasons)],
    guidance: route === 'retake'
      ? '建议重新拍摄或换清晰原图；当前文字不要直接确认。'
      : route === 'review'
        ? '请逐字核对日期、数字和材料名，必要时重新选页或人工补充。'
        : '画面质量可用，仍需核对日期、数字和任务内容后确认。',
  }
}

export async function prepareCanvasForOcr(source: CanvasImageSource, width: number, height: number, mediaKind: OcrMediaKind): Promise<PreparedOcrCanvas> {
  const input = document.createElement('canvas')
  input.width = width; input.height = height
  const inputContext = input.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!inputContext) throw new Error('CANVAS_UNAVAILABLE')
  inputContext.fillStyle = '#ffffff'; inputContext.fillRect(0, 0, width, height); inputContext.drawImage(source, 0, 0, width, height)
  const image = inputContext.getImageData(0, 0, width, height)
  const before = analyzeOcrPixels(image.data, width, height)
  const profile = selectOcrProfile(mediaKind, before)
  const bounds = profile.cropWhitespace ? before.contentBounds : { x: 0, y: 0, width, height }
  const crop = inputContext.getImageData(bounds.x, bounds.y, bounds.width, bounds.height)
  const transformed = transformOcrPixels(crop.data, profile.contrastStretch, profile.medianDenoise, profile.grayscale)
  const intermediate = document.createElement('canvas')
  intermediate.width = bounds.width; intermediate.height = bounds.height
  const intermediateContext = intermediate.getContext('2d', { alpha: false })
  if (!intermediateContext) throw new Error('CANVAS_UNAVAILABLE')
  const transformedImage = intermediateContext.createImageData(bounds.width, bounds.height)
  transformedImage.data.set(transformed)
  intermediateContext.putImageData(transformedImage, 0, 0)
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(bounds.width * profile.scale)); output.height = Math.max(1, Math.round(bounds.height * profile.scale))
  const outputContext = output.getContext('2d', { alpha: false })
  if (!outputContext) throw new Error('CANVAS_UNAVAILABLE')
  outputContext.imageSmoothingEnabled = mediaKind === 'photo'
  if (mediaKind === 'photo') outputContext.imageSmoothingQuality = 'high'
  outputContext.drawImage(intermediate, 0, 0, output.width, output.height)
  const qualityFlags = [
    ...(profile.cropWhitespace ? ['已保守裁去纯背景边缘'] : []),
    ...(profile.contrastStretch ? ['已在本机增强灰度对比度'] : []),
    ...(profile.medianDenoise ? ['已在本机保守降噪'] : []),
    ...(before.perspectiveRisk ? ['检测到透视风险；未自动拉伸，请人工核对或重拍'] : []),
    ...(width > height * 1.45 && mediaKind === 'scan' ? ['扫描页为横向，方向需人工核对'] : []),
  ]
  input.width = 1; input.height = 1; intermediate.width = 1; intermediate.height = 1
  return { canvas: output, profile, before, estimatedBytes: output.width * output.height * 4, qualityFlags }
}

export async function prepareFileImageForOcr(file: File, mediaKind: OcrMediaKind): Promise<PreparedOcrCanvas> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try { return await prepareCanvasForOcr(bitmap, bitmap.width, bitmap.height, mediaKind) }
  finally { bitmap.close() }
}
