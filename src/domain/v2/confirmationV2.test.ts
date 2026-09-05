import { describe, expect, it } from 'vitest'
import { confirmationRevisionV2, confirmationStateV2, confirmV2, editConfirmationV2, reviewEditsV2, type ConfirmationEditV2, type ConfirmationIntentV2 } from './confirmationV2'
import { captureFixture, memoryRepository } from '../../experiments/mainline01/chain'
import { NOW, type CaseName } from '../../experiments/mainline01/fixtures'
import type { WorkspaceV8 } from './types'
import { buildDomainCommitPlan, buildDomainCommitPlanV2 } from './domainCommit'
import { workspaceSnapshotHash } from './migration'
describe('P1-R2 saved time edits must be adopted', () => {
  it.each(['planned_start', 'event_start', 'event_end'] as const)('rejects %s edit before history; valid sibling and unedited time remain usable', async (type) => {
    const x = await setup()
    x.workspace.extractionDrafts[0].result!.timePoints[0].type = type
    await x.repository.save(x.workspace)
    await expect(editConfirmationV2(x.repository, x.edit('deadline', '2026-09-12T09:00'), NOW)).rejects.toThrow('TIME_TYPE_NOT_EDITABLE')
    expect(await x.repository.load()).toEqual(x.workspace)
    expect(confirmationStateV2(x.workspace, x.handle.draftId, 'submit')).toMatchObject({
      dateEditBlockedReason: expect.stringContaining('本轮不支持'), edited: false,
    })
    const first = await confirmV2(x.repository, x.intent(['print']), NOW)
    const saved = await confirmV2(x.repository, x.intent(['submit'], first), NOW)
    expect(saved.tasks).toHaveLength(2)
    expect(saved.timePoints.find((point) => point.type === type)?.normalizedValue).toBe('2026-09-10T18:00')
  })
  it.each(['registration_deadline', 'submission_deadline', 'task_deadline', 'result_announcement'] as const)('preserves the existing supported %s edit across plan and storage', async (type) => {
    const x = await setup()
    const sourcePoint = x.workspace.extractionDrafts[0].result!.timePoints[0]
    sourcePoint.type = type
    sourcePoint.timezone = 'Asia/Tokyo'
    await x.repository.save(x.workspace)
    const edited = await editConfirmationV2(x.repository, x.edit('deadline', '2026-09-12T09:00'), NOW)
    expect(edited.tasks).toHaveLength(0)
    const selection = { taskTempIds: ['submit'], materialTempIds: ['m0'], timePointTempIds: ['d0'], eventTempIds: [],
      taskOverrides: reviewEditsV2(edited, x.handle.draftId).overrides }
    const plan = buildDomainCommitPlanV2(edited, x.handle.draftId, selection, NOW)
    const saved = await confirmV2(x.repository, x.intent(['submit'], edited), NOW)
    const point = saved.timePoints[0]
    expect(point).toEqual(plan.create.timePoints[0])
    expect(point).toMatchObject({ type, normalizedValue: '2026-09-12T09:00', timezone: 'Asia/Tokyo', rawText: sourcePoint.rawText })
    expect(saved.sourceVersions).toEqual(x.workspace.sourceVersions)
    expect(saved.extractionDrafts[0].result).toEqual(x.workspace.extractionDrafts[0].result)
  })
  it('V2 compiler refuses ignored overrides while old compiler behavior stays unchanged', async () => {
    const x = await setup()
    x.workspace.extractionDrafts[0].result!.timePoints[0].type = 'planned_start'
    const selection = { taskTempIds: ['submit'], materialTempIds: ['m0'], timePointTempIds: ['d0'], eventTempIds: [],
      taskOverrides: { submit: { deadline: '2026-09-12T09:00' } } }
    expect(() => buildDomainCommitPlanV2(x.workspace, x.handle.draftId, selection, NOW)).toThrow('TIME_EDIT_NOT_ADOPTED')
    expect(buildDomainCommitPlan(x.workspace, x.handle.draftId, selection, NOW).create.timePoints[0].normalizedValue).toBe('2026-09-10T18:00')
  })
  it('an old accepted but unsupported edit cannot confirm or partially write a batch', async () => {
    const x = await setup()
    const result = x.workspace.extractionDrafts[0].result!
    result.timePoints[0].type = 'planned_start'
    const version = x.workspace.sourceVersions[0]
    x.workspace.historyRecords.push({
      id: 'confirmation-v2-edit:old-engineering-edit', entityType: 'extraction_draft', entityId: x.handle.draftId,
      action: 'confirmation_v2_edit', fieldName: JSON.stringify(['submit', 'deadline']), before: '2026-09-10T18:00',
      after: '2026-09-12T09:00', actor: 'user', reason: 'confirmation-v2:' + workspaceSnapshotHash({ result, version }),
      sourceVersionId: version.id, changedAt: NOW,
    })
    await x.repository.save(x.workspace)
    expect(confirmationStateV2(x.workspace, x.handle.draftId, 'submit')).toMatchObject({
      defaultSelected: false, blockedReason: expect.stringContaining('TIME_TYPE_NOT_EDITABLE'),
    })
    await expect(confirmV2(x.repository, x.intent(['submit', 'print']), NOW)).rejects.toThrow('TIME_TYPE_NOT_EDITABLE')
    expect(await x.repository.load()).toEqual(x.workspace)
    expect((await confirmV2(x.repository, x.intent(['print']), NOW)).tasks).toHaveLength(1)
  })
  it('an existing canonical time cannot silently defeat an edit; save rolls back before adding history', async () => {
    const x = await setup()
    const selection = { taskTempIds: ['submit'], materialTempIds: ['m0'], timePointTempIds: ['d0'], eventTempIds: [] }
    const original = buildDomainCommitPlanV2(x.workspace, x.handle.draftId, selection, NOW).create.timePoints[0]
    x.workspace.timePoints.push({ ...original, taskId: null, materialId: null, relatedTaskIds: [], relatedMaterialIds: [] })
    await x.repository.save(x.workspace)
    await expect(editConfirmationV2(x.repository, x.edit('deadline', '2026-09-12T09:00'), NOW)).rejects.toThrow('TIME_EDIT_NOT_ADOPTED')
    expect(await x.repository.load()).toEqual(x.workspace)
  })
})
describe('P1-R1 registered review counterexamples', () => {
  it('an explicit user intent may confirm a valid inference but cannot bypass a safety blocker', async () => {
    const x = await setup()
    x.workspace.extractionDrafts[0].result!.standaloneTasks[0].inferenceLevel = 'optional_suggestion'
    await x.repository.save(x.workspace)
    expect(confirmationStateV2(x.workspace, x.handle.draftId, 'submit').defaultSelected).toBe(false)
    const saved = await confirmV2(x.repository, x.intent(['submit']), NOW)
    expect(saved.tasks[0].legacyData?.inferenceLevel).toBe('optional_suggestion')
    const invalid = await setup('condition-false')
    invalid.workspace.extractionDrafts[0].result!.standaloneTasks[0].selected = true
    await invalid.repository.save(invalid.workspace)
    expect(confirmationStateV2(invalid.workspace, invalid.handle.draftId, 'conditional').defaultSelected).toBe(false)
    await expect(confirmV2(invalid.repository, invalid.intent(['conditional']), NOW)).rejects.toThrow('REVIEW')
  })
  it('unselected or malformed material-only time is not treated as absent', async () => {
    const x = await setup(); materialOnly(x.workspace)
    x.workspace.extractionDrafts[0].result!.timePoints[0].selected = false
    await x.repository.save(x.workspace)
    expect(confirmationStateV2(x.workspace, x.handle.draftId, 'submit').defaultSelected).toBe(false)
    await expect(confirmV2(x.repository, x.intent(['submit']), NOW)).rejects.toThrow('TIME_REQUIRES_REVIEW')
    const saved = await confirmV2(x.repository, x.intent(['print']), NOW)
    expect(saved.tasks).toHaveLength(1)
  })
  it('editing material-only time is blocked rather than manufacturing a second deadline', async () => {
    const x = await setup(); materialOnly(x.workspace); await x.repository.save(x.workspace)
    await expect(editConfirmationV2(x.repository, x.edit('deadline', '2026-09-15'), NOW)).rejects.toThrow('TIME_EDIT_BLOCKED')
    expect(await x.repository.load()).toEqual(x.workspace)
  })
  it('edit persistence only uses existing workspace fields and keeps invalid partial dates out', async () => {
    const x = await setup('no-date')
    for (const value of ['2', '20', '202', '2026-']) {
      await expect(editConfirmationV2(x.repository, x.edit('deadline', value, x.workspace, 'save'), NOW)).rejects.toThrow('USER_DATE_INVALID')
    }
    const changed = await editConfirmationV2(x.repository, x.edit('deadline', '2026-09-15', x.workspace, 'save'), NOW)
    expect(Object.keys(changed).sort()).toEqual(Object.keys(x.workspace).sort())
    expect(changed.tasks).toHaveLength(0)
    expect(changed.extractionDrafts[0].result).toEqual(x.workspace.extractionDrafts[0].result)
  })
  function materialOnly(workspace: WorkspaceV8) {
    const result = workspace.extractionDrafts[0].result!
    result.standaloneTasks[0].timePointTempIds = []
    result.timePoints[0].relatedTaskTempIds = []
  }
  function linkedEvent(workspace: WorkspaceV8) {
    const result = workspace.extractionDrafts[0].result!
    result.timePoints[0].type = 'event_start'
    result.events.push({ tempId: 'linked-event', title: '入场', description: '已见响应的关联变形',
      startTimePointTempId: 'd0', endTimePointTempId: null, location: null, evidenceIds: ['notice'],
      confidence: 1, inferenceLevel: 'explicit', selected: true })
  }
  it('material-only deadline is preserved, not relabelled undated', async () => {
    const x = await setup(); materialOnly(x.workspace); await x.repository.save(x.workspace)
    expect(confirmationStateV2(x.workspace, x.handle.draftId, 'submit').value).toBe('2026-09-10T18:00')
    const saved = await confirmV2(x.repository, x.intent(['submit']), NOW)
    expect(saved.timePoints).toHaveLength(1)
    expect(saved.materials[0].deadlineTimePointId).toBe(saved.timePoints[0].id)
    expect(saved.timePoints[0].relatedMaterialIds).toEqual([saved.materials[0].id])
    expect(saved.timePoints[0].rawText).toBe('2026年9月10日18:00前')
  })
  it.each(['d0', 'm0', 'linked-event'])('a conflict on associated %s blocks only the affected task', async (entityId) => {
    const x = await setup()
    if (entityId === 'linked-event') linkedEvent(x.workspace)
    x.workspace.extractionDrafts[0].result!.conflicts.push({ id: 'associated-conflict', type: 'other',
      message: '已见响应冲突归属变形', entityTempIds: [entityId], evidenceIds: ['notice'], requiresDecision: true })
    await x.repository.save(x.workspace)
    await expect(confirmV2(x.repository, x.intent(['submit']), NOW)).rejects.toThrow('CONFLICT_REQUIRES_REVIEW')
    expect((await x.repository.load())!.tasks).toHaveLength(0)
    const saved = await confirmV2(x.repository, x.intent(['print']), NOW)
    expect(saved.tasks.map((t) => t.legacyData?.recognitionTempId)).toEqual(['print'])
  })
  it('shared event time must be explicitly blocked if event confirmation is unsupported', async () => {
    const x = await setup(); linkedEvent(x.workspace); await x.repository.save(x.workspace)
    await expect(confirmV2(x.repository, x.intent(['submit']), NOW)).rejects.toThrow('EVENT_REQUIRES_SEPARATE_CONFIRMATION')
    expect(await x.repository.load()).toEqual(x.workspace)
    expect(x.workspace.extractionDrafts[0].result!.events).toHaveLength(1)
  })
  it('date-only edit to a clock uses the same source timezone in preview and storage', async () => {
    const x = await setup()
    Object.assign(x.workspace.extractionDrafts[0].result!.timePoints[0], {
      normalizedValue: '2026-09-10', precision: 'date_only', isAllDay: true, timezone: 'Asia/Tokyo',
    })
    await x.repository.save(x.workspace)
    const changed = await editConfirmationV2(x.repository, x.edit('deadline', '2026-09-10T09:00'), NOW)
    expect(confirmationStateV2(changed, x.handle.draftId, 'submit').dateLabel).toContain('Asia/Tokyo')
    const saved = await confirmV2(x.repository, x.intent(['submit'], changed), NOW)
    expect(saved.timePoints[0].timezone).toBe('Asia/Tokyo')
    expect(saved.timePoints[0].rawText).toBe('2026年9月10日18:00前')
  })
})

async function setup(name: CaseName = 'multi') {
  const repository = memoryRepository()
  const handle = await captureFixture(repository, name)
  const workspace = (await repository.load())!
  const intent = (ids: string[], current = workspace): ConfirmationIntentV2 =>
    ({ draftId: handle.draftId, revision: confirmationRevisionV2(current), taskTempIds: ids })
  const edit = (field: 'title' | 'deadline', value: string, current = workspace, taskTempId = 'submit', operationId = 'edit1'): ConfirmationEditV2 =>
    ({ draftId: handle.draftId, taskTempId, revision: confirmationRevisionV2(current), operationId, field, value })
  return { repository, handle, workspace, intent, edit }
}
describe('explicit confirmation V2', () => {
  it('no UI projection becomes an override; no commit before confirmation', async () => {
    const x = await setup()
    expect(reviewEditsV2(x.workspace, x.handle.draftId).overrides).toEqual({})
    expect(x.workspace.tasks).toHaveLength(0)
    const saved = await confirmV2(x.repository, x.intent(['submit', 'print']), NOW)
    expect(saved.timePoints.map((t) => t.rawText)).toEqual(x.workspace.extractionDrafts[0].result!.timePoints.map((t) => t.rawText))
    expect(saved.tasks.every((t) => t.estimatedMinutes === null)).toBe(true)
  })
  it('real edit survives reopening; original/result/evidence unchanged; edited-back net patch empty', async () => {
    const x = await setup()
    const changed = await editConfirmationV2(x.repository, x.edit('title', '我的报名任务'), NOW)
    expect(changed.tasks).toHaveLength(0)
    expect((await x.repository.load())!.extractionDrafts).toEqual(x.workspace.extractionDrafts)
    const restored = await editConfirmationV2(x.repository, x.edit('title', '提交活动报名表', changed, 'submit', 'edit2'), NOW)
    expect(reviewEditsV2(restored, x.handle.draftId).overrides).toEqual({})
    expect(reviewEditsV2(restored, x.handle.draftId).history).toHaveLength(2)
  })
  it('same value is not an edit; duplicate edit is idempotent', async () => {
    const x = await setup()
    expect(await editConfirmationV2(x.repository, x.edit('deadline', '2026-09-10T18:00'), NOW)).toEqual(x.workspace)
    const request = x.edit('deadline', '2026-09-12T09:00')
    const changed = await editConfirmationV2(x.repository, request, NOW)
    expect(await editConfirmationV2(x.repository, request, NOW)).toEqual(changed)
    await expect(editConfirmationV2(x.repository, { ...request, value: '2026-09-13' }, NOW)).rejects.toThrow('OPERATION_COLLISION')
  })
  it('time edit updates normalized value, never original raw text, timezone or evidence', async () => {
    const x = await setup()
    const changed = await editConfirmationV2(x.repository, x.edit('deadline', '2026-09-12T09:00'), NOW)
    const saved = await confirmV2(x.repository, x.intent(['submit'], changed), NOW)
    expect(saved.timePoints[0]).toMatchObject({ rawText: '2026年9月10日18:00前', normalizedValue: '2026-09-12T09:00', timezone: 'Asia/Shanghai' })
    expect(saved.historyRecords.some((h) => h.action === 'confirmation_v2_edit' && h.before === '2026-09-10T18:00' && h.after === '2026-09-12T09:00')).toBe(true)
    expect(saved.sourceVersions).toEqual(x.workspace.sourceVersions)
    expect(saved.extractionDrafts[0].result).toEqual(x.workspace.extractionDrafts[0].result)
  })
  it('undated confirmation creates no fake time', async () => {
    const x = await setup('no-date')
    expect(confirmationStateV2(x.workspace, x.handle.draftId, 'save').dateLabel).toContain('可无日期确认')
    const saved = await confirmV2(x.repository, x.intent(['save']), NOW)
    expect(saved.tasks).toHaveLength(1); expect(saved.timePoints).toHaveLength(0)
  })
  it('user-added date has manual provenance, no counterfeit evidence and no invented clock', async () => {
    const x = await setup('no-date')
    const changed = await editConfirmationV2(x.repository, x.edit('deadline', '2026-09-15', x.workspace, 'save'), NOW)
    const saved = await confirmV2(x.repository, x.intent(['save'], changed), NOW)
    expect(saved.timePoints[0]).toMatchObject({ rawText: '2026-09-15', normalizedValue: '2026-09-15', precision: 'date_only', timezone: null, isAllDay: true, legacyData: { extractionMethod: 'manual', evidenceIds: [] } })
    expect(saved.extractionDrafts[0].result!.timePoints).toHaveLength(0)
  })
  it.each(['vague', 'condition-false', 'revision'] as const)('%s remains review/blocked, never promoted to undated', async (name) => {
    const x = await setup(name)
    const ids = x.workspace.extractionDrafts[0].result!.standaloneTasks.map((t) => t.tempId)
    await expect(confirmV2(x.repository, x.intent(ids), NOW)).rejects.toThrow('REVIEW')
    expect((await x.repository.load())!.tasks).toHaveLength(0)
  })
  it('true condition preserves description; information creates none; unknown stays explicitly failed', async () => {
    const x = await setup('condition-true')
    const saved = await confirmV2(x.repository, x.intent(['conditional']), NOW)
    expect(saved.tasks[0].description).toBe(x.workspace.sourceVersions[0].rawText)
    const info = await setup('information')
    expect(info.workspace.tasks).toHaveLength(0)
    const unknownRepository = memoryRepository()
    await expect(captureFixture(unknownRepository, 'condition-unknown')).rejects.toThrow('UNREPRESENTABLE_CONDITION_STATE')
    const unknown = (await unknownRepository.load())!
    expect(unknown.extractionDrafts[0].status).toBe('failed')
    expect(unknown.sources).toHaveLength(1)
    expect(unknown.tasks).toHaveLength(0)
  })
  it('partial + duplicate + stale confirms do not lose or overwrite siblings', async () => {
    const x = await setup()
    const intent = x.intent(['submit'])
    const first = await confirmV2(x.repository, intent, NOW)
    expect(await confirmV2(x.repository, intent, NOW)).toEqual(first)
    await expect(confirmV2(x.repository, x.intent(['print']), NOW)).rejects.toThrow('STALE')
    const second = await confirmV2(x.repository, x.intent(['print'], first), NOW)
    expect(second.tasks).toHaveLength(2); expect(second.tasks[0]).toEqual(first.tasks[0])
    await expect(editConfirmationV2(x.repository, x.edit('title', '覆盖', second), NOW)).rejects.toThrow('ALREADY_PROCESSED')
  })
  it('valid sibling can confirm while another has malformed time', async () => {
    const x = await setup()
    x.workspace.extractionDrafts[0].result!.timePoints[0].selected = false
    await x.repository.save(x.workspace)
    const saved = await confirmV2(x.repository, x.intent(['print']), NOW)
    expect(saved.tasks.map((t) => t.legacyData?.recognitionTempId)).toEqual(['print'])
  })
  it('shared time edit is blocked but unedited task confirmation still works', async () => {
    const x = await setup()
    const result = x.workspace.extractionDrafts[0].result!
    result.timePoints = [{ ...result.timePoints[0], relatedTaskTempIds: ['submit', 'print'], relatedMaterialTempIds: ['m0', 'm1'] }]
    result.standaloneTasks[1].timePointTempIds = ['d0']
    await x.repository.save(x.workspace)
    await expect(editConfirmationV2(x.repository, x.edit('deadline', '2026-09-15'), NOW)).rejects.toThrow('SHARED')
    const saved = await confirmV2(x.repository, x.intent(['print']), NOW)
    expect(saved.tasks).toHaveLength(1)
  })
  it.each(['2026-02-30', '2026-09-10T25:00', '2026-09-10T18:90', 'invalid', ''])('reject invalid user date %s atomically', async (value) => {
    const x = await setup()
    await expect(editConfirmationV2(x.repository, x.edit('deadline', value), NOW)).rejects.toThrow('USER_DATE_INVALID')
    expect(await x.repository.load()).toEqual(x.workspace)
  })
  it('date-only and explicit source timezone preserved', async () => {
    const x = await setup()
    const result = x.workspace.extractionDrafts[0].result!
    Object.assign(result.timePoints[0], { normalizedValue: '2026-09-10', precision: 'date_only', isAllDay: true })
    result.timePoints[1].timezone = 'Asia/Tokyo'
    await x.repository.save(x.workspace)
    const saved = await confirmV2(x.repository, x.intent(['submit', 'print']), NOW)
    expect(saved.timePoints[0]).toMatchObject({ normalizedValue: '2026-09-10', precision: 'date_only', timezone: null })
    expect(saved.timePoints[1].timezone).toBe('Asia/Tokyo')
  })
  const corruptions: Array<[string, (w: WorkspaceV8) => void]> = [
    ['source body', (w) => { w.sourceVersions[0].rawText += '篡改' }],
    ['evidence quote', (w) => { w.extractionDrafts[0].result!.evidence[0].quotedText = '伪造' }],
    ['time reference', (w) => { w.extractionDrafts[0].result!.standaloneTasks[0].timePointTempIds = ['missing'] }],
    ['material reference', (w) => { w.extractionDrafts[0].result!.standaloneTasks[0].materialTempIds = ['missing'] }],
    ['partial source', (w) => { w.sourceVersions[0].legacyData = { reviewMetadata: { partialExtraction: true } } }],
  ]
  it.each(corruptions)('rejects %s, rollback unchanged', async (_, change) => {
    const x = await setup()
    change(x.workspace)
    // Persist only if the canonical validator permits the malformed recognition input.
    try { await x.repository.save(x.workspace) } catch { return }
    const before = await x.repository.load()
    await expect(confirmV2(x.repository, x.intent(['submit']), NOW)).rejects.toThrow()
    expect(await x.repository.load()).toEqual(before)
  })
  it('does not trust edited=true / extra overrides or sparse and duplicate IDs', async () => {
    const x = await setup()
    await expect(confirmV2(x.repository, { ...x.intent(['submit']), taskOverrides: { submit: { title: '伪造' } } } as ConfirmationIntentV2, NOW)).rejects.toThrow('UNSUPPORTED_FIELDS')
    await expect(editConfirmationV2(x.repository, { ...x.edit('title', '改变'), edited: true } as ConfirmationEditV2, NOW)).rejects.toThrow('UNSUPPORTED_FIELDS')
    const sparse = new Array<string>(2); sparse[1] = 'submit'
    await expect(confirmV2(x.repository, x.intent(sparse), NOW)).rejects.toThrow('SELECTION_INVALID')
    await expect(confirmV2(x.repository, x.intent(['submit', 'submit']), NOW)).rejects.toThrow('SELECTION_INVALID')
  })
  it('stale edit and corrupted before/after chain are rejected', async () => {
    const x = await setup()
    const changed = await editConfirmationV2(x.repository, x.edit('title', '更名'), NOW)
    await expect(editConfirmationV2(x.repository, x.edit('title', '过期', x.workspace, 'print', 'edit2'), NOW)).rejects.toThrow('STALE')
    changed.historyRecords.find((h) => h.action === 'confirmation_v2_edit')!.before = '伪造'
    await x.repository.save(changed)
    await expect(confirmV2(x.repository, x.intent(['submit'], changed), NOW)).rejects.toThrow('EDIT_HISTORY_CHAIN')
  })
  it('transaction exception does not erase records', async () => {
    const x = await setup()
    await expect(x.repository.transaction((w) => { w.extractionDrafts = []; throw new Error('TEST_ABORT') })).rejects.toThrow('TEST_ABORT')
    expect(await x.repository.load()).toEqual(x.workspace)
  })
})
