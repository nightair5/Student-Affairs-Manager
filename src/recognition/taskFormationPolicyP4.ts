import type { ImmutableScope, ImmutableScopeIndex, ScopeReferenceSemantics } from './scopeReferenceContract'
import { formLocalTaskSuggestionsP3, type LocalTaskFormationP3Result } from './taskFormationPolicyP3'
import type { LocalTaskFormationIssue, LocalTaskSuggestion, ReducedModelAnchors } from './taskFormationPolicyV2'

export const TASK_FORMATION_P4_POLICY_VERSION = 'task-formation-policy-2.4.0-p4' as const

export type LocalTaskFormationP4Result = Omit<LocalTaskFormationP3Result, 'policyVersion'> & {
  policyVersion: typeof TASK_FORMATION_P4_POLICY_VERSION
  semanticEvidenceMode: 'full_proposition_with_local_action_head'
  unsafeDefaultSelections: string[]
}

type ConditionTruth = 'none' | 'true' | 'false' | 'unknown'

const DIRECTIVE_MARKER_RE = /(?:必须|不得|禁止|无需|不用|不需要|应当|应该|须|请|需要|可以|可自行|可通过|自愿|需)/u
const DIRECT_NEGATIVE_RE = /(?:不得|禁止|无需|不用|不需要|不再|暂勿|暂缓|先不要|不要求|不强制)/u
const OPTIONAL_RE = /(?:可以|可自行|可通过|自愿|按需)/u
const COMPLETED_RE = /(?:已经|已完成|已办结|已结清)/u
const GROUP_SUBJECT_RE = /(?:同学|人员|成员|全体|大家|获批免交者|旁听者|其余人)/u
const CONDITION_START_RE = /^(?:若|如果|如)(.+?)(?:，|,|则|$)|^当(.+?)时/u
const ASSERTION_PREFIX_RE = /^(?:当前|目前|现在|现状是|现况是|事实是|实际情况是|经确认|已确认)/u
const EMPHASIS_RE = /^(?:确实|已经|已经确认|现已)/u
const EXPLICIT_NEGATION_RE = /^(?:并未|尚未|没有|未曾|并没有|不是|不再)/u

function scopeMap(index: ImmutableScopeIndex): Map<string, ImmutableScope> { return new Map(index.scopes.map((scope) => [scope.id, scope])) }
function textFor(scopeIds: string[], scopes: Map<string, ImmutableScope>): string { return scopeIds.map((id) => scopes.get(id)?.text ?? '').join('') }
function unique<T>(values: T[]): T[] { return [...new Set(values)] }

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
  const conditions = texts.map((text, position) => ({ text: conditionSurface(text), position })).filter((item) => item.text !== null)
  if (conditions.length === 0) return 'none'
  if (conditions.length > 1) return 'unknown'
  const condition = conditions[0]
  if (!condition.text) return 'unknown'
  const relations = unique(texts.slice(condition.position + 1).filter((text) => ASSERTION_PREFIX_RE.test(text.trim())).map((text) => assertionRelation(condition.text!, text)).filter((value) => value !== 'unknown'))
  return relations.length === 1 ? relations[0] : 'unknown'
}

function actionClause(task: LocalTaskSuggestion, scopes: Map<string, ImmutableScope>): { text: string; prefix: string } {
  const text = scopes.get(task.action.scopeId)?.text ?? ''
  const offset = text.indexOf(task.action.surface)
  return { text, prefix: offset >= 0 ? text.slice(0, offset) : text }
}

function explicitActor(task: LocalTaskSuggestion, scopes: Map<string, ImmutableScope>, optional: boolean): ScopeReferenceSemantics['actor'] {
  if (optional) return 'addressed_group'
  const { prefix } = actionClause(task, scopes)
  const marker = prefix.match(DIRECTIVE_MARKER_RE)
  const subject = marker?.index === undefined ? prefix : prefix.slice(0, marker.index)
  const normalized = subject.replace(/^(?:但|另|现在|目前|最新要求是|正式答复|最终要求是|原先方案|旧版规定|原任务|原要求|旧要求)/u, '').trim()
  return GROUP_SUBJECT_RE.test(normalized) ? 'addressed_group' : 'addressee'
}

function fullPropositionSemantics(task: LocalTaskSuggestion, scopes: Map<string, ImmutableScope>): ScopeReferenceSemantics {
  const allText = textFor(task.propositionScopeIds, scopes)
  const clause = actionClause(task, scopes)
  const truth = conditionTruth(task.propositionScopeIds, scopes)
  const negative = DIRECT_NEGATIVE_RE.test(clause.text)
  const optional = OPTIONAL_RE.test(clause.text)
  const completed = COMPLETED_RE.test(allText)
  const actor = explicitActor(task, scopes, optional)
  if (truth === 'false' || truth === 'unknown') return { actor, speechAct: 'hypothetical', polarity: 'uncertain', tense: 'future', status: 'unknown', validity: 'uncertain', modality: optional ? 'optional' : 'required' }
  if (completed) return { actor, speechAct: 'directive', polarity: 'affirmative', tense: 'past', status: 'completed', validity: 'active', modality: optional ? 'optional' : 'required' }
  return { actor, speechAct: 'directive', polarity: negative ? 'negative' : 'affirmative', tense: 'future', status: negative ? 'cancelled' : 'pending', validity: 'active', modality: optional ? 'optional' : 'required' }
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

function deriveP4(index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationP4Result {
  const scopes = scopeMap(index)
  const base = formLocalTaskSuggestionsP3(index, reduced)
  const revisionTargets = new Set(base.revisionRelations.map((relation) => relation.targetTaskId))
  const tasks = base.tasks.map((task) => {
    let semantics = fullPropositionSemantics(task, scopes)
    if (revisionTargets.has(task.id)) semantics = { ...semantics, speechAct: 'directive', polarity: 'negative', tense: 'past', status: 'cancelled', validity: 'superseded' }
    const selected = maySelect({ ...task, semantics })
    const policyReasons = unique([
      ...task.policyReasons.filter((reason) => !reason.startsWith('P2_') && !reason.startsWith('P3_SAFE_DEFAULT_')),
      'P4_FULL_PROPOSITION_SEMANTICS',
      'P4_LOCAL_CONTROLLED_ACTION_HEAD',
      selected ? 'P4_SAFE_DEFAULT_ALLOWED' : 'P4_SAFE_DEFAULT_BLOCKED',
    ])
    return { ...task, semantics, selected, needsConfirmation: !selected, policyReasons }
  })
  return {
    ...base,
    policyVersion: TASK_FORMATION_P4_POLICY_VERSION,
    semanticEvidenceMode: 'full_proposition_with_local_action_head',
    requiresAction: tasks.some((task) => currentRequired(task.semantics)),
    tasks,
    unsafeDefaultSelections: [],
  }
}

export function formLocalTaskSuggestionsP4(index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationP4Result {
  return deriveP4(index, reduced)
}

export function validateLocalTaskFormationP4(result: LocalTaskFormationP4Result, index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationIssue[] {
  const issues: LocalTaskFormationIssue[] = []
  if (result.policyVersion !== TASK_FORMATION_P4_POLICY_VERSION) issues.push({ code: 'P4_POLICY_VERSION_INVALID', path: 'policyVersion' })
  if (result.semanticEvidenceMode !== 'full_proposition_with_local_action_head') issues.push({ code: 'P4_EVIDENCE_MODE_INVALID', path: 'semanticEvidenceMode' })
  if (result.sourceId !== index.sourceId || result.sourceVersionId !== index.sourceVersionId || result.sourceFingerprint !== index.sourceFingerprint) issues.push({ code: 'P4_SOURCE_BINDING_MISMATCH', path: 'sourceId' })
  if (result.modelAuthorityFieldsUsed.length > 0) issues.push({ code: 'P4_MODEL_AUTHORITY_USED', path: 'modelAuthorityFieldsUsed' })
  const expected = deriveP4(index, reduced)
  if (JSON.stringify(result) !== JSON.stringify(expected)) issues.push({ code: 'P4_RESULT_NOT_DERIVED', path: 'result' })
  return issues
}
