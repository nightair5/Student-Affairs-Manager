import { CanonicalWorkspaceRepository, type WorkspaceRecordStore } from '../../domain/v2/repository'
import { CapturePersistenceService, type CaptureRequest } from '../../domain/v2/capture'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { assert, equal, semanticRevision, validateSemanticWorkspace } from './semanticState'

export class SemanticRepository {
  private constructor(private readonly canonical: CanonicalWorkspaceRepository, readonly name: string) {}
  static async open(name: string, transport: WorkspaceRecordStore & { readonly name: string }, initial?: WorkspaceV8) {
    assert(/^rco-mainline-01-02-i1-mainline05-[a-z0-9-]{10,100}$/.test(name), 'DATABASE_NAME')
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
      await validateSemanticWorkspace(initial)
      await canonical.save(initial)
    }
    const repo = new SemanticRepository(canonical, name)
    await repo.load()
    return repo
  }
  async load(): Promise<WorkspaceV8> {
    const saved = await this.canonical.load()
    assert(saved && saved.workspace.id === this.name, 'WORKSPACE_MISSING_OR_WRONG')
    return validateSemanticWorkspace(saved)
  }
  async beginSource(request: CaptureRequest) {
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
    for (const draft of before.extractionDrafts) {
      const old = draft.legacyData?.mainline05
      if (!old) continue
      const after = next.extractionDrafts.find(d => d.id === draft.id)?.legacyData?.mainline05
      assert(after && typeof old === 'object' && typeof after === 'object' && !Array.isArray(old) && !Array.isArray(after), 'STATE_REMOVED')
      for (const key of ['version','sourceId','sourceVersionId','runId','draftId','rawOutputText','rawResponse','legacyResponse','context','first']) {
        assert(equal(old[key], after[key]), 'IMMUTABLE_RESPONSE_CHANGED')
      }
      assert(Array.isArray(old.operations) && Array.isArray(after.operations)
        && equal(old.operations, after.operations.slice(0, old.operations.length)), 'HISTORY_PREFIX_CHANGED')
    }
    assert(semanticRevision(before.sourceVersions) === semanticRevision(next.sourceVersions), 'SOURCE_VERSION_CHANGED')
    const identity = (value: object, mutable: string[]) => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(value).filter(([k]) => !mutable.includes(k)))))
    assert(before.sources.length === next.sources.length && before.recognitionRuns.length === next.recognitionRuns.length
      && before.extractionDrafts.length === next.extractionDrafts.length, 'CAPTURE_CHAIN_CHANGED')
    for (const source of before.sources) assert(equal(identity(source, ['status', 'updatedAt']),
      identity(next.sources.find(s => s.id === source.id) ?? {}, ['status', 'updatedAt'])), 'SOURCE_IDENTITY_CHANGED')
    for (const run of before.recognitionRuns) assert(equal(identity(run, ['status','schemaVersion','completedAt','durationMs','errorCode']),
      identity(next.recognitionRuns.find(r => r.id === run.id) ?? {}, ['status','schemaVersion','completedAt','durationMs','errorCode'])), 'RUN_IDENTITY_CHANGED')
    await validateSemanticWorkspace(next)
    const saved = await this.canonical.transaction(current => {
      assert(semanticRevision(current) === semanticRevision(before), 'STALE_RELOAD_REQUIRED')
      return next
    })
    return validateSemanticWorkspace(saved)
  }
  async exportJson(): Promise<string> { return this.canonical.exportJson(await this.load()) }
}
