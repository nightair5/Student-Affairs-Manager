import { ArrowRight, ClipboardPaste, Inbox, Plus, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { TaskCard } from '../components/TaskCard'
import { getFocusTasks } from '../lib/taskLogic'
import type { Task } from '../types'

interface DashboardPageProps {
  tasks: Task[]
  pendingReviewCount: number
  onQuickCapture: (content: string) => void
  onOpenIntake: () => void
  onOpenTask: (task: Task) => void
  onCompleteTask: (taskId: string) => void
  onShowTasks: () => void
  onShowInbox: () => void
}

function todayLabel(): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date())
}

export function DashboardPage({
  tasks,
  pendingReviewCount,
  onQuickCapture,
  onOpenIntake,
  onOpenTask,
  onCompleteTask,
  onShowTasks,
  onShowInbox,
}: DashboardPageProps) {
  const [quickText, setQuickText] = useState('')
  const focusTasks = getFocusTasks(tasks)
  const activeCount = tasks.filter((task) => task.status !== '已完成').length

  const submitQuickCapture = (event: FormEvent) => {
    event.preventDefault()
    const content = quickText.trim()
    if (!content) return
    onQuickCapture(content)
    setQuickText('')
  }

  return (
    <main className="page dashboard-page">
      <header className="simple-dashboard-header">
        <div>
          <span className="date-line">{todayLabel()}</span>
          <h1>{focusTasks.length ? <>今天只看最重要的 <em>{focusTasks.length}</em> 件事</> : '先把新通知变成清楚的下一步'}</h1>
          <p>不用管理所有事情。先处理首页，再去任务中心查看其余内容。</p>
        </div>
      </header>

      <form className="quick-capture" onSubmit={submitQuickCapture}>
        <div className="quick-capture-heading">
          <span className="quick-capture-icon"><ClipboardPaste size={20} /></span>
          <div><strong>收到新通知？直接粘贴</strong><small>日期、事项和材料会先拆成待确认建议。</small></div>
        </div>
        <textarea value={quickText} onChange={(event) => setQuickText(event.target.value)} rows={3} placeholder="粘贴老师消息、群通知或网页正文……" aria-label="快速粘贴通知" />
        <div className="quick-capture-actions">
          <button className="text-button" type="button" onClick={onOpenIntake}><Upload size={15} />上传文件或链接</button>
          <button className="primary-button" type="submit" disabled={!quickText.trim()}><Plus size={16} />帮我拆成任务</button>
        </div>
      </form>

      {pendingReviewCount > 0 && <button className="pending-review-banner" type="button" onClick={onShowInbox}>
        <Inbox size={18} />
        <span><strong>还有 {pendingReviewCount} 项建议等你确认</strong><small>关闭页面也不会丢失，可以稍后处理。</small></span>
        <ArrowRight size={17} />
      </button>}

      <section className="focus-section" aria-labelledby="focus-title">
        <div className="section-heading">
          <div><span className="section-index">TODAY</span><h2 id="focus-title">现在先做这些</h2></div>
          <button className="text-button" type="button" onClick={onShowTasks}>全部 {activeCount} 项<ArrowRight size={16} /></button>
        </div>
        {focusTasks.length
          ? <div className="focus-grid">{focusTasks.map((task, index) => <TaskCard key={task.id} task={task} featured={index === 0} onOpen={onOpenTask} onComplete={onCompleteTask} />)}</div>
          : <div className="home-empty-state"><strong>今天还没有任务</strong><p>把一段通知粘贴到上方，确认后就会出现在这里。</p></div>}
      </section>
    </main>
  )
}
