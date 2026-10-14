import type {
  ImmutableScope,
  ImmutableScopeIndex,
  ScopeReferenceSemantics,
  SurfaceReference,
} from './scopeReferenceContract'
import {
  formLocalTaskSuggestions,
  type LocalTaskFormationIssue,
  type LocalTaskFormationResult,
  type LocalTaskSuggestion,
  type ReducedDirectiveAnchor,
  type ReducedModelAnchors,
} from './taskFormationPolicyV2'

export const TASK_FORMATION_P1_POLICY_VERSION = 'task-formation-policy-2.1.0-p1' as const

export type LocalTaskFormationP1Result = Omit<LocalTaskFormationResult, 'policyVersion'> & {
  policyVersion: typeof TASK_FORMATION_P1_POLICY_VERSION
}

const NEGATIVE_RE = /(?:不要|不得|禁止|无需|不用|不需要|不再|暂勿|暂缓|先不要|不要求|不强制)/u
const OPTIONAL_RE = /(?:可以|可自行|可通过|自愿|按需|需要.+?的同学)/u
const COMPLETED_RE = /(?:已经|已完成|已办结|已结清)/u
const HISTORICAL_RE = /(?:旧通知|原通知|原安排|旧安排)/u
const GROUP_RE = /(?:同学|人员|成员|其余|大家|全体|获批免交)/u
const CONDITIONAL_PREFIX_RE = /^(?:若|如果|如)(.+?)(?:，|,|则|$)|^当(.+?)时/u
const CONDITION_NEGATED_RE = /(?:没有|并未|尚未|未曾|未|无)/u
const EXTERNAL_TRANSFER_RE = /(?:提交|上传|发送|发给|递交|邮寄|寄送|投递|外发)/u
const EXTERNAL_INTERACTION_RE = /(?:联系|报名|注册|付款|缴费|支付)/u

function scopeMap(index: ImmutableScopeIndex): Map<string, ImmutableScope> {
  return new Map(index.scopes.map((scope) => [scope.id, scope]))
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function scopeKey(scopeIds: string[]): string {
  return unique(scopeIds).sort().join('|')
}

function textFor(scopeIds: string[], scopes: Map<string, ImmutableScope>): string {
  return scopeIds.map((id) => scopes.get(id)?.text ?? '').join('')
}

function validSurface(reference: SurfaceReference, scopeIds: string[], scopes: Map<string, ImmutableScope>): boolean {
  return scopeIds.includes(reference.scopeId) && Boolean(scopes.get(reference.scopeId)?.text.includes(reference.surface))
}

function usableObject(anchor: ReducedDirectiveAnchor, scopes: Map<string, ImmutableScope>): boolean {
  const surface = anchor.objectSurfaceHint.surface.trim()
  return surface.length > 0
    && !/^(?:再次|立即|照做|操作)$/u.test(surface)
    && validSurface({ scopeId: anchor.objectSurfaceHint.scopeId, surface }, anchor.propositionScopeIds, scopes)
}

function anchorForTask(task: LocalTaskSuggestion, anchors: ReducedDirectiveAnchor[]): ReducedDirectiveAnchor | undefined {
  const taskScopes = new Set(task.propositionScopeIds)
  const candidates = anchors.filter((anchor) => anchor.propositionScopeIds.some((id) => taskScopes.has(id)))
  return candidates.find((anchor) => anchor.actionSurfaceHint.scopeId === task.action.scopeId
      && (anchor.actionSurfaceHint.surface === task.action.surface
        || anchor.actionSurfaceHint.surface.includes(task.action.surface)
        || task.action.surface.includes(anchor.actionSurfaceHint.surface)))
    ?? candidates.find((anchor) => anchor.actionTypeHint === task.actionType)
}

function preserveObject(task: LocalTaskSuggestion, anchors: ReducedDirectiveAnchor[], scopes: Map<string, ImmutableScope>): SurfaceReference {
  const anchor = anchorForTask(task, anchors)
  if (!anchor || !usableObject(anchor, scopes)) return task.object
  return { scopeId: anchor.objectSurfaceHint.scopeId, surface: anchor.objectSurfaceHint.surface.trim() }
}

function splitDistinctObjectMerges(
  index: ImmutableScopeIndex,
  reduced: ReducedModelAnchors,
  tasks: LocalTaskSuggestion[],
): LocalTaskSuggestion[] {
  const scopes = scopeMap(index)
  const groups = new Map<string, ReducedDirectiveAnchor[]>()
  for (const anchor of reduced.directives) {
    const key = scopeKey(anchor.propositionScopeIds)
    groups.set(key, [...(groups.get(key) ?? []), anchor])
  }
  let output = [...tasks]
  for (const [key, anchors] of groups) {
    if (anchors.length < 2) continue
    const distinctObjects = new Set(anchors.map((anchor) => `${anchor.objectSurfaceHint.scopeId}\u0000${anchor.objectSurfaceHint.surface.trim()}`))
    if (distinctObjects.size <= 1) continue
    const matches = output.filter((task) => scopeKey(task.propositionScopeIds) === key)
    if (matches.length >= anchors.length || matches.length !== 1 || matches[0].steps.length === 0) continue
    const inherited = matches[0]
    const replacements = anchors.map((anchor) => {
      const single = formLocalTaskSuggestions(index, {
        ...reduced,
        directives: [anchor],
        observations: [],
        ignoredScopeIds: [],
      }).tasks[0]
      if (!single) throw new Error(`P1_SPLIT_FORMATION_FAILED:${anchor.anchorId}`)
      return {
        ...single,
        id: `split-${anchor.anchorId}`,
        propositionScopeIds: unique([...single.propositionScopeIds, ...inherited.propositionScopeIds]),
        object: usableObject(anchor, scopes)
          ? { scopeId: anchor.objectSurfaceHint.scopeId, surface: anchor.objectSurfaceHint.surface.trim() }
          : single.object,
        steps: [],
        timeRefs: uniqueReferences([...single.timeRefs, ...inherited.timeRefs]),
        materialRefs: uniqueReferences([...single.materialRefs, ...inherited.materialRefs]),
        eventRef: single.eventRef ?? inherited.eventRef,
        locationRef: single.locationRef ?? inherited.locationRef,
        revisionRefs: [],
        policyReasons: [...single.policyReasons, 'P1_DISTINCT_OBJECT_BOUNDARY'],
      }
    })
    output = output.flatMap((task) => task === inherited ? replacements : [task])
  }
  return output
}

function uniqueReferences<T extends SurfaceReference>(values: T[]): T[] {
  return values.filter((value, position) => values.findIndex((candidate) => candidate.scopeId === value.scopeId
    && candidate.surface === value.surface) === position)
}

function normalizedAssertion(text: string): string {
  return text
    .replace(/[。；;，,：:\s]/gu, '')
    .replace(/^(?:当前|目前|现在|现已|实际上|事实是)/u, '')
    .replace(/(?:确实|已经|已)/gu, '')
}

function conditionState(scopeIds: string[], scopes: Map<string, ImmutableScope>): 'none' | 'triggered' | 'untriggered' {
  const texts = scopeIds.map((id) => scopes.get(id)?.text ?? '')
  const conditionPosition = texts.findIndex((text) => CONDITIONAL_PREFIX_RE.test(text.trim()))
  if (conditionPosition < 0) return 'none'
  const match = texts[conditionPosition].trim().match(CONDITIONAL_PREFIX_RE)
  const rawCondition = (match?.[1] ?? match?.[2] ?? '').replace(/[，,。；;]$/u, '')
  const condition = normalizedAssertion(rawCondition)
  if (!condition) return 'untriggered'
  const trigger = texts.slice(conditionPosition + 1).find((text) => {
    if (!/(?:当前|目前|现在|现已|实际上|事实是|确实|已经)/u.test(text) || NEGATIVE_RE.test(text) || CONDITION_NEGATED_RE.test(text)) return false
    return normalizedAssertion(text).includes(condition)
  })
  return trigger ? 'triggered' : 'untriggered'
}

function semanticsForP1(scopeIds: string[], scopes: Map<string, ImmutableScope>, action: SurfaceReference): { semantics: ScopeReferenceSemantics; reasons: string[] } {
  const text = textFor(scopeIds, scopes)
  const condition = conditionState(scopeIds, scopes)
  const negative = NEGATIVE_RE.test(text)
  const optional = OPTIONAL_RE.test(text)
  const completed = COMPLETED_RE.test(text)
  const historical = HISTORICAL_RE.test(text)
  const actionScopeText = scopes.get(action.scopeId)?.text ?? ''
  const actionOffset = actionScopeText.indexOf(action.surface)
  const actorPrefix = actionOffset >= 0 ? actionScopeText.slice(0, actionOffset) : ''
  const group = optional || GROUP_RE.test(actorPrefix)
  const unresolvedCondition = condition === 'untriggered'
  const reasons: string[] = []
  if (condition === 'triggered') reasons.push('P1_CONDITION_EXPLICITLY_TRIGGERED')
  if (unresolvedCondition) reasons.push('P1_CONDITION_UNTRIGGERED')
  if (negative) reasons.push(/暂勿|暂缓|先不要/u.test(text) ? 'P1_NEGATIVE_TEMPORARY_HOLD' : 'P1_NEGATIVE')
  if (optional) reasons.push('P1_OPTIONAL')
  if (group) reasons.push('P1_GROUP_ACTOR')
  if (historical) reasons.push('P1_HISTORICAL')
  return {
    semantics: {
      actor: group ? 'addressed_group' : 'addressee',
      speechAct: unresolvedCondition ? 'hypothetical' : 'directive',
      polarity: unresolvedCondition ? 'uncertain' : negative ? 'negative' : 'affirmative',
      tense: completed ? 'past' : 'future',
      status: completed ? 'completed' : unresolvedCondition ? 'unknown' : negative || historical ? 'cancelled' : 'pending',
      validity: unresolvedCondition ? 'uncertain' : historical ? 'superseded' : 'active',
      modality: optional ? 'optional' : 'required',
    },
    reasons,
  }
}

function effectForP1(task: LocalTaskSuggestion, scopeText: string): LocalTaskSuggestion['effect'] {
  const actionSurface = task.action.surface
  const objectEndsWithTransfer = /(?:提交|上传|发送|递交|邮寄|寄送|投递|外发)$/u.test(task.object.surface)
  const objectEndsWithInteraction = /(?:联系|报名|注册|付款|缴费|支付)$/u.test(task.object.surface)
  if (EXTERNAL_TRANSFER_RE.test(actionSurface) || objectEndsWithTransfer || ['submit', 'upload', 'send'].includes(task.actionType)) return 'external_transfer'
  if (EXTERNAL_INTERACTION_RE.test(actionSurface) || objectEndsWithInteraction || ['contact', 'register', 'pay'].includes(task.actionType)) return 'external_interaction'
  if (task.actionType === 'complete' && /(?:在线|网页|系统|平台).{0,8}确认|确认.{0,8}(?:在线|阅读状态|系统状态)/u.test(scopeText)) {
    return 'external_interaction'
  }
  if (['attend', 'carry', 'print', 'sign'].includes(task.actionType)) return 'physical_action'
  if (['review', 'complete', 'fill', 'prepare', 'save', 'collect'].includes(task.actionType)) return 'local_change'
  return 'unknown'
}

function isCurrentRequiredAction(semantics: ScopeReferenceSemantics): boolean {
  return (semantics.actor === 'addressee' || semantics.actor === 'addressed_group')
    && semantics.speechAct === 'directive'
    && semantics.polarity === 'affirmative'
    && semantics.tense === 'future'
    && semantics.status === 'pending'
    && semantics.validity === 'active'
    && semantics.modality === 'required'
}

function maySelectP1(task: Pick<LocalTaskSuggestion, 'semantics' | 'effect' | 'actionType'>): boolean {
  if (!isCurrentRequiredAction(task.semantics)) return false
  if (task.effect === 'local_change') return task.actionType !== 'other'
  return task.effect === 'physical_action' && ['carry', 'print'].includes(task.actionType)
}

function taskOrder(task: LocalTaskSuggestion, scopes: Map<string, ImmutableScope>): [number, number] {
  const scope = scopes.get(task.action.scopeId)
  return [scope?.order ?? Number.MAX_SAFE_INTEGER, scope?.text.indexOf(task.action.surface) ?? Number.MAX_SAFE_INTEGER]
}

export function formLocalTaskSuggestionsP1(index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationP1Result {
  const scopes = scopeMap(index)
  const base = formLocalTaskSuggestions(index, reduced)
  const split = splitDistinctObjectMerges(index, reduced, structuredClone(base.tasks))
  const tasks = split.map((task) => {
    const propositionScopeIds = unique(task.propositionScopeIds).filter((id) => scopes.has(id))
    const object = preserveObject(task, reduced.directives, scopes)
    const { semantics, reasons } = semanticsForP1(propositionScopeIds, scopes, task.action)
    const effect = effectForP1({ ...task, object }, textFor(propositionScopeIds, scopes))
    const candidate = { ...task, propositionScopeIds, object, semantics, effect }
    const selected = maySelectP1(candidate)
    const retainedReasons = task.policyReasons.filter((reason) => !/^(?:CONDITION_|NEGATIVE_|HISTORICAL_|OPTIONAL_|EXTERNAL_EFFECT|LOCAL_SAFE_DEFAULT_)/u.test(reason))
    return {
      ...candidate,
      selected,
      needsConfirmation: !selected,
      policyReasons: [...retainedReasons, ...reasons, `P1_EFFECT_${effect.toUpperCase()}`, selected ? 'P1_SAFE_DEFAULT_ALLOWED' : 'P1_SAFE_DEFAULT_BLOCKED'],
    }
  }).sort((left, right) => {
    const [leftScope, leftOffset] = taskOrder(left, scopes)
    const [rightScope, rightOffset] = taskOrder(right, scopes)
    return leftScope - rightScope || leftOffset - rightOffset || left.action.surface.localeCompare(right.action.surface, 'zh-CN')
  })
  const idMap = new Map(tasks.map((task, position) => [task.id, `task-${position + 1}`]))
  for (const task of tasks) {
    task.id = idMap.get(task.id) ?? task.id
    task.revisionRefs = task.revisionRefs.map((reference) => ({
      ...reference,
      targetTaskId: idMap.get(reference.targetTaskId) ?? reference.targetTaskId,
    }))
  }
  const requiresAction = tasks.some((task) => isCurrentRequiredAction(task.semantics))
  return {
    ...base,
    policyVersion: TASK_FORMATION_P1_POLICY_VERSION,
    requiresAction,
    tasks,
    diagnostics: {
      ...base.diagnostics,
      outputTasks: tasks.length,
      mergedActionAnchors: Math.max(0, reduced.directives.length + base.diagnostics.promotedHistoricalDirectives - tasks.length),
    },
  }
}

export function validateLocalTaskFormationP1(result: LocalTaskFormationP1Result, index: ImmutableScopeIndex): LocalTaskFormationIssue[] {
  const issues: LocalTaskFormationIssue[] = []
  const scopes = scopeMap(index)
  if (result.policyVersion !== TASK_FORMATION_P1_POLICY_VERSION) issues.push({ code: 'P1_POLICY_VERSION_INVALID', path: 'policyVersion' })
  if (result.sourceId !== index.sourceId || result.sourceVersionId !== index.sourceVersionId || result.sourceFingerprint !== index.sourceFingerprint) {
    issues.push({ code: 'P1_SOURCE_BINDING_MISMATCH', path: 'sourceId' })
  }
  if (result.modelAuthorityFieldsUsed.length > 0) issues.push({ code: 'P1_MODEL_AUTHORITY_USED', path: 'modelAuthorityFieldsUsed' })
  const taskIds = new Set(result.tasks.map((task) => task.id))
  if (taskIds.size !== result.tasks.length) issues.push({ code: 'P1_TASK_ID_DUPLICATE', path: 'tasks' })
  const checkReference = (reference: SurfaceReference, scopeIds: string[], path: string) => {
    if (!validSurface(reference, scopeIds, scopes)) issues.push({ code: 'P1_SURFACE_NOT_IN_PROPOSITION_SCOPE', path })
  }
  const derivedTaskStates = result.tasks.map((task, position) => {
    const path = `tasks[${position}]`
    if (task.propositionScopeIds.length === 0 || task.propositionScopeIds.some((id) => !scopes.has(id))) {
      issues.push({ code: 'P1_PROPOSITION_SCOPE_INVALID', path: `${path}.propositionScopeIds` })
    }
    checkReference(task.action, task.propositionScopeIds, `${path}.action`)
    checkReference(task.object, task.propositionScopeIds, `${path}.object`)
    task.steps.forEach((reference, indexPosition) => checkReference(reference, task.propositionScopeIds, `${path}.steps[${indexPosition}]`))
    task.timeRefs.forEach((reference, indexPosition) => checkReference(reference, task.propositionScopeIds, `${path}.timeRefs[${indexPosition}]`))
    task.materialRefs.forEach((reference, indexPosition) => checkReference(reference, task.propositionScopeIds, `${path}.materialRefs[${indexPosition}]`))
    if (task.eventRef) checkReference(task.eventRef, task.propositionScopeIds, `${path}.eventRef`)
    if (task.locationRef) checkReference(task.locationRef, task.propositionScopeIds, `${path}.locationRef`)
    const derivedSemantics = semanticsForP1(task.propositionScopeIds, scopes, task.action).semantics
    if (JSON.stringify(task.semantics) !== JSON.stringify(derivedSemantics)) issues.push({ code: 'P1_SEMANTICS_NOT_DERIVED', path: `${path}.semantics` })
    const derivedEffect = effectForP1(task, textFor(task.propositionScopeIds, scopes))
    if (task.effect !== derivedEffect) issues.push({ code: 'P1_EFFECT_NOT_DERIVED', path: `${path}.effect` })
    const derivedSelection = maySelectP1({ semantics: derivedSemantics, effect: derivedEffect, actionType: task.actionType })
    if (task.selected !== derivedSelection) issues.push({ code: 'P1_SELECTED_NOT_DERIVED', path: `${path}.selected` })
    if (task.selected && (task.effect === 'external_transfer' || task.effect === 'external_interaction')) {
      issues.push({ code: 'P1_FORBIDDEN_EXTERNAL_DEFAULT', path: `${path}.selected` })
    }
    task.revisionRefs.forEach((reference, indexPosition) => {
      if (!taskIds.has(reference.targetTaskId)) issues.push({ code: 'P1_REVISION_TARGET_MISSING', path: `${path}.revisionRefs[${indexPosition}]` })
    })
    return { semantics: derivedSemantics, effect: derivedEffect, selected: derivedSelection }
  })
  const derivedRequiresAction = derivedTaskStates.some((task) => isCurrentRequiredAction(task.semantics))
  if (result.requiresAction !== derivedRequiresAction) issues.push({ code: 'P1_REQUIRES_ACTION_NOT_DERIVED', path: 'requiresAction' })
  result.observations.forEach((observation, position) => {
    if (observation.selected !== false) issues.push({ code: 'P1_OBSERVATION_SELECTED', path: `observations[${position}].selected` })
  })
  return issues
}
