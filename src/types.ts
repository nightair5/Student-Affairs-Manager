export type PageId =
  | 'today'
  | 'inbox'
  | 'tasks'
  | 'calendar'
  | 'library'
  | 'archive'
  | 'knowledge'
  | 'services'

export type TaskCategory = '比赛' | '保研' | '课程' | '老师任务' | '其他'
export type TaskStatus = '待开始' | '进行中' | '已完成'
export type Priority = '高' | '中' | '低'
export type RiskFlag = '紧急' | '缺材料' | '待确认' | '有依赖' | '已逾期'
export type SourceType = 'text' | 'file' | 'image' | 'link'
export type ReminderChannel = 'browser' | 'email' | 'wechat-placeholder'
export type MaterialStatus = 'missing' | 'preparing' | 'ready' | 'submitted' | 'verified' | 'not_required'
export type ReminderDeliveryStatus = 'draft' | 'scheduled' | 'sent' | 'failed' | 'unsupported'
export type CanonicalDraftStatus = 'processing' | 'needs_review' | 'partially_confirmed' | 'confirmed' | 'rejected' | 'failed'
export type CanonicalSourceStatus = 'uploaded' | 'extracting' | 'needs_review' | 'partially_confirmed' | 'confirmed' | 'failed' | 'archived'
export type HistoryEntityType = 'task' | 'project' | 'material' | 'source' | 'draft' | 'reminder'
export type TimePointType = 'deadline' | 'registration_deadline' | 'submission_deadline' | 'event_start' | 'event_end' | 'planned_start'

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
  createdAt: string
  updatedAt?: string
  extractionStatus: '已识别' | '待确认' | '部分确认' | '已确认' | '已拒绝'
  extractionMethod?: 'local-rules' | 'deepseek-v4-flash'
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
  field: 'title' | 'deadline' | 'materials' | 'description'
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
}

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
}

export type DraftItemStatus = '待确认' | '已确认' | '已拒绝'

export interface DraftItem {
  id: string
  suggestion: ParsedSuggestion
  status: DraftItemStatus
  updatedAt: string
}

export interface ExtractionDraft {
  id: string
  sourceId: string
  status: '待确认' | '部分确认' | '已确认' | '已拒绝'
  items: DraftItem[]
  createdAt: string
  updatedAt: string
  workflowStatus?: CanonicalDraftStatus
  modelVersion?: string
  promptVersion?: string
}

export interface Project {
  id: string
  title: string
  category: TaskCategory
  sourceIds: string[]
  taskIds: string[]
  milestones: Milestone[]
  status?: 'active' | 'completed' | 'archived'
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
  schemaVersion: 6
  tasks: Task[]
  sources: Source[]
  drafts: ExtractionDraft[]
  projects: Project[]
  evidence: EvidenceReference[]
  timePoints: TimePoint[]
  materialItems: MaterialItemEntity[]
  historyRecords: HistoryRecord[]
  reminderRecords: ReminderRecord[]
  courseBlocks: CourseBlock[]
  integrations: IntegrationState
  knowledgeSettings: KnowledgeSettings
  savedAt: string
}
