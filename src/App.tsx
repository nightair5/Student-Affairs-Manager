import { useEffect, useState } from 'react'
import { IntakePanel } from './components/IntakePanel'
import { Sidebar } from './components/Sidebar'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { demoSources, demoTasks } from './data/demo'
import { ArchivePage } from './pages/ArchivePage'
import { CalendarPage } from './pages/CalendarPage'
import { DashboardPage } from './pages/DashboardPage'
import { LibraryPage } from './pages/LibraryPage'
import { TasksPage } from './pages/TasksPage'
import type { PageId, Source, Task } from './types'

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('today')
  const [tasks, setTasks] = useState<Task[]>(demoTasks)
  const [sources, setSources] = useState<Source[]>(demoSources)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  useEffect(() => {
    const openIntake = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'n' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.target === document.body
      ) {
        setIntakeOpen(true)
      }
    }
    window.addEventListener('keydown', openIntake)
    return () => window.removeEventListener('keydown', openIntake)
  }, [])

  const handleComplete = (taskId: string) => {
    const now = new Date().toISOString()
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: '已完成',
              updatedAt: now,
              history: [
                ...task.history,
                {
                  id: `${taskId}-completed-${Date.now()}`,
                  field: '状态',
                  before: task.status,
                  after: '已完成',
                  changedAt: now,
                  actor: 'user',
                },
              ],
            }
          : task,
      ),
    )
    setSelectedTask(null)
  }

  const handleConfirmIntake = (task: Task, source: Source) => {
    setTasks((current) => [task, ...current])
    setSources((current) => [source, ...current])
    setIntakeOpen(false)
    setCurrentPage('tasks')
    setSelectedTask(task)
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'today':
        return (
          <DashboardPage
            tasks={tasks}
            onOpenIntake={() => setIntakeOpen(true)}
            onOpenTask={setSelectedTask}
            onCompleteTask={handleComplete}
            onShowTasks={() => setCurrentPage('tasks')}
          />
        )
      case 'tasks':
        return (
          <TasksPage
            tasks={tasks}
            onOpenTask={setSelectedTask}
            onCompleteTask={handleComplete}
          />
        )
      case 'calendar':
        return <CalendarPage tasks={tasks} onOpenTask={setSelectedTask} />
      case 'library':
        return <LibraryPage sources={sources} />
      case 'archive':
        return <ArchivePage tasks={tasks} />
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenIntake={() => setIntakeOpen(true)}
      />
      <div className="content-shell">{renderPage()}</div>

      {intakeOpen && (
        <IntakePanel
          onClose={() => setIntakeOpen(false)}
          onConfirm={handleConfirmIntake}
        />
      )}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          sources={sources}
          onClose={() => setSelectedTask(null)}
          onComplete={handleComplete}
        />
      )}
    </div>
  )
}

export default App
