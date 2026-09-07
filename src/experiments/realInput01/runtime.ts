import { createElement } from 'react'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore, type WorkspaceRecordStore } from '../../domain/v2/repository'
import type { CaptureHandle } from '../../domain/v2/capture'
import type { LocalExtractionResources } from '../../lib/fileExtraction'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { createMainlineRuntime } from '../mainline02/runtime'
import { SemanticRepository } from '../mainline05/semanticRepository'
import { completeInputRun, failInputRun } from '../mainline05/semanticCapture'
import { confirmSemantic, editSemantic, disposeSemantic, enableMaterialReview } from '../mainline05/semanticConfirmation'
import { semanticView, semanticReview, semanticDates, stateForEntity, timeLabel } from '../mainline05/semanticView'
import { REAL_STATE_VERSION, stateOfRuntime, effectiveStateFacts, relatedAssets, readingOf, semanticRevision, isCurrentDraft, informationReviewProblem, materialReviewEnabled, exactKeys } from '../mainline05/semanticState'
import { SemanticFacts } from '../mainline05/SemanticFacts'
import { InputReview } from './InputReview'
import { FactCorrectionEditor } from './FactCorrectionEditor'
import { makeSendSnapshot, sha256Text } from './inputReceipt'
import type { ModelExecutor } from './modelClient'
import type { WireContext } from './modelWire'
import { buildModelRequest } from './modelWire'
import { stableJson } from '../mainline04/semanticContract'
import type { RealInputReading } from '../mainline05/semanticState'

export interface RecordedA02 {
  version:'recorded-a02-1'; name:string; handle:CaptureHandle; context:WireContext;
  requestSha:string; responseSha:string; rawHttpText:string
}
// Transport/record identities, never semantic answers or scoring dependencies.
export const recordedA02Identity={name:'rco-mainline-01-02-i1-real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862',
  handle:{sourceId:'source:00af0dfa',sourceVersionId:'source:00af0dfa:version:1',recognitionRunId:'source:00af0dfa:run:1:1',draftId:'source:00af0dfa:draft:1:1',duplicate:false},
  requestSha:'6cbf184da3dbc6d2ab8322b29482a0686fa2657c37ae34f4c8ce84ffae54404a',
  responseSha:'5e201902469878c85b1e87364e6cd07be58e02bccbe509bbee0c09728457f55e'} as const
export async function validateRecordedA02(record:RecordedA02) {
  exactKeys(record,['version','name','handle','context','requestSha','responseSha','rawHttpText'])
  if(record.version!=='recorded-a02-1'||record.name!==recordedA02Identity.name
    ||stableJson(record.handle)!==stableJson(recordedA02Identity.handle)||record.requestSha!==recordedA02Identity.requestSha
    ||record.responseSha!==recordedA02Identity.responseSha||await sha256Text(record.rawHttpText)!==record.responseSha
    ||await sha256Text((await buildModelRequest(record.context)).serialized)!==record.requestSha)throw Error('REAL_INPUT_RECORDED_IDENTITY')
}
/** No executor, network, new Source or rewritten model response. Stage through the
 * existing capture and validator; publish the result plus material policy in one CAS. */
export async function replayRecordedA02(repo:SemanticRepository,record:RecordedA02) {
  record=structuredClone(record);await validateRecordedA02(record)
  if(repo.profile!=='real-input-01'||repo.name!==record.name)throw Error('REAL_INPUT_RECORDED_DATABASE')
  const before=await repo.load(),draft=before.extractionDrafts.find(d=>d.id===record.handle.draftId)
  const pending=draft?.legacyData?.realInputPending as {execution?:string}|undefined
  if(pending?.execution!=='live')throw Error('REAL_INPUT_RECORDED_PROVENANCE')
  if(draft?.legacyData?.mainline05){
    const state=stateOfRuntime(before,draft.id)
    if(state.version!==REAL_STATE_VERSION||state.execution!=='live'||state.rawHttpText!==record.rawHttpText||!materialReviewEnabled(state))throw Error('REAL_INPUT_RECORDED_EXISTING_MISMATCH')
    return before
  }
  if(stableJson(await inputRunContext(repo,record.handle))!==stableJson(record.context))throw Error('REAL_INPUT_RECORDED_CONTEXT')
  const memory=Object.assign(new MemoryWorkspaceRecordStore(),{name:repo.name})
  await new CanonicalWorkspaceRepository(memory).save(before)
  const staged=await SemanticRepository.open(repo.name,memory,undefined,'real-input-01')
  await completeInputRun(staged,record.handle,record.rawHttpText)
  const next=await enableMaterialReview(staged,record.handle.draftId)
  return repo.transaction(w=>{
    if(semanticRevision(w)!==semanticRevision(before))throw Error('REAL_INPUT_STALE_RELOAD_REQUIRED')
    return next
  })
}

/** Resumable zero-dispatch engineering preparation. Reuse the persisted consent
 * instant and handle; never turn a partial preparation into a retry/new request. */
export async function prepareInputRun(repo: SemanticRepository, sourceId: string, operationId: string, now = new Date().toISOString()) {
  const workspace=await repo.load(), source=workspace.sources.find(s=>s.id===sourceId)
  if(!source)throw Error('REAL_INPUT_PREPARE_SOURCE_MISSING')
  const receipt=readingOf(source.legacyData?.realInput01).inputReceipt
  const prior=workspace.extractionDrafts.find(d=>{
    const pending=d.legacyData?.realInputPending as {operationId?: string}|undefined
    return pending?.operationId===operationId
  })
  if(prior){
    const pending=prior.legacyData!.realInputPending as unknown as {reading: RealInputReading; execution: string}
    const run=workspace.recognitionRuns.find(r=>r.id===prior.recognitionRunId)
    if(!run||pending.execution!=='live'||stableJson(pending.reading.inputReceipt)!==stableJson(receipt))throw Error('REAL_INPUT_PREPARED_INPUT_CHANGED')
    const handle={sourceId,sourceVersionId:run.sourceVersionId,recognitionRunId:run.id,draftId:prior.id,duplicate:true}
    return {handle,reading:pending.reading,context:await inputRunContext(repo,handle)}
  }
  const pages=receipt.pages.map(p=>p.number), reading={version:REAL_STATE_VERSION,inputReceipt:receipt,
    sendSnapshot:await makeSendSnapshot(receipt,pages,pages,now)}
  const handle=await repo.beginInputRun(sourceId,reading,'live',operationId,semanticRevision(workspace),now)
  return {handle,reading,context:await inputRunContext(repo,handle)}
}

export function emptyRealInputWorkspace(name: string, now = new Date().toISOString()): WorkspaceV8 {
  return { schemaVersion: 8, workspace: { id: name, title: '真实输入隔离实验（不是用户工作区）', createdAt: now, updatedAt: now },
    settings: { defaultTimezone: 'Asia/Shanghai', locale: 'zh-CN' }, sources: [], sourceVersions: [], recognitionRuns: [], extractionDrafts: [],
    projects: [], milestones: [], workPackages: [], tasks: [], materials: [], timePoints: [], events: [], evidenceRefs: [], changeProposals: [],
    historyRecords: [], reminderRecords: [], preferences: { onboardingCompletedAt: null }, migrationMetadata: [], savedAt: now }
}

/** Source and exact send receipt reach the joint repository before any executor.
 * The executor may be a labelled seen replay or the separately gated gateway.
 * Neither this entry nor capture retries a network request. */
export async function sendRealInput(repo: SemanticRepository, request: {
  sourceId: string; pages: number[]; reviewed: number[]; operationId: string; revision: string;
}, execution: 'live' | 'seen_engineering_replay', execute: ModelExecutor, now = new Date().toISOString()) {
  const intent = structuredClone(request), before = await repo.load()
  if (semanticRevision(before) !== intent.revision) throw Error('REAL_INPUT_STALE_RELOAD_REQUIRED')
  const source = before.sources.find(s => s.id === intent.sourceId)
  if (!source) throw Error('REAL_INPUT_SOURCE_MISSING')
  const inputReceipt = readingOf(source.legacyData?.realInput01).inputReceipt
  const reading = { version: REAL_STATE_VERSION, inputReceipt,
    sendSnapshot: await makeSendSnapshot(inputReceipt,intent.pages,intent.reviewed,now) }
  const handle = await repo.beginInputRun(source.id,reading,execution,intent.operationId,intent.revision,now)
  if (handle.duplicate) throw Error('REAL_INPUT_ALREADY_PREPARED_NO_RETRY')
  return dispatchRealInput(repo,handle,execute)
}

export async function inputRunContext(repo: SemanticRepository, handle: CaptureHandle): Promise<WireContext> {
  const workspace = await repo.load(), draft = workspace.extractionDrafts.find(d => d.id === handle.draftId)
  const run = workspace.recognitionRuns.find(r => r.id === handle.recognitionRunId)
  const version = workspace.sourceVersions.find(v => v.id === handle.sourceVersionId)
  if (!draft || !run || !version || draft.recognitionRunId !== run.id || run.sourceVersionId !== version.id
    || version.sourceId !== handle.sourceId || !['queued','running'].includes(run.status) || !isCurrentDraft(workspace,draft.id)) throw Error('REAL_INPUT_RUN_NOT_DISPATCHABLE')
  const pending = draft.legacyData?.realInputPending as unknown as { reading: { sendSnapshot: { consentAt: string } } }
  return { index: await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,version.rawText!),
    referenceTime: pending.reading.sendSnapshot.consentAt, timezone: 'Asia/Shanghai' }
}

const dispatching = new Set<string>()
/** Explicitly prepared runs are allowed for manifest binding before first dispatch.
 * The live gateway's persistent budget is authoritative across tabs/restarts. */
export async function dispatchRealInput(repo: SemanticRepository, handle: CaptureHandle, execute: ModelExecutor) {
  const key = repo.name + ':' + handle.recognitionRunId
  if (dispatching.has(key)) throw Error('REAL_INPUT_RUN_BUSY')
  dispatching.add(key)
  try {
    const context = await inputRunContext(repo,handle)
    let raw: string
    try { raw = await execute(context) }
    catch {
      await failInputRun(repo,handle)
      throw Error('模型或工程回放未完成；来源已保留，没有自动重试。')
    }
    return await completeInputRun(repo,handle,raw)
  } finally { dispatching.delete(key) }
}

export async function createRealInputRuntime(options: {
  name: string; store: WorkspaceRecordStore & {readonly name: string}; initial?: WorkspaceV8;
  execution: 'live' | 'seen_engineering_replay'; resources: LocalExtractionResources; execute: ModelExecutor;
  recordedA02?: true;
}) {
  options = { ...options, resources: structuredClone(options.resources) }
  if (!['live','seen_engineering_replay'].includes(options.execution)) throw Error('REAL_INPUT_EXECUTION_PROFILE')
  if(options.recordedA02&&(options.execution!=='live'||options.initial||options.name!==recordedA02Identity.name))throw Error('REAL_INPUT_RECORDED_RUNTIME')
  await SemanticRepository.open(options.name,options.store,options.initial,'real-input-01')
  return createMainlineRuntime({name:options.name,store:options.store,profile:'real-input-01',
    recognize:()=>{throw Error('REAL_INPUT_OLD_RECOGNIZER_FORBIDDEN')},
    semanticDriver:async store=>{
      const repo=await SemanticRepository.open(options.name,store,undefined,'real-input-01')
      const facts=(workspace:WorkspaceV8,draftId:string,taskId?:string,onFocus?:(quote:string)=>void)=>
        createElement(SemanticFacts,{state:stateOfRuntime(workspace,draftId),taskId,onFocus})
      return {load:()=>repo.load(),view:semanticView,dates:semanticDates,review:semanticReview,edit:i=>editSemantic(repo,i),
        confirm:i=>confirmSemantic(repo,i),exportJson:()=>repo.exportJson(),capture:async()=>{throw Error('请先在真实输入面板保存并核对本次文字范围。')},
        recognitionDescription:options.recordedA02?'A02历史真实模型响应回放 · 本轮零调用':options.execution==='live'?'真实模型建议 · 尚未逐项核对':'已见匿名工程回放 · 非模型预测',
        realInput:{profile:'real-input-01',networkDescription:options.recordedA02?'只核对已记录A02响应；禁止新发送，不读取密钥，不访问模型。':options.execution==='live'
          ?'本机读取；仅在逐次确认且预算允许时发送本次文字，不发送文件或工作区。':'本机读取与已见工程回放，无外部模型调用。',
          inputPanel:props=>options.recordedA02?createElement('p',{role:'status'},'当前只允许A02历史响应核对，已关闭新录入和发送。请从收件箱恢复A02。'):createElement(InputReview,{...props,repo,resources:options.resources,execution:options.execution,
            send:async(sourceId,pages,reviewed,operationId)=>sendRealInput(repo,{sourceId,pages,reviewed,operationId,revision:semanticRevision(props.workspace)},options.execution,options.execute)}),
          factEditor:props=>createElement(FactCorrectionEditor,{...props,repo})},
        semantic:{facts,timezone:'Asia/Shanghai',exportName:'mainline-real-input-01-workspace.json',
          informationReviewProblem:(w,d)=>informationReviewProblem(stateOfRuntime(w,d)),dispose:i=>disposeSemantic(repo,i),
          taskFacts:(w,id)=>{const state=stateForEntity(w,id);return facts(w,state.draftId,String(w.tasks.find(t=>t.id===id)!.legacyData!.recognitionTempId))},
          eventFacts:(w,id)=>{const event=w.events.find(e=>e.id===id)!,state=stateForEntity(w,id);return {
            startLabel:timeLabel(w.timePoints.find(t=>t.id===event.startTimePointId)?.normalizedValue??null,state.context.timezone),
            endLabel:timeLabel(w.timePoints.find(t=>t.id===event.endTimePointId)?.normalizedValue??null,state.context.timezone),content:facts(w,state.draftId)}},
          eventCount:(w,d,ids)=>relatedAssets(effectiveStateFacts(stateOfRuntime(w,d)).facts,ids).events.size}}
    }})
}
