import type { SemanticInput } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'

export const ELIGIBILITY_GROUNDING_VERSION = 'source-proven-eligibility-1.1.0' as const
export interface EligibilityDecision {
  taskId: string
  declaredValue: SemanticInput['tasks'][number]['condition']['value']
  status: 'SOURCE_PROVEN_TRUE' | 'RETAIN_REVIEW'
  ruleScopeIds: string[]
  factScopeIds: string[]
  contradictoryScopeIds: string[]
  reason: string
}
const text = (s: string) => s.replace(/[\s，。；！]/gu, '')
const predicate = (s: string) => /获准|批准/u.test(s) ? (s.includes('获准') ? '获准' : '批准') : '许可'
const approval = '(?:获准|批准|获得许可|获许可)'
const rulePattern = new RegExp(`^(?:本轮|本次)?(.+?)(?:仅限|只限)(?:已)?(${approval})(?:的)?社团$`, 'u')
const factPattern = new RegExp(`^你的社团(?:已经|已)(${approval})$`, 'u')
const negativePattern = new RegExp(`^你的社团(?:尚未|还未|未|没有)(${approval})$`, 'u')
const revokedPattern = /^你的社团(?:的)?(许可|批准|获准资格)(?:已经|已)?(?:撤销|取消|失效)$/u

/** Validate an already-declared true fact. Never promote unknown/false or infer completion. */
export function groundEligibility(input: SemanticInput, context: WireContext) {
  const get = (ids: string[]) => ids.flatMap(id => context.index.scopes.find(s => s.id === id) ?? [])
  const decisions: EligibilityDecision[] = input.tasks.filter(t => t.condition.value !== 'not_applicable').map(task => {
    const rules = get(task.condition.conditionScopeIds), facts = get(task.condition.factScopeIds)
    const matches = rules.map(s => rulePattern.exec(text(s.text)))
    const sameObject = rules.length > 0 && matches.every(m => m && m[1] === task.object.surface)
    const predicates = matches.flatMap(m => m ? [predicate(m[2])] : [])
    const expected = predicates[0]
    const supported = facts.length > 0 && facts.every(s => {
      const match = factPattern.exec(text(s.text))
      return match && predicate(match[1]) === expected
    })
    const contradictory = context.index.scopes.filter(s => {
      const negative = negativePattern.exec(text(s.text)), revoked = revokedPattern.exec(text(s.text))
      return expected && ((negative && predicate(negative[1]) === expected) || (revoked && predicate(revoked[1]) === expected))
    }).map(s => s.id)
    const current = task.inferenceLevel === 'explicit' && ['addressee', 'addressed_group'].includes(task.semantics.actor)
      && task.semantics.speechAct === 'directive' && task.semantics.polarity === 'affirmative'
      && task.semantics.status === 'pending' && task.semantics.validity === 'active' && task.semantics.modality === 'required'
    const proved = task.condition.value === 'true' && current && sameObject && new Set(predicates).size === 1
      && supported && contradictory.length === 0
      && task.condition.conditionScopeIds.length === rules.length && task.condition.factScopeIds.length === facts.length
    return { taskId: task.id, declaredValue: task.condition.value, status: proved ? 'SOURCE_PROVEN_TRUE' : 'RETAIN_REVIEW',
      ruleScopeIds: [...task.condition.conditionScopeIds], factScopeIds: [...task.condition.factScopeIds], contradictoryScopeIds: contradictory,
      reason: proved ? '原答声明资格成立，同对象许可规则与本人的明确获准事实一致；保留依据，不要求重复核对。'
        : task.condition.value === 'unknown' ? task.condition.conditionScopeIds.length===0&&task.condition.factScopeIds.length===0
          ? '原答标记适用条件未知，但没有给出条件依据；不能据此认定资格不足，也不能自动认定没有条件。'
          : '资格尚未确认，不能当成已符合；请保留待核对。'
          : task.condition.value === 'false' ? '原文明确当前不适用，不创建执行任务。'
            : '资格成立声明缺少同对象、同许可或无矛盾的明确事实；请核对资格依据。' }
  })
  return { version: ELIGIBILITY_GROUNDING_VERSION, role: 'PROGRAM_SOURCE_CHECK_NOT_NEW_MODEL_OUTPUT' as const, inferredFacts: 0 as const, decisions }
}
