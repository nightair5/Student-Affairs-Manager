export type PageId =
  | 'today'
  | 'inbox'
  | 'tasks'
  | 'calendar'
  | 'library'
  | 'archive'
  | 'knowledge'

export type TaskCategory = '比赛' | '保研' | '课程' | '老师任务' | '其他'
export type TaskStatus = '待开始' | '进行中' | '已完成'
export type Priority = '高' | '中' | '低'
export type RiskFlag = '紧急' | '缺材料' | '待确认' | '有依赖' | '已逾期'
export type SourceType = 'text' | 'file' | 'image' | 'link'
export type ReminderChannel = 'email' | 'wechat-placeholder'

export interface Material {
  id: string
  name: string
  done: boolean
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
}

export interface Task {
  id: string
  projectId?: string
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
  reminders: Reminder[]
  sourceIds: string[]
  priorityReason: string
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
  createdAt: string
  extractionStatus: '已识别' | '待确认' | '部分确认' | '已确认' | '已拒绝'
}

export interface EvidenceReference {
  id: string
  sourceId: string
  quote: string
  field: 'title' | 'deadline' | 'materials' | 'description'
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
}

export interface Project {
  id: string
  title: string
  category: TaskCategory
  sourceIds: string[]
  taskIds: string[]
  createdAt: string
  updatedAt: string
}

export interface KnowledgeSettings {
  /** 用户明确允许本地问答读取其已保存工作区的时间。 */
  localSearchAuthorizedAt?: string
}

export interface WorkspaceData {
  schemaVersion: 4
  tasks: Task[]
  sources: Source[]
  drafts: ExtractionDraft[]
  projects: Project[]
  knowledgeSettings: KnowledgeSettings
  savedAt: string
}
