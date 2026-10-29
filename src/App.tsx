import { assertMainlineRuntime, type MainlineRuntime } from './experiments/mainline02/runtime'
import type { WorkspaceV8 } from './domain/v2/types'
import { storedPersonalPlans } from './domain/v2/personalPlanD27'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DraftReviewPanel } from './components/DraftReviewPanel'
import { DirectResultList, RecentDirectAdditions } from './components/DirectResultList'
import { setTaskSchedule } from './domain/v2/taskSchedule'
import { commitDirectDraft, pendingDirectDraft, replaceDirectFallback, deleteDirectItem, editDirectItem, recentDirectBatches, undoDirectBatch } from './domain/v2/directIntake'
import {historicalDirectDraftIds,workspaceTaskChannels,pairFlowEvents,workspaceEventTimeHints} from './lib/homeFlow'
import { EventDetailPanel } from './components/EventDetailPanel'
import { IntakePanel } from './components/IntakePanel'
import { OnboardingGuide } from './components/OnboardingGuide'
import { PageLoadBoundary } from './components/PageLoadBoundary'
import { Sidebar } from './components/Sidebar'
import { SourceSupplementPanel } from './components/SourceSupplementPanel'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { WorkspaceRecoveryPanel } from './components/WorkspaceRecoveryPanel'
import { InboxPage } from './pages/InboxPage'
import { DashboardPage } from './pages/DashboardPage'
import { TasksPage } from './pages/TasksPage'
import { IndexedDbWorkspaceRepository, WorkspaceRecoveryRequiredError, WorkspaceViewConflictError } from './lib/repository'
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
import { ProxyDeepSeekExtractionService, type DeepSeekExtractionService } from './lib/deepseekExtraction'
import { buildLocalRecognition } from './recognition/pipeline'
import {
  nextWorkspaceRecoveryAction,
  safeWorkspaceRecoveryErrors,
  safeIntakeError,
  workspaceLoadFailureText,
  workspaceLoadDiagnosticV2 as workspaceLoadDiagnostic,
  workspacePersistenceRevision,
} from './lib/workspaceRecoveryUi'
import { markOnboardingComplete } from './lib/onboarding'
import { CapturePersistenceService } from './domain/v2/capture'
import { retryExistingSourceRecognition } from './domain/v2/sourceRetry'
import { mapSourceWorkflowItem, selectPendingReviewItems } from './lib/sourceWorkflow'
import { materialStatusFromLegacy } from './lib/domainEntities'
import { CanonicalWorkspaceRepository, IndexedDbWorkspaceRecordStore, type WorkspaceRecordStore } from './domain/v2/repository'
import { D20ReviewSessionRepository } from './experiments/candidate16/d20ReviewSession'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback, acknowledgeSourceReadback, sourceReviewProblem, sourceInformationReviewProblem, PENDING_SOURCE_READBACK, type SourceReviewReceipt } from './domain/v2/sourceReviewD26'
import { OrdinarySourceFacts } from './components/OrdinarySourceFacts'
import { SourceReadinessReview } from './components/SourceReadinessReview'
import { ReceiptOpportunityReview } from './components/ReceiptOpportunityReview'
import { applyReceiptOpportunity, type ReceiptOpportunityInput } from './domain/v2/receiptOpportunity'
import { applySourceReadiness, currentReadinessFlags, sourceReadinessProblem, type ReadinessInput } from './domain/v2/sourceReadiness'
import {eventDispositionField,type EventDisposition} from './domain/v2/eventDisposition'
import { PersonalPlanPanel } from './components/PersonalPlanPanel'
import { assembleProductFirstSuggestion } from './recognition/materialChannelGrounding'
import { sourceWindowsFromSidecar } from './recognition/sourceWindowGrounding'
import { workflowMaterialSupportFromSidecar } from './recognition/currentFactRoleProduct'
import { ordinaryWorkflowMaterialSupportFromSidecar, ordinaryProviderContextFromSidecar } from './recognition/ordinaryProviderSupport'
import { recognitionModeDescription } from './recognition/recognitionModePresentation'
import { taskSourceTimeSummary } from './recognition/sourceWindowPresentation'
import { sourceActionTimesFromSidecar } from './recognition/sourceActionTime'
import { groundTaskTimeWindows, taskTimeAuthorityFromSidecar } from './recognition/taskTimeAuthorityContract'
import { indexImmutableScopesV11 } from './recognition/scopeIndexV11'
import { projectSourceInformation } from './recognition/sourceInformationPreview'
import { eventEvidenceDraftId, eventSourceSupplement } from './recognition/eventSourceSupplement'
import {createOrdinaryMeasurement,type OrdinaryMeasurement} from './domain/v2/ordinaryMeasurementD26'
import {
  mergeRecognitionTasks,
  recognitionResultFromManualSuggestion,
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

const ordinaryStore = Object.assign(new IndexedDbWorkspaceRecordStore(), {name:'student-affairs-steward'})
const defaultCanonical = new CanonicalWorkspaceRepository(ordinaryStore)
const defaultViewRepository = new IndexedDbWorkspaceRepository(defaultCanonical)
const defaultCapture = new CapturePersistenceService(defaultCanonical)
const defaultExtraction = new ProxyDeepSeekExtractionService()
const defaultMeasurement=createOrdinaryMeasurement(ordinaryStore)
const defaultReviewSession = new D20ReviewSessionRepository(ordinaryStore, defaultMeasurement.changed, defaultMeasurement.activity, true)

/** Replaces transport/provider only; App, capture, review and DomainCommitPlan remain the ordinary product path. */
export interface OrdinaryAppEnvironment {
  /** Explicit opt-in for new direct-mode engineering tests; frozen review replays retain their original policy. */
  directMode?: boolean
  canonical: CanonicalWorkspaceRepository
  viewRepository: IndexedDbWorkspaceRepository
  reader: CanonicalWorkspaceRepository
  capture: CapturePersistenceService
  extraction: DeepSeekExtractionService
  reviewSession: D20ReviewSessionRepository
  measurement: OrdinaryMeasurement
  initial: WorkspaceData
  store: WorkspaceRecordStore & {name:string}
  label: string
  semanticSidecar?: (sourceId:string)=>unknown
  /** Recorded responses use their original inference clock, not the replay date. */
  recognitionContext?: (sourceText: string) => { referenceTime: string; timezone: string }
  pipelineVersion?: string
  recognitionMetadata?: () => { modelName: string; promptVersion: string; candidateVersion: string; build: string; responseRole: string; provider?: 'deepseek' | 'manual' | 'local-rules' }
}

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
    { preserveEditableViews: true },
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

function App({ runtime, ordinaryEnvironment }: { runtime?: MainlineRuntime; ordinaryEnvironment?: OrdinaryAppEnvironment } = {}) {
  const canonicalWorkspaceRepository = ordinaryEnvironment?.canonical ?? defaultCanonical
  const workspaceRepository = ordinaryEnvironment?.viewRepository ?? defaultViewRepository
  const capturePersistenceService = ordinaryEnvironment?.capture ?? defaultCapture
  const deepSeekExtractionService = ordinaryEnvironment?.extraction ?? defaultExtraction
  const ordinaryReviewSession = ordinaryEnvironment?.reviewSession ?? defaultReviewSession
  const ordinaryMeasurement = ordinaryEnvironment?.measurement ?? defaultMeasurement
  const independentReader = ordinaryEnvironment?.reader ?? new CanonicalWorkspaceRepository(ordinaryStore)
  if (runtime !== undefined) assertMainlineRuntime(runtime)
  const [boundRuntime] = useState(runtime)
  if (runtime !== boundRuntime) throw new Error('MAINLINE_RUNTIME_CHANGE_FORBIDDEN')
  const [initialWorkspace] = useState(() => runtime ? runtime.view(runtime.initial) : ordinaryEnvironment?.initial ?? loadWorkspace([], []))
  const [ordinaryCanonical, setOrdinaryCanonical] = useState<WorkspaceV8 | null>(null)
  const [ordinaryBusy,setOrdinaryBusy] = useState(false)
  const [ordinaryFactsDirty,setOrdinaryFactsDirty] = useState(false)
  const [ordinaryReadinessDirty,setOrdinaryReadinessDirty] = useState(false)
  const [ordinaryOpportunityDirty,setOrdinaryOpportunityDirty] = useState(false)
  const [ordinaryReceipt,setOrdinaryReceipt] = useState<SourceReviewReceipt | null>(null)
  const [viewConflict,setViewConflict] = useState<WorkspaceViewConflictError | null>(null)
  const ordinaryCommitLock = useRef(false)
  useEffect(()=>{
    if(runtime)return
    const visibility=()=>{void ordinaryMeasurement.visibility(document.hidden)}
    const blur=()=>{void ordinaryMeasurement.blur()}
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur)
    return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur)}
  },[runtime,ordinaryMeasurement])
  const [isolatedSnapshot, setIsolatedSnapshot] = useState<WorkspaceV8 | null>(runtime?.initial ?? null)
  const [realInputInitialText, setRealInputInitialText] = useState('')
  const RealInputPanel = runtime?.realInput?.inputPanel
  const [isolatedChoices, setIsolatedChoices] = useState<Record<string, Record<string, boolean>>>({})
  const [isolatedBusy, setIsolatedBusy] = useState(false)
  const [readbackPending, setReadbackPending] = useState(false)
  useEffect(() => {
    const recovery = runtime?.realInput?.readbackRecovery
    if (!recovery) return
    let live = true
    const update = () => { void recovery.pending().then(value => { if (live) setReadbackPending(Boolean(value)) }) }
    update()
    const unsubscribe = recovery.subscribe(update)
    return () => { live = false; unsubscribe() }
  }, [runtime])
  const [experimentExport, setExperimentExport] = useState<{ url: string; filename: string } | null>(null)
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
  const [workspaceLoadFailure, setWorkspaceLoadFailure] = useState<string | null>(null)
  const [workspaceDiagnostic, setWorkspaceDiagnostic] = useState<ReturnType<typeof workspaceLoadDiagnostic> | null>(null)
  const [workspaceLoadRetrying, setWorkspaceLoadRetrying] = useState(false)
  const [workspaceRecovery, setWorkspaceRecovery] = useState<WorkspaceRecoveryState | null>(null)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [directBatchId, setDirectBatchId] = useState<string | null>(null)
  const [directHistoryOpen, setDirectHistoryOpen] = useState(false)
  const [directReadbackPending, setDirectReadbackPending] = useState<string | null>(null)
  const [draftSourceSnapshot, setDraftSourceSnapshot] = useState<{ draftId: string; sourceVersionId: string; rawText: string } | null>(null)
  const [supplementSourceId, setSupplementSourceId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void; direct?: boolean } | null>(null)
  useEffect(() => {
    if (!notice?.direct) return
    const timer = setTimeout(() => setNotice(current => current === notice ? null : current), 10_000)
    return () => clearTimeout(timer)
  }, [notice])
  const directMode = !runtime && (ordinaryEnvironment ? ordinaryEnvironment.directMode === true : ordinaryCanonical?.preferences.legacyData?.directReviewBeforeAdd !== true)
  const directBatches = ordinaryCanonical ? recentDirectBatches(ordinaryCanonical) : []
  const activeDirectBatch = directBatches.find(b => b.id === directBatchId && b.status === 'active')
  const showDirectHistory=Boolean(activeDirectBatch&&directHistoryOpen)
  const [historicalAdding,setHistoricalAdding]=useState(false)
  const historicalDirectIds=ordinaryCanonical?historicalDirectDraftIds(ordinaryCanonical):[]
  const [ordinarySaveError, setOrdinarySaveError] = useState<{draftId:string;text:string}|null>(null)
  const [smartExtractionStatus, setSmartExtractionStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking')
  const initialServiceCheck = useRef<{service:DeepSeekExtractionService;promise:Promise<boolean>}|null>(null)
  const directRetriesInFlight=useRef(new Set<string>())
  const initialServiceReady=useCallback(()=>{
    if(initialServiceCheck.current?.service===deepSeekExtractionService)return initialServiceCheck.current.promise
    const promise=deepSeekExtractionService.status().then(status=>status.configured,()=>false).finally(()=>{
      if(initialServiceCheck.current?.promise===promise)initialServiceCheck.current=null
    })
    initialServiceCheck.current={service:deepSeekExtractionService,promise}
    return promise
  },[deepSeekExtractionService])
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => runtime || ordinaryEnvironment ? 'unsupported' : getBrowserNotificationPermission())
  const deliveredNotifications = useRef(new Set<string>())
  const hydrationPromise = useRef<Promise<WorkspaceData> | null>(null)
  const persistedWorkspaceRevision = useRef<string | null>(null)
  const pendingWorkspaceRevision = useRef<string | null>(null)
  useEffect(() => () => {
    if (experimentExport) URL.revokeObjectURL(experimentExport.url)
  }, [experimentExport])
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? null
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null
  const selectedEventDrafts = selectedEvent
    ? ordinaryCanonical
      ? drafts.filter(draft => draft.id === eventEvidenceDraftId(ordinaryCanonical,selectedEvent.id,selectedEvent.evidenceIds))
      : drafts.filter((draft) => draft.recognitionResult?.evidence.some((evidence) => selectedEvent.evidenceIds.includes(evidence.id)))
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
  const pendingReviewCount = useMemo(() => selectPendingReviewItems(sources, drafts, ordinaryCanonical ?? isolatedSnapshot ?? undefined)
    .reduce((count, item) => count + item.counts.pending, 0), [drafts, sources, ordinaryCanonical, isolatedSnapshot])
  const selectedDraftCurrentSource = selectedDraft
    ? sources.find((source) => source.id === selectedDraft.sourceId) ?? null
    : null
  const selectedDraftNeedsHistoricalSource = Boolean(
    selectedDraft?.sourceVersionId
    && selectedDraftCurrentSource?.currentVersionId
    && selectedDraft.sourceVersionId !== selectedDraftCurrentSource.currentVersionId,
  )
  const selectedDraftSourceBeforeReadiness = selectedDraftNeedsHistoricalSource
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
  const selectedDraftSource = !runtime && ordinaryCanonical && selectedDraft && selectedDraftSourceBeforeReadiness
    ? {...selectedDraftSourceBeforeReadiness,reviewMetadata:{...selectedDraftSourceBeforeReadiness.reviewMetadata,qualityFlags:currentReadinessFlags(ordinaryCanonical,selectedDraft.id,selectedDraftSourceBeforeReadiness.reviewMetadata?.qualityFlags??[])}}
    : selectedDraftSourceBeforeReadiness
  const workspace = useMemo(() => ({
    ...createWorkspaceData(tasks, sources, drafts, projects, courseBlocks, integrations, knowledgeSettings, workPackages, events, migrationLog, recognitionFeedback, legacyData, { preserveEditableViews: !runtime }),
    materialItems,
  }), [courseBlocks, drafts, events, integrations, knowledgeSettings, legacyData, materialItems, migrationLog, projects, recognitionFeedback, sources, tasks, workPackages, runtime])

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

  const refreshOrdinary = async () => {
    const saved=await workspaceRepository.load()
    const canonical=await canonicalWorkspaceRepository.load()
    if (!saved || !canonical) throw Error('WORKSPACE_V8_READBACK_UNAVAILABLE')
    persistedWorkspaceRevision.current=persistenceRevisionForView(saved)
    pendingWorkspaceRevision.current=null
    applyWorkspaceView(saved); setOrdinaryCanonical(canonical)
    const pending=canonical.extractionDrafts.map(d=>d.legacyData?.[PENDING_SOURCE_READBACK]).find(Boolean)
    if(pending&&typeof pending==='object'&&!Array.isArray(pending)&&pending.version==='source-review-d26-1')setOrdinaryReceipt(pending as unknown as SourceReviewReceipt)
  }

  useEffect(() => {
    if (runtime) return
    let active = true
    void initialServiceReady().then((configured) => {
      if (active) setSmartExtractionStatus(configured ? 'connected' : 'unavailable')
    })
    return () => { active = false }
  }, [runtime, initialServiceReady])

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
      void canonicalWorkspaceRepository.load().then(canonical=>{
        setOrdinaryCanonical(canonical)
        const pending=canonical?.extractionDrafts.map(d=>d.legacyData?.[PENDING_SOURCE_READBACK]).find(Boolean)
        if(pending&&typeof pending==='object'&&!Array.isArray(pending)&&pending.version==='source-review-d26-1')setOrdinaryReceipt(pending as unknown as SourceReviewReceipt)
        const repaired = canonical?.extractionDrafts.filter(d => d.legacyData?.diagnosticCompatibility).length ?? 0
        const isolated = canonical?.extractionDrafts.filter(d => {
          const recovery = d.legacyData?.storedDraftRecovery
          return recovery && typeof recovery === 'object' && !Array.isArray(recovery) && recovery.mode === 'isolated_unconfirmed_result'
        }).length ?? 0
        if (isolated) setNotice({ text: `数据已打开；${isolated} 份旧建议请到收件箱重新整理。` })
        else if (repaired) setNotice({ text: `已打开 ${repaired} 份旧草稿，原始备份已保留。` })
      }).catch(() => { if (active) setStorageError(true) })
      setStorageError(false)
      setWorkspaceLoadFailure(null)
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
      setWorkspaceLoadFailure(workspaceLoadFailureText(error))
      setWorkspaceDiagnostic(workspaceLoadDiagnostic(error))
      setStorageError(true)
    }).finally(() => {
      if (active) setWorkspaceReady(true)
    })
    return () => {
      active = false
    }
  }, [applyWorkspaceView, initialWorkspace.sources, initialWorkspace.tasks, runtime, canonicalWorkspaceRepository, workspaceRepository])

  useEffect(() => {
    if (runtime || !workspaceReady || storageError || workspaceRecovery || viewConflict || ordinaryBusy) return
    const revision = workspacePersistenceRevision(workspace)
    if (revision === persistedWorkspaceRevision.current || revision === pendingWorkspaceRevision.current) return
    pendingWorkspaceRevision.current = revision
    void workspaceRepository.save(workspace).then(() => {
      persistedWorkspaceRevision.current = revision
      if (pendingWorkspaceRevision.current === revision) pendingWorkspaceRevision.current = null
      // Planning consumes canonical facts. Refresh that read-model after ordinary course/status
      // saves without replacing any still-unsaved React edits with a compatibility projection.
      return canonicalWorkspaceRepository.load().then(current => { if (current) setOrdinaryCanonical(current) })
    }).catch((error:unknown) => {
      if (pendingWorkspaceRevision.current === revision) pendingWorkspaceRevision.current = null
      if(error instanceof WorkspaceViewConflictError)setViewConflict(error)
      else setStorageError(true)
    })
  }, [storageError, workspace, workspaceReady, workspaceRecovery, runtime, viewConflict, ordinaryBusy, workspaceRepository, canonicalWorkspaceRepository])

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
    if (runtime || ordinaryEnvironment || notificationPermission !== 'granted') return
    return scheduleBrowserNotifications(tasks, deliveredNotifications.current, () => {
      setNotice({ text: '浏览器通知发送失败，请检查网站通知权限。' })
    })
  }, [notificationPermission, tasks, runtime, ordinaryEnvironment])

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
      if (runtime.semantic) {
        const outcomes: string[] = []
        for (const draftId of draftIds) {
          let label = '草稿 ' + draftId
          try {
            const reviewed = runtime.review(current, draftId, isolatedChoices[draftId])
            label = (current.sources.find(source => source.id === reviewed.draft.sourceId)?.title || '来源') + '（' + draftId + '）'
            const items = reviewed.draft.items.filter(item => item.status === '待确认' && (itemId ? item.id === itemId : item.selected !== false))
            if (!items.length) { outcomes.push(label + '：未选择可确认任务，来源仍保留'); continue }
            if (runtime.realInput?.reviewSession) {
              const session = await runtime.realInput.reviewSession.load(current,draftId)
              for (const item of items) {
                const choice = session.fields[`task:${item.id}:selected`]
                if (choice?.conflict || choice?.mine === false) throw Error('确认选择已经变化；请重新打开并核对，未覆盖其他标签的选择。')
              }
            }
            current = await runtime.confirm({ draftId, revision: reviewed.revision, taskTempIds: items.map(item => item.suggestion.id) })
            outcomes.push(label + '：已确认保存 ' + items.length + ' 项，可在任务中心查找')
          } catch (error) {
            outcomes.push(label + (error instanceof Error && error.name === 'CommittedReadbackPendingError' ? '：' : '：该草稿未确认：') + (error instanceof Error ? error.message : '需重新核对'))
            current = await runtime.load()
          }
        }
        setNotice({ text: outcomes.join('；') + '。未确认建议和已保存编辑仍保留。' })
        return
      }
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

  const disposeExperiment = (draftId: string, kind: 'defer' | 'reject' | 'review_info', itemId?: string) => {
    if (!runtime?.semantic || !isolatedSnapshot || !experimentalReview) return
    const item = itemId ? experimentalReview.draft.items.find(i => i.id === itemId) : undefined
    if (itemId && !item) return
    const semantic = runtime.semantic
    void performExperiment(async () => {
      await semantic.dispose({ draftId, kind, taskTempIds: item ? [item.suggestion.id] : [],
        revision: experimentalReview.revision, operationId: crypto.randomUUID() })
      if (item) setIsolatedChoices(previous => {
        const choices = { ...previous[draftId] }; delete choices[item.id]
        return { ...previous, [draftId]: choices }
      })
      setNotice({ text: kind === 'review_info' ? '已标记核对完成，没有创建任务或空项目。'
        : kind === 'defer' ? '已保存为稍后核对，可从收件箱重新打开。' : '已记录不需要；原文和首次建议仍保留。' })
    })
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
      const recovery = canonicalDraft?.legacyData?.storedDraftRecovery
      if (recovery && typeof recovery === 'object' && !Array.isArray(recovery) && recovery.mode === 'isolated_historical_result') {
        setNotice({ text: '这份旧回答已保留在备份中，不会重复确认。已保存的事项可在任务和日历中查看。' })
        return
      }
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
    if(!runtime){setOrdinaryFactsDirty(false);await ordinaryMeasurement.begin(draftId)}
  }

  const openDraftReview = (draftId: string, message: string) => {
    setIntakeOpen(false)
    setInboxView('needs_review')
    setCurrentPage('inbox')
    void selectDraftForReview(draftId)
    setNotice({ text: message })
  }

  const undoDirect = async (batchId: string) => {
    await undoDirectBatch(canonicalWorkspaceRepository, batchId)
    await refreshOrdinary()
    if (directBatchId === batchId) setDirectBatchId(null)
    setNotice({text:'本次添加已撤销，之前的事项保持不变。',direct:true})
  }
  const scheduleDirectTask = async (taskId: string, date: string) => {
    await setTaskSchedule(canonicalWorkspaceRepository, taskId, date)
    try { await independentReader.load(); await refreshOrdinary() }
    catch { setDirectReadbackPending(directBatches.find(batch=>batch.status==='active'&&batch.items.some(item=>item.id===taskId))?.id??taskId) }
  }
  const addDirect = async (draftId: string) => {
    const receipt = await commitDirectDraft(canonicalWorkspaceRepository,draftId)
    try {
      const readback = await independentReader.load()
      if (!readback || receipt.batch?.status === 'active' && receipt.batch.items.some(i => ![...readback.tasks,...readback.events].some(e => e.id === i.id))) throw Error('DIRECT_READBACK_PENDING')
    } catch(error) {setDirectReadbackPending(receipt.batch?.id??draftId);throw Error('DIRECT_READBACK_PENDING',{cause:error})}
    setDirectReadbackPending(null)
    await refreshOrdinary()
    setIntakeOpen(false);setSelectedDraftId(null);setCurrentPage('today');setDirectBatchId(receipt.batch?.id??null);setDirectHistoryOpen(false)
    const batch=receipt.batch
    setNotice({text:receipt.duplicate?'本次整理已添加，无需重复提交':`已添加 ${batch?.items.length??0} 项`,direct:true,...(batch?{undo:()=>{void undoDirect(batch.id).catch(()=>setNotice({text:'未能撤销，原有内容保留。请从最近添加重试。'}))}}:{})})
  }
  const retryDirectFallback=async(batchId:string)=>{
    if(directRetriesInFlight.current.has(batchId))throw Error('正在重新整理，请稍候。')
    directRetriesInFlight.current.add(batchId)
    try{return await performDirectRetry(batchId)}finally{directRetriesInFlight.current.delete(batchId)}
  }
  const performDirectRetry=async(batchId:string)=>{
    const w=await canonicalWorkspaceRepository.load(),batch=w&&recentDirectBatches(w).find(b=>b.id===batchId&&b.origin==='local'&&b.status==='active')
    const source=batch&&w?.sources.find(s=>s.id===batch.sourceId),version=source&&w?.sourceVersions.find(v=>v.id===source.currentVersionId)
    if(!batch||!source||!version?.rawText)throw Error('未找到可以重新整理的通知')
    try{
      if(!ordinaryEnvironment){
        const ready=await initialServiceReady()
        setSmartExtractionStatus(ready?'connected':'unavailable')
        if(!ready)throw Error('DEEPSEEK_STATUS_UNAVAILABLE')
      }
      const metadata=ordinaryEnvironment?.recognitionMetadata?.()
      const retried=await retryExistingSourceRecognition(capturePersistenceService,source.id,{provider:'deepseek',modelName:metadata?.modelName??'deepseek-v4-flash',promptVersion:metadata?.promptVersion??null,pipelineVersion:'direct-ai-retry-v1',expectedSourceVersionId:version.id},async()=>deepSeekExtractionService.recognize!({sourceType:source.type,sourceTitle:source.title,content:version.rawText!,sourceId:source.id,sourceVersionId:version.id,now:new Date(version.createdAt)},{projects,tasks}))
      const sidecar=ordinaryEnvironment?.semanticSidecar?.(source.id)??deepSeekExtractionService.semanticSidecar?.(source.id,version.id)
      const context=ordinaryEnvironment?.recognitionContext?.(version.rawText)??ordinaryProviderContextFromSidecar(sidecar)??{referenceTime:retried.result.createdAt,timezone:w!.settings.defaultTimezone}
      const assembled=assembleProductFirstSuggestion(retried.result,{sourceText:version.rawText,...context,sourceWindows:sourceWindowsFromSidecar(sidecar),sourceActionTimes:sourceActionTimesFromSidecar(sidecar),workflowMaterialSupport:[...workflowMaterialSupportFromSidecar(sidecar),...ordinaryWorkflowMaterialSupportFromSidecar(sidecar)]})
      await canonicalWorkspaceRepository.transaction(current=>({...current,extractionDrafts:current.extractionDrafts.map(d=>d.id===retried.draftId?{...d,result:assembled.result,legacyData:{...d.legacyData,firstSuggestionDisplayed:JSON.parse(JSON.stringify(assembled.result)),...(sidecar?{semanticSidecar:JSON.parse(JSON.stringify(sidecar))}:{})}}:d),recognitionRuns:current.recognitionRuns.map(r=>r.id===current.extractionDrafts.find(d=>d.id===retried.draftId)?.recognitionRunId?{...r,legacyData:{...r.legacyData,originalRecognitionResult:JSON.parse(JSON.stringify(retried.result))}}:r)}))
      const receipt=await replaceDirectFallback(canonicalWorkspaceRepository,batchId,retried.draftId)
      setDirectBatchId(receipt.batch?.id??null)
      try{const readback=await independentReader.load();if(!readback||receipt.batch?.items.some(i=>![...readback.tasks,...readback.events].some(e=>e.id===i.id)))throw Error('READBACK');await refreshOrdinary()}catch(error){setDirectReadbackPending(receipt.batch!.id);throw Error('DIRECT_RETRY_READBACK_PENDING',{cause:error})}
      setNotice({text:'已用 AI 重新整理，原来的简单规则结果已替换。',direct:true})
    }catch(error){await refreshOrdinary().catch(()=>undefined);throw new Error(error instanceof Error&&error.message==='DIRECT_RETRY_READBACK_PENDING'?'AI 结果已保存，暂时未能读回。请使用重新读取，不会重复添加。':error instanceof Error&&/已修改过|原来的事项保留/u.test(error.message)?error.message:'AI 暂时仍不可用，原来的事项保留，可以稍后重新整理。',{cause:error})}
  }
  const ignoreHistoricalDirect=async()=>{
    try{await canonicalWorkspaceRepository.transaction(w=>({...w,preferences:{...w.preferences,legacyData:{...w.preferences.legacyData,ignoredHistoricalDraftIds:[...new Set([...(Array.isArray(w.preferences.legacyData?.ignoredHistoricalDraftIds)?w.preferences.legacyData.ignoredHistoricalDraftIds:[]),...historicalDirectIds])]}}}));await refreshOrdinary()}
    catch{setNotice({text:'没有保存成功，通知仍保留。请重试。'})}
  }
  const addHistoricalDirect=async()=>{
    if(historicalAdding)return
    setHistoricalAdding(true);const batches:string[]=[];let failed=0
    for(const id of historicalDirectIds){try{await addDirect(id);const w=await canonicalWorkspaceRepository.load(),batch=w&&recentDirectBatches(w).find(b=>b.draftId===id&&b.status==='active');if(batch)batches.push(batch.id)}catch{failed++;break}}
    setHistoricalAdding(false)
    setNotice({text:`已加入 ${batches.length} 条通知${failed?'，其余通知保留，可稍后重试':''}`,direct:true,...(batches.length?{undo:()=>{void(async()=>{for(const id of [...batches].reverse())await undoDirect(id)})().catch(()=>setNotice({text:'未能全部撤销，剩余记录保留，可从最近添加重试。'}))}}:{})})
  }
  const handleIntakeInput = async (input: IntakeInput) => {
    if (runtime?.realInput) {
      if (input.sourceType !== 'text' || input.manualSuggestion || input.multimodal || input.url || input.fileName) { rejectExperimentAction(); return }
      setRealInputInitialText(input.content); setIntakeOpen(true); return
    }
    if (runtime) {
      await performExperiment(async () => {
        const draftId = await runtime.capture(input)
        setIntakeOpen(false)
        setSelectedDraftId(draftId)
        setNotice({ text: runtime.recognitionDescription ?? '人工工程响应（非模型预测）；请核对后确认。' })
      })
      return
    }
    // First use may reach this handler before the empty workspace transaction finishes.
    // Join the existing hydration; never let capture race initialization or replace data.
    try {
      if (hydrationPromise.current) await hydrationPromise.current
    } catch (error) {
      throw new Error(`${workspaceLoadFailureText(error)} 新通知尚未保存，输入已保留。`, { cause: error })
    }
    if (storageError || workspaceRecovery) throw new Error('本机数据正在保护中，输入已保留。请先完成数据恢复，再整理新通知。')
    if (directMode) {
      if (directReadbackPending) throw new Error('本次内容已保存，请先点击“重新读取”后再整理。')
      const current=await canonicalWorkspaceRepository.load()
      const pending=current&&pendingDirectDraft(current,input.content)
      if(pending){
        await addDirect(pending.id)
        if(!pending.result)setNotice(current=>current?{...current,text:current.text+' · 本次使用本机整理'}:current)
        return
      }
    }
    const intakeClock=input.now??new Date()
    const localResult = createIntakeResult({...input,now:intakeClock})
    const localRecognition = buildLocalRecognition({
      sourceType: input.sourceType,
      sourceTitle: input.sourceTitle ?? input.fileName ?? localResult.source.title,
      content: input.content,
      referenceTime: intakeClock,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      projects,
      tasks,
    })
    const draftRecognition = input.manualSuggestion
      ? recognitionResultFromManualSuggestion(localRecognition, input.manualSuggestion)
      : localRecognition
    // An invalid recording is a source-level rejection, not an unavailable
    // provider. Keep injected offline providers separate from local fallback.
    const awaitInitialService=directMode&&!ordinaryEnvironment
    const useCloudRecognition = !input.manualSuggestion && (Boolean(ordinaryEnvironment?.extraction.recognize) || smartExtractionStatus === 'connected'||awaitInitialService)
    const reviewQualityFlags = [...new Set([
      ...(input.reviewMetadata?.qualityFlags ?? []),
      ...(input.multimodal
        ? [`多模态实验：本次显式发送 ${input.multimodal.images.length} 张图片/页面与 OCR 文字；图片未写入工作区`]
        : []),
      ...(useCloudRecognition && input.content.length > 24_000
        ? ['DeepSeek 本次仅接收前 24,000 字，后续正文未进入模型识别']
        : []),
    ])]
    const metadata = input.manualSuggestion ? undefined : ordinaryEnvironment?.recognitionMetadata?.()
    const sourceClock = ordinaryEnvironment?.recognitionContext?.(input.content)
    const captureRequest = {
      operationId: input.operationId ?? crypto.randomUUID(),
      sourceType: input.sourceType,
      title: input.sourceTitle ?? input.fileName ?? localResult.source.title,
      rawText: input.content,
      provider: ordinaryEnvironment ? metadata?.provider ?? 'manual' as const : input.manualSuggestion
        ? 'manual' as const
        : useCloudRecognition
          ? 'deepseek' as const
          : 'local-rules' as const,
      modelName: input.manualSuggestion ? 'manual-entry' : metadata?.modelName ?? (ordinaryEnvironment ? 'anonymous-offline-engineering-input' : useCloudRecognition
          ? input.multimodal
            ? 'deepseek-v4-flash-vision-exp'
            : 'deepseek-v4-flash'
          : 'local-rules'),
      promptVersion: input.manualSuggestion ? null : metadata?.promptVersion ?? (input.multimodal ? MULTIMODAL_PROMPT_VERSION : localRecognition.promptVersion),
      pipelineVersion: ordinaryEnvironment ? ordinaryEnvironment.pipelineVersion ?? 'd26-ordinary-engineering-fake-transport' : useCloudRecognition
        ? input.multimodal ? 'source-before-multimodal-ai-v1' : 'source-before-ai-v1'
        : 'source-before-local-rules-v1',
      sourceLegacyData: {
        ...(metadata ? { recognitionProvenance: { ...metadata, componentVersion: ordinaryEnvironment?.pipelineVersion ?? null, referenceTime: sourceClock?.referenceTime ?? null, timezone: sourceClock?.timezone ?? null } } : {}),
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
      now: intakeClock.toISOString(),
    }
    try {
      const handle = await capturePersistenceService.beginCapture(captureRequest)
      if (handle.duplicate) {
        const stored = await canonicalWorkspaceRepository.load()
        const existing = stored?.extractionDrafts.find(d => d.id === handle.draftId)
        if (existing?.result) {
          if(directMode){await addDirect(handle.draftId);return}
          const saved = await workspaceRepository.load()
          if (saved) applyWorkspaceView(saved)
          setOrdinaryCanonical(stored)
          openDraftReview(handle.draftId, '已打开这次录入的原草稿；首次建议、修改和确认结果保留，未重复识别。')
          return
        }
      }
      const providerInput={...input,now:intakeClock,sourceId:handle.sourceId,sourceVersionId:handle.sourceVersionId}
      const recognitionResult = await capturePersistenceService.recognize(
        handle,
        input.manualSuggestion
          ? async () => draftRecognition
          : useCloudRecognition
            ? async () => {
              // Source and draft are already durable. A quick first click must
              // join the bounded initial check instead of silently choosing local rules.
              if(awaitInitialService&&!(await initialServiceReady()))throw new Error('DEEPSEEK_STATUS_UNAVAILABLE')
              return deepSeekExtractionService.recognize!(providerInput, { projects, tasks })
            }
            : async () => draftRecognition,
      )
      const semanticSidecar=!input.manualSuggestion && useCloudRecognition
        ? ordinaryEnvironment?.semanticSidecar?.(handle.sourceId) ?? deepSeekExtractionService.semanticSidecar?.(handle.sourceId,handle.sourceVersionId)
        : undefined
      const inferenceContext=ordinaryEnvironment?.recognitionContext?.(input.content) ?? ordinaryProviderContextFromSidecar(semanticSidecar) ?? {referenceTime:input.now?.toISOString() ?? recognitionResult.createdAt,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'}
      const assembled=assembleProductFirstSuggestion(recognitionResult,{sourceText:input.content,...inferenceContext,sourceWindows:sourceWindowsFromSidecar(semanticSidecar),sourceActionTimes:sourceActionTimesFromSidecar(semanticSidecar),workflowMaterialSupport:[...workflowMaterialSupportFromSidecar(semanticSidecar),...ordinaryWorkflowMaterialSupportFromSidecar(semanticSidecar)]})
      if(taskTimeAuthorityFromSidecar(semanticSidecar)){
        const grounded=groundTaskTimeWindows(assembled.result,semanticSidecar,{index:await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,input.content),...inferenceContext})
        assembled.result=grounded.result
      }
      const sourceInformation=projectSourceInformation(assembled.result,{sourceId:handle.sourceId,sourceVersionId:handle.sourceVersionId,text:input.content})
      await canonicalWorkspaceRepository.transaction(w=>({...w,recognitionRuns:w.recognitionRuns.map(r=>r.id===handle.recognitionRunId?{...r,legacyData:{...r.legacyData,originalRecognitionResult:JSON.parse(JSON.stringify(recognitionResult))}}:r),extractionDrafts:w.extractionDrafts.map(d=>d.id===handle.draftId?{...d,result:assembled.result,legacyData:{...d.legacyData,...(semanticSidecar?{semanticSidecar:JSON.parse(JSON.stringify(semanticSidecar))}:{}),firstSuggestionDisplayed:JSON.parse(JSON.stringify(assembled.result)),firstSourceInformationDisplayed:JSON.parse(JSON.stringify(sourceInformation)),firstSuggestionAssembly:JSON.parse(JSON.stringify(assembled.audit)),materialChannelGrounding:JSON.parse(JSON.stringify(assembled.materialChannelAudit)),sourceWindowGrounding:JSON.parse(JSON.stringify(assembled.sourceWindowGrounding))}}:d)}))
      if(directMode){await addDirect(handle.draftId);return}
      const saved = await workspaceRepository.load()
      if (saved) applyWorkspaceView(saved)
      setOrdinaryCanonical(await canonicalWorkspaceRepository.load())
      setStorageError(false)
      if (useCloudRecognition) setSmartExtractionStatus('connected')
      openDraftReview(
        handle.draftId,
        input.manualSuggestion
          ? '手动录入已先保存来源，再生成待确认草稿；核对后才会创建正式任务。'
          : ordinaryEnvironment && metadata?.responseRole === 'RECORDED_MODEL_ENGINEERING_REPLAY' ? '真实模型回答已回放；本次没有新模型请求，核对后走普通正式保存。'
          : ordinaryEnvironment && metadata?.provider !== 'deepseek' ? '匿名工程建议已生成；没有模型请求，核对后走普通正式保存。' : useCloudRecognition
            ? `${recognitionResult.modelName} 已生成可编辑建议；来源已在请求前安全保存。`
            : 'DeepSeek 当前未连接；来源已先保存，并由本地规则生成可编辑建议。',
      )
    } catch (error) {
      const reason = safeIntakeError(error, '整理暂时没有完成')
      if(directMode){
        // Recognition failure can use the preserved text. Storage/commit and
        // post-commit read failures must never be mistaken for model failures.
        if(!(error instanceof Error&&error.message==='DIRECT_READBACK_PENDING')){
          const w=await canonicalWorkspaceRepository.load().catch(()=>null)
          const source=w?.sources.find(s=>s.legacyData?.captureOperationId===captureRequest.operationId)
          const failed=w?.recognitionRuns.find(r=>r.sourceVersionId===source?.currentVersionId&&r.status==='failed')
          const draft=failed&&w?.extractionDrafts.find(d=>d.recognitionRunId===failed.id&&!d.result)
          if(draft){try{await addDirect(draft.id);setNotice(current=>current?{...current,text:current.text+' · 本次使用本机整理'}:current);return}catch(fallbackError){if(fallbackError instanceof Error&&fallbackError.message==='DIRECT_READBACK_PENDING'){await refreshOrdinary().catch(()=>undefined);throw new Error('内容已添加，暂时未能读回。请使用重新读取，不会重复添加。',{cause:fallbackError})}}}
        }
        await refreshOrdinary().catch(()=>undefined)
        const message=error instanceof Error&&error.message==='DIRECT_READBACK_PENDING'?'内容已添加，暂时未能读回。请使用重新读取，不会重复添加。':'这次未能完成添加，输入仍保留。请重试；已保存的内容不会重复添加。'
        setNotice({text:message})
        throw new Error(message,{cause:error})
      }
      if (useCloudRecognition && !ordinaryEnvironment) setSmartExtractionStatus('unavailable')
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
        setStorageError(false)
        setNotice({ text: `${reason}；原始来源已安全保存。可在收件箱重试识别、查看原文或手动整理。` })
      } catch {
        const saved = await workspaceRepository.load().catch(() => null)
        if (saved) applyWorkspaceView(saved)
        setStorageError(true)
        setNotice({ text: `${reason}；来源保存状态需要检查，请勿重复关闭页面。` })
        // A fulfilled capture promise tells the intake UI it can clear input.
        // No durable Source means failure must reach that UI instead.
        throw new Error(`${reason}；原文尚未保存，输入已保留。请保留此页或复制原文后手动重试。`, { cause: error })
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
      const message = safeIntakeError(error, '链接保存失败，请稍后重试。')
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

  const handleQuickCapture = async (content: string, operationId: string) => {
    await handleIntakeInput({ sourceType: 'text', content, operationId })
  }

  const handleUpdateDraft = async (
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
      return performExperiment(async () => {
        await runtime.edit({ draftId, taskTempId: item.suggestion.id, revision: experimentalReview.revision,
          operationId: crypto.randomUUID(), field: field as 'title' | 'deadline', value: value as string })
        setNotice({ text: '修改已明确保存；尚未创建任务。' })
      })
    }
    const nextDrafts=drafts.map(draft=>draft.id===draftId?updateDraftItem(draft,itemId,patch,status):draft)
    try {
      if(ordinaryCanonical&&(status==='已拒绝'||Object.keys(patch).some(k=>!['title','deadline'].includes(k)))){
        const before=drafts.find(d=>d.id===draftId)?.items.find(i=>i.id===itemId)
        await ordinaryReviewSession.stage(ordinaryCanonical,draftId,`task:${itemId}:facts`,before?.suggestion??{},nextDrafts.find(d=>d.id===draftId)?.items.find(i=>i.id===itemId)??{},ordinaryReviewSession.writer)
      }
      await workspaceRepository.save({...workspace,drafts:nextDrafts})
      await refreshOrdinary()
      setNotice({text:'草稿修改已保存；正式事实尚未创建。'})
    }catch(error){
      if(error instanceof WorkspaceViewConflictError)setViewConflict(error)
      setNotice({text:'草稿修改尚未保存；输入保留，请处理冲突或手动重试。'})
      throw error
    }
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

  const handleToggleDraftItemSelection = (draftId: string, itemId: string, selected: boolean, justReviewed=false) => {
    if (runtime) {
      if (isolatedLock.current || !justReviewed && experimentalReview?.states[itemId]?.blockedReason) return
      if (runtime.realInput?.reviewSession && isolatedSnapshot) {
        const session = runtime.realInput.reviewSession
        void performExperiment(async () => {
          const key = `task:${itemId}:selected`, prior = (await session.load(isolatedSnapshot, draftId)).fields[key]
          const stored = await session.stage(isolatedSnapshot, draftId, key, prior?.base ?? false, selected, session.writer, false)
          if (stored.fields[key].conflict) throw Error('确认选择发生冲突；请重新打开通知并明确选择版本。')
          setIsolatedChoices(previous => ({ ...previous, [draftId]: { ...previous[draftId], [itemId]: selected } }))
        })
        return
      }
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

  const retryOrdinaryReadback = async (receipt=ordinaryReceipt) => {
    if(!receipt)return
    setOrdinaryBusy(true)
    try {
      await verifySourceReviewReadback(independentReader,receipt)
      await ordinaryMeasurement.readback(receipt)
      await acknowledgeSourceReadback(canonicalWorkspaceRepository,receipt)
      setOrdinaryReceipt(null)
      await refreshOrdinary()
      if(receipt.disposition!=='partial')await ordinaryMeasurement.finish(receipt.draftId,receipt.disposition==='no_task')
      setNotice({text:'正式事实已保存，独立读回已验证。'})
      if(receipt.disposition!=='partial'&&selectedDraftId===receipt.draftId&&!ordinaryFactsDirty&&!ordinaryReadinessDirty&&!ordinaryOpportunityDirty){setSelectedDraftId(null);setCurrentPage('today')}
    } catch {setNotice({text:'已提交，读回尚未验证；请手动重新读回，勿重复提交。'})}
    finally{setOrdinaryBusy(false)}
  }

  const confirmOrdinary = async (draftId:string,itemId?:string) => {
    if(ordinaryCommitLock.current||ordinaryReceipt||ordinaryFactsDirty||ordinaryReadinessDirty||ordinaryOpportunityDirty)return
    const draft=drafts.find(d=>d.id===draftId)
    if(!draft?.recognitionResult)return
    ordinaryCommitLock.current=true;setOrdinaryBusy(true);setOrdinarySaveError(null)
    let receipt:SourceReviewReceipt|null=null,waiting=false
    try {
      await ordinaryMeasurement.wait(draftId);waiting=true
      await workspaceRepository.save(workspace)
      const canonical=await canonicalWorkspaceRepository.load()
      if(!canonical)throw Error('WORKSPACE_V8_NOT_INITIALIZED')
      const plan=buildSourceReviewPlan(canonical,draft,itemId)
      receipt=await commitSourceReview(canonicalWorkspaceRepository,plan)
      setOrdinaryReceipt(receipt)
      const committed=(await canonicalWorkspaceRepository.load())!
      const session=await ordinaryReviewSession.load(committed,draftId)
      await ordinaryMeasurement.committed(receipt,session,committed)
      await verifySourceReviewReadback(independentReader,receipt)
      await ordinaryMeasurement.waitEnd(draftId);waiting=false
      await ordinaryMeasurement.readback(receipt)
      await acknowledgeSourceReadback(canonicalWorkspaceRepository,receipt)
      setOrdinaryReceipt(null)
      await refreshOrdinary()
      if(receipt.disposition!=='partial')await ordinaryMeasurement.finish(draftId,receipt.disposition==='no_task')
      setNotice({text:`已保存并独立读回：${plan.create.tasks.length} 项任务、${plan.create.events.length} 个事件；不确定时间保持原状。`})
      if(!itemId&&receipt.disposition!=='partial'){setSelectedDraftId(null);setCurrentPage('today')}
    }catch(error){
      // A full/unavailable browser store can reject the failure log too. That
      // secondary failure must not hide the original error from the dialog.
      let diagnosticWriteFailed=false
      try {
        if(waiting)await ordinaryMeasurement.waitEnd(draftId)
        await ordinaryMeasurement.failure(draftId,error instanceof Error?error.message:'UNKNOWN')
      } catch { diagnosticWriteFailed=true }
      if(error instanceof WorkspaceViewConflictError)setViewConflict(error)
      const text=receipt?'已提交，读回尚未验证；输入和提交记录保留，请重新读回，勿重复提交。'
        :error instanceof WorkspaceViewConflictError?'其他页面修改了相同内容。你的输入保留，请核对差异。'
        :error instanceof Error&&error.message==='DOMAIN_COMMIT_PROJECT_DECISION_REQUIRED'?'请在下方选择作为独立事项，或关联项目，再添加。当前尚未创建正式事项。'
        :'暂时未能保存。本通知和建议仍在，没有留下半份事项；请重试添加，或先关闭稍后处理。'
      const visibleText=diagnosticWriteFailed?`${text} 浏览器保存仍不可用，请保留原文，不要清空已有数据。`:text
      setNotice({text:visibleText});setOrdinarySaveError({draftId,text:visibleText})
    }finally{ordinaryCommitLock.current=false;setOrdinaryBusy(false)}
  }
  const handleConfirmDraftItem = async (draftId:string,itemId:string) => {
    if(runtime){await confirmExperiment([draftId],itemId);return}
    await confirmOrdinary(draftId,itemId)
  }
  const handleConfirmAll = async (draftId:string) => {
    if(runtime){await confirmExperiment([draftId]);return}
    await confirmOrdinary(draftId)
  }

  const handleOrdinaryFacts = async (draftId:string,result:NonNullable<ExtractionDraft['recognitionResult']>,decision?:{eventId:string;before:EventDisposition;after:EventDisposition}) => {
    const nextDrafts=drafts.map(d=>d.id===draftId?{...d,recognitionResult:result,updatedAt:new Date().toISOString()}:d)
    const history=decision?[...workspace.historyRecords,{id:crypto.randomUUID(),entityType:'draft' as const,entityId:draftId,action:'updated',field:eventDispositionField(decision.eventId),before:decision.before,after:decision.after,actor:'user' as const,changedAt:new Date().toISOString()}]:workspace.historyRecords
    await workspaceRepository.save({...workspace,drafts:nextDrafts,historyRecords:history})
    await refreshOrdinary()
    setNotice({text:'草稿纠正已保存；原始首次回答不变，尚未正式确认。'})
  }
  const handleOrdinaryReadiness = async (draftId:string,input:ReadinessInput) => {
    await canonicalWorkspaceRepository.transaction(w=>applySourceReadiness(w,draftId,input))
    await refreshOrdinary()
    setNotice({text:'本组适用判断已保存，原答和首次建议保留。尚未创建正式任务，前置事项仍须实际完成。'})
  }
  const handleOrdinaryOpportunity = async (draftId:string,input:ReceiptOpportunityInput) => {
    await canonicalWorkspaceRepository.transaction(w=>applyReceiptOpportunity(w,draftId,input))
    await refreshOrdinary()
    setNotice({text:'已记录本次办理机会，仍为同一项领取；原始窗口和首次建议保留。'})
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
    setNotice(null) // A previous successful import must not mask a new rejection.
    const imported = await workspaceRepository.importAndReplace(serialized)
    persistedWorkspaceRevision.current = persistenceRevisionForView(imported)
    pendingWorkspaceRevision.current = null
    applyWorkspaceView(imported)
    setOrdinaryCanonical(await canonicalWorkspaceRepository.load())
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
    let serialized: string | null
    try {
      serialized = await workspaceRepository.exportLatestMigrationBackup()
    } catch {
      setNotice({ text: '升级前备份暂时无法读取，当前数据未改动。请先导出当前数据，并保留原备份后重试。' })
      return
    }
    if (!serialized) {
      setNotice({ text: '当前没有已生成的升级前备份。涉及升级的首次写入会先另存快照；现在可在项目档案导出当前数据。' })
      return
    }
    const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `student-affairs-upgrade-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
    setNotice({ text: '已下载升级前备份；恢复前请先保留当前数据备份。' })
  }

  const retryWorkspaceLoading = async (repairHistory = false) => {
    if (!workspaceLoadFailure || workspaceLoadRetrying || runtime) return
    setWorkspaceLoadRetrying(true)
    // Only available after initial loading failed: never discard unsaved edits
    // following a later write failure. Keep the user's intake text mounted.
    const attempt = (repairHistory ? workspaceRepository.recoverHistoricalDrafts() : workspaceRepository.load()).then(saved => {
      if (!saved) throw new Error('WORKSPACE_RECOVERY_EMPTY')
      return saved
    })
    hydrationPromise.current = attempt
    try {
      const saved = await attempt
      const canonical = await canonicalWorkspaceRepository.load()
      persistedWorkspaceRevision.current = persistenceRevisionForView(saved)
      pendingWorkspaceRevision.current = null
      applyWorkspaceView(saved)
      setOrdinaryCanonical(canonical)
      setWorkspaceLoadFailure(null)
      setWorkspaceDiagnostic(null)
      setStorageError(false)
      setNotice({ text: repairHistory ? '本机数据已打开。旧识别回答已完整备份，已保存的任务和日程保持不变；输入框内容仍保留。' : '本机数据已重新打开；输入框中的通知仍保留，可以继续整理。' })
    } catch (error) {
      setWorkspaceLoadFailure(workspaceLoadFailureText(error))
      setWorkspaceDiagnostic(workspaceLoadDiagnostic(error))
      setStorageError(true)
    } finally {
      setWorkspaceLoadRetrying(false)
    }
  }

  const exportProtectedBackup = async () => {
    try {
      const serialized = await workspaceRepository.exportProtectedCurrentSnapshot()
      if (!serialized) { setNotice({ text: '未读到原始记录，请保留当前页面，不要清空浏览器数据。' }); return }
      downloadRecoveryFile(serialized, 'original-backup')
      setNotice({ text: '原始记录备份已下载，包含本机通知和任务，请妥善保存。下载不会更改浏览器内的数据。' })
    }
    catch { setNotice({ text: '备份暂时无法下载，原记录没有被覆盖。请保留当前页面，不要清空浏览器数据。' }) }
  }

  const downloadRecoveryFile = (serialized: string, label: string) => {
    const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `student-affairs-${label}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.append(anchor); anchor.click(); anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
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
      hydrationPromise.current = Promise.resolve(recovered)
      persistedWorkspaceRevision.current = persistenceRevisionForView(recovered)
      pendingWorkspaceRevision.current = null
      applyWorkspaceView(recovered)
      setOrdinaryCanonical(await canonicalWorkspaceRepository.load())
      setWorkspaceLoadFailure(null)
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
            directMode={directMode}
            directNotice={notice?.direct?<div className="direct-inline-notice" role="status"><span>{notice.text}</span>{notice.undo&&<button type="button" className="text-button" onClick={()=>{notice.undo?.();setNotice(null)}}>撤销</button>}<button type="button" className="icon-button" aria-label="关闭提示" onClick={()=>setNotice(null)}>×</button></div>:undefined}
            recentAdditions={directMode&&ordinaryCanonical?<RecentDirectAdditions workspace={ordinaryCanonical} batches={directBatches} onRetry={retryDirectFallback} onUndo={undoDirect} onOpen={id=>{setDirectBatchId(id);setDirectHistoryOpen(true)}} onDetail={(id,kind)=>kind==='task'?setSelectedTaskId(id):setSelectedEventId(id)} onEdit={async(id,edit)=>{await editDirectItem(canonicalWorkspaceRepository,id,edit);await refreshOrdinary()}} onDelete={async id=>{await deleteDirectItem(canonicalWorkspaceRepository,id);await refreshOrdinary()}}/>:undefined}
            historicalNotice={directMode?{count:historicalDirectIds.length,busy:historicalAdding,onAdd:addHistoricalDirect,onIgnore:ignoreHistoricalDirect}:undefined}
            planning={!runtime && ordinaryCanonical ? <PersonalPlanPanel workspace={ordinaryCanonical} repository={canonicalWorkspaceRepository} reader={independentReader} store={ordinaryEnvironment?.store ?? ordinaryStore} onReload={()=>refreshOrdinary()}/> : undefined}
            engineeringInput={Boolean(ordinaryEnvironment)}
            engineeringInputLabel={ordinaryEnvironment?.recognitionMetadata?.().responseRole==='RECORDED_MODEL_ENGINEERING_REPLAY'?'真实回答固定回放 · 不新增模型请求':undefined}
            realInput={runtime?.realInput}
            dateViews={dateViews}
            readOnly={Boolean(runtime)}
            tasks={tasks}
            projects={projects}
            pendingReviewCount={pendingReviewCount}
            events={events}
            onOpenEvent={(event) => setSelectedEventId(event.id)}
            onShowCalendar={() => setCurrentPage('calendar')}
            onQuickCapture={handleQuickCapture}
            onOpenIntake={() => setIntakeOpen(true)}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onCompleteTask={handleComplete}
            onScheduleTask={scheduleDirectTask}
            taskChannels={workspaceTaskChannels(ordinaryCanonical)}
            canonicalWorkspace={ordinaryCanonical}
            recentItemIds={activeDirectBatch?.items.map(item=>item.id)}
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
        return <>{runtime?.realInput?.draftEditor&&isolatedSnapshot?.extractionDrafts.some(d=>d.status==='failed'&&typeof (d.legacyData?.mainline05Failure as {response?:unknown}|undefined)?.response==='string')&&
          <section className="page" aria-label="识别失败后的人工纠错"><h2>保留原回答，继续纠错</h2><p>以下回答有结构或关系错误。可对照完整原文修正后确认；不重新识别、不改原失败记录。</p>
            {isolatedSnapshot.extractionDrafts.filter(d=>d.status==='failed'&&typeof (d.legacyData?.mainline05Failure as {response?:unknown}|undefined)?.response==='string').map(d=><button className="secondary-button" type="button" key={d.id} onClick={()=>void selectDraftForReview(d.id)}>
              纠错：{sources.find(s=>s.id===drafts.find(view=>view.id===d.id)?.sourceId)?.title??'失败通知'}</button>)}</section>}
          <InboxPage
          onDirectAdd={directMode?addDirect:undefined}
          canonicalWorkspace={ordinaryCanonical??isolatedSnapshot??undefined}
          drafts={drafts}
          sources={sources}
          view={inboxView}
          onChangeView={setInboxView}
          onOpenDraft={(draftId) => { void selectDraftForReview(draftId) }}
          onConfirmDrafts={async (draftIds) => { if (runtime) await confirmExperiment(draftIds); else for(const id of draftIds) await handleConfirmAll(id) }}
          onArchiveDrafts={handleArchiveDrafts}
          onOpenManual={() => setIntakeOpen(true)}
          onRetrySource={handleRetrySource}
          onManualSupplementSource={openManualSupplement}
        /></>
      case 'tasks':
        return (
          <TasksPage
            directMode={directMode} workspace={ordinaryCanonical} events={events} onScheduleTask={scheduleDirectTask} onOpenEvent={event=>setSelectedEventId(event.id)}
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
            directMode={directMode} onCompleteTask={handleComplete} onScheduleTask={scheduleDirectTask} taskChannels={workspaceTaskChannels(ordinaryCanonical)}
            preserveDateOnlyPrecision={Boolean(ordinaryCanonical)}
            personalPlanTimezone={ordinaryCanonical?.settings.defaultTimezone}
            personalPlans={!runtime && ordinaryCanonical ? storedPersonalPlans(ordinaryCanonical).filter(p => !['completed', 'cancelled'].includes(ordinaryCanonical.tasks.find(t => t.id === p.taskId)?.status ?? '')) : undefined}
            pendingDateTaskIds={runtime?.realInput?.pendingDateTaskIds&&isolatedSnapshot?runtime.realInput.pendingDateTaskIds(isolatedSnapshot):undefined}
            dateViews={dateViews}
            isolatedTimezone={runtime?.semantic?.timezone}
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
        return <LibraryPage canonicalWorkspace={ordinaryCanonical??isolatedSnapshot??undefined} sources={sources} drafts={drafts} onOpenIntake={() => setIntakeOpen(true)} onOpenDraft={(draftId) => { void selectDraftForReview(draftId) }} onRetrySource={handleRetrySource} onManualSupplementSource={openManualSupplement} onMarkIndependent={(sourceId) => {
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
          reviewBeforeAdd={!directMode}
          onChangeReviewBeforeAdd={!runtime?async value=>{await canonicalWorkspaceRepository.transaction(w=>({...w,preferences:{...w.preferences,legacyData:{...w.preferences.legacyData,directReviewBeforeAdd:value}}}));await refreshOrdinary()}:undefined}
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
        storageState={!workspaceReady ? 'loading' : storageError || workspaceRecovery ? 'blocked' : 'ready'}
        currentPage={currentPage}
        inboxView={inboxView}
        pendingReviewCount={pendingReviewCount}
        onNavigate={(page) => {
          if (runtime && !['today', 'inbox', 'tasks', 'calendar'].includes(page)) { rejectExperimentAction(); return }
          setDirectBatchId(null)
          if (page === 'inbox') setInboxView('all')
          setCurrentPage(page)
        }}
        onOpenPendingReview={() => {
          setDirectBatchId(null)
          setInboxView('needs_review')
          setCurrentPage('inbox')
        }}
        onOpenIntake={() => setIntakeOpen(true)}
        onOpenGuide={() => runtime ? rejectExperimentAction() : setGuideOpen(true)}
      />
      <div id="main-content" className="content-shell" tabIndex={-1}>
        {directReadbackPending&&<section className="workspace-storage-protection direct-readback-recovery" role="alert"><strong>内容已添加，暂时未能显示</strong><p>通知和保存记录仍在。重新读取即可，不会重复添加。</p><button type="button" className="primary-button" onClick={()=>{void independentReader.load().then(async w=>{if(!w)throw Error('DIRECT_READBACK_PENDING');await refreshOrdinary();setDirectBatchId(recentDirectBatches(w).find(b=>b.id===directReadbackPending||b.draftId===directReadbackPending)?.id??null);setDirectReadbackPending(null);setIntakeOpen(false);setNotice({text:'已重新显示保存的事项，没有重复添加。',direct:true})}).catch(()=>setNotice({text:'暂时仍未能读取，请稍后重试；已保存的数据保持。'}))}}>重新读取</button></section>}
        {storageError && <section className="workspace-storage-protection" role="alert">
          <strong>{workspaceLoadFailure ? '先恢复本机数据，再继续整理' : '这次更改尚未保存'}</strong>
          <p>{workspaceLoadFailure ?? '请保留当前页面和输入。存储暂时不可用，已保存的数据不会被清空；不要继续编辑或直接刷新。'}</p>
          <div>
            <button className="secondary-button" type="button" onClick={() => void exportProtectedBackup()}>下载原始备份</button>
            {workspaceLoadFailure && <button className="primary-button" type="button" disabled={workspaceLoadRetrying} onClick={() => void retryWorkspaceLoading()}>{workspaceLoadRetrying ? '正在重新加载…' : '重试加载'}</button>}
          </div>
          {workspaceLoadFailure && workspaceDiagnostic?.canTryHistoricalRepair && <div>
            <p>可以先备份，再单独保留无法读取的旧识别回答。已保存的任务、日程和材料不会重建或删除；旧回答中未确认的建议仍保留在备份里，不会自动添加。</p>
            <button className="primary-button" type="button" disabled={workspaceLoadRetrying} onClick={() => void retryWorkspaceLoading(true)}>{workspaceLoadRetrying ? '正在备份并校验…' : '备份并修复旧识别记录'}</button>
          </div>}
          {workspaceLoadFailure && workspaceDiagnostic && <details>
            <summary>仍无法打开？保存排查信息</summary>
            <p>排查信息只有错误类别和字段位置，不含通知正文、任务内容、姓名或联系方式。原始备份包含个人数据，请勿公开发送。</p>
            <button className="secondary-button" type="button" onClick={() => downloadRecoveryFile(JSON.stringify(workspaceDiagnostic, null, 2), 'diagnostic')}>下载不含正文的排查信息</button>
          </details>}
        </section>}
        {ordinaryEnvironment && <details className="ordinary-engineering-mode"><summary>{ordinaryEnvironment.recognitionMetadata?.().responseRole==='RECORDED_MODEL_ENGINEERING_REPLAY'?'真实回答固定回放 · 普通产品路径 · 不新增模型请求':'匿名工程输入 · 普通产品路径 · 不发送模型请求'}</summary><p>{ordinaryEnvironment.label}；{ordinaryEnvironment.store.name}</p></details>}
        {viewConflict && <section className="source-review-status" role="alert"><strong>另一页面已修改相同内容，你的输入保留在本页。</strong>
          {viewConflict.conflicts.map(c=><p key={c.path}>{c.path}：编辑前「{String(c.baseline)}」→最新「{String(c.current)}」；我的输入「{String(c.proposed)}」</p>)}
          <button type="button" onClick={()=>void refreshOrdinary().then(()=>{setViewConflict(null);setStorageError(false);setNotice({text:'已明确重新载入最新内容；未确认检查点仍可恢复。'})})}>采用最新内容并重新核对</button>
          <p>请先记下仍需保留的冲突输入；未确认标题和日期检查点保留，不会自动覆盖最新事实。</p>
        </section>}
        {ordinaryReceipt && <section className="source-review-status" role="status"><strong>已提交，读回尚未验证。</strong><p>提交记录已保留；恢复只重新读回，不重复创建任务。</p><button type="button" disabled={ordinaryBusy} onClick={()=>void retryOrdinaryReadback()}>重新读回并核验</button></section>}
        {runtime && <section aria-label="隔离实验状态">
          <p>{runtime.recognitionDescription ?? '人工工程响应（非模型预测）'} · 独立测试库 · {runtime.realInput?.networkDescription ?? '无模型/通知外发'}</p>
          {readbackPending && runtime.realInput?.readbackRecovery && <section role="alert" aria-label="提交后读回恢复">
            <p>已提交，读回尚未验证。已保存内容保留；请重新读回，勿重复提交。</p>
            <button type="button" disabled={isolatedBusy} onClick={() => void performExperiment(async () => {
              await runtime.realInput!.readbackRecovery!.retry()
              setReadbackPending(false)
              setNotice({ text: '已重新读回并核实保存结果，没有重复提交。' })
            })}>重新读回已提交结果</button>
          </section>}
          <p>仅本轮录入、核对、确认、查询与JSON备份可用；未纳入操作会明确阻断。</p>
          {runtime.semantic && <p>新语义保存在独立实验格式中，不能导入稳定入口。卡片分类与耗时仍是旧界面的兼容估计，不代表原文；完整原始属性可在详情核对，不会作为修改写回。</p>}
          <button type="button" disabled={isolatedBusy || !workspaceReady || storageError} onClick={() => void performExperiment(async () => {
            const json = await runtime.exportJson()
            const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
            setExperimentExport({ url, filename: runtime.semantic?.exportName ?? 'mainline-02-i1-workspace.json' })
          })}>准备完整测试库 JSON</button>
          {experimentExport && <a href={experimentExport.url} download={experimentExport.filename}>下载已准备的完整测试库 JSON</a>}
        </section>}
        <PageLoadBoundary key={currentPage} onRetry={() => window.location.reload()}>
          <Suspense fallback={<main className="page page-loading" role="status">正在打开页面…</main>}>
            {workspaceLoadFailure && <main className="page workspace-unavailable" role="status">
              <h1>你的事项暂时还没读出来</h1>
              <p>这不代表任务和通知为空或已删除。请先使用上方的备份与恢复操作，打开后再继续整理。</p>
              <p>已经输入的内容会保留在当前页面，请不要清空浏览器数据。</p>
            </main>}
            <div hidden={Boolean(workspaceLoadFailure)||showDirectHistory}>{renderPage()}</div>
            {!workspaceLoadFailure&&showDirectHistory&&activeDirectBatch&&ordinaryCanonical&&<DirectResultList key={activeDirectBatch.id} workspace={ordinaryCanonical} batch={activeDirectBatch} onRetry={()=>retryDirectFallback(activeDirectBatch.id)} onClose={()=>setDirectHistoryOpen(false)} onUndo={()=>undoDirect(activeDirectBatch.id)} onDelete={async id=>{await deleteDirectItem(canonicalWorkspaceRepository,id);await refreshOrdinary()}} onEdit={async(id,edit)=>{await editDirectItem(canonicalWorkspaceRepository,id,edit);await refreshOrdinary()}} onDetail={(id,kind)=>kind==='task'?setSelectedTaskId(id):setSelectedEventId(id)}/>}
          </Suspense>
        </PageLoadBoundary>
      </div>

      {!workspaceReady && <div className="workspace-status" role="status">正在恢复本机工作区…</div>}
      {notice&&!notice.direct && <div className="app-toast" role="status"><span>{notice.text}</span>{notice.undo && <button type="button" onClick={() => { notice.undo?.(); setNotice(null) }}>撤销</button>}<button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button></div>}

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
          directMode={directMode}
          engineeringInput={Boolean(ordinaryEnvironment)}
          realInputPanel={RealInputPanel && isolatedSnapshot ? <RealInputPanel workspace={isolatedSnapshot}
            initialText={realInputInitialText} onSaved={refreshExperiment}
            onDraftReady={async id => { await refreshExperiment(); setIntakeOpen(false); setSelectedDraftId(id); setRealInputInitialText('') }} /> : undefined}
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
          sessionFrame={runtime?.realInput?.sessionFrame}
          reviewSession={runtime?.realInput?.reviewSession ?? ordinaryReviewSession}
          reviewWorkspace={isolatedSnapshot ?? ordinaryCanonical ?? undefined}
          onRestoreTaskSelections={runtime ? choices=>setIsolatedChoices(previous=>({...previous,[selectedDraft.id]:{...previous[selectedDraft.id],...choices}})) : undefined}
          onFieldInput={runtime?.realInput?.onReviewFieldInput ? (itemId,field)=>runtime.realInput!.onReviewFieldInput!(selectedDraft.id,itemId,field) : undefined}
          draftCorrection={runtime?.realInput?.draftEditor&&isolatedSnapshot?(onDirty,unsaved)=>runtime.realInput!.draftEditor!({workspace:isolatedSnapshot,draftId:selectedDraft.id,busy:isolatedBusy||storageError||unsaved,onDirty,onSaved:refreshExperiment,reviewSession:runtime.realInput?.reviewSession}):undefined}
          factCorrection={runtime?.realInput && isolatedSnapshot ? (taskId, onDirty, unsaved) => runtime.realInput!.factEditor({
            workspace: isolatedSnapshot, draftId: selectedDraft.id, taskId, busy: isolatedBusy || storageError || unsaved,
            onDirty, onSaved: refreshExperiment, reviewSession:runtime.realInput?.reviewSession,
            onReviewed:runtime.databaseName.includes('d21-review-session-')?()=>{const itemId=selectedDraft.items.find(item=>item.suggestion.id===taskId)?.id??taskId
              handleToggleDraftItemSelection(selectedDraft.id,itemId,true,true)}:undefined }) : undefined}
          key={runtime ? selectedDraft.id : undefined}
          isolatedCapabilities={Boolean(runtime)}
          recognitionDescription={runtime?.realInput ? runtime.recognitionDescription : undefined}
          ordinarySourceReview={!runtime ? {saveError:ordinarySaveError?.draftId===selectedDraft.id?ordinarySaveError.text:undefined,readbackRecovery:ordinaryReceipt?.draftId===selectedDraft.id?{busy:ordinaryBusy,onRetry:()=>void retryOrdinaryReadback()}:undefined,problem:selectedDraft.recognitionResult?sourceInformationReviewProblem(selectedDraft.recognitionResult):undefined,pendingEvents:selectedDraftSource ? mapSourceWorkflowItem(selectedDraftSource,[selectedDraft],ordinaryCanonical ?? undefined).counts.pendingEvents : 0,busy:ordinaryBusy || Boolean(ordinaryReceipt) || Boolean(viewConflict),unsaved:ordinaryFactsDirty||ordinaryReadinessDirty||ordinaryOpportunityDirty,description:recognitionModeDescription(ordinaryCanonical,selectedDraft.id),onConfirm:()=>void handleConfirmAll(selectedDraft.id),facts:<>{ordinaryCanonical&&<ReceiptOpportunityReview workspace={ordinaryCanonical} draftId={selectedDraft.id} session={ordinaryReviewSession} disabled={ordinaryFactsDirty||ordinaryReadinessDirty||ordinaryBusy||Boolean(ordinaryReceipt)||Boolean(viewConflict)} onDirty={setOrdinaryOpportunityDirty} onApply={input=>handleOrdinaryOpportunity(selectedDraft.id,input)} />}{ordinaryCanonical&&<SourceReadinessReview workspace={ordinaryCanonical} draftId={selectedDraft.id} session={ordinaryReviewSession} disabled={ordinaryFactsDirty||ordinaryOpportunityDirty||ordinaryBusy||Boolean(ordinaryReceipt)||Boolean(viewConflict)} onDirty={setOrdinaryReadinessDirty} onApply={input=>handleOrdinaryReadiness(selectedDraft.id,input)} />}<OrdinarySourceFacts draft={selectedDraft} source={selectedDraftSource} workspace={ordinaryCanonical} session={ordinaryReviewSession} onDirty={setOrdinaryFactsDirty} onSave={(result,decision)=>handleOrdinaryFacts(selectedDraft.id,result,decision)} /></>} : undefined}
          confirmationV2={runtime && experimentalReview ? { busy: isolatedBusy || storageError, items: experimentalReview.states } : !runtime && selectedDraft.recognitionResult ? {busy:ordinaryBusy || Boolean(ordinaryReceipt) || Boolean(viewConflict),items:Object.fromEntries(selectedDraft.items.map(item=>{const r=selectedDraft.recognitionResult!,p=r.timePoints.filter(t=>t.relatedTaskTempIds.includes(item.suggestion.id)),coveragePending=r.conflicts.some(c=>c.requiresDecision&&c.id===`coverage:${item.suggestion.id}:time`);return [item.id,{dateLabel:p.length?taskSourceTimeSummary(r,ordinaryCanonical?.extractionDrafts.find(d=>d.id===selectedDraft.id)?.legacyData?.semanticSidecar,{id:selectedDraft.sourceId,text:selectedDraftSource?.content??selectedDraftSource?.rawText??''},item.suggestion.id):coveragePending?'时间覆盖待核对，不能当成未说明':'原答未提供截止',blockedReason:sourceReadinessProblem(ordinaryCanonical,selectedDraft.id,item.suggestion.id)??sourceReviewProblem(r,item.suggestion.id,selectedDraftSource?.content??selectedDraftSource?.rawText??''),materialTempIds:r.materials.filter(m=>m.relatedTaskTempIds.includes(item.suggestion.id)).map(m=>m.tempId),timePointTempIds:p.map(t=>t.tempId)}]}))} : undefined}
          semanticReview={runtime?.semantic && isolatedSnapshot && experimentalReview && isolatedSnapshot.extractionDrafts.find(d=>d.id===selectedDraft.id)?.legacyData?.mainline05 ? {
            itemFacts: (taskId, onFocus) => runtime.semantic!.facts(isolatedSnapshot, selectedDraft.id, taskId, onFocus),
            information: runtime.semantic.facts(isolatedSnapshot, selectedDraft.id),
            informationEditor: runtime.realInput?.informationEditor ? onDirty=>runtime.realInput!.informationEditor!({workspace:isolatedSnapshot,draftId:selectedDraft.id,busy:isolatedBusy||storageError,onDirty,onSaved:refreshExperiment,reviewSession:runtime.realInput?.reviewSession}) : undefined,
            sourceSession: runtime.realInput?.sourceSession,
            eventReview: runtime.realInput?.sourceSession && runtime.realInput.informationEditor ? onDirty=>runtime.realInput!.informationEditor!({workspace:isolatedSnapshot,draftId:selectedDraft.id,busy:isolatedBusy||storageError,onDirty,onSaved:refreshExperiment,reviewSession:runtime.realInput?.reviewSession}) : undefined,
            informationReviewProblem: runtime.semantic.informationReviewProblem?.(isolatedSnapshot, selectedDraft.id),
            eventCount: runtime.semantic.eventCount(isolatedSnapshot, selectedDraft.id, experimentalReview.draft.items.filter(i => i.status === '待确认' && i.selected).map(i => i.suggestion.id)),
            onDefer: itemId => disposeExperiment(selectedDraft.id, 'defer', itemId),
            onInformationReviewed: () => disposeExperiment(selectedDraft.id, 'review_info'),
          } : undefined}
          draft={selectedDraft}
          source={selectedDraftSource}
          onClose={() => setSelectedDraftId(null)}
          onUpdate={(itemId, patch) => handleUpdateDraft(selectedDraft.id, itemId, patch)}
          onReloadLatest={runtime ? refreshExperiment : refreshOrdinary}
          onConfirm={(itemId) => handleConfirmDraftItem(selectedDraft.id, itemId)}
          onReject={(itemId) => {
            if (runtime?.semantic) { disposeExperiment(selectedDraft.id, 'reject', itemId); return }
            if (runtime) { rejectExperimentAction(); return }
            void handleUpdateDraft(selectedDraft.id, itemId, {}, '已拒绝').then(()=>setNotice({ text: '拒绝已保存，不会创建该任务。', undo: () => {void handleUpdateDraft(selectedDraft.id, itemId, {}, '待确认').catch(()=>undefined)} })).catch(()=>undefined)
          }}
          onConfirmAll={() => handleConfirmAll(selectedDraft.id)}
          projectWillCreate={runtime?.semantic ? false : selectedDraft.recognitionResult
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
          linkedEvent={!runtime?pairFlowEvents(tasks,events,ordinaryCanonical).linked[selectedTask.id]:undefined}
          eventTimeHint={!runtime?workspaceEventTimeHints(ordinaryCanonical)[pairFlowEvents(tasks,events,ordinaryCanonical).linked[selectedTask.id]?.id]:undefined}
          onScheduleTask={!runtime?scheduleDirectTask:undefined}
          compact={!runtime}
          canonicalMaterials={ordinaryCanonical?.materials.filter(m=>m.relatedTaskIds.includes(selectedTask.id))}
          onDirectEdit={directBatches.some(b=>b.status==='active'&&b.items.some(i=>i.id===selectedTask.id))?async edit=>{await editDirectItem(canonicalWorkspaceRepository,selectedTask.id,edit);await refreshOrdinary()}:undefined}
          onDelete={directBatches.some(b=>b.status==='active'&&b.items.some(i=>i.id===selectedTask.id))?async()=>{await deleteDirectItem(canonicalWorkspaceRepository,selectedTask.id);await refreshOrdinary();setSelectedTaskId(null)}:undefined}
          pendingSave={Boolean(viewConflict)}
          semanticContent={runtime?.semantic && isolatedSnapshot ? runtime.semantic.taskFacts(isolatedSnapshot, selectedTask.id) : selectedTask.directTags&&ordinaryCanonical?<details className="direct-audit-detail"><summary>识别与添加记录</summary>{ordinaryCanonical.extractionDrafts.filter(d=>recentDirectBatches(ordinaryCanonical).some(b=>b.draftId===d.id&&b.items.some(i=>i.id===selectedTask.id))).map(d=>{const run=ordinaryCanonical.recognitionRuns.find(r=>r.id===d.recognitionRunId);return <div key={d.id}><p>识别服务：{run?.modelName??'本地规则'}；生成版本：{run?.promptVersion??'未记录'}</p><details><summary>查看识别记录</summary><pre>{JSON.stringify({result:d.result,audit:d.legacyData?.directConversion},null,2)}</pre></details></div>})}</details>:undefined}
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
          compact={!runtime}
          onEdit={directBatches.some(b=>b.status==='active'&&b.items.some(i=>i.id===selectedEvent.id))?async edit=>{await editDirectItem(canonicalWorkspaceRepository,selectedEvent.id,edit);await refreshOrdinary()}:undefined}
          onDelete={directBatches.some(b=>b.status==='active'&&b.items.some(i=>i.id===selectedEvent.id))?async()=>{await deleteDirectItem(canonicalWorkspaceRepository,selectedEvent.id);await refreshOrdinary();setSelectedEventId(null)}:undefined}
          isolatedFacts={runtime?.semantic && isolatedSnapshot ? runtime.semantic.eventFacts(isolatedSnapshot, selectedEvent.id) : undefined}
          event={selectedEvent}
          project={projects.find((project) => project.id === selectedEvent.projectId)}
          evidenceQuotes={selectedEventEvidenceQuotes}
          sourceTitles={selectedEventSourceTitles}
          sourceSupplement={eventSourceSupplement(ordinaryCanonical,selectedEvent.id)}
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
