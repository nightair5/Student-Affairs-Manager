import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  FileText,
  History,
  Link2,
  Mail,
  MonitorCheck,
  Save,
  X,
} from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { formatDeadline, formatDuration } from '../lib/taskLogic'
import {
  toDateTimeLocalValue,
  type BrowserNotificationPermission,
} from '../lib/notifications'
import type {
  Priority,
  Source,
  Task,
  TaskCategory,
  TaskStatus,
} from '../types'

interface TaskDetailPanelProps {
  task: Task
  sources: Source[]
  onClose: () => void
  onComplete: (taskId: string) => void
  onUpdate: (taskId: string, patch: Partial<Task>) => void
  notificationPermission: BrowserNotificationPermission
  onRequestNotificationPermission: () => Promise<BrowserNotificationPermission>
}

export function TaskDetailPanel({
  task,
  sources,
  onClose,
  onComplete,
  onUpdate,
  notificationPermission,
  onRequestNotificationPermission,
}: TaskDetailPanelProps) {
  const titleId = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task)
  const [notificationFeedback, setNotificationFeedback] = useState('')
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

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    onUpdate(task.id, {
      title: draft.title,
      category: draft.category,
      status: draft.status,
      deadline: draft.deadline,
      estimatedMinutes: draft.estimatedMinutes,
      nextAction: draft.nextAction,
      description: draft.description,
      priority: draft.priority,
    })
    setEditing(false)
  }

  const toggleMaterial = (materialId: string) => {
    onUpdate(task.id, {
      materials: task.materials.map((material) =>
        material.id === materialId
          ? { ...material, done: !material.done }
          : material,
      ),
    })
  }

  const emailReminder = task.reminders.find(
    (reminder) => reminder.channel === 'email',
  )
  const browserReminder = task.reminders.find(
    (reminder) => reminder.channel === 'browser',
  )

  const updateBrowserReminder = (enabled: boolean, scheduledAt?: string) => {
    const defaultTime = new Date(new Date(task.deadline).getTime() - 60 * 60 * 1000)
    const defaultScheduledAt = toDateTimeLocalValue(defaultTime)
    const nextReminder = {
      id: browserReminder?.id ?? `${task.id}-browser-reminder`,
      channel: 'browser' as const,
      scheduledAt: scheduledAt ?? browserReminder?.scheduledAt ?? defaultScheduledAt,
      enabled,
    }
    onUpdate(task.id, {
      reminders: [
        ...task.reminders.filter((reminder) => reminder.channel !== 'browser'),
        nextReminder,
      ],
    })
  }

  const handleBrowserReminderToggle = async (enabled: boolean) => {
    if (!enabled) {
      updateBrowserReminder(false)
      setNotificationFeedback('浏览器提醒已关闭。')
      return
    }
    const permission = notificationPermission === 'granted'
      ? 'granted'
      : await onRequestNotificationPermission()
    if (permission !== 'granted') {
      setNotificationFeedback(
        permission === 'denied'
          ? '通知权限已被拒绝，请在浏览器的网站设置中手动开启。'
          : permission === 'unsupported'
            ? '当前浏览器不支持系统通知。'
            : '需要授权后才能启用浏览器提醒。',
      )
      return
    }
    updateBrowserReminder(true)
    setNotificationFeedback('已启用；提醒仅在本页面保持打开时触发。')
  }

  const updateEmailReminder = (enabled: boolean, scheduledAt?: string) => {
    const nextReminder = {
      id: emailReminder?.id ?? `${task.id}-email-reminder`,
      channel: 'email' as const,
      scheduledAt:
        scheduledAt ??
        emailReminder?.scheduledAt ??
        toDateTimeLocalValue(new Date(task.deadline)),
      enabled,
    }
    onUpdate(task.id, {
      reminders: [
        ...task.reminders.filter((reminder) => reminder.channel !== 'email'),
        nextReminder,
      ],
    })
  }

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
          <div className="detail-header-actions">
            <button
              className={editing ? 'detail-edit-button active' : 'detail-edit-button'}
              type="button"
              onClick={() => setEditing((value) => !value)}
            >
              <Edit3 size={16} />
              {editing ? '取消编辑' : '编辑'}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
              aria-label="关闭任务详情"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="detail-body">
          {editing && (
            <form className="task-edit-form" onSubmit={handleSave}>
              <div className="form-grid">
                <label className="field span-2">
                  <span>任务名称</span>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>分类</span>
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        category: event.target.value as TaskCategory,
                      })
                    }
                  >
                    {['比赛', '保研', '课程', '老师任务', '其他'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>状态</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        status: event.target.value as TaskStatus,
                      })
                    }
                  >
                    {['待开始', '进行中', '已完成'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>截止时间</span>
                  <input
                    type="datetime-local"
                    value={draft.deadline}
                    onChange={(event) =>
                      setDraft({ ...draft, deadline: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>优先级</span>
                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        priority: event.target.value as Priority,
                      })
                    }
                  >
                    {['高', '中', '低'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>预计耗时（分钟）</span>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={draft.estimatedMinutes}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        estimatedMinutes: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field span-2">
                  <span>下一步动作</span>
                  <input
                    value={draft.nextAction}
                    onChange={(event) =>
                      setDraft({ ...draft, nextAction: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field span-2">
                  <span>任务说明</span>
                  <textarea
                    rows={3}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                  />
                </label>
              </div>
              <button className="primary-button wide" type="submit">
                <Save size={17} />
                保存修改并记录历史
              </button>
            </form>
          )}

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
                    <button
                      type="button"
                      onClick={() => toggleMaterial(material.id)}
                      aria-label={`${material.done ? '取消完成' : '标记完成'}材料：${material.name}`}
                    >
                      <CheckCircle2 size={17} />
                      {material.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy">这个任务暂时没有材料要求。</p>
            )}
          </section>

          <section className="detail-section reminder-section">
            <div className="detail-section-title">
              <h3>提醒设置</h3>
              <BellRing size={18} />
            </div>
            <div className="reminder-option">
              <div>
                <span className="reminder-icon">
                  <MonitorCheck size={17} />
                </span>
                <span>
                  <strong>浏览器本地提醒</strong>
                  <small>
                    {notificationPermission === 'granted'
                      ? '已授权；仅当前页面保持打开时真实触发。'
                      : notificationPermission === 'denied'
                        ? '权限已拒绝，请在浏览器网站设置中开启。'
                        : notificationPermission === 'unsupported'
                          ? '当前浏览器不支持系统通知。'
                          : '首次启用会请求浏览器通知权限。'}
                  </small>
                </span>
              </div>
              <label className="switch">
                <span className="sr-only">启用浏览器本地提醒</span>
                <input
                  type="checkbox"
                  checked={browserReminder?.enabled ?? false}
                  disabled={notificationPermission === 'denied' || notificationPermission === 'unsupported'}
                  onChange={(event) => void handleBrowserReminderToggle(event.target.checked)}
                />
                <i />
              </label>
            </div>
            {notificationFeedback && <p className="reminder-feedback" role="status">{notificationFeedback}</p>}
            {browserReminder?.enabled && (
              <label className="field reminder-time">
                <span>
                  <CalendarClock size={15} />
                  浏览器提醒时间
                </span>
                <input
                  type="datetime-local"
                  value={browserReminder.scheduledAt.slice(0, 16)}
                  onChange={(event) => updateBrowserReminder(true, event.target.value)}
                />
              </label>
            )}
            <div className="reminder-option">
              <div>
                <span className="reminder-icon">
                  <Mail size={17} />
                </span>
                <span>
                  <strong>邮件提醒</strong>
                  <small>只保存提醒计划；邮件发送服务尚未接通。</small>
                </span>
              </div>
              <div className="reminder-option-actions">
                <span className="coming-badge">未接通</span>
                <label className="switch">
                  <span className="sr-only">保存邮件提醒计划</span>
                  <input
                    type="checkbox"
                    checked={emailReminder?.enabled ?? false}
                    onChange={(event) => updateEmailReminder(event.target.checked)}
                  />
                  <i />
                </label>
              </div>
            </div>
            {emailReminder?.enabled && (
              <label className="field reminder-time">
                <span>
                  <CalendarClock size={15} />
                  提醒时间
                </span>
                <input
                  type="datetime-local"
                  value={emailReminder.scheduledAt.slice(0, 16)}
                  onChange={(event) =>
                    updateEmailReminder(true, event.target.value)
                  }
                />
              </label>
            )}
            <div className="reminder-option disabled-option">
              <div>
                <span className="reminder-icon">
                  <BellRing size={17} />
                </span>
                <span>
                  <strong>微信提醒</strong>
                  <small>后续通过用户授权渠道接入。</small>
                </span>
              </div>
              <span className="coming-badge">待授权</span>
            </div>
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
                ? `已保存 ${task.history.length} 条可追溯记录`
                : '尚无手动修改，后续编辑会在这里留下记录。'}
            </p>
            {task.history.length > 0 && (
              <ol className="history-list">
                {task.history
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((entry) => (
                    <li key={entry.id}>
                      <i />
                      <span>
                        <strong>{entry.field}</strong>
                        <small>
                          {entry.before ? `${entry.before} → ` : ''}
                          {entry.after}
                        </small>
                        <time>
                          {new Intl.DateTimeFormat('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(entry.changedAt))}
                        </time>
                      </span>
                    </li>
                  ))}
              </ol>
            )}
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
