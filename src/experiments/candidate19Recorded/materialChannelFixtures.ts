import { createContractFixture } from '../d26Recorded/contractFixtures'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'

/** Authored before the repair; expectations are source roles, not converter outputs. */
export const CHANNEL_ROLE_CASES = [
  { id: 'object-first', object: '器材清单', channel: '星槎入口', clause: '器材清单请提交到星槎入口。', expected: 'EXPLICIT_CHANNEL' },
  { id: 'handover', object: '器材清单', channel: '资料门户', clause: '请把器材清单交到资料门户。', expected: 'EXPLICIT_CHANNEL' },
  { id: 'receipt-after', object: '器材清单', channel: '资料门户', clause: '请通过资料门户提交器材清单并保留回执。', expected: 'EXPLICIT_CHANNEL' },
  { id: 'other-object', object: '场地申请', channel: '研学站', clause: '请经由研学站递交场地申请并等待受理。', expected: 'EXPLICIT_CHANNEL' },
  { id: 'prohibited-wu', object: '器材清单', channel: '资料门户', clause: '请勿通过资料门户提交器材清单。', expected: 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL' },
  { id: 'prohibited-cannot', object: '器材清单', channel: '资料门户', clause: '不能通过资料门户提交器材清单。', expected: 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL' },
  { id: 'prohibited-may-not', object: '器材清单', channel: '资料门户', clause: '不可通过资料门户提交器材清单。', expected: 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL' },
  { id: 'prohibited-should-not', object: '器材清单', channel: '资料门户', clause: '不应通过资料门户提交器材清单。', expected: 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL' },
  { id: 'foreign-object', object: '器材清单', channel: '资料门户', clause: '请通过资料门户提交活动照片。', expected: 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL' },
  { id: 'conditional', object: '器材清单', channel: '资料门户', clause: '如果通过资料门户提交器材清单，请等待通知。', expected: 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL' },
  { id: 'contradiction', object: '器材清单', channel: '资料门户', clause: '请通过资料门户提交器材清单。不得通过资料门户提交器材清单。', expected: 'UNSUPPORTED_OR_AMBIGUOUS_CHANNEL' },
  { id: 'affirmative-after-other-ban', object: '器材清单', channel: '资料门户', clause: '不要通过旧邮箱提交器材清单。请通过资料门户提交器材清单。', expected: 'EXPLICIT_CHANNEL' },
] as const
export type ChannelRoleCaseId = typeof CHANNEL_ROLE_CASES[number]['id']

/** Real v4 wire and graph, with one material obligation plus unrelated independent events. */
export async function createChannelRoleFixture(id: ChannelRoleCaseId, reverse = false) {
  const example = CHANNEL_ROLE_CASES.find(row => row.id === id)!
  const base = await createContractFixture('mixed')
  const body = base.sourceText.replaceAll('器材清单', example.object)
  const sourceText = reverse ? example.clause + body : body + example.clause
  const sourceId = 'channel-role-' + id + (reverse ? '-reordered' : '')
  const context = { ...base.context, index: await indexImmutableScopesV11(sourceId, sourceId + '-v1', sourceText) }
  let json = JSON.stringify(base.facts).replaceAll('器材清单', example.object)
  const used = new Set<string>()
  for (const scope of base.context.index.scopes) {
    const next = context.index.scopes.find(row => !used.has(row.id) && row.text === scope.text.replaceAll('器材清单', example.object))
    if (!next) throw Error('CHANNEL_FIXTURE_REBIND')
    used.add(next.id); json = json.replaceAll(scope.id, next.id)
  }
  const facts: typeof base.facts = JSON.parse(json)
  const additional = context.index.scopes.filter(scope => !used.has(scope.id)).map(scope => scope.id)
  const task = facts.tasks[0], material = facts.materials[0]
  task.propositionScopeIds.push(...additional)
  material.scopeIds.push(...additional); material.submissionChannel = example.channel
  task.coverage.material.scopeIds.push(...additional)
  facts.scopeAccounting.push(...additional.map(scopeId => ({ scopeId, kind: 'action' as const, primaryEntityIds: [task.id], secondaryEntityIds: [material.tempId] })))
  const envelope = JSON.parse(base.rawHttpText)
  envelope.output[0].content[0].text = JSON.stringify(facts)
  return { ...base, kind: id, sourceText, facts, context, rawHttpText: JSON.stringify(envelope), expected: example.expected, channel: example.channel }
}
