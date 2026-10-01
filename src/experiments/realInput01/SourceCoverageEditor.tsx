import {useEffect,useRef,useState} from 'react'
import type {WorkspaceV8} from '../../domain/v2/types'
import type {SemanticRepository} from '../mainline05/semanticRepository'
import {correctSemanticFact} from '../mainline05/semanticConfirmation'
import {effectiveStateFacts,isCurrentDraft,life,semanticRevision,stateOfRuntime} from '../mainline05/semanticState'
import type {D20ReviewSessionRepository} from '../candidate16/d20ReviewSession'
import {useD21EditorCheckpoint} from '../candidate16/useD21EditorCheckpoint'
import {sourceCoverageGaps} from './sourceCoverage'

export function SourceCoverageEditor({repo,workspace,draftId,busy,onDirty,onSaved,reviewSession}:{repo:SemanticRepository;workspace:WorkspaceV8;draftId:string;busy:boolean;onDirty:(v:boolean)=>void;onSaved:()=>Promise<void>;reviewSession?:D20ReviewSessionRepository}){
  const state=stateOfRuntime(workspace,draftId),facts=effectiveStateFacts(state).facts,gaps=sourceCoverageGaps(facts,state.context.index)
  const [scopeId,setScope]=useState(''),[category,setCategory]=useState<'information'|'provenance'|''>(''),[note,setNote]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState('')
  const notify=useRef(onDirty);useEffect(()=>{notify.current=onDirty},[onDirty])
  useEffect(()=>{notify.current(Boolean(scopeId)||working);return()=>notify.current(false)},[scopeId,working])
  const checkpoint=useD21EditorCheckpoint({repo:reviewSession,workspace,draftId,field:'relation:source:information',base:{sourceVersionId:state.sourceVersionId},value:{scopeId,category,note},active:Boolean(scopeId),restore:saved=>{setScope(saved.scopeId);setCategory(saved.category);setNote(saved.note)}})
  const blocked=busy||working||life(state).informationReviewed||!isCurrentDraft(workspace,draftId)
  async function save(){if(!category||!checkpoint.readyToSave)return;setWorking(true);setError('');try{
    await checkpoint.withFresh(()=>correctSemanticFact(repo,{draftId,revision:semanticRevision(workspace),operationId:crypto.randomUUID(),change:{kind:'information_scope',value:category,scopeIds:[scopeId],note}}))
    await checkpoint.clear();setScope('');setCategory('');setNote('');await onSaved()
  }catch(cause){setError(String(cause))}finally{setWorking(false)}}
  return <section aria-label="未处理原文逐片段核对"><h3>尚未处理的原文</h3>
    <p>若片段包含遗漏任务、事件或时间，请先在本页补录。只有确认它是非任务说明或样本出处后，才单独记录信息核对；不会自动处理所有片段。</p>
    {!gaps.length&&<p>当前片段覆盖完整；保存成功仍不代表语义已经裁决。</p>}
    {gaps.map(s=><div key={s.id}><blockquote>{s.text}</blockquote><p>{s.reason}</p><button type="button" disabled={blocked||Boolean(scopeId)} onClick={()=>{setScope(s.id);setCategory('');setNote('');setError('')}}>核对这个片段：{s.text}</button></div>)}
    {scopeId&&<fieldset disabled={blocked}><legend>人工核对单个片段</legend><blockquote>{state.context.index.scopes.find(s=>s.id===scopeId)?.text}</blockquote>
      <label>片段性质<select aria-label="片段性质" value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option value="">请主动判断</option><option value="information">已核对：非任务信息／当前时间未知说明</option><option value="provenance">仅样本出处标签，不属于通知事实</option></select></label>
      <label>核对理由<input aria-label="片段核对理由" value={note} onChange={e=>setNote(e.target.value)}/></label>
      <p role="status">{checkpoint.phase==='saved'?'未确认判断的检查点已保存':checkpoint.phase==='foreign'?'另一标签有输入，请先接管':checkpoint.phase==='conflict'?'判断冲突，请选择版本':checkpoint.phase==='failed'?'检查点失败，输入仍在本页':'尚未正式记录片段判断'}</p>
      {checkpoint.phase==='foreign'&&<button type="button" onClick={()=>void checkpoint.takeOver()}>接管片段判断</button>}
      {checkpoint.phase==='conflict'&&<><button type="button" onClick={()=>void checkpoint.resolve('latest')}>采用最新片段判断</button><button type="button" onClick={()=>void checkpoint.resolve('incoming')}>保留我的片段判断</button></>}
      {checkpoint.phase==='failed'&&<button type="button" onClick={checkpoint.retry}>手动重试片段检查点</button>}
      <button type="button" disabled={!category||!note.trim()||!checkpoint.readyToSave} onClick={()=>void save()}>保存这个片段的人工判断</button>
      <button type="button" onClick={()=>void checkpoint.clear().then(()=>{setScope('');setCategory('');setNote('')}).catch(e=>setError(String(e)))}>放弃未保存片段判断</button>
    </fieldset>}{(error||checkpoint.error)&&<p role="alert">{error||checkpoint.error}；尚未完成，输入仍保留。</p>}
  </section>
}
