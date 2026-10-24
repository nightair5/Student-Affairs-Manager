import { describe, expect, it } from 'vitest'
import type { WorkspaceData } from '../../types'
import { buildLocalRecognition } from '../../recognition/pipeline'
import fixture from './fixtures/workspace-v7-anonymous-copy.json'
import { prepareV7ToV8Migration, workspaceSnapshotHash } from './migration'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'
import { workspaceV8ToLegacyView } from './legacyView'
import { mapSourceWorkflowItem } from '../../lib/sourceWorkflow'
import { workspaceLoadDiagnosticV2 } from '../../lib/workspaceRecoveryUi'
import type { ExtractionDraft } from './types'

const now = '2026-10-25T00:00:00.000Z'
const factKeys = ['sources', 'sourceVersions', 'projects', 'milestones', 'workPackages', 'tasks', 'events', 'materials', 'timePoints', 'evidenceRefs', 'historyRecords', 'reminderRecords'] as const
function oldV7() {
  const result = buildLocalRecognition({ sourceType: 'text', sourceTitle: '匿名通知', content: '请于10月30日17:00前提交课程论文。', referenceTime: new Date(now), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
  const v7 = structuredClone(fixture) as unknown as WorkspaceData
  v7.drafts = [{ id: 'history-draft', sourceId: v7.sources[0].id, status: '已确认', workflowStatus: 'confirmed', createdAt: now, updatedAt: now, items: [], recognitionResult: result }]
  return v7
}
function damagedV8(status: ExtractionDraft['status'] = 'confirmed') {
  const raw = prepareV7ToV8Migration(oldV7(), { now }).workspace!
  const draft = raw.extractionDrafts[0]
  draft.status = status
  draft.acceptedEntityTempIds = ['old-confirmed-item']
  draft.rejectedEntityTempIds = ['old-rejected-item']
  draft.commitOperationIds = ['prior-commit-receipt']
  ;(draft.result as unknown as Record<string, unknown>).quality = { legacySummary: '匿名旧附注' }
  return raw
}

describe('explicit historical result recovery', () => {
  it.each(['confirmed', 'partially_confirmed', 'rejected', 'archived', 'needs_review'] as const)('preserves %s lifecycle, saved facts and exact original; never reoffers old suggestions', async status => {
    const original = damagedV8(status), store = new MemoryWorkspaceRecordStore({ current: original }), repo = new CanonicalWorkspaceRepository(store)
    const blocked = await repo.loadOrMigrate({ now })
    expect(blocked.workspace).toBeNull()
    expect(await store.read('current')).toEqual(original)
    expect(workspaceLoadDiagnosticV2(new Error(blocked.errors.join(','))).canTryHistoricalRepair).toBe(true)
    const recovered = await repo.loadOrMigrate({ now, isolateHistoricalResults: true })
    expect(recovered.workspace, recovered.errors.join(',')).not.toBeNull()
    const saved = recovered.workspace!, draft = saved.extractionDrafts[0]
    for (const key of factKeys) expect(saved[key], key).toEqual(original[key])
    expect(saved.recognitionRuns).toEqual(original.recognitionRuns)
    expect(draft.status).toBe(status)
    for (const key of ['acceptedEntityTempIds', 'rejectedEntityTempIds', 'commitOperationIds', 'createdAt', 'updatedAt'] as const) expect(draft[key]).toEqual(original.extractionDrafts[0][key])
    expect(draft.result).toBeNull()
    const audit = draft.legacyData?.storedDraftRecovery as { mode: string; backupId: string; originalResult: unknown }
    expect(audit.mode).toBe('isolated_historical_result')
    expect(audit.originalResult).toEqual(original.extractionDrafts[0].result)
    expect(await store.read(audit.backupId)).toMatchObject({ integrityHash: workspaceSnapshotHash(original), snapshot: original })
    const view = workspaceV8ToLegacyView(saved)
    expect(view.drafts[0].items).toEqual([])
    const workflow = mapSourceWorkflowItem(view.sources.find(s => s.id === view.drafts[0].sourceId)!, view.drafts, saved)
    expect(workflow.statusDescription).toContain('已保存的任务和日程保持不变')
    expect(workflow.canRetry).toBe(false)
    expect(workflow.canOpenDraft).toBe(false)
    expect(repo.importJson(repo.exportJson(saved))).toEqual(saved)
    expect((await repo.loadOrMigrate({ isolateHistoricalResults: true })).workspace).toEqual(saved)
    expect(await repo.load()).toEqual(saved)
  })

  it('uses the existing verified v7 backup and migration for historical answers', async () => {
    const original = oldV7(), expected = prepareV7ToV8Migration(original, { now }).workspace!
    ;(original.drafts[0].recognitionResult as unknown as Record<string, unknown>).quality = { legacySummary: '匿名旧附注' }
    const store = new MemoryWorkspaceRecordStore({ current: original }), repo = new CanonicalWorkspaceRepository(store)
    expect((await repo.loadOrMigrate({ now })).workspace).toBeNull()
    expect(await store.read('current')).toEqual(original)
    const outcome = await repo.loadOrMigrate({ now, isolateHistoricalResults: true })
    expect(outcome.workspace, outcome.errors.join(',')).not.toBeNull()
    for (const key of factKeys) expect(outcome.workspace![key], key).toEqual(expected[key])
    expect(outcome.workspace!.extractionDrafts[0].status).toBe('confirmed')
    expect(await store.read(outcome.backupId!)).toMatchObject({ snapshot: original })
    expect(await repo.load()).toEqual(outcome.workspace)
  })

  it('cannot disguise missing saved references, draft metadata faults or overwrite earlier recovery audits', async () => {
    for (const fault of ['reference', 'metadata', 'prior-audit'] as const) {
      const original = damagedV8()
      if (fault === 'reference') original.tasks[0].projectId = 'missing-project'
      if (fault === 'metadata') (original.extractionDrafts[0] as unknown as Record<string, unknown>).acceptedEntityTempIds = 'broken'
      if (fault === 'prior-audit') original.extractionDrafts[0].legacyData = { storedDraftRecovery: { originalResult: 'must remain' } }
      const store = new MemoryWorkspaceRecordStore({ current: original }), repo = new CanonicalWorkspaceRepository(store)
      expect((await repo.loadOrMigrate({ now, isolateHistoricalResults: true })).workspace).toBeNull()
      expect(await store.read('current')).toEqual(original)
    }
  })

  it('stops on backup write/read failure or concurrent changes, without half a repair', async () => {
    for (const failure of ['write', 'read', 'concurrent'] as const) {
      const original = damagedV8()
      class FaultStore extends MemoryWorkspaceRecordStore {
        calls = 0
        override async read(key: string) {
          if (failure === 'read' && key.startsWith('draft-history-recovery-backup:')) return { corrupt: true }
          return super.read(key)
        }
        override async transactionMany(...args: Parameters<MemoryWorkspaceRecordStore['transactionMany']>) {
          this.calls++
          if (failure === 'write') throw new Error('SYNTHETIC_BACKUP_FAILURE')
          if (failure === 'concurrent' && this.calls === 2) { const changed = structuredClone(original); changed.tasks[0].title = '另一个窗口保存的事项'; await this.write('current', changed) }
          return super.transactionMany(...args)
        }
      }
      const store = new FaultStore({ current: original }), repo = new CanonicalWorkspaceRepository(store)
      expect((await repo.loadOrMigrate({ now, isolateHistoricalResults: true })).workspace).toBeNull()
      const expected = structuredClone(original)
      if (failure === 'concurrent') expected.tasks[0].title = '另一个窗口保存的事项'
      expect(await store.read('current')).toEqual(expected)
      expect(JSON.parse((await repo.exportProtectedCurrentSnapshot())!).snapshot).toEqual(expected)
    }
  })
})
