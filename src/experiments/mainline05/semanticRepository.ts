import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore, type WorkspaceRecordStore } from '../../domain/v2/repository'
import { CapturePersistenceService, type CaptureRequest, type CaptureHandle, type SourceOnlyHandle } from '../../domain/v2/capture'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { assert, equal, json, realDatabaseName, readingOf, REAL_STATE_VERSION, semanticRevision, validateSemanticWorkspace, type RealInputReading } from './semanticState'
import { plainJson } from '../mainline04/semanticContract'
import { validateInputReceipt, validateSendSnapshot, type InputReceipt } from '../realInput01/inputReceipt'
import { MODEL_NAME, PROMPT_VERSION } from '../realInput01/modelWire'

export class SemanticRepository {
  private constructor(private readonly canonical: CanonicalWorkspaceRepository, readonly name: string, readonly profile?: 'real-input-01') {}
  static async open(name: string, transport: WorkspaceRecordStore & { readonly name: string }, initial?: WorkspaceV8, profile?: 'real-input-01') {
    assert(profile === 'real-input-01' ? realDatabaseName(name) : /^rco-mainline-01-02-i1-mainline05-[a-z0-9-]{10,100}$/.test(name), 'DATABASE_NAME')
    const check = (key: string) => assert(transport.name === name && key === 'current', 'STORE_BINDING')
    const store: WorkspaceRecordStore = {
      read: key => { check(key); return transport.read(key) },
      write: (key, value) => { check(key); return transport.write(key, value) },
      transaction: (key, mutate) => { check(key); return transport.transaction(key, mutate) },
      remove: async () => { throw Error('MAINLINE05_DELETE_FORBIDDEN') },
      transactionMany: async () => { throw Error('MAINLINE05_MIGRATION_FORBIDDEN') },
    }
    const canonical = new CanonicalWorkspaceRepository(store)
    if (initial) {
      assert(await store.read('current') === undefined && initial.workspace.id === name
        && Object.values(initial).every(v => !Array.isArray(v) || v.length === 0), 'INITIALIZATION_REJECTED')
      await validateSemanticWorkspace(initial, profile)
      await canonical.save(initial)
    }
    const repo = new SemanticRepository(canonical, name, profile)
    await repo.load()
    return repo
  }
  async load(): Promise<WorkspaceV8> {
    const saved = await this.canonical.load()
    assert(saved && saved.workspace.id === this.name, 'WORKSPACE_MISSING_OR_WRONG')
    return validateSemanticWorkspace(saved, this.profile)
  }
  async beginSource(request: CaptureRequest) {
    assert(this.profile === undefined, 'REAL_INPUT_REQUIRES_SOURCE_STAGE')
    const before = await this.load()
    const prior = before.sources.find(s => s.legacyData?.captureOperationId === request.operationId)
    if (prior) {
      const version = before.sourceVersions.find(v => v.id === prior.currentVersionId)
      assert(version?.rawText === request.rawText && prior.type === request.sourceType, 'CAPTURE_OPERATION_COLLISION')
    }
    const handle = await new CapturePersistenceService(this.canonical).beginCapture(request)
    await this.load()
    return handle
  }
  async transaction(mutate: (current: WorkspaceV8) => WorkspaceV8): Promise<WorkspaceV8> {
    // Async scope recomposition happens before the synchronous IndexedDB transaction.
    // Exact compare-and-swap inside that real transaction closes the race window.
    const before = await this.load()
    const next = structuredClone(mutate(structuredClone(before)))
    return this.commitCandidate(before, next, false)
  }
  private async commitCandidate(before: WorkspaceV8, next: WorkspaceV8, capture: boolean) {
    for (const draft of before.extractionDrafts) {
      const old = draft.legacyData?.mainline05
      if (!old) continue
      const after = next.extractionDrafts.find(d => d.id === draft.id)?.legacyData?.mainline05
      assert(after && typeof old === 'object' && typeof after === 'object' && !Array.isArray(old) && !Array.isArray(after), 'STATE_REMOVED')
      for (const key of ['version','sourceId','sourceVersionId','runId','draftId','rawOutputText','rawResponse','legacyResponse','context','first',
        ...(this.profile ? ['rawHttpText','adaptedResponse','inputReceipt','sendSnapshot','execution','recovery'] : [])]) {
        assert(equal(old[key]??null, after[key]??null), 'IMMUTABLE_RESPONSE_CHANGED')
      }
      assert(Array.isArray(old.operations) && Array.isArray(after.operations)
        && equal(old.operations, after.operations.slice(0, old.operations.length)), 'HISTORY_PREFIX_CHANGED')
    }
    assert(semanticRevision(before.sourceVersions) === semanticRevision(capture
      ? next.sourceVersions.filter(v => before.sourceVersions.some(old => old.id === v.id)) : next.sourceVersions), 'SOURCE_VERSION_CHANGED')
    const identity = (value: object, mutable: string[]) => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(value).filter(([k]) => !mutable.includes(k)))))
    assert(capture || (before.sources.length === next.sources.length && before.recognitionRuns.length === next.recognitionRuns.length
      && before.extractionDrafts.length === next.extractionDrafts.length), 'CAPTURE_CHAIN_CHANGED')
    for (const source of before.sources) {
      const after = next.sources.find(s => s.id === source.id)
      assert(after, 'SOURCE_REMOVED')
      const mutable = ['status', 'updatedAt', ...(this.profile ? ['legacyData'] : []), ...(capture ? ['currentVersionId'] : [])]
      assert(equal(identity(source, mutable), identity(after, mutable)), 'SOURCE_IDENTITY_CHANGED')
      if (this.profile) {
        const a = readingOf(source.legacyData?.realInput01), b = readingOf(after.legacyData?.realInput01)
        assert(equal({ ...a.inputReceipt, corrections: [] }, { ...b.inputReceipt, corrections: [] })
          && equal(a.inputReceipt.corrections, b.inputReceipt.corrections.slice(0, a.inputReceipt.corrections.length)), 'READING_HISTORY_CHANGED')
        const legacyIdentity = (value: object) => identity(value, ['realInput01', ...(capture ? ['reviewMetadata', 'contentPreview'] : [])])
        assert(equal(legacyIdentity(source.legacyData ?? {}), legacyIdentity(after.legacyData ?? {})), 'SOURCE_METADATA_CHANGED')
      }
    }
    for (const run of before.recognitionRuns) assert(equal(identity(run, ['status','schemaVersion','completedAt','durationMs','errorCode']),
      identity(next.recognitionRuns.find(r => r.id === run.id) ?? {}, ['status','schemaVersion','completedAt','durationMs','errorCode'])), 'RUN_IDENTITY_CHANGED')
    for (const draft of before.extractionDrafts) {
      const after = next.extractionDrafts.find(d => d.id === draft.id)
      assert(after && equal(draft.legacyData?.realInputPending ?? null, after.legacyData?.realInputPending ?? null), 'PENDING_SEND_CHANGED')
      if(draft.legacyData?.mainline05Failure){
        assert(equal(draft.legacyData.mainline05Failure,after.legacyData?.mainline05Failure),'FAILURE_EVIDENCE_CHANGED')
        assert(equal(before.recognitionRuns.find(r=>r.id===draft.recognitionRunId),next.recognitionRuns.find(r=>r.id===draft.recognitionRunId)),'FAILED_RUN_CHANGED')
      }
    }
    await validateSemanticWorkspace(next, this.profile)
    const saved = await this.canonical.transaction(current => {
      assert(semanticRevision(current) === semanticRevision(before), 'STALE_RELOAD_REQUIRED')
      return next
    })
    return validateSemanticWorkspace(saved, this.profile)
  }
  private async stagedCapture<T>(make: (service: CapturePersistenceService, before: WorkspaceV8) => Promise<T>,
    decorate: (candidate: WorkspaceV8, handle: T) => WorkspaceV8, revision?: string) {
    assert(this.profile === 'real-input-01', 'EXPLICIT_REAL_INPUT_REQUIRED')
    const before = await this.load()
    if (revision !== undefined) assert(revision === semanticRevision(before), 'STALE_RELOAD_REQUIRED')
    const memory = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore({ current: before }))
    const handle = await make(new CapturePersistenceService(memory), before)
    const candidate = await memory.load(); assert(candidate, 'STAGED_CAPTURE_MISSING')
    await this.commitCandidate(before, decorate(candidate, handle), true)
    return handle
  }
  async saveReading(receiptInput: InputReceipt, title: string, operationId: string, now = new Date().toISOString()): Promise<SourceOnlyHandle> {
    const receipt = await validateInputReceipt(receiptInput)
    assert(receipt.corrections.length === 0 && typeof title === 'string' && title.trim() && title.length <= 200
      && /^[A-Za-z0-9-]{1,100}$/.test(operationId), 'INITIAL_READING_INPUT')
    const reading: RealInputReading = { version: REAL_STATE_VERSION, inputReceipt: receipt, sendSnapshot: null }
    return this.stagedCapture(async (service, before) => {
      const prior = before.sources.find(s => s.legacyData?.captureOperationId === operationId)
      if (prior) assert(prior.title === title && equal(readingOf(prior.legacyData?.realInput01), reading), 'CAPTURE_OPERATION_COLLISION')
      return service.saveSource({ operationId, sourceType: receipt.sourceType, title,
        rawText: receipt.pages.map(p => p.chunks.join('')).join('\n\n'), now,
        sourceLegacyData: { realInput01: json(reading), reviewMetadata: { realInput01: json(reading) } } })
    }, value => value)
  }
  async saveReadingCorrection(sourceId: string, receiptInput: InputReceipt, revision: string) {
    const receipt = await validateInputReceipt(receiptInput)
    return this.transaction(workspace => {
      assert(this.profile === 'real-input-01' && revision === semanticRevision(workspace), 'STALE_RELOAD_REQUIRED')
      assert(workspace.sources.some(s => s.id === sourceId), 'SOURCE_MISSING')
      const reading: RealInputReading = { version: REAL_STATE_VERSION, inputReceipt: receipt, sendSnapshot: null }
      return { ...workspace, sources: workspace.sources.map(s => s.id !== sourceId ? s : {
        ...s, legacyData: { ...s.legacyData, realInput01: json(reading) } }) }
    })
  }
  async beginInputRun(sourceId: string, readingInput: RealInputReading, execution: 'live' | 'seen_engineering_replay',
    operationId: string, revision: string, now = new Date().toISOString()): Promise<CaptureHandle> {
    const reading = plainJson(readingInput)
    await validateInputReceipt(reading.inputReceipt)
    assert(reading.sendSnapshot && /^[A-Za-z0-9-]{1,100}$/.test(operationId), 'SEND_RECEIPT_REQUIRED')
    await validateSendSnapshot(reading.inputReceipt, reading.sendSnapshot)
    return this.stagedCapture(async (service, before) => {
      const source = before.sources.find(s => s.id === sourceId), version = before.sourceVersions.find(v => v.id === source?.currentVersionId)
      assert(source && version && equal(readingOf(source.legacyData?.realInput01).inputReceipt, reading.inputReceipt), 'UNSAVED_READING')
      const duplicate = before.extractionDrafts.find(d => {
        const pending = d.legacyData?.realInputPending
        return pending && typeof pending === 'object' && !Array.isArray(pending) && pending.operationId === operationId
      })
      if (duplicate) {
        assert(equal(duplicate.legacyData!.realInputPending, { reading, execution, operationId }), 'SEND_OPERATION_COLLISION')
        const run = before.recognitionRuns.find(r => r.id === duplicate.recognitionRunId)!
        return { sourceId, sourceVersionId: run.sourceVersionId, recognitionRunId: run.id, draftId: duplicate.id, duplicate: true }
      }
      assert(!before.recognitionRuns.some(r => r.sourceVersionId === version.id && ['queued','running'].includes(r.status)), 'PENDING_REQUEST_NO_RETRY')
      const rawText = reading.sendSnapshot!.text
      const request = { provider: execution === 'live' ? 'deepseek' as const : 'manual' as const, modelName: MODEL_NAME,
        promptVersion: PROMPT_VERSION, pipelineVersion: REAL_STATE_VERSION, now,
        sourceLegacyData: { realInput01: json(reading), reviewMetadata: { realInput01: json(reading) } } }
      if (rawText !== version.rawText) {
        assert(rawText.trim() !== version.rawText?.trim(), 'WHITESPACE_ONLY_REVISION_REJECTED_BEFORE_SAVE')
        return service.beginRevision(sourceId, { ...request, rawText, operationId })
      }
      return service.beginRetry(sourceId, { ...request, expectedSourceVersionId: version.id })
    }, (candidate, handle) => handle.duplicate ? candidate : ({ ...candidate,
      extractionDrafts: candidate.extractionDrafts.map(d => d.id !== handle.draftId ? d : { ...d,
        legacyData: { ...d.legacyData, realInputPending: json({ reading, execution, operationId }) } }),
      recognitionRuns: candidate.recognitionRuns.map(r => r.id === handle.recognitionRunId ? { ...r, schemaVersion: REAL_STATE_VERSION } : r) }), revision)
  }
  async exportJson(): Promise<string> { return this.canonical.exportJson(await this.load()) }
}
