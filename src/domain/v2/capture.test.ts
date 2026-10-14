import { describe, expect, it, vi } from 'vitest'
import { buildLocalRecognition } from '../../recognition/pipeline'
import { demoSources, demoTasks } from '../../data/demo'
import { createWorkspaceData } from '../../lib/workspace'
import { CapturePersistenceService } from './capture'
import { createGoldenWorkspaceV8 } from './fixtures'
import { mergeLegacyViewIntoWorkspaceV8, workspaceV8ToLegacyView } from './legacyView'
import { applyPreparedV8Migration, prepareV7ToV8Migration, workspaceSnapshotHash } from './migration'
import { CanonicalWorkspaceRepository, CURRENT_WORKSPACE_RECORD_KEY, MemoryWorkspaceRecordStore } from './repository'
import { validateWorkspaceV8 } from './validators/workspaceValidator'

function emptyWorkspace() {
  const workspace = createGoldenWorkspaceV8()
  return { ...workspace, sources: [], sourceVersions: [], recognitionRuns: [], extractionDrafts: [], projects: [], milestones: [], workPackages: [], tasks: [], materials: [], timePoints: [], events: [], evidenceRefs: [], historyRecords: [], reminderRecords: [] }
}

function request(operationId = 'capture-1') {
  return {
    operationId, sourceType: 'text' as const, title: '匿名通知', rawText: '请于8月10日提交报名表',
    provider: 'local-rules' as const, modelName: 'local-rules', promptVersion: 'recognition-2.0.0', pipelineVersion: 'capture-v2',
    now: '2026-08-08T12:00:00.000Z',
  }
}

function result() {
  return buildLocalRecognition({ sourceType: 'text', sourceTitle: '匿名通知', content: '请于8月10日提交报名表', referenceTime: new Date('2026-08-08T00:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
}

describe('B4 source-before-AI persistence', () => {
  it('saves a bare link as an uploaded Source without inventing a run or draft', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const request = {
      operationId: 'save-link-only',
      sourceType: 'link' as const,
      title: '稍后整理的网页',
      rawText: '',
      sourceLegacyData: { url: 'https://example.edu/notice' },
      now: '2026-08-08T12:00:00.000Z',
    }

    const first = await service.saveSource(request)
    const second = await service.saveSource(request)
    const reloaded = await repository.load()

    expect(second).toEqual({ ...first, duplicate: true })
    expect(reloaded?.sources).toHaveLength(1)
    expect(reloaded?.sources[0]).toMatchObject({ id: first.sourceId, status: 'uploaded' })
    expect(reloaded?.sourceVersions[0]).toMatchObject({ id: first.sourceVersionId, rawText: '' })
    expect(reloaded?.recognitionRuns).toHaveLength(0)
    expect(reloaded?.extractionDrafts).toHaveLength(0)
    expect(workspaceV8ToLegacyView(reloaded!).sources[0].fileHash).toBeUndefined()
  })

  it('flags an exact repeated HTTPS source for manual duplicate review without merging it', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const base = {
      sourceType: 'link' as const, title: '匿名网页', rawText: '',
      sourceLegacyData: { url: 'https://example.edu/notice#section' },
    }
    const first = await service.saveSource({ ...base, operationId: 'link-first' })
    const second = await service.saveSource({ ...base, operationId: 'link-second', sourceLegacyData: { url: 'https://example.edu/notice' } })
    const view = workspaceV8ToLegacyView((await repository.load())!)
    const repeated = view.sources.find((source) => source.id === second.sourceId)

    expect(second.sourceId).not.toBe(first.sourceId)
    expect(repeated).toMatchObject({ duplicateOfSourceIds: [first.sourceId], duplicateReviewStatus: '待核对' })
  })

  it('persists Source, SourceVersion, RecognitionRun and Draft before calling recognition', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const executor = vi.fn(async () => {
      const persisted = await repository.load()
      expect(persisted?.sources).toHaveLength(1)
      expect(persisted?.sourceVersions).toHaveLength(1)
      expect(persisted?.recognitionRuns[0].status).toBe('running')
      expect(persisted?.extractionDrafts[0].status).toBe('processing')
      expect(persisted?.tasks).toHaveLength(0)
      return result()
    })
    const captured = await service.captureAndRecognize(request(), executor)
    expect(executor).toHaveBeenCalledOnce()
    expect((await repository.load())?.extractionDrafts.find((item) => item.id === captured.handle.draftId)).toMatchObject({ status: 'needs_review' })
  })

  it('keeps the source and creates no formal facts when recognition times out', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    await expect(service.captureAndRecognize(request(), async () => { throw new Error('AI timeout') })).rejects.toThrow('AI timeout')
    const reloaded = await repository.load()
    expect(reloaded?.sources[0].status).toBe('failed')
    expect(reloaded?.recognitionRuns[0]).toMatchObject({ status: 'failed', errorCode: 'AI_TIMEOUT' })
    expect(reloaded?.extractionDrafts[0].status).toBe('failed')
    expect(reloaded?.tasks).toHaveLength(0)
    expect(reloaded?.projects).toHaveLength(0)
  })

  it('keeps the source when recognition returns invalid data', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    await expect(service.captureAndRecognize(request(), async () => ({ invalid: true }))).rejects.toThrow('INVALID_RECOGNITION_RESULT')
    const reloaded = await repository.load()
    expect(reloaded?.sources).toHaveLength(1)
    expect(reloaded?.recognitionRuns[0].errorCode).toBe('INVALID_AI_RESPONSE')
  })

  it('survives an interruption immediately after the pre-recognition transaction', async () => {
    const store = new MemoryWorkspaceRecordStore()
    const repository = new CanonicalWorkspaceRepository(store)
    await repository.save(emptyWorkspace())
    const handle = await new CapturePersistenceService(repository).beginCapture(request())
    const reopened = new CanonicalWorkspaceRepository(store)
    expect((await reopened.load())?.sources.find((item) => item.id === handle.sourceId)).toBeTruthy()
    expect((await reopened.load())?.extractionDrafts.find((item) => item.id === handle.draftId)?.status).toBe('processing')
  })

  it('retry creates a new RecognitionRun and Draft but never duplicates Source', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const first = await service.beginCapture(request())
    await expect(service.recognize(first, async () => { throw new Error('AI timeout') })).rejects.toThrow()
    const retry = await service.beginRetry(first.sourceId, { provider: 'local-rules', modelName: 'local-rules', promptVersion: 'recognition-2.0.0', pipelineVersion: 'capture-v2' })
    await service.recognize(retry, async () => result())
    const reloaded = await repository.load()
    expect(reloaded?.sources).toHaveLength(1)
    expect(reloaded?.recognitionRuns).toHaveLength(2)
    expect(reloaded?.extractionDrafts).toHaveLength(2)
  })

  it('rejects a retry when the executor text was read from a superseded SourceVersion', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const first = await service.beginCapture(request('version-guard'))
    await expect(service.recognize(first, async () => { throw new Error('failed') })).rejects.toThrow()
    const revision = await service.beginRevision(first.sourceId, {
      operationId: 'version-guard-revision', rawText: '新的当前正文', provider: 'local-rules',
      modelName: 'local-rules', promptVersion: 'local-v1', pipelineVersion: 'revision-v1',
    })
    const before = await repository.load()

    await expect(service.beginRetry(first.sourceId, {
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'local-v1', pipelineVersion: 'retry-v1',
      expectedSourceVersionId: first.sourceVersionId,
    })).rejects.toThrow('CAPTURE_SOURCE_VERSION_CHANGED')
    const after = await repository.load()
    expect(after?.recognitionRuns).toHaveLength(before!.recognitionRuns.length)
    expect(after?.extractionDrafts).toHaveLength(before!.extractionDrafts.length)
    expect(after?.sources[0].currentVersionId).toBe(revision.sourceVersionId)
  })

  it('blocks an active retry but recovers an interrupted run after the stale threshold', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const first = await service.beginCapture(request('stale-run'))

    await expect(service.beginRetry(first.sourceId, {
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'local-v1', pipelineVersion: 'retry-v1',
      now: '2026-08-08T12:01:00.000Z', expectedSourceVersionId: first.sourceVersionId,
    })).rejects.toThrow('CAPTURE_RETRY_ALREADY_RUNNING')

    const recovered = await service.beginRetry(first.sourceId, {
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'local-v1', pipelineVersion: 'retry-v1',
      now: '2026-08-08T12:03:00.000Z', expectedSourceVersionId: first.sourceVersionId,
    })
    const workspace = await repository.load()
    expect(workspace?.recognitionRuns.find((run) => run.id === first.recognitionRunId)).toMatchObject({
      status: 'failed', errorCode: 'CAPTURE_INTERRUPTED',
    })
    expect(workspace?.extractionDrafts.find((draft) => draft.id === first.draftId)?.status).toBe('failed')
    expect(recovered.sourceVersionId).toBe(first.sourceVersionId)
  })

  it('does not let an older run completion overwrite the current latest attempt aggregate', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const first = await service.beginCapture(request('late-run'))
    const retry = await service.beginRetry(first.sourceId, {
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'local-v1', pipelineVersion: 'retry-v1',
      now: '2026-08-08T12:03:00.000Z', expectedSourceVersionId: first.sourceVersionId,
    })
    await service.recognize(retry, async () => result())
    await expect(service.recognize(first, async () => { throw new Error('late failure') })).rejects.toThrow('late failure')
    const workspace = await repository.load()

    expect(workspace?.sources.find((source) => source.id === first.sourceId)?.status).toBe('needs_review')
    expect(workspace?.recognitionRuns.find((run) => run.id === first.recognitionRunId)?.status).toBe('failed')
    expect(workspace?.extractionDrafts.find((draft) => draft.id === retry.draftId)?.status).toBe('needs_review')
    expect(workspaceV8ToLegacyView(workspace!).sources.find((source) => source.id === first.sourceId)?.processingError).toBeUndefined()
  })

  it('manual source correction creates a new SourceVersion on the same Source', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const first = await service.beginCapture(request('manual-revision-source'))
    await expect(service.recognize(first, async () => { throw new Error('AI timeout') })).rejects.toThrow()
    const revisionRequest = {
      operationId: 'manual-revision-1',
      rawText: '请于8月12日18:00提交修正后的报名表',
      provider: 'local-rules' as const,
      modelName: 'local-rules',
      promptVersion: 'recognition-2.0.0',
      pipelineVersion: 'manual-source-supplement-v1',
      now: '2026-08-08T13:00:00.000Z',
    }
    const revision = await service.beginRevision(first.sourceId, revisionRequest)
    await service.recognize(revision, async () => buildLocalRecognition({
      sourceType: 'text',
      sourceTitle: '匿名通知',
      content: revisionRequest.rawText,
      referenceTime: new Date('2026-08-08T00:00:00+08:00'),
      timezone: 'Asia/Shanghai',
      projects: [],
      tasks: [],
    }))
    const duplicate = await service.beginRevision(first.sourceId, revisionRequest)
    const reloaded = await repository.load()

    expect(duplicate).toEqual({ ...revision, duplicate: true })
    expect(reloaded?.sources).toHaveLength(1)
    expect(reloaded?.sources[0].currentVersionId).toBe(revision.sourceVersionId)
    expect(reloaded?.sourceVersions).toHaveLength(2)
    expect(reloaded?.sourceVersions.find((item) => item.id === revision.sourceVersionId)?.rawText).toBe(revisionRequest.rawText)
    expect(reloaded?.recognitionRuns).toHaveLength(2)
    expect(reloaded?.extractionDrafts).toHaveLength(2)

    const originalVersion = reloaded!.sourceVersions.find((item) => item.id === first.sourceVersionId)!
    const originalSnapshot = structuredClone(originalVersion)
    const compatibilityAutosave = mergeLegacyViewIntoWorkspaceV8(reloaded!, workspaceV8ToLegacyView(reloaded!))
    expect(compatibilityAutosave.sourceVersions.find((item) => item.id === first.sourceVersionId)).toEqual(originalSnapshot)
    expect(compatibilityAutosave.sourceVersions.find((item) => item.id === revision.sourceVersionId)).toMatchObject({
      rawText: revisionRequest.rawText,
      contentHash: workspaceSnapshotHash(revisionRequest.rawText),
    })
  })

  it('rejects a no-op revision and deep-merges review metadata for a real revision', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const first = await service.beginCapture({
      ...request('revision-metadata'),
      sourceLegacyData: { reviewMetadata: { mimeType: 'application/pdf', pageCount: 3, qualityFlags: ['旧标记'] } },
    })
    await expect(service.recognize(first, async () => { throw new Error('failed') })).rejects.toThrow()
    await expect(service.beginRevision(first.sourceId, {
      operationId: 'revision-noop', rawText: request().rawText, provider: 'local-rules', modelName: 'local-rules',
      promptVersion: 'local-v1', pipelineVersion: 'revision-v1',
    })).rejects.toThrow('CAPTURE_REVISION_UNCHANGED')

    const revision = await service.beginRevision(first.sourceId, {
      operationId: 'revision-real', rawText: '补充后的正文', provider: 'local-rules', modelName: 'local-rules',
      promptVersion: 'local-v1', pipelineVersion: 'revision-v1',
      sourceLegacyData: { reviewMetadata: { extractionMethod: 'manual', characterCount: 6 } },
    })
    const source = (await repository.load())!.sources.find((item) => item.id === first.sourceId)!
    const revisionVersion = (await repository.load())!.sourceVersions.find((item) => item.id === revision.sourceVersionId)!
    expect(source.legacyData?.reviewMetadata).toEqual({
      mimeType: 'application/pdf', pageCount: 3, qualityFlags: ['旧标记'], extractionMethod: 'manual', characterCount: 6,
    })
    expect(revisionVersion.legacyData?.reviewMetadata).toEqual({ extractionMethod: 'manual', characterCount: 6 })
  })

  it('keeps retry Run and Draft IDs unique across source versions', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const first = await service.beginCapture(request('cross-version-retry-ids'))
    await expect(service.recognize(first, async () => { throw new Error('AI timeout') })).rejects.toThrow()
    const firstVersionRetry = await service.beginRetry(first.sourceId, {
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'recognition-2.0.0', pipelineVersion: 'retry-v1',
    })
    await expect(service.recognize(firstVersionRetry, async () => { throw new Error('retry failed') })).rejects.toThrow()
    const revision = await service.beginRevision(first.sourceId, {
      operationId: 'cross-version-revision', rawText: '修正后的通知正文',
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'recognition-2.0.0', pipelineVersion: 'revision-v1',
    })
    await service.recognize(revision, async () => result())
    const secondVersionRetry = await service.beginRetry(first.sourceId, {
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'recognition-2.0.0', pipelineVersion: 'retry-v2',
    })
    const reloaded = await repository.load()

    expect(secondVersionRetry.sourceVersionId).toBe(revision.sourceVersionId)
    expect(new Set(reloaded!.recognitionRuns.map((item) => item.id)).size).toBe(reloaded!.recognitionRuns.length)
    expect(new Set(reloaded!.extractionDrafts.map((item) => item.id)).size).toBe(reloaded!.extractionDrafts.length)
  })

  it('protects duplicate clicks with the client operation id', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(emptyWorkspace())
    const service = new CapturePersistenceService(repository)
    const first = await service.captureAndRecognize(request('same-click'), async () => result())
    const executor = vi.fn(async () => result())
    const second = await service.captureAndRecognize(request('same-click'), executor)
    expect(second.handle.sourceId).toBe(first.handle.sourceId)
    expect(executor).not.toHaveBeenCalled()
    expect((await repository.load())?.sources).toHaveLength(1)
  })

  it('survives the React compatibility autosave after a failed AI run and local retry', async () => {
    const initial = applyPreparedV8Migration(prepareV7ToV8Migration(createWorkspaceData(demoTasks, demoSources)))
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: initial }))
    const service = new CapturePersistenceService(repository)
    const first = await service.beginCapture(request())
    await expect(service.recognize(first, async () => { throw new Error('timeout') })).rejects.toThrow('timeout')
    const retry = await service.beginRetry(first.sourceId, {
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'local-v1', pipelineVersion: 'local-v1',
    })
    await service.recognize(retry, async () => result())
    const canonical = (await repository.load())!
    const view = workspaceV8ToLegacyView(canonical)
    const autosaveView = createWorkspaceData(
      view.tasks, view.sources, view.drafts, view.projects, view.courseBlocks, view.integrations,
      view.knowledgeSettings, view.workPackages, view.events, view.migrationLog, view.recognitionFeedback, view.legacyData,
    )
    const merged = mergeLegacyViewIntoWorkspaceV8(canonical, autosaveView)
    expect(validateWorkspaceV8(merged)).toEqual({ valid: true, issues: [] })
  })
})
