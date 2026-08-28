import type { ExtractionDraft, Source, SourceType } from '../types'

export type SourceWorkflowStatus = 'unprocessed' | 'processing' | 'failed' | 'needs_review' | 'confirmed' | 'archived' | 'info_only'

export interface SourceEntityCounts {
  tasks: number
  materials: number
  timePoints: number
  events: number
  pending: number
}

export interface SourceWorkflowItem {
  source: Source
  draft: ExtractionDraft | null
  status: SourceWorkflowStatus
  statusLabel: string
  statusDescription: string
  modelLabel: string | null
  projectLabel: string | null
  errorMessage: string | null
  counts: SourceEntityCounts
  canOpenDraft: boolean
  canRetry: boolean
  canManualSupplement: boolean
  updatedAt: string
}

export const sourceTypeLabels: Record<SourceType, string> = {
  text: '消息',
  file: '文件',
  image: '图片',
  link: '网页',
}

export const sourceStatusLabels: Record<SourceWorkflowStatus, string> = {
  unprocessed: '未整理',
  processing: '识别中',
  failed: '识别失败',
  needs_review: '待核对',
  confirmed: '已确认',
  archived: '已归档',
  info_only: '仅供参考',
}

const statusDescriptions: Record<SourceWorkflowStatus, string> = {
  unprocessed: '来源已保存，但尚未读取正文或建立识别草稿。',
  processing: '来源已保存，识别尚未完成；若页面中断可沿用当前版本重试，活跃请求会被安全阻止。',
  failed: '来源仍保留；可复用同一来源重新识别或手工补充。',
  needs_review: '识别建议已保存，确认前不会创建正式任务。',
  confirmed: '至少一项建议已经人工确认并进入正式工作区。',
  archived: '来源仍保留，但不会继续进入待确认流程。',
  info_only: '识别结果未发现需执行事项；可查看原文并人工判断。',
}

function parseTime(value: string | undefined): number {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function latestDraftForSource(source: Source, drafts: ExtractionDraft[]): ExtractionDraft | null {
  const sourceDrafts = drafts.filter((draft) => draft.sourceId === source.id)
  const currentVersionDrafts = source.currentVersionId
    ? sourceDrafts.filter((draft) => !draft.sourceVersionId || draft.sourceVersionId === source.currentVersionId)
    : sourceDrafts
  return currentVersionDrafts
    .sort((left, right) => {
      if (left.attemptOrder !== undefined || right.attemptOrder !== undefined) {
        const byAttempt = (right.attemptOrder ?? -1) - (left.attemptOrder ?? -1)
        if (byAttempt !== 0) return byAttempt
      }
      return parseTime(right.updatedAt) - parseTime(left.updatedAt)
    })[0] ?? null
}

function canonicalStatus(source: Source, draft: ExtractionDraft | null): SourceWorkflowStatus {
  const draftStatus = draft?.workflowStatus
  if (source.status === 'archived' || draftStatus === 'archived' || draftStatus === 'rejected' || source.extractionStatus === '已拒绝') return 'archived'
  if (source.status === 'failed' || draftStatus === 'failed') return 'failed'
  if (source.status === 'uploaded' && !draft) return 'unprocessed'
  if (source.status === 'extracting' || draftStatus === 'processing') return 'processing'
  if (draft?.recognitionResult?.sourceSummary.notificationType === 'information_only'
    || draft?.recognitionResult?.sourceSummary.requiresAction === false) return 'info_only'
  if (source.status === 'confirmed' || draftStatus === 'confirmed' || source.extractionStatus === '已确认') return 'confirmed'
  return 'needs_review'
}

function taskCount(draft: ExtractionDraft | null): number {
  const recognition = draft?.recognitionResult
  if (!recognition) return draft?.items.length ?? 0
  return recognition.standaloneTasks.length + recognition.milestones.reduce((total, milestone) => (
    total + milestone.tasks.length + milestone.workPackages.reduce((packageTotal, workPackage) => packageTotal + workPackage.tasks.length, 0)
  ), 0)
}

function entityCounts(draft: ExtractionDraft | null): SourceEntityCounts {
  return {
    tasks: taskCount(draft),
    materials: draft?.recognitionResult?.materials.length ?? 0,
    timePoints: draft?.recognitionResult?.timePoints.length ?? 0,
    events: draft?.recognitionResult?.events.length ?? 0,
    pending: draft?.items.filter((item) => item.status === '待确认').length ?? 0,
  }
}

function projectLabel(draft: ExtractionDraft | null): string | null {
  const recognition = draft?.recognitionResult
  if (!recognition) return null
  if (recognition.projectMatch.decision === 'standalone_task') return '独立事项'
  if (recognition.projectMatch.decision === 'uncertain') return '项目归属待决定'
  return recognition.projectSuggestion?.title.value
    ?? recognition.projectMatch.suggestedProjectTitle
    ?? (recognition.projectMatch.matchedProjectId ? `已有项目 ${recognition.projectMatch.matchedProjectId}` : null)
}

function modelLabel(source: Source, draft: ExtractionDraft | null): string | null {
  if (draft?.modelName) return draft.modelName.includes('deepseek') ? 'DeepSeek V4 Flash 建议' : `${draft.modelName} 建议`
  if (source.extractionMethod === 'deepseek-v4-flash') return 'DeepSeek V4 Flash 建议'
  if (source.extractionMethod === 'local-rules') return '本地规则建议'
  return null
}

export function mapSourceWorkflowItem(source: Source, drafts: ExtractionDraft[]): SourceWorkflowItem {
  const draft = latestDraftForSource(source, drafts)
  const status = canonicalStatus(source, draft)
  return {
    source,
    draft,
    status,
    statusLabel: sourceStatusLabels[status],
    statusDescription: statusDescriptions[status],
    modelLabel: modelLabel(source, draft),
    projectLabel: projectLabel(draft),
    errorMessage: source.processingError?.trim() || null,
    counts: entityCounts(draft),
    canOpenDraft: status === 'needs_review' && Boolean(draft),
    canRetry: status === 'failed' || status === 'processing',
    canManualSupplement: status === 'failed' || status === 'unprocessed' || status === 'processing',
    updatedAt: draft?.updatedAt ?? source.updatedAt ?? source.createdAt,
  }
}

const statusOrder: Record<SourceWorkflowStatus, number> = {
  failed: 0,
  unprocessed: 1,
  needs_review: 2,
  processing: 3,
  info_only: 4,
  confirmed: 5,
  archived: 6,
}

export function buildSourceWorkflowItems(sources: Source[], drafts: ExtractionDraft[]): SourceWorkflowItem[] {
  return sources
    .map((source) => mapSourceWorkflowItem(source, drafts))
    .sort((left, right) => statusOrder[left.status] - statusOrder[right.status]
      || parseTime(right.updatedAt) - parseTime(left.updatedAt))
}

/** One shared selector for badges, queues and batch actions. */
export function selectPendingReviewItems(sources: Source[], drafts: ExtractionDraft[]): SourceWorkflowItem[] {
  return buildSourceWorkflowItems(sources, drafts)
    .filter((item) => item.status === 'needs_review' && item.canOpenDraft && item.counts.pending > 0)
}
