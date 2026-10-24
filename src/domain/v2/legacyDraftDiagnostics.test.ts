import { describe, expect, it } from 'vitest'
import type { WorkspaceData } from '../../types'
import { buildLocalRecognition } from '../../recognition/pipeline'
import { isRecognitionResult } from '../../recognition/schema'
import anonymousV7 from './fixtures/workspace-v7-anonymous-copy.json'
import { prepareV7ToV8Migration } from './migration'
import { CanonicalWorkspaceRepository, CURRENT_WORKSPACE_RECORD_KEY, MemoryWorkspaceRecordStore } from './repository'
import { sourceReviewProblem } from './sourceReviewD26'
import { workspaceV8ToLegacyView } from './legacyView'
import { mapSourceWorkflowItem } from '../../lib/sourceWorkflow'

function legacyWorkspace(broken = true) {
  const workspace = structuredClone(anonymousV7) as unknown as WorkspaceData
  const recognition = buildLocalRecognition({
    sourceType: 'text', sourceTitle: '匿名作业', content: '请于10月30日17:00前提交课程论文。',
    referenceTime: new Date('2026-10-24T08:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [],
  })
  expect(isRecognitionResult(recognition)).toBe(true)
  const raw = structuredClone(recognition) as unknown as Record<string, unknown>
  if (broken) {
    raw.ambiguities = [{ id: 'old-note', question: '请核对提交对象', detail: { retained: true } }]
    raw.ignoredContent = [{ content: '仅链接，无文本内容', reason: '仅链接无正文，无法提取有效信息。' }]
  }
  workspace.drafts = [{
    id: 'legacy-draft', sourceId: workspace.sources[0].id, status: '待确认', workflowStatus: 'needs_review',
    createdAt: workspace.savedAt, updatedAt: workspace.savedAt, items: [],
    recognitionResult: raw as unknown as typeof recognition,
  }]
  return workspace
}

describe('legacy draft diagnostic compatibility', () => {
  it('preserves the exact backup and canonical facts when old diagnostic metadata is malformed', async () => {
    const original = legacyWorkspace()
    const now = '2026-10-24T08:00:00.000Z'
    const expected = prepareV7ToV8Migration(legacyWorkspace(false), { now }).workspace!
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: original })
    const repository = new CanonicalWorkspaceRepository(store)
    const outcome = await repository.loadOrMigrate({ migrationId: 'legacy-diagnostics', now })
    expect(outcome.status, JSON.stringify(outcome.errors)).toBe('migration_success')
    const saved = outcome.workspace!
    expect(saved.tasks).toEqual(expected.tasks)
    expect(saved.materials).toEqual(expected.materials)
    expect(saved.events).toEqual(expected.events)
    expect(saved.timePoints).toEqual(expected.timePoints)
    expect((await repository.readMigrationBackup(outcome.backupId!))?.snapshot).toEqual(original)
    const draft = saved.extractionDrafts[0]
    expect(draft.legacyData?.v7Record).toEqual(original.drafts[0])
    expect(isRecognitionResult(draft.result)).toBe(true)
    expect(draft.result?.standaloneTasks).toEqual(original.drafts[0].recognitionResult!.standaloneTasks)
    expect(draft.needsReview).toBe(true)
    expect(sourceReviewProblem(draft.result!, draft.result!.standaloneTasks[0]?.tempId)).toContain('旧')
    const view = workspaceV8ToLegacyView(saved)
    expect(mapSourceWorkflowItem(view.sources[0], view.drafts, saved).canRetry).toBe(true)
    expect(await repository.load()).toEqual(saved)
    expect(['already_v8', 'backup_available']).toContain((await repository.loadOrMigrate()).status)
    expect(repository.importJson(repository.exportJson(saved))).toEqual(saved)
  })

  it('leaves valid old results and current v8 records byte-for-byte unchanged', async () => {
    const input = legacyWorkspace(false)
    const migrated = prepareV7ToV8Migration(input).workspace!
    expect(JSON.stringify(migrated.extractionDrafts[0].result)).toBe(JSON.stringify(input.drafts[0].recognitionResult))
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore({ current: migrated }))
    expect((await repository.loadOrMigrate()).workspace).toEqual(migrated)
  })

  it('does not repair invalid task facts or overwrite a failed migration', async () => {
    const input = legacyWorkspace()
    input.tasks[0].projectId = 'not-a-real-project'
    const store = new MemoryWorkspaceRecordStore({ current: input })
    const result = await new CanonicalWorkspaceRepository(store).loadOrMigrate()
    expect(result.status).toBe('migration_failed')
    expect(result.errors.join(',')).toContain('MISSING_REFERENCE')
    expect(await store.read('current')).toEqual(input)
  })

  it('does not substitute missing model facts while repairing diagnostic fields', () => {
    const input = legacyWorkspace()
    input.drafts[0].recognitionResult!.standaloneTasks[0].actionObject = ''
    expect(prepareV7ToV8Migration(input).workspace).toBeNull()
  })

  it('keeps source facts usable when only an ignored-content annotation needs compatibility', () => {
    const input = legacyWorkspace()
    input.drafts[0].recognitionResult!.ambiguities = []
    const result = prepareV7ToV8Migration(input).workspace!.extractionDrafts[0].result!
    expect(result.ignoredContent).toEqual([{ text: '仅链接，无文本内容', reason: 'other' }])
    expect(sourceReviewProblem(result, result.standaloneTasks[0].tempId)).toBeUndefined()
  })

  it('still rejects a fabricated evidence reference instead of silently removing it', () => {
    const input = legacyWorkspace()
    input.drafts[0].recognitionResult!.ambiguities = [{
      id: 'unsafe', field: '对象', message: '核对对象', options: [], evidenceIds: ['not-in-source'],
    }]
    expect(prepareV7ToV8Migration(input).workspace).toBeNull()
  })

  it('never replaces the old record when the backup transaction cannot be committed', async () => {
    const original = legacyWorkspace()
    class BackupFailure extends MemoryWorkspaceRecordStore {
      override async transactionMany(): Promise<Map<string, unknown>> { throw new Error('INJECTED_BACKUP_FAILURE') }
    }
    const store = new BackupFailure({ current: original })
    const outcome = await new CanonicalWorkspaceRepository(store).loadOrMigrate()
    expect(outcome.status).toBe('migration_failed')
    expect(await store.read('current')).toEqual(original)
  })
})
