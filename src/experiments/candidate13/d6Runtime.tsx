import {useState} from 'react'
import {CanonicalWorkspaceRepository,type WorkspaceRecordStore} from '../../domain/v2/repository'
import {createMainlineRuntime} from '../mainline02/runtime'
import {createRealInputRuntime,emptyRealInputWorkspace} from '../realInput01/runtime'
import {SemanticRepository} from '../mainline05/semanticRepository'
import {stableJson} from '../mainline04/semanticContract'
import {createD6Store,D6_DATABASE,type D6ObservationOrigin} from './d6Observation'
import {openD6Replay,type D6ReplayRecord} from './d6Replay'

interface Choice {id:string;label:string;kind:D6ReplayRecord['kind']}
function ReplayPicker({choices,open}:{choices:readonly Choice[];open:(id:string)=>Promise<void>}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <section aria-label="D6录制结果"><p><strong>工程回放 / 录制结果 / 非真人试用</strong></p><p>这里仅重放D6已经产生的模型回答。不会再次调用模型，也不会计入正确处置率、低修改正确处置率或主动修改时间。</p>
    {choices.map(choice=><button className="secondary-button" key={choice.id} disabled={busy} onClick={()=>{setBusy(true);setError('');void open(choice.id).catch(()=>setError('回放未完成，已有来源与草稿已保留。')).finally(()=>setBusy(false))}}>{choice.label}</button>)}
    {busy&&<p role="status">正在载入本机录制结果…</p>}{error&&<p role="alert">{error}</p>}</section>
}
export async function createD6Runtime(options:{transport:WorkspaceRecordStore&{name:string};choices:readonly Choice[];read:(id:string)=>Promise<D6ReplayRecord>;origin?:D6ObservationOrigin}){
  const observed=createD6Store(options.transport,options.origin??'UNKNOWN'),store=observed.store,existing=await store.read('current')
  const base=await createRealInputRuntime({name:D6_DATABASE,store,...(existing===undefined?{initial:emptyRealInputWorkspace(D6_DATABASE)}:{}),execution:'seen_engineering_replay',resources:{workerPath:'',corePath:'',langPath:'',pdfWorkerPath:''},execute:async()=>{throw Error('D6_NEW_MODEL_CALL_DISABLED')}})
  const repo=await SemanticRepository.open(D6_DATABASE,store,undefined,'real-input-01');let opening:Promise<string>|undefined
  const open=async(id:string)=>{if(!options.choices.some(choice=>choice.id===id))throw Error('D6_REPLAY_NOT_LISTED');if(opening)throw Error('D6_REPLAY_BUSY')
    opening=(async()=>{const record=await options.read(id);if(record.id!==id)throw Error('D6_REPLAY_CHOICE_IDENTITY');const draftId=await openD6Replay(repo,record)
      await options.transport.transaction('d6-original-'+draftId,prior=>{const original={recordId:id,kind:record.kind,candidateVersion:record.candidateVersion,originalRequestSha256:record.requestSha256,originalResponseSha256:record.responseSha256,originalContext:record.context,originalRawHttpText:record.rawHttpText,scopeAdapter:'candidate13-d6-scope-rebind-1'};if(prior!==undefined&&stableJson(prior)!==stableJson(original))throw Error('D6_ORIGINAL_CHANGED');return original});return draftId})()
    try{return await opening}finally{opening=undefined}}
  const runtime=await createMainlineRuntime({name:D6_DATABASE,store,profile:'real-input-01',recognize:()=>{throw Error('D6_OLD_RECOGNIZER_DISABLED')},semanticDriver:async()=>({...base,semantic:base.semantic!,
    recognitionDescription:'D6独立工程回放 · Candidate03 vs Candidate13 · 录制结果 · 非真人试用',view:workspace=>{const view=base.view(workspace);return {...view,drafts:view.drafts.map(draft=>({...draft,modelName:'D6录制结果（原始候选身份保存在独立记录）'}))}},
    realInput:{...base.realInput!,networkDescription:'本机只读载入D6录制回答；新模型发送关闭，原始回答与用户编辑分开保留。',inputPanel:props=><ReplayPicker choices={options.choices} open={async id=>{const draftId=await open(id);await props.onSaved();await props.onDraftReady(draftId)}}/>},
    confirm:async intent=>{await observed.append('confirmation_requested',await repo.load(),intent.draftId);const saved=await base.confirm(intent).catch(async error=>{await observed.append('commit_failed',await repo.load(),intent.draftId);throw error});const readback=await new CanonicalWorkspaceRepository(options.transport).load();if(stableJson(saved)!==stableJson(readback))throw Error('D6_READBACK_MISMATCH');await observed.append('readback_verified',saved,intent.draftId);return saved}})})
  return {runtime,open,observed,repository:repo,independentReadback:()=>new CanonicalWorkspaceRepository(options.transport).load()}
}
