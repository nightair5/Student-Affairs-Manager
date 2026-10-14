import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from './pipeline'
import type { RecognitionResult, TaskSuggestionV2 } from './types'
import {
  assessFocusedReview,
  FOCUSED_REVIEW_THRESHOLDS,
  normalizeFocusedReviewSourceMetadata,
} from './focusedReview'

function baseResult(): RecognitionResult {
  return buildLocalRecognition({
    sourceType: 'text',
    sourceTitle: '匿名报名通知',
    content: '请于2026年8月20日18:00前提交报名表。',
    referenceTime: new Date('2026-08-08T08:00:00+08:00'),
    timezone: 'Asia/Shanghai',
    projects: [],
    tasks: [],
  })
}

function firstTask(result: RecognitionResult): TaskSuggestionV2 {
  const task = [
    ...result.standaloneTasks,
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks,
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
    ]),
  ][0]
  if (!task) throw new Error('TEST_TASK_MISSING')
  return task
}

function reasonCodes(result: RecognitionResult, metadata = {}) {
  return assessFocusedReview(result, metadata).reasons.map((reason) => reason.code)
}

describe('deterministic focused review assessment', () => {
  it('keeps a short, simple, single-deadline result on the normal review path', () => {
    const assessment = assessFocusedReview(baseResult(), {
      sourceType: 'text',
      characterCount: 120,
    })

    expect(assessment.needsFocusedReview).toBe(false)
    expect(assessment.reasons).toEqual([])
    expect(assessment.expandedSections).toEqual([])
  })

  it('flags multiple explicit deadlines and expands their source evidence', () => {
    const result = baseResult()
    result.timePoints.push({
      ...result.timePoints[0],
      tempId: 'time:second-deadline',
      type: 'submission_deadline',
      rawText: '8月25日17:00前提交作品',
    })

    const assessment = assessFocusedReview(result, {})
    expect(assessment.counts.deadlines).toBe(2)
    expect(assessment.reasons).toContainEqual(expect.objectContaining({ code: 'multiple_deadlines' }))
    expect(assessment.expandedSections).toEqual(expect.arrayContaining(['source', 'timePoints']))
  })

  it('flags multiple materials without changing their selections', () => {
    const result = baseResult()
    const first = result.materials[0]
    result.materials = [
      { ...first, tempId: 'material:one', selected: true },
      { ...first, tempId: 'material:two', name: '承诺书', selected: false },
    ]

    expect(reasonCodes(result)).toContain('multiple_materials')
    expect(result.materials.map((item) => item.selected)).toEqual([true, false])
  })

  it('flags an event schedule and points review to event and time sections', () => {
    const result = baseResult()
    result.events.push({
      tempId: 'event:briefing',
      title: '参加说明会',
      description: '线上说明会',
      startTimePointTempId: result.timePoints[0]?.tempId ?? null,
      endTimePointTempId: null,
      location: '线上',
      evidenceIds: [result.evidence[0].id],
      confidence: 0.9,
      inferenceLevel: 'explicit',
      selected: true,
    })

    const assessment = assessFocusedReview(result, {})
    expect(assessment.reasons).toContainEqual(expect.objectContaining({ code: 'event_schedule' }))
    expect(assessment.expandedSections).toEqual(expect.arrayContaining(['events', 'timePoints']))
  })

  it('separately flags ambiguities and conflicts for explicit human decisions', () => {
    const result = baseResult()
    result.ambiguities.push({
      id: 'ambiguity:date',
      field: 'deadline',
      message: '“下周前”具体是哪一天？',
      options: ['周一', '周五'],
      evidenceIds: [result.evidence[0].id],
    })
    result.conflicts.push({
      id: 'conflict:deadline',
      type: 'deadline',
      message: '正文与附件摘要的截止日期不同',
      entityTempIds: [result.timePoints[0].tempId],
      evidenceIds: [result.evidence[0].id],
      requiresDecision: true,
    })

    expect(reasonCodes(result)).toEqual(expect.arrayContaining(['ambiguities', 'conflicts']))
  })

  it('uses fixed medium and high task-volume thresholds', () => {
    const template = firstTask(baseResult())
    const withTasks = (count: number) => {
      const result = baseResult()
      result.milestones = []
      result.standaloneTasks = Array.from({ length: count }, (_, index) => ({
        ...template,
        tempId: `task:volume:${index + 1}`,
      }))
      return result
    }

    expect(reasonCodes(withTasks(FOCUSED_REVIEW_THRESHOLDS.mediumTaskCount - 1))).not.toContain('task_volume')
    expect(assessFocusedReview(withTasks(FOCUSED_REVIEW_THRESHOLDS.mediumTaskCount), {}).reasons)
      .toContainEqual(expect.objectContaining({ code: 'task_volume', title: '任务数量中等' }))
    expect(assessFocusedReview(withTasks(FOCUSED_REVIEW_THRESHOLDS.highTaskCount), {}).reasons)
      .toContainEqual(expect.objectContaining({ code: 'task_volume', title: '任务数量较多' }))
  })

  it('flags long text and multi-page documents at documented boundaries', () => {
    const result = baseResult()
    const assessment = assessFocusedReview(result, {
      sourceType: 'file',
      mimeType: 'application/pdf',
      characterCount: FOCUSED_REVIEW_THRESHOLDS.longTextCharacters,
      pageCount: FOCUSED_REVIEW_THRESHOLDS.longDocumentPages,
      extractionMethod: 'parser',
    })

    expect(assessment.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining([
      'long_text',
      'long_document',
    ]))
  })

  it('normalizes observed OCR confidence from 0..100 and only flags low confidence', () => {
    const result = baseResult()
    const low = assessFocusedReview(result, {
      sourceType: 'image',
      extractionMethod: 'ocr',
      ocrConfidence: 74,
    })
    const acceptable = assessFocusedReview(result, {
      sourceType: 'image',
      extractionMethod: 'ocr',
      ocrConfidence: FOCUSED_REVIEW_THRESHOLDS.lowOcrConfidence,
    })

    expect(low.sourceMetadata.ocrConfidence).toBe(0.74)
    expect(low.reasons).toContainEqual(expect.objectContaining({ code: 'low_ocr_confidence' }))
    expect(acceptable.reasons.map((reason) => reason.code)).not.toContain('low_ocr_confidence')
  })

  it('surfaces any non-empty AI or extraction quality flags once', () => {
    const result = baseResult()
    result.quality.reviewReasons = ['日期证据覆盖不足', '日期证据覆盖不足']
    const assessment = assessFocusedReview(result, {
      qualityFlags: ['OCR 仅识别前六页', '', '日期证据覆盖不足'],
    })

    expect(assessment.qualityFlags).toEqual(['OCR 仅识别前六页', '日期证据覆盖不足'])
    expect(assessment.reasons.filter((reason) => reason.code === 'quality_flags')).toHaveLength(1)
  })

  it('treats missing or malformed legacy metadata as absent instead of inventing facts', () => {
    expect(normalizeFocusedReviewSourceMetadata(undefined)).toEqual({})
    expect(normalizeFocusedReviewSourceMetadata({
      pageCount: -2,
      characterCount: Number.NaN,
      ocrConfidence: 140,
      mimeType: 42,
      qualityFlags: [null, '', '  可观测标记  '],
    })).toEqual({ qualityFlags: ['可观测标记'] })
  })

  it('does not mutate RecognitionResult, selected states, or supplied metadata', () => {
    const result = baseResult()
    firstTask(result).selected = false
    result.materials[0].selected = true
    result.timePoints[0].selected = false
    const metadata = {
      sourceType: 'file' as const,
      pageCount: 12,
      qualityFlags: ['需要人工复核'],
    }
    const beforeResult = structuredClone(result)
    const beforeMetadata = structuredClone(metadata)

    const assessment = assessFocusedReview(result, metadata)
    assessment.qualityFlags.push('仅修改返回值')

    expect(result).toEqual(beforeResult)
    expect(metadata).toEqual(beforeMetadata)
    expect(firstTask(result).selected).toBe(false)
    expect(result.materials[0].selected).toBe(true)
    expect(result.timePoints[0].selected).toBe(false)
  })
})
