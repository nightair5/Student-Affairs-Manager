import type { CaptureHandle } from '../../domain/v2/capture'
import type { IntakeInput } from '../../lib/intake'
import type { RecognitionResult } from '../../recognition/types'
import { composeSemantics, type ComposeContext } from '../mainline04/semanticComposer'
import { parseSemanticInput, plainJson, type SemanticInput } from '../mainline04/semanticContract'
import { STATE_VERSION, REAL_STATE_VERSION, assert, equal, json, saveState, canonicalFacts, isCurrentDraft, isLatestDraft,
  semanticRevision, type SemanticState, type RealInputState, type RealInputReading } from './semanticState'
import { parseModelEnvelope, FLASH41_MODEL_NAME, MODEL_NAME } from '../realInput01/modelWire'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
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

/** Explicit wire completion only; the old human callback restriction above remains intact.
 * beginInputRun has already atomically saved Source/Version/Run/Draft before dispatch. */
export async function completeInputRun(repo: SemanticRepository, handle: CaptureHandle, rawHttpText: string) {
  assert(repo.profile === 'real-input-01' && !handle.duplicate, 'LIVE_COMPLETION_NOT_DISPATCHABLE')
  const before = await repo.load(), draft = before.extractionDrafts.find(d => d.id === handle.draftId)
  const run = before.recognitionRuns.find(r => r.id === handle.recognitionRunId)
  const version = before.sourceVersions.find(v => v.id === handle.sourceVersionId)
  assert(draft && run && version && run.sourceVersionId === version.id && version.sourceId === handle.sourceId
    && draft.recognitionRunId === run.id && ['queued','running'].includes(run.status), 'LIVE_COMPLETION_CHAIN')
  const pending = draft.legacyData!.realInputPending as unknown as { reading: RealInputReading; execution: RealInputState['execution'] }
  const now = new Date().toISOString()
  try {
    assert(isCurrentDraft(before, draft.id), 'STALE_RELOAD_REQUIRED')
    const context: ComposeContext = { index: await indexImmutableScopesV11(handle.sourceId, handle.sourceVersionId, version.rawText!),
      authority: 'live_model_candidate', profile: 'real-input-01', referenceTime: pending.reading.sendSnapshot!.consentAt,
      timezone: 'Asia/Shanghai', ownershipMode: 'mainline05-own-assets-1' }
    const parsed = parseModelEnvelope(rawHttpText, context, run.modelName === FLASH41_MODEL_NAME ? FLASH41_MODEL_NAME : MODEL_NAME), first = await composeSemantics(parsed.adaptedResponse, context)
    assert(!first.issues.some(i => ['BAD_ENTITY_REFERENCE','BAD_REVISION_REFERENCE'].includes(i.code)), 'INVALID_ENTITY_REFERENCE')
    const state: RealInputState = { version: REAL_STATE_VERSION, sourceId: handle.sourceId, sourceVersionId: handle.sourceVersionId,
      runId: run.id, draftId: draft.id, rawHttpText: parsed.rawHttpText, rawOutputText: parsed.rawOutputText,
      rawResponse: parsed.rawResponse, adaptedResponse: parsed.adaptedResponse, legacyResponse: null, context, first,
      inputReceipt: pending.reading.inputReceipt, sendSnapshot: pending.reading.sendSnapshot!, execution: pending.execution,
      operations: [], bindings: {} }
    state.bindings = canonicalFacts(state).bindings
    await repo.transaction(w => {
      assert(isCurrentDraft(w, draft.id), 'STALE_RELOAD_REQUIRED')
      const current = w.recognitionRuns.find(r => r.id === run.id)
      assert(current && ['queued','running'].includes(current.status), 'DUPLICATE_COMPLETION')
      return saveState({ ...w,
        recognitionRuns: w.recognitionRuns.map(r => r.id === run.id ? { ...r, status: 'succeeded', schemaVersion: REAL_STATE_VERSION, completedAt: now } : r),
        extractionDrafts: w.extractionDrafts.map(d => d.id === draft.id ? { ...d, status: 'needs_review', updatedAt: now } : d),
        sources: w.sources.map(s => s.id === handle.sourceId ? { ...s, status: 'needs_review', updatedAt: now } : s), savedAt: now }, state)
    })
  } catch (error) {
    await failInputRun(repo, handle, rawHttpText)
    throw error
  }
  return draft.id
}
export async function failInputRun(repo: SemanticRepository, handle: CaptureHandle, safeRawResponse: string | null = null) {
  assert(repo.profile === 'real-input-01', 'EXPLICIT_REAL_INPUT_REQUIRED')
  const now = new Date().toISOString()
  await repo.transaction(w => {
    const current = w.recognitionRuns.find(r => r.id === handle.recognitionRunId)
    assert(current && ['queued','running'].includes(current.status), 'RUN_ALREADY_TERMINAL')
    return { ...w,
      recognitionRuns: w.recognitionRuns.map(r => r.id === current.id ? { ...r, status: 'failed', errorCode: 'SEMANTIC_RESPONSE_REJECTED', completedAt: now } : r),
      extractionDrafts: w.extractionDrafts.map(d => d.id === handle.draftId ? { ...d, status: 'failed', updatedAt: now,
        legacyData: { ...d.legacyData, mainline05Failure: { version: REAL_STATE_VERSION, response: safeRawResponse, code: 'SEMANTIC_RESPONSE_REJECTED' } } } : d),
      // A stale input cannot yield suggestions, but its latest run must still
      // reach a terminal failure without leaving the source "extracting".
      sources: w.sources.map(s => s.id === handle.sourceId && isLatestDraft(w, handle.draftId) ? { ...s, status: 'failed', updatedAt: now } : s), savedAt: now }
  })
}

/** User explicitly opens a failed, structurally parseable answer for correction.
 * This never dispatches a request or upgrades the failed recognition run. */
export async function openFailedForCorrection(repo: SemanticRepository, draftId: string, revision: string, now=new Date().toISOString()) {
  assert(repo.profile==='real-input-01','EXPLICIT_REAL_INPUT_REQUIRED')
  const before=await repo.load();assert(semanticRevision(before)===revision,'STALE_RELOAD_REQUIRED')
  const draft=before.extractionDrafts.find(d=>d.id===draftId)
  assert(draft&&draft.status==='failed'&&!draft.legacyData?.mainline05&&isCurrentDraft(before,draftId),'FAILED_RESPONSE_REQUIRED')
  const run=before.recognitionRuns.find(r=>r.id===draft.recognitionRunId)!,version=before.sourceVersions.find(v=>v.id===run.sourceVersionId)!
  const failure=draft.legacyData?.mainline05Failure as {response?:unknown}|undefined
  assert(typeof failure?.response==='string','FAILED_RESPONSE_NOT_PARSEABLE')
  const pending=draft.legacyData!.realInputPending as unknown as {reading:RealInputReading;execution:RealInputState['execution']}
  const context:ComposeContext={index:await indexImmutableScopesV11(version.sourceId,version.id,version.rawText!),authority:'live_model_candidate',
    profile:'real-input-01',referenceTime:pending.reading.sendSnapshot!.consentAt,timezone:'Asia/Shanghai',ownershipMode:'mainline05-own-assets-1'}
  const parsed=parseModelEnvelope(failure.response,context,run.modelName === FLASH41_MODEL_NAME ? FLASH41_MODEL_NAME : MODEL_NAME),first=await composeSemantics(parsed.adaptedResponse,context)
  const state:RealInputState={version:REAL_STATE_VERSION,sourceId:version.sourceId,sourceVersionId:version.id,runId:run.id,draftId,
    rawHttpText:parsed.rawHttpText,rawOutputText:parsed.rawOutputText,rawResponse:parsed.rawResponse,adaptedResponse:parsed.adaptedResponse,
    legacyResponse:null,context,first,inputReceipt:pending.reading.inputReceipt,sendSnapshot:pending.reading.sendSnapshot!,execution:pending.execution,
    recovery:{kind:'user_opened_failed_response',at:now},operations:[{id:'material-review-mode-1',kind:'enable_material_review',at:now,taskIds:[],field:null,value:null,before:null}],bindings:{}}
  const facts=canonicalFacts(state);state.bindings=facts.bindings
  return repo.transaction(w=>{assert(semanticRevision(w)===revision,'STALE_RELOAD_REQUIRED');return saveState({...w,
    historyRecords:[...w.historyRecords,...facts.historyRecords],
    extractionDrafts:w.extractionDrafts.map(d=>d.id===draftId?{...d,status:'needs_review',updatedAt:now}:d),
    sources:w.sources.map(s=>s.id===version.sourceId?{...s,status:'needs_review',updatedAt:now}:s),savedAt:now},state)})
}
