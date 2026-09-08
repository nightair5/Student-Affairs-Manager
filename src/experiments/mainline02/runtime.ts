import { CapturePersistenceService } from '../../domain/v2/capture'
import { CanonicalWorkspaceRepository, type WorkspaceRecordStore } from '../../domain/v2/repository'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import { confirmV2, editConfirmationV2, type ConfirmationEditV2, type ConfirmationIntentV2 } from '../../domain/v2/confirmationV2'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { RecognitionResult } from '../../recognition/types'
import type { IntakeInput } from '../../lib/intake'
import { taskDateViews } from './taskDateView'
import { reviewAdapter } from './reviewAdapter'
import { assertReplayHandoff, type ReplayHandoff } from '../mainline03/seenReplay'
import { jsonCopy, verifyReceipt } from '../mainline03/recognitionHandoff'
import type { ReactNode } from 'react'
import type { SemanticDispositionIntent } from '../mainline05/semanticConfirmation'

export interface MainlineSemanticCapabilities {
  informationReviewProblem?(workspace: WorkspaceV8, draftId: string): string | undefined
  facts(workspace: WorkspaceV8, draftId: string, taskId?: string, onFocus?: (quote: string) => void): ReactNode
  taskFacts(workspace: WorkspaceV8, taskId: string): ReactNode
  eventFacts(workspace: WorkspaceV8, eventId: string): { startLabel: string; endLabel: string; content: ReactNode }
  eventCount(workspace: WorkspaceV8, draftId: string, taskIds: string[]): number
  dispose(intent: SemanticDispositionIntent): Promise<WorkspaceV8>
  readonly timezone: string
  readonly exportName: string
}
export interface MainlineRealInputCapabilities {
  pendingDateTaskIds?(workspace: WorkspaceV8): string[]
  readonly profile: 'real-input-01'
  readonly networkDescription: string
  inputPanel(options: { workspace: WorkspaceV8; initialText: string; onSaved: () => Promise<void>; onDraftReady: (id: string) => Promise<void> }): ReactNode
  factEditor(options: { workspace: WorkspaceV8; draftId: string; taskId: string; busy: boolean;
    onDirty: (dirty: boolean) => void; onSaved: () => Promise<void> }): ReactNode
  draftEditor?(options: {workspace:WorkspaceV8;draftId:string;busy:boolean;onDirty:(dirty:boolean)=>void;onSaved:()=>Promise<void>}):ReactNode
}
export type MainlineSemanticDriver = Pick<MainlineRuntime, 'load' | 'view' | 'dates' | 'review' | 'capture' | 'edit' | 'confirm' | 'exportJson'>
  & { semantic: MainlineSemanticCapabilities; recognitionDescription: string; realInput?: MainlineRealInputCapabilities }

export interface MainlineRuntime {
  readonly mode: 'mainline-02-i1-isolated'
  readonly databaseName: string
  readonly initial: WorkspaceV8
  readonly recognitionDescription?: string
  readonly semantic?: MainlineSemanticCapabilities
  readonly realInput?: MainlineRealInputCapabilities
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
  handoff?: ReplayHandoff
  profile?: 'real-input-01'
  semanticDriver?: (store: WorkspaceRecordStore & { readonly name: string }) => Promise<MainlineSemanticDriver>
}): Promise<MainlineRuntime> {
  assertDatabaseName(options.name)
  if (options.profile && (options.profile !== 'real-input-01' || !options.semanticDriver || options.initialize)) throw Error('REAL_INPUT_INITIALIZE_IN_JOINT_REPOSITORY')
  const handoff = options.handoff
  if (handoff) assertReplayHandoff(handoff)
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
  if (options.semanticDriver) {
    if (handoff || !options.name.startsWith(options.profile === 'real-input-01'
      ? 'rco-mainline-01-02-i1-real-input-' : 'rco-mainline-01-02-i1-mainline05-')) throw Error('MAINLINE_DRIVER_SCOPE_INVALID')
    const driver = await options.semanticDriver(Object.freeze({ ...store, name }))
    if (Boolean(driver.realInput) !== (options.profile === 'real-input-01')) throw Error('REAL_INPUT_DRIVER_PROFILE')
    const checked = await driver.load()
    if (checked.workspace.id !== name || JSON.stringify(checked) !== JSON.stringify(initial)) throw Error('MAINLINE_DRIVER_INITIAL_MISMATCH')
    const runtime: MainlineRuntime = Object.freeze({ mode: 'mainline-02-i1-isolated', databaseName: name, initial: checked,
      recognitionDescription: driver.recognitionDescription, semantic: driver.semantic,
      ...(driver.realInput ? { realInput: driver.realInput } : {}),
      load: driver.load, view: driver.view, dates: driver.dates, review: driver.review,
      capture: driver.capture, edit: driver.edit, confirm: driver.confirm, exportJson: driver.exportJson })
    verified.add(runtime)
    return runtime
  }
  const capture = new CapturePersistenceService(canonical)
  const runtime: MainlineRuntime = Object.freeze({
    mode: 'mainline-02-i1-isolated' as const, databaseName: options.name, initial,
    ...(handoff ? { recognitionDescription: handoff.description } : {}),
    load, view: workspaceV8ToLegacyView, dates: taskDateViews, review: reviewAdapter,
    async capture(input: IntakeInput) {
      await load()
      if (input.sourceType !== 'text' || input.manualSuggestion || input.multimodal || input.url || input.fileName || !input.content.trim()) throw new Error('MAINLINE_TEXT_ONLY')
      if (handoff) {
        const receipt = await handoff.prepare(input.content)
        await verifyReceipt(receipt, input.content)
        const handle = await capture.beginCapture({ operationId: input.operationId ?? crypto.randomUUID(), sourceType: 'text',
          title: input.sourceTitle || handoff.description, rawText: input.content,
          provider: receipt.kind === 'seen-model-candidate' ? 'legacy-unknown' : 'manual',
          modelName: receipt.kind === 'seen-model-candidate' ? `已见回放/${receipt.originalModel}` : receipt.originalModel,
          promptVersion: receipt.promptVersion, pipelineVersion: 'mainline-03-i1-isolated-handoff',
          sourceLegacyData: { mainline03Handoff: jsonCopy(receipt) } })
        if (handle.duplicate) {
          const source = (await load()).sources.find(item => item.id === handle.sourceId)
          if (JSON.stringify(source?.legacyData?.mainline03Handoff) !== JSON.stringify(receipt)) throw new Error('HANDOFF_DUPLICATE_INPUT_MISMATCH')
        }
        await capture.recognize(handle, async () => {
          const saved = await load()
          const source = saved.sources.find(item => item.id === handle.sourceId)
          const version = saved.sourceVersions.find(item => item.id === handle.sourceVersionId)
          const run = saved.recognitionRuns.find(item => item.id === handle.recognitionRunId)
          const draft = saved.extractionDrafts.find(item => item.id === handle.draftId)
          if (!source || source.currentVersionId !== handle.sourceVersionId || version?.sourceId !== source.id
            || version.rawText !== input.content || run?.sourceVersionId !== version.id || draft?.recognitionRunId !== run.id
            || JSON.stringify(source.legacyData?.mainline03Handoff) !== JSON.stringify(receipt)) throw new Error('HANDOFF_CAPTURE_BINDING_INVALID')
          return (await handoff.recognize(receipt, input.content, handle)).result
        })
        return handle.draftId
      }
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
