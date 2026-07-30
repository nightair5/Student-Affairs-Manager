import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Paperclip,
} from 'lucide-react'
import type { Task } from '../types'
import {
  formatDeadline,
  formatDuration,
  getMaterialProgress,
} from '../lib/taskLogic'

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

  return (
    <article
      className={`task-card${featured ? ' featured' : ''}`}
      data-priority={task.priority}
    >
      <div className="task-card-topline">
        <span className="category-label">{task.category}</span>
        <span className="deadline-label">
          <Clock3 size={15} />
          {formatDeadline(task.deadline)}
        </span>
      </div>

      <div className="task-title-row">
        <h3>{task.title}</h3>
        <button
          className="icon-button"
          type="button"
          onClick={() => onOpen(task)}
          aria-label={`查看 ${task.title} 详情`}
        >
          <ArrowUpRight size={18} />
        </button>
      </div>

      <p className="priority-reason">{task.priorityReason}</p>

      <div className="next-action">
        <span>下一步</span>
        <strong>{task.nextAction}</strong>
      </div>

      <div className="task-meta">
        <span>
          <Clock3 size={15} />
          {formatDuration(task.estimatedMinutes)}
        </span>
        {materials.total > 0 && (
          <span>
            <Paperclip size={15} />
            材料 {materials.done}/{materials.total}
          </span>
        )}
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
            <CheckCircle2 size={16} />
            标记完成
          </button>
        )}
      </div>
    </article>
  )
}
