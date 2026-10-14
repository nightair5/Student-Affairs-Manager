import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { engineeringReceipt, engineeringReceipts, createReplayHandoff, seenReceipt, SEEN_CASE_IDS } from './seenReplay'
import { LABEL, notices } from '../mainline01/fixtures'
import { bindRecognitionReceipt, sealReceipt, sha256Text } from './recognitionHandoff'
import type { JsonValue } from '../../domain/v2/types'

const fixtureSha = 'sha256:' + createHash('sha256').update(readFileSync('src/experiments/mainline01/fixtures.ts')).digest('hex')
const dataPath = 'docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json'
const rawPath = 'docs/recognition-optimization/rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a/raw-results.json'
const hash = (path: string) => 'sha256:' + createHash('sha256').update(readFileSync(path)).digest('hex')
const handle = { sourceId: 'local', sourceVersionId: 'local:v1', recognitionRunId: 'local:r1', draftId: 'local:d1', duplicate: false }

function reversedObjectKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(reversedObjectKeys)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reversedObjectKeys(item)]))
}
describe('MAINLINE03 read-only replay provenance', () => {
  it('R1 retains raw whitespace and arbitrary object-key order, with exact embedded identity', async () => {
    const receipt = await engineeringReceipt('no-date', fixtureSha)
    const raw = receipt.rawResponse as { schemaVersion: string; promptVersion: string; modelName: string }
    expect(receipt).toMatchObject({ contractVersion: raw.schemaVersion, promptVersion: raw.promptVersion, originalModel: raw.modelName })
    expect(receipt.originalModel).toBe(LABEL)
    const rawOutputText = '\n ' + JSON.stringify(reversedObjectKeys(receipt.rawResponse), null, 2) + '\t\n'
    const { receiptSha256: oldSeal, ...body } = receipt
    void oldSeal
    const reordered = await sealReceipt({ ...body, rawOutputText, rawSha256: await sha256Text(rawOutputText) })
    const handoff = await createReplayHandoff([reordered]), selected = await handoff.prepare(receipt.sourceText)
    expect(selected.rawOutputText).toBe(rawOutputText)
    expect(selected.rawResponse).toEqual(receipt.rawResponse)
    expect((await handoff.recognize(selected, selected.sourceText, handle)).result.standaloneTasks[0].selected).toBe(true)
  })
  it('R1 records the actual pre-response failure without inventing response versions', async () => {
    const receipt = await engineeringReceipt('condition-unknown', fixtureSha)
    expect(receipt).toMatchObject({ originalModel: LABEL, rawResponse: null, rawOutputText: '',
      contractVersion: null, promptVersion: null, preparationFailure: 'UNREPRESENTABLE_CONDITION_STATE' })
    const { receiptSha256: oldSeal, ...body } = receipt
    void oldSeal
    await expect(sealReceipt({ ...body, promptVersion: 'invented' })).rejects.toThrow('HANDOFF_RECEIPT_IDENTITY_MISMATCH')
    await expect(sealReceipt({ ...body, preparationFailure: null })).rejects.toThrow('HANDOFF_RAW_RESPONSE_MISMATCH')
    await expect(sealReceipt({ ...body, kind: 'seen-model-candidate' })).rejects.toThrow('HANDOFF_RECEIPT_IDENTITY_MISMATCH')
  })
  it.each(SEEN_CASE_IDS)('R1 accepts harmless object order in seen %s without inventing absent metadata', async caseId => {
    const data = JSON.parse(readFileSync(dataPath, 'utf8')) as { cases: Array<{ id: string; sourceText: string }> }
    const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as { runId: string; records: Array<{
      caseId: string; responseModel: string; parsed: JsonValue; rawOutputText: string }> }
    const source = data.cases.find(item => item.id === caseId)!, record = raw.records.find(item => item.caseId === caseId)!
    const receipt = await seenReceipt({ caseId, sourceText: source.sourceText, runId: raw.runId, model: record.responseModel,
      rawOutputText: record.rawOutputText, parsed: reversedObjectKeys(record.parsed),
      originFiles: [{ path: dataPath, sha256: hash(dataPath) }, { path: rawPath, sha256: hash(rawPath) }] })
    expect(receipt).toMatchObject({ originalModel: record.responseModel, promptVersion: null,
      contractVersion: (record.parsed as { schemaVersion: string }).schemaVersion, rawOutputText: record.rawOutputText })
    const { receiptSha256: oldSeal, ...body } = receipt
    void oldSeal
    await expect(sealReceipt({ ...body, contractVersion: '2.0' })).rejects.toThrow('HANDOFF_RECEIPT_IDENTITY_MISMATCH')
    await expect(sealReceipt({ ...body, promptVersion: 'invented' })).rejects.toThrow('HANDOFF_RECEIPT_IDENTITY_MISMATCH')
    await expect(bindRecognitionReceipt(receipt, receipt.sourceText, handle)).rejects.toThrow('CONTRACT_UNREPRESENTABLE')
  })
  it('retains old eight input types and the original unknown failure without a replacement response', async () => {
    const receipts = await engineeringReceipts(fixtureSha)
    expect(receipts).toHaveLength(8)
    expect(receipts.find(item => item.originCaseId === 'condition-unknown')).toMatchObject({
      rawResponse: null, preparationFailure: 'UNREPRESENTABLE_CONDITION_STATE',
    })
    for (const kind of ['condition-true', 'condition-false', 'condition-unknown'] as const) {
      const receipt = receipts.find(item => item.originCaseId === kind)!
      await expect(bindRecognitionReceipt(receipt, receipt.sourceText, handle)).rejects.toThrow('CONTRACT_UNREPRESENTABLE')
    }
  })
  it.each(SEEN_CASE_IDS)('preserves seen %s raw output; never promotes anchor-only output to full tasks', async caseId => {
    const before = [hash(dataPath), hash(rawPath)]
    const data = JSON.parse(readFileSync(dataPath, 'utf8')) as { cases: Array<{ id: string; sourceText: string }> }
    const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as { runId: string; records: Array<{
      caseId: string; responseModel: string; parsed: unknown; rawOutputText: string }> }
    const source = data.cases.find(item => item.id === caseId)!, record = raw.records.find(item => item.caseId === caseId)!
    const receipt = await seenReceipt({ caseId, sourceText: source.sourceText, runId: raw.runId,
      model: record.responseModel, rawOutputText: record.rawOutputText, parsed: record.parsed,
      originFiles: [{ path: dataPath, sha256: before[0] }, { path: rawPath, sha256: before[1] }] })
    expect(receipt.kind).toBe('seen-model-candidate'); expect(receipt.seen).toBe(true)
    expect(receipt.originalModel).toBe('deepseek-v4-flash-vision-exp')
    expect(receipt.rawOutputText).toBe(record.rawOutputText)
    expect(JSON.stringify(receipt)).not.toMatch(/"expected"|"taskScore"|"evaluation"/i)
    await expect(bindRecognitionReceipt(receipt, receipt.sourceText, handle)).rejects.toThrow('CONTRACT_UNREPRESENTABLE')
    expect([hash(dataPath), hash(rawPath)]).toEqual(before)
  })
  it('freezes selection identity, rejects duplicate text and rejects unregistered text', async () => {
    const receipt = await engineeringReceipt('multi', fixtureSha)
    await expect(createReplayHandoff([receipt, receipt])).rejects.toThrow('HANDOFF_INPUT_AMBIGUOUS')
    const handoff = await createReplayHandoff([receipt])
    receipt.sourceText = 'mutated'
    const selected = await handoff.prepare(notices.multi)
    selected.sourceText = 'another mutation'
    expect((await handoff.prepare(notices.multi)).sourceText).toBe(notices.multi)
    await expect(handoff.prepare('not authorized')).rejects.toThrow('HANDOFF_INPUT_NOT_AUTHORIZED')
  })
  it('rejects oversized receipt without truncating or writing', async () => {
    const { receiptSha256: _seal, ...base } = await engineeringReceipt('multi', fixtureSha)
    void _seal
    const rawOutputText = 'x'.repeat(256 * 1024)
    await expect(sealReceipt({ ...base, rawOutputText, rawSha256: await sha256Text(rawOutputText) })).rejects.toThrow('HANDOFF_RECEIPT_TOO_LARGE')
  })
  it('counts UTF-16 positions and refuses to split a surrogate pair', async () => {
    const { receiptSha256: _seal, ...base } = await engineeringReceipt('multi', fixtureSha)
    void _seal
    const sourceText = '📋' + base.sourceText
    const receipt = await sealReceipt({ ...base, sourceText, inputSha256: await sha256Text(sourceText) })
    const bound = await bindRecognitionReceipt(receipt, sourceText, handle)
    expect(bound.result.evidence[0]).toMatchObject({ textStart: 2, textEnd: sourceText.length })
    expect(sourceText.slice(bound.result.evidence[0].textStart, bound.result.evidence[0].textEnd)).toBe(base.sourceText)
    const raw = structuredClone(bound.result)
    raw.evidence[0].sourceId = 'pending-source'; delete raw.evidence[0].textStart; delete raw.evidence[0].textEnd
    raw.evidence[0].quote = sourceText[1]; raw.evidence[0].quotedText = sourceText[1]
    const rawOutputText = JSON.stringify(raw)
    const invalid = await sealReceipt({ ...base, sourceText, inputSha256: await sha256Text(sourceText),
      rawResponse: JSON.parse(rawOutputText), rawOutputText, rawSha256: await sha256Text(rawOutputText),
      responseSha256: await sha256Text(rawOutputText) })
    const result = await bindRecognitionReceipt(invalid, sourceText, handle)
    expect(result.unresolved).toHaveLength(1)
    expect(result.result.evidence[0].textStart).toBeUndefined()
  })
})
