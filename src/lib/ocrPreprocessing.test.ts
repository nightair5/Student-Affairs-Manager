import { describe, expect, it } from 'vitest'
import { evaluateOcrComponent, quantileType7, type OcrComponentFixture } from './ocrEvaluation'
import { analyzeOcrPixels, routeOcrQuality, selectOcrProfile, transformOcrPixels, type PixelQuality } from './ocrPreprocessing'

function pixels(width: number, height: number, background = 255): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = background; data[offset + 1] = background; data[offset + 2] = background; data[offset + 3] = 255
  }
  return data
}

function rectangle(data: Uint8ClampedArray, width: number, x0: number, y0: number, x1: number, y1: number, value: number) {
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
    const offset = (y * width + x) * 4
    data[offset] = value; data[offset + 1] = value; data[offset + 2] = value
  }
}

describe('media-specific OCR preprocessing', () => {
  it('selects bounded profiles for screenshot, photo and scan', () => {
    const data = pixels(1000, 1400)
    for (let y = 180; y < 1150; y += 70) rectangle(data, 1000, 120, y, 880, y + 8, 30)
    const quality = analyzeOcrPixels(data, 1000, 1400)
    expect(selectOcrProfile('screenshot', quality)).toMatchObject({ pageSegmentationMode: 'auto', medianDenoise: false })
    expect(selectOcrProfile('photo', quality).pageSegmentationMode).toBe('auto')
    expect(selectOcrProfile('scan', quality).pageSegmentationMode).toBe('auto')
    expect(selectOcrProfile('scan', quality).scale ** 2 * quality.contentBounds.width * quality.contentBounds.height).toBeLessThanOrEqual(16_100_000)
  })

  it('raises low contrast while keeping opaque grayscale pixels', () => {
    const data = pixels(20, 1, 140)
    rectangle(data, 20, 0, 0, 10, 1, 100)
    const transformed = transformOcrPixels(data, true, false)
    expect(transformed[0]).toBe(0)
    expect(transformed[(19 * 4)]).toBe(255)
    expect(transformed.every((value, index) => index % 4 === 3 ? value === 255 : true)).toBe(true)
  })

  it('routes bad pixels to retake even when OCR self-confidence is high', () => {
    const bad = analyzeOcrPixels(pixels(320, 320, 128), 320, 320)
    const decision = routeOcrQuality(bad, { text: '2026年9月18日提交申请表', confidence: 0.99 })
    expect(decision.route).toBe('retake')
    expect(decision.reasons).toEqual(expect.arrayContaining([expect.stringContaining('分辨率'), expect.stringContaining('对比度')]))
  })

  it('uses confidence only as one review signal, never as the sole pass gate', () => {
    const good: PixelQuality = {
      width: 1200, height: 1600, meanLuminance: 210, contrast: 70, sharpness: 20,
      darkClippingRatio: 0.02, whiteRatio: 0.6,
      contentBounds: { x: 80, y: 80, width: 1040, height: 1440 }, contentTouchesEdge: false, perspectiveRisk: false,
    }
    expect(routeOcrQuality(good, { text: '请于2026年9月18日前提交申请表', confidence: 0.92 }).route).toBe('accept')
    expect(routeOcrQuality(good, { text: '请于2026年9月18日前提交申请表', confidence: 0.4 }).route).toBe('review')
  })
})

describe('component metric implementation', () => {
  it('uses the preregistered Type-7 quantile', () => {
    expect(quantileType7([1, 2, 3, 4], 0.95)).toBeCloseTo(3.85)
  })

  it('scores CER, date digits, task evidence and deterministic time independently', () => {
    const fixture: OcrComponentFixture = {
      id: 'metric-unit', mediaKind: 'screenshot',
      expectedText: '请于2026年9月18日下午3点前提交成绩单。',
      baselineText: '请于2026年9月13日下午8点前提交成绩里。',
      candidateText: '请于2026年9月18日下午3点前提交成绩单。',
      expectedTaskTokens: ['提交', '成绩单'], expectedTime: '2026-09-18T15:00',
    }
    const baseline = evaluateOcrComponent([fixture], 'baselineText')
    const candidate = evaluateOcrComponent([fixture], 'candidateText')
    expect(baseline).toMatchObject({ criticalDateExact: 0, taskExact: 0, timeExact: 0 })
    expect(candidate).toMatchObject({ cer: 0, criticalDateExact: 1, taskExact: 1, timeExact: 1 })
  })
})
