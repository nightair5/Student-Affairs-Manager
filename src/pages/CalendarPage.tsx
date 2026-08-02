import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Lightbulb, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { buildMonthCells, groupTasksByDate, localDateKey, summarizeDay } from '../lib/calendar'
import { findSuggestedWorkSlot } from '../lib/scheduling'
import { formatDuration } from '../lib/taskLogic'
import type { CourseBlock, Task } from '../types'

interface CalendarPageProps {
  tasks: Task[]
  courseBlocks: CourseBlock[]
  onOpenTask: (task: Task) => void
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

function taskTime(task: Task): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(task.deadline))
}

export function CalendarPage({ tasks, courseBlocks, onOpenTask, onAddCourseBlock, onRemoveCourseBlock }: CalendarPageProps) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDateKey, setSelectedDateKey] = useState(() => localDateKey(today))
  const [courseTitle, setCourseTitle] = useState('')
  const [courseWeekday, setCourseWeekday] = useState<CourseBlock['weekday']>(1)
  const [courseStart, setCourseStart] = useState('08:00')
  const [courseEnd, setCourseEnd] = useState('10:00')
  const eventByDate = useMemo(() => groupTasksByDate(tasks), [tasks])
  const monthCells = useMemo(() => buildMonthCells(viewDate), [viewDate])
  const selectedTasks = eventByDate.get(selectedDateKey) ?? []
  const activeTasks = useMemo(() => tasks
    .filter((task) => task.status !== '已完成')
    .slice()
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()), [tasks])
  const agendaTasks = selectedTasks.length ? selectedTasks : activeTasks.slice(0, 5)
  const agendaTitle = selectedTasks.length ? `${dayLabel(selectedDateKey)} · ${selectedTasks.length} 项` : '近期节点'
  const suggestions = useMemo(() => activeTasks
    .map((task) => ({ task, slot: findSuggestedWorkSlot(task, courseBlocks) }))
    .filter((item) => item.slot)
    .slice(0, 3), [activeTasks, courseBlocks])

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
      <header className="page-header calendar-page-header">
        <div><span className="eyebrow">截止与开工安排</span><h1>日历</h1><p>月历只保留每天的行动摘要；选择有事项的日期，在右侧查看清单。</p></div>
        <div className="legend"><span><i className="legend-dot deadline" />有截止事项</span><span><i className="legend-dot start" />当前选中</span></div>
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
              const dayTasks = eventByDate.get(cell.dateKey) ?? []
              const summary = summarizeDay(dayTasks)
              const selected = cell.dateKey === selectedDateKey
              const className = [
                'calendar-day',
                !cell.inMonth && 'muted',
                summary && 'has-event',
                selected && 'selected',
                cell.isToday && 'today',
              ].filter(Boolean).join(' ')
              const accessibleSummary = summary
                ? `${summary.total} 项，最早 ${summary.timeLabel}，${summary.headline}`
                : '无事项'
              return <button key={cell.dateKey} className={className} type="button" onClick={() => summary && setSelectedDateKey(cell.dateKey)} disabled={!summary} aria-label={`${dayLabel(cell.dateKey)}，${accessibleSummary}`}>
                <span className="calendar-date"><strong>{cell.day}</strong>{cell.isToday && <em>今天</em>}</span>
                {summary
                  ? <span className="calendar-day-summary">
                      <strong>{summary.headline}</strong>
                      <small>{summary.active ? `${summary.active} 项待办 · ${summary.timeLabel}` : `${summary.completed} 项已完成`}</small>
                      {summary.riskCount > 0 && <em>{summary.riskCount} 项需留意</em>}
                    </span>
                  : <span className="calendar-day-empty">—</span>}
              </button>
            })}
          </div>
        </section>

        <aside className="calendar-agenda">
          <div className="section-heading compact"><div><span className="section-index">DETAIL</span><h2>{agendaTitle}</h2></div><CalendarDays size={20} /></div>
          {agendaTasks.length
            ? agendaTasks.slice(0, 5).map((task) => <button className="agenda-item" key={task.id} type="button" onClick={() => onOpenTask(task)}>
                <span className="agenda-time">{taskTime(task)}</span>
                <span className="agenda-copy"><strong>{task.title}</strong><small><Clock3 size={13} />预计 {formatDuration(task.estimatedMinutes)} · {task.status}</small></span>
              </button>)
            : <div className="calendar-empty-agenda"><strong>近期没有截止事项</strong><p>确认后的任务会自动出现在对应日期。</p></div>}
          {agendaTasks.length > 5 && <p className="calendar-agenda-more">另有 {agendaTasks.length - 5} 项，请在任务中心查看。</p>}
          <div className="agenda-tip"><Lightbulb size={18} /><p>选择日期只查看摘要；点击右侧任务再打开详情。</p></div>
        </aside>
      </div>

      <section className="schedule-section" aria-labelledby="schedule-title">
        <div className="section-heading"><div><span className="section-index">PLAN</span><h2 id="schedule-title">课程表避让</h2><p>录入每周固定课程，本机规则会寻找 08:00–22:00 的连续空档。</p></div><CalendarDays size={20} /></div>
        <div className="schedule-grid">
          <div className="course-panel">
            <form className="course-form" onSubmit={addCourse}>
              <label className="field"><span>课程名称</span><input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="例如：传播学专题" required /></label>
              <label className="field"><span>星期</span><select value={courseWeekday} onChange={(event) => setCourseWeekday(Number(event.target.value) as CourseBlock['weekday'])}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
              <label className="field"><span>开始</span><input type="time" value={courseStart} onChange={(event) => setCourseStart(event.target.value)} required /></label>
              <label className="field"><span>结束</span><input type="time" value={courseEnd} onChange={(event) => setCourseEnd(event.target.value)} required /></label>
              <button className="secondary-button" type="submit" disabled={courseStart >= courseEnd}><Plus size={15} />添加课程</button>
            </form>
            <div className="course-list">{courseBlocks.length ? courseBlocks.map((block) => <div className="course-item" key={block.id}><span><strong>{block.title}</strong><small>{weekdays.find((day) => day.value === block.weekday)?.label} · {block.startTime}–{block.endTime}</small></span><button className="icon-button" type="button" aria-label={`删除课程 ${block.title}`} onClick={() => onRemoveCourseBlock(block.id)}><Trash2 size={15} /></button></div>) : <p className="muted-copy">尚未录入课程；建议不会假设你的空闲时间。</p>}</div>
          </div>
          <div className="work-slot-panel"><h3>建议开工时段</h3>{suggestions.length ? suggestions.map(({ task, slot }) => slot && <button type="button" className="work-slot" key={task.id} onClick={() => onOpenTask(task)}><span><strong>{task.title}</strong><small>{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(slot.start))} 开始 · {formatDuration(task.estimatedMinutes)}</small></span><em>{slot.reason}</em></button>) : <p className="muted-copy">当前没有可计算的未完成任务或连续空档。</p>}</div>
        </div>
      </section>
    </main>
  )
}
