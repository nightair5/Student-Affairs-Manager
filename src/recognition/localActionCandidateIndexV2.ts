import type { ImmutableScope, ImmutableScopeIndex } from './scopeReferenceContract'
import { CONTROLLED_ACTION_HEADS, type ControlledActionHead } from './modelAnchorLocalComposerV2'

export const LOCAL_ACTION_CANDIDATE_INDEX_VERSION = 'local-action-candidate-index-1.0.0' as const
export const LOCAL_ACTION_CANDIDATE_V2_POLICY_VERSION = 'local-action-candidate-policy-1.2.0' as const

export type LocalCandidateDisposition = 'local_proposition' | 'local_non_task' | 'needs_model'
export type LocalClauseRole = 'directive' | 'condition_antecedent' | 'assertion' | 'quoted_or_example' | 'unclassified'
export type LocalCurrentness = 'current' | 'historical' | 'completed' | 'unknown'

export interface LocalObjectCandidate {
  id: string
  scopeId: string
  surface: string
  startInScope: number
  endInScope: number
  sourceStart: number
  sourceEnd: number
  side: 'before_action' | 'after_action' | 'shared_before' | 'shared_after'
}

export interface LocalActionCandidate {
  id: string
  scopeId: string
  propositionScopeIds: string[]
  clauseRole: LocalClauseRole
  currentness: LocalCurrentness
  action: {
    scopeId: string
    surface: string
    startInScope: number
    endInScope: number
    sourceStart: number
    sourceEnd: number
    actionType: ControlledActionHead['actionType']
  }
  objectCandidates: LocalObjectCandidate[]
  defaultObjectCandidateId: string | null
  localDisposition: LocalCandidateDisposition
  dispositionReasons: string[]
  conditionAttachment: {
    conditionScopeId: string | null
    factScopeIds: string[]
    status: 'none' | 'attached_unique' | 'no_match' | 'ambiguous'
    truth: 'none' | 'true' | 'false' | 'unknown'
  }
}

export interface LocalActionCandidateCatalog {
  schemaVersion: typeof LOCAL_ACTION_CANDIDATE_INDEX_VERSION
  policyVersion: typeof LOCAL_ACTION_CANDIDATE_V2_POLICY_VERSION
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  catalogFingerprint: string
  candidates: LocalActionCandidate[]
  scopesWithoutActionCandidates: string[]
  unresolvedActionScopeIds: string[]
}

export interface LocalActionCandidateCatalogIssue {
  code: string
  path: string
}

interface ActionOccurrence {
  head: ControlledActionHead
  startInScope: number
  endInScope: number
  nominalCompound: boolean
}

interface LocalRange {
  startInScope: number
  endInScope: number
  surface: string
}

const CONDITION_START_RE = /^(?:若|如果|如)(.+?)(?:，|,|则|$)|^当(.+?)时/u
const SAME_SCOPE_CONSEQUENT_RE = /(?:则|就)?(?:请|务必|必须|应当|应该|须)\s*$/u
const ASSERTION_PREFIX_RE = /^(?:当前|目前|现在|现状是|现况是|事实是|实际情况是|经确认|已确认)/u
const EMPHASIS_RE = /^(?:确实|已经|已经确认|现已)/u
const EXPLICIT_NEGATION_RE = /(?:并未|尚未|没有|未曾|并没有|不是|不再)/u
const LOCAL_NON_TASK_RE = /(?:仅用于说明|仅供说明|仅供参考|只是示例|作为示例|不构成要求|不是操作要求|并非本次要求|非本次要求|不是本次要求|界面演示|页面按钮|按钮名为|字段名为|菜单名为|示例文案|代码示例|群里转发)/u
const DIRECTIVE_MARKER_RE = /(?:必须|务必|应当|应该|须|请|需要|不得|禁止|无需|不用|不需要|可以|可自行|自愿|按需|只需|要求|从现在起|现改为|调整为|变更为|修订为|更改为)/u
const HISTORICAL_REQUIREMENT_RE = /(?:原|旧|先前|此前|原先|上一版|前述|既有).{0,12}(?:任务|通知|安排|要求|规定|方案|流程|规则|条款|版本).{0,8}(?:要求|须|应|需)/u
const COMPLETED_PREFIX_RE = /(?:已经|已|此前已|现已)$/u
const COMPLETED_SUFFIX_RE = /^(?:完成|完毕|结束|办结|结清)/u
const EDGE_TRIM_RE = /[\s，,。；;！？!?：:“”‘’"']/u
const LEADING_CONNECTOR_RE = /^(?:并且|并|且|再|然后|同时|以及|另|但)+/u
const TRAILING_CONNECTOR_RE = /(?:(?:后|之后|以后)?(?:并且|并|且|再|然后|同时|以及|另|但))+$/u
const LEFT_MODAL_RE = /(?:可以自行|可自行|必须|务必|应当|应该|需要|只需|无需|不用|不得|禁止|已经|请|须|应|可以|自愿|按需|要求|安排|已|可)+$/u
const CONNECTOR_ONLY_RE = /^(?:(?:并且|并|且|再|然后|同时|以及|另|但)|\s)*$/u
const REVISION_SIGNAL_RE = /(?:作废|取消|撤销|废止|失效|不再(?:有效|生效|执行)|停止执行|终止执行|改为|调整为|变更为|修订为|更改为)/u

const NOMINAL_COMPOUNDS: ReadonlyArray<{ action: string; suffix: RegExp }> = [
  { action: '报名', suffix: /^(?:表|表格|系统|入口|信息)/u },
  { action: '注册', suffix: /^(?:表|页面|入口|码)/u },
  { action: '打印', suffix: /^(?:机|件|服务)/u },
] as const

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson((value as Record<string, unknown>)[key])).join(',') + '}'
  }
  return JSON.stringify(value)
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return 'sha256:' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function unique<T>(values: T[]): T[] { return [...new Set(values)] }

function isNominalCompound(scope: ImmutableScope, head: ControlledActionHead, endInScope: number): boolean {
  return NOMINAL_COMPOUNDS.some((entry) => entry.action === head.surface && entry.suffix.test(scope.text.slice(endInScope)))
}

function occurrences(scope: ImmutableScope): ActionOccurrence[] {
  const found: ActionOccurrence[] = []
  for (const head of CONTROLLED_ACTION_HEADS) {
    let cursor = 0
    while (cursor < scope.text.length) {
      const startInScope = scope.text.indexOf(head.surface, cursor)
      if (startInScope < 0) break
      const endInScope = startInScope + head.surface.length
      found.push({ head, startInScope, endInScope, nominalCompound: isNominalCompound(scope, head, endInScope) })
      cursor = startInScope + Math.max(1, head.surface.length)
    }
  }
  const ordered = found.sort((left, right) => left.startInScope - right.startInScope || right.head.surface.length - left.head.surface.length)
  const nonOverlapping: ActionOccurrence[] = []
  for (const candidate of ordered) {
    if (nonOverlapping.some((kept) => candidate.startInScope < kept.endInScope && candidate.endInScope > kept.startInScope)) continue
    if (candidate.head.surface === '完成' && nonOverlapping.some((kept) => !kept.nominalCompound && kept.endInScope === candidate.startInScope)) continue
    const previousStructural = [...nonOverlapping].reverse().find((kept) => !kept.nominalCompound)
    const gapFromPrevious = previousStructural
      ? scope.text.slice(previousStructural.endInScope, candidate.startInScope).trim()
      : ''
    const suffix = scope.text.slice(candidate.endInScope)
    const relativeObjectClause = Boolean(previousStructural)
      && /^(?:已经|已|待|需|需要|尚未|未|曾经)$/u.test(gapFromPrevious)
      && (/^的/u.test(suffix) || /^(?:待|需|需要|尚未|未)$/u.test(gapFromPrevious))
    const nestedInPriorObject = candidate.head.surface !== '完成' && relativeObjectClause
    nonOverlapping.push({ ...candidate, nominalCompound: candidate.nominalCompound || nestedInPriorObject })
  }
  return nonOverlapping.sort((left, right) => left.startInScope - right.startInScope)
}

function trimBounds(text: string, rawStart: number, rawEnd: number): LocalRange | null {
  let startInScope = rawStart
  let endInScope = rawEnd
  while (startInScope < endInScope && EDGE_TRIM_RE.test(text[startInScope])) startInScope += 1
  while (endInScope > startInScope && EDGE_TRIM_RE.test(text[endInScope - 1])) endInScope -= 1
  if (startInScope >= endInScope) return null
  return { startInScope, endInScope, surface: text.slice(startInScope, endInScope) }
}

function adjustLeading(text: string, range: LocalRange): LocalRange | null {
  const match = range.surface.match(LEADING_CONNECTOR_RE)
  return trimBounds(text, range.startInScope + (match?.[0].length ?? 0), range.endInScope)
}

function adjustTrailing(text: string, range: LocalRange, pattern: RegExp): LocalRange | null {
  const match = range.surface.match(pattern)
  return trimBounds(text, range.startInScope, range.endInScope - (match?.[0].length ?? 0))
}

function rightRange(scope: ImmutableScope, start: number, end: number, hasFollowingAction: boolean): LocalRange | null {
  const raw = trimBounds(scope.text, start, end)
  const leading = raw ? adjustLeading(scope.text, raw) : null
  const value = leading && hasFollowingAction ? adjustTrailing(scope.text, leading, TRAILING_CONNECTOR_RE) : leading
  return value && !/^(?:完成|完毕|结束|办结|结清)$/u.test(value.surface) ? value : null
}

function leftRange(scope: ImmutableScope, start: number, end: number): LocalRange | null {
  const raw = trimBounds(scope.text, start, end)
  const governingModal = raw
    ? [...raw.surface.matchAll(new RegExp(DIRECTIVE_MARKER_RE.source, 'gu'))].at(-1)
    : undefined
  if (raw && governingModal?.index !== undefined && governingModal.index > 0) {
    const beforeModal = trimBounds(scope.text, raw.startInScope, raw.startInScope + governingModal.index)
    if (beforeModal && !/(?:通知|安排|要求|规定|方案|流程|规则|条款|版本|任务)$/u.test(beforeModal.surface)) return beforeModal
  }
  const withoutModal = raw ? adjustTrailing(scope.text, raw, LEFT_MODAL_RE) : null
  const withoutConnector = withoutModal ? adjustTrailing(scope.text, withoutModal, TRAILING_CONNECTOR_RE) : null
  return withoutConnector ? adjustLeading(scope.text, withoutConnector) : null
}

function structuralActions(actions: ActionOccurrence[]): ActionOccurrence[] {
  return actions.filter((action) => !action.nominalCompound)
}

function toObjectCandidate(scope: ImmutableScope, range: LocalRange, side: LocalObjectCandidate['side']): LocalObjectCandidate {
  const sourceStart = scope.start + range.startInScope
  const sourceEnd = scope.start + range.endInScope
  return {
    id: 'object:' + scope.sourceFingerprint.slice(7, 19) + ':' + sourceStart + ':' + sourceEnd,
    scopeId: scope.id,
    surface: range.surface,
    startInScope: range.startInScope,
    endInScope: range.endInScope,
    sourceStart,
    sourceEnd,
    side,
  }
}

function objectCandidates(scope: ImmutableScope, actions: ActionOccurrence[], action: ActionOccurrence): LocalObjectCandidate[] {
  if (action.nominalCompound) {
    const suffix = rightRange(scope, action.endInScope, scope.text.length, false)
    return suffix ? [toObjectCandidate(scope, suffix, 'after_action')] : []
  }
  const structural = structuralActions(actions)
  const position = structural.indexOf(action)
  const previous = structural[position - 1]
  const next = structural[position + 1]
  const directRight = rightRange(scope, action.endInScope, next?.startInScope ?? scope.text.length, Boolean(next))
  if (directRight) return [toObjectCandidate(scope, directRight, 'after_action')]
  const directLeft = leftRange(scope, previous?.endInScope ?? 0, action.startInScope)
  if (directLeft) return [toObjectCandidate(scope, directLeft, 'before_action')]

  const first = structural[0]
  const last = structural.at(-1)
  if (first && first !== action && CONNECTOR_ONLY_RE.test(scope.text.slice(first.endInScope, action.startInScope))) {
    const sharedBefore = leftRange(scope, 0, first.startInScope)
    if (sharedBefore) return [toObjectCandidate(scope, sharedBefore, 'shared_before')]
  }
  if (last && last !== action && CONNECTOR_ONLY_RE.test(scope.text.slice(action.endInScope, last.startInScope))) {
    const sharedAfter = rightRange(scope, last.endInScope, scope.text.length, false)
    if (sharedAfter) return [toObjectCandidate(scope, sharedAfter, 'shared_after')]
  }
  return []
}

function insideChineseQuote(text: string, offset: number): boolean {
  const left = text.lastIndexOf('“', offset)
  const right = text.lastIndexOf('”', offset)
  return left > right && text.indexOf('”', offset) >= 0
}

function explicitNonTaskContext(index: ImmutableScopeIndex, scope: ImmutableScope, action: ActionOccurrence): boolean {
  if (insideChineseQuote(scope.text, action.startInScope) && /(?:按钮|字段|菜单|界面|示例|说明|代码)/u.test(scope.text)) return true
  const prefix = scope.text.slice(0, action.startInScope)
  const suffix = scope.text.slice(action.endInScope)
  const markerBefore = prefix.match(LOCAL_NON_TASK_RE)
  if (markerBefore?.index !== undefined) {
    const afterMarker = prefix.slice(markerBefore.index + markerBefore[0].length)
    if (!afterMarker.includes('”')) return true
  }
  if (LOCAL_NON_TASK_RE.test(suffix)) return true
  const previous = index.scopes.find((item) => item.order === scope.order - 1)
  return Boolean(previous && /[：:]$/u.test(previous.text.trim()) && LOCAL_NON_TASK_RE.test(previous.text))
}

function sameScopeConditionSurface(scope: ImmutableScope, action: ActionOccurrence): string | null {
  const prefix = scope.text.slice(0, action.startInScope).trim()
  const ifMatch = prefix.match(/^(?:若|如果|如)(.+)/u)
  if (ifMatch) {
    const marker = ifMatch[1].match(SAME_SCOPE_CONSEQUENT_RE)
    if (marker?.index === undefined) return null
    return ifMatch[1].slice(0, marker.index).replace(/[，,。；;]$/u, '').trim() || null
  }
  const whenMatch = prefix.match(/^当(.+?)时(?:则|就)?(?:请|务必|必须|应当|应该|须)?\s*$/u)
  return whenMatch?.[1]?.trim() || null
}

function clauseRole(index: ImmutableScopeIndex, scope: ImmutableScope, action: ActionOccurrence): LocalClauseRole {
  if (explicitNonTaskContext(index, scope, action)) return 'quoted_or_example'
  if (ASSERTION_PREFIX_RE.test(scope.text.trim())) return 'assertion'
  if (/^(?:若|如果|如|当)/u.test(scope.text.trim())) {
    if (/[，,]$/u.test(scope.text.trim()) || !sameScopeConditionSurface(scope, action)) return 'condition_antecedent'
    return 'directive'
  }
  return 'unclassified'
}

function currentness(
  scope: ImmutableScope,
  action: ActionOccurrence,
  actions: ActionOccurrence[],
): LocalCurrentness {
  const prefix = scope.text.slice(0, action.startInScope)
  const suffix = scope.text.slice(action.endInScope)
  const previous = structuralActions(actions).filter((item) => item.endInScope <= action.startInScope).at(-1)
  const localPrefix = previous ? scope.text.slice(previous.endInScope, action.startInScope) : prefix
  if (COMPLETED_PREFIX_RE.test(localPrefix.trim()) || COMPLETED_SUFFIX_RE.test(suffix.trim())) return 'completed'
  if (HISTORICAL_REQUIREMENT_RE.test(prefix) || /(?:原|旧|先前|此前|原先|上一版|前述|既有).{0,8}(?:任务|通知|安排|要求|规定|方案|流程|规则|条款|版本)/u.test(prefix)) return 'historical'
  if (DIRECTIVE_MARKER_RE.test(localPrefix) || /(?:并且|并|且|再|然后|同时|以及|另|但)\s*$/u.test(localPrefix)) return 'current'
  return 'unknown'
}

function disposition(
  scope: ImmutableScope,
  action: ActionOccurrence,
  actions: ActionOccurrence[],
  role: LocalClauseRole,
): { value: LocalCandidateDisposition; reasons: string[] } {
  const prefix = scope.text.slice(0, action.startInScope)
  const suffix = scope.text.slice(action.endInScope)
  if (action.nominalCompound) return { value: 'local_non_task', reasons: ['ACTION_SURFACE_EMBEDDED_IN_OBJECT'] }
  if (role === 'condition_antecedent') return { value: 'local_non_task', reasons: ['ACTION_BELONGS_TO_CONDITION_ANTECEDENT'] }
  if (role === 'assertion') return { value: 'local_non_task', reasons: ['ASSERTION_ACTION_NOT_DIRECTIVE'] }
  if (role === 'quoted_or_example') {
    return { value: 'local_non_task', reasons: ['EXPLICIT_INTERFACE_OR_EXAMPLE_CONTEXT'] }
  }
  if (action.head.surface === '确认' && /^(?:经确认|已确认)/u.test(scope.text.trim())) {
    return { value: 'local_non_task', reasons: ['ASSERTION_CONFIRMATION_NOT_ACTION'] }
  }
  const previous = structuralActions(actions).filter((item) => item.endInScope <= action.startInScope).at(-1)
  const localPrefix = previous ? scope.text.slice(previous.endInScope, action.startInScope) : prefix
  const coordinatedWithPrevious = Boolean(previous && /(?:并且|并|且|再|然后|同时|以及|另|但)\s*$/u.test(localPrefix))
  if (DIRECTIVE_MARKER_RE.test(localPrefix)
    || !previous && HISTORICAL_REQUIREMENT_RE.test(prefix)
    || COMPLETED_PREFIX_RE.test(localPrefix.trim())
    || COMPLETED_SUFFIX_RE.test(suffix.trim())
    || coordinatedWithPrevious) {
    return { value: 'local_proposition', reasons: ['DETERMINISTIC_PROPOSITION_SYNTAX'] }
  }
  if (LOCAL_NON_TASK_RE.test(scope.text)) {
    return { value: 'local_non_task', reasons: ['EXPLICIT_INTERFACE_OR_EXAMPLE_CONTEXT'] }
  }
  return { value: 'needs_model', reasons: ['NO_DETERMINISTIC_PROPOSITION_OR_NON_TASK_MARKER'] }
}

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

function actionScopeContinues(previous: ImmutableScope, current: ImmutableScope): boolean {
  const currentActions = structuralActions(occurrences(current))
  if (currentActions.length === 0 || !/[，,]$/u.test(previous.text.trim())) return false
  const prefix = current.text.slice(0, currentActions[0].startInScope)
  return CONNECTOR_ONLY_RE.test(prefix)
}

function actionGroupBounds(index: ImmutableScopeIndex, scope: ImmutableScope): { start: number; end: number } {
  let start = scope.order
  while (start > 0) {
    const previous = index.scopes.find((item) => item.order === start - 1)
    const current = index.scopes.find((item) => item.order === start)
    if (!previous || !current || structuralActions(occurrences(previous)).length === 0 || !actionScopeContinues(previous, current)) break
    start -= 1
  }
  let end = start
  while (end + 1 < index.scopes.length) {
    const previous = index.scopes.find((item) => item.order === end)
    const current = index.scopes.find((item) => item.order === end + 1)
    if (!previous || !current || !actionScopeContinues(previous, current)) break
    end += 1
  }
  return { start, end }
}

function propositionScopes(index: ImmutableScopeIndex, scope: ImmutableScope, action: ActionOccurrence, role: LocalClauseRole) {
  const group = actionGroupBounds(index, scope)
  const sameScopeCondition = role === 'directive' ? sameScopeConditionSurface(scope, action) : null
  const previous = sameScopeCondition ? scope : index.scopes.find((item) => item.order === group.start - 1)
  const condition = sameScopeCondition ?? (previous ? conditionSurface(previous.text) : null)
  if (!previous || !condition) return { ids: [scope.id], conditionScopeId: null, factScopeIds: [], status: 'none' as const, truth: 'none' as const }
  const adjacentAssertions: ImmutableScope[] = []
  for (let order = group.end + 1; order < index.scopes.length; order += 1) {
    const next = index.scopes.find((item) => item.order === order)
    if (!next || !ASSERTION_PREFIX_RE.test(next.text.trim())) break
    adjacentAssertions.push(next)
  }
  const facts = adjacentAssertions
    .map((item) => ({ scope: item, relation: assertionRelation(condition, item.text) }))
    .filter((item) => item.relation !== 'unknown')
  if (facts.length === 1) return {
    ids: [previous.id, scope.id, facts[0].scope.id],
    conditionScopeId: previous.id,
    factScopeIds: [facts[0].scope.id],
    status: 'attached_unique' as const,
    truth: facts[0].relation,
  }
  if (facts.length === 0) return { ids: [previous.id, scope.id], conditionScopeId: previous.id, factScopeIds: [], status: 'no_match' as const, truth: 'unknown' as const }
  return { ids: [previous.id, scope.id], conditionScopeId: previous.id, factScopeIds: [], status: 'ambiguous' as const, truth: 'unknown' as const }
}

export async function indexLocalActionCandidatesV2(index: ImmutableScopeIndex): Promise<LocalActionCandidateCatalog> {
  const candidates: LocalActionCandidate[] = []
  for (const scope of index.scopes) {
    const actions = occurrences(scope)
    for (const occurrence of actions) {
      const objects = objectCandidates(scope, actions, occurrence)
      const detectedCurrentness = currentness(scope, occurrence, actions)
      const detectedRole = clauseRole(index, scope, occurrence)
      const role: LocalClauseRole = detectedRole === 'unclassified' && detectedCurrentness !== 'unknown'
        ? 'directive'
        : detectedRole
      const local = disposition(scope, occurrence, actions, role)
      const proposition = propositionScopes(index, scope, occurrence, role)
      const sourceStart = scope.start + occurrence.startInScope
      const sourceEnd = scope.start + occurrence.endInScope
      candidates.push({
        id: 'action:' + LOCAL_ACTION_CANDIDATE_V2_POLICY_VERSION + ':' + index.sourceFingerprint.slice(7, 19) + ':' + sourceStart + ':' + sourceEnd,
        scopeId: scope.id,
        propositionScopeIds: unique(proposition.ids),
        clauseRole: role,
        currentness: detectedCurrentness,
        action: {
          scopeId: scope.id,
          surface: occurrence.head.surface,
          startInScope: occurrence.startInScope,
          endInScope: occurrence.endInScope,
          sourceStart,
          sourceEnd,
          actionType: occurrence.head.actionType,
        },
        objectCandidates: objects,
        defaultObjectCandidateId: objects.length === 1 ? objects[0].id : null,
        localDisposition: local.value,
        dispositionReasons: local.reasons,
        conditionAttachment: {
          conditionScopeId: proposition.conditionScopeId,
          factScopeIds: proposition.factScopeIds,
          status: proposition.status,
          truth: proposition.truth,
        },
      })
    }
  }
  for (const candidate of candidates.filter((item) => item.objectCandidates.length === 0)) {
    const scope = index.scopes.find((item) => item.id === candidate.scopeId)
    const nextScope = scope ? index.scopes.find((item) => item.order === scope.order + 1) : undefined
    if (!scope || !nextScope || !/[，,]$/u.test(scope.text.trim())) continue
    const nextCandidates = candidates.filter((item) => item.scopeId === nextScope.id && item.localDisposition !== 'local_non_task')
    const firstNext = nextCandidates[0]
    if (!firstNext || !CONNECTOR_ONLY_RE.test(nextScope.text.slice(0, firstNext.action.startInScope))) continue
    const uniqueObjects = [...new Map(nextCandidates.flatMap((item) => item.objectCandidates).map((item) => [item.id, item])).values()]
    if (uniqueObjects.length !== 1) continue
    candidate.objectCandidates = [{ ...uniqueObjects[0], side: 'shared_after' }]
    candidate.defaultObjectCandidateId = uniqueObjects[0].id
    candidate.propositionScopeIds = unique([...candidate.propositionScopeIds, nextScope.id])
    candidate.dispositionReasons = unique([...candidate.dispositionReasons, 'CROSS_SCOPE_COORDINATED_OBJECT'])
  }
  const scopesWithCandidates = new Set(candidates.map((item) => item.scopeId))
  const scopesWithoutActionCandidates = index.scopes.filter((scope) => !scopesWithCandidates.has(scope.id))
  const withoutFingerprint: Omit<LocalActionCandidateCatalog, 'catalogFingerprint'> = {
    schemaVersion: LOCAL_ACTION_CANDIDATE_INDEX_VERSION,
    policyVersion: LOCAL_ACTION_CANDIDATE_V2_POLICY_VERSION,
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    candidates,
    scopesWithoutActionCandidates: scopesWithoutActionCandidates.map((scope) => scope.id),
    unresolvedActionScopeIds: scopesWithoutActionCandidates
      .filter((scope) => {
        if (LOCAL_NON_TASK_RE.test(scope.text) || ASSERTION_PREFIX_RE.test(scope.text.trim()) || conditionSurface(scope.text)) return false
        const revision = scope.text.match(REVISION_SIGNAL_RE)
        if (revision?.index !== undefined && !DIRECTIVE_MARKER_RE.test(scope.text.slice(0, revision.index))) return false
        return true
      })
      .map((scope) => scope.id),
  }
  return {
    ...withoutFingerprint,
    catalogFingerprint: await sha256(stableJson({
      policyVersion: LOCAL_ACTION_CANDIDATE_V2_POLICY_VERSION,
      catalog: withoutFingerprint,
    })),
  }
}

export async function validateLocalActionCandidateCatalogV2(
  catalog: LocalActionCandidateCatalog,
  index: ImmutableScopeIndex,
): Promise<LocalActionCandidateCatalogIssue[]> {
  const issues: LocalActionCandidateCatalogIssue[] = []
  if (catalog.schemaVersion !== LOCAL_ACTION_CANDIDATE_INDEX_VERSION) issues.push({ code: 'CATALOG_SCHEMA_VERSION_INVALID', path: 'schemaVersion' })
  if (catalog.policyVersion !== LOCAL_ACTION_CANDIDATE_V2_POLICY_VERSION) issues.push({ code: 'CATALOG_POLICY_VERSION_INVALID', path: 'policyVersion' })
  if (catalog.sourceId !== index.sourceId || catalog.sourceVersionId !== index.sourceVersionId || catalog.sourceFingerprint !== index.sourceFingerprint) {
    issues.push({ code: 'CATALOG_SOURCE_BINDING_MISMATCH', path: 'sourceId' })
  }
  const expected = await indexLocalActionCandidatesV2(index)
  if (catalog.catalogFingerprint !== expected.catalogFingerprint) issues.push({ code: 'CATALOG_FINGERPRINT_MISMATCH', path: 'catalogFingerprint' })
  if (stableJson(catalog) !== stableJson(expected)) issues.push({ code: 'CATALOG_DERIVATION_MISMATCH', path: 'catalog' })
  return issues
}
