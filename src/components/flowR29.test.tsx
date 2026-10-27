import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DashboardPage } from '../pages/DashboardPage'
import { FlowEventList, FlowTaskList } from './FlowItemList'
import { demoTasks } from '../data/demo'
import { homeFlow, pairUndatedEvents, workspaceEventTimeHints, workspaceTaskChannels } from '../lib/homeFlow'
import { planAfterDeadline } from '../lib/flowPresentation'
import { createGoldenWorkspaceV8 } from '../domain/v2/fixtures'
import type { Event, Task } from '../types'
import { buildLocalRecognition } from '../recognition/pipeline'
import { improveDirectFallback } from '../recognition/directFallback'
import { convertDirectResult } from '../recognition/directResult'
import { localSubmissionChannel } from '../recognition/localNoticeFacts'

const noop = () => undefined
const task = (patch: Partial<Task> = {}): Task => ({
  ...demoTasks[0], id: 'task-r29', status: '待开始', deadline: '', materials: [],
  dependencies: [], dependencyIds: [], riskFlags: [], sourceIds: [], history: [], ...patch,
})
const props = { directMode: true, tasks: [], projects: [], pendingReviewCount: 0,
  onQuickCapture: async () => undefined, onOpenIntake: noop, onOpenTask: noop,
  onCompleteTask: noop, onStartTask: noop, onSnoozeTask: noop, onTogglePinTask: noop,
  onShowTasks: noop, onShowInbox: noop, onOpenEvent: noop, onShowCalendar: noop,
  smartExtractionStatus: 'unavailable' as const }
const event = (patch: Partial<Event> = {}): Event => ({
  id: 'event-r29', title: '实习说明会', description: '', startAt: null, endAt: null,
  evidenceIds: [], needsConfirmation: true, createdAt: '', updatedAt: '', ...patch,
})

describe('direct home: actionable and dated facts stay visible', () => {
  it('shows a task due today even when the personal plan is tomorrow', () => {
    const t = task({ deadline: '2026-10-27T17:00', plannedStart: '2026-10-28' })
    const flow = homeFlow([t], [], new Date('2026-10-27T10:00:00+08:00'))
    expect(flow.today.map(item => item.id)).toEqual([t.id])
    expect(flow.next).toEqual([])
    expect(t.deadline).toBe('2026-10-27T17:00')
  })
  it('makes a definitely late personal plan visible without changing the deadline', () => {
    const t = task({ deadline: '2026-10-27T17:00', plannedStart: '2026-10-28' })
    const html = renderToStaticMarkup(<FlowTaskList tasks={[t]} onOpen={noop} onComplete={noop} />)
    expect(html).toContain('计划晚于截止')
    expect(html).toContain('截止')
    expect(t.deadline).toBe('2026-10-27T17:00')
  })
  it('does not invent a conflict from a date-only time and compares explicit clock times', () => {
    expect(planAfterDeadline('2026-10-27', '2026-10-27T17:00')).toBe(false)
    expect(planAfterDeadline('2026-10-27T16:00', '2026-10-27T17:00')).toBe(false)
    expect(planAfterDeadline('2026-10-27T18:00', '2026-10-27T09:00:00Z')).toBe(true)
  })
  it('shows only the channel attached to the actual task', () => {
    const w = createGoldenWorkspaceV8(), owner = w.tasks[0].id
    w.materials[0] = { ...w.materials[0], relatedTaskIds: [owner], submissionChannel: '学习平台' }
    const channels = workspaceTaskChannels(w), ownerTask = task({ id: owner }), other = task({ id: 'other' })
    expect(channels[owner]).toEqual(['学习平台'])
    expect(channels.other).toBeUndefined()
    const html = renderToStaticMarkup(<FlowTaskList tasks={[ownerTask, other]} channels={channels} onOpen={noop} onComplete={noop} />)
    expect(html.match(/提交：学习平台/gu)).toHaveLength(1)
  })
  it('shows a saved undated event and does not invent a clock', () => {
    const html = renderToStaticMarkup(<DashboardPage {...props} events={[event()]} />)
    expect(html).toContain('实习说明会')
    expect(html).toContain('时间待定')
    expect(html).not.toContain('00:00')
  })
  it('keeps a future event on the home page even beyond seven days', () => {
    const html = renderToStaticMarkup(<DashboardPage {...props} events={[event({ startAt: '2099-11-03T15:00', location: 'A101' })]} />)
    expect(html).toContain('实习说明会')
    expect(html).toContain('A101')
  })
  it('shows a unique same-source task and undated event in one row with an event entry', () => {
    const w = createGoldenWorkspaceV8(), e = event({ title: '参加实习说明会', directTags: ['时间待定'] })
    w.events[0] = { ...w.events[0], id: e.id, title: e.title, location: null, legacyData: { sourceId: 'source-a' } }
    const t = task({ title: e.title, sourceIds: ['source-a'], directTags: ['时间待定'] })
    const paired = pairUndatedEvents([t], [e], w)
    expect(paired.linked[t.id]).toEqual(e)
    expect(paired.unpaired).toEqual([])
    const html = renderToStaticMarkup(<DashboardPage {...props} tasks={[t]} events={[e]} canonicalWorkspace={w} />)
    expect(html.match(/data-event-id="event-r29"/gu)).toHaveLength(1)
    expect(html).toContain('查看参加实习说明会日程')
    expect(html).toContain('日程时间待定')
  })
  it('does not group events across sources or when the owner is ambiguous', () => {
    const w = createGoldenWorkspaceV8(), e = event({ title: '参加实习说明会' })
    w.events[0] = { ...w.events[0], id: e.id, legacyData: { sourceId: 'source-a' } }
    const unrelated = task({ title: e.title, sourceIds: ['source-b'] })
    expect(pairUndatedEvents([unrelated], [e], w).unpaired).toEqual([e])
    const first = task({ title: e.title, sourceIds: ['source-a'] }), second = { ...first, id: 'second' }
    expect(pairUndatedEvents([first, second], [e], w).unpaired).toEqual([e])
    expect(pairUndatedEvents([{ ...first, status: '已完成' }], [e], w).unpaired).toEqual([e])
    expect(pairUndatedEvents([first], [{ ...e, location: 'A101' }], w).unpaired).toHaveLength(1)
  })
  it('shows a relative time hint only when its exact source wording is unique', () => {
    const w = createGoldenWorkspaceV8(), raw = '本周统计与数据课结束后留十分钟，参加实习说明会。'
    w.events[0] = { ...w.events[0], title: '参加实习说明会', legacyData: { sourceId: w.sources[0].id } }
    w.timePoints[4] = { ...w.timePoints[4], normalizedValue: null, rawText: raw, needsConfirmation: true }
    w.sourceVersions[0] = { ...w.sourceVersions[0], rawText: raw }
    expect(workspaceEventTimeHints(w)['event-defense']).toBe('本周统计与数据课结束后')
    w.sourceVersions[0] = { ...w.sourceVersions[0], rawText: '没有该时间说明。' }
    expect(workspaceEventTimeHints(w)['event-defense']).toBeUndefined()
    w.sourceVersions[0] = { ...w.sourceVersions[0], rawText: raw + raw }
    expect(workspaceEventTimeHints(w)['event-defense']).toBeUndefined()
    const ambiguous='本周统计与数据课结束后，参加实习说明会并参加就业说明会。'
    w.sourceVersions[0] = { ...w.sourceVersions[0], rawText: ambiguous }
    w.timePoints[4] = { ...w.timePoints[4], rawText: ambiguous }
    w.events.push({ ...w.events[0], id: 'other-event', title: '参加就业说明会' })
    expect(workspaceEventTimeHints(w)['event-defense']).toBeUndefined()
    w.events.pop()
    w.sourceVersions[0] = { ...w.sourceVersions[0], rawText: '本周统计与数据课结束后参加实习说明会的安排已取消。' }
    w.timePoints[4] = { ...w.timePoints[4], rawText: w.sourceVersions[0].rawText! }
    expect(workspaceEventTimeHints(w)['event-defense']).toBeUndefined()
  })
  it('highlights a newly added event without changing its stored facts', () => {
    const e=event({startAt:'2099-11-03T15:00'}),before=JSON.stringify(e)
    const html=renderToStaticMarkup(<FlowEventList events={[e]} onOpen={noop} highlightIds={[e.id]} />)
    expect(html).toContain('data-new="true"')
    expect(JSON.stringify(e)).toBe(before)
  })
})

describe('local fallback retains a source-backed registration cutoff', () => {
  it('keeps the deadline when a dated cutoff is followed by a submission channel', () => {
    const source = '学院招募迎新志愿者，有意参加者请于2026年10月29日18:00前通过志愿服务平台填写报名表。'
    const input = buildLocalRecognition({ sourceType: 'text', sourceTitle: '匿名工程夹具', content: source,
      referenceTime: new Date('2026-10-27T09:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
    const result = convertDirectResult(improveDirectFallback(input, source), source).result
    expect(result.standaloneTasks.some(t => t.actionVerb === '填写')).toBe(true)
    expect(result.timePoints.some(p => p.type === 'task_deadline' && p.normalizedValue === '2026-10-29T18:00')).toBe(true)
    expect(result.materials.some(m => m.submissionChannel === '志愿服务平台')).toBe(true)
  })
  it('recognizes a channel before an action without guessing after qualification or across destinations', () => {
    expect(localSubmissionChannel('通过学院申请平台提交奖学金申请表。')).toBe('学院申请平台')
    expect(localSubmissionChannel('通过审核后在学院平台提交申请表。')).toBeNull()
    expect(localSubmissionChannel('通过甲平台填写报名表，通过乙系统提交报告。')).toBeNull()
  })
  it('does not turn an event time into a deadline for a preceding registration action', () => {
    const source = '2026年10月29日18:00举行迎新活动。请在活动开始前通过志愿平台填写报名表。'
    const input = buildLocalRecognition({ sourceType: 'text', sourceTitle: '匿名工程夹具', content: source,
      referenceTime: new Date('2026-10-27T09:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
    const result = convertDirectResult(improveDirectFallback(input, source), source).result
    expect(result.timePoints.filter(p => p.type.endsWith('_deadline') && p.normalizedValue)).toEqual([])
  })
  it.each([
    '请于2026年10月28日或29日前通过平台填写报名表。',
    '报名办理窗口为2026年10月28日09:00至11:00，通过平台填写报名表。',
  ])('does not turn an alternative or a window into a fixed deadline: %s', source => {
    const input = buildLocalRecognition({ sourceType: 'text', sourceTitle: '匿名工程夹具', content: source,
      referenceTime: new Date('2026-10-27T09:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
    const result = convertDirectResult(improveDirectFallback(input, source), source).result
    expect(result.timePoints.filter(p => p.type.endsWith('_deadline') && p.normalizedValue)).toEqual([])
  })
  it('keeps a cancellation as information, not a restored action', () => {
    const source = '原报名已取消，无需通过平台填写报名表。'
    const input = buildLocalRecognition({ sourceType: 'text', sourceTitle: '匿名工程夹具', content: source,
      referenceTime: new Date('2026-10-27T09:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
    const result = convertDirectResult(improveDirectFallback(input, source), source).result
    expect(result.standaloneTasks.every(t => t.actionVerb === '查看')).toBe(true)
  })
})
