import { CalendarDays, Clock3, Lightbulb, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
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

const days = Array.from({ length: 35 }, (_, index) => {
  const value = index - 4
  return value <= 0 ? 31 + value : value
})

const weekdays: Array<{ value: CourseBlock['weekday']; label: string }> = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

export function CalendarPage({ tasks, courseBlocks, onOpenTask, onAddCourseBlock, onRemoveCourseBlock }: CalendarPageProps) {
  const [courseTitle, setCourseTitle] = useState('')
  const [courseWeekday, setCourseWeekday] = useState<CourseBlock['weekday']>(1)
  const [courseStart, setCourseStart] = useState('08:00')
  const [courseEnd, setCourseEnd] = useState('10:00')
  const eventByDay = new Map<number, Task[]>()
  tasks.forEach((task) => {
    const day = new Date(task.deadline).getDate()
    eventByDay.set(day, [...(eventByDay.get(day) ?? []), task])
  })
  const activeTasks = tasks
    .filter((task) => task.status !== '已完成')
    .slice()
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  const suggestions = useMemo(() => activeTasks
    .map((task) => ({ task, slot: findSuggestedWorkSlot(task, courseBlocks) }))
    .filter((item) => item.slot)
    .slice(0, 3), [activeTasks, courseBlocks])

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
    <main className="page">
      <header className="page-header">
        <div><span className="eyebrow">截止与开工安排</span><h1>八月日历</h1><p>录入固定课程后，开工建议会避开这些时段；其他行程仍需你确认。</p></div>
        <div className="legend"><span><i className="legend-dot deadline" />截止</span><span><i className="legend-dot start" />建议开工</span></div>
      </header>

      <div className="calendar-layout">
        <section className="calendar-card" aria-label="2026 年 8 月日历">
          <div className="calendar-weekdays">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>周{day}</span>)}</div>
          <div className="calendar-grid">
            {days.map((day, index) => {
              const dayTasks = index >= 4 ? eventByDay.get(day) ?? [] : []
              return <button key={`${index}-${day}`} className={`calendar-day${index < 4 ? ' muted' : ''}${dayTasks.length ? ' has-event' : ''}`} type="button" onClick={() => dayTasks[0] && onOpenTask(dayTasks[0])} disabled={!dayTasks.length}>
                <span>{day}</span>
                {dayTasks.slice(0, 2).map((task) => <span className="calendar-event" key={task.id}><i />{task.title}</span>)}
                {dayTasks.length > 2 && <span className="calendar-more">另有 {dayTasks.length - 2} 项</span>}
              </button>
            })}
          </div>
        </section>

        <aside className="calendar-agenda">
          <div className="section-heading compact"><div><span className="section-index">NEXT</span><h2>近期节点</h2></div><CalendarDays size={20} /></div>
          {activeTasks.slice(0, 3).map((task) => <button className="agenda-item" key={task.id} type="button" onClick={() => onOpenTask(task)}><span className="agenda-date">{new Date(task.deadline).getMonth() + 1}月<strong>{new Date(task.deadline).getDate()}</strong></span><span className="agenda-copy"><strong>{task.title}</strong><small><Clock3 size={13} />预计 {formatDuration(task.estimatedMinutes)}</small></span></button>)}
          <div className="agenda-tip"><Lightbulb size={18} /><p>开工建议只避让已录入课程，不会读取系统日历。</p></div>
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
