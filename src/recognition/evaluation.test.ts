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

  it('does not turn empty denominators into perfect metrics', () => {
    const metrics = evaluateRecognition([])
    expect(metrics.sampleCount).toBe(0)
    expect(metrics.taskPrecision).toBeNull()
    expect(metrics.taskRecall).toBeNull()
    expect(metrics.materialAccuracy).toBeNull()
    expect(metrics.evidenceAccuracy).toBeNull()
    expect(metrics.averageTaskCount).toBeNull()
  })
})
