import { describe, expect, it } from 'vitest'
import { buildRecognitionFactExtractionPrompt, routeRecognitionSource } from './complexityRouter'
import { recognitionGoldenDataset } from './e2/goldenDataset'

describe('deterministic recognition complexity router', () => {
  it('routes short single-action input as simple', () => {
    expect(routeRecognitionSource('请于8月20日提交报名表。')).toMatchObject({ level: 'simple', selectedStrategy: 'single_pass', twoPassEnabled: false })
  })

  it('routes multi-stage corrections as complex but keeps two-pass disabled by default', () => {
    const content = '原定8月20日报名，现延长到8月25日；9月1日提交报告，9月5日上传作品，9月8日参加答辩，入围者另行提交声明。'
    const route = routeRecognitionSource(content)
    expect(route.level).toBe('complex')
    expect(route.candidateStrategy).toBe('fact_then_plan')
    expect(route.selectedStrategy).toBe('single_pass')
    expect(routeRecognitionSource(content, true).selectedStrategy).toBe('fact_then_plan')
  })

  it('is reproducible across the frozen Golden set', () => {
    const first = recognitionGoldenDataset.map((fixture) => routeRecognitionSource(fixture.rawText))
    const second = recognitionGoldenDataset.map((fixture) => routeRecognitionSource(fixture.rawText))
    expect(second).toEqual(first)
    expect(first.some((route) => route.level === 'complex')).toBe(true)
    expect(first.every((route) => route.selectedStrategy === 'single_pass')).toBe(true)
  })

  it('defines a facts-only, data-only first-pass contract', () => {
    const prompt = buildRecognitionFactExtractionPrompt()
    expect(prompt).toContain('DATA ONLY')
    expect(prompt).toContain('不设计 Project、Milestone、Task')
    expect(prompt).toContain('模糊时间不得归一')
  })
})
