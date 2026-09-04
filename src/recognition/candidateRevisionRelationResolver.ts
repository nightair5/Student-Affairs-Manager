import type { ImmutableScope, ImmutableScopeIndex, SurfaceReference } from './scopeReferenceContract'
import type { LocalCurrentness } from './localActionCandidateIndexV2'
import type { LocalRevisionRelation } from './revisionRelationResolver'

export const CANDIDATE_REVISION_RELATION_RESOLVER_VERSION = 'candidate-revision-relation-resolver-1.0.0' as const

export interface CandidateRevisionTask {
  id: string
  originCandidateId: string
  propositionScopeIds: string[]
  action: SurfaceReference
  actionSourceStart: number
  currentness: LocalCurrentness
}

export interface CandidateRevisionResolution {
  resolverVersion: typeof CANDIDATE_REVISION_RELATION_RESOLVER_VERSION
  relations: LocalRevisionRelation[]
  unresolvedRevisionScopeIds: string[]
  unresolvedPossibleTargetTaskIds: string[]
  coverageSuppressedRevisionScopeIds: string[]
}

export interface CandidateRevisionUncertainty {
  scopeId: string
  actionSourceStart: number | null
  currentness: LocalCurrentness | 'unknown'
}

interface RevisionSignal {
  scope: ImmutableScope
  markerOffset: number
  markerSourceStart: number
  kindHint: 'cancels' | 'amends'
  referentType: string | null
}

const AMEND_MARKER_RE = /(?:改为|调整为|变更为|修订为|更改为)/u
const CANCEL_MARKER_RE = /(?:作废|取消|撤销|废止|失效|不再(?:有效|生效|执行)|停止执行|终止执行)/u
const REFERENT_RE = /(?:该|此|上述|前述|本|原|旧|先前|此前|原先|上一版)?(通知|安排|要求|规定|方案|流程|规则|条款|版本|任务)/u
const REPLACEMENT_INTRO_RE = /(?:新(?:的)?要求|最新要求|现行要求|当前要求|替代要求|改后要求|从现在起|现改为|调整为|变更为|修订为|更改为)/u

function unique<T>(values: T[]): T[] { return [...new Set(values)] }

function referentType(text: string): string | null {
  return text.match(REFERENT_RE)?.[1] ?? null
}

function revisionSignals(index: ImmutableScopeIndex): RevisionSignal[] {
  const signals: RevisionSignal[] = []
  for (const scope of index.scopes) {
    const amend = scope.text.match(AMEND_MARKER_RE)
    if (amend?.index !== undefined) {
      signals.push({
        scope,
        markerOffset: amend.index,
        markerSourceStart: scope.start + amend.index,
        kindHint: 'amends',
        referentType: referentType(scope.text.slice(0, amend.index + amend[0].length)),
      })
      continue
    }
    const cancel = scope.text.match(CANCEL_MARKER_RE)
    if (cancel?.index !== undefined) {
      signals.push({
        scope,
        markerOffset: cancel.index,
        markerSourceStart: scope.start + cancel.index,
        kindHint: 'cancels',
        referentType: referentType(scope.text.slice(0, cancel.index + cancel[0].length)),
      })
    }
  }
  return signals
}

function directTarget(signal: RevisionSignal, tasks: CandidateRevisionTask[]): CandidateRevisionTask | null {
  const candidates = tasks.filter((task) => task.action.scopeId !== signal.scope.id && task.propositionScopeIds.includes(signal.scope.id))
  return candidates.length === 1 ? candidates[0] : null
}

function sameScopeTarget(signal: RevisionSignal, tasks: CandidateRevisionTask[]): CandidateRevisionTask | null {
  const candidates = tasks.filter((task) => task.action.scopeId === signal.scope.id && task.actionSourceStart < signal.markerSourceStart)
  const historical = candidates.filter((task) => task.currentness === 'historical')
  if (historical.length === 1) return historical[0]
  return candidates.length === 1 ? candidates[0] : null
}

function adjacentTarget(
  signal: RevisionSignal,
  tasks: CandidateRevisionTask[],
  scopes: Map<string, ImmutableScope>,
): CandidateRevisionTask | null {
  const candidates = tasks.filter((task) => {
    const actionScope = scopes.get(task.action.scopeId)
    if (!actionScope || actionScope.order >= signal.scope.order || signal.scope.order - actionScope.order > 2) return false
    if (task.currentness !== 'historical') return false
    const taskReferent = referentType(actionScope.text)
    return signal.referentType === null || taskReferent === signal.referentType
  })
  return candidates.length === 1 ? candidates[0] : null
}

function possibleTargets(
  signal: RevisionSignal,
  tasks: CandidateRevisionTask[],
  scopes: Map<string, ImmutableScope>,
): CandidateRevisionTask[] {
  return tasks.filter((task) => {
    const actionScope = scopes.get(task.action.scopeId)
    if (!actionScope) return false
    if (task.action.scopeId === signal.scope.id) return task.actionSourceStart < signal.markerSourceStart
    if (task.propositionScopeIds.includes(signal.scope.id)) return true
    if (actionScope.order >= signal.scope.order || signal.scope.order - actionScope.order > 2) return false
    if (task.currentness !== 'historical' && task.currentness !== 'unknown') return false
    const taskReferent = referentType(actionScope.text)
    return signal.referentType === null || taskReferent === signal.referentType
  })
}

function uncertaintyAffectsSignal(
  signal: RevisionSignal,
  uncertainties: CandidateRevisionUncertainty[],
  unresolvedActionScopeIds: ReadonlySet<string>,
  scopes: Map<string, ImmutableScope>,
): boolean {
  const nearbyUnresolvedScope = [...unresolvedActionScopeIds].some((scopeId) => {
    const scope = scopes.get(scopeId)
    return Boolean(scope && Math.abs(scope.order - signal.scope.order) <= 2)
  })
  if (nearbyUnresolvedScope) return true
  return uncertainties.some((uncertainty) => {
    const scope = scopes.get(uncertainty.scopeId)
    if (!scope) return false
    if (scope.id === signal.scope.id) return uncertainty.actionSourceStart === null
      || uncertainty.actionSourceStart < signal.markerSourceStart
      || REPLACEMENT_INTRO_RE.test(scope.text)
    if (scope.order < signal.scope.order && signal.scope.order - scope.order <= 2) {
      if (uncertainty.currentness !== 'historical' && uncertainty.currentness !== 'unknown') return false
      const uncertainReferent = referentType(scope.text)
      return signal.referentType === null || uncertainReferent === signal.referentType
    }
    return scope.order > signal.scope.order
      && scope.order - signal.scope.order <= 2
      && (uncertainty.currentness === 'current' || uncertainty.currentness === 'unknown')
      && REPLACEMENT_INTRO_RE.test(scope.text)
  })
}

function replacements(
  signal: RevisionSignal,
  target: CandidateRevisionTask,
  tasks: CandidateRevisionTask[],
  scopes: Map<string, ImmutableScope>,
): CandidateRevisionTask[] {
  const sameScope = tasks.filter((task) => task.id !== target.id
    && task.action.scopeId === signal.scope.id
    && task.actionSourceStart > signal.markerSourceStart)
  if (sameScope.length > 0) return sameScope.sort((left, right) => left.actionSourceStart - right.actionSourceStart)
  return tasks.filter((task) => {
    if (task.id === target.id) return false
    const actionScope = scopes.get(task.action.scopeId)
    return Boolean(actionScope
      && actionScope.order > signal.scope.order
      && actionScope.order - signal.scope.order <= 2
      && task.currentness === 'current'
      && REPLACEMENT_INTRO_RE.test(actionScope.text))
  }).sort((left, right) => left.actionSourceStart - right.actionSourceStart)
}

export function resolveCandidateRevisionRelations(
  index: ImmutableScopeIndex,
  tasks: CandidateRevisionTask[],
  uncertainties: CandidateRevisionUncertainty[] = [],
  unresolvedActionScopeIds: ReadonlySet<string> = new Set(),
): CandidateRevisionResolution {
  const scopes = new Map(index.scopes.map((scope) => [scope.id, scope]))
  const relations: LocalRevisionRelation[] = []
  const unresolvedRevisionScopeIds: string[] = []
  const unresolvedPossibleTargetTaskIds: string[] = []
  const coverageSuppressedRevisionScopeIds: string[] = []
  const targetedTaskIds = new Set<string>()
  for (const signal of revisionSignals(index)) {
    const possible = possibleTargets(signal, tasks, scopes)
    if (uncertaintyAffectsSignal(signal, uncertainties, unresolvedActionScopeIds, scopes)) {
      unresolvedRevisionScopeIds.push(signal.scope.id)
      unresolvedPossibleTargetTaskIds.push(...possible.map((task) => task.id))
      coverageSuppressedRevisionScopeIds.push(signal.scope.id)
      continue
    }
    const shared = directTarget(signal, tasks)
    const positioned = shared ? null : sameScopeTarget(signal, tasks)
    const adjacent = shared || positioned ? null : adjacentTarget(signal, tasks, scopes)
    const target = shared ?? positioned ?? adjacent
    if (!target || targetedTaskIds.has(target.id)) {
      unresolvedRevisionScopeIds.push(signal.scope.id)
      unresolvedPossibleTargetTaskIds.push(...possible.map((task) => task.id))
      continue
    }
    const replacementTasks = replacements(signal, target, tasks, scopes)
    const kind = signal.kindHint === 'amends' ? 'amends' : replacementTasks.length > 0 ? 'supersedes' : 'cancels'
    relations.push({
      id: `candidate-revision-${kind}-${target.originCandidateId}-${signal.scope.order}`,
      kind,
      targetTaskId: target.id,
      replacementTaskIds: replacementTasks.map((task) => task.id),
      evidenceScopeIds: unique([target.action.scopeId, signal.scope.id, ...replacementTasks.map((task) => task.action.scopeId)])
        .sort((left, right) => (scopes.get(left)?.order ?? 0) - (scopes.get(right)?.order ?? 0)),
      referentType: signal.referentType,
      resolution: shared ? 'shared_scope' : positioned ? 'same_scope_position' : 'adjacent_unique_referent',
    })
    targetedTaskIds.add(target.id)
  }
  return {
    resolverVersion: CANDIDATE_REVISION_RELATION_RESOLVER_VERSION,
    relations,
    unresolvedRevisionScopeIds: unique(unresolvedRevisionScopeIds),
    unresolvedPossibleTargetTaskIds: unique(unresolvedPossibleTargetTaskIds),
    coverageSuppressedRevisionScopeIds: unique(coverageSuppressedRevisionScopeIds),
  }
}

export function candidateRevisionSignalScopeIds(index: ImmutableScopeIndex): string[] {
  return unique(revisionSignals(index).map((signal) => signal.scope.id))
}
