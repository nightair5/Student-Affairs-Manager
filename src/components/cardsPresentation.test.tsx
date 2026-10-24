import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EventCard, eventMoment } from './EventCard'
import { DashboardPage } from '../pages/DashboardPage'
import { DraftReviewPanel } from './DraftReviewPanel'
import { buildLocalRecognition, recognitionToLegacySuggestions } from '../recognition/pipeline'
import { createExtractionDraft } from '../lib/workspace'
import { demoSources, demoTasks } from '../data/demo'
import type { Event } from '../types'

const noop = () => undefined
const event: Event = { id: 'event', title: '课程答疑', description: '', startAt: '2099-11-06T19:10', endAt: null, location: 'A101', evidenceIds: [], needsConfirmation: false, createdAt: '', updatedAt: '' }
const dashboardProps = { tasks: [], projects: [], pendingReviewCount: 0, onQuickCapture: async () => undefined, onOpenIntake: noop, onOpenTask: noop, onCompleteTask: noop, onStartTask: noop, onSnoozeTask: noop, onTogglePinTask: noop, onShowTasks: noop, onShowInbox: noop, onOpenEvent: noop, onShowCalendar: noop, smartExtractionStatus: 'unavailable' as const }

describe('task and event cards before optional planning', () => {
  it('preserves event precision and does not invent an end or location', () => {
    expect(eventMoment('2026-11-06')).toBe('2026年11月6日')
    expect(eventMoment('2026-11-06T19:10')).toBe('2026年11月6日 19:10')
    expect(eventMoment('2026-11-06T19:10:00')).toContain('19:10')
    expect(eventMoment('2026-11-06T11:10:00Z')).toContain('19:10')
    const input = { ...event, startAt: '2026-11-06', location: undefined, needsConfirmation: true }
    const html = renderToStaticMarkup(<EventCard event={input} onOpen={noop} />)
    expect(html).toContain('结束时间未说明')
    expect(html).toContain('地点未说明')
    expect(html).toContain('时间仍需核对')
    expect(html).not.toContain('00:00')
    expect(input.endAt).toBeNull()
  })

  it('shows saved task and event cards before the input form and planner', () => {
    const task = { ...demoTasks[0], status: '待开始' as const, deadline: '2099-11-07T17:00', dependencyIds: [], snoozedUntil: undefined }
    const html = renderToStaticMarkup(<DashboardPage {...dashboardProps} tasks={[task]} events={[event]} planning={<div id="planner-test">安排</div>} />)
    expect(html.indexOf('focus-section')).toBeLessThan(html.indexOf('dashboard-add-notice'))
    expect(html.indexOf('dashboard-event-card')).toBeLessThan(html.indexOf('planner-test'))
    expect(html).toContain('课程答疑')
    expect(html).toContain('2099年11月6日 19:10')
    expect(html).toContain('A101')
  })

  it('keeps completed tasks out of action cards while retaining undated events and the calendar link', () => {
    const events = [{ ...event, id: 'past', title: '已结束活动', startAt: '2000-01-01' }, { ...event, startAt: null, title: '时间未公布的答疑' }]
    const before = JSON.stringify(events)
    const html = renderToStaticMarkup(<DashboardPage {...dashboardProps} tasks={[{ ...demoTasks[0], status: '已完成' }]} events={events} />)
    expect(html).toContain('任务都完成了')
    expect(html).not.toContain('已结束活动')
    expect(html).not.toContain('已经完成，不重复安排')
    expect(html).toContain('时间未公布的答疑')
    expect(html).toContain('查看日历')
    expect(JSON.stringify(events)).toBe(before)
  })

  it('keeps the first-use input available without extra expansion', () => {
    const html = renderToStaticMarkup(<DashboardPage {...dashboardProps} />)
    expect(html.indexOf('quick-capture')).toBeLessThan(html.indexOf('focus-section'))
    expect(html).not.toContain('dashboard-add-notice')
  })

  it('keeps source facts and conditional selection intact inside review cards', () => {
    const content = '仅限已报名同学，请于10月30日17:00前将申请表提交至学习通。'
    const result = buildLocalRecognition({ content, sourceTitle: '匿名通知', sourceType: 'text', referenceTime: new Date('2026-10-24T10:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
    const draft = createExtractionDraft('source', recognitionToLegacySuggestions(result), '2026-10-24T02:00:00Z', result)
    const before = JSON.stringify(draft)
    const html = renderToStaticMarkup(<DraftReviewPanel ordinarySourceReview={{ busy: false, unsaved: false, facts: null, onConfirm: noop }} draft={draft} source={{ ...demoSources[0], id: 'source', content }} onClose={noop} onUpdate={noop} onConfirm={noop} onReject={noop} onConfirmAll={noop} projectWillCreate={false} projects={[]} onProjectChoice={noop} onKeepExplicit={noop} onMoveTask={noop} onToggleRecognitionEntity={noop} onToggleTaskSelected={noop} onSplitTask={noop} onMergeTask={noop} />)
    expect(html).toContain('suggestion-card-title')
    expect(html).toContain('data-selected="false"')
    expect(html).toContain('申请表')
    expect(html).toContain('学习通')
    expect(html).toContain('17:00')
    expect(html).toContain('在原文中定位')
    expect(html).toContain('不需要')
    expect(html).toContain('aria-label="是否保留这项任务"')
    expect(html).toContain('<blockquote>仅限已报名同学')
    expect(html).toContain('选择保留后')
    expect(JSON.stringify(draft)).toBe(before)
  })
})
