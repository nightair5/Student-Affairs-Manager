import { parseChineseTimeAst } from './timeSemantics'
import type { OcrMediaKind } from './ocrPreprocessing'

export interface OcrComponentSpec {
  id: string
  mediaKind: OcrMediaKind
  expectedText: string
  expectedTaskTokens: string[]
  expectedTime: string
}

export interface OcrComponentFixture extends OcrComponentSpec {
  baselineText: string
  candidateText: string
}

export interface OcrComponentMetrics {
  sampleCount: number
  cer: number
  criticalDateExact: number
  taskExact: number
  timeExact: number
}

function editDistance(expected: string, predicted: string): number {
  const previous = Array.from({ length: predicted.length + 1 }, (_, index) => index)
  for (let row = 1; row <= expected.length; row += 1) {
    let diagonal = previous[0]
    previous[0] = row
    for (let column = 1; column <= predicted.length; column += 1) {
      const above = previous[column]
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (expected[row - 1] === predicted[column - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return previous[predicted.length]
}

function comparable(text: string): string {
  return text.normalize('NFKC').replace(/\s+/gu, '').replace(/[，。；：、,.!！?？]/gu, '')
}

export function characterErrorRate(expected: string, predicted: string): number {
  const cleanExpected = comparable(expected)
  const cleanPredicted = comparable(predicted)
  return cleanExpected.length ? editDistance(cleanExpected, cleanPredicted) / cleanExpected.length : cleanPredicted.length ? 1 : 0
}

export function quantileType7(values: number[], probability: number): number {
  if (!values.length || probability < 0 || probability > 1) throw new Error('INVALID_QUANTILE_INPUT')
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const index = (sorted.length - 1) * probability
  const lower = Math.floor(index)
  const fraction = index - lower
  return sorted[lower] + fraction * (sorted[Math.min(sorted.length - 1, lower + 1)] - sorted[lower])
}

export function criticalDateDigits(text: string): string[] {
  return [...text.normalize('NFKC').replace(/\s+/gu, '').matchAll(/(?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}(?:日|号)?(?:[^\d]{0,5}\d{1,2}(?::\d{2}|点(?:半)?))?/gu)]
    .map((match) => (match[0].match(/\d+/gu) ?? []).join('-'))
}

export function evaluateOcrComponent(fixtures: OcrComponentFixture[], arm: 'baselineText' | 'candidateText'): OcrComponentMetrics {
  let edits = 0, characters = 0, dateExact = 0, taskExact = 0, timeExact = 0
  for (const fixture of fixtures) {
    const predicted = fixture[arm]
    const expectedComparable = comparable(fixture.expectedText)
    edits += editDistance(expectedComparable, comparable(predicted))
    characters += expectedComparable.length
    if (JSON.stringify(criticalDateDigits(predicted)) === JSON.stringify(criticalDateDigits(fixture.expectedText))) dateExact += 1
    if (fixture.expectedTaskTokens.every((token) => predicted.includes(token))) taskExact += 1
    const ast = parseChineseTimeAst(predicted, { referenceTime: new Date('2026-09-02T00:00:00+08:00'), timezone: 'Asia/Shanghai', type: 'task_deadline' })
    if (ast.normalizedValue === fixture.expectedTime && !ast.needsConfirmation) timeExact += 1
  }
  const sampleCount = fixtures.length
  return {
    sampleCount,
    cer: characters ? edits / characters : 0,
    criticalDateExact: sampleCount ? dateExact / sampleCount : 0,
    taskExact: sampleCount ? taskExact / sampleCount : 0,
    timeExact: sampleCount ? timeExact / sampleCount : 0,
  }
}
