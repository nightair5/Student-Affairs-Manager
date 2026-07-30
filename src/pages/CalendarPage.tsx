import { CalendarDays, Clock3, Lightbulb } from 'lucide-react'
import { formatDuration } from '../lib/taskLogic'
import type { Task } from '../types'

interface CalendarPageProps {
  tasks: Task[]
  onOpenTask: (task: Task) => void
}

const days = Array.from({ length: 35 }, (_, index) => {
  const value = index - 4
  return value <= 0 ? 31 + value : value
})

export function CalendarPage({ tasks, onOpenTask }: CalendarPageProps) {
  const eventByDay = new Map(
    tasks.map((task) => [new Date(task.deadline).getDate(), task]),
  )

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">截止与开工安排</span>
          <h1>八月日历</h1>
          <p>日历不只记截止日，也帮你把真正的开工时间往前挪。</p>
        </div>
        <div className="legend">
          <span>
            <i className="legend-dot deadline" />
            截止
          </span>
          <span>
            <i className="legend-dot start" />
            建议开工
          </span>
        </div>
      </header>

      <div className="calendar-layout">
        <section className="calendar-card" aria-label="2026 年 8 月日历">
          <div className="calendar-weekdays">
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
              <span key={day}>周{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((day, index) => {
              const task = index >= 4 ? eventByDay.get(day) : undefined
              return (
                <button
                  key={`${index}-${day}`}
                  className={`calendar-day${index < 4 ? ' muted' : ''}${
                    task ? ' has-event' : ''
                  }`}
                  type="button"
                  onClick={() => task && onOpenTask(task)}
                  disabled={!task}
                >
                  <span>{day}</span>
                  {task && (
                    <span className="calendar-event">
                      <i />
                      {task.title}
                    </span>
                  )}
                  {day === 1 && index >= 4 && (
                    <span className="start-event">建议开工 · 报告初稿</span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <aside className="calendar-agenda">
          <div className="section-heading compact">
            <div>
              <span className="section-index">NEXT</span>
              <h2>近期节点</h2>
            </div>
            <CalendarDays size={20} />
          </div>
          {tasks
            .filter((task) => task.status !== '已完成')
            .slice()
            .sort(
              (a, b) =>
                new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
            )
            .slice(0, 3)
            .map((task) => (
              <button
                className="agenda-item"
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task)}
              >
                <span className="agenda-date">
                  {new Date(task.deadline).getMonth() + 1}月
                  <strong>{new Date(task.deadline).getDate()}</strong>
                </span>
                <span className="agenda-copy">
                  <strong>{task.title}</strong>
                  <small>
                    <Clock3 size={13} />
                    预计 {formatDuration(task.estimatedMinutes)}
                  </small>
                </span>
              </button>
            ))}
          <div className="agenda-tip">
            <Lightbulb size={18} />
            <p>长任务会优先建议在截止日前 1–3 天开工。</p>
          </div>
        </aside>
      </div>
    </main>
  )
}
