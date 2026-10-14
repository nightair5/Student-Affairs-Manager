import { plainJson, stableJson, type SemanticInput } from '../mainline04/semanticContract'
import type { ReviewPackage } from '../mainline04/semanticComposer'
import { factAssets } from './factCorrections'

export const AUTOMATIC_SELECTION = 'NOT_ENABLED' as const
export type UserDisposition = 'pending' | 'deferred' | 'rejected' | 'confirmed'
export interface ExplicitFactReview { taskId: string; factIdentity: string }
const fail = (code: string): never => { throw Error('REAL_INPUT_POLICY_' + code) }
/** Review identity covers all relevant assets and prerequisite facts, not unrelated siblings. */
export function factIdentity(input: SemanticInput, id: string) {
  const ids = new Set([id])
  let size = -1
  while (size !== ids.size) {
    size = ids.size
    for (const t of input.tasks) if (ids.has(t.id)) {
      t.detail.dependencyTempIds.forEach(v => ids.add(v)); if (t.detail.parentTempId) ids.add(t.detail.parentTempId)
    }
    for (const r of input.revisions) if (ids.has(r.targetDirectiveId) || (r.fromDirectiveId && ids.has(r.fromDirectiveId))) {
      ids.add(r.targetDirectiveId); if (r.fromDirectiveId) ids.add(r.fromDirectiveId)
    }
  }
  const materials = new Set<string>(), times = new Set<string>(), events = new Set<string>()
  for (const task of ids) {
    if (!input.tasks.some(t => t.id === task)) continue // Failed raw references remain visible until explicit correction.
    const a = factAssets(input, task)
    a.materials.forEach(x => materials.add(x)); a.times.forEach(x => times.add(x)); a.events.forEach(x => events.add(x))
  }
  const all = new Set([...ids, ...materials, ...times, ...events])
  const by = <T>(rows: T[], key: (v: T) => string) => [...rows].sort((a,b) => key(a).localeCompare(key(b)))
  return stableJson({ sourceId: input.sourceId, sourceVersionId: input.sourceVersionId, fingerprint: input.sourceFingerprint,
    tasks: by(input.tasks.filter(t => ids.has(t.id)), t => t.id),
    materials: by(input.materials.filter(m => materials.has(m.tempId)), m => m.tempId),
    timePoints: by(input.timePoints.filter(t => times.has(t.tempId)), t => t.tempId),
    events: by(input.events.filter(e => events.has(e.tempId)), e => e.tempId),
    revisions: input.revisions.filter(r => ids.has(r.targetDirectiveId) || (r.fromDirectiveId && ids.has(r.fromDirectiveId))),
    conflicts: input.conflicts.filter(c => !c.entityTempIds.length || c.entityTempIds.some(x => all.has(x))),
    unresolvedScopeIds: input.unresolvedScopeIds })
}
export function itemSafety(input: SemanticInput, composed: ReviewPackage, id: string): string[] {
  const item = composed.items.find(i => i.tempId === id), task = input.tasks.find(t => t.id === id)
  if (!item || !task) return ['TASK_MISSING']
  const problems = [...item.issues]
  if (item.requiresAction !== 'true') problems.push('ACTION_' + item.requiresAction.toUpperCase())
  if (!['addressee', 'addressed_group'].includes(task.semantics.actor)) problems.push('ACTOR_REQUIRES_REVIEW')
  if (task.effect === 'unknown') problems.push('EFFECT_REQUIRES_REVIEW')
  if (!['true', 'not_applicable'].includes(task.condition.value)) problems.push('CONDITION_' + task.condition.value.toUpperCase())
  if (task.semantics.speechAct !== 'directive' || task.semantics.polarity !== 'affirmative'
    || task.semantics.status !== 'pending' || task.semantics.validity !== 'active'
    || !['present', 'future'].includes(task.semantics.tense)
    || !['required', 'recommended', 'optional'].includes(task.semantics.modality)) problems.push('NOT_ACTIVE_DIRECTIVE')
  return [...new Set(problems)]
}
export function selectLiveTasks(input: SemanticInput, composed: ReviewPackage, reviews: readonly ExplicitFactReview[],
  dispositions: Readonly<Record<string, UserDisposition>>, selected: readonly string[], sourceFacts: SemanticInput = input) {
  // Validated local composition required; origin must not be upgraded to human.
  if (composed.origin !== 'live_model_candidate' || composed.sourceIndex.sourceFingerprint !== input.sourceFingerprint
    || stableJson(composed.original) !== stableJson(sourceFacts)) fail('SOURCE_OR_ORIGIN')
  const requested = plainJson(selected), checked = plainJson(reviews)
  if (new Set(requested).size !== requested.length || requested.some(id => !input.tasks.some(t => t.id === id))) fail('SELECTION')
  const eligible = new Map(input.tasks.map(task => {
    const reasons = itemSafety(input, composed, task.id)
    if (!checked.some(r => r.taskId === task.id && r.factIdentity === factIdentity(input, task.id))) reasons.push('EXPLICIT_FACT_REVIEW_REQUIRED')
    if (dispositions[task.id] === 'rejected') reasons.push('REJECTED')
    if (dispositions[task.id] === 'deferred') reasons.push('DEFERRED')
    return [task.id, reasons] as const
  }))
  let changed = true
  while (changed) {
    changed = false
    for (const task of input.tasks) {
      const reasons = eligible.get(task.id)!
      const dependencies = [...task.detail.dependencyTempIds, ...(task.detail.parentTempId ? [task.detail.parentTempId] : [])]
      if (dependencies.some(id => dispositions[id] !== 'confirmed' && (!requested.includes(id) || (eligible.get(id)?.length ?? 1) > 0))
        && !reasons.includes('DEPENDENCY_CONFIRM_FIRST')) { reasons.push('DEPENDENCY_CONFIRM_FIRST'); changed = true }
    }
  }
  return input.tasks.map(task => ({ taskId: task.id, defaultSelected: false as const,
    selected: requested.includes(task.id) && !eligible.get(task.id)!.length && dispositions[task.id] !== 'confirmed', reasons: eligible.get(task.id)! }))
}
