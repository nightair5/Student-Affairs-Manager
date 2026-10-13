import type { WireContext } from '../experiments/realInput01/modelWire'
import type { SingleAuthorityFacts } from './sourceContractV5'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const SHARED_REQUIREMENT_SUPPORT_VERSION = 'declared-shared-requirement-support-1.0.0'
type BaseTask = SingleAuthorityFacts['tasks'][number]
interface SharedRequirementFacts {
  tasks: Array<Pick<BaseTask, 'id' | 'action' | 'object' | 'propositionScopeIds'> & {
    semantics: Pick<BaseTask['semantics'], 'speechAct' | 'polarity' | 'validity'> & { modality?: string }
    participation?: { mode: string; scopeIds: string[] }
  }>
  timePoints: SingleAuthorityFacts['timePoints']
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
const compact = (s: string) => s.replace(/\s/gu, '')

/** An already cited shared requirement can repeat the same obligations.
 * Bind every named variant to exactly one existing action/object or its own
 * literal time label. No background prose, omitted entity or new verb binds it. */
export function supportsSharedRequirement(facts: SharedRequirementFacts, scopeId: string, ids: string[], context: WireContext): boolean {
  const scope = context.index.scopes.find(s => s.id === scopeId)
  if (!scope || ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length) return false
  const clause = compact(scope.text)
  if (/不要|不得|无需|不必|不需|禁止|取消|未|若|如果|除非|仅|是否|或者|或|不再/u.test(clause)) return false
  const match = clause.match(/^([^，。；]{2,80})(?:均|都)(?:需|须|必须)(提交|上传|领取|准备|缴纳|完成|签署|打印|办理|发送)[，。；]?$/u)
  if (!match) return false
  const subjects = match[1].split(/和|与|及|、/u), verb = match[2]
  if (subjects.length !== ids.length || subjects.some(s => !s) || new Set(subjects).size !== subjects.length) return false
  const tasks = ids.map(id => facts.tasks.find(t => t.id === id))
  if (tasks.some(t => !t)) return false
  const last = subjects.at(-1)!
  const suffixes = Array.from({ length: Math.min(16, last.length) }, (_, i) => last.slice(-(i + 1)))
  const noun = suffixes.reverse().find(s => tasks.every(t => compact(t!.object.surface).includes(s)))
  if (!noun || noun.length < 2) return false
  const qualifiers = subjects.map(s => s.endsWith(noun) ? s.slice(0, -noun.length) : s)
  if (qualifiers.some(q => !q)) return false
  const bindings = qualifiers.map(q => tasks.filter(task => {
    const t = task!
    const participation = t.participation
    const required = participation ? participation.mode === 'required' && Array.isArray(participation.scopeIds)
      && participation.scopeIds.includes(scopeId) : t.semantics.modality === 'required'
    if (!required || !t.propositionScopeIds.includes(scopeId)
      || t.semantics.speechAct !== 'directive' || t.semantics.polarity !== 'affirmative'
      || t.semantics.validity !== 'active'
      || !hasLiteralScopeSpan(t.action.surface, [t.action.scopeId], context)
      || !hasLiteralScopeSpan(t.object.surface, [t.object.scopeId], context)
      || !new RegExp('^(?:请|须|需)?' + escape(verb), 'u').test(compact(t.action.surface))) return false
    const object = compact(t.object.surface)
    if (new RegExp('^' + escape(q) + '.{0,12}' + escape(noun) + '(?:PDF|DOCX|TXT)?$', 'u').test(object)) return true
    return facts.timePoints.some(p => p.owners.length === 1 && p.owners[0].kind === 'task'
      && p.owners[0].entityId === t.id && hasLiteralScopeSpan(p.rawText, p.scopeIds, context)
      && new RegExp('^' + escape(q) + escape(verb) + '(?:截止时间|截止|时间)', 'u').test(compact(p.rawText)))
  }).map(t => t!.id))
  return bindings.every(b => b.length === 1) && new Set(bindings.flat()).size === ids.length
}
