import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../pipeline'
import { recognitionGoldenDataset, recognitionGoldenDatasetMetadata } from './goldenDataset'
import { recognitionHoldoutDataset, recognitionHoldoutMetadata } from './holdoutDataset'
import { recognitionErrorTaxonomy } from './errorTaxonomy'
import { aggregateRecognitionMetrics, scoreRecognitionCase } from './scoring'

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
