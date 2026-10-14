import { describe, it, expect } from 'vitest'
import { createRoleFixture, roleEnvelope, toRoleFixture } from '../experiments/candidate19Recorded/roleFixtures'
import { createObligationFixture } from '../experiments/candidate19Recorded/obligationFixtures'
import { buildRoleAuthorityRequest, ROLE_AUTHORITY_SCHEMA, decodeRoleProductRecording, projectRoleAuthority } from './sourceContractV7'
import { buildObligationAuthorityRequest } from './sourceContractV6'
import { validateRecognitionResult } from './schema'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

describe('single authority for participation and literal execution channel', () => {
  it('shows optional signup for the real activity; QR is a channel, never a task/material/qualification', async () => {
    const x = await createRoleFixture(), d = decodeRoleProductRecording(x.rawHttpText, x.context, 'EngineeringFixture', true, true)
    expect(validateRecognitionResult(d.result).valid).toBe(true)
    expect(d.result.standaloneTasks).toHaveLength(1)
    expect(d.result.standaloneTasks[0].description).toContain('报名二维码')
    expect(d.result.materials).toHaveLength(0)
    expect(d.result.standaloneTasks[0].selected).toBe(false)
    expect(d.result.standaloneTasks[0].inferenceLevel).toBe('optional_suggestion')
    expect(d.result.conflicts.filter(c => c.requiresDecision)).toHaveLength(0)
    expect(d.sidecar.originalResponse).toBe(x.rawHttpText)
    expect(d.sidecar.roleAuthorityAudit.decisions[0].participation.mode).toBe('optional')
    expect(d.sidecar.roleAuthorityAudit.original.tasks[0].condition.value).toBe('not_applicable')
  })
  it('rejects invented or cross-owner channel citations and duplicate modality authority', async () => {
    const x = await createRoleFixture(), f = structuredClone(x.facts)
    f.tasks[0].executionChannel!.surface = '缴费平台'
    expect(() => decodeRoleProductRecording(roleEnvelope(f), x.context)).toThrow('CHANNEL_EVIDENCE')
    const bad = JSON.parse(JSON.stringify(x.facts)); bad.tasks[0].semantics.modality = 'required'
    expect(() => decodeRoleProductRecording(roleEnvelope(bad), x.context)).toThrow('SHAPE')
    f.tasks[0].executionChannel = null; f.tasks[0].participation.scopeIds = []
    expect(() => decodeRoleProductRecording(roleEnvelope(f), x.context)).toThrow('PARTICIPATION_EVIDENCE')
  })
  it('quarantines a bad channel locally, preserves the event, and blocks accepting the affected task', async () => {
    const x = await createRoleFixture(), f = structuredClone(x.facts)
    f.tasks[0].executionChannel!.surface = '缴费平台'
    const original = roleEnvelope(f), d = decodeRoleProductRecording(original, x.context, 'EngineeringFixture', true, true)
    expect(d.result.events).toHaveLength(1)
    expect(d.result.standaloneTasks).toHaveLength(1)
    expect(d.result.standaloneTasks[0].description).not.toContain('缴费平台')
    expect(d.sidecar.originalResponse).toBe(original)
    expect(d.sidecar.roleAuthorityAudit.localChannels.quarantinedChannels).toHaveLength(1)
    expect(d.result.conflicts.some(c => c.id === 'channel-evidence-risk-0' && c.entityTempIds.includes(f.tasks[0].id))).toBe(true)
    const repo = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'局部风险',rawText:x.sourceText,provider:'manual',modelName:'FIXTURE',promptVersion:'fixture',pipelineVersion:'fixture'})
    await capture.recognize(h, async()=>d.result)
    const view = new IndexedDbWorkspaceRepository(repo), draft = (await view.load())!.drafts[0]
    const commit = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, draft))
    const read = await verifySourceReviewReadback(repo, commit)
    expect(read.events).toHaveLength(1); expect(read.tasks).toHaveLength(0)
    const current=(await view.load())!.drafts[0]
    expect(()=>buildSourceReviewPlan(read, current, current.items[0].id)).toThrow()
    f.tasks[0].executionChannel!.scopeIds = ['other-source-scope']
    expect(()=>projectRoleAuthority(f,x.context,true)).toThrow('CHANNEL_REFERENCE')
  })
  it('preserves unknown qualification, unannounced end and no invented predecessor', async () => {
    const x = await createObligationFixture('equipment'), f = toRoleFixture(x.facts)
    const d = decodeRoleProductRecording(roleEnvelope(f), x.context, 'EngineeringFixture', true, true)
    expect(d.sidecar.roleAuthorityAudit.original.tasks[0].condition.value).toBe('unknown')
    expect(d.result.standaloneTasks[0].dependencyTempIds).toEqual([])
    expect(d.result.timePoints.find(p => p.type === 'event_end')!.normalizedValue).toBeNull()
  })
  it('uses changed schema, removes duplicate modality, and leaves V6 request unchanged', async () => {
    const x = await createRoleFixture(), before = await buildObligationAuthorityRequest(x.context), newRequest = await buildRoleAuthorityRequest(x.context), after = await buildObligationAuthorityRequest(x.context)
    expect(before.serialized).toBe(after.serialized)
    expect(newRequest.body.text.format.schema).toEqual(ROLE_AUTHORITY_SCHEMA)
    expect(newRequest.serialized).not.toBe(before.serialized)
    expect(newRequest.dispatchAuthorized).toBe(false)
    expect(ROLE_AUTHORITY_SCHEMA.properties!.tasks.items!.properties!.semantics.required).not.toContain('modality')
  })
  it('keeps optional task pending during event-only save, then accepts explicit user choice through the same repository', async () => {
    const x = await createRoleFixture(), d = decodeRoleProductRecording(x.rawHttpText, x.context, 'EngineeringFixture', true, true)
    const store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '自愿报名', rawText: x.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'role-fixture', pipelineVersion: 'role-fixture' })
    await capture.recognize(h, async () => d.result)
    const viewRepo = new IndexedDbWorkspaceRepository(repo), draft = (await viewRepo.load())!.drafts[0]
    const first = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, draft))
    const read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), first)
    expect(read.events).toHaveLength(1); expect(read.tasks).toHaveLength(0)
    expect((await repo.load())!.extractionDrafts[0].result!.standaloneTasks[0].selected).toBe(false)
    const pending = (await viewRepo.load())!.drafts[0]
    const accepted = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, pending, pending.items[0].id))
    const later = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), accepted)
    expect(later.tasks).toHaveLength(1)
    expect(later.tasks[0].title).toContain('报名制图讲座')
    expect((await repo.load())!.events).toHaveLength(1)
    const current = (await repo.load())!, currentView = (await viewRepo.load())!.drafts[0]
    expect(() => buildSourceReviewPlan(current, currentView, 'bad')).toThrow('SOURCE_REVIEW_PENDING_ITEM_REQUIRED')
  })
})
