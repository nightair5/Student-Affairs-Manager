import { describe, expect, it } from 'vitest'
import { evaluateE2QualityGate } from './gates'
import type { RecognitionBaselineMetrics } from './types'

function metrics(overrides: Partial<RecognitionBaselineMetrics> = {}): RecognitionBaselineMetrics {
  return {
    provider: 'deepseek-production', sampleCount: 40, completedCount: 40,
    projectDecisionAccuracy: 0.9, milestonePrecision: 0.8, milestoneRecall: 0.8,
    taskPrecision: 0.9, taskRecall: 0.85, materialPrecision: 0.9, materialRecall: 0.8,
    timePointPrecision: 0.9, timePointRecall: 0.85, timePointTypeAccuracy: 0.85,
    timePointValueAccuracy: 0.82, timePointAccuracy: 0.8,
    eventAccuracy: 0.9, evidenceCoverage: 0.97, evidenceValidity: 1,
    ambiguityPrecision: 0.9, ambiguityRecall: 0.85, duplicateRate: 0.01,
    overFragmentationRate: 0.02, majorCorrectionRate: 0.3, severeErrorRate: 0.01,
    invalidOutputRate: 0, requestFailureRate: 0, repairTriggerRate: 0.2,
    repairSuccessRate: 0.75, repairLatencyMs: { mean: 1, p95: 1 }, retryRate: 0,
    complexityDistribution: { simple: 20, medium: 15, complex: 5, unknown: 0 },
    latencyMs: { mean: 1, p50: 1, p95: 1 },
    tokenUsage: null, costUsd: null, errorTaxonomy: [], ...overrides,
  }
}

describe('E2 frozen quality gate', () => {
  it('passes only when every minimum and maximum threshold is met', () => {
    expect(evaluateE2QualityGate(metrics()).passed).toBe(true)
    const failed = evaluateE2QualityGate(metrics({ timePointAccuracy: 0.74, severeErrorRate: 0.03 }))
    expect(failed.passed).toBe(false)
    expect(failed.checks.filter((check) => !check.passed).map((check) => check.metric)).toEqual(['timePointAccuracy', 'severeErrorRate'])
  })
})
