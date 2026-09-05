import { CapturePersistenceService } from '../../domain/v2/capture'
import { CanonicalWorkspaceRepository, type WorkspaceRecordStore } from '../../domain/v2/repository'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import { confirmV2, editConfirmationV2, type ConfirmationEditV2, type ConfirmationIntentV2 } from '../../domain/v2/confirmationV2'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { RecognitionResult } from '../../recognition/types'
import type { IntakeInput } from '../../lib/intake'
import { taskDateViews } from './taskDateView'
import { reviewAdapter } from './reviewAdapter'

export interface MainlineRuntime {
  readonly mode: 'mainline-02-i1-isolated'
  readonly databaseName: string
  readonly initial: WorkspaceV8
  load(): Promise<WorkspaceV8>
  view(workspace: WorkspaceV8): ReturnType<typeof workspaceV8ToLegacyView>
  dates: typeof taskDateViews
  review: typeof reviewAdapter
  capture(input: IntakeInput): Promise<string>
  edit(request: ConfirmationEditV2): Promise<WorkspaceV8>
  confirm(intent: ConfirmationIntentV2): Promise<WorkspaceV8>
  exportJson(): Promise<string>
}
const verified = new WeakSet<object>()
export function assertMainlineRuntime(runtime: unknown): asserts runtime is MainlineRuntime {
  if (!runtime || typeof runtime !== 'object' || !verified.has(runtime)) throw new Error('MAINLINE_RUNTIME_INVALID')
}
export function assertDatabaseName(name: string) {
  if (!/^rco-mainline-01-02-i1-[a-z0-9-]{10,100}$/u.test(name)) throw new Error('MAINLINE_DATABASE_INVALID')
}
export async function createMainlineRuntime(options: {
  name: string; store: WorkspaceRecordStore & { readonly name: string }; initialize?: WorkspaceV8
  recognize: (text: string, sourceId: string) => RecognitionResult | Promise<RecognitionResult>
}): Promise<MainlineRuntime> {
  assertDatabaseName(options.name)
  const name = options.name
  const checkKey = (key: string) => { if (options.store.name !== name) throw new Error('MAINLINE_STORE_BINDING_INVALID'); if (key !== 'current') throw new Error('MAINLINE_RECORD_INVALID') }
  const store: WorkspaceRecordStore = {
    read: key => { checkKey(key); return options.store.read(key) },
    write: (key, value) => { checkKey(key); return options.store.write(key, value) },
    remove: async () => { throw new Error('MAINLINE_DELETE_FORBIDDEN') },
    transaction: (key, mutate) => { checkKey(key); return options.store.transaction(key, raw => {
      if (!raw || typeof raw !== 'object' || !('workspace' in raw) || !raw.workspace || typeof raw.workspace !== 'object' || !('id' in raw.workspace) || raw.workspace.id !== name) throw new Error('MAINLINE_TRANSACTION_SCOPE_INVALID')
      return mutate(raw)
    }) },
    transactionMany: async () => { throw new Error('MAINLINE_MIGRATION_FORBIDDEN') },
  }
  const canonical = new CanonicalWorkspaceRepository(store)
  const load = async () => {
    const data = await canonical.load()
    if (!data || data.workspace.id !== options.name) throw new Error('MAINLINE_WORKSPACE_MISSING_OR_WRONG')
    return data
  }
  if (options.initialize) {
    if (await store.read('current') !== undefined || options.initialize.workspace.id !== options.name
      || Object.values(options.initialize).some(value => Array.isArray(value) && value.length)) throw new Error('MAINLINE_INITIALIZATION_REJECTED')
    await canonical.save(options.initialize)
  }
  const initial = await load()
  const capture = new CapturePersistenceService(canonical)
  const runtime: MainlineRuntime = Object.freeze({
    mode: 'mainline-02-i1-isolated' as const, databaseName: options.name, initial,
    load, view: workspaceV8ToLegacyView, dates: taskDateViews, review: reviewAdapter,
    async capture(input: IntakeInput) {
      await load()
      if (input.sourceType !== 'text' || input.manualSuggestion || input.multimodal || input.url || input.fileName || !input.content.trim()) throw new Error('MAINLINE_TEXT_ONLY')
      const handle = await capture.beginCapture({ operationId: input.operationId ?? crypto.randomUUID(), sourceType: 'text',
        title: input.sourceTitle || '人工工程通知（非模型预测）', rawText: input.content, provider: 'manual',
        modelName: '人工工程响应（非模型预测）', promptVersion: 'engineering-mainline-01', pipelineVersion: 'mainline-02-i1-isolated' })
      await capture.recognize(handle, async () => options.recognize(input.content, handle.sourceId))
      return handle.draftId
    },
    async edit(request: ConfirmationEditV2) { await load(); return editConfirmationV2(canonical, request) },
    async confirm(intent: ConfirmationIntentV2) { await load(); return confirmV2(canonical, intent) },
    async exportJson() { return canonical.exportJson(await load()) },
  })
  verified.add(runtime)
  return runtime
}
