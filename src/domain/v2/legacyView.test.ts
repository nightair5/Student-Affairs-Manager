import { describe, expect, it } from 'vitest'
import type { WorkspaceData } from '../../types'
import anonymousV7Copy from './fixtures/workspace-v7-anonymous-copy.json'
import { applyPreparedV8Migration, prepareV7ToV8Migration } from './migration'
import { mergeLegacyViewIntoWorkspaceV8, workspaceV8ToLegacyView } from './legacyView'

describe('Workspace v8 legacy UI view', () => {
  it('projects canonical facts without losing rich fields when UI edits are merged', () => {
    const canonical = applyPreparedV8Migration(prepareV7ToV8Migration(anonymousV7Copy as unknown as WorkspaceData, {
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'legacy-view-test',
    }))
    canonical.materials[0] = {
      ...canonical.materials[0],
      requirements: ['需要盖章'],
      formatRequirements: ['PDF/A', '小于 10 MB'],
      namingRequirements: ['学号-姓名'],
      quantity: 2,
      submissionChannel: '官网',
    }
    canonical.timePoints.push({
      ...canonical.timePoints[0],
      id: 'time:second',
      rawText: '答辩当天下午',
      normalizedValue: null,
      precision: 'relative',
      needsConfirmation: true,
    })

    const view = workspaceV8ToLegacyView(canonical)
    view.tasks[0] = { ...view.tasks[0], title: '用户修改后的任务', updatedAt: '2026-08-08T11:00:00.000Z' }
    const merged = mergeLegacyViewIntoWorkspaceV8(canonical, view)

    expect(merged.tasks[0].title).toBe('用户修改后的任务')
    expect(merged.materials[0]).toMatchObject({
      requirements: ['需要盖章'],
      formatRequirements: ['PDF/A', '小于 10 MB'],
      namingRequirements: ['学号-姓名'],
      quantity: 2,
      submissionChannel: '官网',
    })
    expect(merged.timePoints).toHaveLength(canonical.timePoints.length)
    expect(merged.evidenceRefs).toEqual(canonical.evidenceRefs)
  })
})
