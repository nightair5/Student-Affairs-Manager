import { createObligationFixture } from './obligationFixtures'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { ROLE_AUTHORITY_VERSION, type RoleAuthorityFacts } from '../../recognition/sourceContractV7'
import type { ObligationAuthorityFacts } from '../../recognition/sourceContractV6'
export function toRoleFixture(f: ObligationAuthorityFacts): RoleAuthorityFacts {
  return { ...structuredClone(f), schemaVersion: ROLE_AUTHORITY_VERSION, tasks: f.tasks.map(t => {
    const { modality, ...semantics } = t.semantics
    return { ...structuredClone(t), semantics, participation: { mode: modality, scopeIds: [...t.propositionScopeIds] }, executionChannel: null }
  }) }
}
export const roleEnvelope = (f: RoleAuthorityFacts) => JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(f) }] }], usage: { input_tokens: 0, output_tokens: 0 } })
export async function createRoleFixture() {
  const old = await createObligationFixture('registration')
  const sourceText = old.sourceText.replace('请于', '有意参加者可于').replace('报名制图讲座', '通过报名二维码报名制图讲座')
  const context = { ...old.context, index: await indexImmutableScopesV11('role-fixture-optional-channel', 'role-fixture-optional-channel-v1', sourceText) }
  let serialized = JSON.stringify(toRoleFixture(old.facts))
  old.context.index.scopes.forEach((s, i) => { serialized = serialized.replaceAll(s.id, context.index.scopes[i].id) })
  const facts = JSON.parse(serialized) as RoleAuthorityFacts, t = facts.tasks[0]
  t.participation = { mode: 'optional', scopeIds: [...t.propositionScopeIds] }
  t.executionChannel = { surface: '报名二维码', scopeIds: [...t.propositionScopeIds] }
  return { sourceText, context, facts, rawHttpText: roleEnvelope(facts), role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' }
}
