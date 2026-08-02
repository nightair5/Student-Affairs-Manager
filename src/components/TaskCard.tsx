import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Paperclip,
} from 'lucide-react'
import type { Task } from '../types'
import {
  formatDuration,
  getMaterialProgress,
} from '../lib/taskLogic'

function deadlineParts(value: string): { date: string; time: string; weekday: string } {
  const deadline = new Date(value)
  return {
    date: new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(deadline),
    time: new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(deadline),
    weekday: new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(deadline),
  }
}

interface TaskCardProps {
  task: Task
  featured?: boolean
  onOpen: (task: Task) => void
  onComplete?: (taskId: string) => void
}

export function TaskCard({
  task,
  featured = false,
  onOpen,
  onComplete,
}: TaskCardProps) {
  const materials = getMaterialProgress(task)
  const deadline = deadlineParts(task.deadline)

  return (
    <article
      className={`task-card${featured ? ' featured' : ''}`}
      data-priority={task.priority}
    >
      <div className="task-card-topline">
        <span className="category-label">{task.category}</span>
        <button className="task-detail-button" type="button" onClick={() => onOpen(task)} aria-label={`查看 ${task.title} 详情`}>
          查看详情<ArrowUpRight size={16} />
        </button>
      </div>

      <h3 className="task-card-title">{task.title}</h3>

      <div className="task-timing-panel">
        <div className="task-deadline-block">
          <span><Clock3 size={15} />截止时间</span>
          <strong>{deadline.date}</strong>
          <em>{deadline.weekday} · {deadline.time}</em>
        </div>
        <div className="task-duration-block">
          <span>预计用时</span>
          <strong>{formatDuration(task.estimatedMinutes)}</strong>
          {materials.total > 0 && <small><Paperclip size={13} />材料 {materials.done}/{materials.total}</small>}
        </div>
      </div>

      <p className="priority-reason">{task.priorityReason}</p>

      <div className="next-action">
        <span>下一步</span>
        <strong>{task.nextAction}</strong>
      </div>

      <div className="task-card-footer">
        <div className="risk-list" aria-label="任务风险">
          {task.riskFlags.length ? (
            task.riskFlags.map((risk) => (
              <span className="risk-tag" key={risk}>
                <CircleAlert size={14} />
                {risk}
              </span>
            ))
          ) : (
            <span className="calm-tag">节奏正常</span>
          )}
        </div>
        {onComplete && (
          <button
            className="complete-button"
            type="button"
            onClick={() => onComplete(task.id)}
          >
            <CheckCircle2 size={19} />
            标记完成
          </button>
        )}
      </div>
    </article>
  )
}
