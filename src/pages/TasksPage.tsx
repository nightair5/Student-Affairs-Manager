import type { TaskDateViews } from '../experiments/mainline02/taskDateView'
import { CheckCircle2, Filter, ListTodo, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TaskCard } from '../components/TaskCard'
import type { Project, Task, TaskCategory, TaskStatus } from '../types'

interface TasksPageProps {
  dateViews?: TaskDateViews
  readOnly?: boolean
  tasks: Task[]
  projects: Project[]
  onOpenTask: (task: Task) => void
  onCompleteTask: (taskId: string) => void
}

type FilterValue = '全部' | TaskCategory | TaskStatus

export function TasksPage({
  dateViews, readOnly,
  tasks,
  projects,
  onOpenTask,
  onCompleteTask,
}: TasksPageProps) {
  const [filter, setFilter] = useState<FilterValue>('全部')
  const [query, setQuery] = useState('')

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesFilter =
          filter === '全部' ||
          task.category === filter ||
          task.status === filter
        const matchesQuery = `${task.title}${task.nextAction}`
          .toLowerCase()
          .includes(query.toLowerCase())
        return matchesFilter && matchesQuery
      }),
    [filter, query, tasks],
  )

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">统一任务中心</span>
          <h1>所有事项，按同一套节奏推进</h1>
          <p>无论来自文件、消息还是网页，确认后都在这里管理。</p>
        </div>
        <div className="header-stat">
          <ListTodo size={20} />
          <span>
            <strong>{tasks.filter((task) => task.status !== '已完成').length}</strong>
            项待推进
          </span>
        </div>
      </header>

      <div className="toolbar">
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">搜索任务</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索任务或下一步动作"
          />
        </label>
        <div className="filter-group" aria-label="筛选任务">
          <Filter size={16} />
          {(['全部', '比赛', '保研', '课程', '老师任务', '已完成'] as FilterValue[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'active' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>
      </div>

      {filteredTasks.length ? (
        <div className="task-list-grid">
          {filteredTasks.map((task) => (
            <TaskCard dateView={dateViews?.[task.id]} readOnly={readOnly}
              key={task.id}
              task={task}
              allTasks={tasks}
              projectTitle={projects.find((project) => project.id === task.projectId)?.title}
              onOpen={onOpenTask}
              onComplete={
                task.status === '已完成' ? undefined : onCompleteTask
              }
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <CheckCircle2 size={34} />
          <h2>这里暂时没有任务</h2>
          <p>换一个筛选条件，或录入一条新通知。</p>
        </div>
      )}
    </main>
  )
}
