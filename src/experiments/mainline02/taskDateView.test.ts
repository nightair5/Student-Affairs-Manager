import { describe, expect, it } from 'vitest'
import { captureFixture, memoryRepository } from '../mainline01/chain'
import { confirmationRevisionV2, confirmV2 } from '../../domain/v2/confirmationV2'
import { taskDateViews } from './taskDateView'
import { calculateTaskPriority } from '../../lib/taskLogic'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import { groupTasksByDate, buildUpcomingCalendarItems } from '../../lib/calendar'
import { buildBrowserReminderJobs } from '../../lib/notifications'
import { buildCalendarIcs, buildTodoIcs } from '../../lib/calendarExport'
async function confirmed(kind:'multi'|'no-date') {
  const repo=memoryRepository(),h=await captureFixture(repo,kind)
  if(kind==='multi') await repo.transaction(data=>{const next=structuredClone(data); next.extractionDrafts[0].result!.timePoints[0].type='planned_start';return next})
  const before=(await repo.load())!
  const saved=await confirmV2(repo,{draftId:h.draftId,revision:confirmationRevisionV2(before),taskTempIds:before.extractionDrafts[0].result!.standaloneTasks.map(t=>t.tempId)})
  return {repo,saved}
}
describe('canonical undated downstream',()=>{
  it('is findable without date error, calendar entry or reminder; JSON retains it',async()=>{
    const {repo,saved}=await confirmed('no-date'),view=workspaceV8ToLegacyView(saved),dates=taskDateViews(saved),task=view.tasks[0],now=new Date('2026-09-05T08:00:00Z')
    expect(dates[task.id].kind).toBe('absent')
    expect(calculateTaskPriority(task,[task],now,dates).score).toBe(calculateTaskPriority(task,[task],now).score-77)
    expect(groupTasksByDate(view.tasks).size).toBe(0); expect(buildUpcomingCalendarItems(view.tasks,[],now)).toHaveLength(0)
    expect(buildBrowserReminderJobs(view.tasks,now)).toHaveLength(0)
    expect(JSON.parse(repo.exportJson(saved)).tasks).toHaveLength(1)
    expect(saved.timePoints).toHaveLength(0); expect(saved.reminderRecords).toHaveLength(0)
    expect(()=>buildCalendarIcs(view.tasks)).toThrow('INVALID_CALENDAR_DATE')
    expect(()=>buildTodoIcs(view.tasks)).toThrow('INVALID_CALENDAR_DATE')
  })
  it('keeps planned start separate from deadline without losing time',async()=>{
    const {saved}=await confirmed('multi'),views=taskDateViews(saved)
    expect(views[saved.tasks[0].id].kind).toBe('start_only')
    expect(views[saved.tasks[1].id].kind).toBe('dated'); expect(saved.timePoints).toHaveLength(2)
  })
  it('cannot dismiss related uncertain time, damaged source or explicit review flags',async()=>{
    const {saved}=await confirmed('multi')
    const bad=structuredClone(saved); bad.timePoints[0].needsConfirmation=true
    expect(taskDateViews(bad)[bad.tasks[0].id].noDeadlineProven).toBe(false)
    const broken=structuredClone(saved); broken.sourceVersions[0].rawText='篡改'
    expect(taskDateViews(broken)[broken.tasks[0].id].kind).toBe('review')
    const flagged=structuredClone(saved); flagged.tasks[0].needsReview=true
    expect(taskDateViews(flagged)[flagged.tasks[0].id].projectedPendingOnly).toBe(false)
    const stored=structuredClone(saved); stored.tasks[0].legacyData!.v7Record={riskFlags:['待确认']}
    expect(taskDateViews(stored)[stored.tasks[0].id].projectedPendingOnly).toBe(false)
  })
})
