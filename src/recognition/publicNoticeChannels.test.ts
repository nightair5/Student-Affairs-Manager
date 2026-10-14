import { describe, it, expect } from 'vitest'
import { createPublicNoticeFixture } from '../experiments/candidate19Recorded/publicNotices'
import { decodeCurrentSourceRecording } from './conditionalNonActionProduct'
import { assembleCurrentFirstSuggestion, groundMaterialChannels } from './materialChannelGrounding'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { rebindRecordedScopes } from './recordedProjectionD26'

describe('actual public notice excerpts: closed material enumerations', () => {
  it('preserves all three explicit destinations through real wire and public conversion, without changing intent unknown', async () => {
    const f = await createPublicNoticeFixture('PUB-C19-02')
    const decoded = decodeCurrentSourceRecording(f.rawHttpText, 'EngineeringFixture', f.context)
    const p = assembleCurrentFirstSuggestion(decoded.result, { sourceText: f.sourceText, ...f.context })
    expect(p.result.materials.map(m => m.submissionChannel)).toEqual(Array(3).fill('exchange@example.invalid'))
    expect(decoded.originalAdapted.tasks[0].condition.value).toBe('unknown')
    expect(p.result.materials[0].namingRequirements).toContain('申请院校+学生姓名+所在学院')
    expect(p.result.timePoints[0]).toMatchObject({ normalizedValue: '2026-04-21T17:00', type: 'submission_deadline' })
    expect(p.result.materials[1].formatRequirements).toContain('须加盖公章')
    expect(p.result.events).toHaveLength(0)
  })
  it.each([
    ['将学生申请材料及学院回执扫描版（须加盖公章）和Excel汇总表发送至陌生收件站', true],
    ['请勿将学生申请材料及学院回执扫描版和Excel汇总表发送至陌生收件站', false],
    ['若将学生申请材料及学院回执扫描版和Excel汇总表发送至陌生收件站', false],
    ['将学生申请材料照片及学院回执扫描版和Excel汇总表发送至陌生收件站', false],
    ['将学生申请材料及陌生附件发送至陌生收件站', false],
    ['将学生申请材料及学院回执扫描版（不要提交）和Excel汇总表发送至陌生收件站', false],
  ] as const)('minimum semantic mutation %s', async (text, allowed) => {
    const f = await createPublicNoticeFixture('PUB-C19-02')
    const result = structuredClone(decodeCurrentSourceRecording(f.rawHttpText, 'EngineeringFixture', f.context).result)
    result.evidence = [{ id: 'probe', sourceId: 'anonymous', quote: text, field: 'materials', extractionMethod: 'parser' }]
    result.materials.forEach(m => { m.evidenceIds = ['probe']; m.submissionChannel = '陌生收件站' })
    result.standaloneTasks[0].evidenceIds = ['probe']
    const before = structuredClone(result), p = groundMaterialChannels(result, text)
    expect(p.result.materials[0].submissionChannel).toBe(allowed ? '陌生收件站' : null)
    expect(result).toEqual(before)
  })
  it('cross-day no-task service event commits atomically and independently reads back actual endpoints', async () => {
    const f = await createPublicNoticeFixture('PUB-C19-01'), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo)
    const h = await capture.beginCapture({ operationId: crypto.randomUUID(), rawText: f.sourceText, sourceType: 'text', title: '公开暂停通知摘录', provider: 'manual', modelName: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT', promptVersion: 'NOT_MODEL_OUTPUT', pipelineVersion: 'public-notice-engineering-1' })
    const context = { ...f.context, index: await indexImmutableScopesV11(h.sourceId, h.sourceVersionId, f.sourceText) }
    await capture.recognize(h, async () => assembleCurrentFirstSuggestion(decodeCurrentSourceRecording(rebindRecordedScopes(f.rawHttpText, f.context.index, context.index).reboundHttpText, 'EngineeringFixture', context).result, { sourceText: f.sourceText, ...context }).result)
    const workspace = (await repo.load())!, draft = (await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d => d.id === h.draftId)!
    const plan = buildSourceReviewPlan(workspace, draft), receipt = await commitSourceReview(repo, plan)
    const back = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(back.tasks).toHaveLength(0); expect(back.projects).toHaveLength(0); expect(back.events).toHaveLength(1)
    expect(back.timePoints.map(p => p.normalizedValue)).toEqual(['2026-05-09T15:00', '2026-05-11T08:30'])
    await commitSourceReview(repo, plan)
    expect((await repo.load())!.events).toHaveLength(1)
  })
})
