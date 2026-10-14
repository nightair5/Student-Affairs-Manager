import { describe, expect, it } from 'vitest'
import type { WorkspaceData } from '../types'
import { demoSources, demoTasks } from '../data/demo'
import anonymousV7Copy from '../domain/v2/fixtures/workspace-v7-anonymous-copy.json'
import { createGoldenWorkspaceV8 } from '../domain/v2/fixtures'
import { workspaceV8ToLegacyView } from '../domain/v2/legacyView'
import { applyPreparedV8Migration, prepareV7ToV8Migration } from '../domain/v2/migration'
import {
  CanonicalWorkspaceRepository,
  CURRENT_WORKSPACE_RECORD_KEY,
  MemoryWorkspaceRecordStore,
} from '../domain/v2/repository'
import { createWorkspaceData } from './workspace'
import {
  IndexedDbWorkspaceRepository,
  normalizeWorkspaceData,
  WorkspaceRecoveryRequiredError,
} from './repository'

const v7Copy = anonymousV7Copy as unknown as WorkspaceData

async function createRecoverableFacadeMigration(migrationId: string) {
  const store = new MemoryWorkspaceRecordStore({
    [CURRENT_WORKSPACE_RECORD_KEY]: structuredClone(v7Copy),
  })
  const canonical = new CanonicalWorkspaceRepository(store)
  const migrated = await canonical.loadOrMigrate({
    now: '2026-08-08T10:00:00.000Z',
    migrationId,
  })
  if (!migrated.workspace || !migrated.backupId) throw new Error('TEST_MIGRATION_SETUP_FAILED')
  const corrupted = structuredClone(migrated.workspace) as unknown as {
    tasks: Array<Record<string, unknown>>
  }
  corrupted.tasks[0].status = 'invalid-status'
  await store.write(CURRENT_WORKSPACE_RECORD_KEY, corrupted)
  return { store, canonical, migrated, corrupted }
}

describe('normalizeWorkspaceData', () => {
  it('安全迁移 P0 数据并保留原实体', () => {
    const migrated = normalizeWorkspaceData({
      schemaVersion: 3,
      tasks: [{ id: 'task-1' }],
      sources: [{ id: 'source-1' }],
      drafts: [],
      projects: [{ id: 'project-1', title: '项目' }],
      savedAt: '2026-08-01T00:00:00.000Z',
    })

    expect(migrated).toMatchObject({
      schemaVersion: 7,
      courseBlocks: [],
      integrations: { sync: { endpoint: 'http://127.0.0.1:8787' }, webMonitors: [], connectionIntents: [] },
      knowledgeSettings: {},
      tasks: [{ id: 'task-1' }],
      projects: [{ id: 'project-1', milestones: [] }],
      evidence: [],
      timePoints: [{ taskId: 'task-1', type: 'deadline' }],
      materialItems: [],
      historyRecords: [],
      reminderRecords: [],
    })
  })

  it('preserves local knowledge authorization during hydration', () => {
    const migrated = normalizeWorkspaceData({
      schemaVersion: 5,
      tasks: [], sources: [], drafts: [], projects: [], courseBlocks: [],
      knowledgeSettings: { localSearchAuthorizedAt: '2026-08-01T00:00:00.000Z' },
      savedAt: '2026-08-01T00:00:00.000Z',
    })
    expect(migrated?.knowledgeSettings.localSearchAuthorizedAt).toBe('2026-08-01T00:00:00.000Z')
  })

  it('preserves exact reminder delivery evidence during legacy normalization', () => {
    const normalized = normalizeWorkspaceData({
      schemaVersion: 3,
      tasks: [{
        id: 'task-reminder',
        reminders: [{
          id: 'reminder-failed',
          channel: 'email',
          scheduledAt: '2026-08-10T08:00:00.000Z',
          enabled: true,
          status: 'failed',
          errorMessage: 'MAIL_NOT_CONFIGURED',
          sentAt: null,
        }],
      }],
      sources: [],
      drafts: [],
      projects: [],
      savedAt: '2026-08-01T00:00:00.000Z',
    })

    expect(normalized?.tasks[0].reminders[0]).toMatchObject({
      id: 'reminder-failed',
      status: 'failed',
      errorMessage: 'MAIL_NOT_CONFIGURED',
      sentAt: null,
    })
  })

  it('拒绝缺少核心实体数组的导入', () => {
    expect(normalizeWorkspaceData({ schemaVersion: 5, tasks: [] })).toBeNull()
  })

  it('exports and imports schema v7 with hierarchical recognition entities', () => {
    const repository = new IndexedDbWorkspaceRepository()
    const workspace = createWorkspaceData(demoTasks, demoSources)
    const restored = repository.importJson(repository.exportJson(workspace))

    expect(restored.schemaVersion).toBe(7)
    expect(restored.timePoints).toHaveLength(demoTasks.length)
    expect(restored.materialItems.map((item) => item.status)).toContain('missing')
    expect(restored.reminderRecords.every((item) => item.status !== 'sent')).toBe(true)
    expect(restored.tasks[0].materialIds).toEqual(demoTasks[0].materials.map((item) => item.id))
  })

  it('rejects malformed JSON, incompatible versions, unsafe keys, and oversized files', () => {
    const repository = new IndexedDbWorkspaceRepository()
    expect(() => repository.importJson('{broken')).toThrow()
    expect(() => repository.importJson(JSON.stringify({ schemaVersion: 99, tasks: [], sources: [], drafts: [], projects: [] }))).toThrow()
    expect(() => repository.importJson('{"schemaVersion":6,"tasks":[],"sources":[],"drafts":[],"projects":[],"__proto__":{"polluted":true}}')).toThrow(/不安全字段/)
    expect(() => repository.importJson(' '.repeat(5 * 1024 * 1024 + 1))).toThrow(/5 MB/)
  })

  it('strictly rejects incomplete or invalid current-schema backups', () => {
    const repository = new IndexedDbWorkspaceRepository()
    const incomplete = {
      schemaVersion: 7,
      tasks: [],
      sources: [],
      drafts: [],
      projects: [],
      savedAt: '2026-08-01T00:00:00.000Z',
    }
    expect(() => repository.importJson(JSON.stringify(incomplete))).toThrow(/证据列表/)

    const invalidEnum = createWorkspaceData(demoTasks, demoSources) as unknown as {
      tasks: Array<Record<string, unknown>>
    }
    invalidEnum.tasks[0].priority = '立刻处理'
    expect(() => repository.importJson(JSON.stringify(invalidEnum))).toThrow(/非法枚举值/)
  })

  it('rejects dangling references and circular task dependencies', () => {
    const repository = new IndexedDbWorkspaceRepository()
    const dangling = createWorkspaceData(demoTasks, demoSources)
    dangling.tasks[0] = { ...dangling.tasks[0], sourceIds: ['missing-source'] }
    expect(() => repository.importJson(JSON.stringify(dangling))).toThrow(/不存在的来源/)

    const cyclic = createWorkspaceData(demoTasks, demoSources)
    cyclic.tasks[0] = { ...cyclic.tasks[0], dependencyIds: [cyclic.tasks[1].id] }
    cyclic.tasks[1] = { ...cyclic.tasks[1], dependencyIds: [cyclic.tasks[0].id] }
    expect(() => repository.importJson(JSON.stringify(cyclic))).toThrow(/循环/)
  })

  it('keeps HTML-looking source text inert as ordinary imported text', () => {
    const repository = new IndexedDbWorkspaceRepository()
    const workspace = createWorkspaceData(demoTasks, [
      { ...demoSources[0], contentPreview: '<img src=x onerror=alert(1)>', content: '<script>steal()</script>' },
      ...demoSources.slice(1),
    ])
    const restored = repository.importJson(JSON.stringify(workspace))
    expect(restored.sources[0].contentPreview).toBe('<img src=x onerror=alert(1)>')
    expect(restored.sources[0].content).toBe('<script>steal()</script>')
  })

  it('persists new compatibility milestone, reminder, and history records across a canonical reload', async () => {
    const now = '2026-08-08T10:00:00.000Z'
    const initialView = createWorkspaceData(demoTasks, demoSources)
    initialView.projects.push({
      id: 'project:compatibility',
      title: '兼容持久化项目',
      category: '其他',
      sourceIds: [],
      taskIds: [],
      milestones: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    initialView.savedAt = now
    const initialCanonical = applyPreparedV8Migration(prepareV7ToV8Migration(initialView, {
      now,
      migrationId: 'repository-compatibility-reload-test',
    }))
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: initialCanonical })
    const canonical = new CanonicalWorkspaceRepository(store)
    const repository = new IndexedDbWorkspaceRepository(canonical)
    const edited = workspaceV8ToLegacyView(initialCanonical)
    const project = edited.projects.find((item) => item.id === 'project:compatibility')!
    const task = edited.tasks[0]
    const savedAt = '2026-08-08T12:00:00.000Z'
    const milestone = {
      id: 'milestone:compatibility:manual',
      projectId: project.id,
      title: '刷新后仍保留的里程碑',
      dueAt: '2026-08-20T18:00:00+08:00',
      status: '待完成' as const,
      createdAt: savedAt,
    }
    const reminder = {
      id: 'reminder:compatibility:manual',
      taskId: task.id,
      channel: 'browser' as const,
      scheduledAt: '2026-08-20T09:00:00+08:00',
      enabled: true,
      status: 'scheduled' as const,
    }
    const history = {
      id: 'history:compatibility:manual',
      entityType: 'milestone' as const,
      entityId: milestone.id,
      field: '里程碑',
      before: '',
      after: milestone.title,
      actor: 'user' as const,
      action: 'created',
      changedAt: savedAt,
    }
    project.milestones.push(milestone)
    task.reminders.push({ id: reminder.id, channel: reminder.channel, scheduledAt: reminder.scheduledAt, enabled: true })
    edited.reminderRecords.push(reminder)
    edited.historyRecords.push(history)
    edited.savedAt = savedAt

    await repository.save(edited)

    const reopenedCanonical = new CanonicalWorkspaceRepository(store)
    const reloadedCanonical = await reopenedCanonical.load()
    expect(reloadedCanonical).not.toBeNull()
    const reloaded = workspaceV8ToLegacyView(reloadedCanonical!)
    expect(reloaded.projects.find((item) => item.id === project.id)?.milestones).toContainEqual(expect.objectContaining({
      id: milestone.id,
      dueAt: milestone.dueAt,
    }))
    expect(reloaded.tasks.find((item) => item.id === task.id)?.reminders).toContainEqual(expect.objectContaining({ id: reminder.id }))
    expect(reloaded.historyRecords).toContainEqual(expect.objectContaining({
      id: history.id,
      entityType: history.entityType,
      entityId: milestone.id,
    }))

    await new IndexedDbWorkspaceRepository(reopenedCanonical).save(reloaded)
    const savedAgain = await reopenedCanonical.load()
    expect(savedAgain?.milestones.filter((item) => item.id === milestone.id)).toHaveLength(1)
    expect(savedAgain?.reminderRecords.filter((item) => item.id === reminder.id)).toHaveLength(1)
    expect(savedAgain?.historyRecords.filter((item) => item.id === history.id)).toHaveLength(1)
  })

  it('fails closed and preserves a corrupt v8 record when a compatibility save runs', async () => {
    const corruptV8 = { schemaVersion: 8, workspace: { id: 'corrupt' } }
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: corruptV8 })
    const canonical = new CanonicalWorkspaceRepository(store)
    const repository = new IndexedDbWorkspaceRepository(canonical)
    const compatibilityView = createWorkspaceData(demoTasks, demoSources)

    await expect(repository.save(compatibilityView)).rejects.toThrow(/WORKSPACE_V8_ROOT_INVALID/)
    expect(await store.read(CURRENT_WORKSPACE_RECORD_KEY)).toEqual(corruptV8)
  })
})

describe('Workspace v8 recovery facade', () => {
  it('exposes recovery_required with its backup id and recovers only after an explicit request', async () => {
    const { store, canonical, migrated, corrupted } = await createRecoverableFacadeMigration('facade-explicit-recovery')
    const repository = new IndexedDbWorkspaceRepository(canonical)

    await expect(repository.load()).rejects.toMatchObject({
      name: 'WorkspaceRecoveryRequiredError',
      code: 'WORKSPACE_RECOVERY_REQUIRED',
      status: 'recovery_required',
      backupId: migrated.backupId!,
      errors: ['WORKSPACE_V8_INVALID:INVALID_ENUM:tasks[0].status'],
    } satisfies Partial<WorkspaceRecoveryRequiredError>)
    expect(await store.read(CURRENT_WORKSPACE_RECORD_KEY)).toEqual(corrupted)

    const backupBefore = await repository.exportMigrationBackup(migrated.backupId!)
    expect(backupBefore).not.toBeNull()
    expect(await repository.exportLatestMigrationBackup()).toBe(backupBefore)

    const recovered = await repository.recoverMigration(migrated.backupId!)
    expect(recovered.tasks.map((item) => item.id)).toContain('task-v7-copy')
    expect(await repository.load()).toEqual(recovered)
    expect(await repository.exportMigrationBackup(migrated.backupId!)).toBe(backupBefore)
  })

  it('returns ordinary already_v8 and backup_available workspaces without recovery', async () => {
    const alreadyV8Store = new MemoryWorkspaceRecordStore({
      [CURRENT_WORKSPACE_RECORD_KEY]: createGoldenWorkspaceV8(),
    })
    const alreadyV8Canonical = new CanonicalWorkspaceRepository(alreadyV8Store)
    expect((await alreadyV8Canonical.loadOrMigrate()).status).toBe('already_v8')
    const alreadyV8 = await new IndexedDbWorkspaceRepository(alreadyV8Canonical).load()
    expect(alreadyV8?.tasks.map((item) => item.id)).toContain('task-1')

    const backupStore = new MemoryWorkspaceRecordStore({
      [CURRENT_WORKSPACE_RECORD_KEY]: structuredClone(v7Copy),
    })
    const backupCanonical = new CanonicalWorkspaceRepository(backupStore)
    const migrated = await backupCanonical.loadOrMigrate({
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'facade-backup-available',
    })
    expect(migrated.status).toBe('migration_success')
    expect((await backupCanonical.loadOrMigrate()).status).toBe('backup_available')
    const withBackup = await new IndexedDbWorkspaceRepository(backupCanonical).load()
    expect(withBackup?.tasks.map((item) => item.id)).toContain('task-v7-copy')
  })

  it('fails closed when the requested backup or migration lineage was tampered with', async () => {
    const damagedBackup = await createRecoverableFacadeMigration('facade-damaged-backup')
    const backupRaw = await damagedBackup.store.read(damagedBackup.migrated.backupId!) as Record<string, unknown>
    await damagedBackup.store.write(damagedBackup.migrated.backupId!, {
      ...backupRaw,
      integrityHash: 'fnv1a32:00000000',
    })
    const backupRepository = new IndexedDbWorkspaceRepository(damagedBackup.canonical)
    await expect(backupRepository.recoverMigration(damagedBackup.migrated.backupId!)).rejects.toThrow(
      'MIGRATION_BACKUP_INVALID',
    )
    expect(await damagedBackup.store.read(CURRENT_WORKSPACE_RECORD_KEY)).toEqual(damagedBackup.corrupted)

    const missingLineage = await createRecoverableFacadeMigration('facade-missing-lineage')
    await missingLineage.store.remove(`lineage:${missingLineage.migrated.backupId}`)
    const lineageRepository = new IndexedDbWorkspaceRepository(missingLineage.canonical)
    await expect(lineageRepository.recoverMigration(missingLineage.migrated.backupId!)).rejects.toThrow(
      'MIGRATION_LINEAGE_INVALID',
    )
    expect(await missingLineage.store.read(CURRENT_WORKSPACE_RECORD_KEY)).toEqual(missingLineage.corrupted)
  })
})
