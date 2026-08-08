import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import { findDuplicateSources } from './lib/sourceDuplicates'
import { createIntakeResult, type IntakeInput } from './lib/intake'
import { ProxyDeepSeekExtractionService } from './lib/deepseekExtraction'
import { buildLocalRecognition, recognitionToLegacySuggestions } from './recognition/pipeline'
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
import type { CourseBlock, Event, ExtractionDraft, IntegrationState, KnowledgeSettings, MigrationRecord, PageId, ParsedSuggestion, Project, RecognitionFeedbackRecord, Source, Task, WorkPackage } from './types'
import type { RecognitionResult } from './recognition/types'

const workspaceRepository = new IndexedDbWorkspaceRepository()
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
          setWorkPackages(saved.workPackages)
          setEvents(saved.events)
          setMigrationLog(saved.migrationLog)
          setRecognitionFeedback(saved.recognitionFeedback)
          setLegacyData(saved.legacyData)
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

  const handleCreateDraft = (source: Source, suggestions: ParsedSuggestion[], recognitionResult?: RecognitionResult) => {
    const duplicateCandidates = findDuplicateSources(source, sources)
    const nextSource: Source = duplicateCandidates.length
      ? {
          ...source,
          duplicateOfSourceIds: duplicateCandidates.map((candidate) => candidate.sourceId),
          duplicateReviewStatus: '待核对',
        }
      : source
    const draft = createExtractionDraft(nextSource.id, suggestions, new Date().toISOString(), recognitionResult)
    setSources((current) => [nextSource, ...current])
    setDrafts((current) => [draft, ...current])
    return { draft, source: nextSource, duplicateCount: duplicateCandidates.length }
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
    const provisionalSuggestions = input.manualSuggestion
      ? localResult.suggestions
      : recognitionToLegacySuggestions(localRecognition)
    const provisional = handleCreateDraft(localResult.source, provisionalSuggestions, input.manualSuggestion ? undefined : localRecognition)
    if (input.manualSuggestion) {
      openDraftReview(provisional.draft.id, '手动任务已保存为待确认草稿；核对后再加入任务中心。')
      return
    }
    try {
      const recognitionResult = await deepSeekExtractionService.recognize(input, { projects, tasks })
      const suggestions = recognitionToLegacySuggestions(recognitionResult)
      const aiDraft = {
        ...createExtractionDraft(provisional.source.id, suggestions, provisional.draft.createdAt, recognitionResult),
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

  const handleConfirmDraftItem = (draftId: string, itemId: string) => {
    const draft = drafts.find((item) => item.id === draftId)
    const source = draft ? sources.find((item) => item.id === draft.sourceId) : null
    const item = draft?.items.find((candidate) => candidate.id === itemId)
    if (!draft || !source || !item || item.status !== '待确认') return
    if (Number.isNaN(new Date(item.suggestion.deadline).getTime())) {
      setNotice({ text: '请先补全并确认该任务的截止时间；模糊日期不会直接进入正式任务。' })
      return
    }
    const unconfirmedTime = draft.recognitionResult?.timePoints.some((point) => point.relatedTaskTempIds.includes(item.suggestion.id) && point.selected === false)
    if (unconfirmedTime) {
      setNotice({ text: '该任务仍有模糊或未勾选的时间节点，请在“时间节点”中确认后再加入。' })
      return
    }
    const matchedProjectId = draft.recognitionResult?.projectMatch.decision === 'existing_project'
      ? draft.recognitionResult.projectMatch.matchedProjectId
      : null
    const existingProject = projects.find((candidate) => candidate.id === matchedProjectId)
      ?? projects.find((candidate) => candidate.sourceIds.includes(source.id))
    const { tasks: [task], project, workPackages: createdPackages, events: createdEvents } = buildConfirmedProjectBatch([item], source, existingProject, new Date().toISOString(), draft.recognitionResult)
    setTasks((current) => [task, ...current])
    setProjects((current) => !project
      ? current
      : existingProject
        ? current.map((candidate) => candidate.id === project.id ? project : candidate)
        : [project, ...current])
    setWorkPackages((current) => [...createdPackages.filter((item) => !current.some((candidate) => candidate.id === item.id)), ...current])
    setEvents((current) => [...createdEvents.filter((item) => !current.some((candidate) => candidate.id === item.id)), ...current])
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
    const matchedProjectId = draft.recognitionResult?.projectMatch.decision === 'existing_project'
      ? draft.recognitionResult.projectMatch.matchedProjectId
      : null
    const existingProject = projects.find((candidate) => candidate.id === matchedProjectId)
      ?? projects.find((candidate) => candidate.sourceIds.includes(source.id))
    const { tasks: created, project, workPackages: createdPackages, events: createdEvents } = buildConfirmedProjectBatch(pending, source, existingProject, new Date().toISOString(), draft.recognitionResult)
    setTasks((current) => [...created, ...current])
    setProjects((current) => !project
      ? current
      : existingProject
        ? current.map((candidate) => candidate.id === project.id ? project : candidate)
        : [project, ...current])
    setWorkPackages((current) => [...createdPackages.filter((item) => !current.some((candidate) => candidate.id === item.id)), ...current])
    setEvents((current) => [...createdEvents.filter((item) => !current.some((candidate) => candidate.id === item.id)), ...current])
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
    setWorkPackages(imported.workPackages)
    setEvents(imported.events)
    setMigrationLog(imported.migrationLog)
    setRecognitionFeedback(imported.recognitionFeedback)
    setLegacyData(imported.legacyData)
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
