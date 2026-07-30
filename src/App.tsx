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
import { loadSources, loadTasks, saveSources, saveTasks } from './lib/storage'
import { updateTaskWithHistory } from './lib/taskUpdates'
import type { PageId, Source, Task } from './types'

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('today')
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks(demoTasks))
  const [sources, setSources] = useState<Source[]>(() =>
    loadSources(demoSources),
  )
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? null

  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  useEffect(() => {
    saveSources(sources)
  }, [sources])

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
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? updateTaskWithHistory(task, { status: '已完成' })
          : task,
      ),
    )
    setSelectedTaskId(null)
  }

  const handleUpdateTask = (taskId: string, patch: Partial<Task>) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? updateTaskWithHistory(task, patch) : task,
      ),
    )
  }

  const handleConfirmIntake = (task: Task, source: Source) => {
    setTasks((current) => [task, ...current])
    setSources((current) => [source, ...current])
    setIntakeOpen(false)
    setCurrentPage('tasks')
    setSelectedTaskId(task.id)
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'today':
        return (
          <DashboardPage
            tasks={tasks}
            onOpenIntake={() => setIntakeOpen(true)}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onCompleteTask={handleComplete}
            onShowTasks={() => setCurrentPage('tasks')}
          />
        )
      case 'tasks':
        return (
          <TasksPage
            tasks={tasks}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onCompleteTask={handleComplete}
          />
        )
      case 'calendar':
        return (
          <CalendarPage
            tasks={tasks}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
          />
        )
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
          key={selectedTask.id}
          task={selectedTask}
          sources={sources}
          onClose={() => setSelectedTaskId(null)}
          onComplete={handleComplete}
          onUpdate={handleUpdateTask}
        />
      )}
    </div>
  )
}

export default App
