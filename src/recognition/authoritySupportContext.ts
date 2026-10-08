import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import type { SingleAuthorityFacts } from './sourceContractV5'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const AUTHORITY_SUPPORT_CONTEXT_VERSION = 'authority-support-context-1.0.0'
export const AUTHORITY_TYPED_SUPPORT_CONTEXT_VERSION = 'authority-support-context-1.1.0'
const text = (s: string) => s.replace(/[\s，。；,:：;！!]/gu, '')
const check = (ok: unknown) => { if (!ok) throw Error('AUTHORITY_SUPPORT_CONTEXT_REFERENCE') }

/** A model's information row can name an existing task as context, not as a
 * new action. Keep the original declaration in audit; derive the legacy empty
 * information index only for literal, independently grounded support. */
export function projectAuthoritySupportContext(input: unknown, context: WireContext, allowTypedSupport = false) {
  const original = plainJson(input) as SingleAuthorityFacts, projected = structuredClone(original)
  check(Array.isArray(projected.scopeAccounting) && Array.isArray(projected.tasks))
  const changes: Array<{ scopeId: string; taskId: string; reason: 'LITERAL_SUPPORT' | 'URL_CONTINUATION' | 'TYPED_ATTRIBUTE_SUPPORT' }> = []
  const omittedScopes: Array<{ scopeId: string; kind: 'information' | 'unresolved'; reason: 'PAIRED_STRUCTURAL_LABEL' | 'UNACCOUNTED_SCOPE' }> = []
  for (const row of projected.scopeAccounting) {
    if (row.kind !== 'information' || !row.primaryEntityIds.length) continue
    const scope = context.index.scopes.find(s => s.id === row.scopeId)
    check(scope && new Set(row.primaryEntityIds).size === row.primaryEntityIds.length)
    for (const id of row.primaryEntityIds) {
      const task = original.tasks.find(t => t.id === id)
      if (!task && allowTypedSupport) {
        const point = original.timePoints.find(p => p.tempId === id)
        const event = original.events.find(e => e.tempId === id)
        // This changes only the legacy information index. The real entity,
        // owners and their separate source/type checks remain intact downstream.
        const timeSupport = point && point.scopeIds.includes(row.scopeId)
          && hasLiteralScopeSpan(point.rawText, point.scopeIds.filter(s => context.index.scopes.find(v => v.id === s)?.text && !/^[^\d]*[:：]$/u.test(context.index.scopes.find(v => v.id === s)!.text)), context)
        const eventSupport = event && event.scopeIds.includes(row.scopeId)
          && event.attributes.some(a => a.scopeIds.includes(row.scopeId) && hasLiteralScopeSpan(a.text, a.scopeIds, context))
        check(timeSupport || eventSupport)
        changes.push({ scopeId: row.scopeId, taskId: id, reason: 'TYPED_ATTRIBUTE_SUPPORT' })
        continue
      }
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
        .some(c => text(c).includes(literal.replace(allowTypedSupport ? /^(?:并)?确保/u : /^并/u, '')))
      const condition = task!.condition.value === 'unknown' && task!.condition.conditionScopeIds.includes(row.scopeId)
        && (allowTypedSupport ? /如|若|如果|仅|条件|尚未|有意|感兴趣|符合|适用|资格|被录取/u : /如|若|如果|仅|条件|尚未/u).test(scope!.text) && text(task!.detail.description).includes(literal)
      const classification = /^视同[^，。；]{1,40}管理[，。；]$/u.test(scope!.text)
        && previous && task!.condition.value === 'unknown' && task!.condition.conditionScopeIds.includes(previous.id)
        && task!.propositionScopeIds.includes(previous.id) && text(task!.detail.description).includes(literal)
      const supported = literal.length > 0 && (completion || condition || classification)
      const punctuatedCondition = allowTypedSupport && task!.condition.value === 'unknown' && task!.condition.conditionScopeIds.includes(row.scopeId)
        && /有意|感兴趣|符合|适用|资格|被录取/u.test(scope!.text)
        && text(task!.detail.description).replace(/[（）()“”"]/gu, '').includes(literal.replace(/[（）()“”"]/gu, ''))
      check(url || supported || punctuatedCondition)
      changes.push({ scopeId: row.scopeId, taskId: id, reason: url ? 'URL_CONTINUATION' : 'LITERAL_SUPPORT' })
    }
    row.primaryEntityIds = []
  }
  if (allowTypedSupport) for (const scope of context.index.scopes) {
    if (projected.scopeAccounting.some(r => r.scopeId === scope.id)) continue
    const next = context.index.scopes.find(s => s.order === scope.order + 1)
    const heading = scope.text.match(/^\*\*(时间|地点|报名)\*\*$/u)?.[1]
    const paired = next && (heading === '时间' ? original.timePoints.some(p => p.scopeIds.includes(next.id))
      : heading === '地点' ? original.events.some(e => e.scopeIds.includes(next.id) && !!e.location?.trim() && next.text.includes(e.location))
      : heading === '报名' ? original.tasks.some(t => t.propositionScopeIds.includes(next.id) && t.action.scopeId === next.id)
      : scope.text === '活动信息' && next.text === '**时间**' && original.events.length > 0)
    const kind = paired ? 'information' as const : 'unresolved' as const
    projected.scopeAccounting.push({ scopeId: scope.id, kind, primaryEntityIds: [] })
    omittedScopes.push({ scopeId: scope.id, kind, reason: paired ? 'PAIRED_STRUCTURAL_LABEL' : 'UNACCOUNTED_SCOPE' })
  }
  return { projected, audit: { version: allowTypedSupport ? AUTHORITY_TYPED_SUPPORT_CONTEXT_VERSION : AUTHORITY_SUPPORT_CONTEXT_VERSION, inferredFacts: 0,
    operation: 'EXISTING_TASK_SUPPORT_TO_LEGACY_INFORMATION_INDEX', changes, omittedScopes, original } }
}
