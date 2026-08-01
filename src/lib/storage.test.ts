import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../data/demo'
import {
  loadWorkspace,
  saveWorkspace,
  storageKeys,
  type StorageAdapter,
} from './storage'

class MemoryStorage implements StorageAdapter {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe('workspace persistence', () => {
  it('persists confirmed tasks, edits, materials, history and reminders', () => {
    const storage = new MemoryStorage()
    const persistedTask = {
      ...demoTasks[0],
      title: '用户手动修改后的标题',
      materials: demoTasks[0].materials.map((item) => ({ ...item, done: true })),
      reminders: [
        {
          id: 'saved-email',
          channel: 'email' as const,
          scheduledAt: '2026-08-02T09:00',
          enabled: true,
        },
      ],
      history: [
        {
          id: 'saved-history',
          field: '任务名称',
          before: '旧标题',
          after: '用户手动修改后的标题',
          changedAt: '2026-08-01T09:00:00.000Z',
          actor: 'user' as const,
        },
      ],
    }

    expect(saveWorkspace([persistedTask], demoSources, storage)).toBe(true)
    const restored = loadWorkspace(demoTasks, demoSources, storage)

    expect(restored.origin).toBe('current')
    expect(restored.tasks[0].title).toBe('用户手动修改后的标题')
    expect(restored.tasks[0].materials.every((item) => item.done)).toBe(true)
    expect(restored.tasks[0].history[0].after).toBe('用户手动修改后的标题')
    expect(restored.tasks[0].reminders[0]).toMatchObject({
      channel: 'email',
      enabled: true,
      scheduledAt: '2026-08-02T09:00',
    })
  })

  it('migrates the previous split keys without losing user data', () => {
    const storage = new MemoryStorage()
    storage.setItem(storageKeys.legacyTasks, JSON.stringify([demoTasks[1]]))
    storage.setItem(
      storageKeys.legacySources,
      JSON.stringify([demoSources[1]]),
    )

    const migrated = loadWorkspace(demoTasks, demoSources, storage)
    expect(migrated.origin).toBe('legacy')
    expect(migrated.tasks).toHaveLength(1)
    expect(migrated.tasks[0].id).toBe(demoTasks[1].id)
    expect(migrated.sources[0].id).toBe(demoSources[1].id)

    saveWorkspace(migrated.tasks, migrated.sources, storage)
    expect(storage.getItem(storageKeys.legacyTasks)).toBeNull()
    expect(loadWorkspace(demoTasks, demoSources, storage).origin).toBe('current')
  })

  it('falls back safely when stored JSON is corrupted', () => {
    const storage = new MemoryStorage()
    storage.setItem(storageKeys.workspace, '{not-json')

    const restored = loadWorkspace(demoTasks, demoSources, storage)
    expect(restored.origin).toBe('fallback')
    expect(restored.tasks).toBe(demoTasks)
  })
})
