import { isRecognitionResult } from '../../recognition/schema'
import type { RecognitionResult } from '../../recognition/types'
import { workspaceSnapshotHash } from './migration'
import type { CanonicalWorkspaceRepository } from './repository'
import type { ExtractionDraft, LegacyData, RecognitionRun, Source, SourceVersion, WorkspaceV8 } from './types'

export interface CaptureRequest {
  operationId: string
  sourceType: Source['type']
  title: string
  rawText: string
  provider: RecognitionRun['provider']
  modelName: string | null
  promptVersion: string | null
  pipelineVersion: string
  sourceLegacyData?: LegacyData
  now?: string
}

export interface CaptureHandle {
  sourceId: string
  sourceVersionId: string
  recognitionRunId: string
  draftId: string
  duplicate: boolean
}

export type RecognitionExecutor = () => Promise<unknown>

function stableId(kind: string, value: string): string {
  return `${kind}:${workspaceSnapshotHash(value).slice('fnv1a32:'.length)}`
}

function runNumber(workspace: WorkspaceV8, sourceVersionId: string): number {
  return workspace.recognitionRuns.filter((item) => item.sourceVersionId === sourceVersionId).length + 1
}

function errorCode(error: unknown): string {
  if (error instanceof Error && /timeout|超时/u.test(error.message)) return 'AI_TIMEOUT'
  if (error instanceof Error && error.message === 'INVALID_RECOGNITION_RESULT') return 'INVALID_AI_RESPONSE'
  return 'RECOGNITION_FAILED'
}

export class CapturePersistenceService {
  constructor(private readonly repository: CanonicalWorkspaceRepository) {}

  async beginCapture(request: CaptureRequest): Promise<CaptureHandle> {
    const now = request.now ?? new Date().toISOString()
    let handle: CaptureHandle | null = null
    await this.repository.transaction((workspace) => {
      const existing = workspace.sources.find((item) => item.legacyData?.captureOperationId === request.operationId)
      if (existing) {
        const version = workspace.sourceVersions.find((item) => item.sourceId === existing.id)
        const run = version && [...workspace.recognitionRuns].reverse().find((item) => item.sourceVersionId === version.id)
        const draft = run && workspace.extractionDrafts.find((item) => item.recognitionRunId === run.id)
        if (!version || !run || !draft) throw new Error('CAPTURE_IDEMPOTENCY_CHAIN_INVALID')
        handle = { sourceId: existing.id, sourceVersionId: version.id, recognitionRunId: run.id, draftId: draft.id, duplicate: true }
        return workspace
      }
      const sourceId = stableId('source', request.operationId)
      const sourceVersionId = `${sourceId}:version:1`
      const recognitionRunId = `${sourceId}:run:1`
      const draftId = `${sourceId}:draft:1`
      const source: Source = {
        id: sourceId, workspaceId: workspace.workspace.id, type: request.sourceType, title: request.title,
        status: 'extracting', currentVersionId: sourceVersionId, createdAt: now, updatedAt: now,
        legacyData: { ...(request.sourceLegacyData ?? {}), captureOperationId: request.operationId },
      }
      const version: SourceVersion = {
        id: sourceVersionId, sourceId, versionNo: 1, contentHash: workspaceSnapshotHash(request.rawText),
        rawText: request.rawText, rawTextRef: null, createdAt: now,
      }
      const run: RecognitionRun = {
        id: recognitionRunId, sourceVersionId, provider: request.provider, modelName: request.modelName,
        promptVersion: request.promptVersion, schemaVersion: '2.0', pipelineVersion: request.pipelineVersion,
        status: 'queued', startedAt: now, completedAt: null, durationMs: null, tokenUsage: null,
        qualityFlags: [], errorCode: null,
      }
      const draft: ExtractionDraft = {
        id: draftId, recognitionRunId, status: 'processing', result: null,
        commitOperationIds: [], acceptedEntityTempIds: [], rejectedEntityTempIds: [], createdAt: now, updatedAt: now,
      }
      handle = { sourceId, sourceVersionId, recognitionRunId, draftId, duplicate: false }
      return {
        ...workspace, sources: [source, ...workspace.sources], sourceVersions: [version, ...workspace.sourceVersions],
        recognitionRuns: [run, ...workspace.recognitionRuns], extractionDrafts: [draft, ...workspace.extractionDrafts],
        savedAt: now,
      }
    })
    if (!handle) throw new Error('CAPTURE_BEGIN_FAILED')
    return handle
  }

  async beginRetry(sourceId: string, request: Omit<CaptureRequest, 'operationId' | 'sourceType' | 'title' | 'rawText'>): Promise<CaptureHandle> {
    const now = request.now ?? new Date().toISOString()
    let handle: CaptureHandle | null = null
    await this.repository.transaction((workspace) => {
      const source = workspace.sources.find((item) => item.id === sourceId)
      const version = source && workspace.sourceVersions.find((item) => item.id === source.currentVersionId)
      if (!source || !version) throw new Error('CAPTURE_SOURCE_NOT_FOUND')
      const sequence = runNumber(workspace, version.id)
      const recognitionRunId = `${source.id}:run:${sequence}`
      const draftId = `${source.id}:draft:${sequence}`
      const run: RecognitionRun = {
        id: recognitionRunId, sourceVersionId: version.id, provider: request.provider, modelName: request.modelName,
        promptVersion: request.promptVersion, schemaVersion: '2.0', pipelineVersion: request.pipelineVersion,
        status: 'queued', startedAt: now, completedAt: null, durationMs: null, tokenUsage: null,
        qualityFlags: [], errorCode: null,
      }
      const draft: ExtractionDraft = {
        id: draftId, recognitionRunId, status: 'processing', result: null,
        commitOperationIds: [], acceptedEntityTempIds: [], rejectedEntityTempIds: [], createdAt: now, updatedAt: now,
      }
      handle = { sourceId: source.id, sourceVersionId: version.id, recognitionRunId, draftId, duplicate: false }
      return {
        ...workspace, sources: workspace.sources.map((item) => item.id === source.id ? { ...item, status: 'extracting', updatedAt: now } : item),
        recognitionRuns: [...workspace.recognitionRuns, run], extractionDrafts: [...workspace.extractionDrafts, draft], savedAt: now,
      }
    })
    if (!handle) throw new Error('CAPTURE_RETRY_BEGIN_FAILED')
    return handle
  }

  async recognize(handle: CaptureHandle, executor: RecognitionExecutor): Promise<RecognitionResult> {
    if (handle.duplicate) {
      const workspace = await this.repository.load()
      const existing = workspace?.extractionDrafts.find((item) => item.id === handle.draftId)?.result
      if (existing) return existing
      throw new Error('CAPTURE_DUPLICATE_IN_PROGRESS')
    }
    const startedAt = new Date().toISOString()
    await this.repository.transaction((workspace) => ({
      ...workspace,
      recognitionRuns: workspace.recognitionRuns.map((item) => item.id === handle.recognitionRunId ? { ...item, status: 'running', startedAt } : item),
      savedAt: startedAt,
    }))
    try {
      const value = await executor()
      if (!isRecognitionResult(value)) throw new Error('INVALID_RECOGNITION_RESULT')
      const completedAt = new Date().toISOString()
      await this.repository.transaction((workspace) => ({
        ...workspace,
        recognitionRuns: workspace.recognitionRuns.map((item) => item.id === handle.recognitionRunId ? {
          ...item, status: 'succeeded', completedAt, durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(item.startedAt)),
          qualityFlags: value.quality.reviewReasons, errorCode: null,
        } : item),
        extractionDrafts: workspace.extractionDrafts.map((item) => item.id === handle.draftId ? { ...item, status: 'needs_review', result: value, updatedAt: completedAt } : item),
        sources: workspace.sources.map((item) => item.id === handle.sourceId ? { ...item, status: 'needs_review', updatedAt: completedAt } : item),
        savedAt: completedAt,
      }))
      return value
    } catch (error) {
      const failedAt = new Date().toISOString()
      const code = errorCode(error)
      await this.repository.transaction((workspace) => ({
        ...workspace,
        recognitionRuns: workspace.recognitionRuns.map((item) => item.id === handle.recognitionRunId ? { ...item, status: 'failed', completedAt: failedAt, errorCode: code } : item),
        extractionDrafts: workspace.extractionDrafts.map((item) => item.id === handle.draftId ? { ...item, status: 'failed', updatedAt: failedAt } : item),
        sources: workspace.sources.map((item) => item.id === handle.sourceId ? { ...item, status: 'failed', updatedAt: failedAt } : item),
        savedAt: failedAt,
      }))
      throw error
    }
  }

  async captureAndRecognize(request: CaptureRequest, executor: RecognitionExecutor): Promise<{ handle: CaptureHandle; result: RecognitionResult }> {
    const handle = await this.beginCapture(request)
    const result = await this.recognize(handle, executor)
    return { handle, result }
  }
}
