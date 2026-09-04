import type { ImmutableScope, ImmutableScopeIndex, ScopeReferenceSemantics, SurfaceReference } from './scopeReferenceContract'
import { type LocalTaskFormationIssue, type LocalTaskSuggestion, type ReducedDirectiveAnchor, type ReducedModelAnchors } from './taskFormationPolicyV2'
import { formLocalTaskSuggestionsP1, type LocalTaskFormationP1Result } from './taskFormationPolicyP1'

export const TASK_FORMATION_P2_POLICY_VERSION = 'task-formation-policy-2.2.0-p2' as const

export type LocalTaskFormationP2Result = Omit<LocalTaskFormationP1Result, 'policyVersion'> & {
  policyVersion: typeof TASK_FORMATION_P2_POLICY_VERSION
}

type ConditionTruth = 'none' | 'true' | 'false' | 'unknown'

const DIRECTIVE_MARKER_RE = /(?:必须|不得|禁止|无需|不用|不需要|应当|应该|须|请|需要|可以|可自行|可通过|自愿|需)/u
const DIRECT_NEGATIVE_RE = /(?:不得|禁止|无需|不用|不需要|不再|暂勿|暂缓|先不要|不要求|不强制)/u
const OPTIONAL_RE = /(?:可以|可自行|可通过|自愿|按需)/u
const HISTORICAL_RE = /(?:旧通知|原通知|原安排|旧安排|原要求)/u
const REVOCATION_RE = /(?:作废|取消|撤销|不再有效|停止执行)/u
const GROUP_SUBJECT_RE = /(?:同学|人员|成员|全体|大家|获批免交者|旁听者|其余人)/u
const CONDITION_START_RE = /^(?:若|如果|如)(.+?)(?:，|,|则|$)|^当(.+?)时/u
const ASSERTION_PREFIX_RE = /^(?:当前|目前|现在|现状是|现况是|事实是|实际情况是|经确认|已确认)/u
const EMPHASIS_RE = /^(?:确实|已经|已经确认|现已)/u
const EXPLICIT_NEGATION_RE = /^(?:并未|尚未|没有|未曾|并没有|不是|不再)/u

function scopeMap(index: ImmutableScopeIndex): Map<string, ImmutableScope> {
  return new Map(index.scopes.map((scope) => [scope.id, scope]))
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function textFor(scopeIds: string[], scopes: Map<string, ImmutableScope>): string {
  return scopeIds.map((id) => scopes.get(id)?.text ?? '').join('')
}

function normalizeProposition(value: string): string {
  let result = value.normalize('NFKC').replace(/[。；;，,：:\s]/gu, '')
  let previous = ''
  while (previous !== result) {
    previous = result
    result = result.replace(ASSERTION_PREFIX_RE, '').replace(EMPHASIS_RE, '')
  }
  return result.replace(/(?:此刻|现在)/gu, '')
}

function conditionSurface(text: string): string | null {
  const match = text.trim().match(CONDITION_START_RE)
  return (match?.[1] ?? match?.[2] ?? '').replace(/[，,。；;]$/u, '') || null
}

function assertionRelation(condition: string, assertion: string): 'true' | 'false' | 'unknown' {
  const target = normalizeProposition(condition)
  const fact = normalizeProposition(assertion)
  if (!target || !fact) return 'unknown'
  const stripped = fact.replace(EXPLICIT_NEGATION_RE, '')
  if (stripped !== fact && (stripped.includes(target) || target.includes(stripped))) return 'false'
  if (fact.includes(target) || target.includes(fact)) return 'true'
  return 'unknown'
}

function conditionTruth(scopeIds: string[], scopes: Map<string, ImmutableScope>): ConditionTruth {
  const texts = scopeIds.map((id) => scopes.get(id)?.text ?? '')
  const position = texts.findIndex((text) => conditionSurface(text) !== null)
  if (position < 0) return 'none'
  const condition = conditionSurface(texts[position])
  if (!condition) return 'unknown'
  for (const assertion of texts.slice(position + 1)) {
    if (!ASSERTION_PREFIX_RE.test(assertion.trim())) continue
    const relation = assertionRelation(condition, assertion)
    if (relation !== 'unknown') return relation
  }
  return 'unknown'
}

function anchorForTask(task: LocalTaskSuggestion, anchors: ReducedDirectiveAnchor[]): ReducedDirectiveAnchor | undefined {
  const taskScopes = new Set(task.propositionScopeIds)
  const candidates = anchors.filter((anchor) => anchor.propositionScopeIds.some((id) => taskScopes.has(id)))
  return candidates.find((anchor) => anchor.actionTypeHint === task.actionType && anchor.objectSurfaceHint.surface === task.object.surface)
    ?? candidates.find((anchor) => anchor.actionTypeHint === task.actionType)
    ?? candidates.find((anchor) => anchor.objectSurfaceHint.surface === task.object.surface)
    ?? candidates[0]
}

function validSurface(reference: SurfaceReference, scopeIds: string[], scopes: Map<string, ImmutableScope>): boolean {
  return scopeIds.includes(reference.scopeId) && Boolean(scopes.get(reference.scopeId)?.text.includes(reference.surface))
}

function exactAction(task: LocalTaskSuggestion, anchors: ReducedDirectiveAnchor[], scopes: Map<string, ImmutableScope>): SurfaceReference {
  const anchor = anchorForTask(task, anchors)
  if (!anchor || !validSurface(anchor.actionSurfaceHint, task.propositionScopeIds, scopes)) return task.action
  return { ...anchor.actionSurfaceHint }
}

function explicitActor(action: SurfaceReference, scopes: Map<string, ImmutableScope>, optional: boolean): ScopeReferenceSemantics['actor'] {
  if (optional) return 'addressed_group'
  const text = scopes.get(action.scopeId)?.text ?? ''
  const actionOffset = text.indexOf(action.surface)
  const beforeAction = actionOffset >= 0 ? text.slice(0, actionOffset) : text
  const marker = beforeAction.match(DIRECTIVE_MARKER_RE)
  const subject = marker?.index === undefined ? beforeAction : beforeAction.slice(0, marker.index)
  const normalized = subject.replace(/^(?:但|另|现在|目前|最新要求是|正式答复|最终要求是)/u, '').trim()
  return GROUP_SUBJECT_RE.test(normalized) ? 'addressed_group' : 'addressee'
}

function semanticsForP2(task: LocalTaskSuggestion, action: SurfaceReference, scopes: Map<string, ImmutableScope>): { semantics: ScopeReferenceSemantics; reasons: string[] } {
  const allText = textFor(task.propositionScopeIds, scopes)
  const actionText = scopes.get(action.scopeId)?.text ?? ''
  const actionOffset = actionText.indexOf(action.surface)
  const actionPrefix = actionOffset >= 0 ? actionText.slice(0, actionOffset) : actionText
  const truth = conditionTruth(task.propositionScopeIds, scopes)
  const historical = HISTORICAL_RE.test(allText)
  const revoked = historical && REVOCATION_RE.test(allText)
  const negative = DIRECT_NEGATIVE_RE.test(actionPrefix)
  const optional = OPTIONAL_RE.test(actionPrefix)
  const actor = explicitActor(action, scopes, optional)
  const reasons = [`P2_ACTOR_FROM_EXPLICIT_SUBJECT_${actor.toUpperCase()}`]
  if (truth !== 'none') reasons.push(`P2_CONDITION_PROPOSITION_${truth.toUpperCase()}`)
  if (revoked) reasons.push('P2_REVISION_REVOKED_HISTORICAL_DIRECTIVE')
  if (negative) reasons.push('P2_DIRECT_NEGATIVE')
  if (optional) reasons.push('P2_OPTIONAL')
  if (truth === 'unknown' || truth === 'false') {
    return { semantics: { actor, speechAct: 'hypothetical', polarity: 'uncertain', tense: 'future', status: 'unknown', validity: 'uncertain', modality: optional ? 'optional' : 'required' }, reasons }
  }
  if (revoked) {
    return { semantics: { actor, speechAct: 'directive', polarity: 'negative', tense: 'past', status: 'cancelled', validity: 'superseded', modality: optional ? 'optional' : 'required' }, reasons }
  }
  return { semantics: { actor, speechAct: 'directive', polarity: negative ? 'negative' : 'affirmative', tense: 'future', status: negative ? 'cancelled' : 'pending', validity: 'active', modality: optional ? 'optional' : 'required' }, reasons }
}

function effectForP2(task: LocalTaskSuggestion, scopeText: string): LocalTaskSuggestion['effect'] {
  if (['submit', 'upload', 'send'].includes(task.actionType)) return 'external_transfer'
  if (['contact', 'register', 'pay'].includes(task.actionType)) return 'external_interaction'
  if (task.actionType === 'complete' && /(?:在线|网页|系统|平台).{0,8}确认|确认.{0,8}(?:在线|阅读状态|系统状态)/u.test(scopeText)) return 'external_interaction'
  if (task.actionType === 'complete' && /(?:提交|上传|发送|递交|邮寄|寄送|投递|外发)$/u.test(task.object.surface)) return 'external_transfer'
  if (task.actionType === 'complete' && /(?:联系|报名|注册|付款|缴费|支付)$/u.test(task.object.surface)) return 'external_interaction'
  if (['attend', 'carry', 'print', 'sign'].includes(task.actionType)) return 'physical_action'
  if (['review', 'complete', 'fill', 'prepare', 'save', 'collect'].includes(task.actionType)) return 'local_change'
  return 'unknown'
}

function currentRequired(semantics: ScopeReferenceSemantics): boolean {
  return (semantics.actor === 'addressee' || semantics.actor === 'addressed_group') && semantics.speechAct === 'directive'
    && semantics.polarity === 'affirmative' && semantics.tense === 'future' && semantics.status === 'pending'
    && semantics.validity === 'active' && semantics.modality === 'required'
}

function maySelect(task: Pick<LocalTaskSuggestion, 'semantics' | 'effect' | 'actionType'>): boolean {
  if (!currentRequired(task.semantics) || task.semantics.actor !== 'addressee') return false
  if (task.effect === 'local_change') return task.actionType !== 'other'
  return task.effect === 'physical_action' && ['carry', 'print'].includes(task.actionType)
}

function deriveP2(index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationP2Result {
  const scopes = scopeMap(index)
  const base = formLocalTaskSuggestionsP1(index, reduced)
  const tasks = base.tasks.map((task) => {
    const action = exactAction(task, reduced.directives, scopes)
    const { semantics, reasons } = semanticsForP2(task, action, scopes)
    const effect = effectForP2({ ...task, action }, textFor(task.propositionScopeIds, scopes))
    const candidate = { ...task, action, semantics, effect }
    const selected = maySelect(candidate)
    return { ...candidate, selected, needsConfirmation: !selected, policyReasons: unique([...task.policyReasons.filter((reason) => !reason.startsWith('P1_')), 'P2_EXACT_ACTION_SURFACE', ...reasons, `P2_EFFECT_${effect.toUpperCase()}`, selected ? 'P2_SAFE_DEFAULT_ALLOWED' : 'P2_SAFE_DEFAULT_BLOCKED']) }
  })
  return { ...base, policyVersion: TASK_FORMATION_P2_POLICY_VERSION, requiresAction: tasks.some((task) => currentRequired(task.semantics)), tasks }
}

export function formLocalTaskSuggestionsP2(index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationP2Result {
  return deriveP2(index, reduced)
}

export function validateLocalTaskFormationP2(result: LocalTaskFormationP2Result, index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationIssue[] {
  const issues: LocalTaskFormationIssue[] = []
  if (result.policyVersion !== TASK_FORMATION_P2_POLICY_VERSION) issues.push({ code: 'P2_POLICY_VERSION_INVALID', path: 'policyVersion' })
  if (result.sourceId !== index.sourceId || result.sourceVersionId !== index.sourceVersionId || result.sourceFingerprint !== index.sourceFingerprint) issues.push({ code: 'P2_SOURCE_BINDING_MISMATCH', path: 'sourceId' })
  if (result.modelAuthorityFieldsUsed.length > 0) issues.push({ code: 'P2_MODEL_AUTHORITY_USED', path: 'modelAuthorityFieldsUsed' })
  const scopes = scopeMap(index)
  result.tasks.forEach((task, position) => {
    if (!validSurface(task.action, task.propositionScopeIds, scopes)) issues.push({ code: 'P2_ACTION_SURFACE_INVALID', path: `tasks[${position}].action` })
    if (!validSurface(task.object, task.propositionScopeIds, scopes)) issues.push({ code: 'P2_OBJECT_SURFACE_INVALID', path: `tasks[${position}].object` })
  })
  const expected = deriveP2(index, reduced)
  if (result.requiresAction !== expected.requiresAction) issues.push({ code: 'P2_REQUIRES_ACTION_NOT_DERIVED', path: 'requiresAction' })
  if (JSON.stringify(result.tasks) !== JSON.stringify(expected.tasks)) issues.push({ code: 'P2_TASKS_NOT_DERIVED', path: 'tasks' })
  return issues
}
