import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DraftReviewPanel } from './components/DraftReviewPanel'
import { IntakePanel } from './components/IntakePanel'
import { OnboardingGuide } from './components/OnboardingGuide'
import { PageLoadBoundary } from './components/PageLoadBoundary'
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
import { createIntakeResult, type IntakeInput } from './lib/intake'
import { ProxyDeepSeekExtractionService } from './lib/deepseekExtraction'
import { buildLocalRecognition } from './recognition/pipeline'
import { RECOGNITION_PIPELINE_VERSION } from './recognition/modelGateway'
import { markOnboardingComplete, shouldShowOnboarding } from './lib/onboarding'
import { CapturePersistenceService } from './domain/v2/capture'
import { CanonicalWorkspaceRepository } from './domain/v2/repository'
import { buildDomainCommitPlan, commitDomainPlan, selectionFromDraftItems } from './domain/v2/domainCommit'
import {
  createManualMilestone,
  createIntegrationState,
  createWorkspaceData,
  syncTaskMilestone,
  updateDraftItem,
} from './lib/workspace'
import type { CourseBlock, Event, ExtractionDraft, IntegrationState, KnowledgeSettings, MigrationRecord, PageId, ParsedSuggestion, Project, RecognitionFeedbackRecord, Source, Task, WorkPackage, WorkspaceData } from './types'

const canonicalWorkspaceRepository = new CanonicalWorkspaceRepository()
const workspaceRepository = new IndexedDbWorkspaceRepository(canonicalWorkspaceRepository)
const capturePersistenceService = new CapturePersistenceService(canonicalWorkspaceRepository)
const deepSeekExtractionService = new ProxyDeepSeekExtractionService()

const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const ArchivePage = lazy(() => import('./pages/ArchivePage').then((module) => ({ default: module.ArchivePage })))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage').then((module) => ({ default: module.KnowledgePage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
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
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [migrationLog, setMigrationLog] = useState<MigrationRecord[]>([])
  const [recognitionFeedback, setRecognitionFeedback] = useState<RecognitionFeedbackRecord[]>([])
  const [legacyData, setLegacyData] = useState<Record<string, unknown>>({})
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
    () => createWorkspaceData(tasks, sources, drafts, projects, courseBlocks, integrations, knowledgeSettings, workPackages, events, migrationLog, recognitionFeedback, legacyData),
    [courseBlocks, drafts, events, integrations, knowledgeSettings, legacyData, migrationLog, projects, recognitionFeedback, sources, tasks, workPackages],
  )

  const applyWorkspaceView = useCallback((saved: WorkspaceData) => {
    setTasks(saved.tasks)
    setSources(saved.sources)
    setDrafts(saved.drafts)
    setProjects(saved.projects)
    setCourseBlocks(saved.courseBlocks)
    setIntegrations(saved.integrations)
    setKnowledgeSettings(saved.knowledgeSettings)
    setWorkPackages(saved.workPackages)
    setEvents(saved.events)
    setMigrationLog(saved.migrationLog)
    setRecognitionFeedback(saved.recognitionFeedback)
    setLegacyData(saved.legacyData)
  }, [])

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
          applyWorkspaceView(saved)
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
  }, [applyWorkspaceView, initialWorkspace.sources, initialWorkspace.tasks])

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

  const handleIntakeInput = async (input: IntakeInput) => {
    const localResult = createIntakeResult(input)
    const localRecognition = buildLocalRecognition({
      sourceType: input.sourceType,
      sourceTitle: input.sourceTitle ?? input.fileName ?? localResult.source.title,
      content: input.content,
      referenceTime: input.now ?? new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      projects,
      tasks,
    })
    const captureRequest = {
      operationId: crypto.randomUUID(),
      sourceType: input.sourceType,
      title: input.sourceTitle ?? input.fileName ?? localResult.source.title,
      rawText: input.content,
      provider: input.manualSuggestion ? 'manual' as const : 'deepseek' as const,
      modelName: input.manualSuggestion ? 'manual-entry' : 'deepseek-v4-flash',
      promptVersion: input.manualSuggestion ? null : localRecognition.promptVersion,
      pipelineVersion: `${RECOGNITION_PIPELINE_VERSION}|validator=recognition-quality-2.0.0|repair=recognition-repair-1.0.0|router=recognition-router-1.0.0`,
      sourceLegacyData: {
        contentPreview: localResult.source.contentPreview,
        url: input.url ?? null,
        originalFileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? null,
        parserVersion: localResult.source.parserVersion ?? null,
      },
      now: input.now?.toISOString(),
    }
    try {
      const handle = await capturePersistenceService.beginCapture(captureRequest)
      const recognitionResult = await capturePersistenceService.recognize(
        handle,
        input.manualSuggestion
          ? async () => localRecognition
          : async () => deepSeekExtractionService.recognize(input, { projects, tasks }),
      )
      const saved = await workspaceRepository.load()
      if (saved) applyWorkspaceView(saved)
      setSmartExtractionStatus('connected')
      openDraftReview(
        handle.draftId,
        input.manualSuggestion
          ? '手动录入已先保存来源，再生成待确认草稿；核对后才会创建正式任务。'
          : `${recognitionResult.modelName} 已生成可编辑建议；来源已在请求前安全保存。`,
      )
    } catch (error) {
      setSmartExtractionStatus('unavailable')
      const reason = error instanceof Error ? error.message : 'DeepSeek 智能整理暂时不可用'
      try {
        const canonical = await canonicalWorkspaceRepository.load()
        const failedSource = canonical?.sources.find((source) => source.legacyData?.captureOperationId === captureRequest.operationId)
        if (!failedSource) throw new Error('CAPTURE_SOURCE_NOT_FOUND_AFTER_FAILURE', { cause: error })
        const retry = await capturePersistenceService.beginRetry(failedSource.id, {
          provider: 'local-rules',
          modelName: 'local-rules',
          promptVersion: localRecognition.promptVersion,
          pipelineVersion: 'source-before-ai-local-fallback-v1',
        })
        await capturePersistenceService.recognize(retry, async () => localRecognition)
        const saved = await workspaceRepository.load()
        if (saved) applyWorkspaceView(saved)
        openDraftReview(retry.draftId, `${reason}；原始来源仍已保存，现已建立一次独立的本地规则重试，请重点核对。`)
      } catch {
        const saved = await workspaceRepository.load().catch(() => null)
        if (saved) applyWorkspaceView(saved)
        setStorageError(true)
        setNotice({ text: `${reason}；来源保存状态需要检查，请勿重复关闭页面。` })
      }
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
    if (Object.keys(patch).length > 0 || status === '已拒绝') {
      const action = status === '已拒绝' ? 'rejected' : 'modified'
      setRecognitionFeedback((current) => [...current, {
        id: `feedback-${Date.now()}-${current.length}`,
        draftId,
        originalKind: `task:${itemId}`,
        correctedKind: status === '已拒绝' ? 'rejected' : `fields:${Object.keys(patch).sort().join(',')}`,
        action,
        createdAt: new Date().toISOString(),
      }])
    }
  }

  const handleProjectChoice = (draftId: string, value: string) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId || !draft.recognitionResult) return draft
      const existingProjectId = value.startsWith('existing:') ? value.slice('existing:'.length) : null
      const decision = existingProjectId
        ? 'existing_project'
        : value === 'new_project' || value === 'standalone_task' || value === 'uncertain'
          ? value
          : 'uncertain'
      return {
        ...draft,
        recognitionResult: {
          ...draft.recognitionResult,
          projectMatch: {
            ...draft.recognitionResult.projectMatch,
            decision,
            matchedProjectId: existingProjectId,
            confidence: 1,
            reasons: ['由用户在确认页选择'],
          },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  }

  const handleKeepExplicit = (draftId: string) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId || !draft.recognitionResult) return draft
      const recognizedTasks = [
        ...draft.recognitionResult.standaloneTasks,
        ...draft.recognitionResult.milestones.flatMap((milestone) => [
          ...milestone.tasks,
          ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
        ]),
      ]
      const explicitIds = new Set(recognizedTasks.filter((task) => task.inferenceLevel === 'explicit').map((task) => task.tempId))
      const now = new Date().toISOString()
      const next = draft.items.reduce((candidate, item) => (
        item.status === '待确认' && !explicitIds.has(item.suggestion.id)
          ? updateDraftItem(candidate, item.id, {}, '已拒绝', now)
          : candidate
      ), draft)
      return next
    }))
    setNotice({ text: '已移除强推断和可选建议；原文明确事项仍待你确认。' })
  }

  const handleMoveRecognizedTask = (draftId: string, taskTempId: string, milestoneTempId: string) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId || !draft.recognitionResult) return draft
      let movedTask = draft.recognitionResult.standaloneTasks.find((task) => task.tempId === taskTempId)
      for (const milestone of draft.recognitionResult.milestones) {
        movedTask ??= milestone.tasks.find((task) => task.tempId === taskTempId)
        movedTask ??= milestone.workPackages.flatMap((workPackage) => workPackage.tasks).find((task) => task.tempId === taskTempId)
      }
      if (!movedTask || !draft.recognitionResult.milestones.some((milestone) => milestone.tempId === milestoneTempId)) return draft
      return {
        ...draft,
        recognitionResult: {
          ...draft.recognitionResult,
          standaloneTasks: draft.recognitionResult.standaloneTasks.filter((task) => task.tempId !== taskTempId),
          milestones: draft.recognitionResult.milestones.map((milestone) => ({
            ...milestone,
            tasks: [
              ...milestone.tasks.filter((task) => task.tempId !== taskTempId),
              ...(milestone.tempId === milestoneTempId ? [{ ...movedTask!, parentTempId: null }] : []),
            ],
            workPackages: milestone.workPackages.map((workPackage) => ({
              ...workPackage,
              tasks: workPackage.tasks.filter((task) => task.tempId !== taskTempId),
            })),
          })),
        },
        updatedAt: new Date().toISOString(),
      }
    }))
    setNotice({ text: '已调整识别草稿中的阶段；正式任务尚未创建。' })
    setRecognitionFeedback((current) => [...current, {
      id: `feedback-${Date.now()}-${current.length}`,
      draftId,
      originalKind: `task:${taskTempId}`,
      correctedKind: `milestone:${milestoneTempId}`,
      action: 'moved',
      createdAt: new Date().toISOString(),
    }])
  }

  const handleToggleRecognitionEntity = (draftId: string, kind: 'event' | 'material' | 'timePoint', tempId: string, selected: boolean) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId || !draft.recognitionResult) return draft
      const material = kind === 'material' ? draft.recognitionResult.materials.find((item) => item.tempId === tempId) : undefined
      const timePoint = kind === 'timePoint' ? draft.recognitionResult.timePoints.find((item) => item.tempId === tempId) : undefined
      return {
        ...draft,
        items: material ? draft.items.map((item) => material.relatedTaskTempIds.includes(item.suggestion.id)
          ? {
              ...item,
              suggestion: {
                ...item.suggestion,
                materials: selected
                  ? [...new Set([...item.suggestion.materials, material.name])]
                  : item.suggestion.materials.filter((name) => name !== material.name),
              },
            }
          : item) : timePoint ? draft.items.map((item) => timePoint.relatedTaskTempIds.includes(item.suggestion.id)
            ? { ...item, suggestion: { ...item.suggestion, deadline: selected ? timePoint.normalizedValue ?? '' : '' } }
            : item) : draft.items,
        recognitionResult: {
          ...draft.recognitionResult,
          events: kind === 'event' ? draft.recognitionResult.events.map((item) => item.tempId === tempId ? { ...item, selected } : item) : draft.recognitionResult.events,
          materials: kind === 'material' ? draft.recognitionResult.materials.map((item) => item.tempId === tempId ? { ...item, selected } : item) : draft.recognitionResult.materials,
          timePoints: kind === 'timePoint' ? draft.recognitionResult.timePoints.map((item) => item.tempId === tempId ? { ...item, selected } : item) : draft.recognitionResult.timePoints,
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  }

  const handleToggleDraftItemSelection = (draftId: string, itemId: string, selected: boolean) => {
    setDrafts((current) => current.map((draft) => draft.id !== draftId ? draft : {
      ...draft,
      items: draft.items.map((item) => item.id === itemId ? { ...item, selected, updatedAt: new Date().toISOString() } : item),
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleSplitDraftItem = (draftId: string, itemId: string) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId) return draft
      const item = draft.items.find((candidate) => candidate.id === itemId)
      if (!item || item.status !== '待确认') return draft
      const rawParts = item.suggestion.title.split(/(?:并且|并|以及|及|和|、)/u).map((value) => value.trim()).filter(Boolean)
      const parts = rawParts.length >= 2 ? rawParts.slice(0, 2) : [item.suggestion.title, '补充步骤（请编辑）']
      const verb = item.suggestion.title.match(/^(提交|上传|填写|完成|准备|核对|确认|联系|参加|阅读|下载|打印|盖章|签字|回复|领取|整理|撰写|制作|报名)/u)?.[1] ?? '完成'
      const now = new Date().toISOString()
      const firstTitle = parts[0]
      const secondTitle = /^(提交|上传|填写|完成|准备|核对|确认|联系|参加|阅读|下载|打印|盖章|签字|回复|领取|整理|撰写|制作|报名)/u.test(parts[1]) ? parts[1] : `${verb}${parts[1]}`
      const first = updateDraftItem(draft, itemId, { title: firstTitle, nextAction: firstTitle }, undefined, now)
      return {
        ...first,
        items: [...first.items, {
          ...item,
          id: `${item.id}-split-${Date.now()}`,
          suggestion: { ...item.suggestion, id: `${item.suggestion.id}-split-${Date.now()}`, title: secondTitle, nextAction: secondTitle },
          updatedAt: now,
          history: [{ id: `${item.id}-split-history-${Date.now()}`, field: '识别建议', before: item.suggestion.title, after: secondTitle, changedAt: now, actor: 'user', entityType: 'draft', entityId: item.id, action: 'split' }],
        }],
        updatedAt: now,
      }
    }))
    setRecognitionFeedback((current) => [...current, { id: `feedback-${Date.now()}-${current.length}`, draftId, originalKind: `task:${itemId}`, correctedKind: 'two_tasks', action: 'split', createdAt: new Date().toISOString() }])
    setNotice({ text: '已拆成两条待确认任务，请分别核对标题、时间和材料。' })
  }

  const handleMergeDraftItems = (draftId: string, sourceItemId: string, targetItemId: string) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId || sourceItemId === targetItemId) return draft
      const sourceItem = draft.items.find((item) => item.id === sourceItemId)
      const targetItem = draft.items.find((item) => item.id === targetItemId)
      if (!sourceItem || !targetItem || sourceItem.status !== '待确认' || targetItem.status !== '待确认') return draft
      const now = new Date().toISOString()
      const merged = updateDraftItem(draft, targetItemId, {
        description: [targetItem.suggestion.description, sourceItem.suggestion.description].filter(Boolean).join('；'),
        materials: [...new Set([...targetItem.suggestion.materials, ...sourceItem.suggestion.materials])],
        evidence: [targetItem.suggestion.evidence, sourceItem.suggestion.evidence].filter(Boolean).join('；'),
      }, undefined, now)
      return updateDraftItem(merged, sourceItemId, {}, '已拒绝', now)
    }))
    setRecognitionFeedback((current) => [...current, { id: `feedback-${Date.now()}-${current.length}`, draftId, originalKind: `task:${sourceItemId}`, correctedKind: `task:${targetItemId}`, action: 'merged', createdAt: new Date().toISOString() }])
    setNotice({ text: '已合并到目标建议；原建议保留为已拒绝记录，可追溯。' })
  }

  const handleConfirmDraftItem = async (draftId: string, itemId: string) => {
    const draft = drafts.find((item) => item.id === draftId)
    const item = draft?.items.find((candidate) => candidate.id === itemId)
    if (!draft || !item || item.status !== '待确认' || !draft.recognitionResult) return
    if (Number.isNaN(new Date(item.suggestion.deadline).getTime())) {
      setNotice({ text: '请先补全并确认该任务的截止时间；模糊日期不会直接进入正式任务。' })
      return
    }
    const unconfirmedTime = draft.recognitionResult?.timePoints.some((point) => point.relatedTaskTempIds.includes(item.suggestion.id) && point.selected === false)
    if (unconfirmedTime) {
      setNotice({ text: '该任务仍有模糊或未勾选的时间节点，请在“时间节点”中确认后再加入。' })
      return
    }
    try {
      await workspaceRepository.save(workspace)
      const canonical = await canonicalWorkspaceRepository.load()
      if (!canonical) throw new Error('WORKSPACE_V8_NOT_INITIALIZED')
      const selection = selectionFromDraftItems(draft.recognitionResult, [item])
      selection.rejectedTempIds = draft.items.filter((candidate) => candidate.status === '已拒绝').map((candidate) => candidate.suggestion.id)
      const plan = buildDomainCommitPlan(canonical, draftId, selection)
      await commitDomainPlan(canonicalWorkspaceRepository, plan)
      const saved = await workspaceRepository.load()
      if (saved) applyWorkspaceView(saved)
      setNotice({ text: '已原子创建任务及关联实体，可在任务中心继续编辑。' })
      if (draft.items.filter((draftItem) => draftItem.status === '待确认').length <= 1) {
        setSelectedDraftId(null)
        setCurrentPage('today')
      }
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('DOMAIN_COMMIT_PARENT_REQUIRED')
        ? '该子任务依赖父任务，请先一并勾选父任务后使用“全部加入”。'
        : '确认未写入：实体关系或时间仍需核对，现有数据未被部分修改。'
      setNotice({ text: message })
    }
  }

  const handleConfirmAll = async (draftId: string) => {
    const draft = drafts.find((item) => item.id === draftId)
    if (!draft?.recognitionResult) return
    const pending = draft.items.filter((item) => item.status === '待确认' && item.selected !== false)
    if (!pending.length) return
    if (pending.some((item) => Number.isNaN(new Date(item.suggestion.deadline).getTime()))) {
      setNotice({ text: '仍有任务的截止时间未确认，请逐项补全后再全部加入。' })
      return
    }
    const pendingIds = new Set(pending.map((item) => item.suggestion.id))
    if (draft.recognitionResult?.timePoints.some((point) => point.selected === false && point.relatedTaskTempIds.some((id) => pendingIds.has(id)))) {
      setNotice({ text: '仍有模糊或未勾选的时间节点，请先逐项确认。' })
      return
    }
    try {
      await workspaceRepository.save(workspace)
      const canonical = await canonicalWorkspaceRepository.load()
      if (!canonical) throw new Error('WORKSPACE_V8_NOT_INITIALIZED')
      const selection = selectionFromDraftItems(draft.recognitionResult, draft.items)
      const plan = buildDomainCommitPlan(canonical, draftId, selection)
      await commitDomainPlan(canonicalWorkspaceRepository, plan)
      const saved = await workspaceRepository.load()
      if (saved) applyWorkspaceView(saved)
      setSelectedDraftId(null)
      setCurrentPage('today')
      setNotice({ text: `已原子创建 ${plan.create.tasks.length} 项任务，并完整保存材料、时间与证据。` })
    } catch {
      setNotice({ text: '全部确认未写入：请检查父子任务、依赖和未确认时间，当前数据未被部分修改。' })
    }
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

  const handleImportWorkspace = async (serialized: string) => {
    const imported = await workspaceRepository.importAndReplace(serialized)
    applyWorkspaceView(imported)
    setNotice({ text: '已导入 JSON 备份。' })
  }

  const handleExportWorkspace = async () => workspaceRepository.exportCurrentJson()

  const handleClearWorkspace = () => {
    setTasks([])
    setSources([])
    setDrafts([])
    setProjects([])
    setCourseBlocks([])
    setIntegrations(createIntegrationState())
    setKnowledgeSettings({})
    setWorkPackages([])
    setEvents([])
    setMigrationLog([])
    setRecognitionFeedback([])
    setLegacyData({})
    void workspaceRepository.clear()
    setNotice({ text: '已清空本机工作区。' })
  }

  const handleExportMigrationBackup = async () => {
    const serialized = await workspaceRepository.exportLatestMigrationBackup()
    if (!serialized) {
      setNotice({ text: '当前没有可导出的 Schema 迁移前备份。' })
      return
    }
    const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `student-affairs-migration-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice({ text: '已导出迁移前备份；回滚前请先保留当前备份。' })
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
          workPackages={workPackages}
          events={events}
          onExport={handleExportWorkspace}
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
      case 'reports':
        return <ReportsPage tasks={tasks} projects={projects} />
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
        return <PrivacyPage workspace={workspace} onOpenArchive={() => setCurrentPage('archive')} onExportMigrationBackup={() => void handleExportMigrationBackup()} />
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
      <div id="main-content" className="content-shell" tabIndex={-1}>
        <PageLoadBoundary key={currentPage} onRetry={() => window.location.reload()}>
          <Suspense fallback={<main className="page page-loading" role="status">正在打开页面…</main>}>
            {renderPage()}
          </Suspense>
        </PageLoadBoundary>
      </div>

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
          projectWillCreate={selectedDraft.recognitionResult
            ? selectedDraft.recognitionResult.projectMatch.decision === 'new_project'
            : !projects.some((project) => project.sourceIds.includes(selectedDraft.sourceId))}
          projects={projects}
          onProjectChoice={(value) => handleProjectChoice(selectedDraft.id, value)}
          onKeepExplicit={() => handleKeepExplicit(selectedDraft.id)}
          onMoveTask={(taskTempId, milestoneTempId) => handleMoveRecognizedTask(selectedDraft.id, taskTempId, milestoneTempId)}
          onToggleRecognitionEntity={(kind, tempId, selected) => handleToggleRecognitionEntity(selectedDraft.id, kind, tempId, selected)}
          onToggleTaskSelected={(itemId, selected) => handleToggleDraftItemSelection(selectedDraft.id, itemId, selected)}
          onSplitTask={(itemId) => handleSplitDraftItem(selectedDraft.id, itemId)}
          onMergeTask={(sourceItemId, targetItemId) => handleMergeDraftItems(selectedDraft.id, sourceItemId, targetItemId)}
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
