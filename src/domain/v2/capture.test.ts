import { describe, expect, it, vi } from 'vitest'
import { buildLocalRecognition } from '../../recognition/pipeline'
import { demoSources, demoTasks } from '../../data/demo'
import { createWorkspaceData } from '../../lib/workspace'
import { CapturePersistenceService } from './capture'
import { createGoldenWorkspaceV8 } from './fixtures'
import { mergeLegacyViewIntoWorkspaceV8, workspaceV8ToLegacyView } from './legacyView'
import { applyPreparedV8Migration, prepareV7ToV8Migration } from './migration'
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
