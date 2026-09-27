import {useState} from 'react'
import {CanonicalWorkspaceRepository,type WorkspaceRecordStore} from '../../domain/v2/repository'
import {createMainlineRuntime} from '../mainline02/runtime'
import {createRealInputRuntime,emptyRealInputWorkspace} from '../realInput01/runtime'
import {SemanticRepository} from '../mainline05/semanticRepository'
import {stableJson} from '../mainline04/semanticContract'
import {createD8Store,D8_DATABASE,type D8ObservationOrigin} from './d8Observation'
import {openD8Replay,type D8ReplayRecord} from './d8Replay'
import {sha256Text} from '../realInput01/inputReceipt'
import {createD8UiMeasurement} from './uiMeasurement'
import type {D8EditCategory} from './measurement'

interface Choice {id:string;label:string;kind:D8ReplayRecord['kind']}
function ReplayPicker({choices,open}:{choices:readonly Choice[];open:(id:string)=>Promise<void>}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <section aria-label="D8录制结果"><p><strong>工程回放 / D6已见录制结果 / 非真人试用</strong></p><p>这里仅重放D6已经产生的模型回答。不会再次调用模型，也不会计入真人正确处置率、低修改正确处置率或主动修改时间。</p>
    {choices.map(choice=><button className="secondary-button" key={choice.id} disabled={busy} onClick={()=>{setBusy(true);setError('');void open(choice.id).catch(()=>setError('回放未完成，已有来源与草稿已保留。')).finally(()=>setBusy(false))}}>{choice.label}</button>)}
    {busy&&<p role="status">正在载入本机录制结果…</p>}{error&&<p role="alert">{error}</p>}</section>
}
export async function createD8Runtime(options:{transport:WorkspaceRecordStore&{name:string};choices:readonly Choice[];read:(id:string)=>Promise<D8ReplayRecord>;origin?:D8ObservationOrigin}){
  const observed=createD8Store(options.transport,options.origin??'UNKNOWN'),store=observed.store,existing=await store.read('current'),metrics=createD8UiMeasurement(options.transport)
  const base=await createRealInputRuntime({name:D8_DATABASE,store,...(existing===undefined?{initial:emptyRealInputWorkspace(D8_DATABASE)}:{}),execution:'seen_engineering_replay',resources:{workerPath:'',corePath:'',langPath:'',pdfWorkerPath:''},execute:async()=>{throw Error('D8_NEW_MODEL_CALL_DISABLED')}})
  const repo=await SemanticRepository.open(D8_DATABASE,store,undefined,'real-input-01');if(existing!==undefined)await metrics.resume((await repo.load()).extractionDrafts.map(row=>row.id));let opening:Promise<string>|undefined
  const open=async(id:string)=>{if(!options.choices.some(choice=>choice.id===id))throw Error('D8_REPLAY_NOT_LISTED');if(opening)throw Error('D8_REPLAY_BUSY')
    opening=(async()=>{const record=await options.read(id);if(record.id!==id)throw Error('D8_REPLAY_CHOICE_IDENTITY');const draftId=await openD8Replay(repo,record)
      await metrics.begin(draftId,{trialId:record.id,origin:'ENGINEERING_REPLAY',sourceSha256:await sha256Text(record.context.index.sourceContent),candidateSha256:record.requestSha256,firstOutputSha256:record.responseSha256,registeredAtMs:Date.now(),humanAuthorityVerified:false})
      await options.transport.transaction('d8-original-'+draftId,prior=>{const original={recordId:id,kind:record.kind,candidateVersion:record.candidateVersion,originalRequestSha256:record.requestSha256,originalResponseSha256:record.responseSha256,originalContext:record.context,originalRawHttpText:record.rawHttpText,scopeAdapter:'candidate13-d8-scope-rebind-1'};if(prior!==undefined&&stableJson(prior)!==stableJson(original))throw Error('D8_ORIGINAL_CHANGED');return original});return draftId})()
    try{return await opening}finally{opening=undefined}}
  const category=(target:EventTarget):D8EditCategory|undefined=>{const label=target instanceof HTMLElement?target.closest('label')?.textContent??target.getAttribute('aria-label')??'':'';return /时间|日期|截止/.test(label)?'time':/条件/.test(label)?'condition':/材料|格式|文件/.test(label)?'material':/完成|标准/.test(label)?'completion_standard':/动作/.test(label)?'action':/对象|事项/.test(label)?'object':/依赖|前置/.test(label)?'dependency':/修订|取消|替代/.test(label)?'revision':undefined}
  const fieldIds=new WeakMap<EventTarget,string>()
  const fieldKey=(target:EventTarget)=>{let key=fieldIds.get(target);if(!key){key=crypto.randomUUID();fieldIds.set(target,key)}return key}
  const verifiedReadback=async()=>{const live=await repo.load(),readback=await new CanonicalWorkspaceRepository(options.transport).load();if(stableJson(live)!==stableJson(readback))throw Error('D8_READBACK_MISMATCH')}
  const runtime=await createMainlineRuntime({name:D8_DATABASE,store,profile:'real-input-01',recognize:()=>{throw Error('D8_OLD_RECOGNIZER_DISABLED')},semanticDriver:async()=>({...base,semantic:base.semantic!,
    edit:async request=>{const saved=await base.edit(request);await verifiedReadback();await metrics.saved(request.draftId,request.operationId);return saved},
    recognitionDescription:'D8独立工程回放 · D6已见Candidate03/Candidate13录制结果 · 非真人试用',view:workspace=>{const view=base.view(workspace);return {...view,drafts:view.drafts.map(draft=>({...draft,modelName:'D6已见录制结果（原始候选身份在隔离记录中）'}))}},
    realInput:{...base.realInput!,networkDescription:'本机只读载入D6录制回答；新模型发送关闭，原始回答与用户编辑分开保留。',inputPanel:props=><ReplayPicker choices={options.choices} open={async id=>{const draftId=await open(id);await props.onSaved();await props.onDraftReady(draftId)}}/>,
      onReviewFieldInput:(draftId,itemId,field)=>{void metrics.changed(draftId,field==='deadline'?'time':'title',itemId+':'+field)},
      factEditor:props=><section onChangeCapture={e=>{void metrics.changed(props.draftId,category(e.target),fieldKey(e.target))}}>{base.realInput!.factEditor({...props,onSaved:async()=>{await props.onSaved();await verifiedReadback();await metrics.saved(props.draftId)}})}</section>,
      draftEditor:props=><section onChangeCapture={e=>{void metrics.changed(props.draftId,category(e.target),fieldKey(e.target))}}>{base.realInput!.draftEditor?.({...props,onSaved:async()=>{await props.onSaved();await verifiedReadback();await metrics.saved(props.draftId)}})}</section>},
    confirm:async intent=>{let saved;await metrics.confirmation(intent.draftId,async()=>{await observed.append('confirmation_requested',await repo.load(),intent.draftId);saved=await base.confirm(intent).catch(async error=>{await observed.append('commit_failed',await repo.load(),intent.draftId);throw error});const readback=await new CanonicalWorkspaceRepository(options.transport).load();if(stableJson(saved)!==stableJson(readback))throw Error('D8_READBACK_MISMATCH');await observed.append('readback_verified',saved,intent.draftId)});return saved!}})})
  return {runtime,open,observed,metrics,repository:repo,independentReadback:()=>new CanonicalWorkspaceRepository(options.transport).load()}
}
