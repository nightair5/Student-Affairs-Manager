export type PageId = 'today' | 'tasks' | 'calendar' | 'library' | 'archive'

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
  createdAt: string
  extractionStatus: '已识别' | '待确认'
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
  confidence: '高' | '中' | '低'
}
