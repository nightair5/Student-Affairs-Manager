import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../data/demo'
import { materializeWorkspaceEntities } from './domainEntities'

describe('canonical workspace entities', () => {
  it('materializes traceable time points, materials, and safe reminder states', () => {
    const entities = materializeWorkspaceEntities(demoTasks, demoSources, [], [])

    expect(entities.timePoints).toHaveLength(demoTasks.length)
    expect(entities.timePoints[0]).toMatchObject({
      taskId: demoTasks[0].id,
      type: 'deadline',
      value: demoTasks[0].deadline,
    })
    expect(entities.materialItems.find((item) => item.id === 'mat-1')?.status).toBe('ready')
    expect(entities.materialItems.find((item) => item.id === 'mat-2')?.status).toBe('missing')
    expect(entities.reminderRecords.find((item) => item.channel === 'email')?.status).toBe('draft')
    expect(entities.reminderRecords.some((item) => item.status === 'sent')).toBe(false)
  })

  it('preserves an explicit six-state material workflow', () => {
    const task = {
      ...demoTasks[0],
      materials: demoTasks[0].materials.map((material, index) => ({
        ...material,
        done: index > 0,
        status: (['preparing', 'submitted', 'verified'] as const)[index],
      })),
    }
    const entities = materializeWorkspaceEntities([task], demoSources, [], [])

    expect(entities.materialItems.map((item) => item.status)).toEqual([
      'preparing',
      'submitted',
      'verified',
    ])
  })

  it('preserves exact reminder delivery state without inventing sent timestamps', () => {
    const task = {
      ...demoTasks[0],
      reminders: [
        {
          id: 'sent-reminder',
          channel: 'browser' as const,
          scheduledAt: '2026-08-20T09:00:00+08:00',
          enabled: false,
          status: 'sent' as const,
          sentAt: '2026-08-20T09:00:03+08:00',
        },
        {
          id: 'failed-reminder',
          channel: 'email' as const,
          scheduledAt: '2026-08-21T09:00:00+08:00',
          enabled: false,
          status: 'failed' as const,
          errorMessage: 'PROVIDER_REJECTED',
          sentAt: null,
        },
        {
          id: 'unverified-sent-reminder',
          channel: 'browser' as const,
          scheduledAt: '2026-08-22T09:00:00+08:00',
          enabled: false,
          status: 'sent' as const,
        },
      ],
    }

    const records = materializeWorkspaceEntities([task], demoSources, [], []).reminderRecords

    expect(records.find((item) => item.id === 'sent-reminder')).toMatchObject({
      status: 'sent',
      sentAt: '2026-08-20T09:00:03+08:00',
    })
    expect(records.find((item) => item.id === 'failed-reminder')).toMatchObject({
      status: 'failed',
      errorMessage: 'PROVIDER_REJECTED',
      sentAt: null,
    })
    expect(records.find((item) => item.id === 'unverified-sent-reminder')).toMatchObject({
      status: 'failed',
      errorMessage: 'LEGACY_SENT_AT_MISSING',
      sentAt: null,
    })
  })
})
