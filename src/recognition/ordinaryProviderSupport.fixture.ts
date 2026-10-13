import type { RecognitionResult } from './types'

export const ordinaryWorkflowText = '请登录甲业务系统，选择本学期资助业务，填写登记信息，并上传本学年回执。'
export function ordinaryWorkflowFixture(sourceText = ordinaryWorkflowText): RecognitionResult {
  const actionQuote = sourceText.includes('上传本学年回执') ? sourceText.slice(sourceText.indexOf('上传本学年回执')) : '上传本学年回执。'
  return { schemaVersion: '2.0', promptVersion: 'TEST_ONLY_NOT_MODEL_OUTPUT', modelName: 'deepseek-v4-flash', createdAt: '2026-10-13T02:00:00Z',
    sourceSummary: { title: '回执办理通知', sourceType: 'text', notificationType: 'material_submission', summary: '上传回执', requiresAction: true, actionReason: '明确要求上传回执' },
    projectMatch: { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null, confidence: .9, reasons: [] },
    projectSuggestion: null, milestones: [],
    standaloneTasks: [{ tempId: 'task-upload', parentTempId: null, hierarchyType: 'task', title: '上传本学年回执', actionVerb: '上传', actionObject: '本学年回执',
      description: '上传本学年回执', completionCriteria: ['上传本学年回执'], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium',
      dependencyTempIds: [], materialTempIds: ['material-receipt'], timePointTempIds: [], evidenceIds: ['e-action'], confidence: .9, inferenceLevel: 'explicit', userConfirmationRequired: true, selected: true }],
    materials: [{ tempId: 'material-receipt', name: '本学年回执', required: true, formatRequirements: [], namingRequirements: [], quantity: null,
      submissionChannel: '甲业务系统', relatedTaskTempIds: ['task-upload'], evidenceIds: ['e-login', 'e-action'], confidence: .9 }],
    timePoints: [], events: [], evidence: [
      { id: 'e-login', sourceId: 'pending-source', quote: '登录甲业务系统，', field: 'materials' },
      { id: 'e-action', sourceId: 'pending-source', quote: actionQuote, field: 'description' },
    ], conflicts: [], ambiguities: [], ignoredContent: [],
    quality: { overallConfidence: .9, hierarchyConfidence: .9, dateConfidence: .9, evidenceCoverage: .9, duplicateRisk: 0, overFragmentationRisk: 0,
      missingActionRisk: 0, needsHumanReview: false, reviewReasons: [] },
  }
}
