import { describe, expect, it } from 'vitest'
import { evaluateRecognition } from './evaluation'
import { recognitionEvaluationDataset } from './evaluationDataset'

describe('60-case recognition evaluation', () => {
  it('keeps the anonymous dataset complete and reports reproducible metrics', () => {
    const metrics = evaluateRecognition()
    console.info(`RECOGNITION_EVAL=${JSON.stringify(metrics)}`)
    expect(recognitionEvaluationDataset).toHaveLength(60)
    expect(new Set(recognitionEvaluationDataset.map((fixture) => fixture.id)).size).toBe(60)
    expect(metrics.sampleCount).toBe(60)
    expect(metrics.evidenceAccuracy).toBeGreaterThanOrEqual(0.9)
    expect(metrics.duplicateTaskRate).toBeLessThanOrEqual(0.1)
    expect(metrics.averageConfirmationTimeSeconds).toBeNull()
  })
})
