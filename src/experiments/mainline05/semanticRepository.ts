import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore, type WorkspaceRecordStore } from '../../domain/v2/repository'
import { CapturePersistenceService, type CaptureRequest, type CaptureHandle, type SourceOnlyHandle } from '../../domain/v2/capture'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { assert, equal, json, realDatabaseName, readingOf, REAL_STATE_VERSION, semanticRevision, validateSemanticWorkspace, type RealInputReading } from './semanticState'
import { plainJson } from '../mainline04/semanticContract'
import { validateInputReceipt, validateSendSnapshot, sha256Text, type InputReceipt } from '../realInput01/inputReceipt'
import { MODEL_NAME, FLASH41_MODEL_NAME, PROMPT_VERSION } from '../realInput01/modelWire'
import { CANDIDATE05_VERSION } from '../realInput01/candidate05'
import { CANDIDATE06_VERSION } from '../realInput01/candidate06'
import { CANDIDATE02_VERSION } from '../realInput01/candidate02'
import { CANDIDATE03_VERSION } from '../realInput01/candidate03'
import { CANDIDATE04_VERSION } from '../realInput01/candidate04'

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
    operationId: string, revision: string, now = new Date().toISOString(), promptVersion: typeof PROMPT_VERSION | typeof CANDIDATE02_VERSION | typeof CANDIDATE03_VERSION | typeof CANDIDATE04_VERSION | typeof CANDIDATE05_VERSION | typeof CANDIDATE06_VERSION = PROMPT_VERSION,
    modelName: typeof MODEL_NAME | typeof FLASH41_MODEL_NAME = MODEL_NAME): Promise<CaptureHandle> {
    assert(modelName === MODEL_NAME ? promptVersion === PROMPT_VERSION || [CANDIDATE02_VERSION,CANDIDATE03_VERSION,CANDIDATE04_VERSION].includes(promptVersion as typeof CANDIDATE02_VERSION) && execution === 'live'
      : modelName === FLASH41_MODEL_NAME && execution === 'live' && [CANDIDATE03_VERSION,CANDIDATE05_VERSION,CANDIDATE06_VERSION].includes(promptVersion as typeof CANDIDATE03_VERSION), 'CANDIDATE_IDENTITY')
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
        assert(run.promptVersion === promptVersion && run.modelName === modelName, 'SEND_CANDIDATE_COLLISION')
        return { sourceId, sourceVersionId: run.sourceVersionId, recognitionRunId: run.id, draftId: duplicate.id, duplicate: true }
      }
      assert(!before.recognitionRuns.some(r => r.sourceVersionId === version.id && ['queued','running'].includes(r.status)), 'PENDING_REQUEST_NO_RETRY')
      const rawText = reading.sendSnapshot!.text
      const request = { provider: execution === 'live' ? 'deepseek' as const : 'manual' as const, modelName,
        promptVersion, pipelineVersion: REAL_STATE_VERSION, now,
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
  /** A new synthetic source and an already-settled response are assembled in
   * private memory. Only a terminal, non-dispatchable review reaches the store. */
  async appendPairedRecordedSource(operationId: string, revision: string,
    complete: (memory: SemanticRepository) => Promise<void>): Promise<WorkspaceV8> {
    assert(this.profile === 'real-input-01' && /^(?:paired04-source-N|paired05-source-P|paired06-source-Q)(0[1-9]|1[0-2])$/.test(operationId), 'PAIRED_RECORDED_PROFILE')
    const before = await this.load()
    assert(revision === semanticRevision(before), 'STALE_RELOAD_REQUIRED')
    assert(!before.sources.some(s => s.legacyData?.captureOperationId === operationId), 'PAIRED_SOURCE_ALREADY_EXISTS')
    const transport = Object.assign(new MemoryWorkspaceRecordStore({ current: before }), { name: this.name })
    const memory = await SemanticRepository.open(this.name, transport, undefined, 'real-input-01')
    await complete(memory)
    const next = await memory.load()
    for (const key of Object.keys(before) as Array<keyof WorkspaceV8>) {
      const old = before[key], current = next[key]
      if (Array.isArray(old) && Array.isArray(current)) {
        // capture prepends sources; identity, not array position, binds old entities.
        assert(old.every(item => item && typeof item === 'object' && 'id' in item
          ? equal(item, current.find(x => x && typeof x === 'object' && 'id' in x && x.id === item.id))
          : current.some(x => equal(x,item))), 'PAIRED_OLD_RECORD_CHANGED_' + key)
        const additions = ['sources','sourceVersions','recognitionRuns','extractionDrafts'].includes(key) ? 1 : 0
        if (!['evidenceRefs','historyRecords'].includes(key)) assert(current.length === old.length + additions, 'PAIRED_UNCONFIRMED_WRITE_' + key)
      } else if (key === 'workspace') assert(equal(before.workspace, { ...next.workspace, updatedAt: before.workspace.updatedAt }), 'PAIRED_WORKSPACE_CHANGED')
      else if (key !== 'savedAt') assert(equal(old, current), 'PAIRED_METADATA_CHANGED')
    }
    const source = next.sources.find(s => s.legacyData?.captureOperationId === operationId)!
    const run = next.recognitionRuns.find(r => r.sourceVersionId === source?.currentVersionId)!
    const draft = next.extractionDrafts.find(d => d.recognitionRunId === run?.id)!
    assert(source.legacyData?.captureOperationId === operationId && run.sourceVersionId === source.currentVersionId
      && run.status === 'succeeded' && draft.recognitionRunId === run.id && draft.status === 'needs_review'
      && draft.legacyData?.realInputRecorded && draft.commitOperationIds.length === 0, 'PAIRED_TERMINAL_REVIEW_REQUIRED')
    return this.commitCandidate(before, next, true)
  }
  /** Already-received response only. A queued record exists only in private memory;
   * the actual store receives its terminal Run and review Draft in one transaction. */
  async appendRecordedInput(input: { source: CaptureHandle; reading: RealInputReading; operationId: string;
    requestSha: string; responseSha: string; rawHttpText: string; revision: string; promptVersion: typeof CANDIDATE03_VERSION },
    complete: (memory: SemanticRepository, handle: CaptureHandle) => Promise<unknown>): Promise<WorkspaceV8> {
    assert(this.profile === 'real-input-01' && input.promptVersion === CANDIDATE03_VERSION, 'RECORDED_PROFILE')
    // The optimistic revision is the serialized whole workspace, not a fact field.
    // Keep its exact comparison outside the bounded semantic JSON payload.
    const { revision, ...payload } = structuredClone(input)
    const value = { ...plainJson(payload), revision }, before = await this.load()
    assert(value.revision === semanticRevision(before), 'STALE_RELOAD_REQUIRED')
    assert(/^recorded-candidate03-D0[1-8]$/.test(value.operationId)
      && /^[a-f0-9]{64}$/.test(value.requestSha) && /^[a-f0-9]{64}$/.test(value.responseSha), 'RECORDED_IDENTITY')
    assert(await sha256Text(value.rawHttpText) === value.responseSha, 'RECORDED_RESPONSE_HASH')
    await validateInputReceipt(value.reading.inputReceipt)
    assert(value.reading.sendSnapshot, 'SEND_RECEIPT_REQUIRED')
    await validateSendSnapshot(value.reading.inputReceipt, value.reading.sendSnapshot)
    const source = before.sources.find(s => s.id === value.source.sourceId)
    const version = before.sourceVersions.find(v => v.id === value.source.sourceVersionId)
    const oldRun = before.recognitionRuns.find(r => r.id === value.source.recognitionRunId)
    const oldDraft = before.extractionDrafts.find(d => d.id === value.source.draftId)
    assert(source && version && source.currentVersionId === version.id && version.sourceId === source.id
      && oldRun?.sourceVersionId === version.id && oldDraft?.recognitionRunId === oldRun.id
      && equal(readingOf(source.legacyData?.realInput01).inputReceipt, value.reading.inputReceipt)
      && value.reading.sendSnapshot.text === version.rawText, 'RECORDED_SOURCE')
    const receipt = { version: 'real-input-recorded-import-1', operationId: value.operationId,
      sourceId: source.id, sourceVersionId: version.id, requestSha: value.requestSha,
      responseSha: value.responseSha, promptVersion: value.promptVersion }
    const prior = before.extractionDrafts.find(d => (d.legacyData?.realInputRecorded as {operationId?: string})?.operationId === value.operationId)
    if (prior) {
      assert(equal(prior.legacyData?.realInputRecorded, receipt)
        && (prior.legacyData?.mainline05 as {rawHttpText?: string})?.rawHttpText === value.rawHttpText, 'RECORDED_COLLISION')
      return before
    }
    assert(!before.extractionDrafts.some(d => (d.legacyData?.realInputPending as {operationId?: string})?.operationId === value.operationId), 'RECORDED_LEGACY_OPERATION_COLLISION')
    const runId = source.id + ':recorded:' + value.operationId, draftId = runId + ':draft', now = new Date().toISOString()
    assert(!before.recognitionRuns.some(r => r.id === runId) && !before.extractionDrafts.some(d => d.id === draftId), 'RECORDED_COLLISION')
    const staged: WorkspaceV8 = { ...before,
      sources: before.sources.map(s => s.id === source.id ? { ...s, status: 'extracting' } : s),
      recognitionRuns: [...before.recognitionRuns, { id: runId, sourceVersionId: version.id, provider: 'deepseek', modelName: MODEL_NAME,
        promptVersion: value.promptVersion, schemaVersion: REAL_STATE_VERSION, pipelineVersion: REAL_STATE_VERSION,
        status: 'queued', startedAt: now, completedAt: null, durationMs: null, tokenUsage: null, qualityFlags: [], errorCode: null }],
      extractionDrafts: [...before.extractionDrafts, { id: draftId, recognitionRunId: runId, status: 'processing', result: null,
        commitOperationIds: [], acceptedEntityTempIds: [], rejectedEntityTempIds: [], createdAt: now, updatedAt: now,
        legacyData: { realInputRecorded: json(receipt), realInputPending: json({ reading: value.reading, execution: 'live', operationId: value.operationId }) } }] }
    const transport = Object.assign(new MemoryWorkspaceRecordStore({ current: staged }), { name: this.name })
    const memory = await SemanticRepository.open(this.name, transport, undefined, 'real-input-01')
    await complete(memory, { sourceId: source.id, sourceVersionId: version.id, recognitionRunId: runId, draftId, duplicate: false })
    const next = await memory.load(), added = next.extractionDrafts.find(d => d.id === draftId)
    assert(next.recognitionRuns.find(r => r.id === runId)?.status === 'succeeded' && added?.status === 'needs_review'
      && (added.legacyData?.mainline05 as {rawHttpText?: string})?.rawHttpText === value.rawHttpText, 'RECORDED_NOT_TERMINAL')
    assert(next.recognitionRuns.length === before.recognitionRuns.length + 1 && next.extractionDrafts.length === before.extractionDrafts.length + 1, 'RECORDED_CHAIN_ADDITION')
    assert(equal(added.legacyData?.realInputRecorded, receipt), 'RECORDED_RECEIPT_CHANGED')
    assert(next.sources.length === before.sources.length && before.sources.every(old => {
      const current = next.sources.find(s => s.id === old.id)
      return current && equal(old, old.id === source.id ? { ...current, status: old.status, updatedAt: old.updatedAt } : current)
    }), 'RECORDED_OLD_SOURCE_CHANGED')
    for (const key of ['evidenceRefs', 'historyRecords'] as const)
      assert(before[key].every(old => equal(old, next[key].find(item => item.id === old.id))), 'RECORDED_OLD_EVIDENCE_CHANGED')
    for (const key of Object.keys(before) as Array<keyof WorkspaceV8>) {
      if (key === 'recognitionRuns' || key === 'extractionDrafts') {
        const old = before[key], current = next[key]
        assert(old.every(item => equal(item, current.find(x => x.id === item.id))), 'RECORDED_OLD_CHAIN_CHANGED')
      } else if (key === 'workspace') {
        assert(equal(before.workspace, { ...next.workspace, updatedAt: before.workspace.updatedAt }), 'RECORDED_WORKSPACE_IDENTITY')
      } else if (!['sources', 'evidenceRefs', 'historyRecords', 'savedAt'].includes(key)) assert(equal(before[key], next[key]), 'RECORDED_UNCONFIRMED_WRITE_' + key)
    }
    return this.commitCandidate(before, next, true)
  }
}
