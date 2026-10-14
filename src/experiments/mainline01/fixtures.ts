import type { RecognitionResult, TaskSuggestionV2 } from '../../recognition/types'
import type { WorkspaceV8 } from '../../domain/v2/types'

// Hand-authored engineering inputs, not model predictions, blind data or semantic gold.
export const LABEL = 'MAINLINE-01 人工工程响应（非模型预测）'
export const NOW = '2026-09-05T08:00:00.000Z'
export const cases = ['multi', 'no-date', 'vague', 'information', 'condition-true', 'condition-false', 'condition-unknown', 'revision'] as const
export type CaseName = typeof cases[number]
export const notices: Record<CaseName, string> = {
  multi: '请于2026年9月10日18:00前提交活动报名表，PDF格式，文件名为组别，1份，交至活动平台。请于2026年9月11日18:00前打印入场凭证，A4格式，1份。',
  'no-date': '请保存活动手册。没有截止日期要求。',
  vague: '请近期提交活动总结，具体截止时间另行通知。',
  information: '资料室周末开放，本通知仅供了解，无需行动。',
  'condition-true': '若活动获批，请提交场地申请表。活动已获批。',
  'condition-false': '若活动获批，请提交场地申请表。活动未获批。',
  'condition-unknown': '若活动获批，请提交场地申请表。目前尚未收到审批结果。',
  revision: '此前打印纸质报名表的要求已作废。现要求提交电子报名表。',
}

export function emptyWorkspace(): WorkspaceV8 {
  return {
    schemaVersion: 8, workspace: { id: 'mainline-01-only', title: LABEL, createdAt: NOW, updatedAt: NOW },
    settings: { defaultTimezone: 'Asia/Shanghai', locale: 'zh-CN' }, sources: [], sourceVersions: [],
    recognitionRuns: [], extractionDrafts: [], projects: [], milestones: [], workPackages: [], tasks: [],
    materials: [], timePoints: [], events: [], evidenceRefs: [], changeProposals: [], historyRecords: [],
    reminderRecords: [], preferences: { onboardingCompletedAt: null }, migrationMetadata: [], savedAt: NOW,
  }
}

function task(tempId: string, actionVerb: string, actionObject: string, selected = true): TaskSuggestionV2 {
  return {
    tempId, parentTempId: null, hierarchyType: 'task', title: actionVerb + actionObject,
    actionVerb, actionObject, description: actionVerb + actionObject, completionCriteria: [], estimatedMinutes: null,
    statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], materialTempIds: [],
    timePointTempIds: [], evidenceIds: ['notice'], confidence: 1, inferenceLevel: 'explicit',
    userConfirmationRequired: true, selected,
  }
}

export function artificialResponse(name: CaseName, sourceId: string): RecognitionResult {
  if (name === 'condition-unknown') throw new Error('UNREPRESENTABLE_CONDITION_STATE')
  const raw = notices[name]
  const result: RecognitionResult = {
    schemaVersion: '2.0', promptVersion: 'engineering-mainline-01', modelName: LABEL, createdAt: NOW,
    sourceSummary: { title: LABEL, sourceType: 'text', notificationType: 'uncertain', summary: raw,
      requiresAction: !['information', 'condition-false'].includes(name), actionReason: raw },
    projectMatch: { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null, confidence: 1, reasons: [LABEL] },
    projectSuggestion: null, milestones: [], standaloneTasks: [], materials: [], timePoints: [], events: [],
    evidence: [{ id: 'notice', sourceId, textStart: 0, textEnd: raw.length, quote: raw, quotedText: raw,
      field: 'description', extractionMethod: 'manual', confidence: 1 }],
    conflicts: [], ambiguities: [], ignoredContent: [],
    quality: { overallConfidence: 1, hierarchyConfidence: 1, dateConfidence: 1, evidenceCoverage: 1,
      duplicateRisk: 0, overFragmentationRisk: 0, missingActionRisk: 0, needsHumanReview: true, reviewReasons: [LABEL] },
  }
  if (name === 'multi') {
    result.standaloneTasks = [task('submit', '提交', '活动报名表'), task('print', '打印', '入场凭证')]
    result.materials = result.standaloneTasks.map((item, index) => ({ tempId: `m${index}`, name: item.actionObject,
      required: true, formatRequirements: [index === 0 ? 'PDF' : 'A4'], namingRequirements: index === 0 ? ['组别'] : [],
      quantity: 1, submissionChannel: index === 0 ? '活动平台' : null, relatedTaskTempIds: [item.tempId],
      evidenceIds: ['notice'], confidence: 1, selected: true }))
    result.timePoints = result.standaloneTasks.map((item, index) => ({ tempId: `d${index}`, type: 'task_deadline',
      rawText: `2026年9月${10 + index}日18:00前`, normalizedValue: `2026-09-${10 + index}T18:00`,
      timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false,
      relatedTaskTempIds: [item.tempId], relatedMaterialTempIds: [`m${index}`], evidenceIds: ['notice'], confidence: 1, selected: true }))
    result.standaloneTasks.forEach((item, index) => { item.materialTempIds = [`m${index}`]; item.timePointTempIds = [`d${index}`] })
  } else if (name === 'no-date') result.standaloneTasks = [task('save', '保存', '活动手册')]
  else if (name === 'vague') {
    result.standaloneTasks = [task('summary', '提交', '活动总结', false)]
    result.standaloneTasks[0].timePointTempIds = ['vague-date']
    result.timePoints = [{ tempId: 'vague-date', type: 'task_deadline', rawText: '近期', normalizedValue: null,
      timezone: 'Asia/Shanghai', isAllDay: false, precision: 'vague', needsConfirmation: true,
      relatedTaskTempIds: ['summary'], relatedMaterialTempIds: [], evidenceIds: ['notice'], confidence: 0, selected: false }]
    result.ambiguities = [{ id: 'time-question', field: 'deadline', message: '近期不能换成具体日期，需要核对。', options: [], evidenceIds: ['notice'] }]
  } else if (name.startsWith('condition-')) {
    result.standaloneTasks = [task('conditional', '提交', '场地申请表', name === 'condition-true')]
    result.standaloneTasks[0].description = raw
    result.ambiguities = [{ id: 'condition-gap', field: 'condition', message: '人工标注条件状态；现有契约无独立条件状态字段，不代表本机已判断。', options: [], evidenceIds: ['notice'] }]
  } else if (name === 'revision') {
    result.standaloneTasks = [task('old', '打印', '纸质报名表', false), task('new', '提交', '电子报名表')]
    result.conflicts = [{ id: 'revision-gap', type: 'other', message: raw, entityTempIds: ['old', 'new'], evidenceIds: ['notice'], requiresDecision: true }]
  }
  return result
}
