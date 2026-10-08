import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeObligationProductRecording, type ObligationAuthorityFacts } from './sourceContractV6'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'
import { projectAuthoritySupportContext } from './authoritySupportContext'
import type { SingleAuthorityFacts } from './sourceContractV5'

interface Observed { sourceId: string; sourceText: string; referenceTime: string; timezone: string; cohort: string; wire: ObligationAuthorityFacts }
const observations: Observed[] = JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/autonomous-v6/PRODUCT_DIAGNOSTIC.json', 'utf8')).cases.filter((r: Observed) => r.cohort === 'CURRENT_V6')
const envelope = (wire: ObligationAuthorityFacts) => JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(wire) }] }], usage: { input_tokens: 0, output_tokens: 0 } })
const context = async (r: Observed) => ({ index: await indexImmutableScopesV11(r.sourceId, r.sourceId + '-v1', r.sourceText), referenceTime: r.referenceTime, timezone: r.timezone })

describe('settled V6 wire regression through the real public product conversion', () => {
  it.each(observations)('$sourceId retains existing facts while frozen strict decoding stays rejected', async r => {
    const ctx = await context(r), before = structuredClone(r.wire), raw = envelope(r.wire)
    expect(() => decodeObligationProductRecording(raw, ctx, 'SingleAuthority')).toThrow()
    const d = decodeObligationProductRecording(raw, ctx, 'SingleAuthority', true)
    expect(d.result.standaloneTasks).toHaveLength(r.wire.tasks.length)
    expect(d.result.events).toHaveLength(r.wire.events.length)
    expect(d.result.materials).toHaveLength(r.wire.materials.length)
    expect(d.result.timePoints).toHaveLength(r.wire.timePoints.length)
    expect(d.sidecar.originalResponse).toBe(raw)
    expect(d.sidecar.obligationAuthorityAudit.original).toEqual(before)
    expect(d.sidecar.obligationAuthorityAudit.inferredFacts).toBe(0)
    expect(r.wire).toEqual(before)
  })
  it('does not turn inconsistent registration/acceptance links into usable relationships or device deadlines', async () => {
    const r = observations[2], ctx = await context(r), d = decodeObligationProductRecording(envelope(r.wire), ctx, 'SingleAuthority', true)
    expect(d.result.events[0].relatedTaskTempIds).not.toContain('task-register')
    expect(d.result.standaloneTasks.every(t => !t.selected)).toBe(true)
    expect(d.sidecar.obligationAuthorityAudit.localRelations.quarantinedRelations).toHaveLength(1)
    expect(d.sidecar.obligationAuthorityAudit.localRelations.quarantinedPrerequisites).toHaveLength(1)
    expect(d.result.timePoints.some(p => p.type === 'task_deadline' && p.relatedTaskTempIds.includes('task-prepare-device'))).toBe(false)
    expect(d.result.timePoints.filter(p => p.type === 'event_start' || p.type === 'event_end').map(p => p.normalizedValue)).toEqual(['2026-07-06', '2026-07-10'])
    const fake = structuredClone(r.wire); fake.tasks[0].eventLinks[0].eventId = 'fake'
    expect(() => decodeObligationProductRecording(envelope(fake), ctx, 'SingleAuthority', true)).toThrow('EVENT_LINK_REFERENCE')
  })
  it('retains a literal window date while unresolved owners remain blocked; wrong dates are not normalized', async () => {
    const r = observations[0], ctx = await context(r), d = decodeObligationProductRecording(envelope(r.wire), ctx, 'SingleAuthority', true)
    expect(d.result.timePoints.map(p => p.normalizedValue)).toEqual(['2026-08-13', '2026-08-27'])
    expect(d.result.timePoints.every(p => p.precision === 'date_only' && p.needsConfirmation)).toBe(true)
    expect(d.result.standaloneTasks.every(t => !t.selected)).toBe(true)
    expect(d.result.conflicts.filter(c => c.id.startsWith('source-window:'))).toHaveLength(2)
    const changed = structuredClone(r.wire); changed.timePoints[0].rawText = '8月12—27日'
    expect(() => decodeObligationProductRecording(envelope(changed), ctx, 'SingleAuthority', true)).toThrow('REFERENCE')
  })
  it('composes already cited adjacent date and clock endpoints without guessing an owner or changing the original', async () => {
    const r = observations[3], ctx = await context(r), d = decodeObligationProductRecording(envelope(r.wire), ctx, 'SingleAuthority', true)
    expect(d.result.timePoints.filter(p => p.type === 'event_start' || p.type === 'event_end').map(p => p.normalizedValue))
      .toEqual(['2026-10-12T12:30', '2026-10-12T14:00'])
    expect(d.sidecar.obligationAuthorityAudit.original).toEqual(r.wire)
    const wrong = structuredClone(r.wire); wrong.timePoints[1].rawText = '2026年10月13日（周一）12:30-14:00'
    const rejectedValue = decodeObligationProductRecording(envelope(wrong), ctx, 'SingleAuthority', true)
    expect(rejectedValue.result.timePoints[1].normalizedValue).toBeNull()
    expect(rejectedValue.result.timePoints[1].needsConfirmation).toBe(true)
  })
  it('accepts one literal across adjacent clauses but rejects a changed value, foreign scope and unrelated extra span', async () => {
    const index = await indexImmutableScopesV11('literal-independent', 'v1', '主办方提供30份午餐，按报名顺序领取。另需提交健康声明。')
    const ctx = { index, referenceTime: '2026-10-08T09:00:00+08:00', timezone: 'Asia/Shanghai' }
    expect(hasLiteralScopeSpan('主办方提供30份午餐，按报名顺序领取', [index.scopes[0].id, index.scopes[1].id], ctx)).toBe(true)
    expect(hasLiteralScopeSpan('主办方提供50份午餐，按报名顺序领取', [index.scopes[0].id, index.scopes[1].id], ctx)).toBe(false)
    expect(hasLiteralScopeSpan('主办方提供30份午餐，按报名顺序领取', [index.scopes[0].id, index.scopes[1].id, index.scopes[2].id], ctx)).toBe(false)
    expect(hasLiteralScopeSpan('主办方提供30份午餐', ['foreign'], ctx)).toBe(false)
  })
  it('missing meaningful scope remains unresolved; a fake typed information owner is never accepted', async () => {
    const r = observations[1], ctx = await context(r)
    const facts = { ...structuredClone(r.wire), schemaVersion: 'single-authority-source-contract-5.0.0' } as unknown as SingleAuthorityFacts
    facts.scopeAccounting = facts.scopeAccounting.filter(row => row.scopeId !== ctx.index.scopes[2].id)
    const p = projectAuthoritySupportContext(facts, ctx, true)
    expect(p.audit.omittedScopes).toContainEqual(expect.objectContaining({ kind: 'unresolved', reason: 'UNACCOUNTED_SCOPE' }))
    const fake = structuredClone(facts); fake.scopeAccounting.find(row => row.kind === 'information')!.primaryEntityIds = ['fake-point']
    expect(() => projectAuthoritySupportContext(fake, ctx, true)).toThrow('REFERENCE')
  })
})
