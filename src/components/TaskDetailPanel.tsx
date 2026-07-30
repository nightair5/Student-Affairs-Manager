import {
  BellRing,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Link2,
  X,
} from 'lucide-react'
import { useEffect, useId } from 'react'
import { formatDeadline, formatDuration } from '../lib/taskLogic'
import type { Source, Task } from '../types'

interface TaskDetailPanelProps {
  task: Task
  sources: Source[]
  onClose: () => void
  onComplete: (taskId: string) => void
}

export function TaskDetailPanel({
  task,
  sources,
  onClose,
  onComplete,
}: TaskDetailPanelProps) {
  const titleId = useId()
  const linkedSources = sources.filter((source) =>
    task.sourceIds.includes(source.id),
  )

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop detail-backdrop" role="presentation">
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="detail-header">
          <div>
            <span className="category-label">{task.category}</span>
            <h2 id={titleId}>{task.title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭任务详情"
          >
            <X size={20} />
          </button>
        </header>

        <div className="detail-body">
          <div className="detail-summary">
            <div>
              <Clock3 size={18} />
              <span>
                <small>截止时间</small>
                <strong>{formatDeadline(task.deadline)}</strong>
              </span>
            </div>
            <div>
              <BellRing size={18} />
              <span>
                <small>预计耗时</small>
                <strong>{formatDuration(task.estimatedMinutes)}</strong>
              </span>
            </div>
          </div>

          <section className="detail-section next-step-section">
            <span>下一步动作</span>
            <h3>{task.nextAction}</h3>
            <p>{task.description}</p>
          </section>

          <section className="detail-section">
            <div className="detail-section-title">
              <h3>材料清单</h3>
              <small>
                {task.materials.filter((item) => item.done).length}/
                {task.materials.length}
              </small>
            </div>
            {task.materials.length ? (
              <ul className="material-list">
                {task.materials.map((material) => (
                  <li key={material.id} className={material.done ? 'done' : ''}>
                    <CheckCircle2 size={17} />
                    {material.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy">这个任务暂时没有材料要求。</p>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-title">
              <h3>来源依据</h3>
              <FileText size={18} />
            </div>
            {linkedSources.length ? (
              linkedSources.map((source) => (
                <div className="source-evidence" key={source.id}>
                  <span>
                    <Link2 size={15} />
                    {source.title}
                  </span>
                  <p>{source.contentPreview}</p>
                </div>
              ))
            ) : (
              <p className="muted-copy">这是手动创建的任务，没有关联来源。</p>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-title">
              <h3>修改记录</h3>
              <History size={18} />
            </div>
            <p className="muted-copy">
              {task.history.length
                ? `${task.history.length} 条记录已保存`
                : '尚无手动修改，后续编辑会在这里留下记录。'}
            </p>
          </section>
        </div>

        {task.status !== '已完成' && (
          <footer className="detail-footer">
            <button
              className="primary-button wide"
              type="button"
              onClick={() => onComplete(task.id)}
            >
              <CheckCircle2 size={17} />
              标记为已完成
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}
