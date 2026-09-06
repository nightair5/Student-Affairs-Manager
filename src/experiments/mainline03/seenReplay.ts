import { artificialResponse, cases, LABEL, notices, type CaseName } from '../mainline01/fixtures'
import { bindRecognitionReceipt, jsonCopy, sameJsonValue, sealReceipt, sha256Text, verifyReceipt, type ReplayReceipt } from './recognitionHandoff'
import type { CaptureHandle } from '../../domain/v2/capture'
import type { RecognitionResult } from '../../recognition/types'

export const SEEN_CASE_IDS = ['rco-task-b8-01', 'rco-task-b8-07', 'rco-task-b8-09'] as const
export interface SeenInput {
  caseId: string; sourceText: string; runId: string; model: string; rawOutputText: string
  parsed: unknown; originFiles: ReplayReceipt['originFiles']
}
export interface ReplayHandoff {
  readonly description: string
  prepare(text: string): Promise<ReplayReceipt>
  recognize(receipt: ReplayReceipt, text: string, handle: CaptureHandle): ReturnType<typeof bindRecognitionReceipt>
}
const verified = new WeakSet<object>()
export function assertReplayHandoff(value: ReplayHandoff) {
  if (!verified.has(value)) throw new Error('HANDOFF_CONFIGURATION_INVALID')
}
export async function engineeringReceipt(kind: CaseName, fixtureSha256: string): Promise<ReplayReceipt> {
  let rawResponse: RecognitionResult | null = null, preparationFailure: string | null = null
  try {
    const response = artificialResponse(kind, 'pending-source')
    response.evidence.forEach(item => { delete item.textStart; delete item.textEnd })
    rawResponse = response
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'UNREPRESENTABLE_CONDITION_STATE') throw error
    preparationFailure = error.message
  }
  const raw = jsonCopy(rawResponse), rawOutputText = raw === null ? '' : JSON.stringify(raw)
  return sealReceipt({ receiptVersion: 'mainline03-receipt-1', kind: 'engineering-service-shaped', seen: true,
    sourceText: notices[kind], inputSha256: await sha256Text(notices[kind]), rawResponse: raw, rawOutputText,
    rawSha256: await sha256Text(rawOutputText), responseSha256: await sha256Text(JSON.stringify(raw)),
    originalModel: rawResponse?.modelName ?? LABEL,
    promptVersion: rawResponse?.promptVersion ?? null, contractVersion: rawResponse?.schemaVersion ?? null,
    originRunId: 'mainline01-engineering-response', originCaseId: kind,
    originFiles: [{ path: 'src/experiments/mainline01/fixtures.ts', sha256: fixtureSha256 }], preparationFailure })
}
export async function seenReceipt(input: SeenInput): Promise<ReplayReceipt> {
  if (!(SEEN_CASE_IDS as readonly string[]).includes(input.caseId)) throw new Error('HANDOFF_SEEN_CASE_NOT_AUTHORIZED')
  const parsed = jsonCopy(input.parsed)
  if (!sameJsonValue(jsonCopy(JSON.parse(input.rawOutputText)), parsed)) throw new Error('HANDOFF_SEEN_RAW_PARSED_MISMATCH')
  return sealReceipt({ receiptVersion: 'mainline03-receipt-1', kind: 'seen-model-candidate', seen: true,
    sourceText: input.sourceText, inputSha256: await sha256Text(input.sourceText), rawResponse: parsed,
    rawOutputText: input.rawOutputText, rawSha256: await sha256Text(input.rawOutputText),
    responseSha256: await sha256Text(JSON.stringify(parsed)), originalModel: input.model, promptVersion: null,
    contractVersion: 'model-anchor-selection-1.0.0', originRunId: input.runId, originCaseId: input.caseId,
    originFiles: input.originFiles, preparationFailure: null })
}
export async function createReplayHandoff(receipts: readonly ReplayReceipt[]): Promise<ReplayHandoff> {
  const fixed = structuredClone(receipts)
  for (const receipt of fixed) await verifyReceipt(receipt, receipt.sourceText)
  if (new Set(fixed.map(item => item.sourceText)).size !== fixed.length) throw new Error('HANDOFF_INPUT_AMBIGUOUS')
  const handoff: ReplayHandoff = Object.freeze({
    description: '来源交接实验：人工工程响应或已见候选回放；无新模型调用，非识别准确率测试',
    async prepare(text: string) {
      const found = fixed.filter(item => item.sourceText === text)
      if (found.length !== 1) throw new Error('HANDOFF_INPUT_NOT_AUTHORIZED')
      return structuredClone(found[0])
    },
    recognize: bindRecognitionReceipt,
  })
  verified.add(handoff)
  return handoff
}
export async function engineeringReceipts(fixtureSha256: string) {
  return Promise.all(cases.map(kind => engineeringReceipt(kind, fixtureSha256)))
}
