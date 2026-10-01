import { useEffect, useRef, useState } from 'react'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { SemanticRepository } from '../mainline05/semanticRepository'
import { correctSemanticFact, reviewSemanticFact, reviewSemanticMaterialAndTask, acceptSemanticPendingDate } from '../mainline05/semanticConfirmation'
import { pendingDateEligible, hasPendingDateConsent } from '../mainline05/semanticState'
import { REAL_STATE_VERSION, stateOfRuntime, effectiveStateFacts, life, canAct, isCurrentDraft, liveReviewIdentity, semanticRevision, titleReviewProblem, materialReviewEnabled, materialDecision, materialReviewProblem } from '../mainline05/semanticState'
import { materialEdit, factAssets, materialStatusLabels, validateMaterialDecision, type FactChange, type MaterialEdit } from './factCorrections'
import type { SemanticTask } from '../mainline04/semanticContract'
import { openFailedForCorrection } from '../mainline05/semanticCapture'
import {revisionLabel,taskReviewFingerprint} from '../candidate16/staleRecovery'
import type { D20ReviewSessionRepository } from '../candidate16/d20ReviewSession'
import { useD21EditorCheckpoint } from '../candidate16/useD21EditorCheckpoint'
import { stableJson } from '../mainline04/semanticContract'

function correctionSummary(input:unknown,titles:Map<string,string>){
  if(typeof input==='string'&&input.startsWith('{'))try{input=JSON.parse(input)}catch{/* remain a plain note */}
  if(!input||typeof input!=='object')return '原文事实'
  const row=input as Record<string,unknown>,change=row.change&&typeof row.change==='object'?row.change as Record<string,unknown>:null
  const value=(change?.value&&typeof change.value==='object'?change.value:null) as Record<string,unknown>|null
  if(change?.kind==='surface')return `${change.field==='action'?'动作':'对象'}：${String(value?.surface??'未填写')}`
  if(change?.kind==='material')return `材料：${String(value?.name??'未填写')}`
  if(change?.kind==='time')return `时间原文：${String(value?.rawText??'未填写')}`
  const task=row.task&&typeof row.task==='object'?row.task as Record<string,unknown>:null
  if(task){const condition=task.condition&&typeof task.condition==='object'?task.condition as Record<string,unknown>:null
    return `条件：${String(condition?.value??'未说明')}；前置任务：${Array.isArray(task.dependencyTempIds)?task.dependencyTempIds.map(id=>titles.get(String(id))??'待核对任务').join('、')||'无':'无'}`}
  if(Array.isArray(row.dependencyIds))return `前置任务：${row.dependencyIds.map(id=>titles.get(String(id))??'待核对任务').join('、')||'无'}；说明：${String(row.note??'未填写')}`
  return [row.mode?`正在核对${String(row.mode)}`:'',row.action||row.object?`${String(row.action??'')}${String(row.object??'')}`:'',row.value?`判断：${String(row.value)}`:'',row.note?`说明：${String(row.note)}`:''].filter(Boolean).join('；')||'待核对输入'
}

export function FactCorrectionEditor({ repo, workspace, draftId, taskId, busy, onDirty, onSaved, onReviewed, reviewSession }: {
  repo: SemanticRepository; workspace: WorkspaceV8; draftId: string; taskId: string; busy: boolean;
  onDirty: (dirty: boolean) => void; onSaved: () => Promise<void>; onReviewed?:()=>void; reviewSession?: D20ReviewSessionRepository
}) {
  const state = stateOfRuntime(workspace,draftId)
  if (state.version !== REAL_STATE_VERSION) throw Error('REAL_INPUT_EDITOR_PROFILE')
  const facts = effectiveStateFacts(state).facts, task = facts.tasks.find(t => t.id === taskId)!, current = life(state)
  const [change,setChange] = useState<FactChange | null>(null), [working,setWorking] = useState(false), [error,setError] = useState('')
  const [materialBuffer,setMaterialBuffer]=useState<{id:string;required:string;status:string}|null>(null)
  const [relationDirty,setRelationDirty]=useState(false)
  const savedRevision = semanticRevision(workspace), [bufferRevision,setBufferRevision] = useState(savedRevision)
  const [bufferFingerprint,setBufferFingerprint]=useState(''),[pendingRevision,setPendingRevision]=useState<string|null>(null)
  const [refreshConflict,setRefreshConflict]=useState(false)
  const notify = useRef(onDirty)
  useEffect(() => { notify.current=onDirty },[onDirty])
  useEffect(() => { notify.current(Boolean(change||materialBuffer) || relationDirty || working); return () => notify.current(false) },[change,materialBuffer,working,relationDirty])
  const blocked = busy || working || current.dispositions[taskId] === 'confirmed' || current.dispositions[taskId] === 'rejected' || !isCurrentDraft(workspace,draftId)
  const fingerprint=taskReviewFingerprint(facts,taskId,current.values[taskId])
  const [inputEdited,setInputEdited]=useState(false)
  const checkpoint=useD21EditorCheckpoint({repo:reviewSession,workspace,draftId,field:`task:${taskId}:facts`,base:fingerprint,edited:inputEdited,
    value:{change,materialBuffer,fingerprint,inputEdited},active:Boolean(change||materialBuffer),restore:saved=>{
      setInputEdited(Boolean(saved.inputEdited))
      setChange(saved.change);setMaterialBuffer(saved.materialBuffer)
      setBufferFingerprint(saved.fingerprint);setBufferRevision(savedRevision)
      if(saved.fingerprint!==fingerprint){setRefreshConflict(true);setError('来源中的本项事实已变化；保留未确认输入，请对照原文重新核对。')}
    }})
  const choose = (value: FactChange) => { setInputEdited(false);setChange(value); setBufferRevision(savedRevision);setBufferFingerprint(fingerprint);setPendingRevision(null);setRefreshConflict(false); setError('') }
  const reloadLatest=async()=>{
    try{await onSaved();const latest=await repo.load(),state=stateOfRuntime(latest,draftId)
      if(change||materialBuffer){
        if(taskReviewFingerprint(effectiveStateFacts(state).facts,taskId,life(state).values[taskId])!==bufferFingerprint){setRefreshConflict(true);setError('最新保存的本项事实也已变化。未保存输入仍在，请对照原文重新编辑；不会自动覆盖。');return}
        setPendingRevision(semanticRevision(latest));setError('已载入最新来源；本项已保存事实没有变化。请对照保留的输入，明确选择继续后再保存。')
      }else {setBufferRevision(semanticRevision(latest));setError('已载入最新工作区修订 '+revisionLabel(semanticRevision(latest))+'。请重新核对本项事实后继续。')}
    }catch(cause){setError(cause instanceof Error?cause.message:'重读失败；未保存输入仍保留。')}
  }
  const run = async (action: () => Promise<unknown>,selectAfterReview=false) => {
    if (blocked||pendingRevision||refreshConflict||!checkpoint.readyToSave) return
    setWorking(true); setError('')
    try {
      await checkpoint.withFresh(action);setInputEdited(false);setChange(null);setMaterialBuffer(null);setPendingRevision(null);setRefreshConflict(false)
      try{await checkpoint.clear()}catch(cause){setError('草稿纠正已保存，但未确认检查点清理失败：'+String(cause))}
      await onSaved();if(selectAfterReview)onReviewed?.();setBufferRevision(semanticRevision(await repo.load()))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '未保存；请保留修改后再核对。') }
    finally { setWorking(false) }
  }
  const assets = factAssets(facts,taskId)
  const discard = async()=>{setWorking(true);try{await checkpoint.clear();setInputEdited(false);setChange(null);setMaterialBuffer(null);setPendingRevision(null);setRefreshConflict(false);setError('')}catch(cause){setError('未放弃：检查点已变化，输入仍保留。'+String(cause))}finally{setWorking(false)}}
  const reviewed = current.reviewed?.[taskId] === liveReviewIdentity(state,taskId,current.values)
  return <section aria-label={'事实核对与修改：' + task.detail.title} onChangeCapture={()=>setInputEdited(true)}>
    {reviewSession&&<p role="status">{checkpoint.phase==='saved'?'未确认事实编辑已保存，可继续核对。':checkpoint.phase==='saving'?'正在保存未确认编辑…':checkpoint.phase==='foreign'?'发现另一标签未确认编辑，请明确接管。':checkpoint.phase==='conflict'?'本项事实发生编辑冲突，请选择版本。':checkpoint.phase==='failed'?'检查点保存失败，刷新可能丢失输入。':'本项事实编辑尚未正式确认。'}
      {checkpoint.phase==='foreign'&&<button type="button" onClick={()=>void checkpoint.takeOver()}>接管并继续核对</button>}
      {checkpoint.phase==='failed'&&<button type="button" onClick={checkpoint.retry}>手动重试保存未确认编辑</button>}
      {checkpoint.phase==='conflict'&&<><button type="button" onClick={()=>void checkpoint.resolve('latest')}>采用最新已保存</button><button type="button" onClick={()=>void checkpoint.resolve('incoming')}>保留我的修改</button></>}
      {checkpoint.entry?.conflict&&<p>编辑前：{correctionSummary(checkpoint.entry.base,new Map(facts.tasks.map(item=>[item.id,item.detail.title])))}；最新：{correctionSummary(checkpoint.entry.conflict.latest,new Map(facts.tasks.map(item=>[item.id,item.detail.title])))}；我的输入：{correctionSummary(checkpoint.entry.conflict.incoming,new Map(facts.tasks.map(item=>[item.id,item.detail.title])))}</p>}
      {checkpoint.error&&<span role="alert">{checkpoint.error}</span>}
    </p>}
    <p>请核对当前标题“{current.values[taskId].title}”与动作、对象、条件、时间、材料和来源。核对不等于勾选，也不会创建正式任务。</p>
    {titleReviewProblem(current.values[taskId].title)&&<p role="status">{titleReviewProblem(current.values[taskId].title)}</p>}
    {materialReviewProblem(state,taskId)&&<p role="status">{materialReviewProblem(state,taskId)}</p>}
    <details open={pendingDateEligible(state,taskId)}><summary>核对时间与当前未知的原文依据</summary>
      <p>精确时间可确定到时分；仅日期不代表午夜截止；模糊时段和未公布时间保留原文、未知值，不需要编造日期。个人计划日期与通知截止分别保留。</p>
      {facts.timePoints.filter(t=>assets.times.has(t.tempId)).map(t=><p key={t.tempId}>{t.rawText} · {t.normalizedValue??'当前未知：不生成具体时刻'} · {t.precision==='date_only'?'仅日期，没有具体时分':t.precision==='vague'?'模糊或尚未公布':t.precision==='exact'?'精确时间':'相对时间'}</p>)}
      <button type="button" disabled={blocked||relationDirty||Boolean(change||materialBuffer)} onClick={()=>choose({kind:'time',taskId,
        scopeIds:[task.propositionScopeIds[0]],note:'用户核对补充时间原文；日期仍待定。',value:{tempId:'user-'+crypto.randomUUID(),
          type:'task_deadline',rawText:'',normalizedValue:null,timezone:state.context.timezone,isAllDay:false,precision:'vague',needsConfirmation:true,
          relatedTaskTempIds:[taskId],relatedMaterialTempIds:[],scopeIds:[task.propositionScopeIds[0]],confidence:1}})}>补充遗漏的时间依据</button>
      {change?.kind==='time'&&<fieldset disabled={blocked}><legend>人工补充日期待定依据（不改模型原答）</legend>
        <label>时间所在原文<select value={change.value.scopeIds[0]} onChange={e=>setChange({...change,scopeIds:[e.target.value],value:{...change.value,scopeIds:[e.target.value]}})}>
          {state.context.index.scopes.filter(s=>task.propositionScopeIds.includes(s.id)||facts.timePoints.some(t=>assets.times.has(t.tempId)&&t.scopeIds.includes(s.id)))
            .map(s=><option key={s.id} value={s.id}>{s.text}</option>)}</select></label>
        <label>需要保留的逐字时间原文<input value={change.value.rawText} onChange={e=>setChange({...change,value:{...change.value,rawText:e.target.value}})}/></label>
        <p>归属本任务：{task.detail.title}。这里只补充待定截止依据；明确日期用已有日期编辑，不能用此操作消除冲突。</p>
        <button type="button" disabled={!change.value.rawText.trim()} onClick={()=>void run(()=>correctSemanticFact(repo,{draftId,revision:bufferRevision,operationId:crypto.randomUUID(),change}))}>保存时间依据</button>
        <button type="button" disabled={working} onClick={()=>void discard()}>放弃未保存时间依据</button>
      </fieldset>}
      {pendingDateEligible(state,taskId)&&<>
        <p>以下操作只记录接受日期待定，不填日期、不取消时间待核对标记，也不会自动创建或勾选任务。</p>
        <button type="button" disabled={blocked||relationDirty||Boolean(change||materialBuffer)||hasPendingDateConsent(state,taskId)} onClick={()=>void run(()=>acceptSemanticPendingDate(repo,
          {draftId,taskId,revision:savedRevision,operationId:crypto.randomUUID()}))}>
          {hasPendingDateConsent(state,taskId)?'已保存：接受日期仍待定':'依据原文确认时间目前未知，保留待核对'}</button>
        <p>之后再点“本项事实已核对”并主动选择加入任务；未保存的编辑不能确认。</p>
      </>}
    </details>
    {materialReviewEnabled(state)&&facts.materials.filter(m=>assets.materials.has(m.tempId)).map(m=><div key={m.tempId}>
      <button type="button" disabled={blocked||relationDirty||Boolean(change||materialBuffer)} onClick={()=>{
        setMaterialBuffer({id:m.tempId,required:'',status:''});setBufferRevision(savedRevision);setBufferFingerprint(fingerprint);setPendingRevision(null);setRefreshConflict(false);setError('')
      }}>{materialDecision(state,m.tempId)?'重新核对材料：':'核对材料：'}{m.name}</button>
    </div>)}
    {materialBuffer&&<fieldset disabled={blocked}><legend>分别核对必需性和当前准备状态（用户观察，不是模型预测）</legend>
      <label>本任务是否需要这份材料<select value={materialBuffer.required} onChange={e=>setMaterialBuffer({...materialBuffer,required:e.target.value})}>
        <option value="">请主动选择</option><option value="yes">需要</option><option value="no">不作为必备项</option></select></label>
      <label>当前准备状态<select value={materialBuffer.status} onChange={e=>setMaterialBuffer({...materialBuffer,status:e.target.value})}>
        <option value="">请选择准备情况</option>{Object.entries(materialStatusLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
      <p>不知道是否备齐时，可以主动选择“准备情况尚未核实”。确认任务不代表材料已齐备，也不会解除原文的执行条件或前置任务。未保存的核对不会用于确认。</p>
        <p>同时核对本项的动作、对象、时间和依据。点击下方会保存材料观察，并在其他事实没有阻碍时记录本项已核对；正式加入任务仍需你确认。</p>
        <button type="button" disabled={!materialBuffer.required||!materialBuffer.status||!checkpoint.readyToSave} onClick={()=>void run(()=>reviewSemanticMaterialAndTask(repo,
        {draftId,taskId,materialId:materialBuffer.id,revision:bufferRevision,operationId:crypto.randomUUID(),
          value:validateMaterialDecision({required:materialBuffer.required==='yes',status:materialBuffer.status})}))}>保存材料并核对本项</button>
      <button type="button" disabled={working} onClick={()=>void discard()}>放弃未保存材料核对</button>
    </fieldset>}
    <button type="button" disabled={blocked || relationDirty || Boolean(change||materialBuffer) || !canAct(state,taskId) || reviewed || Boolean(titleReviewProblem(current.values[taskId].title))}
      onClick={() => void run(() => reviewSemanticFact(repo,{draftId,taskId,revision:savedRevision,operationId:crypto.randomUUID()}),true)}>
      {reviewed ? '本项已核对（已保存）' : onReviewed?'核对并选入本次确认':'本项事实已核对'}</button>
    <details open={Boolean(change)}><summary>修正动作、对象或材料</summary>
      <p>仅修正未确认内容；手动材料会独立标记，不冒充原文。时间和标题请使用任务卡中的编辑与保存按钮。</p>
      {(['action','object'] as const).map(field => <button type="button" key={field} disabled={blocked || relationDirty || Boolean(change||materialBuffer)}
        onClick={() => choose({kind:'surface',taskId,field,value:{...task[field]}})}>修改{field==='action'?'动作':'对象'}</button>)}
      {facts.materials.filter(m => assets.materials.has(m.tempId)).map(m => <button type="button" key={m.tempId} disabled={blocked || relationDirty || Boolean(change||materialBuffer)}
        onClick={() => choose({kind:'material',materialId:m.tempId,value:materialEdit(m)})}>修改材料：{m.name}</button>)}
      {change?.kind==='surface' && <fieldset disabled={blocked}><legend>从本项原文选择{change.field==='action'?'动作':'对象'}</legend>
        <label>原文范围<select value={change.value.scopeId} onChange={e => setChange({...change,value:{...change.value,scopeId:e.target.value}})}>
          {state.context.index.scopes.filter(s => task.propositionScopeIds.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.text}</option>)}</select></label>
        <label>逐字内容<input value={change.value.surface} onChange={e => setChange({...change,value:{...change.value,surface:e.target.value}})} /></label>
      </fieldset>}
      {change?.kind==='material' && <fieldset disabled={blocked}><legend>人工材料修订</legend>
        {(['name','quantity','formatRequirements','namingRequirements','submissionChannel'] as const).map(field => {
          const labels={name:'材料名称',quantity:'数量',formatRequirements:'格式要求（每行一项）',namingRequirements:'命名要求（每行一项）',submissionChannel:'提交渠道'}
          const value=change.value[field]
          return <label key={field}>{labels[field]}<textarea value={Array.isArray(value)?value.join('\n'):value===null?'':String(value)} onChange={e => {
            const text=e.target.value
            const next: MaterialEdit = {...change.value, [field]: field==='quantity' ? text===''?null:Number(text)
              : field==='formatRequirements'||field==='namingRequirements' ? text===''?[]:text.split('\n') : field==='submissionChannel'&&text===''?null:text}
            setChange({...change,value:next})
          }} /></label>
        })}
        <p>材料明确属于哪些任务（关系无法承接时会在保存前拒绝）：</p>
        {facts.tasks.map(t => <label key={t.id}><input type="checkbox" checked={change.value.relatedTaskTempIds.includes(t.id)} onChange={e => setChange({...change,value:{...change.value,
          relatedTaskTempIds:e.target.checked?[...change.value.relatedTaskTempIds,t.id]:change.value.relatedTaskTempIds.filter(id=>id!==t.id)}})} />{t.detail.title}</label>)}
      </fieldset>}
      {change && change.kind!=='time' && <><p>有未保存的事实编辑，当前内容不会被确认。{bufferRevision!==savedRevision?'其他操作已更新版本；必须重新载入并核对，缓冲仍保留。':''}</p>
        <button type="button" disabled={blocked||Boolean(pendingRevision)||refreshConflict||!checkpoint.readyToSave} onClick={() => void run(() => correctSemanticFact(repo,{draftId,revision:bufferRevision,operationId:crypto.randomUUID(),change}))}>保存事实修改</button>
        <button type="button" disabled={working} onClick={() => void discard()}>放弃未保存修改</button></>}
    </details>
    <RelationCorrection repo={repo} workspace={workspace} draftId={draftId} taskId={taskId} busy={blocked||Boolean(change||materialBuffer)} onDirty={setRelationDirty} onSaved={onSaved} reviewSession={reviewSession}/>
    {(error.includes('STALE_RELOAD_REQUIRED')||Boolean(change||materialBuffer)&&bufferRevision!==savedRevision)&&<><p>{bufferRevision===savedRevision
      ? '另一标签或操作已更新来源；当前页面还没读到新版本。请主动载入并核对，未保存输入不会被静默覆盖。'
      : `工作区修订已变化：编辑开始时 ${revisionLabel(bufferRevision)}，当前已载入 ${revisionLabel(savedRevision)}。请核对差异，不会覆盖已保存事实。`}</p><button type="button" disabled={working||relationDirty} onClick={()=>void reloadLatest()}>载入最新来源（保留未保存输入）</button></>}
    {pendingRevision&&<button type="button" disabled={working} onClick={()=>{setBufferRevision(pendingRevision);setPendingRevision(null);setError('已明确核对最新事实，可手动保存；仍不会自动提交。')}}>已对照原文，继续保存保留的输入</button>}
    {refreshConflict&&<p role="alert">相关事实已被其他操作修改。当前输入仍显示在编辑框，需先放弃本次编辑，再按最新事实重新修改。</p>}
    {error && <p role="alert">{error}。未宣称保存成功。</p>}
  </section>
}

type CorrectionProps={repo:SemanticRepository;workspace:WorkspaceV8;draftId:string;taskId?:string;busy:boolean;onDirty:(dirty:boolean)=>void;onSaved:()=>Promise<void>;reviewSession?:D20ReviewSessionRepository}
/** Exact persistence adapter used by the relation editor's save event. */
// eslint-disable-next-line react-refresh/only-export-components -- exported so the editor-to-repository path is tested without a second implementation.
export async function submitRelationCorrection(repo:SemanticRepository,draftId:string,revision:string,change:FactChange,operationId:string=crypto.randomUUID()){
  return correctSemanticFact(repo,{draftId,revision,operationId,change})
}
/** Same review panel, explicit source-bound user edits; no model call or raw rewrite. */
export function RelationCorrection({repo,workspace,draftId,taskId,busy,onDirty,onSaved,reviewSession}:CorrectionProps){
  const draft=workspace.extractionDrafts.find(d=>d.id===draftId)!,ready=Boolean(draft.legacyData?.mainline05)
  const state=ready?stateOfRuntime(workspace,draftId):null,facts=state?effectiveStateFacts(state).facts:null
  const task=facts?.tasks.find(t=>t.id===taskId)
  const [mode,setMode]=useState(''),[scopeIds,setScopes]=useState<string[]>([]),[note,setNote]=useState(''),[value,setValue]=useState('')
  const [dependencyIds,setDependencyIds]=useState<string[]>([])
  const [action,setAction]=useState(''),[object,setObject]=useState(''),[effect,setEffect]=useState<SemanticTask['effect']>('unknown')
  const [completion,setCompletion]=useState(''),[materialName,setMaterialName]=useState('')
  const [relationIndex,setRelationIndex]=useState(0),[target,setTarget]=useState(''),[from,setFrom]=useState(''),[newTarget,setNewTarget]=useState(false)
  const [conditionScope,setConditionScope]=useState(''),[factScope,setFactScope]=useState(''),[eventTitle,setEventTitle]=useState('')
  const [checked,setChecked]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState('')
  const notify=useRef(onDirty);useEffect(()=>{notify.current=onDirty},[onDirty])
  useEffect(()=>{notify.current(Boolean(mode)||working);return()=>notify.current(false)},[mode,working])
  const blocked=busy||working||(state&&taskId&&['confirmed','rejected'].includes(life(state).dispositions[taskId]))||!isCurrentDraft(workspace,draftId)
  const base=stableJson({task:task?{condition:task.condition,dependencyTempIds:task.detail.dependencyTempIds,eventTempIds:task.eventTempIds}:null,
    revisions:facts?.revisions??[],events:mode==='event'?facts?.events??[]:[]})
  const [inputEdited,setInputEdited]=useState(false)
  const checkpoint=useD21EditorCheckpoint({repo:reviewSession,workspace,draftId,field:`relation:${taskId??'source'}:edit`,base,edited:inputEdited,
    value:{mode,scopeIds,note,value,dependencyIds,action,object,effect,completion,materialName,relationIndex,target,from,newTarget,conditionScope,factScope,eventTitle,checked,base,inputEdited},
    active:Boolean(mode),restore:saved=>{
      setInputEdited(Boolean(saved.inputEdited))
      setMode(saved.mode);setScopes(saved.scopeIds);setNote(saved.note);setValue(saved.value);setDependencyIds(saved.dependencyIds)
      setAction(saved.action);setObject(saved.object);setEffect(saved.effect);setCompletion(saved.completion);setMaterialName(saved.materialName)
      setRelationIndex(saved.relationIndex);setTarget(saved.target);setFrom(saved.from);setNewTarget(saved.newTarget)
      setConditionScope(saved.conditionScope);setFactScope(saved.factScope);setEventTitle(saved.eventTitle);setChecked(saved.checked)
      setRevision(semanticRevision(workspace));if(saved.base!==base)setError('关联事实已变化；未确认输入仍保留，请重新核对原文。')
    }})
  async function run(work:()=>Promise<unknown>){if(mode&&!checkpoint.readyToSave)return;setWorking(true);setError('');try{await checkpoint.withFresh(work);setInputEdited(false);setMode('');
    try{await checkpoint.clear()}catch(cause){setError('草稿纠正已保存，但检查点清理失败：'+String(cause))}
    await onSaved()}catch(e){setError(e instanceof Error?e.message:'保存失败，修改仍保留')}finally{setWorking(false)}}
  function start(next:string){setInputEdited(false);setMode(next);setRevision(semanticRevision(workspace));setScopes([]);setNote('');setValue('');setChecked(false);setError('');setNewTarget(false)
    setCompletion('');setMaterialName('')
    setDependencyIds(next==='dependency'?[...(task?.detail.dependencyTempIds??[])]:[])}
  function newTask(id:string,old:boolean):SemanticTask{
    const scopes=state!.context.index.scopes,ar=scopes.find(s=>scopeIds.includes(s.id)&&s.text.includes(action)&&action.trim()),ob=scopes.find(s=>scopeIds.includes(s.id)&&s.text.includes(object)&&object.trim())
    if(!ar||!ob)throw Error('请从所选原文中逐字填写动作和对象')
    const criteria=completion.split('\n').map(s=>s.trim()).filter(Boolean)
    if(criteria.some(text=>!scopes.some(s=>scopeIds.includes(s.id)&&s.text.includes(text))))throw Error('完成标准必须逐字出现在所选原文中')
    return {id,propositionScopeIds:[...scopeIds],action:{scopeId:ar.id,surface:action},object:{scopeId:ob.id,surface:object},actionType:'other',effect,
      semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:old?'past':'present',status:old?'cancelled':'pending',validity:old?'superseded':'active',modality:'required'},
      inferenceLevel:'explicit',detail:{parentTempId:null,hierarchyType:'task',title:action+object,description:[note,...criteria.map(criterion=>'完成标准：'+criterion)].join('\n'),completionCriteria:criteria,estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],confidence:0,userConfirmationRequired:true},
      condition:{value:'not_applicable',conditionScopeIds:[],factScopeIds:[]},coverage:{time:'not_stated',material:'not_stated',event:'not_stated'},eventTempIds:[]}
  }
  async function save(){
    if(!state||!facts||!checked||!scopeIds.length||!note.trim())throw Error('请选择原文、填写核对说明并确认本次修改')
    let change:FactChange
    if(mode==='event')change={kind:'event',taskId:taskId!,scopeIds,note,value:{coverage:value==='attach'?'present':value as SemanticTask['coverage']['event'],event:value==='attach'?{
      tempId:'user-'+crypto.randomUUID(),title:eventTitle,description:note,location:null,startTimePointTempId:null,endTimePointTempId:null,scopeIds,confidence:0,inferenceLevel:'explicit',relatedTaskTempIds:[taskId!]}:null}}
    else if(mode==='condition')change={kind:'condition',taskId:taskId!,scopeIds,note,value:{value:value as SemanticTask['condition']['value'],conditionScopeIds:value==='not_applicable'?[]:[conditionScope].filter(Boolean),factScopeIds:['true','false'].includes(value)?[factScope].filter(Boolean):[]}}
    else if(mode==='dependency')change={kind:'dependency',taskId:taskId!,value:dependencyIds,scopeIds,note}
    else if(mode==='add_material')change={kind:'add_material',value:{tempId:'user-'+crypto.randomUUID(),name:materialName,required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[taskId!],scopeIds,confidence:1},scopeIds,note}
    else if(mode==='add_task')change={kind:'add_task',value:newTask('user-'+crypto.randomUUID(),false),scopeIds,note}
    else {const addedTask=newTarget?newTask('user-'+crypto.randomUUID(),true):null
      change={kind:'revision',index:relationIndex,value:{addedTask,relation:{type:from?'supersedes':'cancels',targetDirectiveId:addedTask?.id??target,fromDirectiveId:from||null,effective:value as 'true'|'false'|'unknown',scopeIds}},scopeIds,note}}
    await submitRelationCorrection(repo,draftId,revision,change)
  }
  return <section aria-label={task?'条件、依赖与事件纠正：'+task.detail.title:'通知漏项与新旧要求纠正'} onChangeCapture={()=>setInputEdited(true)}>
    {reviewSession&&mode&&<p role="status">{checkpoint.phase==='saved'?'未确认的关系输入已保存，可继续核对。':checkpoint.phase==='saving'?'正在保存未确认输入…':checkpoint.phase==='conflict'?'同一关联事实发生冲突，请选择版本。':checkpoint.phase==='foreign'?'另一标签有未确认输入，请接管后继续。':checkpoint.phase==='failed'?'检查点失败，本页输入仍保留。':'未确认输入尚未正式保存。'}
      {checkpoint.phase==='foreign'&&<button type="button" onClick={()=>void checkpoint.takeOver()}>接管未确认输入</button>}
      {checkpoint.phase==='conflict'&&<><button type="button" onClick={()=>void checkpoint.resolve('latest')}>采用最新</button><button type="button" onClick={()=>void checkpoint.resolve('incoming')}>保留我的输入</button></>}
      {checkpoint.entry?.conflict&&<span>编辑前：{correctionSummary(checkpoint.entry.base,new Map(facts?.tasks.map(item=>[item.id,item.detail.title])??[]))}；最新：{correctionSummary(checkpoint.entry.conflict.latest,new Map(facts?.tasks.map(item=>[item.id,item.detail.title])??[]))}；我的输入：{correctionSummary(checkpoint.entry.conflict.incoming,new Map(facts?.tasks.map(item=>[item.id,item.detail.title])??[]))}</span>}
      {checkpoint.phase==='failed'&&<button type="button" onClick={checkpoint.retry}>手动重试检查点</button>}
      {checkpoint.error&&<span role="alert">{checkpoint.error}</span>}</p>}
    {!ready?<><p>模型原回答有关系错误，不能直接确认。可保留失败记录，依据完整原文人工纠正；这不会重新调用模型。</p>
      <blockquote>{workspace.sourceVersions.find(v=>v.id===workspace.recognitionRuns.find(r=>r.id===draft.recognitionRunId)?.sourceVersionId)?.rawText}</blockquote>
      <button type="button" disabled={Boolean(blocked)} onClick={()=>void run(()=>openFailedForCorrection(repo,draftId,semanticRevision(workspace)))}>保留失败原答，进入人工纠错</button></>
      :<><p>{state?.version===REAL_STATE_VERSION&&state.recovery?'原模型识别失败仍保留；以下为人工纠正。':'人工纠正单独保存，不改变模型原回答。'}</p>
      {!mode&&(task?<><button type="button" disabled={Boolean(blocked)} onClick={()=>start('condition')}>核对执行条件</button><button type="button" disabled={Boolean(blocked)} onClick={()=>start('dependency')}>核对前置依赖</button><button type="button" disabled={Boolean(blocked)} onClick={()=>start('event')}>核对活动关联</button><button type="button" disabled={Boolean(blocked)} onClick={()=>start('add_material')}>依据原文补充材料</button></>
        :<><button type="button" disabled={Boolean(blocked)} onClick={()=>start('revision')}>纠正旧要求与新要求</button><button type="button" disabled={Boolean(blocked)} onClick={()=>start('add_task')}>依据原文补充漏任务</button></>)}
      {mode&&<fieldset disabled={Boolean(blocked)}><legend>未保存的人工纠正</legend>
        <p>先选择支持本次判断的原文。点击已核对不等于条件成立，也不等于已创建任务。</p>
        {state!.context.index.scopes.map(s=><label key={s.id}><input type="checkbox" checked={scopeIds.includes(s.id)} onChange={e=>setScopes(e.target.checked?[...scopeIds,s.id]:scopeIds.filter(id=>id!==s.id))}/>{s.text}</label>)}
        {mode==='event'&&<><p>若仅提到报名表或入场凭证、没有独立活动事实，可明确纠正为未说明；不会自动删除已有活动关系。</p>
          <label>活动关联判断<select value={value} onChange={e=>setValue(e.target.value)}><option value="">请选择</option><option value="not_stated">原文未说明独立活动</option><option value="unresolved">尚不确定，保留待核对</option><option value="attach">原文有独立活动，补充并关联</option></select></label>
          {value==='attach'&&<label>原文活动名称<input value={eventTitle} onChange={e=>setEventTitle(e.target.value)}/></label>}</>}
        {mode==='condition'&&<><label>条件是否成立<select value={value} onChange={e=>setValue(e.target.value)}><option value="">请选择</option><option value="true">已成立（须有原文事实依据）</option><option value="false">未成立（须有原文事实依据）</option><option value="unknown">尚不确定</option><option value="not_applicable">原文无附加条件</option></select></label>
          {value!=='not_applicable'&&<><label>条件所在原文<select value={conditionScope} onChange={e=>setConditionScope(e.target.value)}><option value="">请选择</option>{state!.context.index.scopes.filter(s=>scopeIds.includes(s.id)).map(s=><option key={s.id} value={s.id}>{s.text}</option>)}</select></label>
          {['true','false'].includes(value)&&<label>说明条件已发生或未发生的原文<select value={factScope} onChange={e=>setFactScope(e.target.value)}><option value="">请选择</option>{state!.context.index.scopes.filter(s=>scopeIds.includes(s.id)).map(s=><option key={s.id} value={s.id}>{s.text}</option>)}</select></label>}</>}
          <p>原文之外的新情况可写在用户补充说明中；本轮不能凭该说明自动解除条件阻挡，可保留未知并暂缓。</p></>}
        {mode==='dependency'&&<><p>仅勾选完整原文明示的前置任务。取消全部勾选表示你明确核对后认为当前任务没有这些前置关系，不代表其他条件已经成立。</p>
          {facts!.tasks.filter(candidate=>candidate.id!==taskId).map(candidate=><label key={candidate.id}><input type="checkbox" checked={dependencyIds.includes(candidate.id)} onChange={e=>setDependencyIds(e.target.checked?[...dependencyIds,candidate.id]:dependencyIds.filter(id=>id!==candidate.id))}/>{candidate.detail.title}</label>)}</>}
        {mode==='add_material'&&<label>原文材料名称<input value={materialName} onChange={e=>setMaterialName(e.target.value)}/></label>}
        {mode==='revision'&&<><label>要纠正的关系<select value={relationIndex} onChange={e=>setRelationIndex(Number(e.target.value))}>{facts!.revisions.map((r,i)=><option key={i} value={i}>{r.type==='supersedes'?'替代':'取消'}：{facts!.tasks.find(item=>item.id===r.targetDirectiveId)?.detail.title??'旧要求待核对'}{r.fromDirectiveId?` → ${facts!.tasks.find(item=>item.id===r.fromDirectiveId)?.detail.title??'新要求待核对'}`:''}</option>)}<option value={facts!.revisions.length}>补充一条关系</option></select></label>
          <label><input type="checkbox" checked={newTarget} onChange={e=>setNewTarget(e.target.checked)}/>旧要求漏提取，依据原文补充</label>
          {!newTarget&&<label>作废的旧要求<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">请选择</option>{facts!.tasks.map(t=><option key={t.id} value={t.id}>{t.detail.title}</option>)}</select></label>}
          <label>替代它的新要求<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">只取消，没有替代要求</option>{facts!.tasks.map(t=><option key={t.id} value={t.id}>{t.detail.title}</option>)}</select></label>
          <label>修订是否生效<select value={value} onChange={e=>setValue(e.target.value)}><option value="">请选择</option><option value="true">原文明确生效</option><option value="false">原文明确未生效</option><option value="unknown">尚不确定</option></select></label></>}
        {(mode==='add_task'||(mode==='revision'&&newTarget))&&<><label>原文动作<input value={action} onChange={e=>setAction(e.target.value)}/></label><label>原文对象<input value={object} onChange={e=>setObject(e.target.value)}/></label>
          <label>完成标准（原文逐字片段，每行一项；原文未说明则留空）<textarea value={completion} onChange={e=>setCompletion(e.target.value)}/></label>
          <label>动作影响<select value={effect} onChange={e=>setEffect(e.target.value as SemanticTask['effect'])}><option value="unknown">未确定</option><option value="local_change">仅本机</option><option value="physical_action">线下操作</option><option value="external_transfer">对外提交</option></select></label>
          <p>可先保存原文明示的动作、对象和完成标准，再分别补录材料、时间、条件及活动；全部核对前不要确认。旧要求作为已作废历史保留，不创建待办。</p></>}
        <label>核对理由或用户补充说明<textarea value={note} onChange={e=>setNote(e.target.value)}/></label>
        <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>我已对照完整原文，确认上述关系及补项范围；说明属于人工核对，不是模型预测</label>
        <button type="button" disabled={!checkpoint.readyToSave||!checked||!note.trim()||!scopeIds.length||(!value&&!['add_task','dependency','add_material'].includes(mode))} onClick={()=>void run(save)}>保存关系纠正</button>
        <button type="button" disabled={working} onClick={()=>{void (async()=>{setWorking(true);try{await checkpoint.clear();setInputEdited(false);setMode('');setError('')}catch(cause){setError('未放弃：关系输入已变化，仍保留。'+String(cause))}finally{setWorking(false)}})()}}>放弃未保存关系纠正</button>
      </fieldset>}</>}
    {error&&<p role="alert">未保存：{error}。原回答和已确认内容没有改变。</p>}
  </section>
}
