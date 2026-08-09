import { describe, expect, it } from 'vitest'

import {
  recognitionGeneralizationDevelopmentDataset,
  recognitionGeneralizationDevelopmentMetadata,
  type GeneralizationDimension,
} from './generalizationDataset'
import { recognitionGoldenDataset } from './goldenDataset'
import { recognitionHoldoutDataset } from './holdoutDataset'

const requiredDimensions: GeneralizationDimension[] = [
  'short_message', 'long_notice', 'chat', 'formal_notice', 'table', 'ocr_noise',
  'multi_paragraph', 'disordered', 'materials_first', 'time_first', 'time_in_note',
  'materials_in_attachment', 'no_typical_verb', 'event_task_mixed', 'multiple_events',
  'multiple_deadlines', 'vague_time', 'relative_time', 'conflicting_time', 'optional',
  'conditional', 'information_only', 'no_action', 'prompt_injection',
]

function normalizedText(value: string): string {
  return value.replace(/\s+/gu, '').replace(/[，。；、：:（）()“”"'`]/gu, '').toLowerCase()
}

describe('E2 generalization development dataset', () => {
  it('contains 108 development-only cases across 27 four-variant semantic families', () => {
    expect(recognitionGeneralizationDevelopmentMetadata).toMatchObject({
      datasetVersion: 'e2-generalization-development-1.0.0',
      sampleCount: 108,
      semanticFamilyCount: 27,
      variantsPerFamily: 4,
    })
    expect(recognitionGeneralizationDevelopmentDataset).toHaveLength(108)
    const familyCounts = new Map<string, typeof recognitionGeneralizationDevelopmentDataset>()
    recognitionGeneralizationDevelopmentDataset.forEach((fixture) => {
      const family = fixture.generalization.familyId
      familyCounts.set(family, [...(familyCounts.get(family) ?? []), fixture])
    })
    expect(familyCounts.size).toBe(27)
    familyCounts.forEach((fixtures) => {
      expect(fixtures).toHaveLength(4)
      expect(new Set(fixtures.map((fixture) => fixture.generalization.variant)).size).toBe(4)
    })
  })

  it('covers every required generalization dimension with at least one full variant family', () => {
    requiredDimensions.forEach((dimension) => {
      const cases = recognitionGeneralizationDevelopmentDataset.filter((fixture) => fixture.generalization.dimensions.includes(dimension))
      expect(cases.length, dimension).toBeGreaterThanOrEqual(4)
    })
  })

  it('has unique ids and texts and does not duplicate frozen Golden or exposed Holdout inputs', () => {
    const ids = recognitionGeneralizationDevelopmentDataset.map((fixture) => fixture.id)
    const texts = recognitionGeneralizationDevelopmentDataset.map((fixture) => normalizedText(fixture.rawText))
    const frozenTexts = new Set([...recognitionGoldenDataset, ...recognitionHoldoutDataset].map((fixture) => normalizedText(fixture.rawText)))
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(texts).size).toBe(texts.length)
    texts.forEach((text) => expect(frozenTexts.has(text)).toBe(false))
  })

  it('keeps every expected entity traceable to a literal fragment in its own source', () => {
    const missing: string[] = []
    recognitionGeneralizationDevelopmentDataset.forEach((fixture) => {
      fixture.expected.tasks.forEach((task) => {
        if (!task.objectAliases.some((fragment) => fixture.rawText.includes(fragment))) missing.push(`${fixture.id}:task:${task.key}`)
      })
      fixture.expected.materials.forEach((material) => {
        if (!material.nameAliases.some((fragment) => fixture.rawText.includes(fragment))) missing.push(`${fixture.id}:material:${material.key}`)
      })
      fixture.expected.timePoints.forEach((timePoint) => {
        if (!timePoint.rawIncludes.some((fragment) => fixture.rawText.includes(fragment))) missing.push(`${fixture.id}:time:${timePoint.key}`)
      })
      fixture.expected.events.forEach((event) => {
        if (!event.titleAliases.some((fragment) => fixture.rawText.includes(fragment))) missing.push(`${fixture.id}:event:${event.key}`)
      })
      fixture.expected.evidence.forEach((evidence) => {
        if (!evidence.quoteIncludes.some((fragment) => fixture.rawText.includes(fragment))) missing.push(`${fixture.id}:${evidence.field}:${evidence.targetKey}`)
      })
    })
    expect(missing).toEqual([])
  })
})
