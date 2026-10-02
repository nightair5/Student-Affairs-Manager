import type { SemanticInput } from '../mainline04/semanticContract'
export const FIRST_SUGGESTION_GUARD_VERSION = 'first-suggestion-guard-1.0.0'
export interface FirstSuggestionIssue { code: string; taskIds: string[]; entityIds: string[] }
/** Detect inconsistency without choosing a side, fabricating an endpoint, or changing raw facts. */
export function inspectFirstSuggestion(input: SemanticInput): FirstSuggestionIssue[] {
  const issues: FirstSuggestionIssue[] = []
  const issue = (code: string, taskIds: string[], entityIds: string[]) => issues.push({ code, taskIds, entityIds })
  for (const t of input.tasks) {
    if (['true', 'false'].includes(t.condition.value) && !t.condition.factScopeIds.length) issue('CONDITION_TRUTH_WITHOUT_FACT', [t.id], [t.id])
    for (const id of t.detail.timePointTempIds) {
      const p = input.timePoints.find(p => p.tempId === id)
      if (!p || !p.relatedTaskTempIds.includes(t.id)) issue('TIME_EDGE_DISAGREEMENT', [t.id], [t.id, id])
    }
    for (const id of t.detail.dependencyTempIds) if (!input.tasks.some(p => p.id === id)) issue('PREREQUISITE_ENDPOINT_MISSING', [t.id], [t.id, id])
  }
  for (const p of input.timePoints) for (const id of p.relatedTaskTempIds) if (!input.tasks.find(t => t.id === id)?.detail.timePointTempIds.includes(p.tempId)) issue('TIME_EDGE_DISAGREEMENT', [id], [id, p.tempId])
  return issues
}
export function assertFirstSuggestionSelection(input: SemanticInput, selected: readonly string[]) {
  const affectedReadSet = new Set(selected)
  let changed = true
  while (changed) {
    changed = false
    for (const task of input.tasks) if (affectedReadSet.has(task.id)) for (const id of task.detail.dependencyTempIds) if (!affectedReadSet.has(id)) { affectedReadSet.add(id); changed = true }
  }
  const issues = inspectFirstSuggestion(input).filter(i => i.taskIds.some(id => affectedReadSet.has(id)))
  if (issues.length) throw Error('D25_FACT_CONFIRMATION_BLOCKED:' + issues.map(i => i.code).join(','))
}
