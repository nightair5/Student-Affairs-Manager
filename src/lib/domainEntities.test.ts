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
})
