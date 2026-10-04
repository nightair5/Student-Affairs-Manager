import type { SemanticInput } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import { bridgeSemanticToRecognitionD26 } from './firstSuggestionD26'
import { projectDirectiveDisposition } from './directiveDispositionProduct'
import { decodeSourceContractRecording } from './sourceContractV4'
import { projectSourceSupportAccounting } from './sourceAccountingSupportProduct'

export const CONDITIONAL_NON_ACTION_VERSION = 'source-grounded-conditional-nonaction-1.0.0'
type Task = SemanticInput['tasks'][number]
const verbs: Record<string, string[]> = { submit: ['提交', '递交'], register: ['报名', '登记'], collect: ['领取', '领用'] }
const trim = (s: string) => s.replace(/[\s，。；！]/gu, '')
function conditionalEvidence(task: Task, input: SemanticInput, context: WireContext) {
  const scopes = context.index.scopes
  const get = (ids: string[]) => ids.flatMap(id => scopes.find(s => s.id === id) ?? [])
  const action = task.action.surface.replace(/^(?:不能|不得|禁止)/u, '')
  if (!verbs[task.actionType]?.includes(action)) return null
  const rule = get(task.condition.conditionScopeIds).find(s => {
    const text = trim(s.text)
    const match = text.match(/^(?:本轮|本次)?(.+?)(?:仅限|只限)(?:获准|批准|许可)(?:的)?社团$/u)
    return match?.[1] === task.object.surface
  })
  const fact = get(task.condition.factScopeIds).find(s => /^(?:你的|本|该)社团(?:尚未|还未|未)(?:获准|批准|获得许可)$/u.test(trim(s.text)))
  const prohibition = get(task.propositionScopeIds).find(s => trim(s.text) === '不能' + action + task.object.surface || trim(s.text) === '不得' + action + task.object.surface)
  if (!rule || !fact || !prohibition || rule.order >= fact.order || fact.order + 1 !== prohibition.order) return null
  // Match the same authorization predicate, rather than treating every false condition as deletion.
  const predicate = (s: string) => s.includes('获准') ? '获准' : s.includes('批准') ? '批准' : '许可'
  if (predicate(rule.text) !== predicate(fact.text)) return null
  const support = [rule.id, fact.id, prohibition.id]
  if (task.action.scopeId !== prohibition.id || task.object.scopeId !== prohibition.id
    || !task.propositionScopeIds.every(id => support.includes(id))
    || !task.condition.conditionScopeIds.every(id => support.includes(id))
    || !task.condition.factScopeIds.every(id => id === fact.id)) return null
  const linked = task.detail.parentTempId || task.detail.dependencyTempIds.length || task.detail.materialTempIds.length
    || task.detail.timePointTempIds.length || task.eventTempIds.length
    || input.tasks.some(t => t.id !== task.id && (t.detail.dependencyTempIds.includes(task.id) || t.detail.parentTempId === task.id || t.propositionScopeIds.some(id => support.includes(id))))
    || input.materials.some(m => m.relatedTaskTempIds.includes(task.id))
    || input.timePoints.some(t => t.relatedTaskTempIds.includes(task.id))
    || input.events.some(e => e.relatedTaskTempIds.includes(task.id) || e.scopeIds.some(id => support.includes(id)))
    || input.revisions.some(r => r.targetDirectiveId === task.id || r.fromDirectiveId === task.id)
    || input.conflicts.some(c => !c.entityTempIds.length || c.entityTempIds.includes(task.id))
    || input.unresolvedScopeIds.some(id => support.includes(id))
  return linked ? null : support
}

/** A narrow current-eligibility projection, never a general false/unknown filter. */
export function projectConditionalNonAction(input: SemanticInput, context: WireContext) {
  const direct = projectDirectiveDisposition(input, context), result = direct.result
  const decisions = result.tasks.filter(t => t.condition.value === 'false').map(task => {
    const evidence = conditionalEvidence(task, input, context)
    const eligible = evidence && task.semantics.polarity === 'negative' && task.semantics.speechAct === 'directive'
      && ['pending', 'cancelled'].includes(task.semantics.status) && task.semantics.validity === 'active'
      && ['addressee', 'addressed_group'].includes(task.semantics.actor) && task.inferenceLevel === 'explicit'
      && ['present', 'future'].includes(task.semantics.tense) && task.semantics.modality === 'required'
    return { entityId: task.id, operation: eligible ? 'CURRENT_INAPPLICABLE_INFORMATION' as const : 'RETAIN_BLOCKED' as const,
      scopeIds: eligible ? evidence : [], original: structuredClone(task), reason: eligible
        ? '原文明确本次资格不适用并禁止这个动作；保留说明和依据，不增加可执行待办。'
        : '资格、对象、状态或关系未形成安全证据链；保留相关项核对。' }
  })
  const removed = new Set(decisions.filter(d => d.operation === 'CURRENT_INAPPLICABLE_INFORMATION').map(d => d.entityId))
  result.tasks = result.tasks.filter(t => !removed.has(t.id))
  result.informationScopeIds = [...new Set([...result.informationScopeIds, ...decisions.flatMap(d => d.scopeIds)])]
  return { result, audit: { version: CONDITIONAL_NON_ACTION_VERSION, role: 'POST_HOC_PROGRAM_CONVERSION' as const, inferredFacts: 0,
    directProjection: direct.audit, decisions, originalTaskCount: input.tasks.length, currentSuggestionTaskCount: result.tasks.length } }
}

/** Check, never reconnect, task's declared edges against their actual owner. */
function publicTaskGraphGuards(input: SemanticInput): SemanticInput['conflicts'] {
  const guards: SemanticInput['conflicts'] = []
  for(const task of input.tasks){
    const invalidTimes=task.detail.timePointTempIds.filter(id=>!input.timePoints.some(p=>p.tempId===id&&p.relatedTaskTempIds.includes(task.id)))
    const invalidMaterials=task.detail.materialTempIds.filter(id=>!input.materials.some(m=>m.tempId===id&&m.relatedTaskTempIds.includes(task.id)))
    const missingTimes=input.timePoints.filter(p=>p.relatedTaskTempIds.includes(task.id)&&!task.detail.timePointTempIds.includes(p.tempId)).map(p=>p.tempId)
    const missingMaterials=input.materials.filter(m=>m.relatedTaskTempIds.includes(task.id)&&!task.detail.materialTempIds.includes(m.tempId)).map(m=>m.tempId)
    const parent=task.detail.parentTempId
    const invalidParent=parent!==null&&(!input.tasks.some(t=>t.id===parent)||parent===task.id||task.detail.hierarchyType!=='subtask')
    const invalidDependency=task.detail.dependencyTempIds.filter(id=>id===task.id||!input.tasks.some(t=>t.id===id))
    const invalidEvents=task.eventTempIds.filter(id=>!input.events.some(e=>e.tempId===id&&e.relatedTaskTempIds.includes(task.id)))
    const affected=[...invalidTimes,...invalidMaterials,...missingTimes,...missingMaterials,...invalidDependency,...invalidEvents,...(invalidParent&&parent?[parent]:[])]
    // This declaration is wrong. Its correctly owned independent event is not.
    // Keep the original invalid edges in the sidecar; block the declaring task only.
    if(affected.length)guards.push({id:'current-task-graph-'+task.id,type:'other',message:'这项任务的时间、材料或关联对象不一致；请核对关联项。无关事项可以继续保存。',entityTempIds:[task.id],scopeIds:task.propositionScopeIds,requiresDecision:true})
  }
  return guards
}

export function decodeCurrentSourceRecording(raw: string, candidate: Parameters<typeof decodeSourceContractRecording>[1], context: WireContext) {
  const support = candidate === 'Candidate19' || candidate === 'EngineeringFixture' ? projectSourceSupportAccounting(raw, context) : null
  const decoded = decodeSourceContractRecording(support?.projectedHttpText ?? raw, candidate, context)
  const graphGuards=publicTaskGraphGuards(decoded.originalAdapted),checked=structuredClone(decoded.originalAdapted)
  checked.conflicts.push(...graphGuards)
  const projection = projectConditionalNonAction(checked, context), bridge = bridgeSemanticToRecognitionD26(projection.result, context)
  const removed = new Set([...projection.audit.decisions.filter(d => d.operation === 'CURRENT_INAPPLICABLE_INFORMATION'),
    ...projection.audit.directProjection.decisions.filter(d => d.operation === 'NON_ACTION_INFORMATION')].map(d => d.entityId))
  const guards = decoded.result.conflicts.filter(c => !c.entityTempIds.length || c.entityTempIds.some(id => !removed.has(id)))
  bridge.result.conflicts = [...new Map([...bridge.result.conflicts, ...guards].map(c => [c.id, c])).values()]
  if (bridge.result.conflicts.some(c => c.requiresDecision)) {
    bridge.result.quality.needsHumanReview = true
    bridge.result.quality.reviewReasons = [...new Set([...bridge.result.quality.reviewReasons, ...bridge.result.conflicts.filter(c => c.requiresDecision).map(c => c.message)])]
  }
  bridge.result.modelName = decoded.result.modelName
  // Candidate prompt identity remains original; this is a separately audited public program component.
  bridge.result.promptVersion = decoded.result.promptVersion
  for (const task of bridge.result.standaloneTasks) if (decoded.result.standaloneTasks.find(t => t.tempId === task.tempId)?.selected === false
    || graphGuards.some(g=>g.entityTempIds.includes(task.tempId))) task.selected = false
  return { ...decoded, result: bridge.result, sidecar: { ...bridge.sidecar, originalSemantic: structuredClone(decoded.originalAdapted),
    frozenBridgeResult: structuredClone(decoded.result), supportAccountingAudit: support?.audit ?? null, productGraphGuards: graphGuards, productDisposition: projection.audit },
    supportAccountingAudit: support?.audit ?? null, productDisposition: projection.audit }
}
