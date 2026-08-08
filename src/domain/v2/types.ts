import type { RecognitionResult } from '../../recognition/types'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type LegacyData = Record<string, JsonValue>

export type EntityStatus = 'active' | 'completed' | 'archived'
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled'
export type MaterialStatus = 'missing' | 'preparing' | 'ready' | 'submitted' | 'verified' | 'not_required'
export type TaskCategory = '比赛' | '保研' | '课程' | '老师任务' | '其他'
export type TimePrecision = 'exact' | 'date_only' | 'relative' | 'vague'
export type TimePointType =
  | 'registration_deadline'
  | 'submission_deadline'
  | 'task_deadline'
  | 'event_start'
  | 'event_end'
  | 'result_announcement'
  | 'planned_start'
export type ExtractionMethod = 'manual' | 'demo' | 'ocr' | 'parser' | 'ai' | 'migration'

export interface ReviewableEntity {
  legacyData?: LegacyData
  needsReview?: boolean
}

export interface WorkspaceIdentity extends ReviewableEntity {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceSettings {
  defaultTimezone: string
  locale: string
}

export interface Source extends ReviewableEntity {
  id: string
  workspaceId: string
  type: 'text' | 'file' | 'image' | 'link'
  title: string
  status: 'uploaded' | 'extracting' | 'needs_review' | 'partially_confirmed' | 'confirmed' | 'failed' | 'archived'
  currentVersionId: string
  createdAt: string
  updatedAt: string
}

export interface SourceVersion extends ReviewableEntity {
  id: string
  sourceId: string
  versionNo: number
  contentHash: string | null
  rawText: string | null
  rawTextRef: string | null
  createdAt: string
}

export interface RecognitionRun extends ReviewableEntity {
  id: string
  sourceVersionId: string
  provider: 'local-rules' | 'deepseek' | 'manual' | 'legacy-unknown'
  modelName: string | null
  promptVersion: string | null
  schemaVersion: string
  pipelineVersion: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  tokenUsage: { input: number; output: number } | null
  qualityFlags: string[]
  errorCode: string | null
}

export interface ExtractionDraft extends ReviewableEntity {
  id: string
  recognitionRunId: string
  status: 'processing' | 'needs_review' | 'partially_confirmed' | 'confirmed' | 'rejected' | 'failed' | 'archived'
  result: RecognitionResult | null
  commitOperationIds: string[]
  acceptedEntityTempIds: string[]
  rejectedEntityTempIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Project extends ReviewableEntity {
  id: string
  workspaceId: string
  title: string
  category: TaskCategory
  objective: string | null
  status: EntityStatus
  createdAt: string
  updatedAt: string
  version: number
}

export interface Milestone extends ReviewableEntity {
  id: string
  projectId: string
  title: string
  objective: string | null
  sortOrder: number
  status: EntityStatus
  createdAt: string
  updatedAt: string
}

export interface WorkPackage extends ReviewableEntity {
  id: string
  projectId: string
  milestoneId: string
  title: string
  objective: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Task extends ReviewableEntity {
  id: string
  projectId: string | null
  milestoneId: string | null
  workPackageId: string | null
  parentTaskId: string | null
  title: string
  description: string | null
  nextAction: string | null
  status: TaskStatus
  estimatedMinutes: number | null
  manualPriority: number | null
  snoozedUntil: string | null
  dependencyIds: string[]
  createdAt: string
  updatedAt: string
  version: number
}

export interface Material extends ReviewableEntity {
  id: string
  projectId: string | null
  name: string
  required: boolean
  status: MaterialStatus
  requirements: string[]
  formatRequirements: string[]
  namingRequirements: string[]
  quantity: number | null
  submissionChannel: string | null
  relatedTaskIds: string[]
  deadlineTimePointId: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface TimePoint extends ReviewableEntity {
  id: string
  projectId: string | null
  milestoneId: string | null
  taskId: string | null
  materialId: string | null
  eventId: string | null
  relatedTaskIds: string[]
  relatedMaterialIds: string[]
  type: TimePointType
  rawText: string
  normalizedValue: string | null
  timezone: string | null
  isAllDay: boolean
  precision: TimePrecision
  needsConfirmation: boolean
  createdAt: string
  updatedAt: string
}

export interface Event extends ReviewableEntity {
  id: string
  projectId: string | null
  title: string
  description: string | null
  startTimePointId: string | null
  endTimePointId: string | null
  location: string | null
  createdAt: string
  updatedAt: string
}

export interface EvidenceRef extends ReviewableEntity {
  id: string
  sourceVersionId: string
  page: number | null
  textStart: number | null
  textEnd: number | null
  quotedText: string | null
  bbox: { x: number; y: number; width: number; height: number } | null
  fieldPath: string | null
  extractionMethod: ExtractionMethod
  confidence: number | null
  createdAt: string
}

export type HistoryEntityType =
  | 'source'
  | 'source_version'
  | 'recognition_run'
  | 'extraction_draft'
  | 'project'
  | 'milestone'
  | 'work_package'
  | 'task'
  | 'material'
  | 'time_point'
  | 'event'
  | 'evidence'
  | 'change_proposal'
  | 'reminder'

export interface HistoryRecord extends ReviewableEntity {
  id: string
  entityType: HistoryEntityType
  entityId: string
  action: string
  fieldName: string | null
  before: JsonValue
  after: JsonValue
  actor: 'user' | 'system' | 'migration'
  reason: string | null
  sourceVersionId: string | null
  changedAt: string
}

export interface ReminderRecord extends ReviewableEntity {
  id: string
  taskId: string
  channel: 'browser' | 'email' | 'wechat-placeholder'
  scheduledAt: string | null
  status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'unsupported'
  errorCode: string | null
  sentAt: string | null
}

export interface ChangeProposalChange {
  entityType: HistoryEntityType
  entityId: string | null
  fieldPath: string
  before: JsonValue
  after: JsonValue
}

export interface ChangeProposal extends ReviewableEntity {
  id: string
  projectId: string
  sourceVersionId: string
  recognitionRunId: string | null
  status: 'draft' | 'needs_review' | 'accepted' | 'rejected'
  changeType: 'NEW' | 'UPDATE' | 'CONFLICT' | 'INFO'
  changes: ChangeProposalChange[]
  conflicts: string[]
  createdAt: string
  updatedAt: string
}

export interface MigrationMetadata {
  migrationId: string
  sourceVersion: number
  targetVersion: number
  startedAt: string
  completedAt: string | null
  status: 'prepared' | 'completed' | 'rolled_back' | 'failed' | 'needs_review'
  warnings: string[]
  errors: string[]
  backupId: string | null
}

export interface WorkspacePreferences extends ReviewableEntity {
  onboardingCompletedAt: string | null
}

export interface WorkspaceV8 {
  schemaVersion: 8
  workspace: WorkspaceIdentity
  settings: WorkspaceSettings
  sources: Source[]
  sourceVersions: SourceVersion[]
  recognitionRuns: RecognitionRun[]
  extractionDrafts: ExtractionDraft[]
  projects: Project[]
  milestones: Milestone[]
  workPackages: WorkPackage[]
  tasks: Task[]
  materials: Material[]
  timePoints: TimePoint[]
  events: Event[]
  evidenceRefs: EvidenceRef[]
  changeProposals: ChangeProposal[]
  historyRecords: HistoryRecord[]
  reminderRecords: ReminderRecord[]
  preferences: WorkspacePreferences
  migrationMetadata: MigrationMetadata[]
  savedAt: string
}

/** Derived cache. Every field must be recomputable from canonical entities. */
export interface ProjectState {
  projectId: string
  currentMilestoneId: string | null
  health: 'on_track' | 'at_risk' | 'blocked' | 'unknown'
  nextActionTaskId: string | null
  nextDeadlineTimePointId: string | null
  lastComputedAt: string
}

/** Derived recommendation; never persisted as a second task fact source. */
export interface TodayRecommendation {
  taskId: string
  score: number
  reasons: string[]
}

/** Derived assessment; never persisted as a canonical fact. */
export interface RiskAssessment {
  entityId: string
  score: number
  reasons: string[]
}
