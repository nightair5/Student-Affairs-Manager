import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../pipeline'
import { recognitionGoldenDataset, recognitionGoldenDatasetMetadata } from './goldenDataset'
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
