import type { TaskDateViews } from '../experiments/mainline02/taskDateView'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Flag, Lightbulb, MapPin, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import {
  buildMonthCells,
  buildUpcomingCalendarItems,
  getUndatedCalendarEvents,
  groupEventsByDate,
  groupTasksByDate,
  localDateKey,
  summarizeCalendarDay,
  type CalendarTimelineItem,
} from '../lib/calendar'
import { findSuggestedWorkSlot } from '../lib/scheduling'
import { isDateOnly } from '../lib/timeSemantics'
import { formatDuration, getExecutableTasks } from '../lib/taskLogic'
import type { CourseBlock, Event, Task } from '../types'

interface CalendarPageProps {
  dateViews?: TaskDateViews
  tasks: Task[]
  events?: Event[]
  courseBlocks: CourseBlock[]
  onOpenTask: (task: Task) => void
  onOpenEvent?: (event: Event) => void
  onAddCourseBlock: (block: CourseBlock) => void
  onRemoveCourseBlock: (blockId: string) => void
}

const weekdays: Array<{ value: CourseBlock['weekday']; label: string }> = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

function monthLabel(value: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(value)
}

function dayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
    .format(new Date(`${dateKey}T12:00`))
}

function itemTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(value))
}

export function CalendarPage({ dateViews, tasks, events = [], courseBlocks, onOpenTask, onOpenEvent, onAddCourseBlock, onRemoveCourseBlock }: CalendarPageProps) {
  const [today] = useState(() => new Date())
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDateKey, setSelectedDateKey] = useState(() => localDateKey(today))
  const [agendaMode, setAgendaMode] = useState<'selected' | 'upcoming'>('upcoming')
  const [courseTitle, setCourseTitle] = useState('')
  const [courseWeekday, setCourseWeekday] = useState<CourseBlock['weekday']>(1)
  const [courseStart, setCourseStart] = useState('08:00')
  const [courseEnd, setCourseEnd] = useState('10:00')
  const taskByDate = useMemo(() => groupTasksByDate(tasks), [tasks])
  const eventByDate = useMemo(() => groupEventsByDate(events), [events])
  const monthCells = useMemo(() => buildMonthCells(viewDate), [viewDate])
  const executableTasks = useMemo(() => getExecutableTasks(tasks, today, dateViews)
    .filter(task => !dateViews || dateViews[task.id]?.kind === 'dated')
    .slice()
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()), [tasks, today, dateViews])
  const selectedItems = useMemo<CalendarTimelineItem[]>(() => {
    const selectedTasks = taskByDate.get(selectedDateKey) ?? []
    const selectedEvents = eventByDate.get(selectedDateKey) ?? []
    return [
      ...selectedTasks.map((task): CalendarTimelineItem => ({ kind: 'task', id: task.id, title: task.title, at: task.deadline, task })),
      ...selectedEvents.filter((event) => event.startAt).map((event): CalendarTimelineItem => ({ kind: 'event', id: event.id, title: event.title, at: event.startAt!, event })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  }, [eventByDate, selectedDateKey, taskByDate])
  const upcomingItems = useMemo(() => buildUpcomingCalendarItems(tasks, events, today), [events, tasks, today])
  const undatedEvents = useMemo(() => getUndatedCalendarEvents(events), [events])
  const agendaItems = agendaMode === 'selected' ? selectedItems : upcomingItems
  const agendaTitle = agendaMode === 'selected'
    ? `${dayLabel(selectedDateKey)} · ${selectedItems.length} 项`
    : `全部即将到来 · ${upcomingItems.length} 项`
  const suggestions = useMemo(() => executableTasks
    .map((task) => ({ task, slot: findSuggestedWorkSlot(task, courseBlocks, today) }))
    .filter((item) => item.slot)
    .slice(0, 3), [courseBlocks, executableTasks, today])

  const changeMonth = (offset: number) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1)
    setViewDate(next)
    setSelectedDateKey(localDateKey(next))
  }

  const addCourse = (event: FormEvent) => {
    event.preventDefault()
    if (!courseTitle.trim() || courseStart >= courseEnd) return
    onAddCourseBlock({
      id: `course-${Date.now()}`,
      title: courseTitle.trim(),
      weekday: courseWeekday,
      startTime: courseStart,
      endTime: courseEnd,
      createdAt: new Date().toISOString(),
    })
    setCourseTitle('')
  }

  return (
    <main className="page calendar-page">
      {dateViews && <section aria-label="无截止日期任务"><h2>无截止日期任务</h2>
        {tasks.filter(task => dateViews[task.id]?.noDeadlineProven).map(task => <button type="button" key={task.id} onClick={() => onOpenTask(task)}>{task.title} · {dateViews[task.id].label}</button>)}
        <p>未自动分配日期或提醒；也可在任务中心搜索。</p></section>}
      <header className="page-header calendar-page-header">
        <div><span className="eyebrow">截止、事件与开工安排</span><h1>日历</h1><p>日期格汇总任务与正式事件；选择日期或切换“即将到来”查看不截断的完整清单。</p></div>
        <div className="legend"><span><i className="legend-dot deadline" />格内为行动摘要</span><span><i className="legend-dot start" />当前选中</span></div>
      </header>

      <div className="calendar-layout">
        <section className="calendar-card" aria-label={`${monthLabel(viewDate)}日历`}>
          <div className="calendar-toolbar">
            <button className="icon-button" type="button" onClick={() => changeMonth(-1)} aria-label="查看上个月"><ChevronLeft size={19} /></button>
            <strong>{monthLabel(viewDate)}</strong>
            <button className="icon-button" type="button" onClick={() => changeMonth(1)} aria-label="查看下个月"><ChevronRight size={19} /></button>
          </div>
          <div className="calendar-weekdays">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>周{day}</span>)}</div>
          <div className="calendar-grid">
            {monthCells.map((cell) => {
              const dayTasks = taskByDate.get(cell.dateKey) ?? []
              const dayEvents = eventByDate.get(cell.dateKey) ?? []
              const summary = summarizeCalendarDay(dayTasks, dayEvents)
              if (dateViews && summary && dayTasks.some(task => isDateOnly(task.deadline))) {
                const timed = summarizeCalendarDay(dayTasks.filter(task => !isDateOnly(task.deadline)), dayEvents)
                summary.timeLabel = timed ? `含仅日期事项；时刻 ${timed.timeLabel}` : '仅日期'
              }
              const selected = cell.dateKey === selectedDateKey
              const className = [
                'calendar-day',
                !cell.inMonth && 'muted',
                summary && 'has-event',
                summary?.riskCount && 'has-risk',
                selected && 'selected',
                cell.isToday && 'today',
              ].filter(Boolean).join(' ')
              const accessibleSummary = summary
                ? `${summary.total} 项，最早 ${summary.timeLabel}，${summary.headline}`
                : '无事项'
              return <button key={cell.dateKey} className={className} type="button" onClick={() => { setSelectedDateKey(cell.dateKey); setAgendaMode('selected') }} aria-pressed={selected} aria-current={cell.isToday ? 'date' : undefined} aria-label={`${dayLabel(cell.dateKey)}，${accessibleSummary}`}>
                <span className="calendar-date"><strong>{cell.day}</strong>{cell.isToday && <em>今天</em>}</span>
                {summary
                  ? <span className="calendar-day-summary">
                      <strong className="calendar-summary-full">{summary.headline}</strong>
                      <strong className="calendar-summary-compact">{summary.compactHeadline}</strong>
                      <small className="calendar-meta-full">{summary.active ? `${summary.taskCount} 项任务 · ${summary.eventCount} 个事件 · ${summary.timeLabel}` : `${summary.completed} 项已完成`}</small>
                      <small className="calendar-meta-compact">{summary.active ? `${summary.timeLabel}·${summary.active}项` : `${summary.completed}项完成`}</small>
                      {summary.riskCount > 0 && <em>{summary.riskCount} 项需留意</em>}
                    </span>
                  : <span className="calendar-day-empty">—</span>}
              </button>
            })}
          </div>
        </section>

        <aside className="calendar-agenda">
          <div className="section-heading compact"><div><span className="section-index">DETAIL</span><h2>{agendaTitle}</h2></div><CalendarDays size={20} /></div>
          <div className="calendar-agenda-tabs" role="group" aria-label="日历详情范围">
            <button type="button" className={agendaMode === 'selected' ? 'active' : ''} aria-pressed={agendaMode === 'selected'} onClick={() => setAgendaMode('selected')}>所选日期</button>
            <button type="button" className={agendaMode === 'upcoming' ? 'active' : ''} aria-pressed={agendaMode === 'upcoming'} onClick={() => setAgendaMode('upcoming')}>即将到来</button>
          </div>
          {agendaItems.length
            ? <div className="calendar-agenda-list">{agendaItems.map((item) => item.kind === 'task'
                ? <button className="agenda-item" key={`task:${item.id}`} type="button" onClick={() => onOpenTask(item.task)}>
                    <span className="agenda-time">{dateViews && isDateOnly(item.at) ? '仅日期' : itemTime(item.at)}</span>
                    <span className="agenda-copy"><strong>{item.title}</strong><small><Clock3 size={13} />任务 · 预计 {formatDuration(item.task.estimatedMinutes)} · {item.task.status}</small></span>
                  </button>
                : onOpenEvent
                  ? <button className="agenda-item event" key={`event:${item.id}`} type="button" onClick={() => onOpenEvent(item.event)}>
                      <span className="agenda-time">{itemTime(item.at)}</span>
                      <span className="agenda-copy"><strong>{item.title}</strong><small><Flag size={13} />事件{item.event.location ? ` · ${item.event.location}` : ''}{item.event.needsConfirmation ? ' · 时间待核对' : ''}</small></span>
                    </button>
                  : <article className="agenda-item event" key={`event:${item.id}`}>
                      <span className="agenda-time">{itemTime(item.at)}</span>
                      <span className="agenda-copy"><strong>{item.title}</strong><small><Flag size={13} />事件{item.event.location ? <><MapPin size={12} />{item.event.location}</> : null}{item.event.needsConfirmation ? ' · 时间待核对' : ''}</small></span>
                    </article>)}</div>
            : <div className="calendar-empty-agenda"><strong>{agendaMode === 'selected' ? '所选日期没有事项' : '没有即将到来的事项'}</strong><p>确认后的任务和事件会按日期进入这里。</p></div>}
          {undatedEvents.length > 0 && <section className="calendar-undated-events" aria-labelledby="undated-events-title">
            <div className="section-heading compact">
              <div><span className="section-index">UNSCHEDULED</span><h3 id="undated-events-title">不定时间 / 待确认事件 · {undatedEvents.length} 项</h3></div>
              <Flag size={18} />
            </div>
            <p className="muted-copy">这些事件没有可靠的开始时间，因此不会被放进日期格或即将到来的时间排序。</p>
            <div className="calendar-agenda-list">{undatedEvents.map((event) => onOpenEvent
              ? <button className="agenda-item event" key={`undated-event:${event.id}`} type="button" onClick={() => onOpenEvent(event)}>
                  <span className="agenda-time">待定</span>
                  <span className="agenda-copy"><strong>{event.title}</strong><small><Flag size={13} />事件 · 时间待确认{event.location ? ` · ${event.location}` : ''}</small></span>
                </button>
              : <article className="agenda-item event" key={`undated-event:${event.id}`}>
                  <span className="agenda-time">待定</span>
                  <span className="agenda-copy"><strong>{event.title}</strong><small><Flag size={13} />事件 · 时间待确认{event.location ? <><MapPin size={12} />{event.location}</> : null}</small></span>
                </article>)}</div>
          </section>}
          <div className="agenda-tip"><Lightbulb size={18} /><p>即将到来展示全部未来任务和事件，不截断；月历格仍只显示行动摘要。</p></div>
        </aside>
      </div>

      <section className="schedule-section" aria-labelledby="schedule-title">
        <div className="section-heading"><div><span className="section-index">PLAN</span><h2 id="schedule-title">课程表避让</h2><p>录入每周固定课程，本机规则会寻找 08:00–22:00 的连续空档。</p></div><CalendarDays size={20} /></div>
        <div className="schedule-grid">
          <div className="course-panel">
            <form className="course-form" onSubmit={event => { if (dateViews) { event.preventDefault(); return } addCourse(event) }}>
              <label className="field"><span>课程名称</span><input disabled={Boolean(dateViews)} value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="例如：传播学专题" required /></label>
              <label className="field"><span>星期</span><select disabled={Boolean(dateViews)} value={courseWeekday} onChange={(event) => setCourseWeekday(Number(event.target.value) as CourseBlock['weekday'])}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
              <label className="field"><span>开始</span><input disabled={Boolean(dateViews)} type="time" value={courseStart} onChange={(event) => setCourseStart(event.target.value)} required /></label>
              <label className="field"><span>结束</span><input disabled={Boolean(dateViews)} type="time" value={courseEnd} onChange={(event) => setCourseEnd(event.target.value)} required /></label>
              <button className="secondary-button" type="submit" disabled={Boolean(dateViews) || courseStart >= courseEnd}><Plus size={15} />添加课程</button>
            </form>
            <div className="course-list">{courseBlocks.length ? courseBlocks.map((block) => <div className="course-item" key={block.id}><span><strong>{block.title}</strong><small>{weekdays.find((day) => day.value === block.weekday)?.label} · {block.startTime}–{block.endTime}</small></span><button className="icon-button" type="button" aria-label={`删除课程 ${block.title}`} disabled={Boolean(dateViews)} onClick={() => { if (!dateViews) onRemoveCourseBlock(block.id) }}><Trash2 size={15} /></button></div>) : <p className="muted-copy">尚未录入课程；建议不会假设你的空闲时间。</p>}</div>
          </div>
          <div className="work-slot-panel"><h3>建议开工时段</h3>{suggestions.length ? suggestions.map(({ task, slot }) => slot && <button type="button" className="work-slot" key={task.id} onClick={() => onOpenTask(task)}><span><strong>{task.title}</strong><small>{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(slot.start))} 开始 · {formatDuration(task.estimatedMinutes)}</small></span><em>{slot.reason}</em></button>) : <p className="muted-copy">当前没有可计算的未完成任务或连续空档。</p>}</div>
        </div>
      </section>
    </main>
  )
}
