import { isRecognitionResult } from '../../recognition/schema'
import type { RecognitionResult } from '../../recognition/types'
import { workspaceSnapshotHash } from './migration'
import type { CanonicalWorkspaceRepository } from './repository'
import type { ExtractionDraft, JsonValue, LegacyData, RecognitionRun, Source, SourceVersion, WorkspaceV8 } from './types'

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

export interface SourceOnlyRequest {
  operationId: string
  sourceType: Source['type']
  title: string
  rawText: string
  sourceLegacyData?: LegacyData
  now?: string
}

export interface SourceOnlyHandle {
  sourceId: string
  sourceVersionId: string
  duplicate: boolean
}

export interface SourceRevisionRequest {
  operationId: string
  rawText: string
  provider: RecognitionRun['provider']
  modelName: string | null
  promptVersion: string | null
  pipelineVersion: string
  sourceLegacyData?: LegacyData
  now?: string
}

export type SourceRetryRequest = Omit<CaptureRequest, 'operationId' | 'sourceType' | 'title' | 'rawText'> & {
  /** Optimistic concurrency guard chosen from the same text used by the executor. */
  expectedSourceVersionId?: string
}

export type RecognitionExecutor = () => Promise<unknown>

function stableId(kind: string, value: string): string {
  return `${kind}:${workspaceSnapshotHash(value).slice('fnv1a32:'.length)}`
}

function runNumber(workspace: WorkspaceV8, sourceVersionId: string): number {
  return workspace.recognitionRuns.filter((item) => item.sourceVersionId === sourceVersionId).length + 1
}

const STALE_RUN_AFTER_MS = 2 * 60 * 1000

function jsonRecord(value: JsonValue | undefined): LegacyData | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as LegacyData
    : null
}

function mergeSourceLegacyData(current: LegacyData | undefined, patch: LegacyData | undefined): LegacyData {
  const merged: LegacyData = { ...(current ?? {}), ...(patch ?? {}) }
  const currentReview = jsonRecord(current?.reviewMetadata)
  const patchReview = jsonRecord(patch?.reviewMetadata)
  if (currentReview || patchReview) merged.reviewMetadata = { ...(currentReview ?? {}), ...(patchReview ?? {}) }
  return merged
}

function legacyString(data: LegacyData | undefined, key: string): string | null {
  const direct = data?.[key]
  if (typeof direct === 'string') return direct
  const v7 = jsonRecord(data?.v7Record)
  return typeof v7?.[key] === 'string' ? v7[key] : null
}

function normalizedHttpsUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function duplicateSourceIds(workspace: WorkspaceV8, request: Pick<SourceOnlyRequest, 'rawText' | 'sourceLegacyData'>): string[] {
  const requestedUrl = normalizedHttpsUrl(legacyString(request.sourceLegacyData, 'url'))
  const requestedFileHash = legacyString(request.sourceLegacyData, 'fileHash')
  const rawText = request.rawText.trim()
  return workspace.sources.flatMap((source) => {
    const version = workspace.sourceVersions.find((candidate) => candidate.id === source.currentVersionId)
    const sameUrl = requestedUrl !== null && normalizedHttpsUrl(legacyString(source.legacyData, 'url')) === requestedUrl
    const sameFile = requestedFileHash !== null && legacyString(source.legacyData, 'fileHash') === requestedFileHash
    const sameText = rawText.length > 0 && version?.rawText?.trim() === rawText
    return sameUrl || sameFile || sameText ? [source.id] : []
  })
}

function withDuplicateHints(data: LegacyData | undefined, duplicates: string[]): LegacyData {
  const merged = mergeSourceLegacyData(undefined, data)
  if (!duplicates.length) return merged
  const existing = Array.isArray(merged.duplicateOfSourceIds)
    ? merged.duplicateOfSourceIds.filter((item): item is string => typeof item === 'string')
    : []
  merged.duplicateOfSourceIds = [...new Set([...existing, ...duplicates])]
  merged.duplicateReviewStatus = '待核对'
  return merged
}

function latestRunForVersion(workspace: WorkspaceV8, sourceVersionId: string): RecognitionRun | null {
  return workspace.recognitionRuns.filter((run) => run.sourceVersionId === sourceVersionId).at(-1) ?? null
}

function ownsSourceAggregate(workspace: WorkspaceV8, handle: CaptureHandle): boolean {
  const source = workspace.sources.find((item) => item.id === handle.sourceId)
  return source?.currentVersionId === handle.sourceVersionId
    && latestRunForVersion(workspace, handle.sourceVersionId)?.id === handle.recognitionRunId
}

function errorCode(error: unknown): string {
  if (error instanceof Error && /timeout|超时/u.test(error.message)) return 'AI_TIMEOUT'
  if (error instanceof Error && error.message === 'INVALID_RECOGNITION_RESULT') return 'INVALID_AI_RESPONSE'
  return 'RECOGNITION_FAILED'
}

export class CapturePersistenceService {
  constructor(private readonly repository: CanonicalWorkspaceRepository) {}

  async saveSource(request: SourceOnlyRequest): Promise<SourceOnlyHandle> {
    const now = request.now ?? new Date().toISOString()
    let handle: SourceOnlyHandle | null = null
    await this.repository.transaction((workspace) => {
      const existing = workspace.sources.find((item) => item.legacyData?.captureOperationId === request.operationId)
      if (existing) {
        const version = workspace.sourceVersions.find((item) => item.id === existing.currentVersionId)
        if (!version) throw new Error('CAPTURE_IDEMPOTENCY_CHAIN_INVALID')
        handle = { sourceId: existing.id, sourceVersionId: version.id, duplicate: true }
        return workspace
      }
      const sourceId = stableId('source', request.operationId)
      const sourceVersionId = `${sourceId}:version:1`
      const duplicates = duplicateSourceIds(workspace, request)
      const source: Source = {
        id: sourceId,
        workspaceId: workspace.workspace.id,
        type: request.sourceType,
        title: request.title,
        status: 'uploaded',
        currentVersionId: sourceVersionId,
        createdAt: now,
        updatedAt: now,
        legacyData: { ...withDuplicateHints(request.sourceLegacyData, duplicates), captureOperationId: request.operationId },
      }
      const version: SourceVersion = {
        id: sourceVersionId,
        sourceId,
        versionNo: 1,
        contentHash: workspaceSnapshotHash(request.rawText),
        rawText: request.rawText,
        rawTextRef: null,
        createdAt: now,
        legacyData: request.sourceLegacyData?.reviewMetadata === undefined
          ? undefined
          : { reviewMetadata: request.sourceLegacyData.reviewMetadata },
      }
      handle = { sourceId, sourceVersionId, duplicate: false }
      return {
        ...workspace,
        sources: [source, ...workspace.sources],
        sourceVersions: [version, ...workspace.sourceVersions],
        savedAt: now,
      }
    })
    if (!handle) throw new Error('SOURCE_SAVE_FAILED')
    return handle
  }

  async beginRevision(sourceId: string, request: SourceRevisionRequest): Promise<CaptureHandle> {
    const now = request.now ?? new Date().toISOString()
    let handle: CaptureHandle | null = null
    await this.repository.transaction((workspace) => {
      const source = workspace.sources.find((item) => item.id === sourceId)
      if (!source) throw new Error('CAPTURE_SOURCE_NOT_FOUND')
      const existingVersion = workspace.sourceVersions.find((item) => (
        item.sourceId === sourceId && item.legacyData?.revisionOperationId === request.operationId
      ))
      if (existingVersion) {
        const run = workspace.recognitionRuns.find((item) => item.sourceVersionId === existingVersion.id)
        const draft = run && workspace.extractionDrafts.find((item) => item.recognitionRunId === run.id)
        if (!run || !draft) throw new Error('CAPTURE_IDEMPOTENCY_CHAIN_INVALID')
        handle = {
          sourceId,
          sourceVersionId: existingVersion.id,
          recognitionRunId: run.id,
          draftId: draft.id,
          duplicate: true,
        }
        return workspace
      }
      const currentVersion = workspace.sourceVersions.find((item) => item.id === source.currentVersionId)
      if (currentVersion?.rawText?.trim() === request.rawText.trim()) throw new Error('CAPTURE_REVISION_UNCHANGED')
      const versionNo = workspace.sourceVersions
        .filter((item) => item.sourceId === sourceId)
        .reduce((maximum, item) => Math.max(maximum, item.versionNo), 0) + 1
      const sourceVersionId = `${source.id}:version:${versionNo}`
      const sequence = runNumber(workspace, sourceVersionId)
      const recognitionRunId = `${source.id}:run:revision:${versionNo}:${sequence}`
      const draftId = `${source.id}:draft:revision:${versionNo}:${sequence}`
      const version: SourceVersion = {
        id: sourceVersionId,
        sourceId,
        versionNo,
        contentHash: workspaceSnapshotHash(request.rawText),
        rawText: request.rawText,
        rawTextRef: null,
        createdAt: now,
        legacyData: {
          revisionOperationId: request.operationId,
          ...(request.sourceLegacyData?.reviewMetadata === undefined
            ? {}
            : { reviewMetadata: request.sourceLegacyData.reviewMetadata }),
        },
      }
      const run: RecognitionRun = {
        id: recognitionRunId,
        sourceVersionId,
        provider: request.provider,
        modelName: request.modelName,
        promptVersion: request.promptVersion,
        schemaVersion: '2.0',
        pipelineVersion: request.pipelineVersion,
        status: 'queued',
        startedAt: now,
        completedAt: null,
        durationMs: null,
        tokenUsage: null,
        qualityFlags: [],
        errorCode: null,
      }
      const draft: ExtractionDraft = {
        id: draftId,
        recognitionRunId,
        status: 'processing',
        result: null,
        commitOperationIds: [],
        acceptedEntityTempIds: [],
        rejectedEntityTempIds: [],
        createdAt: now,
        updatedAt: now,
      }
      handle = { sourceId, sourceVersionId, recognitionRunId, draftId, duplicate: false }
      return {
        ...workspace,
        sources: workspace.sources.map((item) => item.id === sourceId ? {
          ...item,
          currentVersionId: sourceVersionId,
          status: 'extracting',
          updatedAt: now,
          legacyData: {
            ...mergeSourceLegacyData(item.legacyData, request.sourceLegacyData),
            contentPreview: request.rawText.slice(0, 500),
          },
        } : item),
        sourceVersions: [...workspace.sourceVersions, version],
        recognitionRuns: [...workspace.recognitionRuns, run],
        extractionDrafts: [...workspace.extractionDrafts, draft],
        savedAt: now,
      }
    })
    if (!handle) throw new Error('CAPTURE_REVISION_BEGIN_FAILED')
    return handle
  }

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
        legacyData: {
          ...withDuplicateHints(request.sourceLegacyData, duplicateSourceIds(workspace, request)),
          captureOperationId: request.operationId,
        },
      }
      const version: SourceVersion = {
        id: sourceVersionId, sourceId, versionNo: 1, contentHash: workspaceSnapshotHash(request.rawText),
        rawText: request.rawText, rawTextRef: null, createdAt: now,
        legacyData: request.sourceLegacyData?.reviewMetadata === undefined
          ? undefined
          : { reviewMetadata: request.sourceLegacyData.reviewMetadata },
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

  async beginRetry(sourceId: string, request: SourceRetryRequest): Promise<CaptureHandle> {
    const now = request.now ?? new Date().toISOString()
    let handle: CaptureHandle | null = null
    await this.repository.transaction((workspace) => {
      const source = workspace.sources.find((item) => item.id === sourceId)
      const version = source && workspace.sourceVersions.find((item) => item.id === source.currentVersionId)
      if (!source || !version) throw new Error('CAPTURE_SOURCE_NOT_FOUND')
      if (request.expectedSourceVersionId && request.expectedSourceVersionId !== version.id) {
        throw new Error('CAPTURE_SOURCE_VERSION_CHANGED')
      }
      const previous = latestRunForVersion(workspace, version.id)
      const previousActive = previous?.status === 'queued' || previous?.status === 'running'
      const ageMs = previous ? Date.parse(now) - Date.parse(previous.startedAt) : Number.POSITIVE_INFINITY
      if (previousActive && (!Number.isFinite(ageMs) || ageMs < STALE_RUN_AFTER_MS)) {
        throw new Error('CAPTURE_RETRY_ALREADY_RUNNING')
      }
      const sequence = runNumber(workspace, version.id)
      const recognitionRunId = `${source.id}:run:${version.versionNo}:${sequence}`
      const draftId = `${source.id}:draft:${version.versionNo}:${sequence}`
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
      const interruptedRunId = previousActive ? previous.id : null
      return {
        ...workspace, sources: workspace.sources.map((item) => item.id === source.id ? { ...item, status: 'extracting', updatedAt: now } : item),
        recognitionRuns: [
          ...workspace.recognitionRuns.map((item) => item.id === interruptedRunId ? {
            ...item,
            status: 'failed' as const,
            completedAt: now,
            durationMs: Math.max(0, Date.parse(now) - Date.parse(item.startedAt)),
            errorCode: 'CAPTURE_INTERRUPTED',
          } : item),
          run,
        ],
        extractionDrafts: [
          ...workspace.extractionDrafts.map((item) => {
            const belongsToInterruptedRun = interruptedRunId !== null && item.recognitionRunId === interruptedRunId
            return belongsToInterruptedRun ? { ...item, status: 'failed' as const, updatedAt: now } : item
          }),
          draft,
        ],
        savedAt: now,
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
      await this.repository.transaction((workspace) => {
        const updateAggregate = ownsSourceAggregate(workspace, handle)
        return {
          ...workspace,
          recognitionRuns: workspace.recognitionRuns.map((item) => item.id === handle.recognitionRunId ? {
            ...item, status: 'succeeded', completedAt, durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(item.startedAt)),
            qualityFlags: value.quality.reviewReasons, errorCode: null,
          } : item),
          extractionDrafts: workspace.extractionDrafts.map((item) => item.id === handle.draftId ? { ...item, status: 'needs_review', result: value, updatedAt: completedAt } : item),
          sources: updateAggregate
            ? workspace.sources.map((item) => item.id === handle.sourceId ? { ...item, status: 'needs_review', updatedAt: completedAt } : item)
            : workspace.sources,
          savedAt: completedAt,
        }
      })
      return value
    } catch (error) {
      const failedAt = new Date().toISOString()
      const code = errorCode(error)
      await this.repository.transaction((workspace) => {
        const updateAggregate = ownsSourceAggregate(workspace, handle)
        return {
          ...workspace,
          recognitionRuns: workspace.recognitionRuns.map((item) => item.id === handle.recognitionRunId ? { ...item, status: 'failed', completedAt: failedAt, errorCode: code } : item),
          extractionDrafts: workspace.extractionDrafts.map((item) => item.id === handle.draftId ? { ...item, status: 'failed', updatedAt: failedAt } : item),
          sources: updateAggregate
            ? workspace.sources.map((item) => item.id === handle.sourceId ? { ...item, status: 'failed', updatedAt: failedAt } : item)
            : workspace.sources,
          savedAt: failedAt,
        }
      })
      throw error
    }
  }

  async captureAndRecognize(request: CaptureRequest, executor: RecognitionExecutor): Promise<{ handle: CaptureHandle; result: RecognitionResult }> {
    const handle = await this.beginCapture(request)
    const result = await this.recognize(handle, executor)
    return { handle, result }
  }
}
