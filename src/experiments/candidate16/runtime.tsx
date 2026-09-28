import {type ReactNode} from 'react'
import {CanonicalWorkspaceRepository,type WorkspaceRecordStore} from '../../domain/v2/repository'
import {createMainlineRuntime} from '../mainline02/runtime'
import {createRealInputRuntime,emptyRealInputWorkspace} from '../realInput01/runtime'
import {SemanticRepository} from '../mainline05/semanticRepository'
import {effectiveStateFacts,stateOfRuntime} from '../mainline05/semanticState'
import {stableJson} from '../mainline04/semanticContract'
import {sha256Text} from '../realInput01/inputReceipt'
import {createD13Store,createD13Measurement} from './measurement'
import {openD13Replay,type D13ReplayRecord} from './replay'
import {assertRevisionSelection,inspectRevisionLinks} from './revisionGuard'
import {D13ReplayPicker,type D13ReplayChoice} from './ReplayPicker'

export async function createD13Runtime(options:{transport:WorkspaceRecordStore&{name:string};choices:readonly D13ReplayChoice[];read:(id:string)=>Promise<D13ReplayRecord>}){
  const metrics=createD13Measurement(options.transport),observed=createD13Store(options.transport,metrics),store=observed.store
  const existing=await store.read('current')
  const base=await createRealInputRuntime({name:store.name,store,...(existing===undefined?{initial:emptyRealInputWorkspace(store.name)}:{}),execution:'seen_engineering_replay',resources:{workerPath:'',corePath:'',langPath:'',pdfWorkerPath:''},execute:async()=>{throw Error('D13_MODEL_DISABLED')}})
  const repo=await SemanticRepository.open(store.name,store,undefined,'real-input-01')
  let opening=false
  const open=async(id:string)=>{
    if(opening||!options.choices.some(c=>c.id===id))throw Error('D13_REPLAY_BUSY_OR_UNKNOWN')
    opening=true
    try{const record=await options.read(id);if(record.id!==id)throw Error('D13_RECORD_IDENTITY')
      const draftId=await openD13Replay(repo,record)
      const original={recordId:id,kind:record.kind,candidateVersion:record.candidateVersion,requestSha256:record.requestSha256,responseSha256:record.responseSha256,context:record.context,rawHttpText:record.rawHttpText,programConversion:'SCOPE_ID_REBIND_ONLY; legacy replay parser; model first answer unchanged'}
      await options.transport.transaction('d13-original:'+draftId,prior=>{if(prior!==undefined&&stableJson(prior)!==stableJson(original))throw Error('D13_ORIGINAL_DRIFT');return original})
      await metrics.begin(draftId,{recordId:id,sourceSha256:await sha256Text(record.context.index.sourceContent),firstOutputSha256:record.responseSha256})
      return draftId
    }finally{opening=false}
  }
  const readback=async()=>{const a=await repo.load(),b=await new CanonicalWorkspaceRepository(options.transport).load();if(!b||stableJson(a)!==stableJson(b))throw Error('D13_READBACK_MISMATCH');return b}
  const instrument=(draftId:string,content:ReactNode)=><section onChangeCapture={e=>{
    const target=e.target as HTMLElement,label=target.closest('label')?.textContent??target.getAttribute('aria-label')??'unlabelled'
    void metrics.changed(draftId,label).catch(()=>undefined)
  }} onBlurCapture={()=>{void metrics.blur(draftId)}}>{content}</section>
  const runtime=await createMainlineRuntime({name:store.name,store,profile:'real-input-01',recognize:()=>{throw Error('D13_RECOGNIZER_DISABLED')},semanticDriver:async()=>({...base,
    recognitionDescription:'D13隔离工程回放 · 非真人试用 · 不代表Candidate16输出',
    realInput:{...base.realInput!,networkDescription:'仅本机已录制结果；新模型调用和旧用户库访问关闭。',
      inputPanel:props=><D13ReplayPicker choices={options.choices} open={async id=>{const draft=await open(id);await props.onSaved();await props.onDraftReady(draft)}}/>,
      onReviewFieldInput:(draftId,itemId,field)=>{void metrics.changed(draftId,itemId+':'+field)},
      factEditor:props=>instrument(props.draftId,base.realInput!.factEditor(props)),
      informationEditor:props=>instrument(props.draftId,base.realInput!.informationEditor?.(props)),
      draftEditor:props=>{const issues=inspectRevisionLinks(effectiveStateFacts(stateOfRuntime(props.workspace,props.draftId)).facts)
        return <>{issues.length>0&&<p role="alert">修订引用需纠正：{issues.map(i=>`${i.code}（${i.taskIds.join('、')||'无法定位端点'}）`).join('；')}。受影响项暂不能确认；原回答仍保留，请核对原文后编辑关系。</p>}{instrument(props.draftId,base.realInput!.draftEditor?.(props))}</>}},
    confirm:async intent=>{const before=await repo.load();assertRevisionSelection(effectiveStateFacts(stateOfRuntime(before,intent.draftId)).facts,intent.taskTempIds)
      const saved=await base.confirm(intent);await readback();const draft=saved.extractionDrafts.find(d=>d.id===intent.draftId)!
      await metrics.finish(intent.draftId,draft.status==='confirmed'?'confirmed':'partial');return saved},
    semantic:{...base.semantic!,dispose:async intent=>{if(intent.kind==='reject')await metrics.changed(intent.draftId,'disposition.reject.'+intent.taskTempIds.join(','));const saved=await base.semantic!.dispose(intent);await readback();if(intent.kind==='review_info')await metrics.finish(intent.draftId,'no_task');return saved}},
  })})
  return {runtime,repository:repo,metrics,observed,open,independentReadback:readback}
}
