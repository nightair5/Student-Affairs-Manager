import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { DraftReviewPanel } from './components/DraftReviewPanel'
import { IntakePanel } from './components/IntakePanel'
import { OnboardingGuide } from './components/OnboardingGuide'
import { Sidebar } from './components/Sidebar'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { demoSources, demoTasks } from './data/demo'
import { InboxPage } from './pages/InboxPage'
import { DashboardPage } from './pages/DashboardPage'
import { TasksPage } from './pages/TasksPage'
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
import { createIntakeResult, type IntakeInput } from './lib/intake'
import { ProxyDeepSeekExtractionService } from './lib/deepseekExtraction'
import { markOnboardingComplete, shouldShowOnboarding } from './lib/onboarding'
import {
  buildConfirmedProjectBatch,
  createManualMilestone,
  createExtractionDraft,
  createIntegrationState,
  createWorkspaceData,
  syncTaskMilestone,
  updateDraftItem,
} from './lib/workspace'
import type { CourseBlock, ExtractionDraft, IntegrationState, KnowledgeSettings, PageId, ParsedSuggestion, Project, Source, Task } from './types'

const workspaceRepository = new IndexedDbWorkspaceRepository()
const deepSeekExtractionService = new ProxyDeepSeekExtractionService()

const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const ArchivePage = lazy(() => import('./pages/ArchivePage').then((module) => ({ default: module.ArchivePage })))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage').then((module) => ({ default: module.KnowledgePage })))
const ServicesPage = lazy(() => import('./pages/ServicesPage').then((module) => ({ default: module.ServicesPage })))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })))

function App() {
  const [initialWorkspace] = useState(() => loadWorkspace(demoTasks, demoSources))
  const [currentPage, setCurrentPage] = useState<PageId>('today')
  const [tasks, setTasks] = useState<Task[]>(initialWorkspace.tasks)
  const [sources, setSources] = useState<Source[]>(initialWorkspace.sources)
  const [drafts, setDrafts] = useState<ExtractionDraft[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [courseBlocks, setCourseBlocks] = useState<CourseBlock[]>([])
  const [integrations, setIntegrations] = useState<IntegrationState>(() => createIntegrationState())
  const [knowledgeSettings, setKnowledgeSettings] = useState<KnowledgeSettings>({})
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(() => shouldShowOnboarding())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null)
  const [smartExtractionStatus, setSmartExtractionStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking')
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission())
  const deliveredNotifications = useRef(new Set<string>())
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? null

  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null
  const pendingReviewCount = drafts.reduce(
    (count, draft) => count + draft.items.filter((item) => item.status === '待确认').length,
    0,
  )
  const selectedDraftSource = selectedDraft
    ? sources.find((source) => source.id === selectedDraft.sourceId) ?? null
    : null
  const workspace = useMemo(
    () => createWorkspaceData(tasks, sources, drafts, projects, courseBlocks, integrations, knowledgeSettings),
    [courseBlocks, drafts, integrations, knowledgeSettings, projects, sources, tasks],
  )

  useEffect(() => {
    let active = true
    void deepSeekExtractionService.status().then((status) => {
      if (active) setSmartExtractionStatus(status.configured ? 'connected' : 'unavailable')
    })
    return () => { active = false }
  }, [])

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
          setKnowledgeSettings(saved.knowledgeSettings)
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
    setNotice({
      text: '任务已完成。',
      undo: () => {
        const undoAt = new Date().toISOString()
        setTasks((current) => current.map((candidate) => candidate.id === taskId
          ? updateTaskWithHistory(candidate, { status: task.status }, undoAt)
          : candidate))
        if (task.projectId) {
          setProjects((current) => current.map((project) => project.id === task.projectId
            ? syncTaskMilestone(project, { ...nextTask, status: task.status, updatedAt: undoAt })
            : project))
        }
      },
    })
  }

  const handleStart = (taskId: string) => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task || task.status !== '待开始') return
    handleUpdateTask(taskId, { status: '进行中' })
    setNotice({ text: '已开始任务，首页会优先帮助你收尾。' })
  }

  const handleSnooze = (taskId: string) => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return
    const nextMorning = new Date()
    nextMorning.setDate(nextMorning.getDate() + 1)
    nextMorning.setHours(9, 0, 0, 0)
    handleUpdateTask(taskId, { snoozedUntil: nextMorning.toISOString() })
    setNotice({
      text: '已稍后到明天 09:00；到时会重新参与首页排序。',
      undo: () => handleUpdateTask(taskId, { snoozedUntil: task.snoozedUntil }),
    })
  }

  const handleTogglePin = (taskId: string) => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return
    const now = new Date()
    const pinned = task.pinnedUntil && new Date(task.pinnedUntil).getTime() > now.getTime()
    const pinnedUntil = pinned
      ? undefined
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    handleUpdateTask(taskId, { pinnedUntil })
    setNotice({ text: pinned ? '已取消置顶。' : '已置顶 7 天；你可以随时取消。' })
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

  const openDraftReview = (draftId: string, message: string) => {
    setIntakeOpen(false)
    setCurrentPage('inbox')
    setSelectedDraftId(draftId)
    setNotice({ text: message })
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
    setSources((current) => [nextSource, ...current])
    setDrafts((current) => [draft, ...current])
    return { draft, source: nextSource, duplicateCount: duplicateCandidates.length }
  }

  const handleIntakeInput = async (input: IntakeInput) => {
    const localResult = createIntakeResult(input)
    const provisional = handleCreateDraft(localResult.source, localResult.suggestions)
    if (input.manualSuggestion) {
      openDraftReview(provisional.draft.id, '手动任务已保存为待确认草稿；核对后再加入任务中心。')
      return
    }
    if (input.sourceType === 'link') {
      openDraftReview(provisional.draft.id, '网页正文尚未抓取，已保存链接并生成可编辑的本地建议。')
      return
    }
    try {
      const suggestions = await deepSeekExtractionService.extract(input)
      const aiDraft = {
        ...createExtractionDraft(provisional.source.id, suggestions, provisional.draft.createdAt),
        id: provisional.draft.id,
      }
      setDrafts((current) => current.map((draft) => draft.id === provisional.draft.id ? aiDraft : draft))
      setSources((current) => current.map((source) => source.id === provisional.source.id
        ? { ...source, extractionMethod: 'deepseek-v4-flash' }
        : source))
      setSmartExtractionStatus('connected')
      openDraftReview(
        provisional.draft.id,
        provisional.duplicateCount
          ? `DeepSeek 已整理；另发现 ${provisional.duplicateCount} 个可能重复来源，请人工核对。`
          : 'DeepSeek V4 Flash 已生成可编辑建议；请逐项核对后再确认。',
      )
    } catch (error) {
      setSmartExtractionStatus('unavailable')
      const reason = error instanceof Error ? error.message : 'DeepSeek 智能整理暂时不可用'
      openDraftReview(
        provisional.draft.id,
        provisional.duplicateCount
          ? `${reason}，已使用本地规则；另发现 ${provisional.duplicateCount} 个可能重复来源。`
          : `${reason}，已使用本地规则建议，请重点核对。`,
      )
    }
  }

  const handleQuickCapture = async (content: string) => {
    await handleIntakeInput({ sourceType: 'text', content })
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
    const existingProject = projects.find((candidate) => candidate.sourceIds.includes(source.id))
    const { tasks: [task], project } = buildConfirmedProjectBatch([item], source, existingProject)
    setTasks((current) => [task, ...current])
    setProjects((current) => existingProject
      ? current.map((candidate) => candidate.id === project.id ? project : candidate)
      : [project, ...current])
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
    setNotice({ text: '已创建任务，可在任务中心继续编辑。' })
    if (draft.items.filter((draftItem) => draftItem.status === '待确认').length <= 1) {
      setSelectedDraftId(null)
      setCurrentPage('today')
    }
  }

  const handleConfirmAll = (draftId: string) => {
    const draft = drafts.find((item) => item.id === draftId)
    const source = draft ? sources.find((item) => item.id === draft.sourceId) : null
    if (!draft || !source) return
    const pending = draft.items.filter((item) => item.status === '待确认')
    if (!pending.length) return
    const existingProject = projects.find((candidate) => candidate.sourceIds.includes(source.id))
    const { tasks: created, project } = buildConfirmedProjectBatch(pending, source, existingProject)
    setTasks((current) => [...created, ...current])
    setProjects((current) => existingProject
      ? current.map((candidate) => candidate.id === project.id ? project : candidate)
      : [project, ...current])
    const confirmedAt = new Date().toISOString()
    setDrafts((current) => current.map((candidate) => {
      if (candidate.id !== draftId) return candidate
      return pending.reduce(
        (nextDraft, draftItem) => updateDraftItem(nextDraft, draftItem.id, {}, '已确认', confirmedAt),
        candidate,
      )
    }))
    setSources((current) => current.map((item) => item.id === source.id
      ? { ...item, extractionStatus: '已确认' }
      : item))
    setSelectedDraftId(null)
    setCurrentPage('today')
    setNotice({ text: `已创建 ${created.length} 项任务。` })
  }

  const handleArchiveDrafts = (draftIds: string[]) => {
    const archivedDrafts = drafts.filter((draft) => draftIds.includes(draft.id))
    const sourceIds = archivedDrafts.map((draft) => draft.sourceId)
    const archivedSources = sources.filter((source) => sourceIds.includes(source.id))
    setDrafts((current) => current.map((draft) => draftIds.includes(draft.id)
      ? { ...draft, workflowStatus: 'archived', updatedAt: new Date().toISOString() }
      : draft))
    setSources((current) => current.map((source) => sourceIds.includes(source.id)
      ? { ...source, status: 'archived', extractionStatus: '已拒绝', updatedAt: new Date().toISOString() }
      : source))
    setNotice({
      text: `已归档 ${draftIds.length} 份草稿，没有删除来源。`,
      undo: () => {
        setDrafts((current) => current.map((draft) => archivedDrafts.find((item) => item.id === draft.id) ?? draft))
        setSources((current) => current.map((source) => archivedSources.find((item) => item.id === source.id) ?? source))
      },
    })
  }

  const handleImportWorkspace = (serialized: string) => {
    const imported = workspaceRepository.importJson(serialized)
    setTasks(imported.tasks)
    setSources(imported.sources)
    setDrafts(imported.drafts)
    setProjects(imported.projects)
    setCourseBlocks(imported.courseBlocks)
    setIntegrations(imported.integrations)
    setKnowledgeSettings(imported.knowledgeSettings)
    setNotice({ text: '已导入 JSON 备份。' })
  }

  const handleClearWorkspace = () => {
    setTasks([])
    setSources([])
    setDrafts([])
    setProjects([])
    setCourseBlocks([])
    setIntegrations(createIntegrationState())
    setKnowledgeSettings({})
    void workspaceRepository.clear()
    setNotice({ text: '已清空本机工作区。' })
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'today':
        return (
          <DashboardPage
            tasks={tasks}
            projects={projects}
            pendingReviewCount={pendingReviewCount}
            onQuickCapture={handleQuickCapture}
            onOpenIntake={() => setIntakeOpen(true)}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onCompleteTask={handleComplete}
            onStartTask={handleStart}
            onSnoozeTask={handleSnooze}
            onTogglePinTask={handleTogglePin}
            onShowTasks={() => setCurrentPage('tasks')}
            onShowInbox={() => setCurrentPage('inbox')}
            smartExtractionStatus={smartExtractionStatus}
          />
        )
      case 'inbox':
        return <InboxPage
          drafts={drafts}
          sources={sources}
          onOpenDraft={setSelectedDraftId}
          onConfirmDrafts={(draftIds) => draftIds.forEach(handleConfirmAll)}
          onArchiveDrafts={handleArchiveDrafts}
          onOpenManual={() => setIntakeOpen(true)}
        />
      case 'tasks':
        return (
          <TasksPage
            tasks={tasks}
            projects={projects}
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
      case 'knowledge':
        return <KnowledgePage
          tasks={tasks}
          sources={sources}
          projects={projects}
          localSearchAuthorizedAt={knowledgeSettings.localSearchAuthorizedAt}
          onSaveLocalAuthorization={() => setKnowledgeSettings({ localSearchAuthorizedAt: new Date().toISOString() })}
          onClearLocalAuthorization={() => {
            setKnowledgeSettings({})
            setNotice({ text: '已撤销本地检索授权。' })
          }}
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
            setKnowledgeSettings(imported.knowledgeSettings)
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
      case 'privacy':
        return <PrivacyPage workspace={workspace} onOpenArchive={() => setCurrentPage('archive')} />
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar
        currentPage={currentPage}
        pendingReviewCount={pendingReviewCount}
        onNavigate={setCurrentPage}
        onOpenIntake={() => setIntakeOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
      />
      <div id="main-content" className="content-shell" tabIndex={-1}><Suspense fallback={<main className="page page-loading" role="status">正在打开页面…</main>}>{renderPage()}</Suspense></div>

      {!workspaceReady && <div className="workspace-status" role="status">正在恢复本机工作区…</div>}
      {storageError && <div className="workspace-status error" role="alert">本机数据库暂不可用；本次更改可能无法在刷新后保留。</div>}
      {notice && <div className="app-toast" role="status"><span>{notice.text}</span>{notice.undo && <button type="button" onClick={() => { notice.undo?.(); setNotice(null) }}>撤销</button>}<button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button></div>}

      {intakeOpen && (
        <IntakePanel
          onClose={() => setIntakeOpen(false)}
          onSubmitIntake={handleIntakeInput}
          smartExtractionStatus={smartExtractionStatus}
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
          projectWillCreate={!projects.some((project) => project.sourceIds.includes(selectedDraft.sourceId))}
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
      {guideOpen && <OnboardingGuide onClose={() => {
        markOnboardingComplete()
        setGuideOpen(false)
      }} />}
    </div>
  )
}

export default App
