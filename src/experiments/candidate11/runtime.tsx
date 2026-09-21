import {useState} from 'react'
import {CanonicalWorkspaceRepository,type WorkspaceRecordStore} from '../../domain/v2/repository'
import {createMainlineRuntime} from '../mainline02/runtime'
import {createRealInputRuntime,emptyRealInputWorkspace} from '../realInput01/runtime'
import {SemanticRepository} from '../mainline05/semanticRepository'
import {stableJson} from '../mainline04/semanticContract'
import {createC11Store,C11_DATABASE,type C11ObservationOrigin} from './observation'
import {openC11Replay,type C11ReplayRecord} from './replay'

interface C11Choice {id:string;label:string;kind:C11ReplayRecord['kind']}
function ReplayPicker({choices,open}:{choices:readonly C11Choice[];open:(id:string)=>Promise<void>}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <section aria-label="C11 回放材料"><p>默认比较基线：candidate03。candidate11 模型结果：NOT_RUN。只在本机回放匿名材料，确认结果保存在本入口。</p>
    <p>工程夹具验证产品链路；历史模型回答来自已见开发集。两者均不代表 candidate11 的效果。</p>
    {choices.map(choice=><button className="secondary-button" key={choice.id} disabled={busy} onClick={()=>{
      setBusy(true);setError('');void open(choice.id).catch(()=>setError('回放未完成，已有来源与草稿已保留。请检查本地诊断记录。')).finally(()=>setBusy(false))
    }}>{choice.label}</button>)}
    {busy&&<p role="status">正在载入本机回放…</p>}{error&&<p role="alert">{error}</p>}
  </section>
}

export async function createCandidate11Runtime(options:{transport:WorkspaceRecordStore&{name:string};
  choices:readonly C11Choice[];read:(id:string)=>Promise<C11ReplayRecord>;origin?:C11ObservationOrigin}) {
  const observed=createC11Store(options.transport,options.origin??'UNKNOWN'),store=observed.store
  const existing=await store.read('current')
  const base=await createRealInputRuntime({name:C11_DATABASE,store,...(existing===undefined?{initial:emptyRealInputWorkspace(C11_DATABASE)}:{}),
    execution:'seen_engineering_replay',resources:{workerPath:'',corePath:'',langPath:'',pdfWorkerPath:''},
    execute:async()=>{throw Error('C11_NEW_MODEL_CALL_DISABLED')}})
  const repo=await SemanticRepository.open(C11_DATABASE,store,undefined,'real-input-01')
  let opening:Promise<string>|undefined
  const open=async(id:string)=>{
    if(!options.choices.some(choice=>choice.id===id))throw Error('C11_REPLAY_NOT_LISTED')
    if(opening)throw Error('C11_REPLAY_BUSY')
    opening=(async()=>{
      const record=await options.read(id)
      if(record.id!==id)throw Error('C11_REPLAY_CHOICE_IDENTITY')
      const draftId=await openC11Replay(repo,record)
      // Separate original identity from locally rebound scopes and user edits.
      await options.transport.transaction('c11-original-'+draftId,prior=>{
        const original={recordId:id,kind:record.kind,originalRequestSha:record.requestSha,originalResponseSha:record.responseSha,
          originalContext:record.context,originalRawHttpText:record.rawHttpText,scopeAdapter:'candidate11-scope-rebind-1'}
        if(prior!==undefined&&stableJson(prior)!==stableJson(original))throw Error('C11_ORIGINAL_CHANGED')
        return original
      })
      return draftId
    })()
    try{return await opening}finally{opening=undefined}
  }
  const runtime=await createMainlineRuntime({name:C11_DATABASE,store,profile:'real-input-01',recognize:()=>{throw Error('C11_OLD_RECOGNIZER_DISABLED')},
    semanticDriver:async()=>({...base,semantic:base.semantic!,recognitionDescription:'C11 独立工程入口 · candidate03 基线 · candidate11 尚未实测',
      view:workspace=>{
        const view=base.view(workspace)
        return {...view,drafts:view.drafts.map(draft=>{
          const canonical=workspace.extractionDrafts.find(d=>d.id===draft.id)
          const run=workspace.recognitionRuns.find(r=>r.id===canonical?.recognitionRunId)
          return {...draft,modelName:run?.provider==='manual'?'人工工程夹具（非模型预测）':'历史 candidate03 回放（非本次调用）'}
        })}
      },
      realInput:{...base.realInput!,networkDescription:'本机匿名回放，模型发送关闭；历史原答、局部scope绑定与用户修改分开保留。',
        inputPanel:props=><ReplayPicker choices={options.choices} open={async id=>{const draftId=await open(id);await props.onSaved();await props.onDraftReady(draftId)}}/>},
      confirm:async intent=>{
        await observed.append('confirmation_requested',await repo.load(),intent.draftId)
        const saved=await base.confirm(intent).catch(async error=>{
          await observed.append('commit_failed',await repo.load(),intent.draftId);throw error
        })
        const readback=await new CanonicalWorkspaceRepository(options.transport).load()
        if(stableJson(saved)!==stableJson(readback))throw Error('C11_READBACK_MISMATCH')
        await observed.append('readback_verified',saved,intent.draftId)
        return saved
      }})})
  return {runtime,open,observed,repository:repo,independentReadback:()=>new CanonicalWorkspaceRepository(options.transport).load()}
}
