import type { DerivedEvidence, ImmutableScopeIndex, SurfaceReference } from '../../recognition/scopeReferenceContract'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { parseChineseTimeAst } from '../../lib/timeSemantics'
import { parseSemanticInput, plainJson, REVIEW_VERSION, stableJson } from './semanticContract'
import type { SemanticInput, SemanticTask, Truth } from './semanticContract'

export interface ComposeContext {
  index: ImmutableScopeIndex
  authority: 'human_engineering' | 'seen_model_unverified'
  referenceTime: string
  timezone: string
  ownershipMode?: 'mainline05-own-assets-1'
}
export interface SemanticIssue { code: string; entityIds: string[] }
export interface ReviewItem {
  tempId: string; localId: string; requiresAction: Truth; defaultSelected: boolean
  condition: SemanticTask['condition']; evidence: DerivedEvidence[]; issues: string[]
}
export interface ReviewPackage {
  schemaVersion: typeof REVIEW_VERSION
  original: SemanticInput
  origin: ComposeContext['authority']
  items: ReviewItem[]
  issues: SemanticIssue[]
  sourceIndex: ImmutableScopeIndex
  normalizedTimes: Array<{ tempId: string; ast: ReturnType<typeof parseChineseTimeAst> }>
  app: 'NOT_RUN'
  canonicalPersistence: 'NOT_RUN'
}

/** Structural provenance is not semantic entailment. Only explicit test-side human labels
 * can enable a review default; nothing here commits or executes a task. */
export async function composeSemantics(input: unknown, options: ComposeContext): Promise<ReviewPackage> {
  const raw = parseSemanticInput(input), context = plainJson(options)
  if (context.ownershipMode !== undefined && context.ownershipMode !== 'mainline05-own-assets-1') throw new Error('LOCAL_OWNERSHIP_MODE_INVALID')
  if (!['human_engineering', 'seen_model_unverified'].includes(context.authority)
    || !Number.isFinite(Date.parse(context.referenceTime))) throw new Error('LOCAL_CONTEXT_INVALID')
  try { new Intl.DateTimeFormat('en', { timeZone: context.timezone }).format() } catch { throw new Error('LOCAL_TIMEZONE_INVALID') }
  const index = context.index
  const verified = await indexImmutableScopesV11(index.sourceId, index.sourceVersionId, index.sourceContent)
  if (stableJson(index) !== stableJson(verified) || raw.sourceId !== index.sourceId || raw.sourceVersionId !== index.sourceVersionId
    || raw.sourceFingerprint !== index.sourceFingerprint) throw new Error('SOURCE_BINDING_INVALID')
  const issues: SemanticIssue[] = []
  const issue = (code: string, ...entityIds: string[]) => { issues.push({ code, entityIds: [...new Set(entityIds)].sort() }) }
  const scopes = new Map(index.scopes.map(scope => [scope.id, scope]))
  const entities = [...raw.tasks.map(task => task.id), ...raw.materials.map(item => item.tempId), ...raw.timePoints.map(item => item.tempId), ...raw.events.map(item => item.tempId)]
  if (new Set(entities).size !== entities.length) throw new Error('DUPLICATE_ENTITY_ID')
  const adjacency = new Map(entities.map(id => [id, new Set<string>()]))
  const kinds = new Map([...raw.tasks.map(t => [t.id, 'task'] as const), ...raw.materials.map(t => [t.tempId, 'material'] as const),
    ...raw.timePoints.map(t => [t.tempId, 'time'] as const), ...raw.events.map(t => [t.tempId, 'event'] as const)])
  const covered = new Set<string>()
  function evidence(ids: string[], entity: string, required = true): DerivedEvidence[] {
    if (required && !ids.length) issue('MISSING_EVIDENCE', entity)
    return ids.flatMap(id => {
      const scope = scopes.get(id)
      if (!scope) { issue('BAD_SCOPE', entity); return [] }
      covered.add(id)
      return [{ scopeId: id, start: scope.start, end: scope.end, quote: scope.text }]
    })
  }
  function surface(ref: SurfaceReference, ids: string[], entity: string) {
    const scope = scopes.get(ref.scopeId)
    const offset = scope?.text.indexOf(ref.surface) ?? -1
    if (!ids.includes(ref.scopeId) || offset < 0 || scope!.text.indexOf(ref.surface, offset + 1) >= 0) issue('SURFACE_NOT_UNIQUE_IN_SCOPE', entity)
  }
  function link(from: string, target: string, kind: string) {
    if (kinds.get(target) !== kind || from === target) { issue('BAD_ENTITY_REFERENCE', from); return }
    adjacency.get(from)!.add(target); adjacency.get(target)!.add(from)
  }
  const taskEvidence = new Map<string, DerivedEvidence[]>()
  for (const task of raw.tasks) {
    taskEvidence.set(task.id, evidence(task.propositionScopeIds, task.id))
    surface(task.action, task.propositionScopeIds, task.id); surface(task.object, task.propositionScopeIds, task.id)
    const c = task.condition
    evidence(c.conditionScopeIds, task.id, c.value !== 'not_applicable')
    evidence(c.factScopeIds, task.id, c.value === 'true' || c.value === 'false')
    if (c.value === 'not_applicable' && (c.conditionScopeIds.length || c.factScopeIds.length)) issue('CONDITION_CONTRADICTION', task.id)
    for (const id of task.detail.materialTempIds) link(task.id, id, 'material')
    for (const id of task.detail.timePointTempIds) link(task.id, id, 'time')
    for (const id of task.eventTempIds) link(task.id, id, 'event')
    for (const id of task.detail.dependencyTempIds) link(task.id, id, 'task')
    if (task.detail.parentTempId) link(task.id, task.detail.parentTempId, 'task')
  }
  for (const material of raw.materials) {
    evidence(material.scopeIds, material.tempId)
    if (!material.relatedTaskTempIds.length) issue('ORPHAN_MATERIAL', material.tempId)
    for (const id of material.relatedTaskTempIds) link(material.tempId, id, 'task')
  }
  const normalizedTimes = raw.timePoints.map(time => {
    evidence(time.scopeIds, time.tempId)
    if (!time.relatedTaskTempIds.length && !time.relatedMaterialTempIds.length && !raw.events.some(e => e.startTimePointTempId === time.tempId || e.endTimePointTempId === time.tempId)) issue('ORPHAN_TIME', time.tempId)
    for (const id of time.relatedTaskTempIds) link(time.tempId, id, 'task')
    for (const id of time.relatedMaterialTempIds) link(time.tempId, id, 'material')
    const matches = time.scopeIds.filter(id => scopes.get(id)?.text.includes(time.rawText))
    if (matches.length !== 1) issue('TIME_EVIDENCE_UNRESOLVED', time.tempId)
    const ast = parseChineseTimeAst(time.rawText, { type: time.type, referenceTime: context.referenceTime, timezone: context.timezone })
    if (time.timezone !== context.timezone || ast.normalizedValue !== time.normalizedValue || ast.isAllDay !== time.isAllDay
      || ast.precision !== time.precision || time.needsConfirmation || ast.needsConfirmation) issue('TIME_NEEDS_REVIEW', time.tempId)
    return { tempId: time.tempId, ast }
  })
  for (const event of raw.events) {
    evidence(event.scopeIds, event.tempId)
    if (!event.relatedTaskTempIds.length) issue('EVENT_NOT_TASK_ASSOCIATED', event.tempId)
    for (const id of event.relatedTaskTempIds) link(event.tempId, id, 'task')
    if (event.startTimePointTempId) link(event.tempId, event.startTimePointTempId, 'time')
    if (event.endTimePointTempId) link(event.tempId, event.endTimePointTempId, 'time')
  }
  // Follow all owned material/time/event edges, including reverse owner references.
  // Sharing an entity is not a dependency on its other owners or their private assets.
  // Only explicit task dependencies/parent links may cross into another task.
  function related(id: string, includeDependencies = true): Set<string> {
    const found = new Set([id]), pending = [id]
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      for (const target of adjacency.get(next) ?? []) if (!found.has(target)) {
        if (kinds.get(target) === 'task') {
          if (!includeDependencies) continue
          const owner = raw.tasks.find(task => task.id === next)
          if (!owner || (!owner.detail.dependencyTempIds.includes(target) && owner.detail.parentTempId !== target)) continue
        }
        found.add(target); pending.push(target)
      }
    }
    return found
  }
  // Opt-in only: a prerequisite carries safety constraints, not ownership of its
  // private dates/materials. The default graph remains byte-for-byte compatible
  // in its results; the full graph still propagates issues and detects cycles.
  const ownership = new Map(raw.tasks.map(task => [task.id, related(task.id, context.ownershipMode === undefined)]))
  const safety = context.ownershipMode === undefined ? ownership : new Map(raw.tasks.map(task => [task.id, related(task.id)]))
  for (const task of raw.tasks) {
    const ids = ownership.get(task.id)!
    for (const kind of ['time', 'material', 'event'] as const) {
      const has = [...ids].some(id => kinds.get(id) === kind), status = task.coverage[kind]
      if ((status === 'present') !== has || ['unresolved', 'not_extracted'].includes(status)) issue('COVERAGE_' + kind.toUpperCase(), task.id)
    }
    const deadlines = raw.timePoints.filter(t => ids.has(t.tempId) && ['task_deadline', 'submission_deadline', 'registration_deadline'].includes(t.type))
    if (new Set(deadlines.map(t => t.normalizedValue)).size > 1) issue('MULTIPLE_DEADLINES', task.id)
  }
  const inactive = new Set<string>()
  const unresolvedRevisions = new Set<string>()
  const revisionEdges = new Map<string, string[]>()
  for (const r of raw.revisions) {
    const ids = [r.targetDirectiveId, ...(r.fromDirectiveId ? [r.fromDirectiveId] : [])]
    // A revision's evidence supports both endpoints, not only the old requirement.
    // Do not activate cancellation from an unverified relation or coerce it to false.
    for (const id of ids) evidence(r.scopeIds, id)
    const invalidReference = ids.some(id => kinds.get(id) !== 'task') || r.fromDirectiveId === r.targetDirectiveId
      || (r.type !== 'cancels' && r.fromDirectiveId === null) || (r.type === 'cancels' && r.fromDirectiveId !== null)
    const invalidEvidence = !r.scopeIds.length || r.scopeIds.some(id => !scopes.has(id))
    if (invalidReference) issue('BAD_REVISION_REFERENCE', ...ids)
    if (invalidReference || invalidEvidence || r.effective === 'unknown' || r.type === 'amends') {
      issue('REVISION_NEEDS_REVIEW', ...ids)
      ids.forEach(id => unresolvedRevisions.add(id))
    } else if (r.effective === 'true') inactive.add(r.targetDirectiveId)
    if (r.fromDirectiveId) revisionEdges.set(r.fromDirectiveId, [...(revisionEdges.get(r.fromDirectiveId) ?? []), r.targetDirectiveId])
  }
  const directed = new Map(raw.tasks.map(t => [t.id, [...t.detail.dependencyTempIds, ...(t.detail.parentTempId ? [t.detail.parentTempId] : []), ...(revisionEdges.get(t.id) ?? [])]]))
  function cyclic(start: string, id: string, visited: Set<string>): boolean {
    if (visited.has(id)) return id === start
    return (directed.get(id) ?? []).some(next => cyclic(start, next, new Set([...visited, id])))
  }
  for (const task of raw.tasks) if (cyclic(task.id, task.id, new Set())) issue('CYCLIC_RELATION', task.id)
  for (const conflict of raw.conflicts) {
    evidence(conflict.scopeIds, conflict.entityTempIds[0] ?? '')
    if (!conflict.entityTempIds.length || conflict.entityTempIds.some(id => !kinds.has(id))) issue('UNBOUND_CONFLICT')
    if (conflict.requiresDecision) issue('CONFLICT_REQUIRES_DECISION', ...conflict.entityTempIds)
  }
  evidence(raw.informationScopeIds, '', false); evidence(raw.unresolvedScopeIds, '', false)
  if (index.scopes.some(scope => !covered.has(scope.id))) issue('UNACCOUNTED_SOURCE_SCOPE')
  if (raw.unresolvedScopeIds.length) issue('UNRESOLVED_SOURCE_SCOPE')
  const items = raw.tasks.map(task => {
    const affected = safety.get(task.id)!
    const codes = [...new Set(issues.filter(i => !i.entityIds.length || i.entityIds.some(id => !id || affected.has(id))).map(i => i.code))].sort()
    const s = task.semantics
    let requiresAction: Truth = 'unknown'
    if (unresolvedRevisions.has(task.id)) requiresAction = 'unknown'
    else if (inactive.has(task.id) || ['completed', 'cancelled'].includes(s.status) || s.validity === 'superseded'
      || s.polarity === 'negative' || s.modality === 'informational' || task.condition.value === 'false') requiresAction = 'false'
    else if (s.speechAct === 'directive' && s.polarity === 'affirmative' && s.status === 'pending' && s.validity === 'active'
      && ['present', 'future'].includes(s.tense) && ['required', 'recommended', 'optional'].includes(s.modality)
      && ['true', 'not_applicable'].includes(task.condition.value)) requiresAction = 'true'
    return { tempId: task.id, localId: `${index.sourceFingerprint}:task:${encodeURIComponent(task.id)}`, requiresAction,
      defaultSelected: context.authority === 'human_engineering' && requiresAction === 'true' && codes.length === 0
        && task.inferenceLevel === 'explicit' && s.modality === 'required' && ['addressee', 'addressed_group'].includes(s.actor)
        && task.effect !== 'unknown', condition: plainJson(task.condition), evidence: taskEvidence.get(task.id)!, issues: codes }
  })
  return { schemaVersion: REVIEW_VERSION, original: raw, origin: context.authority, items, issues,
    sourceIndex: verified, normalizedTimes, app: 'NOT_RUN', canonicalPersistence: 'NOT_RUN' }
}
