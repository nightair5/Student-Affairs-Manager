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
import { FactCorrectionEditor, RelationCorrection } from './FactCorrectionEditor'
import { makeSendSnapshot, sha256Text } from './inputReceipt'
import type { ModelExecutor } from './modelClient'
import type { WireContext } from './modelWire'
import { buildModelRequest } from './modelWire'
import { buildCandidate02Request, CANDIDATE02_VERSION } from './candidate02'
import { buildCandidate03Request, CANDIDATE03_VERSION } from './candidate03'
import { buildCandidate04Request, CANDIDATE04_VERSION } from './candidate04'
import { acquireText } from './inputAcquisition'
import { pendingDateTaskIds } from '../mainline05/semanticView'
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
  return stageRecordedResponse(repo,record)
}
export interface RecordedBatch extends Omit<RecordedA02,'version'> {
  version:'recorded-batch-1'; unitId:string
}
export interface RecordedBatchIdentity {unitId:string;requestSha:string;responseSha:string}
export interface RecordedPaired04 {
  version:'recorded-paired04-1'; unitId:string; name:string; operationId:string; title:string;
  context:WireContext; requestSha:string; responseSha:string; rawHttpText:string
}
/** Server-bound paid record, not a model executor. No references or scores enter here. */
export async function replayRecordedPaired04(repo:SemanticRepository,record:RecordedPaired04,identity:RecordedBatchIdentity) {
  record=structuredClone(record);identity=structuredClone(identity)
  exactKeys(record,['version','unitId','name','operationId','title','context','requestSha','responseSha','rawHttpText'])
  exactKeys(identity,['unitId','requestSha','responseSha'])
  const id=record.unitId.slice(0,3),arm=record.unitId.slice(4)
  if(record.version!=='recorded-paired04-1'||!/^N(0[1-9]|1[0-2])-(03|04)$/.test(record.unitId)
    ||record.operationId!=='paired04-source-'+id||record.name!==recordedA02Identity.name
    ||repo.name!==record.name||repo.profile!=='real-input-01'||record.unitId!==identity.unitId
    ||record.requestSha!==identity.requestSha||record.responseSha!==identity.responseSha
    ||await sha256Text(record.rawHttpText)!==identity.responseSha
    ||await sha256Text((await (arm==='03'?buildCandidate03Request:buildCandidate04Request)(record.context)).serialized)!==identity.requestSha)throw Error('REAL_INPUT_P04_IDENTITY')
  const before=await repo.load(),receipt={version:record.version,unitId:record.unitId,requestSha:record.requestSha,responseSha:record.responseSha}
  const existing=before.sources.find(s=>s.legacyData?.captureOperationId===record.operationId)
  if(existing){
    const draft=before.extractionDrafts.find(d=>stableJson(d.legacyData?.realInputRecorded??null)===stableJson(receipt))
    const run=before.recognitionRuns.find(r=>r.id===draft?.recognitionRunId)
    if(!draft||run?.sourceVersionId!==existing.currentVersionId
      ||(draft.legacyData?.mainline05 as {rawHttpText?:string})?.rawHttpText!==record.rawHttpText)throw Error('PAIRED_SOURCE_ARM_ALREADY_CHOSEN')
    return before
  }
  const inputReceipt=await acquireText('paired04-'+id,record.context.index.sourceContent)
  const reading={version:REAL_STATE_VERSION,inputReceipt,sendSnapshot:await makeSendSnapshot(inputReceipt,[1],[1],record.context.referenceTime)}
  return repo.appendPairedRecordedSource(record.operationId,semanticRevision(before),async memory=>{
    const source=await memory.saveReading(inputReceipt,record.title,record.operationId,record.context.referenceTime)
    const actual={index:await indexImmutableScopesV11(source.sourceId,source.sourceVersionId,reading.sendSnapshot.text),
      referenceTime:record.context.referenceTime,timezone:'Asia/Shanghai'}
    if(stableJson(actual)!==stableJson(record.context))throw Error('REAL_INPUT_P04_SOURCE')
    const handle=await memory.beginInputRun(source.sourceId,reading,'live','recorded-paired04-'+record.unitId,
      semanticRevision(await memory.load()),record.context.referenceTime,arm==='03'?CANDIDATE03_VERSION:CANDIDATE04_VERSION)
    await memory.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===handle.draftId
      ?{...d,legacyData:{...d.legacyData,realInputRecorded:receipt}}:d)}))
    await completeInputRun(memory,handle,record.rawHttpText)
    await enableMaterialReview(memory,handle.draftId)
  })
}
export interface RecordedCandidate02 extends Omit<RecordedBatch,'version'> { version:'recorded-candidate02-1' }
/** Already-paid response only. New run identity; old source version and response remain intact. */
export async function replayRecordedCandidate02(repo:SemanticRepository,record:RecordedCandidate02,identity:RecordedBatchIdentity) {
  record=structuredClone(record);identity=structuredClone(identity)
  exactKeys(record,['version','unitId','name','handle','context','requestSha','responseSha','rawHttpText'])
  exactKeys(identity,['unitId','requestSha','responseSha'])
  if(record.version!=='recorded-candidate02-1'||!/^C0[1-8]$/.test(record.unitId)||record.name!==recordedA02Identity.name
    ||record.unitId!==identity.unitId||record.requestSha!==identity.requestSha||record.responseSha!==identity.responseSha
    ||await sha256Text(record.rawHttpText)!==identity.responseSha
    ||await sha256Text((await buildCandidate02Request(record.context)).serialized)!==identity.requestSha)throw Error('REAL_INPUT_C02_IDENTITY')
  if(repo.profile!=='real-input-01'||repo.name!==record.name)throw Error('REAL_INPUT_RECORDED_DATABASE')
  const before=await repo.load(),old=before.extractionDrafts.find(d=>d.id===record.handle.draftId)
  const oldRun=before.recognitionRuns.find(r=>r.id===old?.recognitionRunId)
  const pending=old?.legacyData?.realInputPending as unknown as {reading:RealInputReading;execution:string}
  if(!pending||pending.execution!=='live'||oldRun?.sourceVersionId!==record.handle.sourceVersionId
    ||pending.reading.sendSnapshot?.text!==record.context.index.sourceContent)throw Error('REAL_INPUT_C02_SOURCE')
  const handle=await repo.beginInputRun(record.handle.sourceId,pending.reading,'live','recorded-candidate02-'+record.unitId,
    semanticRevision(before),record.context.referenceTime,CANDIDATE02_VERSION)
  if(handle.sourceVersionId!==record.handle.sourceVersionId)throw Error('REAL_INPUT_C02_SOURCE_VERSION_CHANGED')
  return stageRecordedResponse(repo,{...record,handle})
}
export interface RecordedCandidate03 extends Omit<RecordedBatch,'version'> { version:'recorded-candidate03-1' }
/** Already-paid response only. New run identity; old source version and response remain intact. */
export async function replayRecordedCandidate03(repo:SemanticRepository,record:RecordedCandidate03,identity:RecordedBatchIdentity) {
  record=structuredClone(record);identity=structuredClone(identity)
  exactKeys(record,['version','unitId','name','handle','context','requestSha','responseSha','rawHttpText'])
  exactKeys(identity,['unitId','requestSha','responseSha'])
  if(record.version!=='recorded-candidate03-1'||!/^D0[1-8]$/.test(record.unitId)||record.name!==recordedA02Identity.name
    ||record.unitId!==identity.unitId||record.requestSha!==identity.requestSha||record.responseSha!==identity.responseSha
    ||await sha256Text(record.rawHttpText)!==identity.responseSha
    ||await sha256Text((await buildCandidate03Request(record.context)).serialized)!==identity.requestSha)throw Error('REAL_INPUT_C03_IDENTITY')
  if(repo.profile!=='real-input-01'||repo.name!==record.name)throw Error('REAL_INPUT_RECORDED_DATABASE')
  const before=await repo.load(),old=before.extractionDrafts.find(d=>d.id===record.handle.draftId)
  const oldRun=before.recognitionRuns.find(r=>r.id===old?.recognitionRunId)
  const pending=old?.legacyData?.realInputPending as unknown as {reading:RealInputReading;execution:string}
  if(!pending||pending.execution!=='live'||oldRun?.sourceVersionId!==record.handle.sourceVersionId
    ||pending.reading.sendSnapshot?.text!==record.context.index.sourceContent)throw Error('REAL_INPUT_C03_SOURCE')
  const version=before.sourceVersions.find(v=>v.id===record.handle.sourceVersionId)
  if(!version||version.sourceId!==record.handle.sourceId||oldRun.id!==record.handle.recognitionRunId
    ||stableJson({index:await indexImmutableScopesV11(version.sourceId,version.id,version.rawText!),
      referenceTime:pending.reading.sendSnapshot.consentAt,timezone:'Asia/Shanghai'})!==stableJson(record.context))throw Error('REAL_INPUT_C03_SOURCE')
  return repo.appendRecordedInput({source:record.handle,reading:pending.reading,operationId:'recorded-candidate03-'+record.unitId,
    requestSha:record.requestSha,responseSha:record.responseSha,rawHttpText:record.rawHttpText,
    revision:semanticRevision(before),promptVersion:CANDIDATE03_VERSION},async(memory,handle)=>{
    await completeInputRun(memory,handle,record.rawHttpText)
    await enableMaterialReview(memory,handle.draftId)
  })
}
/** A settled, server-bound response; not a new prediction or an engineering answer. */
export async function replayRecordedBatch(repo:SemanticRepository,record:RecordedBatch,identity:RecordedBatchIdentity) {
  record=structuredClone(record);identity=structuredClone(identity)
  exactKeys(record,['version','unitId','name','handle','context','requestSha','responseSha','rawHttpText'])
  exactKeys(identity,['unitId','requestSha','responseSha'])
  if(record.version!=='recorded-batch-1'||! /^(?:A0[3-8]|B0[1-8])$/.test(record.unitId)
    ||record.name!==recordedA02Identity.name||record.unitId!==identity.unitId||record.requestSha!==identity.requestSha
    ||record.responseSha!==identity.responseSha||await sha256Text(record.rawHttpText)!==identity.responseSha
    ||await sha256Text((await buildModelRequest(record.context)).serialized)!==identity.requestSha)throw Error('REAL_INPUT_BATCH_RECORDED_IDENTITY')
  return stageRecordedResponse(repo,record)
}
async function stageRecordedResponse(repo:SemanticRepository,record:RecordedA02|RecordedBatch|RecordedCandidate02|RecordedCandidate03) {
  if(repo.profile!=='real-input-01'||repo.name!==record.name)throw Error('REAL_INPUT_RECORDED_DATABASE')
  const before=await repo.load(),draft=before.extractionDrafts.find(d=>d.id===record.handle.draftId)
  const pending=draft?.legacyData?.realInputPending as {execution?:string}|undefined
  if(pending?.execution!=='live')throw Error('REAL_INPUT_RECORDED_PROVENANCE')
  if(record.version!=='recorded-a02-1'&&draft?.status==='failed'){
    const failure=draft.legacyData?.mainline05Failure as {response?:unknown}|undefined
    if(failure?.response!==record.rawHttpText)throw Error('REAL_INPUT_RECORDED_EXISTING_MISMATCH')
    throw Error('REAL_INPUT_RECORDED_REJECTED_PRESERVED')
  }
  if(draft?.legacyData?.mainline05){
    const state=stateOfRuntime(before,draft.id)
    if(state.version!==REAL_STATE_VERSION||state.execution!=='live'||state.rawHttpText!==record.rawHttpText||!materialReviewEnabled(state))throw Error('REAL_INPUT_RECORDED_EXISTING_MISMATCH')
    return before
  }
  if(stableJson(await inputRunContext(repo,record.handle))!==stableJson(record.context))throw Error('REAL_INPUT_RECORDED_CONTEXT')
  const memory=Object.assign(new MemoryWorkspaceRecordStore(),{name:repo.name})
  await new CanonicalWorkspaceRepository(memory).save(before)
  const staged=await SemanticRepository.open(repo.name,memory,undefined,'real-input-01')
  try { await completeInputRun(staged,record.handle,record.rawHttpText) }
  catch(error){
    if(record.version==='recorded-a02-1')throw error
    const failed=await staged.load(),failedDraft=failed.extractionDrafts.find(d=>d.id===record.handle.draftId)
    const failure=failedDraft?.legacyData?.mainline05Failure as {response?:unknown}|undefined
    if(failedDraft?.status!=='failed'||failure?.response!==record.rawHttpText)throw error
    await repo.transaction(w=>{
      if(semanticRevision(w)!==semanticRevision(before))throw Error('REAL_INPUT_STALE_RELOAD_REQUIRED')
      return failed
    })
    throw Error('REAL_INPUT_RECORDED_REJECTED_PRESERVED',{cause:error})
  }
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
  if (draft?.legacyData?.realInputRecorded) throw Error('REAL_INPUT_RECORDED_NEVER_DISPATCHABLE')
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
  recordedBatch?: true;
  recordedCandidate02?: true;
  recordedCandidate03?: true;
  recordedPaired04?: true;
}) {
  options = { ...options, resources: structuredClone(options.resources) }
  if (!['live','seen_engineering_replay'].includes(options.execution)) throw Error('REAL_INPUT_EXECUTION_PROFILE')
  if(options.recordedA02&&(options.execution!=='live'||options.initial||options.name!==recordedA02Identity.name))throw Error('REAL_INPUT_RECORDED_RUNTIME')
  if(options.recordedBatch&&(options.recordedA02||options.execution!=='live'||options.initial||options.name!==recordedA02Identity.name))throw Error('REAL_INPUT_BATCH_RECORDED_RUNTIME')
  if(options.recordedCandidate02&&!options.recordedBatch)throw Error('REAL_INPUT_C02_RECORDED_RUNTIME')
  if(options.recordedCandidate03&&!options.recordedCandidate02)throw Error('REAL_INPUT_C03_RECORDED_RUNTIME')
  if(options.recordedPaired04&&!options.recordedCandidate03)throw Error('REAL_INPUT_P04_RECORDED_RUNTIME')
  await SemanticRepository.open(options.name,options.store,options.initial,'real-input-01')
  return createMainlineRuntime({name:options.name,store:options.store,profile:'real-input-01',
    recognize:()=>{throw Error('REAL_INPUT_OLD_RECOGNIZER_FORBIDDEN')},
    semanticDriver:async store=>{
      const repo=await SemanticRepository.open(options.name,store,undefined,'real-input-01')
      const facts=(workspace:WorkspaceV8,draftId:string,taskId?:string,onFocus?:(quote:string)=>void)=>
        createElement(SemanticFacts,{state:stateOfRuntime(workspace,draftId),taskId,onFocus})
      return {load:()=>repo.load(),view:semanticView,dates:semanticDates,review:semanticReview,edit:i=>editSemantic(repo,i),
        confirm:i=>confirmSemantic(repo,i),exportJson:()=>repo.exportJson(),capture:async()=>{throw Error('请先在真实输入面板保存并核对本次文字范围。')},
        recognitionDescription:options.recordedPaired04?'候选03/04配对真实回答 · 逐项人工核对':options.recordedCandidate03?'候选03与历史真实模型回答 · 逐项人工核对':options.recordedCandidate02?'新候选02与历史真实模型回答 · 逐项人工核对':options.recordedBatch?'已记录真实模型批次 · 原回答核对，不再调用模型':options.recordedA02?'A02历史真实模型响应回放 · 本轮零调用':options.execution==='live'?'真实模型建议 · 尚未逐项核对':'已见匿名工程回放 · 非模型预测',
        realInput:{profile:'real-input-01',networkDescription:options.recordedPaired04?'24次配对已完成，本包累计56次；仅本机回放，不再发送。':options.recordedCandidate03?'候选03的8次已完成，本包累计32次；当前仅本机回放，不再发送。':options.recordedCandidate02?'新候选8次已完成，本包累计24次；当前仅本机回放，不再发送。':options.recordedBatch?'本批14次已派发完毕；仅核对已记录响应与本机提取文字，不再发送。':options.recordedA02?'只核对已记录A02响应；禁止新发送，不读取密钥，不访问模型。':options.execution==='live'
          ?'本机读取；仅在逐次确认且预算允许时发送本次文字，不发送文件或工作区。':'本机读取与已见工程回放，无外部模型调用。',
          inputPanel:props=>options.recordedCandidate02?createElement(InputReview,{...props,repo,resources:options.resources,execution:options.execution,localOnly:true,
            send:async()=>{throw Error('REAL_INPUT_NEW_SEND_DISABLED')}}):options.recordedBatch?createElement('p',{role:'status'},'本批已调用完成；请从收件箱核对原回答。没有额外模型请求授权，新发送已关闭。'):options.recordedA02?createElement('p',{role:'status'},'当前只允许A02历史响应核对，已关闭新录入和发送。请从收件箱恢复A02。'):createElement(InputReview,{...props,repo,resources:options.resources,execution:options.execution,
            send:async(sourceId,pages,reviewed,operationId)=>sendRealInput(repo,{sourceId,pages,reviewed,operationId,revision:semanticRevision(props.workspace)},options.execution,options.execute)}),
          pendingDateTaskIds,factEditor:props=>createElement(FactCorrectionEditor,{...props,repo}),draftEditor:props=>createElement(RelationCorrection,{...props,repo})},
        semantic:{facts,timezone:'Asia/Shanghai',exportName:'mainline-real-input-01-workspace.json',
          informationReviewProblem:(w,d)=>informationReviewProblem(stateOfRuntime(w,d)),dispose:i=>disposeSemantic(repo,i),
          taskFacts:(w,id)=>{const state=stateForEntity(w,id);return facts(w,state.draftId,String(w.tasks.find(t=>t.id===id)!.legacyData!.recognitionTempId))},
          eventFacts:(w,id)=>{const event=w.events.find(e=>e.id===id)!,state=stateForEntity(w,id);return {
            startLabel:timeLabel(w.timePoints.find(t=>t.id===event.startTimePointId)?.normalizedValue??null,state.context.timezone),
            endLabel:timeLabel(w.timePoints.find(t=>t.id===event.endTimePointId)?.normalizedValue??null,state.context.timezone),content:facts(w,state.draftId)}},
          eventCount:(w,d,ids)=>relatedAssets(effectiveStateFacts(stateOfRuntime(w,d)).facts,ids).events.size}}
    }})
}
