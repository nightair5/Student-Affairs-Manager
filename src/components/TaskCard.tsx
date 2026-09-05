import type { TaskDateView } from '../experiments/mainline02/taskDateView'
import {
  AlarmClock,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Paperclip,
  Pin,
  Play,
} from 'lucide-react'
import type { Task } from '../types'
import {
  formatDuration,
  formatDeadlineDistance,
  calculateTaskPriority,
  getMaterialProgress,
} from '../lib/taskLogic'

function deadlineParts(value: string): { date: string; time: string; weekday: string } {
  const deadline = new Date(value)
  if (!Number.isFinite(deadline.getTime())) return { date: '时间待确认', time: '待补充', weekday: '未排期' }
  return {
    date: new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(deadline),
    time: new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(deadline),
    weekday: new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(deadline),
  }
}

interface TaskCardProps {
  dateView?: TaskDateView
  readOnly?: boolean
  task: Task
  allTasks?: Task[]
  projectTitle?: string
  stageTitle?: string
  featured?: boolean
  onOpen: (task: Task) => void
  onComplete?: (taskId: string) => void
  onStart?: (taskId: string) => void
  onSnooze?: (taskId: string) => void
  onTogglePin?: (taskId: string) => void
}

export function TaskCard({
  dateView, readOnly,
  task,
  allTasks = [task],
  projectTitle,
  stageTitle,
  featured = false,
  onOpen,
  onComplete,
  onStart,
  onSnooze,
  onTogglePin,
}: TaskCardProps) {
  const materials = getMaterialProgress(task)
  const deadline = dateView ? { date: dateView.label, time: '', weekday: dateView.noDeadlineProven ? '不自动排期' : '' } : deadlineParts(task.deadline)
  const priority = calculateTaskPriority(task, allTasks, new Date(), dateView ? { [task.id]: dateView } : undefined)

  return (
    <article
      className={`task-card${featured ? ' featured' : ''}`}
      data-priority={task.priority}
    >
      <div className="task-card-topline">
        <span className="category-label">{projectTitle ?? '独立事项'} · {stageTitle ?? task.category}</span>
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
          <small>{dateView ? dateView.noDeadlineProven ? '不自动生成提醒' : '' : formatDeadlineDistance(task.deadline)}</small>
        </div>
        <div className="task-duration-block">
          <span>预计用时</span>
          <strong>{formatDuration(task.estimatedMinutes)}</strong>
          {materials.total > 0 && <small><Paperclip size={13} />材料 {materials.done}/{materials.total}</small>}
        </div>
      </div>

      <p className="priority-reason">排序理由：{priority.reasons.slice(0, 2).join('；')}</p>

      <div className="next-action">
        <span>下一步</span>
        <strong>{task.nextAction}</strong>
      </div>

      <div className="task-card-footer">
        <div className="risk-list" aria-label="任务风险">
          {priority.risks.length ? (
            priority.risks.map((risk) => (
              <span className="risk-tag" key={risk}>
                <CircleAlert size={14} />
                {risk}
              </span>
            ))
          ) : (
            <span className="calm-tag">节奏正常</span>
          )}
        </div>
        <div className="task-card-actions-primary">
          {(onStart || onSnooze || onTogglePin) && <div className="task-quick-actions" aria-label="快速操作">
            {task.status === '待开始' && onStart && <button type="button" disabled={readOnly} onClick={() => { if (!readOnly) onStart(task.id) }}><Play size={15} />开始</button>}
            {onSnooze && <button type="button" disabled={readOnly} onClick={() => { if (!readOnly) onSnooze(task.id) }}><AlarmClock size={15} />稍后</button>}
            {onTogglePin && <button type="button" aria-pressed={priority.isPinned} disabled={readOnly} onClick={() => { if (!readOnly) onTogglePin(task.id) }}><Pin size={15} />{priority.isPinned ? '取消置顶' : '置顶'}</button>}
          </div>}
          {onComplete && (
            <button
              className="complete-button"
              type="button"
              disabled={readOnly} onClick={() => { if (!readOnly) onComplete(task.id) }}
            >
              <CheckCircle2 size={19} />
              标记完成
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
