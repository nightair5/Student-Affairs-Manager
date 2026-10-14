import { describe, expect, it } from 'vitest'
import { createObligationFixture, obligationEnvelope } from '../experiments/candidate19Recorded/obligationFixtures'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { decodeObligationProductRecording } from './sourceContractV6'

async function setup(extra = '') {
  const x = await createObligationFixture('shared-window')
  const sourceText = '请在指定时间内填写借用记录并激活借用账号。办理窗口：2026年11月10—12日。两项均在该办理窗口内完成。' + extra
  const context = { ...x.context, index: await indexImmutableScopesV11('window-reference-new', 'window-reference-new-v1', sourceText) }
  const action = context.index.scopes.find(s => s.text.includes('请在'))!.id
  const date = context.index.scopes.find(s => s.text.includes('2026年'))!.id
  const reference = context.index.scopes.find(s => s.text.includes('两项均'))!.id
  const facts = structuredClone(x.facts)
  for (const t of facts.tasks) { t.action.scopeId = action; t.object.scopeId = action; t.propositionScopeIds = [action, reference] }
  for (const p of facts.timePoints) { p.rawText = '2026年11月10—12日'; p.scopeIds = [date, reference] }
  facts.scopeAccounting = context.index.scopes.map(s => ({ scopeId: s.id, kind: s.id === action ? 'action' : 'information', primaryEntityIds: s.id === action ? facts.tasks.map(t => t.id) : [date, reference].includes(s.id) ? facts.timePoints.map(p => p.tempId) : [] }))
  return { facts, context, reference }
}
describe('explicit window citations are different from literal date spans', () => {
  it('preserves two real owners and date-only endpoints through schema and public conversion', async () => {
    const x = await setup(), d = decodeObligationProductRecording(obligationEnvelope(x.facts), x.context, 'EngineeringFixture', true, true)
    expect(d.result.standaloneTasks).toHaveLength(2)
    expect(d.result.timePoints.map(p => p.normalizedValue)).toEqual(['2026-11-10', '2026-11-12'])
    expect(d.result.timePoints.every(p => p.precision === 'date_only' && !p.needsConfirmation)).toBe(true)
    expect(d.result.standaloneTasks.every(t => t.dependencyTempIds.length === 0)).toBe(true)
    expect(d.sidecar.authoritySupportContextAudit.inferredFacts).toBe(0)
  })
  it('rejects competing ranges, unsupported dates, fake owners and unrelated citations', async () => {
    for (const fault of ['competing', 'date', 'owner', 'scope']) {
      const x = await setup(fault === 'competing' ? '另有窗口：2026年12月1—3日。' : '')
      if (fault === 'date') x.facts.timePoints[0].rawText = '2026年11月11—13日'
      if (fault === 'owner') x.facts.timePoints[0].owners = [{ kind: 'task', entityId: 'invented' }]
      if (fault === 'scope') x.facts.timePoints[0].scopeIds.push('different-source-scope')
      expect(() => decodeObligationProductRecording(obligationEnvelope(x.facts), x.context, 'EngineeringFixture', true, true)).toThrow()
    }
  })
})
