import { createContractFixture } from '../d26Recorded/contractFixtures'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'

/** Source expectations precede the converter repair; authored engineering inputs, never model answers. */
export const ELIGIBILITY_CASES = [
  { id: 'approved-application', object: '场地申请', rule: '本轮场地申请仅限获准社团。', fact: '你的社团已获准。', value: 'true', expected: 'SOURCE_PROVEN_TRUE' },
  { id: 'licensed-application', object: '经费申请', rule: '本次经费申请只限已获得许可的社团。', fact: '你的社团已经获得许可。', value: 'true', expected: 'SOURCE_PROVEN_TRUE' },
  { id: 'eligibility-unannounced', object: '场地申请', rule: '本轮场地申请仅限获准社团。', fact: '你的社团是否获准尚未公布。', value: 'unknown', expected: 'RETAIN_REVIEW' },
  { id: 'contradicted-approval', object: '经费申请', rule: '本次经费申请只限已获得许可的社团。', fact: '你的社团尚未获得许可。', value: 'true', expected: 'RETAIN_REVIEW' },
] as const
export type EligibilityCaseId = typeof ELIGIBILITY_CASES[number]['id']

export async function createEligibilityFixture(id: EligibilityCaseId, reverse = false) {
  const row = ELIGIBILITY_CASES.find(c => c.id === id)!
  const base = await createContractFixture('mixed')
  const body = base.sourceText.replaceAll('器材清单', row.object)
  const prefix = row.rule + row.fact
  const sourceText = reverse ? body + prefix : prefix + body
  const sourceId = 'eligibility-' + id + (reverse ? '-reordered' : '')
  const context = { ...base.context, index: await indexImmutableScopesV11(sourceId, sourceId + '-v1', sourceText) }
  let serialized = JSON.stringify(base.facts).replaceAll('器材清单', row.object)
  const used = new Set<string>()
  for (const old of base.context.index.scopes) {
    const scope = context.index.scopes.find(s => !used.has(s.id) && s.text === old.text.replaceAll('器材清单', row.object))!
    used.add(scope.id); serialized = serialized.replaceAll(old.id, scope.id)
  }
  const facts: typeof base.facts = JSON.parse(serialized)
  const rule = context.index.scopes.find(s => s.text === row.rule)!, fact = context.index.scopes.find(s => s.text === row.fact)!
  facts.tasks[0].condition = { value: row.value, conditionScopeIds: [rule.id], factScopeIds: [fact.id] }
  facts.tasks[0].propositionScopeIds.push(rule.id, fact.id)
  facts.scopeAccounting.push(...[rule, fact].map(s => ({ scopeId: s.id, kind: 'information' as const, primaryEntityIds: [], secondaryEntityIds: [] })))
  const envelope = JSON.parse(base.rawHttpText)
  envelope.output[0].content[0].text = JSON.stringify(facts)
  return { ...base, kind: id, sourceText, context, facts, rawHttpText: JSON.stringify(envelope), expected: row.expected, role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const }
}
