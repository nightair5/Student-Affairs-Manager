import type { EvidenceReference, InferenceLevel, TaskCategory } from '../types'

export type NotificationType =
  | 'new_project'
  | 'project_addendum'
  | 'project_correction'
  | 'course_assignment'
  | 'teacher_task'
  | 'event_notice'
  | 'meeting_notice'
  | 'material_submission'
  | 'registration_notice'
  | 'result_notice'
  | 'information_only'
  | 'uncertain'

export interface SuggestedField<T> {
  value: T
  evidenceIds: string[]
  confidence: number
  inferenceLevel: InferenceLevel
}

export interface ProjectMatch {
  decision: 'new_project' | 'existing_project' | 'standalone_task' | 'uncertain'
  matchedProjectId: string | null
  suggestedProjectTitle: string | null
  confidence: number
  reasons: string[]
}

export interface TaskSuggestionV2 {
  tempId: string
  parentTempId: string | null
  hierarchyType: 'task' | 'subtask'
  title: string
  actionVerb: string
  actionObject: string
  description: string
  completionCriteria: string[]
  estimatedMinutes: number | null
  statusSuggestion: 'todo'
  prioritySuggestion: 'low' | 'medium' | 'high' | 'urgent'
  dependencyTempIds: string[]
  materialTempIds: string[]
  timePointTempIds: string[]
  evidenceIds: string[]
  confidence: number
  inferenceLevel: InferenceLevel
  userConfirmationRequired: boolean
  selected?: boolean
}

export interface WorkPackageSuggestion {
  tempId: string
  title: string
  objective: string
  order: number
  evidenceIds: string[]
  tasks: TaskSuggestionV2[]
}

export interface MilestoneSuggestion {
  tempId: string
  title: string
  objective: string
  order: number
  evidenceIds: string[]
  workPackages: WorkPackageSuggestion[]
  tasks: TaskSuggestionV2[]
}

export interface MaterialSuggestionV2 {
  tempId: string
  name: string
  required: boolean
  formatRequirements: string[]
  namingRequirements: string[]
  quantity: number | null
  submissionChannel: string | null
  relatedTaskTempIds: string[]
  evidenceIds: string[]
  confidence: number
  selected?: boolean
}

export interface TimePointSuggestionV2 {
  tempId: string
  type:
    | 'registration_deadline'
    | 'submission_deadline'
    | 'task_deadline'
    | 'event_start'
    | 'event_end'
    | 'result_announcement'
    | 'planned_start'
  rawText: string
  normalizedValue: string | null
  timezone: string
  isAllDay: boolean
  precision: 'exact' | 'date_only' | 'relative' | 'vague'
  needsConfirmation: boolean
  relatedTaskTempIds: string[]
  relatedMaterialTempIds: string[]
  evidenceIds: string[]
  confidence: number
  selected?: boolean
}

export interface EventSuggestion {
  tempId: string
  title: string
  description: string
  startTimePointTempId: string | null
  endTimePointTempId: string | null
  location: string | null
  evidenceIds: string[]
  confidence: number
  inferenceLevel: InferenceLevel
  selected?: boolean
}

export interface RecognitionConflict {
  id: string
  type: 'deadline' | 'project_match' | 'duplicate' | 'hierarchy' | 'other'
  message: string
  entityTempIds: string[]
  evidenceIds: string[]
  requiresDecision: boolean
}

export interface RecognitionAmbiguity {
  id: string
  field: string
  message: string
  options: string[]
  evidenceIds: string[]
}

export interface IgnoredContent {
  text: string
  reason: 'background' | 'contact' | 'address' | 'policy' | 'format_requirement' | 'other'
}

export interface RecognitionQuality {
  overallConfidence: number
  hierarchyConfidence: number
  dateConfidence: number
  evidenceCoverage: number
  duplicateRisk: number
  overFragmentationRisk: number
  missingActionRisk: number
  needsHumanReview: boolean
  reviewReasons: string[]
}

export interface RecognitionResult {
  schemaVersion: '2.0'
  promptVersion: string
  modelName: string
  createdAt: string
  sourceSummary: {
    title: string
    sourceType: string
    notificationType: NotificationType
    summary: string
    requiresAction: boolean
    actionReason: string
  }
  projectMatch: ProjectMatch
  projectSuggestion: {
    title: SuggestedField<string>
    category: SuggestedField<TaskCategory>
    objective: SuggestedField<string>
    description: SuggestedField<string>
  } | null
  milestones: MilestoneSuggestion[]
  standaloneTasks: TaskSuggestionV2[]
  materials: MaterialSuggestionV2[]
  timePoints: TimePointSuggestionV2[]
  events: EventSuggestion[]
  evidence: EvidenceReference[]
  conflicts: RecognitionConflict[]
  ambiguities: RecognitionAmbiguity[]
  ignoredContent: IgnoredContent[]
  quality: RecognitionQuality
}

export interface SourceComplexity {
  level: 'simple' | 'medium' | 'complex'
  reasons: string[]
}
