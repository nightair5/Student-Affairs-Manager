import type { ImmutableScope, ImmutableScopeIndex } from './scopeReferenceContract'
import type { LocalTaskSuggestion } from './taskFormationPolicyV2'

export const REVISION_RELATION_RESOLVER_VERSION = 'revision-relation-resolver-1.0.0' as const

export type RevisionRelationKind = 'cancels' | 'supersedes' | 'amends'

export interface LocalRevisionRelation {
  id: string
  kind: RevisionRelationKind
  targetTaskId: string
  replacementTaskIds: string[]
  evidenceScopeIds: string[]
  referentType: string | null
  resolution: 'shared_scope' | 'same_scope_position' | 'adjacent_unique_referent'
}

export interface LocalRevisionResolution {
  resolverVersion: typeof REVISION_RELATION_RESOLVER_VERSION
  relations: LocalRevisionRelation[]
  unresolvedRevisionScopeIds: string[]
}

interface RevisionSignal {
  scope: ImmutableScope
  markerOffset: number
  kindHint: 'cancels' | 'amends'
  referentType: string | null
}

const AMEND_MARKER_RE = /(?:改为|调整为|变更为|修订为|更改为)/u
const CANCEL_MARKER_RE = /(?:作废|取消|撤销|废止|失效|不再(?:有效|生效|执行)|停止执行|终止执行)/u
const REFERENT_RE = /(?:该|此|上述|前述|本|原|旧|先前|此前|原先|上一版)?(通知|安排|要求|规定|方案|流程|规则|条款|版本|任务)/u
const HISTORICAL_DEICTIC_RE = /(?:原|旧|先前|此前|原先|上一版|前述|既有)/u
const REPLACEMENT_INTRO_RE = /(?:新(?:的)?要求|最新要求|现行要求|当前要求|替代要求|改后要求|从现在起|现改为|调整为|变更为|修订为|更改为)/u

function scopeOrder(scopeId: string, scopes: Map<string, ImmutableScope>): number {
  return scopes.get(scopeId)?.order ?? Number.MAX_SAFE_INTEGER
}

function taskOrder(task: LocalTaskSuggestion, scopes: Map<string, ImmutableScope>): number {
  return scopeOrder(task.action.scopeId, scopes)
}

function referentType(text: string): string | null {
  return text.match(REFERENT_RE)?.[1] ?? null
}

function revisionSignals(index: ImmutableScopeIndex): RevisionSignal[] {
  const signals: RevisionSignal[] = []
  for (const scope of index.scopes) {
    const amend = scope.text.match(AMEND_MARKER_RE)
    if (amend?.index !== undefined) {
      signals.push({ scope, markerOffset: amend.index, kindHint: 'amends', referentType: referentType(scope.text.slice(0, amend.index + amend[0].length)) })
      continue
    }
    const cancel = scope.text.match(CANCEL_MARKER_RE)
    if (cancel?.index !== undefined) signals.push({ scope, markerOffset: cancel.index, kindHint: 'cancels', referentType: referentType(scope.text.slice(0, cancel.index + cancel[0].length)) })
  }
  return signals
}

function directTarget(signal: RevisionSignal, tasks: LocalTaskSuggestion[]): LocalTaskSuggestion | null {
  const candidates = tasks.filter((task) => task.action.scopeId !== signal.scope.id && task.propositionScopeIds.includes(signal.scope.id))
  return candidates.length === 1 ? candidates[0] : null
}

function sameScopeTarget(signal: RevisionSignal, tasks: LocalTaskSuggestion[]): LocalTaskSuggestion | null {
  const candidates = tasks.filter((task) => {
    if (task.action.scopeId !== signal.scope.id) return false
    const actionOffset = signal.scope.text.indexOf(task.action.surface)
    return actionOffset >= 0 && actionOffset < signal.markerOffset
  })
  return candidates.length === 1 ? candidates[0] : null
}

function adjacentTarget(signal: RevisionSignal, tasks: LocalTaskSuggestion[], scopes: Map<string, ImmutableScope>): LocalTaskSuggestion | null {
  const candidates = tasks.filter((task) => {
    const order = taskOrder(task, scopes)
    if (order >= signal.scope.order || signal.scope.order - order > 2) return false
    const actionScope = scopes.get(task.action.scopeId)
    if (!actionScope || !HISTORICAL_DEICTIC_RE.test(actionScope.text.slice(0, actionScope.text.indexOf(task.action.surface)))) return false
    const taskReferent = referentType(actionScope.text)
    return signal.referentType === null || taskReferent === signal.referentType
  })
  return candidates.length === 1 ? candidates[0] : null
}

function replacements(signal: RevisionSignal, target: LocalTaskSuggestion, tasks: LocalTaskSuggestion[], scopes: Map<string, ImmutableScope>): LocalTaskSuggestion[] {
  const sameScope = tasks.filter((task) => {
    if (task.id === target.id || task.action.scopeId !== signal.scope.id) return false
    const actionOffset = signal.scope.text.indexOf(task.action.surface)
    return actionOffset > signal.markerOffset
  })
  if (sameScope.length > 0) return sameScope
  return tasks.filter((task) => {
    if (task.id === target.id) return false
    const order = taskOrder(task, scopes)
    const actionScope = scopes.get(task.action.scopeId)
    return order > signal.scope.order && order - signal.scope.order <= 2 && Boolean(actionScope && REPLACEMENT_INTRO_RE.test(actionScope.text))
  })
}

export function resolveLocalRevisionRelations(index: ImmutableScopeIndex, tasks: LocalTaskSuggestion[]): LocalRevisionResolution {
  const scopes = new Map(index.scopes.map((scope) => [scope.id, scope]))
  const relations: LocalRevisionRelation[] = []
  const unresolvedRevisionScopeIds: string[] = []
  const targetedTaskIds = new Set<string>()
  for (const signal of revisionSignals(index)) {
    const shared = directTarget(signal, tasks)
    const positioned = shared ? null : sameScopeTarget(signal, tasks)
    const adjacent = shared || positioned ? null : adjacentTarget(signal, tasks, scopes)
    const target = shared ?? positioned ?? adjacent
    if (!target || targetedTaskIds.has(target.id)) {
      unresolvedRevisionScopeIds.push(signal.scope.id)
      continue
    }
    const replacementTasks = replacements(signal, target, tasks, scopes)
    const kind: RevisionRelationKind = signal.kindHint === 'amends' ? 'amends' : replacementTasks.length > 0 ? 'supersedes' : 'cancels'
    const evidenceScopeIds = [...new Set([target.action.scopeId, signal.scope.id, ...replacementTasks.map((task) => task.action.scopeId)])]
      .sort((left, right) => scopeOrder(left, scopes) - scopeOrder(right, scopes))
    relations.push({
      id: `revision-${kind}-${target.id}-${signal.scope.order}`,
      kind,
      targetTaskId: target.id,
      replacementTaskIds: replacementTasks.map((task) => task.id),
      evidenceScopeIds,
      referentType: signal.referentType,
      resolution: shared ? 'shared_scope' : positioned ? 'same_scope_position' : 'adjacent_unique_referent',
    })
    targetedTaskIds.add(target.id)
  }
  return { resolverVersion: REVISION_RELATION_RESOLVER_VERSION, relations, unresolvedRevisionScopeIds }
}
