import type { WireContext } from '../experiments/realInput01/modelWire'
import type { RoleAuthorityFacts } from './sourceContractV7'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const PARTICIPATION_SUPPORT_VERSION = 'participation-condition-support-projection-1.1.0'
type Task = RoleAuthorityFacts['tasks'][number]
type Mode = Task['participation']['mode']
type Decision = {
  taskId: string
  before: string[]
  after: string[]
  addedScopeIds: string[]
  reason: 'EXISTING_TASK_CONDITION_PARTICIPATION_SUPPORT' | 'NO_MISSING_REFERENCE' | 'UNSUPPORTED_REFERENCE_RETAINED'
}
const compact = (s: string) => s.replace(/\s/gu, '')
const negativeOrAmbiguous = /不要|不得|不能|不可|无需|无须|不需|不须|不必|勿|禁止|取消|并非|不是|未要求|不要求|不允许|不可以|不应|不一定|未必|尚未|未确定|是否|能否|可否|待确认/u
const genericPredicate = /^(?:参与|参加|报名|办理|处理|兑换|领取)?(?:事项|事情|活动|业务|此事|该事|上述事项)?$/u

/** This is an evidence-index projection, not a modality/eligibility classifier.
 * Only an already declared condition of this exact task can contribute its
 * existing participation proof. Other scopes remain for the strict decoder. */
function participationPredicate(text: string, mode: Mode): string | null {
  const clause = compact(text).replace(/[。；！!]+$/u, '')
  if (negativeOrAmbiguous.test(clause) || /[，,。；;？！!?]/u.test(clause)) return null
  const match = mode === 'optional'
    ? clause.match(/(?:即可|可以|可)(?:自愿)?(?:参与|参加)?(.+)$/u)
    : mode === 'required' ? clause.match(/(?:必须|须|需|应当|应)(?:参与|参加)?(.+)$/u) : null
  const predicate = match?.[1]
  // A bare business verb such as 兑换 is acceptable only with the task's
  // cited business context below; generic 参与/办理 cannot establish an owner.
  if (!predicate || predicate.length < 2 || genericPredicate.test(predicate) && predicate !== '兑换' && predicate !== '领取') return null
  return predicate
}

function supportsTask(scopeId: string, task: Task, context: WireContext): boolean {
  const scope = context.index.scopes.find(s => s.id === scopeId)
  if (!scope || !task.condition.conditionScopeIds.includes(scopeId)) return false
  const predicate = participationPredicate(scope.text, task.participation.mode)
  if (!predicate) return false
  if (!hasLiteralScopeSpan(task.object.surface, [task.object.scopeId], context)
    || !hasLiteralScopeSpan(task.action.surface, [task.action.scopeId], context)) return false
  const object = compact(task.object.surface), action = compact(task.action.surface)
  const proposition = task.propositionScopeIds.map(id => context.index.scopes.find(s => s.id === id))
  if (proposition.some(s => !s)) return false
  // An explicit predicate has its own object. A background mention of that
  // other object cannot establish participation for this task's object.
  if (predicate === object || predicate === action + object || predicate === object + action) return true
  if (predicate !== '兑换' && predicate !== '领取') return false
  // Bare service verbs need both a bounded handling label already owned by
  // this task and a literal business-object heading. Arbitrary background
  // proposition text (e.g. "并了解兑换") provides neither binding.
  const handlingLabel = new RegExp('^(?:\\d+[.、])?(?:线上|线下|网上|现场)?' + predicate + '(?:时间|时段|窗口|要求|步骤|入口)[：:]?$', 'u')
  const handlingContext = proposition.some(s => handlingLabel.test(compact(s!.text)))
  const objectScope = context.index.scopes.find(s => s.id === task.object.scopeId)
  const literalObject = object.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const objectHeading = object === predicate
    ? new RegExp('^' + predicate + '(?:要求|步骤|入口|时间|时段|窗口)[：:]?$', 'u')
    : new RegExp('^' + literalObject + '(?:兑换及领取|领取及兑换|' + predicate + ')(?:地点|要求|步骤|入口|时间|时段|窗口)[：:]?$', 'u')
  return handlingContext && !!objectScope && objectHeading.test(compact(objectScope.text))
}

export function projectParticipationSupport(input: RoleAuthorityFacts, context: WireContext) {
  const projected = structuredClone(input)
  const decisions: Decision[] = projected.tasks.map(task => {
    const before = [...task.propositionScopeIds]
    const missing = task.participation.scopeIds.filter(id => !before.includes(id))
    const supported = missing.length > 0
      && ['optional', 'required'].includes(task.participation.mode)
      && task.participation.scopeIds.length === new Set(task.participation.scopeIds).size
      && task.participation.scopeIds.every(id => context.index.scopes.some(s => s.id === id))
      && missing.every(id => supportsTask(id, task, context))
    if (supported) task.propositionScopeIds = [...new Set([...before, ...missing])]
    return { taskId: task.id, before, after: [...task.propositionScopeIds], addedScopeIds: supported ? missing : [],
      reason: !missing.length ? 'NO_MISSING_REFERENCE' : supported ? 'EXISTING_TASK_CONDITION_PARTICIPATION_SUPPORT' : 'UNSUPPORTED_REFERENCE_RETAINED' }
  })
  return { projected, audit: { version: PARTICIPATION_SUPPORT_VERSION, operation: 'EXISTING_TYPED_SUPPORT_TO_PROPOSITION_INDEX', inferredFacts: 0, decisions } }
}
