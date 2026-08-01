import { useEffect, useMemo, useRef, useState } from 'react'
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
import { TasksPage } from './pages/TasksPage'
import { ServicesPage } from './pages/ServicesPage'
import { IndexedDbWorkspaceRepository } from './lib/repository'
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  scheduleBrowserNotifications,
  type BrowserNotificationPermission,
} from './lib/notifications'
import { loadWorkspace } from './lib/storage'
import { updateTaskWithHistory } from './lib/taskUpdates'
import { findDuplicateSources } from './lib/sourceDuplicates'
import {
  buildConfirmedTask,
  createManualMilestone,
  createTaskMilestone,
  createExtractionDraft,
  createIntegrationState,
  createWorkspaceData,
  syncTaskMilestone,
  updateDraftItem,
} from './lib/workspace'
import type { CourseBlock, ExtractionDraft, IntegrationState, PageId, ParsedSuggestion, Project, Source, Task } from './types'

const workspaceRepository = new IndexedDbWorkspaceRepository()

function App() {
  const [initialWorkspace] = useState(() => loadWorkspace(demoTasks, demoSources))
  const [currentPage, setCurrentPage] = useState<PageId>('today')
  const [tasks, setTasks] = useState<Task[]>(initialWorkspace.tasks)
  const [sources, setSources] = useState<Source[]>(initialWorkspace.sources)
  const [drafts, setDrafts] = useState<ExtractionDraft[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [courseBlocks, setCourseBlocks] = useState<CourseBlock[]>([])
  const [integrations, setIntegrations] = useState<IntegrationState>(() => createIntegrationState())
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null)
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission())
  const deliveredNotifications = useRef(new Set<string>())
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? null

  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null
  const selectedDraftSource = selectedDraft
    ? sources.find((source) => source.id === selectedDraft.sourceId) ?? null
    : null
  const workspace = useMemo(
    () => createWorkspaceData(tasks, sources, drafts, projects, courseBlocks, integrations),
    [courseBlocks, drafts, integrations, projects, sources, tasks],
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
          setCourseBlocks(saved.courseBlocks)
          setIntegrations(saved.integrations)
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

  useEffect(() => {
    if (notificationPermission !== 'granted') return
    return scheduleBrowserNotifications(tasks, deliveredNotifications.current, () => {
      setNotice({ text: '浏览器通知发送失败，请检查网站通知权限。' })
    })
  }, [notificationPermission, tasks])

  useEffect(() => {
    const refreshPermission = () => {
      setNotificationPermission(getBrowserNotificationPermission())
    }
    window.addEventListener('focus', refreshPermission)
    document.addEventListener('visibilitychange', refreshPermission)
    return () => {
      window.removeEventListener('focus', refreshPermission)
      document.removeEventListener('visibilitychange', refreshPermission)
    }
  }, [])

  const handleRequestNotificationPermission = async () => {
    const permission = await requestBrowserNotificationPermission()
    setNotificationPermission(permission)
    return permission
  }

  const handleComplete = (taskId: string) => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return
    const nextTask = updateTaskWithHistory(task, { status: '已完成' })
    setTasks((current) => current.map((candidate) => candidate.id === taskId ? nextTask : candidate))
    if (task.projectId) {
      setProjects((current) => current.map((project) => project.id === task.projectId
        ? syncTaskMilestone(project, nextTask)
        : project))
    }
    setSelectedTaskId(null)
  }

  const handleUpdateTask = (taskId: string, patch: Partial<Task>) => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return
    const nextTask = updateTaskWithHistory(task, patch)
    setTasks((current) => current.map((candidate) => candidate.id === taskId ? nextTask : candidate))
    if (task.projectId) {
      setProjects((current) => current.map((project) => project.id === task.projectId
        ? syncTaskMilestone(project, nextTask)
        : project))
    }
  }

  const handleCreateDraft = (source: Source, suggestions: ParsedSuggestion[]) => {
    const duplicateCandidates = findDuplicateSources(source, sources)
    const nextSource: Source = duplicateCandidates.length
      ? {
          ...source,
          duplicateOfSourceIds: duplicateCandidates.map((candidate) => candidate.sourceId),
          duplicateReviewStatus: '待核对',
        }
      : source
    const draft = createExtractionDraft(nextSource.id, suggestions)
    const now = new Date().toISOString()
    const project: Project | null = suggestions[0]
      ? {
          id: `project-${source.id}`,
          title: source.title,
          category: suggestions[0].category,
          sourceIds: [source.id],
          taskIds: [],
          milestones: [],
          createdAt: now,
          updatedAt: now,
        }
      : null
    setSources((current) => [nextSource, ...current])
    setDrafts((current) => [draft, ...current])
    if (project) setProjects((current) => [project, ...current])
    setIntakeOpen(false)
    setCurrentPage('inbox')
    setSelectedDraftId(draft.id)
    if (duplicateCandidates.length) {
      setNotice({ text: `发现 ${duplicateCandidates.length} 个可能重复来源；已保留两份，等待你人工核对。` })
    }
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
      ? {
          ...candidate,
          taskIds: [...candidate.taskIds, task.id],
          milestones: [...candidate.milestones, createTaskMilestone(candidate.id, task)],
          updatedAt: new Date().toISOString(),
        }
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
      ? {
          ...candidate,
          taskIds: [...candidate.taskIds, ...created.map((task) => task.id)],
          milestones: [
            ...candidate.milestones,
            ...created.map((task) => createTaskMilestone(candidate.id, task)),
          ],
          updatedAt: new Date().toISOString(),
        }
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
    setCourseBlocks(imported.courseBlocks)
    setIntegrations(imported.integrations)
    setNotice({ text: '已导入 JSON 备份。' })
  }

  const handleClearWorkspace = () => {
    setTasks([])
    setSources([])
    setDrafts([])
    setProjects([])
    setCourseBlocks([])
    setIntegrations(createIntegrationState())
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
            courseBlocks={courseBlocks}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onAddCourseBlock={(block) => setCourseBlocks((current) => [...current, block])}
            onRemoveCourseBlock={(blockId) => setCourseBlocks((current) => current.filter((block) => block.id !== blockId))}
          />
        )
      case 'library':
        return <LibraryPage sources={sources} onMarkIndependent={(sourceId) => {
          setSources((current) => current.map((source) => source.id === sourceId
            ? { ...source, duplicateReviewStatus: '保留为独立来源' }
            : source))
          setNotice({ text: '已保留为独立来源；系统未合并或删除任何内容。' })
        }} />
      case 'archive':
        return <ArchivePage
          tasks={tasks}
          projects={projects}
          workspace={workspace}
          onImport={handleImportWorkspace}
          onClear={handleClearWorkspace}
          onAddMilestone={(projectId, title, dueAt) => setProjects((current) => current.map((project) => project.id === projectId
            ? { ...project, milestones: [...project.milestones, createManualMilestone(projectId, title, dueAt)], updatedAt: new Date().toISOString() }
            : project))}
          onToggleMilestone={(projectId, milestoneId) => setProjects((current) => current.map((project) => project.id === projectId
            ? {
                ...project,
                milestones: project.milestones.map((milestone) => milestone.id === milestoneId
                  ? { ...milestone, status: milestone.status === '已完成' ? '待完成' : '已完成' }
                  : milestone),
                updatedAt: new Date().toISOString(),
              }
            : project))}
        />
      case 'services':
        return <ServicesPage
          workspace={workspace}
          syncState={integrations.sync}
          webMonitors={integrations.webMonitors}
          onUpdateWebMonitors={(webMonitors) => setIntegrations((current) => ({ ...current, webMonitors }))}
          connectionIntents={integrations.connectionIntents}
          onUpdateConnectionIntents={(connectionIntents) => setIntegrations((current) => ({ ...current, connectionIntents }))}
          onUpdateSyncState={(patch) => setIntegrations((current) => ({
            ...current,
            sync: { ...current.sync, ...patch },
          }))}
          onReplaceWorkspace={(record, endpoint) => {
            const imported = workspaceRepository.importJson(JSON.stringify(record.workspace))
            setTasks(imported.tasks)
            setSources(imported.sources)
            setDrafts(imported.drafts)
            setProjects(imported.projects)
            setCourseBlocks(imported.courseBlocks)
            setIntegrations({
              ...imported.integrations,
              sync: {
                endpoint,
                lastRemoteRevision: record.revision,
                lastSyncedAt: record.updatedAt,
              },
            })
          }}
        />
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
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={handleRequestNotificationPermission}
        />
      )}
    </div>
  )
}

export default App
