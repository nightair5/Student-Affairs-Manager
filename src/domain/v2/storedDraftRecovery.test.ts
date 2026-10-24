import { describe, expect, it } from 'vitest'
import type { WorkspaceData } from '../../types'
import { buildLocalRecognition } from '../../recognition/pipeline'
import fixture from './fixtures/workspace-v7-anonymous-copy.json'
import { prepareV7ToV8Migration, workspaceSnapshotHash } from './migration'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'
import { workspaceV8ToLegacyView } from './legacyView'
import { mapSourceWorkflowItem } from '../../lib/sourceWorkflow'

const now = '2026-10-24T14:00:00.000Z'
function oldV7() {
  const v7 = structuredClone(fixture) as unknown as WorkspaceData
  const result = buildLocalRecognition({ sourceType: 'text', sourceTitle: '匿名通知', content: '请于10月30日17:00前提交课程论文。', referenceTime: new Date(now), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
  v7.drafts = [{ id: 'old-draft', sourceId: v7.sources[0].id, status: '待确认', workflowStatus: 'needs_review', createdAt: now, updatedAt: now, items: [], recognitionResult: result }]
  return v7
}
function oldV8(kind: 'notes' | 'compound' = 'notes') {
  const v8 = prepareV7ToV8Migration(oldV7(), { now }).workspace!
  // Existing v8 snapshots can predate stricter recognition validation too.
  const raw = v8.extractionDrafts[0].result as unknown as Record<string, unknown>
  raw.ambiguities = [{ id: 'old-note', question: '请核对原文' }]
  raw.ignoredContent = [{ content: '正文补充说明', reason: '非事务内容' }]
  if (kind === 'compound') raw.quality = { oldSummary: '旧版附注' }
  return v8
}

describe('stored draft recovery is independent of workspace version', () => {
  it('backs up and repairs old v8 notes without changing any canonical facts', async () => {
    const original = oldV8(), store = new MemoryWorkspaceRecordStore({ current: original }), repository = new CanonicalWorkspaceRepository(store)
    const outcome = await repository.loadOrMigrate({ now })
    expect(outcome.workspace, outcome.errors.join(',')).not.toBeNull()
    const saved = outcome.workspace!
    for (const key of ['tasks', 'materials', 'timePoints', 'events', 'sources', 'sourceVersions', 'historyRecords'] as const) expect(saved[key]).toEqual(original[key])
    const audit = saved.extractionDrafts[0].legacyData?.storedDraftRecovery as { backupId: string; originalResult: unknown }
    expect(audit.originalResult).toEqual(original.extractionDrafts[0].result)
    const backup = await store.read(audit.backupId) as { snapshot: unknown; integrityHash: string }
    expect(backup.snapshot).toEqual(original)
    expect(backup.integrityHash).toBe(workspaceSnapshotHash(original))
    expect(await repository.load()).toEqual(saved)
    expect((await repository.loadOrMigrate()).workspace).toEqual(saved)
    expect(repository.importJson(repository.exportJson(saved))).toEqual(saved)
  })

  it.each([7, 8])('isolates an unreadable unconfirmed result in v%s while retaining its source and original', async version => {
    const original = version === 8 ? oldV8('compound') : oldV7()
    if ('drafts' in original) (original.drafts[0].recognitionResult as unknown as Record<string, unknown>).quality = { legacy: true }
    const store = new MemoryWorkspaceRecordStore({ current: original }), repository = new CanonicalWorkspaceRepository(store)
    const outcome = await repository.loadOrMigrate({ now })
    expect(outcome.workspace, outcome.errors.join(',')).not.toBeNull()
    const draft = outcome.workspace!.extractionDrafts[0]
    expect(draft.result).toBeNull(); expect(draft.status).toBe('failed')
    expect(draft.legacyData?.storedDraftRecovery).toMatchObject({ mode: 'isolated_unconfirmed_result' })
    expect(outcome.workspace!.sources).toHaveLength(original.sources.length)
    expect(outcome.workspace!.tasks).toHaveLength(original.tasks.length)
    expect(await repository.load()).toEqual(outcome.workspace)
    const view = workspaceV8ToLegacyView(outcome.workspace!)
    expect(view.drafts[0].items).toEqual([])
    const workflow = mapSourceWorkflowItem(view.sources.find(source => source.id === view.drafts[0].sourceId)!, view.drafts, outcome.workspace!)
    expect(workflow.status).toBe('failed'); expect(workflow.canRetry).toBe(true)
    expect(workflow.statusDescription).toContain('旧识别回答都已保留')
  })

  it('never isolates a committed result or repairs missing canonical references', async () => {
    for (const kind of ['committed', 'reference']) {
      const original = oldV8('compound')
      if (kind === 'committed') original.extractionDrafts[0].commitOperationIds = ['already-committed']
      else original.tasks[0].projectId = 'missing-project'
      const store = new MemoryWorkspaceRecordStore({ current: original }), result = await new CanonicalWorkspaceRepository(store).loadOrMigrate({ now })
      expect(result.workspace).toBeNull(); expect(await store.read('current')).toEqual(original)
    }
  })

  it('does not overwrite on backup failure or a concurrent modification', async () => {
    for (const fail of ['backup', 'concurrent']) {
      const original = oldV8()
      class FailingStore extends MemoryWorkspaceRecordStore {
        calls = 0
        override async transactionMany(...args: Parameters<MemoryWorkspaceRecordStore['transactionMany']>) {
          this.calls++
          if (fail === 'backup') throw new Error('SYNTHETIC_QUOTA')
          if (this.calls === 2) { const changed = structuredClone(original); changed.tasks[0].title = '另一窗口已保存'; await this.write('current', changed) }
          return super.transactionMany(...args)
        }
      }
      const store = new FailingStore({ current: original }), result = await new CanonicalWorkspaceRepository(store).loadOrMigrate({ now })
      expect(result.workspace).toBeNull()
      const expected = structuredClone(original); if (fail === 'concurrent') expected.tasks[0].title = '另一窗口已保存'
      expect(await store.read('current')).toEqual(expected)
    }
  })

  it('exports even invalid current records read-only and rejects a corrupted recovery backup', async () => {
    const original = oldV8(), hash = workspaceSnapshotHash(original)
    const store = new MemoryWorkspaceRecordStore({ current: original,
      [`draft-recovery-backup:${hash}`]: { id: `draft-recovery-backup:${hash}`, kind: 'stored-draft-recovery-1', integrityHash: hash, snapshot: {} } })
    const repository = new CanonicalWorkspaceRepository(store)
    expect((await repository.loadOrMigrate()).workspace).toBeNull()
    expect(await store.read('current')).toEqual(original)
    expect(JSON.parse((await repository.exportProtectedCurrentSnapshot())!)).toMatchObject({ integrityHash: hash, snapshot: original })
    expect(await store.read('current')).toEqual(original)
  })

  it('does not rewrite healthy stored workspaces or their draft results', async () => {
    const original = prepareV7ToV8Migration(oldV7(), { now }).workspace!
    const store = new MemoryWorkspaceRecordStore({ current: original })
    const repository = new CanonicalWorkspaceRepository(store)
    expect((await repository.loadOrMigrate()).workspace).toEqual(original)
    expect(await store.read('current')).toEqual(original)
  })
})
