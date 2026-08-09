import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../pipeline'
import { recognitionGoldenDataset, recognitionGoldenDatasetMetadata } from './goldenDataset'
import { recognitionHoldoutDataset, recognitionHoldoutMetadata } from './holdoutDataset'
import { recognitionErrorTaxonomy } from './errorTaxonomy'
import { aggregateRecognitionMetrics, scoreRecognitionCase } from './scoring'
import type { RecognitionCaseResult } from './types'

describe('E2-A recognition golden dataset', () => {
  it('contains 110 unique anonymous cases with a complete expected contract', () => {
    expect(recognitionGoldenDataset).toHaveLength(110)
    expect(recognitionGoldenDatasetMetadata.sampleCount).toBe(110)
    expect(new Set(recognitionGoldenDataset.map((fixture) => fixture.id)).size).toBe(110)
    expect(new Set(recognitionGoldenDataset.map((fixture) => fixture.group))).toEqual(new Set([
      'course', 'complex_notice', 'competition', 'application', 'event', 'multi_deadline',
      'material', 'vague_time', 'information_only', 'ocr_noise', 'security',
    ]))
    recognitionGoldenDataset.forEach((fixture) => {
      expect(fixture.sourceTitle.trim()).not.toBe('')
      expect(fixture.rawText.trim()).not.toBe('')
      expect(fixture.rawText).not.toMatch(/(?:姓名：|学号：|手机号：|身份证：)\s*\S+/u)
      expect(fixture.expected.project.decisions.length).toBeGreaterThan(0)
      expect(Array.isArray(fixture.expected.milestones)).toBe(true)
      expect(Array.isArray(fixture.expected.tasks)).toBe(true)
      expect(Array.isArray(fixture.expected.materials)).toBe(true)
      expect(Array.isArray(fixture.expected.timePoints)).toBe(true)
      expect(Array.isArray(fixture.expected.events)).toBe(true)
      expect(Array.isArray(fixture.expected.evidence)).toBe(true)
      expect(Array.isArray(fixture.expected.ambiguities)).toBe(true)
      expect(fixture.expected.forbidden.some((item) => item.kind === 'sentinel_date')).toBe(true)
    })
  })

  it('scores the deterministic fallback separately and reproducibly', () => {
    const results = recognitionGoldenDataset.map((fixture) => {
      const result = buildLocalRecognition({
        sourceType: fixture.sourceType,
        sourceTitle: fixture.sourceTitle,
        content: fixture.rawText,
        referenceTime: new Date(fixture.referenceTime),
        timezone: fixture.timezone,
        projects: [],
        tasks: [],
      })
      return scoreRecognitionCase(fixture, 'local-fallback', result, 0)
    })
    const metrics = aggregateRecognitionMetrics('local-fallback', results)
    expect(metrics.provider).toBe('local-fallback')
    expect(metrics.sampleCount).toBe(110)
    expect(metrics.completedCount).toBe(110)
    expect(metrics.invalidOutputRate).toBe(0)
    expect(metrics.requestFailureRate).toBe(0)
    expect(metrics.materialPrecision).toBeGreaterThanOrEqual(0)
    expect(metrics.timePointPrecision).toBeGreaterThanOrEqual(0)
    expect(metrics.timePointRecall).toBeGreaterThanOrEqual(0)
    expect(metrics.timePointTypeAccuracy).toBeGreaterThanOrEqual(0)
    expect(metrics.timePointValueAccuracy).toBeGreaterThanOrEqual(0)
    expect(metrics.evidenceValidity).toBeGreaterThanOrEqual(0)
    expect(metrics.ambiguityPrecision).toBeGreaterThanOrEqual(0)
    expect(metrics.ambiguityRecall).toBeGreaterThanOrEqual(0)
    expect(metrics.repairTriggerRate).toBe(0)
    expect(metrics.repairSuccessRate).toBeNull()
    expect(metrics.tokenUsage).toBeNull()
    expect(metrics.costUsd).toBeNull()
    expect(metrics.errorTaxonomy.length).toBeGreaterThan(0)
  })

  it('treats request failures and invalid outputs as severe without fabricating usage', () => {
    const fixture = recognitionGoldenDataset[0]
    const invalid = scoreRecognitionCase(fixture, 'deepseek-production', null, 120, {
      status: 'invalid_output',
      failureReason: 'schema mismatch',
    })
    const failed = scoreRecognitionCase(fixture, 'deepseek-production', null, 240, {
      status: 'request_failure',
      failureReason: '429 RATE_LIMITED',
    })
    const metrics = aggregateRecognitionMetrics('deepseek-production', [invalid, failed])
    expect(metrics.invalidOutputRate).toBe(0.5)
    expect(metrics.requestFailureRate).toBe(0.5)
    expect(metrics.severeErrorRate).toBe(1)
    expect(metrics.tokenUsage).toBeNull()
    expect(metrics.costUsd).toBeNull()
  })

  it('never matches an empty prediction as an alias', () => {
    const fixture = recognitionGoldenDataset.find((entry) => entry.expected.tasks.length > 0)
    expect(fixture).toBeDefined()
    const result = buildLocalRecognition({
      sourceType: fixture!.sourceType,
      sourceTitle: fixture!.sourceTitle,
      content: fixture!.rawText,
      referenceTime: new Date(fixture!.referenceTime),
      timezone: fixture!.timezone,
      projects: [],
      tasks: [],
    })
    const blankTask = (task: typeof result.standaloneTasks[number]) => ({
      ...task,
      title: '',
      actionVerb: '',
      actionObject: '',
    })
    const blank = {
      ...result,
      standaloneTasks: result.standaloneTasks.map(blankTask),
      milestones: result.milestones.map((milestone) => ({
        ...milestone,
        tasks: milestone.tasks.map(blankTask),
        workPackages: milestone.workPackages.map((workPackage) => ({
          ...workPackage,
          tasks: workPackage.tasks.map(blankTask),
        })),
      })),
    }
    const scored = scoreRecognitionCase(fixture!, 'local-fallback', blank, 0)
    expect(scored.scores.taskTruePositive).toBe(0)
  })

  it('aggregates observed repair, retry and route metadata without guessing missing values', () => {
    const fixture = recognitionGoldenDataset[0]
    const result = buildLocalRecognition({
      sourceType: fixture.sourceType,
      sourceTitle: fixture.sourceTitle,
      content: fixture.rawText,
      referenceTime: new Date(fixture.referenceTime),
      timezone: fixture.timezone,
      projects: [],
      tasks: [],
    })
    const scored = scoreRecognitionCase(fixture, 'deepseek-production', result, 900)
    const observed: RecognitionCaseResult = {
      ...scored,
      repair: {
        attempted: true,
        applied: true,
        errorCode: null,
        beforeScores: {
          taskTruePositive: Math.max(0, scored.scores.taskTruePositive - 1),
          materialMatched: scored.scores.materialMatched,
          timePointMatched: scored.scores.timePointMatched,
          eventMatched: scored.scores.eventMatched,
          evidenceMatched: scored.scores.evidenceMatched,
          duplicateCount: scored.scores.duplicateCount,
          overFragmented: scored.scores.overFragmented,
          majorCorrection: scored.scores.majorCorrection,
          severeError: scored.scores.severeError,
        },
      },
      execution: {
        attempts: 3,
        durationMs: 850,
        operations: [
          { operation: 'recognize', durationMs: 500, attempts: 2, ok: true, tokenUsage: { input: 100, output: 50 } },
          { operation: 'repair', durationMs: 350, attempts: 1, ok: true, tokenUsage: { input: 80, output: 20 } },
        ],
      },
      route: { level: 'medium', selectedStrategy: 'single_pass' },
    }
    const metrics = aggregateRecognitionMetrics('deepseek-production', [observed])
    expect(metrics.repairTriggerRate).toBe(1)
    expect(metrics.repairAppliedRate).toBe(1)
    expect(metrics.repairSuccessRate).toBe(1)
    expect(metrics.repairHarmRate).toBe(0)
    expect(metrics.repairLatencyMs).toEqual({ mean: 350, p95: 350 })
    expect(metrics.retryRate).toBe(1)
    expect(metrics.complexityDistribution).toEqual({ simple: 0, medium: 1, complex: 0, unknown: 0 })
    expect(metrics.complexityProfiles.medium.sampleCount).toBe(1)
    expect(metrics.operationTokenUsage.repair).toEqual({ input: 80, output: 20 })
  })
})

describe('E2-B frozen evaluation assets', () => {
  it('keeps a distinct 40-case holdout with the complete expected contract', () => {
    expect(recognitionHoldoutDataset).toHaveLength(40)
    expect(recognitionHoldoutMetadata.sampleCount).toBe(40)
    const goldenTexts = new Set(recognitionGoldenDataset.map((fixture) => fixture.rawText))
    expect(new Set(recognitionHoldoutDataset.map((fixture) => fixture.id)).size).toBe(40)
    expect(recognitionHoldoutDataset.every((fixture) => !goldenTexts.has(fixture.rawText))).toBe(true)
    expect(new Set(recognitionHoldoutDataset.map((fixture) => fixture.group))).toEqual(new Set([
      'course', 'competition', 'application', 'scholarship', 'meeting', 'event',
      'complex_notice', 'multi_deadline', 'material', 'vague_time', 'information_only',
      'ocr_noise', 'security',
    ]))
    recognitionHoldoutDataset.forEach((fixture) => {
      expect(fixture.rawText).not.toMatch(/(?:姓名：|学号：|手机号：|身份证：)\s*\S+/u)
      expect(fixture.expected.project.decisions.length).toBeGreaterThan(0)
      expect(Array.isArray(fixture.expected.milestones)).toBe(true)
      expect(Array.isArray(fixture.expected.tasks)).toBe(true)
      expect(Array.isArray(fixture.expected.materials)).toBe(true)
      expect(Array.isArray(fixture.expected.timePoints)).toBe(true)
      expect(Array.isArray(fixture.expected.events)).toBe(true)
      expect(Array.isArray(fixture.expected.evidence)).toBe(true)
      expect(Array.isArray(fixture.expected.ambiguities)).toBe(true)
      expect(fixture.expected.forbidden.some((item) => item.kind === 'sentinel_date')).toBe(true)
    })
  })

  it('defines every frozen E2 error taxonomy tag exactly once', () => {
    expect(recognitionErrorTaxonomy).toHaveLength(33)
    expect(new Set(recognitionErrorTaxonomy.map((item) => item.tag)).size).toBe(33)
    expect(recognitionErrorTaxonomy.map((item) => item.tag)).toEqual(expect.arrayContaining([
      'PROJECT_DECISION_ERROR', 'MISSING_MILESTONE', 'MISSING_TASK', 'MISSING_MATERIAL',
      'MISSING_TIMEPOINT', 'FALSE_PRECISION', 'MISSING_EVENT', 'MISSING_EVIDENCE',
      'INVALID_REFERENCE', 'PROMPT_INJECTION_FAILURE', 'TRANSPORT_FAILURE',
      'REPAIR_FAILURE', 'SEVERE_ERROR',
    ]))
  })
})
