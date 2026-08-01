import { useEffect, useMemo, useState } from 'react'
import { DraftReviewPanel } from './components/DraftReviewPanel'
import { IntakePanel } from './components/IntakePanel'
import { Sidebar } from './components/Sidebar'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { demoSources, demoTasks } from './data/demo'
import { InboxPage } from './pages/InboxPage'
import { ArchivePage } from './pages/ArchivePage'
import { CalendarPage } from './pages/CalendarPage'
import { DashboardPage } from './pages/DashboardPage'
import { LibraryPage } from './pages/LibraryPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { TasksPage } from './pages/TasksPage'
import { IndexedDbWorkspaceRepository } from './lib/repository'
import { loadWorkspace } from './lib/storage'
import { updateTaskWithHistory } from './lib/taskUpdates'
import {
  buildConfirmedTask,
  createExtractionDraft,
  createWorkspaceData,
  updateDraftItem,
} from './lib/workspace'
import type { ExtractionDraft, PageId, ParsedSuggestion, Project, Source, Task } from './types'

const workspaceRepository = new IndexedDbWorkspaceRepository()

function App() {
  const [initialWorkspace] = useState(() => loadWorkspace(demoTasks, demoSources))
  const [currentPage, setCurrentPage] = useState<PageId>('today')
  const [tasks, setTasks] = useState<Task[]>(initialWorkspace.tasks)
  const [sources, setSources] = useState<Source[]>(initialWorkspace.sources)
  const [drafts, setDrafts] = useState<ExtractionDraft[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [localSearchAuthorizedAt, setLocalSearchAuthorizedAt] = useState<string | undefined>()
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null)
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? null

  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null
  const selectedDraftSource = selectedDraft
    ? sources.find((source) => source.id === selectedDraft.sourceId) ?? null
    : null
  const workspace = useMemo(
    () => createWorkspaceData(tasks, sources, drafts, projects, localSearchAuthorizedAt),
    [drafts, localSearchAuthorizedAt, projects, sources, tasks],
  )

  useEffect(() => {
    let active = true
    const hydrate = async () => {
      try {
        const saved = await workspaceRepository.load()
        if (!active) return
        if (saved) {
          setTasks(saved.tasks)
          setSources(saved.sources)
          setDrafts(saved.drafts)
          setProjects(saved.projects)
          setLocalSearchAuthorizedAt(saved.knowledgeSettings.localSearchAuthorizedAt)
        } else {
          await workspaceRepository.save(
            createWorkspaceData(initialWorkspace.tasks, initialWorkspace.sources),
          )
        }
      } catch {
        if (active) setStorageError(true)
      } finally {
        if (active) setWorkspaceReady(true)
      }
    }
    void hydrate()
    return () => {
      active = false
    }
  }, [initialWorkspace.sources, initialWorkspace.tasks])

  useEffect(() => {
    if (!workspaceReady || storageError) return
    void workspaceRepository.save(workspace).catch(() => setStorageError(true))
  }, [storageError, workspace, workspaceReady])

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

  const handleCreateDraft = (source: Source, suggestions: ParsedSuggestion[]) => {
    const draft = createExtractionDraft(source.id, suggestions)
    const now = new Date().toISOString()
    const project: Project | null = suggestions[0]
      ? {
          id: `project-${source.id}`,
          title: source.title,
          category: suggestions[0].category,
          sourceIds: [source.id],
          taskIds: [],
          createdAt: now,
          updatedAt: now,
        }
      : null
    setSources((current) => [source, ...current])
    setDrafts((current) => [draft, ...current])
    if (project) setProjects((current) => [project, ...current])
    setIntakeOpen(false)
    setCurrentPage('inbox')
    setSelectedDraftId(draft.id)
  }

  const handleUpdateDraft = (
    draftId: string,
    itemId: string,
    patch: Partial<ParsedSuggestion>,
    status?: '待确认' | '已确认' | '已拒绝',
  ) => {
    setDrafts((current) => current.map((draft) =>
      draft.id === draftId ? updateDraftItem(draft, itemId, patch, status) : draft,
    ))
  }

  const handleConfirmDraftItem = (draftId: string, itemId: string) => {
    const draft = drafts.find((item) => item.id === draftId)
    const source = draft ? sources.find((item) => item.id === draft.sourceId) : null
    const item = draft?.items.find((candidate) => candidate.id === itemId)
    if (!draft || !source || !item || item.status !== '待确认') return
    const project = projects.find((candidate) => candidate.sourceIds.includes(source.id))
    const baseTask = buildConfirmedTask(item, source)
    const task = project
      ? {
          ...baseTask,
          projectId: project.id,
          materials: baseTask.materials.map((material) => ({ ...material, projectId: project.id })),
        }
      : baseTask
    setTasks((current) => [task, ...current])
    if (project) setProjects((current) => current.map((candidate) => candidate.id === project.id
      ? { ...candidate, taskIds: [...candidate.taskIds, task.id], updatedAt: new Date().toISOString() }
      : candidate))
    handleUpdateDraft(draftId, itemId, {}, '已确认')
    setSources((current) => current.map((candidate) =>
      candidate.id === source.id
        ? {
            ...candidate,
            extractionStatus:
              draft.items.filter((draftItem) => draftItem.status === '待确认').length <= 1
                ? '已确认'
                : '部分确认',
          }
        : candidate,
    ))
    setSelectedTaskId(task.id)
    setNotice({ text: '已创建任务，可在任务中心继续编辑。' })
  }

  const handleConfirmAll = (draftId: string) => {
    const draft = drafts.find((item) => item.id === draftId)
    const source = draft ? sources.find((item) => item.id === draft.sourceId) : null
    if (!draft || !source) return
    const pending = draft.items.filter((item) => item.status === '待确认')
    if (!pending.length) return
    const project = projects.find((candidate) => candidate.sourceIds.includes(source.id))
    const created = pending.map((item) => {
      const baseTask = buildConfirmedTask(item, source)
      return project
        ? {
            ...baseTask,
            projectId: project.id,
            materials: baseTask.materials.map((material) => ({ ...material, projectId: project.id })),
          }
        : baseTask
    })
    setTasks((current) => [...created, ...current])
    if (project) setProjects((current) => current.map((candidate) => candidate.id === project.id
      ? { ...candidate, taskIds: [...candidate.taskIds, ...created.map((task) => task.id)], updatedAt: new Date().toISOString() }
      : candidate))
    setDrafts((current) => current.map((item) => item.id === draftId
      ? {
          ...item,
          status: '已确认',
          updatedAt: new Date().toISOString(),
          items: item.items.map((draftItem) => draftItem.status === '待确认'
            ? { ...draftItem, status: '已确认', updatedAt: new Date().toISOString() }
            : draftItem),
        }
      : item))
    setSources((current) => current.map((item) => item.id === source.id
      ? { ...item, extractionStatus: '已确认' }
      : item))
    setSelectedTaskId(created[0].id)
    setNotice({ text: `已创建 ${created.length} 项任务。` })
  }

  const handleImportWorkspace = (serialized: string) => {
    const imported = workspaceRepository.importJson(serialized)
    setTasks(imported.tasks)
    setSources(imported.sources)
    setDrafts(imported.drafts)
    setProjects(imported.projects)
    setNotice({ text: '已导入 JSON 备份。' })
  }

  const handleClearWorkspace = () => {
    setTasks([])
    setSources([])
    setDrafts([])
    setProjects([])
    void workspaceRepository.clear()
    setNotice({ text: '已清空本机工作区。' })
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
      case 'inbox':
        return <InboxPage drafts={drafts} sources={sources} onOpenDraft={setSelectedDraftId} />
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
        return <ArchivePage tasks={tasks} projects={projects} workspace={workspace} onImport={handleImportWorkspace} onClear={handleClearWorkspace} />
      case 'knowledge':
        return <KnowledgePage tasks={tasks} sources={sources} projects={projects} localSearchAuthorizedAt={localSearchAuthorizedAt} onSaveLocalAuthorization={() => setLocalSearchAuthorizedAt(new Date().toISOString())} />
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

      {!workspaceReady && <div className="workspace-status" role="status">正在恢复本机工作区…</div>}
      {storageError && <div className="workspace-status error" role="alert">本机数据库暂不可用；本次更改可能无法在刷新后保留。</div>}
      {notice && <div className="app-toast" role="status"><span>{notice.text}</span>{notice.undo && <button type="button" onClick={() => { notice.undo?.(); setNotice(null) }}>撤销</button>}<button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button></div>}

      {intakeOpen && (
        <IntakePanel
          onClose={() => setIntakeOpen(false)}
          onCreateDraft={handleCreateDraft}
        />
      )}
      {selectedDraft && (
        <DraftReviewPanel
          draft={selectedDraft}
          source={selectedDraftSource}
          onClose={() => setSelectedDraftId(null)}
          onUpdate={(itemId, patch) => handleUpdateDraft(selectedDraft.id, itemId, patch)}
          onConfirm={(itemId) => handleConfirmDraftItem(selectedDraft.id, itemId)}
          onReject={(itemId) => {
            handleUpdateDraft(selectedDraft.id, itemId, {}, '已拒绝')
            setNotice({ text: '已拒绝该建议，不会创建任务。', undo: () => handleUpdateDraft(selectedDraft.id, itemId, {}, '待确认') })
          }}
          onConfirmAll={() => handleConfirmAll(selectedDraft.id)}
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
