import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../recognition/pipeline'
import type { ExtractionDraft, Source } from '../types'
import { buildSourceWorkflowItems, mapSourceWorkflowItem, selectPendingReviewItems } from './sourceWorkflow'

const NOW = '2026-08-08T08:00:00.000Z'

function source(id: string, status: Source['status'], processingError?: string): Source {
  return {
    id, type: 'text', title: `匿名来源 ${id}`, contentPreview: '匿名通知正文',
    status, processingError, createdAt: NOW, updatedAt: NOW,
    extractionStatus: status === 'confirmed' ? '已确认' : status === 'archived' ? '已拒绝' : '待确认',
  }
}

function recognition(content = '请于8月10日提交报名表') {
  return buildLocalRecognition({
    sourceType: 'text', sourceTitle: '匿名通知', content,
    referenceTime: new Date('2026-08-08T08:00:00+08:00'), timezone: 'Asia/Shanghai',
    projects: [], tasks: [],
  })
}

function draft(sourceId: string, workflowStatus: NonNullable<ExtractionDraft['workflowStatus']>, result = recognition()): ExtractionDraft {
  return {
    id: `draft-${sourceId}-${workflowStatus}`, sourceId,
    status: workflowStatus === 'confirmed' ? '已确认' : workflowStatus === 'partially_confirmed' ? '部分确认' : workflowStatus === 'rejected' || workflowStatus === 'archived' ? '已拒绝' : '待确认',
    workflowStatus, items: [], recognitionResult: result,
    createdAt: NOW, updatedAt: NOW,
  }
}

describe('source workflow mapping', () => {
  it('keeps unprocessed, processing, failed, needs_review, confirmed, archived and info-only states explicit', () => {
    const sources = [
      source('unprocessed', 'uploaded'),
      source('processing', 'extracting'),
      source('failed', 'failed', 'AI_TIMEOUT'),
      source('ready', 'needs_review'),
      source('confirmed', 'confirmed'),
      source('archived', 'archived'),
      source('info', 'needs_review'),
    ]
    const drafts = [
      draft('processing', 'processing'),
      draft('failed', 'failed'),
      draft('ready', 'needs_review'),
      draft('confirmed', 'confirmed'),
      draft('archived', 'archived'),
      draft('info', 'needs_review', recognition('本学期奖学金办法已经发布，仅供参考，请知悉。')),
    ]
    const items = buildSourceWorkflowItems(sources, drafts)
    const byId = new Map(items.map((item) => [item.source.id, item]))

    expect(byId.get('unprocessed')).toMatchObject({ status: 'unprocessed', canRetry: false, canManualSupplement: true })
    expect(byId.get('processing')).toMatchObject({ status: 'processing', canRetry: true, canManualSupplement: true })
    expect(byId.get('failed')).toMatchObject({ status: 'failed', errorMessage: 'AI_TIMEOUT', canRetry: true, canManualSupplement: true })
    expect(byId.get('ready')).toMatchObject({ status: 'needs_review', canOpenDraft: true })
    expect(byId.get('confirmed')?.status).toBe('confirmed')
    expect(byId.get('archived')?.status).toBe('archived')
    expect(byId.get('info')?.status).toBe('info_only')
  })

  it('uses the latest draft and does not invent an error message', () => {
    const failedSource = source('source-1', 'failed')
    const oldFailure = { ...draft('source-1', 'failed'), updatedAt: '2026-08-08T08:00:00.000Z' }
    const latestReady = { ...draft('source-1', 'needs_review'), updatedAt: '2026-08-09T08:00:00.000Z' }
    const mapped = mapSourceWorkflowItem({ ...failedSource, status: 'needs_review' }, [oldFailure, latestReady])

    expect(mapped.draft?.id).toBe(latestReady.id)
    expect(mapped.status).toBe('needs_review')
    expect(mapped.errorMessage).toBeNull()
  })

  it('uses only the current SourceVersion draft and one pending selector for badges and queues', () => {
    const currentSource = { ...source('versioned', 'needs_review'), currentVersionId: 'version-2' }
    const historicalDraft = {
      ...draft('versioned', 'needs_review'), id: 'historical-draft', sourceVersionId: 'version-1',
      updatedAt: '2026-08-11T08:00:00.000Z', attemptOrder: 2,
    }
    const oldDraft = {
      ...draft('versioned', 'failed'), id: 'old-draft', sourceVersionId: 'version-2',
      updatedAt: '2026-08-10T08:00:00.000Z', attemptOrder: 0,
    }
    const currentDraft = {
      ...draft('versioned', 'needs_review'), id: 'current-draft', sourceVersionId: 'version-2',
      updatedAt: '2026-08-09T08:00:00.000Z', attemptOrder: 1,
      items: [{
        id: 'pending', selected: true, status: '待确认' as const, updatedAt: NOW,
        suggestion: {
          id: 'suggestion', title: '提交报名表', category: '比赛' as const, deadline: '2026-08-10T08:00:00.000Z',
          estimatedMinutes: 30, nextAction: '整理材料', description: '', priority: '中' as const,
          materials: [], evidence: '原文', confidence: '高' as const,
        },
      }],
    }

    expect(mapSourceWorkflowItem(currentSource, [historicalDraft, oldDraft, currentDraft]).draft?.id).toBe('current-draft')
    expect(selectPendingReviewItems([currentSource], [historicalDraft, oldDraft, currentDraft])).toHaveLength(1)
    expect(selectPendingReviewItems([currentSource], [{ ...currentDraft, workflowStatus: 'archived' }])).toHaveLength(0)
  })
})
