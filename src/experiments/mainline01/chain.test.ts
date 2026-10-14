import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapturePersistenceService } from '../../domain/v2/capture'
import { buildDomainCommitPlan, commitDomainPlan } from '../../domain/v2/domainCommit'
import { isRecognitionResult } from '../../recognition/schema'
import { artificialResponse, cases, notices, NOW } from './fixtures'
import { captureFixture, confirmItems, memoryRepository, reviewView } from './chain'

afterEach(() => vi.unstubAllGlobals())

describe('MAINLINE-01 engineering transport, not recognition accuracy', () => {
  it.each(cases.filter((name) => name !== 'condition-unknown'))('%s: full source and artificial response round-trip; no implicit formal write', async (name) => {
    const blocked = vi.fn(() => { throw new Error('EXTERNAL_NETWORK_FORBIDDEN') })
    vi.stubGlobal('fetch', blocked)
    const repository = memoryRepository()
    const handle = await captureFixture(repository, name)
    const saved = (await repository.load())!
    expect(saved.sourceVersions[0].rawText).toBe(notices[name])
    expect(saved.extractionDrafts[0].result).toEqual(artificialResponse(name, handle.sourceId))
    expect(isRecognitionResult(saved.extractionDrafts[0].result)).toBe(true)
    expect(saved.recognitionRuns[0].provider).toBe('manual')
    expect(saved.tasks).toHaveLength(0)
    expect(saved.projects).toHaveLength(0)
    expect(saved.materials).toHaveLength(0)
    expect(saved.timePoints).toHaveLength(0)
    const { draft } = reviewView(saved, handle.draftId)
    const inputTasks = artificialResponse(name, handle.sourceId).standaloneTasks
    expect(draft.items.filter((item) => item.selected).map((item) => item.suggestion.id))
      .toEqual(inputTasks.filter((item) => item.selected).map((item) => item.tempId))
    expect(blocked).not.toHaveBeenCalled()
  })

  it('unknown condition is explicitly unrepresentable, retained in denominator with source and failed draft', async () => {
    const repository = memoryRepository()
    await expect(captureFixture(repository, 'condition-unknown')).rejects.toThrow('UNREPRESENTABLE_CONDITION_STATE')
    const saved = (await repository.load())!
    expect(saved.sourceVersions[0].rawText).toBe(notices['condition-unknown'])
    expect(saved.extractionDrafts[0].status).toBe('failed')
    expect(saved.extractionDrafts[0].result).toBeNull()
    expect(saved.recognitionRuns[0].status).toBe('failed')
    expect(saved.tasks).toHaveLength(0)
    expect(saved.projects).toHaveLength(0)
  })

  it('partial confirmation preserves task ownership, material constraints, source references and second task', async () => {
    const repository = memoryRepository()
    const handle = await captureFixture(repository, 'multi')
    const initial = (await repository.load())!
    const { draft } = reviewView(initial, handle.draftId)
    const first = await confirmItems(repository, handle.draftId, [draft.items[0]])
    expect(first.saved.tasks).toHaveLength(1)
    expect(first.saved.extractionDrafts[0].status).toBe('partially_confirmed')
    expect(first.saved.extractionDrafts[0].result).toEqual(initial.extractionDrafts[0].result)
    const material = first.saved.materials[0]
    expect(material.name).toBe('活动报名表')
    expect(material.formatRequirements).toEqual(['PDF'])
    expect(material.namingRequirements).toEqual(['组别'])
    expect(material.quantity).toBe(1)
    expect(material.submissionChannel).toBe('活动平台')
    expect(material.relatedTaskIds).toEqual([first.saved.tasks[0].id])
    expect(material.deadlineTimePointId).toBe(first.saved.timePoints[0].id)
    expect(first.saved.tasks[0].legacyData?.actionVerb).toBe('提交')
    expect(first.saved.tasks[0].legacyData?.actionObject).toBe('活动报名表')
    expect(first.saved.timePoints[0].relatedTaskIds).toEqual([first.saved.tasks[0].id])
    expect(first.saved.timePoints[0].relatedMaterialIds).toEqual([material.id])
    expect(first.saved.timePoints[0].normalizedValue).toBe('2026-09-10T18:00')
    const evidence = first.saved.evidenceRefs[0]
    expect(evidence.sourceVersionId).toBe(handle.sourceVersionId)
    expect(evidence.quotedText).toBe(notices.multi)
    await commitDomainPlan(repository, first.plan, NOW)
    expect(await repository.load()).toEqual(first.saved)
    const remaining = reviewView(first.saved, handle.draftId).draft.items.filter((item) => item.status === '待确认')
    expect(remaining).toHaveLength(1)
    const final = await confirmItems(repository, handle.draftId, remaining)
    expect(final.saved.tasks).toHaveLength(2)
    expect(final.saved.materials).toHaveLength(2)
    expect(final.saved.timePoints).toHaveLength(2)
    expect(final.saved.tasks.find((item) => item.id === first.saved.tasks[0].id)).toEqual(first.saved.tasks[0])
    expect(final.saved.extractionDrafts[0].status).toBe('confirmed')
  })

  it('direct domain no-date confirmation stores no fake time; this does not test App guards', async () => {
    const repository = memoryRepository()
    const handle = await captureFixture(repository, 'no-date')
    const { draft } = reviewView((await repository.load())!, handle.draftId)
    expect(draft.items[0].suggestion.deadline).toBe('')
    const { saved } = await confirmItems(repository, handle.draftId, draft.items)
    expect(saved.tasks).toHaveLength(1)
    expect(saved.timePoints).toHaveLength(0)
  })

  it('pure information/false/vague: no auto-selection; unresolved time stays null', async () => {
    for (const name of ['information', 'condition-false', 'vague'] as const) {
      const repository = memoryRepository()
      const handle = await captureFixture(repository, name)
      const saved = (await repository.load())!
      const { draft } = reviewView(saved, handle.draftId)
      expect(draft.items.filter((item) => item.selected)).toHaveLength(0)
      await expect(confirmItems(repository, handle.draftId, draft.items)).rejects.toThrow('DOMAIN_COMMIT_EMPTY')
      expect(await repository.load()).toEqual(saved)
      if (name === 'vague') {
        expect(draft.recognitionResult?.timePoints[0].normalizedValue).toBeNull()
        expect(draft.recognitionResult?.timePoints[0].needsConfirmation).toBe(true)
      }
    }
  })

  it('hand-marked old requirement stays unselected and uncommitted; relation remains prose-only', async () => {
    const repository = memoryRepository()
    const handle = await captureFixture(repository, 'revision')
    const { draft } = reviewView((await repository.load())!, handle.draftId)
    const { saved } = await confirmItems(repository, handle.draftId, draft.items)
    expect(saved.tasks.map((item) => item.nextAction)).toEqual(['提交电子报名表'])
    expect(saved.extractionDrafts[0].result?.conflicts[0].entityTempIds).toEqual(['old', 'new'])
    expect(saved.changeProposals).toHaveLength(0)
  })

  it('invalid structural response fails visibly, preserving source and zero formal tasks', async () => {
    const repository = memoryRepository()
    const handle = await captureFixture(repository, 'multi')
    const before = (await repository.load())!
    const broken = { ...before.extractionDrafts[0].result, schemaVersion: 'invalid' }
    await expect(new CapturePersistenceService(repository).recognize(handle, async () => broken)).rejects.toThrow('INVALID_RECOGNITION_RESULT')
    const after = (await repository.load())!
    expect(after.recognitionRuns[0].status).toBe('failed')
    expect(after.sourceVersions).toEqual(before.sourceVersions)
    expect(after.tasks).toHaveLength(0)
  })

  it('stale confirmation cannot overwrite a changed draft; transaction rolls back', async () => {
    const repository = memoryRepository()
    const handle = await captureFixture(repository, 'multi')
    const initial = (await repository.load())!
    const plan = buildDomainCommitPlan(initial, handle.draftId, { taskTempIds: ['submit'], materialTempIds: ['m0'], timePointTempIds: ['d0'], eventTempIds: [] }, NOW)
    await repository.transaction((workspace) => {
      workspace.extractionDrafts[0].result!.standaloneTasks[0].title = '用户已修改的标题'
      return workspace
    })
    const changed = await repository.load()
    await expect(commitDomainPlan(repository, plan, NOW)).rejects.toThrow('DOMAIN_COMMIT_DRAFT_STALE')
    expect(await repository.load()).toEqual(changed)
  })

  it('duplicate capture operation reuses one persisted chain', async () => {
    const repository = memoryRepository()
    const first = await captureFixture(repository, 'multi')
    const second = await captureFixture(repository, 'multi')
    expect(second.draftId).toBe(first.draftId)
    expect(second.duplicate).toBe(true)
    expect((await repository.load())!.sourceVersions).toHaveLength(1)
  })
})
