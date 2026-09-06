import type { CaptureHandle } from '../../domain/v2/capture'
import type { IntakeInput } from '../../lib/intake'
import type { RecognitionResult } from '../../recognition/types'
import { composeSemantics, type ComposeContext } from '../mainline04/semanticComposer'
import { parseSemanticInput, plainJson, type SemanticInput } from '../mainline04/semanticContract'
import { STATE_VERSION, assert, equal, json, saveState, canonicalFacts, type SemanticState } from './semanticState'
import type { SemanticRepository } from './semanticRepository'

export interface SemanticReply {
  rawOutputText: string; rawResponse: SemanticInput; context: ComposeContext; legacyResponse: RecognitionResult | null
}
export type SemanticRecognizer = (text: string, handle: CaptureHandle) => Promise<SemanticReply>
// This is injected engineering work, never a network recognizer.
export async function captureSemantic(repo: SemanticRepository, input: IntakeInput, recognize: SemanticRecognizer) {
  // This entry accepts a locally injected callback, not an unvalidated pre-existing receipt.
  // A supplied receipt object is rejected before the source transaction.
  assert(typeof recognize === 'function', 'RECEIPT_PRECHECK_CALLBACK_REQUIRED')
  assert(input.sourceType === 'text' && !input.manualSuggestion && !input.multimodal && !input.url && !input.fileName
    && typeof input.content === 'string' && input.content.trim() && input.content.length <= 24000, 'TEXT_ONLY')
  const handle = await repo.beginSource({ operationId: input.operationId ?? crypto.randomUUID(), sourceType: 'text',
    title: input.sourceTitle || '人工工程通知（非模型预测）', rawText: input.content, provider: 'manual',
    modelName: 'human_engineering', promptVersion: 'engineering-mainline-01', pipelineVersion: STATE_VERSION })
  const initial = await repo.load()
  const prior = initial.extractionDrafts.find(d => d.id === handle.draftId)!
  if (handle.duplicate) {
    assert(prior.status !== 'failed' && prior.status !== 'processing', 'CAPTURE_RETRY_REQUIRES_NEW_EXPLICIT_OPERATION')
    return handle.draftId
  }
  await repo.transaction(w => ({ ...w, recognitionRuns: w.recognitionRuns.map(r => r.id === handle.recognitionRunId
    ? { ...r, status: 'running', schemaVersion: STATE_VERSION } : r) }))
  let rejectedResponse: ReturnType<typeof json> = null
  try {
    const response = plainJson(await recognize(input.content, handle))
    rejectedResponse = json(response)
    assert(typeof response.rawOutputText === 'string' && equal(JSON.parse(response.rawOutputText), response.rawResponse), 'RAW_RESPONSE_MISMATCH')
    const raw = parseSemanticInput(response.rawResponse)
    assert(raw.sourceId === handle.sourceId && raw.sourceVersionId === handle.sourceVersionId
      && response.context.index.sourceContent === input.content, 'RESPONSE_SOURCE_MISMATCH')
    assert(response.context.authority === 'human_engineering', 'UNVERIFIED_CANDIDATE_NOT_EXPRESSIBLE')
    const first = await composeSemantics(raw, response.context)
    assert(!first.issues.some(i => ['BAD_ENTITY_REFERENCE', 'BAD_REVISION_REFERENCE'].includes(i.code)), 'INVALID_ENTITY_REFERENCE')
    const state: SemanticState = { version: STATE_VERSION, sourceId: handle.sourceId, sourceVersionId: handle.sourceVersionId,
      runId: handle.recognitionRunId, draftId: handle.draftId, rawOutputText: response.rawOutputText,
      rawResponse: raw, legacyResponse: json(response.legacyResponse), context: response.context, first, operations: [], bindings: {} }
    state.bindings = canonicalFacts(state).bindings
    const now = new Date().toISOString()
    await repo.transaction(w => saveState({ ...w,
      recognitionRuns: w.recognitionRuns.map(r => r.id === state.runId ? { ...r, status: 'succeeded', completedAt: now, durationMs: null } : r),
      extractionDrafts: w.extractionDrafts.map(d => d.id === state.draftId ? { ...d, status: 'needs_review', updatedAt: now } : d),
      sources: w.sources.map(s => s.id === state.sourceId ? { ...s, status: 'needs_review', updatedAt: now } : s), savedAt: now }, state))
  } catch (error) {
    const now = new Date().toISOString()
    await repo.transaction(w => ({ ...w,
      recognitionRuns: w.recognitionRuns.map(r => r.id === handle.recognitionRunId ? { ...r, status: 'failed',
        errorCode: 'SEMANTIC_RESPONSE_REJECTED', completedAt: now } : r),
      extractionDrafts: w.extractionDrafts.map(d => d.id === handle.draftId ? { ...d, status: 'failed', updatedAt: now,
        legacyData: { ...d.legacyData, mainline05Failure: { version: STATE_VERSION, response: rejectedResponse,
          code: 'SEMANTIC_RESPONSE_REJECTED' } } } : d),
      sources: w.sources.map(s => s.id === handle.sourceId ? { ...s, status: 'failed', updatedAt: now } : s), savedAt: now }))
    throw error
  }
  return handle.draftId
}
