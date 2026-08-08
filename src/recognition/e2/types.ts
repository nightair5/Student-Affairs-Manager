import type { RecognitionResult } from '../types'

export type GoldenGroup =
  | 'course'
  | 'complex_notice'
  | 'competition'
  | 'application'
  | 'scholarship'
  | 'meeting'
  | 'event'
  | 'multi_deadline'
  | 'material'
  | 'vague_time'
  | 'information_only'
  | 'ocr_noise'
  | 'security'

export interface GoldenTask {
  key: string
  actionAliases: string[]
  objectAliases: string[]
  hierarchyType: 'task' | 'subtask'
  parentKey: string | null
}

export interface GoldenMaterial {
  key: string
  nameAliases: string[]
  formatIncludes: string[]
  namingIncludes: string[]
}

export interface GoldenTimePoint {
  key: string
  type: RecognitionResult['timePoints'][number]['type']
  rawIncludes: string[]
  normalizedLocal: string | null
  precision: RecognitionResult['timePoints'][number]['precision']
  needsConfirmation: boolean
}

export interface GoldenEvent {
  key: string
  titleAliases: string[]
  locationIncludes: string[]
}

export interface GoldenEvidence {
  field: 'project' | 'milestone' | 'task' | 'material' | 'timePoint' | 'event' | 'ambiguity'
  targetKey: string
  quoteIncludes: string[]
}

export interface GoldenAmbiguity {
  fieldIncludes: string[]
  messageIncludes: string[]
}

export interface ForbiddenOutput {
  kind: 'task_text' | 'material_text' | 'project_text' | 'sentinel_date' | 'secret_disclosure' | 'unsafe_action'
  includes: string[]
  reason: string
}

export interface RecognitionGoldenCase {
  id: string
  group: GoldenGroup
  sourceType: 'text' | 'file' | 'image' | 'link'
  sourceTitle: string
  rawText: string
  referenceTime: string
  timezone: 'Asia/Shanghai'
  expected: {
    project: {
      decisions: RecognitionResult['projectMatch']['decision'][]
      titleAliases: string[]
      required: boolean
    }
    milestones: Array<{ key: string; titleAliases: string[] }>
    tasks: GoldenTask[]
    materials: GoldenMaterial[]
    timePoints: GoldenTimePoint[]
    events: GoldenEvent[]
    evidence: GoldenEvidence[]
    ambiguities: GoldenAmbiguity[]
    forbidden: ForbiddenOutput[]
  }
}

export type EvaluationProvider = 'local-fallback' | 'deepseek-production'

export type ErrorCategory =
  | 'project_decision'
  | 'milestone_missing'
  | 'milestone_spurious'
  | 'task_missing'
  | 'task_spurious'
  | 'task_hierarchy'
  | 'material_missing'
  | 'time_missing'
  | 'time_incorrect'
  | 'event_missing'
  | 'event_spurious'
  | 'evidence_missing'
  | 'ambiguity_missing'
  | 'duplicate'
  | 'over_fragmentation'
  | 'forbidden_output'
  | 'invalid_output'
  | 'request_failure'

export interface EvaluationFailure {
  category: ErrorCategory
  severity: 'minor' | 'major' | 'severe'
  reason: string
  expectedKey?: string
  actual?: string
  tags?: RecognitionErrorTag[]
}

export type RecognitionErrorTag =
  | 'PROJECT_DECISION_ERROR'
  | 'MISSING_MILESTONE'
  | 'WRONG_MILESTONE'
  | 'OVER_MILESTONE'
  | 'MISSING_TASK'
  | 'WRONG_TASK'
  | 'OVER_TASK'
  | 'TASK_GRANULARITY_ERROR'
  | 'MISSING_MATERIAL'
  | 'WRONG_MATERIAL'
  | 'MATERIAL_TASK_CONFUSION'
  | 'MISSING_TIMEPOINT'
  | 'WRONG_TIMEPOINT_TYPE'
  | 'WRONG_TIME_VALUE'
  | 'WRONG_TIMEZONE'
  | 'FALSE_PRECISION'
  | 'RELATIVE_TIME_ERROR'
  | 'MISSING_EVENT'
  | 'WRONG_EVENT'
  | 'MISSING_EVIDENCE'
  | 'WRONG_EVIDENCE'
  | 'EVIDENCE_NOT_SUPPORTED'
  | 'MISSING_AMBIGUITY'
  | 'FALSE_AMBIGUITY'
  | 'INVALID_REFERENCE'
  | 'INVALID_SCHEMA'
  | 'PROMPT_INJECTION_FAILURE'
  | 'TRANSPORT_FAILURE'
  | 'TIMEOUT'
  | 'UPSTREAM_502'
  | 'UPSTREAM_503'
  | 'REPAIR_FAILURE'
  | 'SEVERE_ERROR'

export interface RecognitionCaseResult {
  caseId: string
  group: GoldenGroup
  provider: EvaluationProvider
  status: 'ok' | 'invalid_output' | 'request_failure'
  latencyMs: number
  tokenUsage: { input: number; output: number } | null
  costUsd: number | null
  result: RecognitionResult | null
  failures: EvaluationFailure[]
  scores: {
    projectDecision: number
    milestoneTruePositive: number
    milestonePredicted: number
    milestoneExpected: number
    taskTruePositive: number
    taskPredicted: number
    taskExpected: number
    materialMatched: number
    materialExpected: number
    timePointMatched: number
    timePointPredicted: number
    timePointExpected: number
    eventMatched: number
    eventPredicted: number
    eventExpected: number
    evidenceMatched: number
    evidenceExpected: number
    duplicateCount: number
    overFragmented: boolean
    majorCorrection: boolean
    severeError: boolean
  }
}

export interface RecognitionBaselineMetrics {
  provider: EvaluationProvider
  sampleCount: number
  completedCount: number
  projectDecisionAccuracy: number
  milestonePrecision: number
  milestoneRecall: number
  taskPrecision: number
  taskRecall: number
  materialRecall: number
  timePointAccuracy: number
  eventAccuracy: number
  evidenceCoverage: number
  duplicateRate: number
  overFragmentationRate: number
  majorCorrectionRate: number
  severeErrorRate: number
  invalidOutputRate: number
  requestFailureRate: number
  latencyMs: { mean: number; p50: number; p95: number }
  tokenUsage: { input: number; output: number } | null
  costUsd: number | null
  errorTaxonomy: Array<{ category: ErrorCategory; count: number }>
}
