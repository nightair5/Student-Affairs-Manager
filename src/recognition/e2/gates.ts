import type { RecognitionBaselineMetrics } from './types'

export const E2_GATE_VERSION = 'e2-quality-gate-1.0.0'

export const e2QualityThresholds = Object.freeze({
  projectDecisionAccuracy: { direction: 'min', value: 0.88 },
  taskPrecision: { direction: 'min', value: 0.85 },
  taskRecall: { direction: 'min', value: 0.82 },
  materialRecall: { direction: 'min', value: 0.75 },
  timePointAccuracy: { direction: 'min', value: 0.75 },
  eventAccuracy: { direction: 'min', value: 0.8696 },
  evidenceCoverage: { direction: 'min', value: 0.9533 },
  duplicateRate: { direction: 'max', value: 0.03 },
  overFragmentationRate: { direction: 'max', value: 0.05 },
  majorCorrectionRate: { direction: 'max', value: 0.35 },
  severeErrorRate: { direction: 'max', value: 0.02 },
  invalidOutputRate: { direction: 'max', value: 0.01 },
  requestFailureRate: { direction: 'max', value: 0.01 },
} as const)

export interface E2GateResult {
  gateVersion: typeof E2_GATE_VERSION
  passed: boolean
  checks: Array<{ metric: keyof typeof e2QualityThresholds; actual: number; threshold: number; direction: 'min' | 'max'; passed: boolean }>
}

export function evaluateE2QualityGate(metrics: RecognitionBaselineMetrics): E2GateResult {
  const checks = (Object.entries(e2QualityThresholds) as Array<[keyof typeof e2QualityThresholds, { direction: 'min' | 'max'; value: number }]>).map(([metric, rule]) => {
    const actual = metrics[metric] as number
    return { metric, actual, threshold: rule.value, direction: rule.direction, passed: rule.direction === 'min' ? actual >= rule.value : actual <= rule.value }
  })
  return { gateVersion: E2_GATE_VERSION, passed: checks.every((check) => check.passed), checks }
}
