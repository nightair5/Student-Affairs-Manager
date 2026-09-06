import { describe, expect, it } from 'vitest'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { createMainlineRuntime } from '../mainline02/runtime'
import { artificialResponse, emptyWorkspace, notices } from '../mainline01/fixtures'

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { bindRecognitionReceipt, assertHandoffFidelity, jsonCopy, sealReceipt, sha256Text, type ReplayReceipt } from './recognitionHandoff'
import { createReplayHandoff, engineeringReceipt } from './seenReplay'
import type { RecognitionResult } from '../../recognition/types'

const fixtureSha = 'sha256:' + createHash('sha256').update(readFileSync('src/experiments/mainline01/fixtures.ts')).digest('hex')
const handle = { sourceId: 'source:local', sourceVersionId: 'source:local:version:1',
  recognitionRunId: 'source:local:run:1', draftId: 'source:local:draft:1', duplicate: false }
async function mutated(change: (value: RecognitionResult) => void): Promise<ReplayReceipt> {
  const receipt = await engineeringReceipt('multi', fixtureSha)
  const raw = structuredClone(receipt.rawResponse) as unknown as RecognitionResult
  change(raw)
  const rawResponse = jsonCopy(raw), rawOutputText = JSON.stringify(raw)
  const { receiptSha256: _seal, ...body } = receipt
  void _seal
  return sealReceipt({ ...body, rawResponse, rawOutputText, rawSha256: await sha256Text(rawOutputText),
    responseSha256: await sha256Text(JSON.stringify(rawResponse)) })
}
async function runtimeWith(receipt: ReplayReceipt) {
  const name = 'rco-mainline-01-02-i1-mainline03-' + crypto.randomUUID()
  const initialize = emptyWorkspace(); initialize.workspace.id = name
  const runtime = await createMainlineRuntime({ name, initialize,
    store: Object.assign(new MemoryWorkspaceRecordStore(), { name }),
    recognize: () => { throw Error('OLD_CALLBACK_MUST_NOT_RUN') }, handoff: await createReplayHandoff([receipt]) })
  return runtime
}
describe('MAINLINE03 constrained binding and preservation', () => {
  it.each(['contract', 'prompt', 'model', 'contract-null', 'prompt-null', 'contract-type', 'prompt-type', 'failure-type'] as const)('R1 rejects inconsistent or ill-typed %s identity despite a recomputed seal', async fault => {
    const receipt = await engineeringReceipt('no-date', fixtureSha)
    const patch = {
      contract: { contractVersion: '9.9' }, prompt: { promptVersion: 'wrong-version' }, model: { originalModel: 'wrong-model' },
      'contract-null': { contractVersion: null }, 'prompt-null': { promptVersion: null },
      'contract-type': { contractVersion: 2 }, 'prompt-type': { promptVersion: false }, 'failure-type': { preparationFailure: 0 },
    }[fault]
    const { receiptSha256: oldSeal, ...body } = receipt
    void oldSeal
    await expect(sealReceipt(Object.assign(body, patch))).rejects.toThrow(/HANDOFF_RECEIPT_(IDENTITY_MISMATCH|INVALID)/)
  })
  it.each(['malformed', 'missing-key', 'value-type', 'array-order'] as const)('R1 rejects raw JSON %s divergence without normalizing away facts', async fault => {
    const receipt = await engineeringReceipt('multi', fixtureSha)
    const raw = structuredClone(receipt.rawResponse) as unknown as RecognitionResult
    if (fault === 'missing-key') Reflect.deleteProperty(raw.standaloneTasks[0], 'estimatedMinutes')
    if (fault === 'value-type') Object.assign(raw.standaloneTasks[0], { estimatedMinutes: 'null' })
    if (fault === 'array-order') raw.standaloneTasks.reverse()
    const rawOutputText = fault === 'malformed' ? '{' : JSON.stringify(raw)
    const { receiptSha256: oldSeal, ...body } = receipt
    void oldSeal
    await expect(sealReceipt({ ...body, rawOutputText, rawSha256: await sha256Text(rawOutputText) }))
      .rejects.toThrow('HANDOFF_RAW_RESPONSE_MISMATCH')
    expect(receipt.rawResponse).toEqual(JSON.parse(receipt.rawOutputText))
  })
  it('binds only source and positions, never mutates the original response', async () => {
    const receipt = await engineeringReceipt('multi', fixtureSha), frozen = structuredClone(receipt)
    const bound = await bindRecognitionReceipt(receipt, notices.multi, handle)
    expect(bound.result.evidence[0]).toMatchObject({ sourceId: handle.sourceId, textStart: 0, textEnd: notices.multi.length })
    expect(bound.binding.sourceVersionId).toBe(handle.sourceVersionId)
    expect(bound.changes.map(row => row.field)).toEqual(['sourceId', 'textStart', 'textEnd'])
    expect(bound.unresolved).toEqual([])
    expect(receipt).toEqual(frozen)
    expect(() => assertHandoffFidelity(receipt.rawResponse as unknown as RecognitionResult, bound.result)).not.toThrow()
  })
  it('keeps already valid source and positions unchanged', async () => {
    const receipt = await mutated(raw => { raw.evidence[0].sourceId = handle.sourceId; raw.evidence[0].textStart = 0; raw.evidence[0].textEnd = notices.multi.length })
    expect((await bindRecognitionReceipt(receipt, notices.multi, handle)).changes).toEqual([])
  })
  it.each(['source', 'position', 'partial-position', 'quote-conflict', 'dangling-reference', 'unknown-actionability', 'extra-semantic'] as const)('rejects %s without rewriting a bad response', async fault => {
    const receipt = await mutated(raw => {
      if (fault === 'source') raw.evidence[0].sourceId = 'another-source'
      if (fault === 'position') { raw.evidence[0].textStart = 1; raw.evidence[0].textEnd = notices.multi.length }
      if (fault === 'partial-position') raw.evidence[0].textStart = 0
      if (fault === 'quote-conflict') raw.evidence[0].quote = 'PDF'
      if (fault === 'dangling-reference') raw.standaloneTasks[0].materialTempIds.push('missing')
      if (fault === 'unknown-actionability') Object.assign(raw.sourceSummary, { requiresAction: null })
      if (fault === 'extra-semantic') Object.assign(raw, { revisionRelations: [] })
    })
    const before = structuredClone(receipt)
    await expect(bindRecognitionReceipt(receipt, notices.multi, handle)).rejects.toThrow()
    expect(receipt).toEqual(before)
    const runtime = await runtimeWith(receipt)
    await expect(runtime.capture({ sourceType: 'text', content: receipt.sourceText })).rejects.toThrow()
    const saved = await runtime.load()
    expect(saved.sources[0].legacyData?.mainline03Handoff).toEqual(receipt)
    expect(saved.extractionDrafts[0]).toMatchObject({ status: 'failed', result: null })
    expect(saved.recognitionRuns[0].status).toBe('failed')
    expect(saved.tasks).toHaveLength(0)
  })
  it('leaves duplicate quote unbound and permits the independently valid sibling', async () => {
    const receipt = await mutated(raw => {
      raw.evidence.push({ ...raw.evidence[0], id: 'ambiguous', quote: '格式', quotedText: '格式' })
      raw.standaloneTasks[0].evidenceIds = ['ambiguous']
    })
    const result = await bindRecognitionReceipt(receipt, notices.multi, handle)
    expect(result.unresolved).toEqual([{ evidenceId: 'ambiguous', reason: 'QUOTE_POSITION_UNPROVEN' }])
    expect(result.result.evidence[1].sourceId).toBe('pending-source')
    expect(result.result.evidence[1].textStart).toBeUndefined()
    const runtime = await runtimeWith(receipt)
    const draftId = await runtime.capture({ sourceType: 'text', content: receipt.sourceText })
    const before = await runtime.load(), view = runtime.review(before, draftId)
    expect(view.draft.items.map(item => item.selected)).toEqual([false, true])
    await runtime.confirm({ draftId, revision: view.revision, taskTempIds: ['print'] })
    const saved = await runtime.load()
    expect(saved.tasks.map(task => task.legacyData?.recognitionTempId)).toEqual(['print'])
    expect(saved.extractionDrafts[0].result).toEqual(before.extractionDrafts[0].result)
  })
  it('rejects absent evidence quote rather than finding a near match', async () => {
    const receipt = await mutated(raw => { raw.evidence[0].quote = '原文不存在'; raw.evidence[0].quotedText = '原文不存在' })
    await expect(bindRecognitionReceipt(receipt, notices.multi, handle)).rejects.toThrow('HANDOFF_RESULT_SEMANTIC')
  })
  it('rejects sparse arrays, undefined fields, cycles and prototypes before JSON can hide them', () => {
    const sparse = [1, 2]; delete sparse[0]
    const cycle: Record<string, unknown> = {}; cycle.self = cycle
    for (const value of [sparse, { x: undefined }, cycle, new Date(), JSON.parse('{"__proto__":{}}')]) {
      expect(() => jsonCopy(value)).toThrow('HANDOFF_JSON_INVALID')
    }
  })
  it('detects receipt text/hash and capture identity tampering', async () => {
    const receipt = await engineeringReceipt('multi', fixtureSha)
    await expect(bindRecognitionReceipt({ ...receipt, inputSha256: 'wrong' }, notices.multi, handle)).rejects.toThrow('HASH_MISMATCH')
    await expect(bindRecognitionReceipt(receipt, notices['no-date'], handle)).rejects.toThrow('RECEIPT_INVALID')
    await expect(bindRecognitionReceipt(receipt, notices.multi, { ...handle, sourceVersionId: '' })).rejects.toThrow('CAPTURE_BINDING_INVALID')
  })
  it('detects any non-binding field loss including time raw and material requirements', async () => {
    const receipt = await engineeringReceipt('multi', fixtureSha)
    const bound = await bindRecognitionReceipt(receipt, notices.multi, handle)
    for (const change of [
      (r: RecognitionResult) => { r.timePoints[0].rawText = '' },
      (r: RecognitionResult) => { r.materials[0].formatRequirements = [] },
      (r: RecognitionResult) => { r.standaloneTasks[0].selected = false },
    ]) {
      const altered = structuredClone(bound.result); change(altered)
      expect(() => assertHandoffFidelity(bound.result, altered)).toThrow('HANDOFF_FIELD_LOSS')
    }
  })
  it('preserves material-only time linkage and explicit user choice restrictions', async () => {
    const receipt = await mutated(raw => {
      raw.timePoints[0].relatedTaskTempIds = []; raw.standaloneTasks[0].timePointTempIds = []
      raw.standaloneTasks[0].inferenceLevel = 'optional_suggestion'
    })
    const runtime = await runtimeWith(receipt), draftId = await runtime.capture({ sourceType: 'text', content: receipt.sourceText })
    const before = await runtime.load(), view = runtime.review(before, draftId)
    expect(view.draft.items.map(item => item.selected)).toEqual([false, true])
    await runtime.confirm({ draftId, revision: view.revision, taskTempIds: ['submit'] })
    const saved = await runtime.load()
    expect(saved.tasks).toHaveLength(1); expect(saved.timePoints).toHaveLength(1)
    expect(saved.timePoints[0].relatedMaterialIds).toEqual([saved.materials[0].id])
  })
  it('retains an event and its time while frozen V2 blocks the related task', async () => {
    const receipt = await mutated(raw => {
      raw.events = [{ tempId: 'event', title: '已有时间的工程关联', description: '', startTimePointTempId: 'd0',
        endTimePointTempId: null, location: null, evidenceIds: ['notice'], confidence: 1, inferenceLevel: 'explicit', selected: true }]
    })
    const runtime = await runtimeWith(receipt), draftId = await runtime.capture({ sourceType: 'text', content: receipt.sourceText })
    const before = await runtime.load(), view = runtime.review(before, draftId)
    expect(Object.values(view.states)[0].blockedReason).toContain('EVENT_REQUIRES_SEPARATE_CONFIRMATION')
    expect(view.draft.items.map(item => item.selected)).toEqual([false, true])
    expect(before.extractionDrafts[0].result?.events).toEqual((receipt.rawResponse as unknown as RecognitionResult).events)
  })
})

describe('MAINLINE03 evidence handoff', () => {
  it('reproduces service-shaped evidence rejected by frozen V2 without writes', async () => {
    const name = 'rco-mainline-01-02-i1-mainline03-reproduction'
    const initialize = emptyWorkspace(); initialize.workspace.id = name
    const raw = artificialResponse('multi', 'pending-source')
    raw.evidence.forEach(item => { delete item.textStart; delete item.textEnd })
    const runtime = await createMainlineRuntime({ name, initialize,
      store: Object.assign(new MemoryWorkspaceRecordStore(), { name }), recognize: () => structuredClone(raw) })
    const draftId = await runtime.capture({ sourceType: 'text', content: notices.multi })
    const before = await runtime.load(), view = runtime.review(before, draftId)
    expect(Object.values(view.states).map(item => item.blockedReason)).toEqual([
      'CONFIRMATION_V2_EVIDENCE_INVALID', 'CONFIRMATION_V2_EVIDENCE_INVALID',
    ])
    expect(view.draft.items.every(item => item.selected === false)).toBe(true)
    await expect(runtime.confirm({ draftId, revision: view.revision, taskTempIds: ['submit', 'print'] })).rejects.toThrow('EVIDENCE_INVALID')
    expect(await runtime.load()).toEqual(before)
    expect(before.tasks).toHaveLength(0)
    expect(before.extractionDrafts[0].result).toEqual(raw)
  })
})
