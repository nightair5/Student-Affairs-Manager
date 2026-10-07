import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import type { SingleAuthorityFacts } from './sourceContractV5'

export const AUTHORITY_SUPPORT_CONTEXT_VERSION = 'authority-support-context-1.0.0'
const text = (s: string) => s.replace(/[\s，。；,:：;！!]/gu, '')
const check = (ok: unknown) => { if (!ok) throw Error('AUTHORITY_SUPPORT_CONTEXT_REFERENCE') }

/** A model's information row can name an existing task as context, not as a
 * new action. Keep the original declaration in audit; derive the legacy empty
 * information index only for literal, independently grounded support. */
export function projectAuthoritySupportContext(input: unknown, context: WireContext) {
  const original = plainJson(input) as SingleAuthorityFacts, projected = structuredClone(original)
  check(Array.isArray(projected.scopeAccounting) && Array.isArray(projected.tasks))
  const changes: Array<{ scopeId: string; taskId: string; reason: 'LITERAL_SUPPORT' | 'URL_CONTINUATION' }> = []
  for (const row of projected.scopeAccounting) {
    if (row.kind !== 'information' || !row.primaryEntityIds.length) continue
    const scope = context.index.scopes.find(s => s.id === row.scopeId)
    check(scope && new Set(row.primaryEntityIds).size === row.primaryEntityIds.length)
    for (const id of row.primaryEntityIds) {
      const task = original.tasks.find(t => t.id === id)
      check(task && task.propositionScopeIds.includes(row.scopeId))
      const action = context.index.scopes.find(s => s.id === task!.action.scopeId)
      const object = context.index.scopes.find(s => s.id === task!.object.scopeId)
      check(action?.text.includes(task!.action.surface) && object?.text.includes(task!.object.surface)
        && original.scopeAccounting.some(r => r.kind === 'action' && r.primaryEntityIds.includes(id)
          && task!.propositionScopeIds.includes(r.scopeId)))
      // A primary directive cannot be reclassified as information.
      check(row.scopeId !== task!.action.scopeId && row.scopeId !== task!.object.scopeId)
      const literal = text(scope!.text), previous = context.index.scopes.find(s => s.order === scope!.order - 1)
      const url = /^\/\/[A-Za-z0-9.-]+\//u.test(scope!.text) && previous?.text.endsWith('https:')
        && task!.propositionScopeIds.includes(previous.id) && previous.id === action!.id
      const completion = /^(?:并)?确保/u.test(scope!.text) && task!.detail.completionCriteria
        .some(c => text(c).includes(literal.replace(/^并/u, '')))
      const condition = task!.condition.value === 'unknown' && task!.condition.conditionScopeIds.includes(row.scopeId)
        && /如|若|如果|仅|条件|尚未/u.test(scope!.text) && text(task!.detail.description).includes(literal)
      const classification = /^视同[^，。；]{1,40}管理[，。；]$/u.test(scope!.text)
        && previous && task!.condition.value === 'unknown' && task!.condition.conditionScopeIds.includes(previous.id)
        && task!.propositionScopeIds.includes(previous.id) && text(task!.detail.description).includes(literal)
      const supported = literal.length > 0 && (completion || condition || classification)
      check(url || supported)
      changes.push({ scopeId: row.scopeId, taskId: id, reason: url ? 'URL_CONTINUATION' : 'LITERAL_SUPPORT' })
    }
    row.primaryEntityIds = []
  }
  return { projected, audit: { version: AUTHORITY_SUPPORT_CONTEXT_VERSION, inferredFacts: 0,
    operation: 'EXISTING_TASK_SUPPORT_TO_LEGACY_INFORMATION_INDEX', changes, original } }
}
