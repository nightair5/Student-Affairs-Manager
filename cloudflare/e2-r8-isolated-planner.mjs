import { R8_PLAN_CONTRACT_VERSION, assertR8FactGraph } from './e2-r8-planner-contracts.mjs'
import { assertR8PlannedResultContract } from './e2-r8-contract-replay-metrics.mjs'

export const R8_ISOLATED_PLANNER_VERSION = 'e2-r8-isolated-planner-1.0.0'
export const R8_REPLAY_PROMPT_VERSION = 'recognition-2.4.1-r8-cache-replay'

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function text(value, limit = 500, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, limit) : fallback
}

function strings(value, limit = 30) {
  return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))].slice(0, limit) : []
}

function number01(value, fallback = 0.8) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}

function suggestedField(value, limit, fallback) {
  const field = record(value)
  return {
    value: text(field.value, limit, fallback), evidenceIds: strings(field.evidenceIds, 20),
    confidence: number01(field.confidence),
    inferenceLevel: ['explicit', 'strong_inference', 'optional_suggestion'].includes(field.inferenceLevel) ? field.inferenceLevel : 'strong_inference',
  }
}

function sanitizeProjectSuggestion(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const project = record(value)
  const category = suggestedField(project.category, 20, '其他')
  if (!['比赛', '保研', '课程', '老师任务', '其他'].includes(category.value)) category.value = '其他'
  return {
    title: suggestedField(project.title, 160, '未命名项目'), category,
    objective: suggestedField(project.objective, 300, ''), description: suggestedField(project.description, 500, ''),
  }
}

function taskFromObligation(obligation) {
  const title = `${obligation.actionPredicate}${obligation.object}`.slice(0, 80)
  return {
    tempId: obligation.sourceTaskId || `task-from-${obligation.id.replace(/[^a-z0-9_-]/giu, '-')}`.slice(0, 100),
    parentTempId: null, hierarchyType: obligation.parentObligationId ? 'subtask' : 'task', title,
    actionVerb: obligation.actionPredicate.slice(0, 20), actionObject: obligation.object.slice(0, 80),
    description: title, completionCriteria: [], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium',
    dependencyTempIds: [],
    materialTempIds: obligation.materialIds.map((id) => id.replace(/^material:/u, '')).slice(0, 20),
    timePointTempIds: obligation.timePointIds.map((id) => id.replace(/^time:/u, '')).slice(0, 20),
    evidenceIds: obligation.evidenceIds.slice(0, 20), confidence: number01(obligation.confidence),
    inferenceLevel: obligation.provenance === 'cached_model_task' ? 'explicit' : 'strong_inference',
    userConfirmationRequired: true, selected: obligation.modality === 'required' && obligation.provenance === 'cached_model_task',
  }
}

function hierarchy(graph, taskByObligation) {
  const hints = Array.isArray(graph.hierarchyHints) ? graph.hierarchyHints : []
  const milestones = hints.slice(0, 10).map((value, milestoneIndex) => {
    const hint = record(value)
    const workPackageHints = Array.isArray(hint.workPackages) ? hint.workPackages : []
    return {
      tempId: text(hint.tempId, 100, `milestone-${milestoneIndex + 1}`),
      title: text(hint.title || hint.name, 100, `阶段 ${milestoneIndex + 1}`),
      objective: text(hint.objective || hint.description, 300),
      order: Number.isFinite(hint.order) ? hint.order : milestoneIndex + 1,
      evidenceIds: strings(hint.evidenceIds, 20),
      tasks: graph.obligations.filter((item) => item.placement?.kind === 'milestone' && item.placement.milestoneIndex === milestoneIndex)
        .map((item) => taskByObligation.get(item.id)),
      workPackages: workPackageHints.slice(0, 8).map((workPackageValue, workPackageIndex) => {
        const workPackage = record(workPackageValue)
        return {
          tempId: text(workPackage.tempId, 100, `work-package-${milestoneIndex + 1}-${workPackageIndex + 1}`),
          title: text(workPackage.title || workPackage.name, 100, `工作包 ${workPackageIndex + 1}`),
          objective: text(workPackage.objective || workPackage.description, 300),
          order: Number.isFinite(workPackage.order) ? workPackage.order : workPackageIndex + 1,
          evidenceIds: strings(workPackage.evidenceIds, 20),
          tasks: graph.obligations.filter((item) => item.placement?.kind === 'workPackage'
            && item.placement.milestoneIndex === milestoneIndex && item.placement.workPackageIndex === workPackageIndex)
            .map((item) => taskByObligation.get(item.id)),
        }
      }),
    }
  })
  return milestones.filter((item) => item.tasks.length > 0 || item.workPackages.some((workPackage) => workPackage.tasks.length > 0))
}

export function planR8RecognitionResult(graph, { modelName = 'cache-replay', createdAt = graph.referenceTime } = {}) {
  assertR8FactGraph(graph)
  const taskByObligation = new Map(graph.obligations.map((item) => [item.id, taskFromObligation(item)]))
  for (const obligation of graph.obligations) {
    if (obligation.parentObligationId && taskByObligation.has(obligation.parentObligationId)) {
      taskByObligation.get(obligation.id).parentTempId = taskByObligation.get(obligation.parentObligationId).tempId
    }
  }
  const milestones = hierarchy(graph, taskByObligation)
  const standaloneTasks = graph.obligations.filter((item) => item.placement?.kind === 'standalone' || !item.placement)
    .map((item) => taskByObligation.get(item.id))
  const rawMatch = record(graph.projectMatch)
  const decision = ['new_project', 'existing_project', 'standalone_task', 'uncertain'].includes(rawMatch.decision) ? rawMatch.decision : 'uncertain'
  const allTaskIds = new Set([...standaloneTasks, ...milestones.flatMap((item) => [...item.tasks, ...item.workPackages.flatMap((workPackage) => workPackage.tasks)])].map((item) => item.tempId))
  const materialIds = new Set(graph.materials.map((item) => item.sourceMaterialId))
  const timeIds = new Set(graph.timePoints.map((item) => item.sourceTimePointId))

  const result = {
    schemaVersion: '2.0', promptVersion: R8_REPLAY_PROMPT_VERSION, modelName: text(modelName, 80, 'cache-replay'),
    createdAt: text(createdAt, 80, graph.referenceTime),
    sourceSummary: {
      title: text(graph.sourceSummary.title, 160, '未命名来源'), sourceType: text(graph.sourceSummary.sourceType, 30, 'text'),
      notificationType: ['new_project', 'project_addendum', 'project_correction', 'course_assignment', 'teacher_task', 'event_notice', 'meeting_notice', 'material_submission', 'registration_notice', 'result_notice', 'information_only', 'uncertain'].includes(graph.sourceSummary.notificationType) ? graph.sourceSummary.notificationType : 'uncertain',
      summary: text(graph.sourceSummary.summary, 800), requiresAction: graph.sourceSummary.requiresAction,
      actionReason: text(graph.sourceSummary.actionReason, 300),
    },
    projectMatch: {
      decision, matchedProjectId: text(rawMatch.matchedProjectId, 100) || null,
      suggestedProjectTitle: text(rawMatch.suggestedProjectTitle, 160) || null,
      confidence: number01(rawMatch.confidence), reasons: strings(rawMatch.reasons, 12),
    },
    projectSuggestion: sanitizeProjectSuggestion(graph.projectSuggestion),
    milestones, standaloneTasks,
    materials: graph.materials.map((item) => ({
      tempId: item.sourceMaterialId, name: item.name, required: item.required,
      formatRequirements: item.formatRequirements.slice(0, 10), namingRequirements: item.namingRequirements.slice(0, 10),
      quantity: item.quantity, submissionChannel: item.submissionChannel,
      relatedTaskTempIds: item.obligationIds.map((id) => taskByObligation.get(id)?.tempId).filter((id) => allTaskIds.has(id)).slice(0, 30),
      evidenceIds: item.evidenceIds.slice(0, 20), confidence: number01(item.confidence), selected: item.required,
    })),
    timePoints: graph.timePoints.map((item) => ({
      tempId: item.sourceTimePointId, type: item.role, rawText: item.rawText,
      normalizedValue: item.normalizedValue, timezone: item.timezone, isAllDay: item.isAllDay,
      precision: item.precision, needsConfirmation: item.needsConfirmation,
      relatedTaskTempIds: item.relatedObligationIds.map((id) => taskByObligation.get(id)?.tempId).filter((id) => allTaskIds.has(id)).slice(0, 30),
      relatedMaterialTempIds: item.relatedMaterialIds.map((id) => id.replace(/^material:/u, '')).filter((id) => materialIds.has(id)).slice(0, 30),
      evidenceIds: item.evidenceIds.slice(0, 20), confidence: number01(item.confidence),
      selected: item.normalizedValue !== null && !item.needsConfirmation,
    })),
    events: graph.events.map((item) => ({
      tempId: item.sourceEventId, title: item.title, description: item.description,
      startTimePointTempId: item.startTimePointId ? item.startTimePointId.replace(/^time:/u, '') : null,
      endTimePointTempId: item.endTimePointId ? item.endTimePointId.replace(/^time:/u, '') : null,
      location: item.location, evidenceIds: item.evidenceIds.slice(0, 20), confidence: number01(item.confidence),
      inferenceLevel: item.inferenceLevel, selected: item.inferenceLevel === 'explicit',
    })).map((item) => ({
      ...item,
      startTimePointTempId: item.startTimePointTempId && timeIds.has(item.startTimePointTempId) ? item.startTimePointTempId : null,
      endTimePointTempId: item.endTimePointTempId && timeIds.has(item.endTimePointTempId) ? item.endTimePointTempId : null,
    })),
    evidence: graph.evidence.map((item) => ({
      id: item.id, sourceId: 'pending-source', quote: item.quote, quotedText: item.quote,
      field: ['title', 'deadline', 'materials', 'description', 'project', 'milestone', 'event', 'requirement'].includes(item.field) ? item.field : 'description',
      extractionMethod: 'ai', confidence: number01(item.confidence),
    })),
    conflicts: [],
    ambiguities: graph.ambiguities.map((item) => ({
      id: item.id.slice(0, 100), field: item.code.slice(0, 100), message: item.message.slice(0, 500),
      options: item.options.slice(0, 12), evidenceIds: item.evidenceIds.slice(0, 20),
    })),
    ignoredContent: (Array.isArray(graph.ignoredContent) ? graph.ignoredContent : []).slice(0, 30).flatMap((value) => {
      if (typeof value === 'string') return value.trim() ? [{ text: value.trim().slice(0, 500), reason: 'other' }] : []
      const item = record(value)
      const ignoredText = text(item.text || item.content, 500)
      if (!ignoredText) return []
      return [{ text: ignoredText, reason: ['background', 'contact', 'address', 'policy', 'format_requirement', 'other'].includes(item.reason) ? item.reason : 'other' }]
    }),
    quality: {
      overallConfidence: 0.8, hierarchyConfidence: 0.75,
      dateConfidence: graph.timePoints.some((item) => item.needsConfirmation) ? 0.6 : 0.85,
      evidenceCoverage: 1, duplicateRisk: 0, overFragmentationRisk: 0,
      missingActionRisk: graph.sourceSummary.requiresAction && graph.obligations.length === 0 ? 1 : 0,
      needsHumanReview: graph.ambiguities.length > 0 || graph.conditions.length > 0,
      reviewReasons: graph.conditions.length > 0 ? ['存在适用条件，需由用户确认'] : [],
    },
  }
  return assertR8PlannedResultContract(Object.assign(result, { plannerContractVersion: R8_PLAN_CONTRACT_VERSION }), graph)
}
