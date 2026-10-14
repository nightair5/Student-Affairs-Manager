import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { buildDomainCommitPlanV2 } from '../../domain/v2/domainCommit'
import { createMainlineRuntime } from '../mainline02/runtime'
import { emptyWorkspace, notices, type CaseName } from '../mainline01/fixtures'
import { createReplayHandoff, engineeringReceipts } from './seenReplay'
import { buildBrowserReminderJobs } from '../../lib/notifications'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import { sha256Text } from './recognitionHandoff'

const fixtureSha = 'sha256:' + createHash('sha256').update(readFileSync('src/experiments/mainline01/fixtures.ts')).digest('hex')
async function setup() {
  const name = 'rco-mainline-01-02-i1-mainline03-accept-' + crypto.randomUUID()
  const initial = emptyWorkspace(); initial.workspace.id = name
  const store = Object.assign(new MemoryWorkspaceRecordStore(), { name })
  const handoff = await createReplayHandoff(await engineeringReceipts(fixtureSha))
  const options = { name, store, handoff, recognize: () => { throw Error('OLD_CALLBACK_FORBIDDEN') } }
  const runtime = await createMainlineRuntime({ ...options, initialize: initial })
  return { runtime, store, options, capture: (kind: CaseName, operationId?: string) => runtime.capture({ sourceType: 'text', content: notices[kind], operationId }) }
}
describe('MAINLINE03 real App and canonical acceptance', () => {
  it.each(['version', 'raw'] as const)('R1 rejects internally inconsistent %s receipt before creating a Source', async fault => {
    const x = await setup(), before = await x.runtime.load()
    const receipt = (await engineeringReceipts(fixtureSha)).find(item => item.originCaseId === 'no-date')!
    if (fault === 'version') {
      receipt.contractVersion = '9.9'; receipt.promptVersion = 'wrong-version'
    } else {
      receipt.rawOutputText = '{"different":true}'
      receipt.rawSha256 = await sha256Text(receipt.rawOutputText)
    }
    const { receiptSha256: oldSeal, ...body } = receipt
    void oldSeal
    receipt.receiptSha256 = await sha256Text(JSON.stringify(body))
    await expect((async () => {
      const handoff = await createReplayHandoff([receipt])
      const runtime = await createMainlineRuntime({ ...x.options, handoff })
      await runtime.capture({ sourceType: 'text', content: receipt.sourceText })
    })()).rejects.toThrow(/HANDOFF_(RECEIPT_IDENTITY_MISMATCH|RAW_RESPONSE_MISMATCH)/)
    expect(await x.runtime.load()).toEqual(before)
    expect(before.sources).toHaveLength(0); expect(before.tasks).toHaveLength(0)
  })
  it('renders actual App with truthful replay label and no default storage access', async () => {
    const x = await setup(), legacy = vi.fn(() => { throw Error('OLD_STORAGE') })
    vi.stubGlobal('localStorage', { getItem: legacy, setItem: legacy })
    try {
      const html = renderToStaticMarkup(<App runtime={x.runtime} />)
      expect(html).toContain('已见候选回放'); expect(html).toContain('无新模型调用')
      expect(legacy).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
  it('new source first, unchanged original receipt, adopted full 42-field contract on batch confirm', async () => {
    const x = await setup(), draftId = await x.capture('multi')
    const before = await x.runtime.load(), response = before.extractionDrafts[0].result!
    const receipt = before.sources[0].legacyData?.mainline03Handoff
    expect(before.tasks).toHaveLength(0); expect(before.recognitionRuns[0].provider).toBe('manual')
    expect(JSON.stringify(receipt)).toContain('pending-source')
    const view = x.runtime.review(before, draftId)
    expect(view.draft.items.map(item => item.selected)).toEqual([true, true])
    const saved = await x.runtime.confirm({ draftId, revision: view.revision, taskTempIds: ['submit', 'print'] })
    const rows: Array<{ field: string; same: boolean }> = []
    const check = (field: string, a: unknown, b: unknown) => rows.push({ field, same: JSON.stringify(a) === JSON.stringify(b) })
    response.standaloneTasks.forEach((input, index) => {
      const task = saved.tasks.find(item => item.legacyData?.recognitionTempId === input.tempId)!
      const time = saved.timePoints.find(item => item.legacyData?.recognitionTempId === 'd' + index)!
      const material = saved.materials.find(item => item.legacyData?.recognitionTempId === 'm' + index)!
      const point = response.timePoints[index], inputMaterial = response.materials[index]
      check('action', input.actionVerb, task.legacyData?.actionVerb); check('object', input.actionObject, task.legacyData?.actionObject)
      check('title', input.title, task.title); check('description', input.description, task.description)
      check('completionCriteria', input.completionCriteria, task.legacyData?.completionCriteria)
      for (const field of ['rawText','normalizedValue','timezone','isAllDay','precision'] as const) check('time.' + field, point[field], time[field])
      check('time.task', [task.id], time.relatedTaskIds); check('time.material', [material.id], time.relatedMaterialIds)
      for (const field of ['name','formatRequirements','namingRequirements','quantity','submissionChannel'] as const) check('material.' + field, inputMaterial[field], material[field])
      check('material.task', [task.id], material.relatedTaskIds); check('material.deadline', time.id, material.deadlineTimePointId)
      check('evidence.source', before.sourceVersions[0].id, saved.evidenceRefs[0].sourceVersionId)
      check('evidence.quote', response.evidence[0].quotedText, saved.evidenceRefs[0].quotedText)
    })
    expect(rows).toHaveLength(42); expect(rows.filter(row => !row.same)).toEqual([])
    expect(saved.sources[0].legacyData?.mainline03Handoff).toEqual(receipt)
    expect(saved.extractionDrafts[0].result).toEqual(response)
    const reopened = await createMainlineRuntime(x.options)
    expect(await reopened.load()).toEqual(saved)
    expect(JSON.parse(await reopened.exportJson())).toEqual(saved)
  })
  it('partially confirms without duplicates, overwrites or fake no-date reminders', async () => {
    const x = await setup(), draftId = await x.capture('multi')
    const before = await x.runtime.load(), first = { draftId, revision: x.runtime.review(before, draftId).revision, taskTempIds: ['submit'] }
    const saved1 = await x.runtime.confirm(first)
    expect(await x.runtime.confirm(first)).toEqual(saved1)
    const saved2 = await x.runtime.confirm({ draftId, revision: x.runtime.review(saved1, draftId).revision, taskTempIds: ['print'] })
    expect(saved2.tasks).toHaveLength(2)
    expect(saved2.tasks.find(t => t.id === saved1.tasks[0].id)).toEqual(saved1.tasks[0])
    const noDate = await x.capture('no-date'), view = x.runtime.review(await x.runtime.load(), noDate)
    const saved = await x.runtime.confirm({ draftId: noDate, revision: view.revision, taskTempIds: ['save'] })
    const task = saved.tasks.find(t => t.legacyData?.recognitionTempId === 'save')!
    expect(saved.timePoints.filter(p => p.relatedTaskIds.includes(task.id))).toEqual([])
    expect(saved.reminderRecords).toEqual([])
    expect(buildBrowserReminderJobs(workspaceV8ToLegacyView(saved).tasks, new Date())).toEqual([])
  })
  it('time saves and commit plans agree; failed save/confirm roll back and stale tab cannot overwrite', async () => {
    const x = await setup(), draftId = await x.capture('no-date')
    const original = await x.runtime.load(), revision = x.runtime.review(original, draftId).revision
    const edit = { draftId, taskTempId: 'save', revision, operationId: 'manual-date', field: 'deadline' as const, value: '2026-09-18' }
    const transaction = x.store.transaction.bind(x.store)
    const spy = vi.spyOn(x.store, 'transaction').mockImplementationOnce(async (key, mutate) => transaction(key, raw => { mutate(raw); throw Error('INJECTED_SAVE_FAILURE') }))
    await expect(x.runtime.edit(edit)).rejects.toThrow('INJECTED_SAVE_FAILURE')
    expect(await x.runtime.load()).toEqual(original); spy.mockRestore()
    const edited = await x.runtime.edit(edit)
    expect(edited.historyRecords).toHaveLength(1)
    const stale = { draftId, revision, taskTempIds: ['save'] }
    await expect(x.runtime.confirm(stale)).rejects.toThrow('STALE')
    const view = x.runtime.review(edited, draftId)
    const plan = buildDomainCommitPlanV2(edited, draftId, { taskTempIds: ['save'], materialTempIds: [], timePointTempIds: [],
      eventTempIds: [], taskOverrides: { save: { deadline: edit.value } } })
    const fault = vi.spyOn(x.store, 'transaction').mockImplementationOnce(async (key, mutate) => transaction(key, raw => { mutate(raw); throw Error('INJECTED_CONFIRM_FAILURE') }))
    await expect(x.runtime.confirm({ draftId, revision: view.revision, taskTempIds: ['save'] })).rejects.toThrow('INJECTED_CONFIRM_FAILURE')
    expect(await x.runtime.load()).toEqual(edited); fault.mockRestore()
    const saved = await x.runtime.confirm({ draftId, revision: view.revision, taskTempIds: ['save'] })
    expect(saved.timePoints[0].normalizedValue).toBe(plan.create.timePoints[0].normalizedValue)
    expect(saved.timePoints[0]).toMatchObject({ normalizedValue: edit.value, precision: 'date_only', isAllDay: true, timezone: null })
    expect(saved.sourceVersions).toEqual(original.sourceVersions)
    expect(saved.extractionDrafts[0].result).toEqual(original.extractionDrafts[0].result)
  })
  it('reused operation ID cannot return a different source or receipt', async () => {
    const x = await setup(), draft = await x.capture('multi', 'same-id')
    const before = await x.runtime.load()
    expect(await x.capture('multi', 'same-id')).toBe(draft)
    await expect(x.capture('no-date', 'same-id')).rejects.toThrow('HANDOFF_DUPLICATE_INPUT_MISMATCH')
    expect(await x.runtime.load()).toEqual(before)
  })
  it.each(['information', 'vague', 'condition-true', 'condition-false', 'condition-unknown', 'revision'] as const)('retains %s without unauthorized formal tasks', async kind => {
    const x = await setup()
    if (kind.startsWith('condition-')) await expect(x.capture(kind)).rejects.toThrow('CONTRACT_UNREPRESENTABLE')
    else {
      const id = await x.capture(kind), saved = await x.runtime.load(), view = x.runtime.review(saved, id)
      expect(view.draft.items.every(item => !item.selected)).toBe(true)
    }
    const saved = await x.runtime.load()
    expect(saved.sources).toHaveLength(1); expect(saved.tasks).toHaveLength(0)
    expect(saved.sources[0].legacyData?.mainline03Handoff).toBeTruthy()
  })
})
