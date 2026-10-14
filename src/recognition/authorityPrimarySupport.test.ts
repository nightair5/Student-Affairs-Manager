import { describe, expect, it } from 'vitest'
import { createRoleFixture, roleEnvelope } from '../experiments/candidate19Recorded/roleFixtures'
import { decodeRoleProductRecording } from './sourceContractV7'
import { projectRoleAuthority } from './sourceContractV7'
import { projectObligationAuthority } from './sourceContractV6'
import { projectAuthorityPrimarySupport } from './authorityPrimarySupport'
import { validateRecognitionResult } from './schema'

describe('typed primary and support indexes through the ordinary decoder', () => {
  it('displays existing linked activity and owned endpoints without changing the original answer', async () => {
    const x = await createRoleFixture(), facts = structuredClone(x.facts)
    const event = facts.events[0], point = facts.timePoints.find(p => p.owners.some(o => o.entityId === event.tempId))!
    const actionRow = facts.scopeAccounting.find(r => r.kind === 'action')!
    actionRow.primaryEntityIds.push(event.tempId)
    const eventRow = facts.scopeAccounting.find(r => r.kind === 'event' && point.scopeIds.includes(r.scopeId))!
    eventRow.primaryEntityIds.push(point.tempId)
    const raw = roleEnvelope(facts), decoded = decodeRoleProductRecording(raw, x.context, 'EngineeringFixture', true, true)
    expect(validateRecognitionResult(decoded.result).valid).toBe(true)
    expect(decoded.result.standaloneTasks).toHaveLength(1)
    expect(decoded.result.events).toHaveLength(1)
    expect(decoded.result.timePoints).toHaveLength(3)
    expect(decoded.sidecar.originalResponse).toBe(raw)
    expect(decoded.sidecar.authorityPrimarySupportAudit!.inferredFacts).toBe(0)
    expect(decoded.sidecar.authorityPrimarySupportAudit!.changes).toHaveLength(2)
  })
  it('rejects missing primary, nonexistent support and cross-owner support', async () => {
    const x = await createRoleFixture()
    const bridge = projectRoleAuthority(x.facts, x.context)
    const original = projectObligationAuthority(bridge.projected, x.context, true).projected
    const wrongId = structuredClone(original)
    wrongId.scopeAccounting.find(r => r.kind === 'action')!.primaryEntityIds.push('invented')
    expect(() => projectAuthorityPrimarySupport(wrongId, x.context)).toThrow('PRIMARY_SUPPORT_REFERENCE')
    const noMain = structuredClone(original), er = noMain.scopeAccounting.find(r => r.kind === 'event')!
    er.primaryEntityIds = [noMain.timePoints.find(p => p.scopeIds.includes(er.scopeId))!.tempId]
    expect(() => projectAuthorityPrimarySupport(noMain, x.context)).toThrow('PRIMARY_SUPPORT_REFERENCE')
    const wrongOwner = structuredClone(original), p = wrongOwner.timePoints.find(p => p.type === 'event_start')!
    p.owners = [{ kind: 'event_start', entityId: 'unrelated-event' }]
    wrongOwner.scopeAccounting.find(r => r.kind === 'event' && p.scopeIds.includes(r.scopeId))!.primaryEntityIds.push(p.tempId)
    expect(() => projectAuthorityPrimarySupport(wrongOwner, x.context)).toThrow('PRIMARY_SUPPORT_REFERENCE')
  })
  it('keeps missing facts and wrong dates as risks instead of inventing support', async () => {
    const x = await createRoleFixture(), facts = structuredClone(x.facts)
    const p = facts.timePoints.find(p => p.type === 'submission_deadline')!
    facts.scopeAccounting.find(r => r.kind === 'action' && p.scopeIds.includes(r.scopeId))!.primaryEntityIds.push(p.tempId)
    p.rawText = '2030年1月1日17:00前'
    expect(() => decodeRoleProductRecording(roleEnvelope(facts), x.context, 'EngineeringFixture', true, true)).toThrow('PRIMARY_SUPPORT_REFERENCE')
    facts.scopeAccounting.find(r => r.kind === 'action' && p.scopeIds.includes(r.scopeId))!.primaryEntityIds = [facts.tasks[0].id]
    facts.timePoints = facts.timePoints.filter(t => t.tempId !== p.tempId)
    const d = decodeRoleProductRecording(roleEnvelope(facts), x.context, 'EngineeringFixture', true, true)
    expect(d.sidecar.singleAuthorityAudit.localCoverage.missingCoverage).toHaveLength(0)
    // Event times still exist; no replacement deadline is synthesized.
    expect(d.result.timePoints.some(t => t.type === 'submission_deadline')).toBe(false)
  })
})
