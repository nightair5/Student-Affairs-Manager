import type { ImmutableScope, ImmutableScopeIndex } from './scopeReferenceContract'
import type { ModelAnchorSelection, ModelAnchorSelectionIssue } from './modelAnchorSelectionContract'
import { validateModelAnchorSelection } from './modelAnchorSelectionContract'
import type { ReducedDirectiveAnchor, ReducedModelAnchors } from './taskFormationPolicyV2'

export const MODEL_ANCHOR_LOCAL_COMPOSER_VERSION = 'model-anchor-local-composer-2.0.0' as const

type ActionType = ReducedDirectiveAnchor['actionTypeHint']

export interface ControlledActionHead {
  surface: string
  actionType: ActionType
}

export interface ActionNormalization {
  directiveId: string
  scopeId: string
  originalSurface: string
  canonicalSurface: string | null
  status: 'unchanged' | 'normalized' | 'unresolved'
  candidates: string[]
}

export interface ConditionAttachment {
  directiveId: string
  conditionScopeId: string
  attachedScopeIds: string[]
  truth: 'true' | 'false' | 'unknown'
  status: 'attached_unique' | 'no_match' | 'ambiguous'
}

export interface LocalAnchorCompositionV2 {
  composerVersion: typeof MODEL_ANCHOR_LOCAL_COMPOSER_VERSION
  reduced: ReducedModelAnchors
  actionNormalizations: ActionNormalization[]
  conditionAttachments: ConditionAttachment[]
  warnings: ModelAnchorSelectionIssue[]
}

export type LocalAnchorCompositionV2Result =
  | { ok: true; value: LocalAnchorCompositionV2 }
  | { ok: false; issues: ModelAnchorSelectionIssue[] }

export const CONTROLLED_ACTION_HEADS: readonly ControlledActionHead[] = [
  { surface: '发送', actionType: 'send' }, { surface: '发给', actionType: 'send' }, { surface: '寄送', actionType: 'send' },
  { surface: '上传', actionType: 'upload' }, { surface: '提交', actionType: 'submit' }, { surface: '递交', actionType: 'submit' }, { surface: '邮寄', actionType: 'submit' },
  { surface: '联系', actionType: 'contact' }, { surface: '报名', actionType: 'register' }, { surface: '注册', actionType: 'register' },
  { surface: '付款', actionType: 'pay' }, { surface: '缴费', actionType: 'pay' }, { surface: '支付', actionType: 'pay' },
  { surface: '参加', actionType: 'attend' }, { surface: '出席', actionType: 'attend' }, { surface: '携带', actionType: 'carry' },
  { surface: '打印', actionType: 'print' }, { surface: '签名', actionType: 'sign' }, { surface: '签字', actionType: 'sign' },
  { surface: '核验', actionType: 'review' }, { surface: '核对', actionType: 'review' }, { surface: '检查', actionType: 'review' },
  { surface: '查看', actionType: 'review' }, { surface: '审查', actionType: 'review' },
  { surface: '填写', actionType: 'fill' }, { surface: '重写', actionType: 'fill' }, { surface: '输入', actionType: 'fill' },
  { surface: '整理', actionType: 'prepare' }, { surface: '准备', actionType: 'prepare' }, { surface: '收集', actionType: 'collect' },
  { surface: '保存', actionType: 'save' }, { surface: '完成', actionType: 'complete' }, { surface: '确认', actionType: 'complete' },
] as const

const CONDITION_START_RE = /^(?:若|如果|如)(.+?)(?:，|,|则|$)|^当(.+?)时/u
const ASSERTION_PREFIX_RE = /^(?:当前|目前|现在|现状是|现况是|事实是|实际情况是|经确认|已确认)/u
const EMPHASIS_RE = /^(?:确实|已经|已经确认|现已)/u
const EXPLICIT_NEGATION_RE = /^(?:并未|尚未|没有|未曾|并没有|不是|不再)/u

function unique<T>(values: T[]): T[] { return [...new Set(values)] }
function scopeMap(index: ImmutableScopeIndex): Map<string, ImmutableScope> { return new Map(index.scopes.map((scope) => [scope.id, scope])) }

function conditionSurface(text: string): string | null {
  const match = text.trim().match(CONDITION_START_RE)
  return (match?.[1] ?? match?.[2] ?? '').replace(/[，,。；;]$/u, '') || null
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

function assertionRelation(condition: string, assertion: string): 'true' | 'false' | 'unknown' {
  const target = normalizeProposition(condition)
  const fact = normalizeProposition(assertion)
  if (!target || !fact) return 'unknown'
  const stripped = fact.replace(EXPLICIT_NEGATION_RE, '')
  if (stripped !== fact && (stripped.includes(target) || target.includes(stripped))) return 'false'
  if (fact.includes(target) || target.includes(fact)) return 'true'
  return 'unknown'
}

function actionCandidates(surface: string, scope: ImmutableScope): ControlledActionHead[] {
  return CONTROLLED_ACTION_HEADS.filter((candidate) => surface.includes(candidate.surface) && scope.text.includes(candidate.surface))
    .filter((candidate, position, values) => values.findIndex((value) => value.surface === candidate.surface) === position)
}

function conditionAttachment(directive: ModelAnchorSelection['directives'][number], index: ImmutableScopeIndex): ConditionAttachment | null {
  const scopes = scopeMap(index)
  const condition = directive.propositionScopeIds.map((id) => scopes.get(id)).find((scope) => scope && conditionSurface(scope.text) !== null)
  if (!condition) return null
  const surface = conditionSurface(condition.text)
  if (!surface) return null
  const latestDirectiveOrder = Math.max(...directive.propositionScopeIds.map((id) => scopes.get(id)?.order ?? -1))
  const matches = index.scopes.filter((scope) => scope.order > latestDirectiveOrder && ASSERTION_PREFIX_RE.test(scope.text.trim()))
    .map((scope) => ({ scope, truth: assertionRelation(surface, scope.text) }))
    .filter((item) => item.truth !== 'unknown')
  if (matches.length === 1) return { directiveId: directive.id, conditionScopeId: condition.id, attachedScopeIds: [matches[0].scope.id], truth: matches[0].truth, status: 'attached_unique' }
  if (matches.length === 0) return { directiveId: directive.id, conditionScopeId: condition.id, attachedScopeIds: [], truth: 'unknown', status: 'no_match' }
  return { directiveId: directive.id, conditionScopeId: condition.id, attachedScopeIds: [], truth: 'unknown', status: 'ambiguous' }
}

export function composeLocalAnchorsV2(selection: ModelAnchorSelection, index: ImmutableScopeIndex, expectedProducerRunId?: string): LocalAnchorCompositionV2Result {
  const validation = validateModelAnchorSelection(selection, index, expectedProducerRunId)
  if (!validation.valid) return { ok: false, issues: validation.issues }
  const scopes = scopeMap(index)
  const normalizations: ActionNormalization[] = []
  const actionIssues: ModelAnchorSelectionIssue[] = []
  const attachments = selection.directives.map((directive) => conditionAttachment(directive, index)).filter((item): item is ConditionAttachment => item !== null)
  const attachedByDirective = new Map(attachments.map((item) => [item.directiveId, item.attachedScopeIds]))
  const attachedScopeIds = new Set(attachments.flatMap((item) => item.attachedScopeIds))
  const directives: ReducedDirectiveAnchor[] = selection.directives.map((directive, position) => {
    const scope = scopes.get(directive.action.scopeId)
    const candidates = scope ? actionCandidates(directive.action.surface, scope) : []
    const exact = candidates.find((candidate) => candidate.surface === directive.action.surface)
    const chosen = exact ?? (candidates.length === 1 ? candidates[0] : null)
    normalizations.push({ directiveId: directive.id, scopeId: directive.action.scopeId, originalSurface: directive.action.surface, canonicalSurface: chosen?.surface ?? null, status: chosen ? chosen.surface === directive.action.surface ? 'unchanged' : 'normalized' : 'unresolved', candidates: candidates.map((item) => item.surface) })
    if (!chosen) actionIssues.push({ code: candidates.length > 1 ? 'ACTION_HEAD_AMBIGUOUS' : 'ACTION_HEAD_NOT_CONTROLLED', path: `directives[${position}].action` })
    const propositionScopeIds = unique([...directive.propositionScopeIds, ...(attachedByDirective.get(directive.id) ?? [])])
      .sort((left, right) => (scopes.get(left)?.order ?? 0) - (scopes.get(right)?.order ?? 0))
    return {
      anchorId: directive.id,
      propositionScopeIds,
      actionTypeHint: chosen?.actionType ?? 'other',
      actionSurfaceHint: { scopeId: directive.action.scopeId, surface: chosen?.surface ?? directive.action.surface },
      objectSurfaceHint: { ...directive.object },
      timeRefs: [], materialRefs: [], eventRef: null, locationRef: null,
    }
  })
  if (actionIssues.length > 0) return { ok: false, issues: actionIssues }
  const reduced: ReducedModelAnchors = {
    schemaVersion: 'reduced-model-anchors-1.0.0',
    sourceId: selection.sourceId,
    sourceVersionId: selection.sourceVersionId,
    sourceFingerprint: selection.sourceFingerprint,
    producerRunId: selection.producerRunId,
    directives,
    observations: [],
    ignoredScopeIds: selection.ignoredScopeIds.filter((id) => !attachedScopeIds.has(id)),
    discardedModelAuthority: ['requiresAction', 'semantics', 'inferenceLevel', 'effect', 'revisionRefs', 'selected'],
  }
  const warnings = attachments.filter((item) => item.status === 'ambiguous').map((item) => ({ code: 'CONDITION_ASSERTION_AMBIGUOUS', path: `directives.${item.directiveId}.propositionScopeIds` }))
  return { ok: true, value: { composerVersion: MODEL_ANCHOR_LOCAL_COMPOSER_VERSION, reduced, actionNormalizations: normalizations, conditionAttachments: attachments, warnings } }
}
