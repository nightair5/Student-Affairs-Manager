import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../../recognition/pipeline'
import { CapturePersistenceService } from './capture'
import { createGoldenWorkspaceV8 } from './fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'
import { retryExistingSourceRecognition } from './sourceRetry'

describe('existing source recognition retry', () => {
  it('reuses Source and current SourceVersion while appending a new Run and Draft', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const initial = createGoldenWorkspaceV8()
    await repository.save(initial)
    const service = new CapturePersistenceService(repository)

    const retried = await retryExistingSourceRecognition(service, initial.sources[0].id, {
      provider: 'local-rules', modelName: 'local-rules', promptVersion: 'recognition-2.0.0',
      pipelineVersion: 'inbox-retry-v1', now: '2026-08-09T08:00:00.000Z',
    }, async () => buildLocalRecognition({
      sourceType: 'text', sourceTitle: initial.sources[0].title,
      content: initial.sourceVersions[0].rawText ?? '',
      referenceTime: new Date('2026-08-09T08:00:00+08:00'), timezone: 'Asia/Shanghai',
      projects: [], tasks: [],
    }))

    const workspace = await repository.load()
    expect(workspace?.sources).toHaveLength(initial.sources.length)
    expect(workspace?.sourceVersions).toHaveLength(initial.sourceVersions.length)
    expect(workspace?.sources[0].currentVersionId).toBe(initial.sources[0].currentVersionId)
    expect(workspace?.recognitionRuns).toHaveLength(initial.recognitionRuns.length + 1)
    expect(workspace?.extractionDrafts).toHaveLength(initial.extractionDrafts.length + 1)
    expect(workspace?.extractionDrafts.find((draft) => draft.id === retried.draftId)?.status).toBe('needs_review')
  })
})
