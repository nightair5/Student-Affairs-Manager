import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import type { SingleAuthorityFacts } from './sourceContractV5'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const AUTHORITY_PRIMARY_SUPPORT_VERSION = 'authority-primary-support-index-1.0.0'
const check = (ok: unknown) => { if (!ok) throw Error('AUTHORITY_PRIMARY_SUPPORT_REFERENCE') }

/** A mixed index is not a missing fact. Separate only already-declared,
 * same-scope, explicitly owned support; downstream schema/value guards stay on. */
export function projectAuthorityPrimarySupport(input: unknown, context: WireContext) {
  const original = plainJson(input) as SingleAuthorityFacts, projected = structuredClone(original)
  const changes: Array<{ scopeId: string; retained: string[]; support: string[] }> = []
  for (const row of projected.scopeAccounting) {
    if (row.kind !== 'action' && row.kind !== 'event') continue
    check(context.index.scopes.some(s => s.id === row.scopeId)
      && new Set(row.primaryEntityIds).size === row.primaryEntityIds.length)
    // Leave an already typed row for the existing attribute/endpoint compiler.
    // Its nested attribute may legitimately supply the inverse scope index.
    if (row.primaryEntityIds.length > 0 && row.primaryEntityIds.every(id => row.kind === 'action'
      ? original.tasks.some(t => t.id === id) : original.events.some(e => e.tempId === id))) continue
    const primary = row.primaryEntityIds.filter(id => row.kind === 'action'
      ? original.tasks.some(t => t.id === id && t.propositionScopeIds.includes(row.scopeId))
      : original.events.some(e => e.tempId === id && e.scopeIds.includes(row.scopeId)))
    check(primary.length > 0)
    const support = row.primaryEntityIds.filter(id => !primary.includes(id))
    for (const id of support) {
      const material = original.materials.find(m => m.tempId === id)
      const point = original.timePoints.find(p => p.tempId === id)
      const event = original.events.find(e => e.tempId === id)
      const materialOwned = material?.scopeIds.includes(row.scopeId)
        && row.kind === 'action' && material.relatedTaskTempIds.some(t => primary.includes(t))
      const pointOwned = point?.scopeIds.includes(row.scopeId) && hasLiteralScopeSpan(point.rawText, point.scopeIds, context) && point.owners.some(o =>
        row.kind === 'event' ? (o.kind === 'event_start' || o.kind === 'event_end') && primary.includes(o.entityId)
          : o.kind === 'task' && primary.includes(o.entityId)
            || o.kind === 'material' && original.materials.some(m => m.tempId === o.entityId
              && m.relatedTaskTempIds.some(t => primary.includes(t))))
      const linkedEvent = row.kind === 'action' && event?.scopeIds.includes(row.scopeId)
        && event.relatedTaskTempIds.some(t => primary.includes(t))
      check(materialOwned || pointOwned || linkedEvent)
    }
    if (support.length) { row.primaryEntityIds = primary; changes.push({ scopeId: row.scopeId, retained: primary, support }) }
  }
  return { projected, audit: { version: AUTHORITY_PRIMARY_SUPPORT_VERSION,
    operation: 'EXISTING_TYPED_SUPPORT_TO_DERIVED_INDEX', inferredFacts: 0, changes, original } }
}
