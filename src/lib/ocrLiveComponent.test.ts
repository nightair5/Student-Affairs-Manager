import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, GlobalFonts, type Canvas } from '@napi-rs/canvas'
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'
import fixtureData from './fixtures/ocr-component-seen-v1.json'
import { evaluateOcrComponent, quantileType7, type OcrComponentFixture, type OcrComponentSpec } from './ocrEvaluation'
import { analyzeOcrPixels, selectOcrProfile, transformOcrPixels, type OcrMediaKind } from './ocrPreprocessing'

const live = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RUN_LIVE_OCR_COMPONENT === '1'
const liveDescribe = live ? describe : describe.skip
const fontPath = 'C:\\Windows\\Fonts\\msyh.ttc'

function renderFixture(text: string, mediaKind: OcrMediaKind): Canvas {
  const width = mediaKind === 'screenshot' ? 400 : 460
  const height = mediaKind === 'screenshot' ? 100 : 140
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  context.fillStyle = mediaKind === 'photo' ? '#d5d1c8' : mediaKind === 'scan' ? '#eeeeea' : '#ffffff'
  context.fillRect(0, 0, width, height)
  context.font = `${mediaKind === 'screenshot' ? 9.5 : mediaKind === 'scan' ? 13 : 11}px RcoChinese`
  context.fillStyle = mediaKind === 'photo' ? '#77736d' : mediaKind === 'scan' ? '#999999' : '#343434'
  const split = Math.ceil(text.length / 2)
  context.fillText(text.slice(0, split), 16, mediaKind === 'screenshot' ? 38 : 52)
  context.fillText(text.slice(split), 16, mediaKind === 'screenshot' ? 68 : 88)
  const image = context.getImageData(0, 0, width, height)
  if (mediaKind !== 'screenshot') {
    // Deterministic sensor/scan speckles; no random source enters the fixture.
    for (let index = 37; index < image.data.length; index += 997) {
      image.data[index - (index % 4)] = 150
      image.data[index - (index % 4) + 1] = 150
      image.data[index - (index % 4) + 2] = 150
    }
    context.putImageData(image, 0, 0)
  }
  return canvas
}

function preprocess(canvas: Canvas, mediaKind: OcrMediaKind): { canvas: Canvas; psm: PSM } {
  const context = canvas.getContext('2d')
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const quality = analyzeOcrPixels(image.data, canvas.width, canvas.height)
  const profile = selectOcrProfile(mediaKind, quality)
  const transformed = transformOcrPixels(image.data, profile.contrastStretch, profile.medianDenoise, profile.grayscale)
  const intermediate = createCanvas(canvas.width, canvas.height)
  const intermediateContext = intermediate.getContext('2d')
  const outputImage = intermediateContext.createImageData(canvas.width, canvas.height)
  outputImage.data.set(transformed)
  intermediateContext.putImageData(outputImage, 0, 0)
  const output = createCanvas(Math.round(canvas.width * profile.scale), Math.round(canvas.height * profile.scale))
  const outputContext = output.getContext('2d')
  outputContext.imageSmoothingEnabled = mediaKind === 'photo'
  if (mediaKind === 'photo') outputContext.imageSmoothingQuality = 'high'
  outputContext.drawImage(intermediate, 0, 0, output.width, output.height)
  return { canvas: output, psm: profile.pageSegmentationMode === 'sparse' ? PSM.SPARSE_TEXT : profile.pageSegmentationMode === 'single-block' ? PSM.SINGLE_BLOCK : PSM.AUTO }
}

liveDescribe('live local Tesseract component evidence', () => {
  let worker: Worker
  beforeAll(async () => {
    expect(GlobalFonts.registerFromPath(fontPath, 'RcoChinese')).toBeTruthy()
    worker = await createWorker('chi_sim', OEM.LSTM_ONLY)
  }, 120_000)
  afterAll(async () => { await worker?.terminate() })

  it('runs the fixed SEEN_DIAGNOSTIC media fixtures and reports auditable metrics', async () => {
    const observed: OcrComponentFixture[] = []
    const candidateLatencies: number[] = []
    const perFixtureP95: number[] = []
    const memoryUsage = (globalThis as { process?: { memoryUsage?: () => { rss: number } } }).process?.memoryUsage
    const baselineRss = memoryUsage?.().rss
    let peakRss = baselineRss ?? 0
    expect(fixtureData.status).toBe('SEEN_DIAGNOSTIC')
    expect(fixtureData.commercialHoldoutEligible).toBe(false)
    for (const fixture of fixtureData.fixtures as OcrComponentSpec[]) {
      const source = renderFixture(fixture.expectedText, fixture.mediaKind)
      await worker.setParameters({ tessedit_pageseg_mode: fixture.mediaKind === 'screenshot' ? PSM.SPARSE_TEXT : PSM.AUTO })
      const baseline = await worker.recognize(source.toBuffer('image/png'))
      const candidateInput = preprocess(source, fixture.mediaKind)
      await worker.setParameters({ tessedit_pageseg_mode: candidateInput.psm, preserve_interword_spaces: '1' })
      const candidateBytes = candidateInput.canvas.toBuffer('image/png')
      let candidate: Awaited<ReturnType<Worker['recognize']>> | undefined
      const fixtureLatencies: number[] = []
      for (let repetition = 0; repetition < 10; repetition += 1) {
        const started = performance.now()
        const recognition = await worker.recognize(candidateBytes)
        const latency = performance.now() - started
        candidateLatencies.push(latency)
        fixtureLatencies.push(latency)
        peakRss = Math.max(peakRss, memoryUsage?.().rss ?? 0)
        candidate ??= recognition
      }
      perFixtureP95.push(quantileType7(fixtureLatencies, 0.95))
      if (!candidate) throw new Error('LIVE_OCR_CANDIDATE_MISSING')
      observed.push({ ...fixture, baselineText: baseline.data.text.trim(), candidateText: candidate.data.text.trim() })
    }
    const baseline = evaluateOcrComponent(observed, 'baselineText')
    const candidate = evaluateOcrComponent(observed, 'candidateText')
    const p95Ms = quantileType7(candidateLatencies, 0.95)
    const selectedPagesP95UpperBoundMs = perFixtureP95.reduce((sum, value) => sum + value, 0)
    const incrementalRssMiB = baselineRss === undefined ? null : (peakRss - baselineRss) / 1024 / 1024
    console.log(`RCO4_LIVE_OCR=${JSON.stringify({ status: 'SEEN_DIAGNOSTIC', performanceRuns: candidateLatencies.length, baseline, candidate, p95Ms, selectedPagesP95UpperBoundMs, incrementalRssMiB, observations: observed.map((item) => ({ id: item.id, baselineText: item.baselineText, candidateText: item.candidateText })) })}`)
    expect(candidate.cer).toBeLessThan(baseline.cer)
    expect(candidate.criticalDateExact).toBeGreaterThan(baseline.criticalDateExact)
    expect(candidate.taskExact).toBeGreaterThan(baseline.taskExact)
    expect(candidate.timeExact).toBeGreaterThan(baseline.timeExact)
    expect(p95Ms).toBeLessThanOrEqual(15_000)
    expect(selectedPagesP95UpperBoundMs).toBeLessThanOrEqual(45_000)
    expect(incrementalRssMiB).not.toBeNull()
    expect(incrementalRssMiB ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(512)
  }, 180_000)
})
