import type { CaptureHandle } from '../../domain/v2/capture'
import type { JsonValue } from '../../domain/v2/types'
import { validateRecognitionResult } from '../../recognition/schema'
import type { RecognitionResult } from '../../recognition/types'

export type ReplayKind = 'engineering' | 'engineering-service-shaped' | 'seen-model-candidate'
export interface ReplayReceipt {
  receiptVersion: 'mainline03-receipt-1'
  kind: ReplayKind
  seen: true
  sourceText: string
  inputSha256: string
  rawResponse: JsonValue
  rawOutputText: string
  rawSha256: string
  responseSha256: string
  originalModel: string
  promptVersion: string | null
  contractVersion: string | null
  originRunId: string
  originCaseId: string
  originFiles: Array<{ path: string; sha256: string }>
  preparationFailure: string | null
  receiptSha256: string
}
export interface HandoffBinding {
  sourceId: string; sourceVersionId: string; recognitionRunId: string; draftId: string; inputSha256: string
}
export interface HandoffResult {
  result: RecognitionResult
  binding: HandoffBinding
  changes: Array<{ evidenceId: string; field: 'sourceId' | 'textStart' | 'textEnd'; before: JsonValue; after: JsonValue }>
  unresolved: Array<{ evidenceId: string; reason: string }>
}
function fail(code: string): never { throw new Error(code) }

export function jsonCopy(value: unknown): JsonValue {
  const seen = new Set<object>()
  function valid(item: unknown): item is JsonValue {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return true
    if (typeof item === 'number') return Number.isFinite(item)
    if (typeof item !== 'object' || seen.has(item)) return false
    seen.add(item)
    if (Array.isArray(item)) return Object.keys(item).length === item.length
      && Array.from({ length: item.length }, (_, i) => Object.hasOwn(item, i) && valid(item[i])).every(Boolean)
    return (Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null)
      && Object.entries(item).every(([key, entry]) => !['__proto__', 'constructor', 'prototype'].includes(key) && valid(entry))
  }
  if (!valid(value)) fail('HANDOFF_JSON_INVALID')
  return structuredClone(value)
}
export async function sha256Text(text: string): Promise<string> {
  return 'sha256:' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('')
}
// JSON object order is not identity; array order, own keys and value types are.
export function sameJsonValue(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => sameJsonValue(value, right[index]))
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && sameJsonValue(left[key], right[key]))
}

function verifyReceiptIdentity(receipt: ReplayReceipt) {
  const raw = receipt.rawResponse
  if (receipt.preparationFailure !== null) {
    // The frozen engineering producer throws before making any response. No response versions exist.
    if (receipt.kind === 'seen-model-candidate' || receipt.preparationFailure !== 'UNREPRESENTABLE_CONDITION_STATE'
      || raw !== null || receipt.rawOutputText !== '' || receipt.contractVersion !== null || receipt.promptVersion !== null)
      fail('HANDOFF_RECEIPT_IDENTITY_MISMATCH')
    return
  }
  let parsed: JsonValue
  try { parsed = jsonCopy(JSON.parse(receipt.rawOutputText)) }
  catch { fail('HANDOFF_RAW_RESPONSE_MISMATCH') }
  if (!sameJsonValue(parsed, raw)) fail('HANDOFF_RAW_RESPONSE_MISMATCH')
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)
    || typeof raw.schemaVersion !== 'string' || receipt.contractVersion !== raw.schemaVersion)
    fail('HANDOFF_RECEIPT_IDENTITY_MISMATCH')
  if (receipt.kind === 'seen-model-candidate') {
    // Historical model identity comes from the bound record, not a field absent from its JSON.
    if (raw.schemaVersion !== 'model-anchor-selection-1.0.0'
      || receipt.promptVersion !== (Object.hasOwn(raw, 'promptVersion') ? raw.promptVersion : null)
      || (Object.hasOwn(raw, 'modelName') && receipt.originalModel !== raw.modelName))
      fail('HANDOFF_RECEIPT_IDENTITY_MISMATCH')
  } else if (raw.schemaVersion !== '2.0' || typeof raw.promptVersion !== 'string' || !raw.promptVersion.trim()
    || typeof raw.modelName !== 'string' || !raw.modelName.trim()
    || receipt.promptVersion !== raw.promptVersion || receipt.originalModel !== raw.modelName) {
    fail('HANDOFF_RECEIPT_IDENTITY_MISMATCH')
  }
}
export async function sealReceipt(input: Omit<ReplayReceipt, 'receiptSha256'>): Promise<ReplayReceipt> {
  const body = jsonCopy(input)
  const receipt = { ...input, receiptSha256: await sha256Text(JSON.stringify(body)) }
  await verifyReceipt(receipt, input.sourceText)
  return structuredClone(receipt)
}
export async function verifyReceipt(receipt: ReplayReceipt, sourceText: string) {
  const clone = jsonCopy(receipt)
  if (new TextEncoder().encode(JSON.stringify(clone)).byteLength > 256 * 1024) fail('HANDOFF_RECEIPT_TOO_LARGE')
  const { receiptSha256, ...body } = receipt
  const keys = ['receiptVersion','kind','seen','sourceText','inputSha256','rawResponse','rawOutputText','rawSha256',
    'responseSha256','originalModel','promptVersion','contractVersion','originRunId','originCaseId','originFiles','preparationFailure','receiptSha256']
  if (Object.keys(receipt).sort().join('|') !== keys.sort().join('|')
    || receipt.receiptVersion !== 'mainline03-receipt-1' || receipt.seen !== true
    || !['engineering', 'engineering-service-shaped', 'seen-model-candidate'].includes(receipt.kind)
    || typeof sourceText !== 'string' || !sourceText.trim() || receipt.sourceText !== sourceText
    || typeof receipt.rawOutputText !== 'string' || typeof receipt.originalModel !== 'string'
    || !receipt.originalModel.trim() || typeof receipt.originRunId !== 'string' || !receipt.originRunId.trim()
    || typeof receipt.originCaseId !== 'string' || !receipt.originCaseId.trim()
    || !(receipt.promptVersion === null || (typeof receipt.promptVersion === 'string' && receipt.promptVersion.trim()))
    || !(receipt.contractVersion === null || (typeof receipt.contractVersion === 'string' && receipt.contractVersion.trim()))
    || !(receipt.preparationFailure === null || typeof receipt.preparationFailure === 'string')
    || !Array.isArray(receipt.originFiles) || receipt.originFiles.length === 0
    || receipt.originFiles.some(file => typeof file.path !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(file.sha256))) fail('HANDOFF_RECEIPT_INVALID')
  if (await sha256Text(sourceText) !== receipt.inputSha256
    || await sha256Text(receipt.rawOutputText) !== receipt.rawSha256
    || await sha256Text(JSON.stringify(receipt.rawResponse)) !== receipt.responseSha256
    || await sha256Text(JSON.stringify(body)) !== receiptSha256) fail('HANDOFF_RECEIPT_HASH_MISMATCH')
  verifyReceiptIdentity(receipt)
}
function boundary(text: string, index: number) {
  return !(index > 0 && index < text.length && /[\uD800-\uDBFF]/.test(text[index - 1]) && /[\uDC00-\uDFFF]/.test(text[index]))
}
function stripBinding(result: RecognitionResult) {
  const copy = structuredClone(result)
  copy.evidence.forEach(item => {
    item.sourceId = ''
    delete item.textStart; delete item.textEnd
  })
  return copy
}
export function assertHandoffFidelity(before: RecognitionResult, after: RecognitionResult) {
  if (JSON.stringify(stripBinding(before)) !== JSON.stringify(stripBinding(after))) fail('HANDOFF_FIELD_LOSS')
}
export async function bindRecognitionReceipt(receipt: ReplayReceipt, sourceText: string, handle: CaptureHandle): Promise<HandoffResult> {
  await verifyReceipt(receipt, sourceText)
  if ([handle.sourceId, handle.sourceVersionId, handle.recognitionRunId, handle.draftId].some(id => typeof id !== 'string' || !id))
    fail('HANDOFF_CAPTURE_BINDING_INVALID')
  if (receipt.kind === 'seen-model-candidate' || receipt.preparationFailure !== null) fail('CONTRACT_UNREPRESENTABLE')
  const validation = validateRecognitionResult(receipt.rawResponse, { sourceContent: sourceText })
  if (!validation.valid) fail('HANDOFF_RESULT_' + validation.failureCategory?.toUpperCase())
  const before = receipt.rawResponse as unknown as RecognitionResult
  // Explicit structured condition questions have no equivalent condition-state field in the frozen target.
  if (before.ambiguities.some(item => item.field === 'condition')) fail('CONTRACT_UNREPRESENTABLE')
  const result = structuredClone(before)
  const changes: HandoffResult['changes'] = [], unresolved: HandoffResult['unresolved'] = []
  for (const item of result.evidence) {
    if (item.sourceId !== 'pending-source' && item.sourceId !== handle.sourceId) fail('HANDOFF_SOURCE_MISMATCH')
    if (!item.quote || !item.quotedText || item.quote !== item.quotedText) fail('HANDOFF_EVIDENCE_TEXT_CONFLICT')
    const quote = item.quotedText
    const hasStart = Object.hasOwn(item, 'textStart'), hasEnd = Object.hasOwn(item, 'textEnd')
    const first = sourceText.indexOf(quote)
    const unique = first >= 0 && sourceText.indexOf(quote, first + 1) === -1
    let start = item.textStart, end = item.textEnd
    if (hasStart || hasEnd) {
      if (!hasStart || !hasEnd || !Number.isInteger(start) || !Number.isInteger(end)
        || start! < 0 || end! <= start! || end! > sourceText.length
        || !boundary(sourceText, start!) || !boundary(sourceText, end!) || sourceText.slice(start!, end!) !== quote)
        fail('HANDOFF_EXISTING_POSITION_INVALID')
    } else {
      if (!unique || !boundary(sourceText, first) || !boundary(sourceText, first + quote.length)) {
        unresolved.push({ evidenceId: item.id, reason: first < 0 ? 'QUOTE_NOT_FOUND' : 'QUOTE_POSITION_UNPROVEN' })
        continue
      }
      start = first; end = first + quote.length
    }
    for (const field of ['sourceId', 'textStart', 'textEnd'] as const) {
      const value = field === 'sourceId' ? handle.sourceId : field === 'textStart' ? start! : end!
      if (item[field] !== value) changes.push({ evidenceId: item.id, field, before: item[field] ?? null, after: value })
    }
    item.sourceId = handle.sourceId; item.textStart = start; item.textEnd = end
  }
  assertHandoffFidelity(before, result)
  if (!validateRecognitionResult(result, { sourceContent: sourceText }).valid) fail('HANDOFF_ADAPTED_RESULT_INVALID')
  return { result, changes, unresolved, binding: { sourceId: handle.sourceId, sourceVersionId: handle.sourceVersionId,
    recognitionRunId: handle.recognitionRunId, draftId: handle.draftId, inputSha256: receipt.inputSha256 } }
}
