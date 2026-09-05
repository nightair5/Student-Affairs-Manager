import { assertMainlineRuntime, type MainlineRuntime } from './experiments/mainline02/runtime'
import type { WorkspaceV8 } from './domain/v2/types'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DraftReviewPanel } from './components/DraftReviewPanel'
import { EventDetailPanel } from './components/EventDetailPanel'
import { IntakePanel } from './components/IntakePanel'
import { OnboardingGuide } from './components/OnboardingGuide'
import { PageLoadBoundary } from './components/PageLoadBoundary'
import { Sidebar } from './components/Sidebar'
import { SourceSupplementPanel } from './components/SourceSupplementPanel'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { WorkspaceRecoveryPanel } from './components/WorkspaceRecoveryPanel'
import { demoSources, demoTasks } from './data/demo'
import { InboxPage } from './pages/InboxPage'
import { DashboardPage } from './pages/DashboardPage'
import { TasksPage } from './pages/TasksPage'
import { IndexedDbWorkspaceRepository, WorkspaceRecoveryRequiredError } from './lib/repository'
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  scheduleBrowserNotifications,
  type BrowserNotificationPermission,
} from './lib/notifications'
import { loadWorkspace } from './lib/storage'
import { updateTaskWithHistory } from './lib/taskUpdates'
import { canSaveLinkOnly, createIntakeResult, type IntakeInput } from './lib/intake'
import { MULTIMODAL_PROMPT_VERSION } from './lib/multimodal'
import { ProxyDeepSeekExtractionService } from './lib/deepseekExtraction'
import { buildLocalRecognition } from './recognition/pipeline'
import {
  nextWorkspaceRecoveryAction,
  safeWorkspaceRecoveryErrors,
  workspacePersistenceRevision,
} from './lib/workspaceRecoveryUi'
import { markOnboardingComplete, shouldShowOnboarding } from './lib/onboarding'
import { CapturePersistenceService } from './domain/v2/capture'
import { retryExistingSourceRecognition } from './domain/v2/sourceRetry'
import { selectPendingReviewItems } from './lib/sourceWorkflow'
import { materialStatusFromLegacy } from './lib/domainEntities'
import { CanonicalWorkspaceRepository } from './domain/v2/repository'
import {
  buildDomainCommitPlan,
  commitDomainPlan,
  mergeRecognitionTasks,
  recognitionResultFromManualSuggestion,
  selectionFromDraftItems,
  splitRecognitionTask,
} from './domain/v2/domainCommit'
import {
  createManualMilestone,
  createIntegrationState,
  createWorkspaceData,
  syncTaskMilestone,
  updateDraftItem,
} from './lib/workspace'
import type { CourseBlock, Event, ExtractionDraft, IntegrationState, KnowledgeSettings, MaterialItemEntity, MigrationRecord, PageId, ParsedSuggestion, Project, RecognitionFeedbackRecord, Source, Task, WorkPackage, WorkspaceData } from './types'

const canonicalWorkspaceRepository = new CanonicalWorkspaceRepository()
const workspaceRepository = new IndexedDbWorkspaceRepository(canonicalWorkspaceRepository)
const capturePersistenceService = new CapturePersistenceService(canonicalWorkspaceRepository)
const deepSeekExtractionService = new ProxyDeepSeekExtractionService()

function captureActionMessage(error: unknown, fallback: string): string {
  const code = error instanceof Error ? error.message : ''
  const known: Record<string, string> = {
    CAPTURE_SOURCE_VERSION_CHANGED: '来源正文已在其他页面更新；请刷新后基于最新版本重试。',
    CAPTURE_RETRY_ALREADY_RUNNING: '当前版本仍有识别正在进行；请稍后再试，系统不会并发覆盖结果。',
    CAPTURE_REVISION_UNCHANGED: '文字没有变化；请直接使用“本地规则重试”。',
    CAPTURE_DUPLICATE_IN_PROGRESS: '该版本仍在处理中，请稍后从收件箱查看。',
  }
  return known[code] ?? (code.trim() || fallback)
}

interface WorkspaceRecoveryState {
  backupId: string
  errorCodes: string[]
  backupExported: boolean
  confirmationArmed: boolean
  busy: 'exporting' | 'recovering' | null
  failureCode: string | null
}

function persistenceRevisionForView(saved: WorkspaceData): string {
  const view = createWorkspaceData(
    saved.tasks,
    saved.sources,
    saved.drafts,
    saved.projects,
    saved.courseBlocks,
    saved.integrations,
    saved.knowledgeSettings,
    saved.workPackages,
    saved.events,
    saved.migrationLog,
    saved.recognitionFeedback,
    saved.legacyData,
  )
  return workspacePersistenceRevision({ ...view, materialItems: saved.materialItems })
}

const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const ArchivePage = lazy(() => import('./pages/ArchivePage').then((module) => ({ default: module.ArchivePage })))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage').then((module) => ({ default: module.KnowledgePage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const ServicesPage = lazy(() => import('./pages/ServicesPage').then((module) => ({ default: module.ServicesPage })))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })))

function App({ runtime }: { runtime?: MainlineRuntime } = {}) {
  if (runtime !== undefined) assertMainlineRuntime(runtime)
  const [boundRuntime] = useState(runtime)
  if (runtime !== boundRuntime) throw new Error('MAINLINE_RUNTIME_CHANGE_FORBIDDEN')
  const [initialWorkspace] = useState(() => runtime ? runtime.view(runtime.initial) : loadWorkspace(demoTasks, demoSources))
  const [isolatedSnapshot, setIsolatedSnapshot] = useState<WorkspaceV8 | null>(runtime?.initial ?? null)
  const [isolatedChoices, setIsolatedChoices] = useState<Record<string, Record<string, boolean>>>({})
  const [isolatedBusy, setIsolatedBusy] = useState(false)
  const isolatedLock = useRef(false)
  const [currentPage, setCurrentPage] = useState<PageId>('today')
  const [inboxView, setInboxView] = useState<'all' | 'needs_review'>('all')
  const [tasks, setTasks] = useState<Task[]>(initialWorkspace.tasks)
  const [sources, setSources] = useState<Source[]>(initialWorkspace.sources)
  const [drafts, setDrafts] = useState<ExtractionDraft[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [courseBlocks, setCourseBlocks] = useState<CourseBlock[]>([])
  const [integrations, setIntegrations] = useState<IntegrationState>(() => createIntegrationState())
  const [knowledgeSettings, setKnowledgeSettings] = useState<KnowledgeSettings>({})
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([])
  const [materialItems, setMaterialItems] = useState<MaterialItemEntity[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [migrationLog, setMigrationLog] = useState<MigrationRecord[]>([])
  const [recognitionFeedback, setRecognitionFeedback] = useState<RecognitionFeedbackRecord[]>([])
  const [legacyData, setLegacyData] = useState<Record<string, unknown>>({})
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [workspaceRecovery, setWorkspaceRecovery] = useState<WorkspaceRecoveryState | null>(null)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(() => runtime ? false : shouldShowOnboarding())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [draftSourceSnapshot, setDraftSourceSnapshot] = useState<{ draftId: string; sourceVersionId: string; rawText: string } | null>(null)
  const [supplementSourceId, setSupplementSourceId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null)
  const [smartExtractionStatus, setSmartExtractionStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking')
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => runtime ? 'unsupported' : getBrowserNotificationPermission())
  const deliveredNotifications = useRef(new Set<string>())
  const hydrationPromise = useRef<Promise<WorkspaceData> | null>(null)
  const persistedWorkspaceRevision = useRef<string | null>(null)
  const pendingWorkspaceRevision = useRef<string | null>(null)
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? null
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null
  const selectedEventDrafts = selectedEvent
    ? drafts.filter((draft) => draft.recognitionResult?.evidence.some((evidence) => selectedEvent.evidenceIds.includes(evidence.id)))
    : []
  const selectedEventEvidenceQuotes = selectedEvent
    ? [...new Set(selectedEventDrafts.flatMap((draft) => draft.recognitionResult?.evidence
        .filter((evidence) => selectedEvent.evidenceIds.includes(evidence.id))
        .flatMap((evidence) => evidence.quotedText?.trim() || evidence.quote?.trim() ? [evidence.quotedText?.trim() || evidence.quote!.trim()] : [])
      ?? []))]
    : []
  const selectedEventSourceTitles = [...new Set(selectedEventDrafts.flatMap((draft) => {
    const source = sources.find((candidate) => candidate.id === draft.sourceId)
    return source ? [source.title] : []
  }))]

  const experimentalReview = useMemo(() => {
    if (!runtime || !isolatedSnapshot || !selectedDraftId) return null
    try { return runtime.review(isolatedSnapshot, selectedDraftId, isolatedChoices[selectedDraftId]) } catch { return null }
  }, [runtime, isolatedSnapshot, selectedDraftId, isolatedChoices])
  const dateViews = useMemo(() => runtime && isolatedSnapshot ? runtime.dates(isolatedSnapshot) : undefined, [runtime, isolatedSnapshot])
  const selectedDraft = experimentalReview?.draft ?? drafts.find((draft) => draft.id === selectedDraftId) ?? null
  const supplementSource = sources.find((source) => source.id === supplementSourceId) ?? null
  const pendingReviewCount = useMemo(() => selectPendingReviewItems(sources, drafts)
    .reduce((count, item) => count + item.counts.pending, 0), [drafts, sources])
  const selectedDraftCurrentSource = selectedDraft
    ? sources.find((source) => source.id === selectedDraft.sourceId) ?? null
    : null
  const selectedDraftNeedsHistoricalSource = Boolean(
    selectedDraft?.sourceVersionId
    && selectedDraftCurrentSource?.currentVersionId
    && selectedDraft.sourceVersionId !== selectedDraftCurrentSource.currentVersionId,
  )
  const selectedDraftSource = selectedDraftNeedsHistoricalSource
    ? selectedDraft && selectedDraftCurrentSource && draftSourceSnapshot?.draftId === selectedDraft.id
      && draftSourceSnapshot.sourceVersionId === selectedDraft.sourceVersionId
      ? {
          ...selectedDraftCurrentSource,
          content: draftSourceSnapshot.rawText,
          rawText: draftSourceSnapshot.rawText,
          contentPreview: draftSourceSnapshot.rawText.slice(0, 240),
          reviewMetadata: selectedDraft.sourceReviewMetadata,
        }
      : null
    : selectedDraftCurrentSource
  const workspace = useMemo(() => ({
    ...createWorkspaceData(tasks, sources, drafts, projects, courseBlocks, integrations, knowledgeSettings, workPackages, events, migrationLog, recognitionFeedback, legacyData),
    materialItems,
  }), [courseBlocks, drafts, events, integrations, knowledgeSettings, legacyData, materialItems, migrationLog, projects, recognitionFeedback, sources, tasks, workPackages])

  const applyWorkspaceView = useCallback((saved: WorkspaceData) => {
    setTasks(saved.tasks)
    setSources(saved.sources)
    setDrafts(saved.drafts)
    setProjects(saved.projects)
    setCourseBlocks(saved.courseBlocks)
    setIntegrations(saved.integrations)
    setKnowledgeSettings(saved.knowledgeSettings)
    setWorkPackages(saved.workPackages)
    setMaterialItems(saved.materialItems)
    setEvents(saved.events)
    setMigrationLog(saved.migrationLog)
    setRecognitionFeedback(saved.recognitionFeedback)
    setLegacyData(saved.legacyData)
  }, [])

  useEffect(() => {
    if (runtime) return
    let active = true
    void deepSeekExtractionService.status().then((status) => {
      if (active) setSmartExtractionStatus(status.configured ? 'connected' : 'unavailable')
    })
    return () => { active = false }
  }, [runtime])

  useEffect(() => {
    let active = true
    if (runtime) {
      void runtime.load().then(saved => { if (active) { setIsolatedSnapshot(saved); applyWorkspaceView(runtime.view(saved)); setWorkspaceReady(true) } }).catch(() => { if (active) { setStorageError(true); setWorkspaceReady(true) } })
      return () => { active = false }
    }
    if (!hydrationPromise.current) {
      hydrationPromise.current = (async () => {
        const saved = await workspaceRepository.load()
        if (saved) return saved
        const initialized = createWorkspaceData(initialWorkspace.tasks, initialWorkspace.sources)
        await workspaceRepository.save(initialized)
        return initialized
      })()
    }
    void hydrationPromise.current.then((saved) => {
      if (!active) return
      persistedWorkspaceRevision.current = persistenceRevisionForView(saved)
      pendingWorkspaceRevision.current = null
      applyWorkspaceView(saved)
      setStorageError(false)
      setWorkspaceRecovery(null)
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof WorkspaceRecoveryRequiredError) {
        setStorageError(false)
        setWorkspaceRecovery({
          backupId: error.backupId,
          errorCodes: safeWorkspaceRecoveryErrors(error.errors),
          backupExported: false,
          confirmationArmed: false,
          busy: null,
          failureCode: null,
        })
        return
      }
      setStorageError(true)
    }).finally(() => {
      if (active) setWorkspaceReady(true)
    })
    return () => {
      active = false
    }
  }, [applyWorkspaceView, initialWorkspace.sources, initialWorkspace.tasks, runtime])

  useEffect(() => {
    if (runtime || !workspaceReady || storageError || workspaceRecovery) return
    const revision = workspacePersistenceRevision(workspace)
    if (revision === persistedWorkspaceRevision.current || revision === pendingWorkspaceRevision.current) return
    pendingWorkspaceRevision.current = revision
    void workspaceRepository.save(workspace).then(() => {
      persistedWorkspaceRevision.current = revision
      if (pendingWorkspaceRevision.current === revision) pendingWorkspaceRevision.current = null
    }).catch(() => {
      if (pendingWorkspaceRevision.current === revision) pendingWorkspaceRevision.current = null
      setStorageError(true)
    })
  }, [storageError, workspace, workspaceReady, workspaceRecovery, runtime])

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
    if (runtime || notificationPermission !== 'granted') return
    return scheduleBrowserNotifications(tasks, deliveredNotifications.current, () => {
      setNotice({ text: '浏览器通知发送失败，请检查网站通知权限。' })
    })
  }, [notificationPermission, tasks, runtime])

  useEffect(() => {
    if (runtime) return
    const refreshPermission = () => {
      setNotificationPermission(getBrowserNotificationPermission())
    }
    window.addEventListener('focus', refreshPermission)
    document.addEventListener('visibilitychange', refreshPermission)
    return () => {
      window.removeEventListener('focus', refreshPermission)
      document.removeEventListener('visibilitychange', refreshPermission)
    }
  }, [runtime])

  const rejectExperimentAction = () => { setNotice({ text: '本隔离轮未支持该操作；未写入或发送。草稿仍可稍后核对。' }) }
  const refreshExperiment = async () => {
    if (!runtime) return
    const saved = await runtime.load()
    const view = runtime.view(saved)
    setIsolatedSnapshot(saved)
    applyWorkspaceView(view)
    persistedWorkspaceRevision.current = persistenceRevisionForView(view)
    pendingWorkspaceRevision.current = null
  }
  const performExperiment = async (action: () => Promise<void>) => {
    if (!runtime || storageError || !workspaceReady || isolatedLock.current) return
    isolatedLock.current = true
    setIsolatedBusy(true)
    try { await action(); await refreshExperiment() }
    catch (error) {
      setNotice({ text: '操作未完成：' + (error instanceof Error ? error.message : '需重新核对') + '。请查看收件箱；没有自动重试。' })
      try { await refreshExperiment() } catch { setStorageError(true) }
    } finally { isolatedLock.current = false; setIsolatedBusy(false) }
  }
  const confirmExperiment = async (draftIds: string[], itemId?: string) => {
    if (!runtime || !isolatedSnapshot) return
    await performExperiment(async () => {
      let current = isolatedSnapshot
      for (const draftId of draftIds) {
        const reviewed = runtime.review(current, draftId, isolatedChoices[draftId])
        const items = reviewed.draft.items.filter(item => item.status === '待确认' && (itemId ? item.id === itemId : item.selected !== false))
        if (!items.length) continue
        current = await runtime.confirm({ draftId, revision: reviewed.revision, taskTempIds: items.map(item => item.suggestion.id) })
        setNotice({ text: '已确认并保存；可在任务中心查找。其他未选建议仍保留。' })
      }
    })
  }
  const handleRequestNotificationPermission = async () => {
    if (runtime) { rejectExperimentAction(); return 'unsupported' as const }
    const permission = await requestBrowserNotificationPermission()
    setNotificationPermission(permission)
    return permission
  }

  const handleComplete = (taskId: string) => {
    if (runtime) { rejectExperimentAction(); return }
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
    if (runtime) { rejectExperimentAction(); return }
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task || task.status !== '待开始') return
    handleUpdateTask(taskId, { status: '进行中' })
    setNotice({ text: '已开始任务，首页会优先帮助你收尾。' })
  }

  const handleSnooze = (taskId: string) => {
    if (runtime) { rejectExperimentAction(); return }
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
    if (runtime) { rejectExperimentAction(); return }
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
    if (runtime) { rejectExperimentAction(); return }
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return
    const nextTask = updateTaskWithHistory(task, patch)
    setTasks((current) => current.map((candidate) => candidate.id === taskId ? nextTask : candidate))
    if (patch.materials) {
      setMaterialItems((current) => {
        const next = [...current]
        patch.materials!.forEach((material) => {
          const index = next.findIndex((candidate) => candidate.id === material.id)
          const updated: MaterialItemEntity = index >= 0
            ? {
                ...next[index],
                name: material.name,
                status: materialStatusFromLegacy(material.done, material.status),
                projectId: task.projectId ?? next[index].projectId,
                taskId,
                updatedAt: nextTask.updatedAt,
              }
            : {
                id: material.id,
                projectId: task.projectId,
                taskId,
                name: material.name,
                required: true,
                status: materialStatusFromLegacy(material.done, material.status),
                evidenceIds: [],
                createdAt: nextTask.updatedAt,
                updatedAt: nextTask.updatedAt,
              }
          if (index >= 0) next[index] = updated
          else next.push(updated)
        })
        return next
      })
    }
    if (task.projectId) {
      setProjects((current) => current.map((project) => project.id === task.projectId
        ? syncTaskMilestone(project, nextTask)
        : project))
    }
  }

  const selectDraftForReview = async (draftId: string) => {
    try {
      const canonical = await (runtime ? runtime.load() : canonicalWorkspaceRepository.load())
      const canonicalDraft = canonical?.extractionDrafts.find((candidate) => candidate.id === draftId)
      const run = canonicalDraft
        ? canonical?.recognitionRuns.find((candidate) => candidate.id === canonicalDraft.recognitionRunId)
        : null
      const version = run
        ? canonical?.sourceVersions.find((candidate) => candidate.id === run.sourceVersionId)
        : null
      setDraftSourceSnapshot(version?.rawText !== null && version?.rawText !== undefined
        ? { draftId, sourceVersionId: version.id, rawText: version.rawText }
        : null)
    } catch {
      setDraftSourceSnapshot(null)
    }
    setSelectedDraftId(draftId)
  }

  const openDraftReview = (draftId: string, message: string) => {
    setIntakeOpen(false)
    setInboxView('needs_review')
    setCurrentPage('inbox')
    void selectDraftForReview(draftId)
    setNotice({ text: message })
  }

  const handleIntakeInput = async (input: IntakeInput) => {
    if (runtime) {
      await performExperiment(async () => {
        const draftId = await runtime.capture(input)
        setIntakeOpen(false)
        setSelectedDraftId(draftId)
        setNotice({ text: '人工工程响应（非模型预测）；请核对后确认。' })
      })
      return
    }
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
    const draftRecognition = input.manualSuggestion
      ? recognitionResultFromManualSuggestion(localRecognition, input.manualSuggestion)
      : localRecognition
    const useCloudRecognition = !input.manualSuggestion && smartExtractionStatus === 'connected'
    const reviewQualityFlags = [...new Set([
      ...(input.reviewMetadata?.qualityFlags ?? []),
      ...(input.multimodal
        ? [`多模态实验：本次显式发送 ${input.multimodal.images.length} 张图片/页面与 OCR 文字；图片未写入工作区`]
        : []),
      ...(useCloudRecognition && input.content.length > 24_000
        ? ['DeepSeek 本次仅接收前 24,000 字，后续正文未进入模型识别']
        : []),
    ])]
    const captureRequest = {
      operationId: input.operationId ?? crypto.randomUUID(),
      sourceType: input.sourceType,
      title: input.sourceTitle ?? input.fileName ?? localResult.source.title,
      rawText: input.content,
      provider: input.manualSuggestion
        ? 'manual' as const
        : useCloudRecognition
          ? 'deepseek' as const
          : 'local-rules' as const,
      modelName: input.manualSuggestion
        ? 'manual-entry'
        : useCloudRecognition
          ? input.multimodal
            ? 'deepseek-v4-flash-vision-exp'
            : 'deepseek-v4-flash'
          : 'local-rules',
      promptVersion: input.manualSuggestion
        ? null
        : input.multimodal ? MULTIMODAL_PROMPT_VERSION : localRecognition.promptVersion,
      pipelineVersion: useCloudRecognition
        ? input.multimodal ? 'source-before-multimodal-ai-v1' : 'source-before-ai-v1'
        : 'source-before-local-rules-v1',
      sourceLegacyData: {
        contentPreview: localResult.source.contentPreview,
        url: input.url ?? null,
        originalFileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? null,
        fileHash: input.fileHash ?? null,
        parserVersion: localResult.source.parserVersion ?? null,
        reviewMetadata: {
          sourceType: input.reviewMetadata?.sourceType ?? input.sourceType,
          mimeType: input.reviewMetadata?.mimeType ?? null,
          characterCount: input.reviewMetadata?.characterCount ?? input.content.length,
          pageCount: input.reviewMetadata?.pageCount ?? null,
          extractionMethod: input.reviewMetadata?.extractionMethod ?? 'manual',
          ocrConfidence: input.reviewMetadata?.ocrConfidence ?? null,
          partialExtraction: input.reviewMetadata?.partialExtraction ?? null,
          qualityFlags: reviewQualityFlags,
        },
      },
      now: input.now?.toISOString(),
    }
    try {
      const handle = await capturePersistenceService.beginCapture(captureRequest)
      const recognitionResult = await capturePersistenceService.recognize(
        handle,
        input.manualSuggestion
          ? async () => draftRecognition
          : useCloudRecognition
            ? async () => deepSeekExtractionService.recognize(input, { projects, tasks })
            : async () => draftRecognition,
      )
      const saved = await workspaceRepository.load()
      if (saved) applyWorkspaceView(saved)
      if (useCloudRecognition) setSmartExtractionStatus('connected')
      openDraftReview(
        handle.draftId,
        input.manualSuggestion
          ? '手动录入已先保存来源，再生成待确认草稿；核对后才会创建正式任务。'
          : useCloudRecognition
            ? `${recognitionResult.modelName} 已生成可编辑建议；来源已在请求前安全保存。`
            : 'DeepSeek 当前未连接；来源已先保存，并由本地规则生成可编辑建议。',
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'DeepSeek 智能整理暂时不可用'
      if (useCloudRecognition) setSmartExtractionStatus('unavailable')
      try {
        const canonical = await canonicalWorkspaceRepository.load()
        const failedSource = canonical?.sources.find((source) => source.legacyData?.captureOperationId === captureRequest.operationId)
        if (!failedSource) throw new Error('CAPTURE_SOURCE_NOT_FOUND_AFTER_FAILURE', { cause: error })
        const saved = await workspaceRepository.load()
        if (saved) applyWorkspaceView(saved)
        setIntakeOpen(false)
        setInboxView('all')
        setCurrentPage('inbox')
        setSelectedDraftId(null)
        setNotice({ text: `${reason}；原始来源已安全保存。可在收件箱重试识别、查看原文或手动整理。` })
      } catch {
        const saved = await workspaceRepository.load().catch(() => null)
        if (saved) applyWorkspaceView(saved)
        setStorageError(true)
        setNotice({ text: `${reason}；来源保存状态需要检查，请勿重复关闭页面。` })
      }
    }
  }

  const handleSaveSourceOnly = async (input: IntakeInput) => {
    if (runtime) { rejectExperimentAction(); return }
    const title = input.sourceTitle?.trim() ?? ''
    const url = input.url?.trim() ?? ''
    if (input.sourceType !== 'link' || !canSaveLinkOnly(url, title)) {
      throw new Error('请填写标题和有效的公网 HTTPS 链接。')
    }
    try {
      await capturePersistenceService.saveSource({
        operationId: input.operationId ?? crypto.randomUUID(),
        sourceType: 'link',
        title,
        rawText: '',
        sourceLegacyData: {
          contentPreview: '',
          url,
          parserVersion: 'source-only-v1',
          reviewMetadata: {
            sourceType: 'link',
            mimeType: null,
            characterCount: 0,
            pageCount: null,
            extractionMethod: 'unknown',
            ocrConfidence: null,
            partialExtraction: null,
            qualityFlags: [],
          },
        },
      })
      const saved = await workspaceRepository.load()
      if (saved) applyWorkspaceView(saved)
      setIntakeOpen(false)
      setInboxView('all')
      setCurrentPage('inbox')
      setNotice({ text: '链接已作为未整理来源保存在本机；尚未读取网页、调用 DeepSeek 或创建任务。' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '链接保存失败，请稍后重试。'
      setNotice({ text: message })
      throw error
    }
  }

  const handleRetrySource = async (sourceId: string) => {
    if (runtime) { rejectExperimentAction(); return }
    const canonical = await canonicalWorkspaceRepository.load()
    const canonicalSource = canonical?.sources.find((candidate) => candidate.id === sourceId)
    const canonicalVersion = canonicalSource
      ? canonical?.sourceVersions.find((candidate) => candidate.id === canonicalSource.currentVersionId)
      : null
    const source = sources.find((candidate) => candidate.id === sourceId)
    const content = canonicalVersion?.rawText ?? ''
    if (!canonicalSource || !canonicalVersion || !source || !content.trim()) {
      throw new Error('该来源还没有可重新识别的正文，请先使用“手工补充”。')
    }
    const localRecognition = buildLocalRecognition({
      sourceType: canonicalSource.type,
      sourceTitle: canonicalSource.title,
      content,
      referenceTime: new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      projects,
      tasks,
    })
    try {
      const retried = await retryExistingSourceRecognition(
        capturePersistenceService,
        sourceId,
        {
          provider: 'local-rules',
          modelName: 'local-rules',
          promptVersion: localRecognition.promptVersion,
          pipelineVersion: 'source-retry-local-rules-v1',
          expectedSourceVersionId: canonicalVersion.id,
        },
        async () => localRecognition,
      )
      const saved = await workspaceRepository.load()
      if (saved) applyWorkspaceView(saved)
      openDraftReview(
        retried.draftId,
        '已沿用原来源与当前版本进行本地规则重试；没有发送到云端，请核对后再确认。',
      )
    } catch (error) {
      const saved = await workspaceRepository.load().catch(() => null)
      if (saved) applyWorkspaceView(saved)
      const message = captureActionMessage(error, '重新识别未完成')
      setInboxView('all')
      setCurrentPage('inbox')
      setNotice({ text: `${message}；原来源和历史版本仍保留。` })
      throw error
    }
  }

  const openManualSupplement = (sourceId: string) => {
    if (runtime) { rejectExperimentAction(); return }
    setIntakeOpen(false)
    setSupplementSourceId(sourceId)
  }

  const handleManualSupplement = async (sourceId: string, content: string, operationId: string) => {
    if (runtime) { rejectExperimentAction(); return }
    const source = sources.find((candidate) => candidate.id === sourceId)
    if (!source || !content.trim()) throw new Error('来源不存在或补充文字为空。')
    const currentText = source.rawText ?? source.content ?? ''
    if (currentText.trim() === content.trim()) throw new Error('文字没有变化；请直接使用“本地规则重试”。')
    const localRecognition = buildLocalRecognition({
      sourceType: source.type,
      sourceTitle: source.title,
      content,
      referenceTime: new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      projects,
      tasks,
    })
    try {
      const handle = await capturePersistenceService.beginRevision(sourceId, {
        operationId,
        rawText: content,
        provider: 'local-rules',
        modelName: 'local-rules',
        promptVersion: localRecognition.promptVersion,
        pipelineVersion: 'manual-source-supplement-v1',
        sourceLegacyData: {
          reviewMetadata: {
            sourceType: source.type,
            mimeType: source.reviewMetadata?.mimeType ?? source.mimeType ?? null,
            characterCount: content.length,
            pageCount: null,
            extractionMethod: 'manual',
            ocrConfidence: null,
            partialExtraction: false,
            qualityFlags: ['正文已由用户手工补充，未重新读取原文件'],
          },
        },
      })
      let finalHandle = handle
      if (handle.duplicate) {
        const canonical = await canonicalWorkspaceRepository.load()
        const existingDraft = canonical?.extractionDrafts.find((candidate) => candidate.id === handle.draftId)
        if (existingDraft?.result) {
          const saved = await workspaceRepository.load()
          if (saved) applyWorkspaceView(saved)
          setSupplementSourceId(null)
          openDraftReview(handle.draftId, '该版本已经保存并形成待确认草稿，未重复创建版本。')
          return
        }
        if (existingDraft?.status !== 'failed') throw new Error('该版本仍在处理中，请稍后从收件箱查看。')
        finalHandle = await capturePersistenceService.beginRetry(sourceId, {
          provider: 'local-rules',
          modelName: 'local-rules',
          promptVersion: localRecognition.promptVersion,
          pipelineVersion: 'manual-source-supplement-retry-v1',
          expectedSourceVersionId: handle.sourceVersionId,
        })
      }
      await capturePersistenceService.recognize(finalHandle, async () => localRecognition)
      const saved = await workspaceRepository.load()
      if (saved) applyWorkspaceView(saved)
      setSupplementSourceId(null)
      openDraftReview(finalHandle.draftId, '补充文字已作为同一来源的新版本保存，并建立本地规则待确认草稿。')
    } catch (error) {
      const saved = await workspaceRepository.load().catch(() => null)
      if (saved) applyWorkspaceView(saved)
      throw new Error(captureActionMessage(error, '手工补充未完成；来源和历史版本仍保留。'), { cause: error })
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
    if (runtime) {
      if (status || !experimentalReview) { rejectExperimentAction(); return }
      const entries = Object.entries(patch)
      const item = experimentalReview.draft.items.find(candidate => candidate.id === itemId)
      if (!item || entries.length !== 1 || !['title', 'deadline'].includes(entries[0][0]) || typeof entries[0][1] !== 'string') { rejectExperimentAction(); return }
      const [field, value] = entries[0]
      void performExperiment(async () => {
        await runtime.edit({ draftId, taskTempId: item.suggestion.id, revision: experimentalReview.revision,
          operationId: crypto.randomUUID(), field: field as 'title' | 'deadline', value: value as string })
        setNotice({ text: '修改已明确保存；尚未创建任务。' })
      })
      return
    }
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
    if (runtime) { rejectExperimentAction(); return }
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
    if (runtime) { rejectExperimentAction(); return }
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
    if (runtime) { rejectExperimentAction(); return }
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
    if (runtime) { rejectExperimentAction(); return }
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
    if (runtime) {
      if (isolatedLock.current || experimentalReview?.states[itemId]?.blockedReason) return
      setIsolatedChoices(previous => ({ ...previous, [draftId]: { ...previous[draftId], [itemId]: selected } }))
      return
    }
    setDrafts((current) => current.map((draft) => draft.id !== draftId ? draft : {
      ...draft,
      items: draft.items.map((item) => item.id === itemId ? { ...item, selected, updatedAt: new Date().toISOString() } : item),
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleSplitDraftItem = (draftId: string, itemId: string) => {
    if (runtime) { rejectExperimentAction(); return }
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId) return draft
      const item = draft.items.find((candidate) => candidate.id === itemId)
      if (!item || item.status !== '待确认' || !draft.recognitionResult) return draft
      const rawParts = item.suggestion.title.split(/(?:并且|并|以及|及|和|、)/u).map((value) => value.trim()).filter(Boolean)
      const parts = rawParts.length >= 2 ? rawParts.slice(0, 2) : [item.suggestion.title, '补充步骤（请编辑）']
      const verb = item.suggestion.title.match(/^(提交|上传|填写|完成|准备|核对|确认|联系|参加|阅读|下载|打印|盖章|签字|回复|领取|整理|撰写|制作|报名)/u)?.[1] ?? '完成'
      const now = new Date().toISOString()
      const firstTitle = parts[0]
      const secondTitle = /^(提交|上传|填写|完成|准备|核对|确认|联系|参加|阅读|下载|打印|盖章|签字|回复|领取|整理|撰写|制作|报名)/u.test(parts[1]) ? parts[1] : `${verb}${parts[1]}`
      const splitTaskTempId = `${item.suggestion.id.slice(0, 64)}-split-${Date.now().toString(36)}`
      const recognitionResult = splitRecognitionTask(
        draft.recognitionResult,
        item.suggestion.id,
        splitTaskTempId,
        secondTitle,
      )
      const first = updateDraftItem(draft, itemId, { title: firstTitle, nextAction: firstTitle }, undefined, now)
      return {
        ...first,
        recognitionResult,
        items: [...first.items, {
          ...item,
          id: `draft-item:${draft.id}:${splitTaskTempId}`,
          suggestion: { ...item.suggestion, id: splitTaskTempId, title: secondTitle, nextAction: secondTitle },
          selected: true,
          updatedAt: now,
          history: [{ id: `${item.id}-split-history-${splitTaskTempId}`, field: '识别建议', before: item.suggestion.title, after: secondTitle, changedAt: now, actor: 'user', entityType: 'draft', entityId: item.id, action: 'split' }],
        }],
        updatedAt: now,
      }
    }))
    setRecognitionFeedback((current) => [...current, { id: `feedback-${Date.now()}-${current.length}`, draftId, originalKind: `task:${itemId}`, correctedKind: 'two_tasks', action: 'split', createdAt: new Date().toISOString() }])
    setNotice({ text: '已拆成两条待确认任务，请分别核对标题、时间和材料。' })
  }

  const handleMergeDraftItems = (draftId: string, sourceItemId: string, targetItemId: string) => {
    if (runtime) { rejectExperimentAction(); return }
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId || sourceItemId === targetItemId) return draft
      const sourceItem = draft.items.find((item) => item.id === sourceItemId)
      const targetItem = draft.items.find((item) => item.id === targetItemId)
      if (!sourceItem || !targetItem || sourceItem.status !== '待确认' || targetItem.status !== '待确认' || !draft.recognitionResult) return draft
      const now = new Date().toISOString()
      const recognitionResult = mergeRecognitionTasks(
        draft.recognitionResult,
        sourceItem.suggestion.id,
        targetItem.suggestion.id,
      )
      const merged = updateDraftItem(draft, targetItemId, {
        description: [targetItem.suggestion.description, sourceItem.suggestion.description].filter(Boolean).join('；'),
        materials: [...new Set([...targetItem.suggestion.materials, ...sourceItem.suggestion.materials])],
        evidence: [targetItem.suggestion.evidence, sourceItem.suggestion.evidence].filter(Boolean).join('；'),
        evidenceRefs: [...new Map([
          ...(targetItem.suggestion.evidenceRefs ?? []),
          ...(sourceItem.suggestion.evidenceRefs ?? []),
        ].map((item) => [item.id, item])).values()],
      }, undefined, now)
      return {
        ...updateDraftItem(merged, sourceItemId, {}, '已拒绝', now),
        recognitionResult,
        updatedAt: now,
      }
    }))
    setRecognitionFeedback((current) => [...current, { id: `feedback-${Date.now()}-${current.length}`, draftId, originalKind: `task:${sourceItemId}`, correctedKind: `task:${targetItemId}`, action: 'merged', createdAt: new Date().toISOString() }])
    setNotice({ text: '已合并到目标建议；原建议保留为已拒绝记录，可追溯。' })
  }

  const handleConfirmDraftItem = async (draftId: string, itemId: string) => {
    if (runtime) { await confirmExperiment([draftId], itemId); return }
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
      const message = error instanceof Error && error.message.startsWith('DOMAIN_COMMIT_PROJECT_DECISION_REQUIRED')
        ? '请先明确选择新建项目、关联已有项目或作为独立事项；“稍后决定”不会静默创建项目。'
        : error instanceof Error && error.message.startsWith('DOMAIN_COMMIT_PARENT_REQUIRED')
          ? '该子任务依赖父任务，请先一并勾选父任务后使用“全部加入”。'
          : '确认未写入：实体关系或时间仍需核对，现有数据未被部分修改。'
      setNotice({ text: message })
    }
  }

  const handleConfirmAll = async (draftId: string) => {
    if (runtime) { await confirmExperiment([draftId]); return }
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
    } catch (error) {
      setNotice({
        text: error instanceof Error && error.message.startsWith('DOMAIN_COMMIT_PROJECT_DECISION_REQUIRED')
          ? '请先明确项目归属；“稍后决定”不会创建项目或正式任务。'
          : '全部确认未写入：请检查父子任务、依赖和未确认时间，当前数据未被部分修改。',
      })
    }
  }

  const handleArchiveDrafts = (draftIds: string[]) => {
    if (runtime) { rejectExperimentAction(); return }
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
    if (runtime) { rejectExperimentAction(); return }
    const imported = await workspaceRepository.importAndReplace(serialized)
    persistedWorkspaceRevision.current = persistenceRevisionForView(imported)
    pendingWorkspaceRevision.current = null
    applyWorkspaceView(imported)
    setNotice({ text: '已导入 JSON 备份。' })
  }

  const handleExportWorkspace = async () => workspaceRepository.exportCurrentJson()

  const handleClearWorkspace = async () => {
    if (runtime) { rejectExperimentAction(); return }
    try {
      await workspaceRepository.clear()
      persistedWorkspaceRevision.current = null
      pendingWorkspaceRevision.current = null
      setTasks([])
      setSources([])
      setDrafts([])
      setProjects([])
      setCourseBlocks([])
      setIntegrations(createIntegrationState())
      setKnowledgeSettings({})
      setWorkPackages([])
      setMaterialItems([])
      setEvents([])
      setMigrationLog([])
      setRecognitionFeedback([])
      setLegacyData({})
      setNotice({ text: '已清空本机工作区。' })
    } catch {
      setNotice({ text: '清空未完成；本机数据仍保留，请稍后重试。' })
    }
  }

  const handleExportMigrationBackup = async () => {
    if (runtime) { rejectExperimentAction(); return }
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

  const handleExportRecoveryBackup = async () => {
    if (runtime) { rejectExperimentAction(); return }
    const recovery = workspaceRecovery
    if (!recovery || recovery.busy) return
    setWorkspaceRecovery({ ...recovery, busy: 'exporting', confirmationArmed: false, failureCode: null })
    try {
      const serialized = await workspaceRepository.exportMigrationBackup(recovery.backupId)
      if (!serialized) throw new Error('WORKSPACE_RECOVERY_BACKUP_MISSING')
      const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json;charset=utf-8' }))
      const anchor = document.createElement('a')
      const safeBackupId = recovery.backupId.replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '') || 'migration-backup'
      anchor.href = url
      anchor.download = `student-affairs-${safeBackupId}-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setWorkspaceRecovery((current) => current?.backupId === recovery.backupId
        ? { ...current, backupExported: true, confirmationArmed: false, busy: null, failureCode: null }
        : current)
    } catch (error) {
      const failureCode = safeWorkspaceRecoveryErrors(
        [error instanceof Error ? error.message : ''],
        'WORKSPACE_BACKUP_EXPORT_FAILED',
      )[0]
      setWorkspaceRecovery((current) => current?.backupId === recovery.backupId
        ? { ...current, backupExported: false, confirmationArmed: false, busy: null, failureCode }
        : current)
    }
  }

  const handleRequestWorkspaceRecovery = async () => {
    if (runtime) { rejectExperimentAction(); return }
    const recovery = workspaceRecovery
    if (!recovery || recovery.busy) return
    const action = nextWorkspaceRecoveryAction(recovery.backupExported, recovery.confirmationArmed)
    if (action === 'blocked') return
    if (action === 'arm') {
      setWorkspaceRecovery({ ...recovery, confirmationArmed: true, failureCode: null })
      return
    }

    setWorkspaceRecovery({ ...recovery, busy: 'recovering', failureCode: null })
    try {
      const recovered = await workspaceRepository.recoverMigration(recovery.backupId)
      persistedWorkspaceRevision.current = persistenceRevisionForView(recovered)
      pendingWorkspaceRevision.current = null
      applyWorkspaceView(recovered)
      setStorageError(false)
      setWorkspaceRecovery(null)
      setNotice({ text: '迁移数据已从指定备份恢复并重新校验；自动保存已恢复。' })
    } catch (error) {
      const nextBackupId = error instanceof WorkspaceRecoveryRequiredError ? error.backupId : recovery.backupId
      const errorCodes = error instanceof WorkspaceRecoveryRequiredError
        ? safeWorkspaceRecoveryErrors(error.errors)
        : safeWorkspaceRecoveryErrors(
            [error instanceof Error ? error.message : ''],
            'WORKSPACE_RECOVERY_FAILED',
          )
      setWorkspaceRecovery({
        backupId: nextBackupId,
        errorCodes,
        backupExported: nextBackupId === recovery.backupId && recovery.backupExported,
        confirmationArmed: false,
        busy: null,
        failureCode: errorCodes[0],
      })
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'today':
        return (
          <DashboardPage
            dateViews={dateViews}
            readOnly={Boolean(runtime)}
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
            onShowInbox={() => {
              setInboxView('needs_review')
              setCurrentPage('inbox')
            }}
            smartExtractionStatus={smartExtractionStatus}
          />
        )
      case 'inbox':
        return <InboxPage
          drafts={drafts}
          sources={sources}
          view={inboxView}
          onChangeView={setInboxView}
          onOpenDraft={(draftId) => { void selectDraftForReview(draftId) }}
          onConfirmDrafts={(draftIds) => { if (runtime) void confirmExperiment(draftIds); else draftIds.forEach(handleConfirmAll) }}
          onArchiveDrafts={handleArchiveDrafts}
          onOpenManual={() => setIntakeOpen(true)}
          onRetrySource={handleRetrySource}
          onManualSupplementSource={openManualSupplement}
        />
      case 'tasks':
        return (
          <TasksPage
            dateViews={dateViews}
            readOnly={Boolean(runtime)}
            tasks={tasks}
            projects={projects}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onCompleteTask={handleComplete}
          />
        )
      case 'calendar':
        return (
          <CalendarPage
            dateViews={dateViews}
            tasks={tasks}
            events={events}
            courseBlocks={courseBlocks}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onOpenEvent={(event) => setSelectedEventId(event.id)}
            onAddCourseBlock={(block) => setCourseBlocks((current) => [...current, block])}
            onRemoveCourseBlock={(blockId) => setCourseBlocks((current) => current.filter((block) => block.id !== blockId))}
          />
        )
      case 'library':
        return <LibraryPage sources={sources} drafts={drafts} onOpenIntake={() => setIntakeOpen(true)} onOpenDraft={(draftId) => { void selectDraftForReview(draftId) }} onRetrySource={handleRetrySource} onManualSupplementSource={openManualSupplement} onMarkIndependent={(sourceId) => {
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
          materials={materialItems}
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
          onOpenTask={(task) => setSelectedTaskId(task.id)}
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
        inboxView={inboxView}
        pendingReviewCount={pendingReviewCount}
        onNavigate={(page) => {
          if (runtime && !['today', 'inbox', 'tasks', 'calendar'].includes(page)) { rejectExperimentAction(); return }
          if (page === 'inbox') setInboxView('all')
          setCurrentPage(page)
        }}
        onOpenPendingReview={() => {
          setInboxView('needs_review')
          setCurrentPage('inbox')
        }}
        onOpenIntake={() => setIntakeOpen(true)}
        onOpenGuide={() => runtime ? rejectExperimentAction() : setGuideOpen(true)}
      />
      <div id="main-content" className="content-shell" tabIndex={-1}>
        {runtime && <section aria-label="隔离实验状态">
          <p>人工工程响应（非模型预测） · 独立测试库 · 无模型/通知外发</p>
          <p>仅本轮录入、核对、确认、查询与JSON备份可用；未纳入操作会明确阻断。</p>
          <button type="button" disabled={isolatedBusy || !workspaceReady || storageError} onClick={() => void performExperiment(async () => {
            const json = await runtime.exportJson()
            const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
            const link = document.createElement('a'); link.href = url; link.download = 'mainline-02-i1-workspace.json'; link.click(); URL.revokeObjectURL(url)
          })}>导出完整测试库 JSON</button>
        </section>}
        <PageLoadBoundary key={currentPage} onRetry={() => window.location.reload()}>
          <Suspense fallback={<main className="page page-loading" role="status">正在打开页面…</main>}>
            {renderPage()}
          </Suspense>
        </PageLoadBoundary>
      </div>

      {!workspaceReady && <div className="workspace-status" role="status">正在恢复本机工作区…</div>}
      {storageError && <div className="workspace-status error" role="alert">本机数据库不可用；当前页面中的更改不会保存。请停止编辑并重新加载后重试。</div>}
      {notice && <div className="app-toast" role="status"><span>{notice.text}</span>{notice.undo && <button type="button" onClick={() => { notice.undo?.(); setNotice(null) }}>撤销</button>}<button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button></div>}

      {workspaceRecovery && <WorkspaceRecoveryPanel
        backupId={workspaceRecovery.backupId}
        errorCodes={workspaceRecovery.errorCodes}
        backupExported={workspaceRecovery.backupExported}
        confirmationArmed={workspaceRecovery.confirmationArmed}
        busy={workspaceRecovery.busy}
        failureCode={workspaceRecovery.failureCode}
        onExportBackup={() => void handleExportRecoveryBackup()}
        onRequestRecovery={() => void handleRequestWorkspaceRecovery()}
        onCancelRecovery={() => setWorkspaceRecovery((current) => current
          ? { ...current, confirmationArmed: false }
          : current)}
      />}

      {!workspaceRecovery && intakeOpen && (
        <IntakePanel
          textOnly={Boolean(runtime)}
          onClose={() => setIntakeOpen(false)}
          onSubmitIntake={handleIntakeInput}
          onSaveSource={handleSaveSourceOnly}
          smartExtractionStatus={smartExtractionStatus}
        />
      )}
      {!workspaceRecovery && supplementSource && (
        <SourceSupplementPanel
          source={supplementSource}
          onClose={() => setSupplementSourceId(null)}
          onSubmit={(content, operationId) => handleManualSupplement(supplementSource.id, content, operationId)}
        />
      )}
      {!workspaceRecovery && selectedDraft && (!runtime || experimentalReview) && (
        <DraftReviewPanel
          key={runtime ? selectedDraft.id : undefined}
          isolatedCapabilities={Boolean(runtime)}
          confirmationV2={runtime && experimentalReview ? { busy: isolatedBusy || storageError, items: experimentalReview.states } : undefined}
          draft={selectedDraft}
          source={selectedDraftSource}
          onClose={() => setSelectedDraftId(null)}
          onUpdate={(itemId, patch) => handleUpdateDraft(selectedDraft.id, itemId, patch)}
          onConfirm={(itemId) => handleConfirmDraftItem(selectedDraft.id, itemId)}
          onReject={(itemId) => {
            if (runtime) { rejectExperimentAction(); return }
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
      {!workspaceRecovery && selectedTask && (
        <TaskDetailPanel
          readOnly={Boolean(runtime)}
          dateView={dateViews?.[selectedTask.id]}
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
      {!workspaceRecovery && selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          project={projects.find((project) => project.id === selectedEvent.projectId)}
          evidenceQuotes={selectedEventEvidenceQuotes}
          sourceTitles={selectedEventSourceTitles}
          onClose={() => setSelectedEventId(null)}
        />
      )}
      {!workspaceRecovery && guideOpen && <OnboardingGuide onClose={() => {
        markOnboardingComplete()
        setGuideOpen(false)
      }} />}
    </div>
  )
}

export default App
