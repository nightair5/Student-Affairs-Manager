import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Plus,
  Sparkles,
} from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { getFocusTasks } from '../lib/taskLogic'
import type { Task } from '../types'

interface DashboardPageProps {
  tasks: Task[]
  onOpenIntake: () => void
  onOpenTask: (task: Task) => void
  onCompleteTask: (taskId: string) => void
  onShowTasks: () => void
}

export function DashboardPage({
  tasks,
  onOpenIntake,
  onOpenTask,
  onCompleteTask,
  onShowTasks,
}: DashboardPageProps) {
  const focusTasks = getFocusTasks(tasks)
  const riskCount = tasks.filter(
    (task) => task.status !== '已完成' && task.riskFlags.length,
  ).length

  return (
    <main className="page dashboard-page">
      <header className="page-header dashboard-header">
        <div>
          <span className="date-line">2026 年 7 月 31 日 · 星期五</span>
          <h1>
            今天先把这
            <em>{focusTasks.length}</em>
            件事推进
          </h1>
          <p>已经按截止时间、材料和依赖整理好顺序，最终决定仍由你掌握。</p>
        </div>
        <button className="primary-button" type="button" onClick={onOpenIntake}>
          <Plus size={18} />
          录入新事项
        </button>
      </header>

      <section className="focus-section" aria-labelledby="focus-title">
        <div className="section-heading">
          <div>
            <span className="section-index">01</span>
            <h2 id="focus-title">现在最值得做</h2>
          </div>
          <button className="text-button" type="button" onClick={onShowTasks}>
            查看全部任务
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="focus-grid">
          {focusTasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              featured={index === 0}
              onOpen={onOpenTask}
              onComplete={onCompleteTask}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-lower-grid">
        <div className="week-card">
          <div className="section-heading compact">
            <div>
              <span className="section-index">02</span>
              <h2>这一周的节奏</h2>
            </div>
            <CalendarClock size={20} />
          </div>
          <div className="week-strip">
            {[
              { day: '五', date: '31', count: 0 },
              { day: '六', date: '01', count: 1 },
              { day: '日', date: '02', count: 1, active: true },
              { day: '一', date: '03', count: 0 },
              { day: '二', date: '04', count: 1 },
              { day: '三', date: '05', count: 0 },
              { day: '四', date: '06', count: 0 },
            ].map((item) => (
              <div
                className={`week-day${item.active ? ' active' : ''}`}
                key={`${item.day}-${item.date}`}
              >
                <span>{item.day}</span>
                <strong>{item.date}</strong>
                {item.count > 0 ? <i>{item.count} 项</i> : <i>—</i>}
              </div>
            ))}
          </div>
          <div className="start-suggestion">
            <Sparkles size={18} />
            <p>
              <strong>开工建议</strong>
              周六上午留出 90 分钟写报告框架，避开周日晚截止前的集中压力。
            </p>
          </div>
        </div>

        <aside className="status-card">
          <div className="status-card-head">
            <span>事务健康度</span>
            <strong>需要留意</strong>
          </div>
          <div className="status-ring" aria-label={`${riskCount} 项任务有风险`}>
            <span>{riskCount}</span>
            <small>项有风险</small>
          </div>
          <ul>
            <li>
              <CircleAlert size={16} />
              2 项材料尚未准备
            </li>
            <li>
              <CheckCircle2 size={16} />
              本周暂无逾期任务
            </li>
          </ul>
        </aside>
      </section>
    </main>
  )
}
