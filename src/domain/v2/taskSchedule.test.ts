import { describe, expect, it } from 'vitest'
import { createGoldenWorkspaceV8 } from './fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'
import { setTaskSchedule } from './taskSchedule'
import { workspaceV8ToLegacyView } from './legacyView'
import { buildLocalRecognition } from '../../recognition/pipeline'
import { CapturePersistenceService } from './capture'
import { commitDirectDraft, undoDirectBatch } from './directIntake'
import { homeFlow } from '../../lib/homeFlow'
import { groupTasksByDate, buildUpcomingCalendarItems } from '../../lib/calendar'
import { commitTaskCommand } from './taskCommand'

async function setup() {
  const w = createGoldenWorkspaceV8(), repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
  await repository.save(w)
  return { repository, id: w.tasks[0].id }
}
describe('a personal date never edits source facts', () => {
  it('stores date-only, moves between home/calendar groups, clears only the plan', async () => {
    const { repository, id } = await setup(), before = (await repository.load())!
    await setTaskSchedule(repository, id, '2026-10-28', '2026-10-26T10:00:00Z')
    const saved = (await repository.load())!, view = workspaceV8ToLegacyView(saved), task = view.tasks.find(t => t.id === id)!
    expect(saved.timePoints.filter(p => p.type !== 'planned_start')).toEqual(before.timePoints.filter(p => p.type !== 'planned_start'))
    expect(saved.materials).toEqual(before.materials)
    expect(saved.evidenceRefs).toEqual(before.evidenceRefs)
    expect(task.plannedStart).toBe('2026-10-28')
    expect(homeFlow([task], [], new Date('2026-10-26T08:00+08:00')).next.map(t => t.id)).toContain(id)
    expect(groupTasksByDate([task]).get('2026-10-28')?.map(t => t.id)).toContain(id)
    expect(buildUpcomingCalendarItems([task], [], new Date('2026-10-28T15:00+08:00'))[0].at).toBe('2026-10-28')
    await setTaskSchedule(repository, id, '', '2026-10-26T10:01:00Z')
    const cleared = (await repository.load())!
    expect(cleared.timePoints.filter(p => p.type !== 'planned_start')).toEqual(before.timePoints.filter(p => p.type !== 'planned_start'))
    expect(workspaceV8ToLegacyView(cleared).tasks.find(t => t.id === id)?.plannedStart).toBeUndefined()
  })
  it('does not leave half a date on a failed transaction', async () => {
    const { repository, id } = await setup(), before = await repository.load()
    repository.transaction = async () => { throw Error('INJECTED_WRITE_FAILURE') }
    await expect(setTaskSchedule(repository, id, '2026-10-28')).rejects.toThrow('INJECTED')
    expect(await repository.load()).toEqual(before)
  })
  it('independently reads both calendar roles after plan, completion, restoration and clearing the plan', async () => {
    const w=createGoldenWorkspaceV8()
    for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
    const store=new MemoryWorkspaceRecordStore(),repository=new CanonicalWorkspaceRepository(store);await repository.save(w)
    const capture=new CapturePersistenceService(repository),text='请于2026年11月7日17:00前提交申请表。',now='2026-11-05T10:00:00+08:00'
    const h=await capture.beginCapture({operationId:'roles-capture',sourceType:'text',title:'申请表',rawText:text,provider:'local-rules',modelName:'local',promptVersion:'test',pipelineVersion:'test',now})
    await capture.recognize(h,async()=>buildLocalRecognition({sourceType:'text',sourceTitle:'申请表',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]}))
    const result=await commitDirectDraft(repository,h.draftId,now),id=result.batch!.items[0].id
    await setTaskSchedule(repository,id,'2026-11-06','2026-11-05T11:00:00+08:00')
    const reader=new CanonicalWorkspaceRepository(store),afterPlan=(await reader.load())!,projected=workspaceV8ToLegacyView(afterPlan).tasks.find(t=>t.id===id)!
    expect(projected.deadline).toBe('2026-11-07T17:00');expect([...groupTasksByDate([projected]).keys()].sort()).toEqual(['2026-11-06','2026-11-07'])
    const canonical=afterPlan.tasks.find(t=>t.id===id)!
    await commitTaskCommand(repository,{operationId:'roles-complete',taskId:id,expected:{status:canonical.status},changes:{status:'completed'},changedAt:'2026-11-05T11:01:00+08:00'})
    let restored=workspaceV8ToLegacyView((await reader.load())!).tasks.find(t=>t.id===id)!
    expect(buildUpcomingCalendarItems([restored],[],new Date('2026-11-06T09:00:00+08:00'))).toHaveLength(0)
    await commitTaskCommand(repository,{operationId:'roles-restore',taskId:id,expected:{status:'completed'},changes:{status:canonical.status},changedAt:'2026-11-05T11:02:00+08:00'})
    await setTaskSchedule(repository,id,'','2026-11-05T11:03:00+08:00')
    restored=workspaceV8ToLegacyView((await reader.load())!).tasks.find(t=>t.id===id)!
    expect([...groupTasksByDate([restored]).keys()]).toEqual(['2026-11-07']);expect(restored.deadline).toBe('2026-11-07T17:00')
  })
  it('keeps another task attached to a shared plan', async () => {
    const { repository, id } = await setup(), second = (await repository.load())!.tasks[1].id
    await setTaskSchedule(repository, id, '2026-10-28')
    await repository.transaction(w => ({ ...w, timePoints: w.timePoints.map(p => p.type === 'planned_start' && p.taskId === id ? { ...p, relatedTaskIds: [id, second] } : p) }))
    await setTaskSchedule(repository, id, '2026-10-29')
    const w = (await repository.load())!
    expect(w.timePoints.some(p => p.type === 'planned_start' && p.normalizedValue === '2026-10-28' && p.relatedTaskIds.includes(second))).toBe(true)
    expect(workspaceV8ToLegacyView(w).tasks.find(t => t.id === id)?.plannedStart).toBe('2026-10-29')
  })
  it('undo of a new batch also removes a subsequently added personal date', async () => {
    const w = createGoldenWorkspaceV8()
    for (const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const) w[key] = []
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore()); await repository.save(w)
    const capture = new CapturePersistenceService(repository), text = '图书馆检索服务已经升级，仅供知悉，无需办理。', now = '2026-10-26T10:00:00Z'
    const h = await capture.beginCapture({ operationId: 'schedule-undo', sourceType: 'text', title: '服务公告', rawText: text, provider: 'local-rules', modelName: 'local-rules', promptVersion: 'unchanged', pipelineVersion: 'test', now })
    await capture.recognize(h, async () => buildLocalRecognition({ sourceType: 'text', sourceTitle: '服务公告', content: text, referenceTime: new Date(now), timezone: 'Asia/Shanghai', projects: [], tasks: [] }))
    const { batch } = await commitDirectDraft(repository, h.draftId, now)
    await setTaskSchedule(repository, batch!.items[0].id, '2026-10-28')
    await undoDirectBatch(repository, batch!.id)
    const undone = (await repository.load())!
    expect(undone.tasks).toHaveLength(0); expect(undone.timePoints).toHaveLength(0)
  })
})
