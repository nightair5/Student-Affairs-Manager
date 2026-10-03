import type { SemanticInput } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import { bridgeSemanticToRecognitionD26 } from './firstSuggestionD26'
import type { decodeSourceContractRecording } from './sourceContractV4'

export const DIRECTIVE_DISPOSITION_VERSION = 'source-grounded-nonaction-projection-1.0.1'
type Task = SemanticInput['tasks'][number]
function negativeEvidence(task: Task, context: WireContext) {
  return task.propositionScopeIds.flatMap(id => {
    const scope = context.index.scopes.find(s => s.id === id)
    if (!scope || !scope.text.includes(task.action.surface) || !scope.text.includes(task.object.surface)) return []
    const before = scope.text.slice(0, scope.text.indexOf(task.action.surface))
    // Only direct negation of this action. Double negation and mixed directives
    // stay unresolved; no source-wide keyword deletion or inferred answers.
    return /(?:无需|不需要|不必|不要|禁止)(?:再|再次|重复|自行|擅自|额外)?\s*$/u.test(before)
      && !/并非|不是|不能不|不得不|不只是|不仅|[?？]|(?:吗|么)[，。；！？]$/u.test(scope.text) ? [scope] : []
  })
}
function referenced(task: Task, input: SemanticInput) {
  return task.condition.value !== 'not_applicable' || task.detail.dependencyTempIds.length > 0
    || task.detail.parentTempId !== null || task.detail.materialTempIds.length > 0
    || task.detail.timePointTempIds.length > 0 || task.eventTempIds.length > 0
    || input.tasks.some(t => t.detail.dependencyTempIds.includes(task.id) || t.detail.parentTempId === task.id)
    || input.materials.some(m => m.relatedTaskTempIds.includes(task.id))
    || input.timePoints.some(p => p.relatedTaskTempIds.includes(task.id))
    || input.events.some(e => e.relatedTaskTempIds.includes(task.id))
    || input.revisions.some(r => r.targetDirectiveId === task.id || r.fromDirectiveId === task.id)
    || input.conflicts.some(c => c.entityTempIds.includes(task.id))
}
function sharedPrimaryScope(task: Task, input: SemanticInput) {
  const shares = (ids: string[]) => ids.some(id => task.propositionScopeIds.includes(id))
  return input.tasks.some(t => t.id !== task.id && shares(t.propositionScopeIds))
    || input.events.some(e => shares(e.scopeIds))
}

/** Product conversion after the frozen diagnosis. Never modifies wire/raw or scores. */
export function projectDirectiveDisposition(input: SemanticInput, context: WireContext) {
  const result = structuredClone(input)
  const decisions = input.tasks.filter(t => t.semantics.polarity === 'negative').map(task => {
    const evidence = negativeEvidence(task, context)
    const isolated = !referenced(task, input) && !sharedPrimaryScope(task, input)
    const eligible = evidence.length > 0 && isolated && task.semantics.speechAct === 'directive'
      && task.semantics.status === 'pending' && task.semantics.validity === 'active'
      && ['addressee', 'addressed_group'].includes(task.semantics.actor)
      && task.propositionScopeIds.every(id => evidence.some(s => s.id === id))
    return { entityId: task.id, operation: eligible ? 'NON_ACTION_INFORMATION' as const : 'RETAIN_BLOCKED' as const,
      scopeIds: evidence.map(s => s.id), original: structuredClone(task), reason: eligible
        ? '原文直接说明无需或禁止此动作；保留为说明，不创建待办。'
        : '否定依据、关联或状态尚不能安全转换；保留原事实并阻断相关项。' }
  })
  const removed = new Set(decisions.filter(d => d.operation === 'NON_ACTION_INFORMATION').map(d => d.entityId))
  result.tasks = result.tasks.filter(t => !removed.has(t.id))
  result.informationScopeIds = [...new Set([...result.informationScopeIds,
    ...decisions.filter(d => removed.has(d.entityId)).flatMap(d => d.scopeIds)])]
  return { result, audit: { version: DIRECTIVE_DISPOSITION_VERSION, role: 'POST_COMPARISON_PROGRAM_CONVERSION' as const,
    inferredFacts: 0, originalTaskCount: input.tasks.length, currentSuggestionTaskCount: result.tasks.length, decisions } }
}

export function applyRecordedDirectiveDisposition(decoded: ReturnType<typeof decodeSourceContractRecording>, context: WireContext) {
  const projection = projectDirectiveDisposition(decoded.originalAdapted, context)
  const bridge = bridgeSemanticToRecognitionD26(projection.result, context)
  // Keep all pre-existing coverage/conflict guards on the remaining facts.
  const removed = new Set(projection.audit.decisions.filter(d => d.operation === 'NON_ACTION_INFORMATION').map(d => d.entityId))
  const oldGuards = decoded.result.conflicts.filter(c => !c.entityTempIds.length || c.entityTempIds.some(id => !removed.has(id)))
  bridge.result.conflicts = [...new Map([...bridge.result.conflicts, ...oldGuards].map(c => [c.id, c])).values()]
  if (oldGuards.some(c => c.requiresDecision)) {
    bridge.result.quality.needsHumanReview = true
    bridge.result.quality.reviewReasons = [...new Set([...bridge.result.quality.reviewReasons, ...oldGuards.filter(c => c.requiresDecision).map(c => c.message)])]
  }
  bridge.result.modelName = decoded.result.modelName
  bridge.result.promptVersion = DIRECTIVE_DISPOSITION_VERSION
  for (const task of bridge.result.standaloneTasks) if (decoded.result.standaloneTasks.find(t => t.tempId === task.tempId)?.selected === false) task.selected = false
  return { ...decoded, result: bridge.result, sidecar: { ...bridge.sidecar,
    originalSemantic: structuredClone(decoded.originalAdapted), frozenBridgeResult: structuredClone(decoded.result),
    productDisposition: projection.audit }, productDisposition: projection.audit }
}
