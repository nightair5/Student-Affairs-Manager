import type { RecognitionResult } from './types'
import type { D26SemanticSidecar } from './firstSuggestionD26'
import type { WireContext } from '../experiments/realInput01/modelWire'
export const OPTIONAL_PARTICIPATION_VERSION = 'literal-optional-participation-1.0.0'
export function retainOptionalParticipation(input: RecognitionResult, sidecar: D26SemanticSidecar, context: WireContext) {
  const result = structuredClone(input), gaps = [...sidecar.representationGaps]
  const decisions: Array<{ taskId: string; removedConflictIds: string[]; selected: false }> = []
  for (const t of sidecar.firstSemantic.tasks) {
    const s = t.semantics, quoted = t.propositionScopeIds.flatMap(id => context.index.scopes.find(p => p.id === id)?.text ?? [])
    const literalOptional = quoted.some(q => /有意参加|自愿|感兴趣|可(?:以)?(?:通过.{0,30})?报名/u.test(q)
      && !/请勿|不要|不得|禁止|不可以/u.test(q))
    if (s.modality !== 'optional' || !literalOptional || s.status !== 'pending' || s.validity !== 'active' || s.polarity !== 'affirmative'
      || !['addressee', 'addressed_group'].includes(s.actor) || !['present', 'future'].includes(s.tense) || s.speechAct !== 'directive') continue
    const removable = gaps.flatMap((g, i) => g.kind === 'lifecycle' && g.entityIds.length === 1 && g.entityIds[0] === t.id ? ['d26-representation-' + i] : [])
    result.conflicts = result.conflicts.filter(c => !removable.includes(c.id))
    const task = result.standaloneTasks.find(v => v.tempId === t.id)
    if (task) { task.selected = false; task.inferenceLevel = 'optional_suggestion' }
    decisions.push({ taskId: t.id, removedConflictIds: removable, selected: false })
  }
  const removed = new Set(decisions.flatMap(d => d.removedConflictIds)), representationGaps = gaps.filter((_, i) => !removed.has('d26-representation-' + i))
  const retainedLifecycle = representationGaps.some(g => g.kind === 'lifecycle')
  if (!retainedLifecycle) result.quality.reviewReasons = result.quality.reviewReasons.filter(r => r !== '当前状态、执行人或义务类型不能由普通任务字段完整表达。')
  result.quality.needsHumanReview = result.conflicts.some(c => c.requiresDecision) || result.quality.reviewReasons.length > 0
  return { result, representationGaps, audit: { version: OPTIONAL_PARTICIPATION_VERSION, inferredFacts: 0, decisions } }
}
