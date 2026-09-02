export type PageId =
  | 'today'
  | 'inbox'
  | 'tasks'
  | 'calendar'
  | 'library'
  | 'archive'
  | 'knowledge'
  | 'reports'
  | 'services'
  | 'privacy'

export type TaskCategory = '比赛' | '保研' | '课程' | '老师任务' | '其他'
export type TaskStatus = '待开始' | '进行中' | '已完成'
export type Priority = '高' | '中' | '低'
export type RiskFlag = '紧急' | '缺材料' | '待确认' | '有依赖' | '已逾期'
export type SourceType = 'text' | 'file' | 'image' | 'link'
export type ReminderChannel = 'browser' | 'email' | 'wechat-placeholder'
export type MaterialStatus = 'missing' | 'preparing' | 'ready' | 'submitted' | 'verified' | 'not_required'
export type ReminderDeliveryStatus = 'draft' | 'scheduled' | 'sent' | 'failed' | 'unsupported'
export type CanonicalDraftStatus = 'processing' | 'needs_review' | 'partially_confirmed' | 'confirmed' | 'rejected' | 'failed' | 'archived'
export type CanonicalSourceStatus = 'uploaded' | 'extracting' | 'needs_review' | 'partially_confirmed' | 'confirmed' | 'failed' | 'archived'
export type HistoryEntityType =
  | 'task'
  | 'subtask'
  | 'project'
  | 'milestone'
  | 'work_package'
  | 'material'
  | 'time_point'
  | 'event'
  | 'source'
  | 'draft'
  | 'reminder'
export type TimePointType =
  | 'deadline'
  | 'registration_deadline'
  | 'submission_deadline'
  | 'task_deadline'
  | 'event_start'
  | 'event_end'
  | 'result_announcement'
  | 'planned_start'
export type InferenceLevel = 'explicit' | 'strong_inference' | 'optional_suggestion'

export interface SourceReviewMetadata {
  sourceType?: SourceType
  mimeType?: string
  characterCount?: number
  pageCount?: number
  extractionMethod?: 'manual' | 'parser' | 'ocr' | 'web' | 'unknown'
  /** Normalized OCR confidence in the inclusive 0..1 range. */
  ocrConfidence?: number
  partialExtraction?: boolean
  qualityFlags?: string[]
}

export interface Material {
  id: string
  name: string
  done: boolean
  status?: MaterialStatus
  taskId?: string
  projectId?: string
  sourceId?: string
}

export interface Reminder {
  id: string
  channel: ReminderChannel
  scheduledAt: string
  enabled: boolean
  /** Exact delivery state when projected from canonical v8. */
  status?: ReminderDeliveryStatus
  errorMessage?: string
  /** Actual audited delivery time; never inferred from scheduledAt. */
  sentAt?: string | null
}

export interface HistoryEntry {
  id: string
  field: string
  before: string
  after: string
  changedAt: string
  actor: 'user' | 'system'
  entityType?: HistoryEntityType
  entityId?: string
  action?: string
}

export interface Task {
  id: string
  projectId?: string
  parentTaskId?: string
  hierarchyType?: 'task' | 'subtask'
  milestoneId?: string
  workPackageId?: string
  actionVerb?: string
  actionObject?: string
  completionCriteria?: string[]
  evidenceIds?: string[]
  inferenceLevel?: InferenceLevel
  title: string
  category: TaskCategory
  status: TaskStatus
  deadline: string
  estimatedMinutes: number
  nextAction: string
  description: string
  priority: Priority
  riskFlags: RiskFlag[]
  materials: Material[]
  dependencies: string[]
  dependencyIds?: string[]
  reminders: Reminder[]
  sourceIds: string[]
  priorityReason: string
  plannedStart?: string
  completedAt?: string
  manualPriority?: number
  computedPriorityScore?: number
  priorityReasons?: string[]
  pinnedUntil?: string
  snoozedUntil?: string
  timePointIds?: string[]
  materialIds?: string[]
  createdAt: string
  updatedAt: string
  history: HistoryEntry[]
}

export interface Source {
  id: string
  /** Canonical v8 version currently represented by rawText/content. */
  currentVersionId?: string
  type: SourceType
  title: string
  contentPreview: string
  content?: string
  url?: string
  rawText?: string
  originalFileName?: string
  mimeType?: string
  fileSize?: number
  fileHash?: string
  status?: CanonicalSourceStatus
  processingError?: string
  parserVersion?: string
  reviewMetadata?: SourceReviewMetadata
  createdAt: string
  updatedAt?: string
  extractionStatus: '已识别' | '待确认' | '部分确认' | '已确认' | '已拒绝'
  extractionMethod?: 'local-rules' | 'deepseek-v4-flash' | 'deepseek-v4-flash-vision-exp'
  duplicateOfSourceIds?: string[]
  duplicateReviewStatus?: '待核对' | '保留为独立来源'
}

export interface EvidenceReference {
  id: string
  sourceId: string
  page?: number
  textStart?: number
  textEnd?: number
  quote: string
  quotedText?: string
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  field: 'title' | 'deadline' | 'materials' | 'description' | 'project' | 'milestone' | 'event' | 'requirement'
  extractionMethod?: 'manual' | 'demo' | 'ocr' | 'parser' | 'ai'
  confidence?: number
}

export interface TimePoint {
  id: string
  taskId?: string
  projectId?: string
  type: TimePointType
  value: string | null
  timezone: string
  isAllDay: boolean
  originalText?: string
  precision?: 'exact' | 'date_only' | 'relative' | 'vague'
  relatedTaskIds?: string[]
  relatedMaterialIds?: string[]
  confidence?: number
  needsConfirmation: boolean
  evidenceIds: string[]
}

export interface MaterialItemEntity {
  id: string
  projectId?: string
  taskId?: string
  name: string
  required: boolean
  status: MaterialStatus
  formatRequirement?: string
  quantity?: number
  note?: string
  deadline?: string
  evidenceIds: string[]
  createdAt: string
  updatedAt: string
}

export interface HistoryRecord {
  id: string
  entityType: HistoryEntityType
  entityId: string
  field: string
  before: unknown
  after: unknown
  actor: 'user' | 'system'
  action: string
  changedAt: string
}

export interface ReminderRecord {
  id: string
  taskId: string
  channel: ReminderChannel
  scheduledAt: string
  enabled: boolean
  status: ReminderDeliveryStatus
  errorMessage?: string
  /** Actual audited delivery time; never inferred from scheduledAt. */
  sentAt?: string | null
}

/**
 * @deprecated Legacy confirmation compatibility only. Workspace v8 stores
 * rich extraction drafts and canonical entities without this lossy adapter.
 */
export interface ParsedSuggestion {
  id: string
  title: string
  category: TaskCategory
  deadline: string
  estimatedMinutes: number
  nextAction: string
  description: string
  priority: Priority
  materials: string[]
  evidence: string
  evidenceRefs?: EvidenceReference[]
  confidence: '高' | '中' | '低'
  /** Deterministic RCO-2 time interpretation; legacy deadline mirrors normalizedValue or ''. */
  timePoint?: import('./lib/timeSemantics').ChineseTimeAst
}

export type DraftItemStatus = '待确认' | '已确认' | '已拒绝'

export interface DraftItem {
  id: string
  suggestion: ParsedSuggestion
  selected?: boolean
  status: DraftItemStatus
  updatedAt: string
  history?: HistoryEntry[]
}

export interface ExtractionDraft {
  id: string
  sourceId: string
  /** Canonical v8 version used by the recognition run that produced this draft. */
  sourceVersionId?: string
  /** Bounded provenance metadata stored with that SourceVersion. */
  sourceReviewMetadata?: SourceReviewMetadata
  /** Append-only canonical attempt order; completion time never changes precedence. */
  attemptOrder?: number
  status: '待确认' | '部分确认' | '已确认' | '已拒绝'
  items: DraftItem[]
  createdAt: string
  updatedAt: string
  workflowStatus?: CanonicalDraftStatus
  modelVersion?: string
  promptVersion?: string
  schemaVersion?: string
  modelName?: string
  recognitionResult?: import('./recognition/types').RecognitionResult
}

export interface Project {
  id: string
  title: string
  category: TaskCategory
  sourceIds: string[]
  taskIds: string[]
  milestones: Milestone[]
  status?: 'active' | 'completed' | 'archived'
  objective?: string
  keywords?: string[]
  currentMilestoneId?: string
  evidenceIds?: string[]
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: string
  projectId: string
  title: string
  dueAt: string
  status: '待完成' | '已完成'
  objective?: string
  order?: number
  evidenceIds?: string[]
  workPackageIds?: string[]
  taskIds?: string[]
  createdAt: string
}

export interface WorkPackage {
  id: string
  projectId: string
  milestoneId: string
  title: string
  objective: string
  order: number
  taskIds: string[]
  evidenceIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Event {
  id: string
  projectId?: string
  milestoneId?: string
  title: string
  description: string
  startAt: string | null
  endAt: string | null
  location?: string
  evidenceIds: string[]
  needsConfirmation: boolean
  createdAt: string
  updatedAt: string
}

export interface MigrationRecord {
  id: string
  fromVersion: number
  toVersion: number
  migratedAt: string
  status: 'completed' | 'needs_review'
  notes: string[]
}

export interface RecognitionFeedbackRecord {
  id: string
  draftId: string
  originalKind: string
  correctedKind: string
  action: 'modified' | 'rejected' | 'merged' | 'split' | 'moved'
  createdAt: string
}

export interface CourseBlock {
  id: string
  title: string
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  startTime: string
  endTime: string
  createdAt: string
}

export interface SyncIntegrationState {
  endpoint: string
  lastRemoteRevision?: string
  lastSyncedAt?: string
}

export type WebMonitorStatus = 'baseline-ready' | 'unchanged' | 'changed' | 'error'
export type WebMonitorCheckMethod = 'local-paste' | 'server-fetch'

export interface WebChangeResult {
  changed: boolean
  previousHash: string
  currentHash: string
  addedLineCount: number
  removedLineCount: number
  addedSamples: string[]
  removedSamples: string[]
  checkedAt: string
  method: WebMonitorCheckMethod
}

export interface WebMonitor {
  id: string
  title: string
  url: string
  authorizedAt: string
  baselineText: string
  baselineHash: string
  status: WebMonitorStatus
  lastCheckedAt?: string
  lastResult?: WebChangeResult
}

export type ConnectionPlatform = 'wechat' | 'cross-device'
export type ConnectionReadinessStatus =
  | 'not-connected'
  | 'blocked-platform-approval'
  | 'backend-not-configured'

export interface ConnectionIntent {
  platform: ConnectionPlatform
  status: Exclude<ConnectionReadinessStatus, 'not-connected'>
  reviewedAt: string
  plannedScopes: string[]
}

export interface IntegrationState {
  sync: SyncIntegrationState
  webMonitors: WebMonitor[]
  connectionIntents: ConnectionIntent[]
}

export interface KnowledgeSettings {
  localSearchAuthorizedAt?: string
}

export interface WorkspaceData {
  schemaVersion: 7
  tasks: Task[]
  sources: Source[]
  drafts: ExtractionDraft[]
  projects: Project[]
  evidence: EvidenceReference[]
  timePoints: TimePoint[]
  materialItems: MaterialItemEntity[]
  historyRecords: HistoryRecord[]
  reminderRecords: ReminderRecord[]
  workPackages: WorkPackage[]
  events: Event[]
  migrationLog: MigrationRecord[]
  recognitionFeedback: RecognitionFeedbackRecord[]
  legacyData: Record<string, unknown>
  courseBlocks: CourseBlock[]
  integrations: IntegrationState
  knowledgeSettings: KnowledgeSettings
  savedAt: string
}
