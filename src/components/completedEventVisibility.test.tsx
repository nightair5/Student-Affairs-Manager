import {afterEach,describe,expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {DashboardPage} from '../pages/DashboardPage'
import {CalendarPage} from '../pages/CalendarPage'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {commitEventCompletion} from '../domain/v2/eventCompletion'
import {workspaceV8ToLegacyView} from '../domain/v2/legacyView'

const noop=()=>undefined
const dashboardProps={directMode:true,tasks:[],projects:[],pendingReviewCount:0,onQuickCapture:async()=>undefined,onOpenIntake:noop,onOpenTask:noop,onCompleteTask:noop,onStartTask:noop,onSnoozeTask:noop,onTogglePinTask:noop,onShowTasks:noop,onShowInbox:noop,onShowCalendar:noop,onOpenEvent:noop,smartExtractionStatus:'connected' as const}

describe('completed event visibility and recovery',()=>{
 afterEach(()=>vi.useRealTimers())
 it('removes the empty timeline from home and keeps recovery in the calendar after repository readback',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-01T04:00:00Z'))
  const before=createGoldenWorkspaceV8(),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  await repo.save(before)
  const id=before.events[0].id
  await commitEventCompletion(repo,{operationId:'complete-event-visibility',eventId:id,expected:false,completed:true,changedAt:'2026-09-01T04:00:00Z'})
  const saved=(await new CanonicalWorkspaceRepository(store).load())!
  const completed=workspaceV8ToLegacyView(saved).events.find(event=>event.id===id)!
  const home=renderToStaticMarkup(<DashboardPage {...dashboardProps} events={[completed]}/>)
  expect(home).not.toContain('待办与日程')
  expect(home).not.toContain('已完成日程')
  expect(home).toContain('事情都处理好了')
  expect(home).toContain('查看日历')
  const calendar=renderToStaticMarkup(<CalendarPage directMode tasks={[]} events={[completed]} courseBlocks={[]} onOpenTask={noop} onOpenEvent={noop} onSetEventCompletion={async()=>undefined} onAddCourseBlock={noop} onRemoveCourseBlock={noop}/>)
  expect(calendar).toContain('<details class="calendar-completed-events">')
  expect(calendar).toContain('已完成的日程')
  expect(calendar).toContain('恢复未完成')
  expect(calendar).toContain(completed.title)
  expect(calendar).not.toContain('data-event-id=')
  expect(saved.timePoints).toEqual(before.timePoints)
  await commitEventCompletion(repo,{operationId:'restore-event-visibility',eventId:id,expected:true,expectedRevision:'complete-event-visibility',completed:false,changedAt:'2026-09-01T04:01:00Z'})
  const restored=workspaceV8ToLegacyView((await new CanonicalWorkspaceRepository(store).load())!).events.find(event=>event.id===id)!
  const restoredHome=renderToStaticMarkup(<DashboardPage {...dashboardProps} events={[restored]}/>)
  expect(restoredHome).toContain(restored.title)
  expect(restoredHome).toContain('data-near-event="true"')
  expect(restoredHome).toContain('校内会议室')
  const mixed=renderToStaticMarkup(<DashboardPage {...dashboardProps} events={[completed,{...restored,id:'another-event'}]}/>)
  expect(mixed).not.toContain('已完成日程')
  expect(mixed).toContain('data-event-id="another-event"')
  const pastUnfinished=renderToStaticMarkup(<DashboardPage {...dashboardProps} events={[{...restored,startAt:'2000-01-01'}]}/>)
  expect(pastUnfinished).toContain('暂无待办或近期日程')
  expect(pastUnfinished).not.toContain('事情都处理好了')
 })
})
