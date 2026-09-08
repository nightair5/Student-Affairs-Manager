import { useEffect, useRef, useState } from 'react'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { SemanticRepository } from '../mainline05/semanticRepository'
import { correctSemanticFact, reviewSemanticFact, reviewSemanticMaterial } from '../mainline05/semanticConfirmation'
import { REAL_STATE_VERSION, stateOfRuntime, effectiveStateFacts, life, canAct, isCurrentDraft, liveReviewIdentity, semanticRevision, titleReviewProblem, materialReviewEnabled, materialDecision, materialReviewProblem } from '../mainline05/semanticState'
import { materialEdit, factAssets, materialStatusLabels, validateMaterialDecision, type FactChange, type MaterialEdit } from './factCorrections'
import type { SemanticTask } from '../mainline04/semanticContract'
import { openFailedForCorrection } from '../mainline05/semanticCapture'

export function FactCorrectionEditor({ repo, workspace, draftId, taskId, busy, onDirty, onSaved }: {
  repo: SemanticRepository; workspace: WorkspaceV8; draftId: string; taskId: string; busy: boolean;
  onDirty: (dirty: boolean) => void; onSaved: () => Promise<void>
}) {
  const state = stateOfRuntime(workspace,draftId)
  if (state.version !== REAL_STATE_VERSION) throw Error('REAL_INPUT_EDITOR_PROFILE')
  const facts = effectiveStateFacts(state).facts, task = facts.tasks.find(t => t.id === taskId)!, current = life(state)
  const [change,setChange] = useState<FactChange | null>(null), [working,setWorking] = useState(false), [error,setError] = useState('')
  const [materialBuffer,setMaterialBuffer]=useState<{id:string;required:string;status:string}|null>(null)
  const [relationDirty,setRelationDirty]=useState(false)
  const savedRevision = semanticRevision(workspace), [bufferRevision,setBufferRevision] = useState(savedRevision)
  const notify = useRef(onDirty)
  useEffect(() => { notify.current=onDirty },[onDirty])
  useEffect(() => { notify.current(Boolean(change||materialBuffer) || relationDirty || working); return () => notify.current(false) },[change,materialBuffer,working,relationDirty])
  const blocked = busy || working || current.dispositions[taskId] === 'confirmed' || current.dispositions[taskId] === 'rejected' || !isCurrentDraft(workspace,draftId)
  const choose = (value: FactChange) => { setChange(value); setBufferRevision(savedRevision); setError('') }
  const run = async (action: () => Promise<unknown>) => {
    if (blocked) return
    setWorking(true); setError('')
    try { await action(); setChange(null); setMaterialBuffer(null); await onSaved() } catch (cause) { setError(cause instanceof Error ? cause.message : '未保存；请保留修改后再核对。') }
    finally { setWorking(false) }
  }
  const assets = factAssets(facts,taskId)
  const reviewed = current.reviewed?.[taskId] === liveReviewIdentity(state,taskId,current.values)
  return <section aria-label={'事实核对与修改：' + task.detail.title}>
    <p>请核对当前标题“{current.values[taskId].title}”与动作、对象、条件、时间、材料和来源。核对不等于勾选，也不会创建正式任务。</p>
    {titleReviewProblem(current.values[taskId].title)&&<p role="status">{titleReviewProblem(current.values[taskId].title)}</p>}
    {materialReviewProblem(state,taskId)&&<p role="status">{materialReviewProblem(state,taskId)}</p>}
    {materialReviewEnabled(state)&&facts.materials.filter(m=>assets.materials.has(m.tempId)).map(m=><div key={m.tempId}>
      <button type="button" disabled={blocked||relationDirty||Boolean(change||materialBuffer)} onClick={()=>{
        setMaterialBuffer({id:m.tempId,required:'',status:''});setBufferRevision(savedRevision);setError('')
      }}>{materialDecision(state,m.tempId)?'重新核对材料：':'核对材料：'}{m.name}</button>
    </div>)}
    {materialBuffer&&<fieldset disabled={blocked}><legend>分别核对必需性和当前准备状态（用户观察，不是模型预测）</legend>
      <label>本任务是否需要这份材料<select value={materialBuffer.required} onChange={e=>setMaterialBuffer({...materialBuffer,required:e.target.value})}>
        <option value="">请主动选择</option><option value="yes">需要</option><option value="no">不作为必备项</option></select></label>
      <label>当前准备状态<select value={materialBuffer.status} onChange={e=>setMaterialBuffer({...materialBuffer,status:e.target.value})}>
        <option value="">尚未核实，请主动选择</option>{Object.entries(materialStatusLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
      <p>未保存的材料核对不会用于确认；原始模型分类不会被覆盖。</p>
      <button type="button" disabled={!materialBuffer.required||!materialBuffer.status} onClick={()=>void run(()=>reviewSemanticMaterial(repo,
        {draftId,materialId:materialBuffer.id,revision:bufferRevision,operationId:crypto.randomUUID(),
          value:validateMaterialDecision({required:materialBuffer.required==='yes',status:materialBuffer.status})}))}>保存材料核对</button>
      <button type="button" onClick={()=>setMaterialBuffer(null)}>放弃未保存材料核对</button>
    </fieldset>}
    <button type="button" disabled={blocked || relationDirty || Boolean(change||materialBuffer) || !canAct(state,taskId) || reviewed || Boolean(titleReviewProblem(current.values[taskId].title))}
      onClick={() => void run(() => reviewSemanticFact(repo,{draftId,taskId,revision:savedRevision,operationId:crypto.randomUUID()}))}>
      {reviewed ? '本项已核对（已保存）' : '本项事实已核对'}</button>
    <details><summary>修正动作、对象或材料</summary>
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
      {change && <><p>有未保存的事实编辑，当前内容不会被确认。{bufferRevision!==savedRevision?'其他操作已更新版本；本次保存将明确拒绝，缓冲仍保留。':''}</p>
        <button type="button" disabled={blocked} onClick={() => void run(() => correctSemanticFact(repo,{draftId,revision:bufferRevision,operationId:crypto.randomUUID(),change}))}>保存事实修改</button>
        <button type="button" disabled={working} onClick={() => setChange(null)}>放弃未保存修改</button></>}
    </details>
    <RelationCorrection repo={repo} workspace={workspace} draftId={draftId} taskId={taskId} busy={blocked||Boolean(change||materialBuffer)} onDirty={setRelationDirty} onSaved={onSaved}/>
    {error && <p role="alert">{error}。未宣称保存成功。</p>}
  </section>
}

type CorrectionProps={repo:SemanticRepository;workspace:WorkspaceV8;draftId:string;taskId?:string;busy:boolean;onDirty:(dirty:boolean)=>void;onSaved:()=>Promise<void>}
/** Same review panel, explicit source-bound user edits; no model call or raw rewrite. */
export function RelationCorrection({repo,workspace,draftId,taskId,busy,onDirty,onSaved}:CorrectionProps){
  const draft=workspace.extractionDrafts.find(d=>d.id===draftId)!,ready=Boolean(draft.legacyData?.mainline05)
  const state=ready?stateOfRuntime(workspace,draftId):null,facts=state?effectiveStateFacts(state).facts:null
  const task=facts?.tasks.find(t=>t.id===taskId)
  const [mode,setMode]=useState(''),[scopeIds,setScopes]=useState<string[]>([]),[note,setNote]=useState(''),[value,setValue]=useState('')
  const [action,setAction]=useState(''),[object,setObject]=useState(''),[effect,setEffect]=useState<SemanticTask['effect']>('unknown')
  const [relationIndex,setRelationIndex]=useState(0),[target,setTarget]=useState(''),[from,setFrom]=useState(''),[newTarget,setNewTarget]=useState(false)
  const [conditionScope,setConditionScope]=useState(''),[factScope,setFactScope]=useState(''),[eventTitle,setEventTitle]=useState('')
  const [checked,setChecked]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState('')
  const notify=useRef(onDirty);useEffect(()=>{notify.current=onDirty},[onDirty])
  useEffect(()=>{notify.current(Boolean(mode)||working);return()=>notify.current(false)},[mode,working])
  const blocked=busy||working||(state&&taskId&&['confirmed','rejected'].includes(life(state).dispositions[taskId]))||!isCurrentDraft(workspace,draftId)
  async function run(work:()=>Promise<unknown>){setWorking(true);setError('');try{await work();setMode('');await onSaved()}catch(e){setError(e instanceof Error?e.message:'保存失败，修改仍保留')}finally{setWorking(false)}}
  function start(next:string){setMode(next);setRevision(semanticRevision(workspace));setScopes([]);setNote('');setValue('');setChecked(false);setError('');setNewTarget(false)}
  function newTask(id:string,old:boolean):SemanticTask{
    const scopes=state!.context.index.scopes,ar=scopes.find(s=>scopeIds.includes(s.id)&&s.text.includes(action)&&action.trim()),ob=scopes.find(s=>scopeIds.includes(s.id)&&s.text.includes(object)&&object.trim())
    if(!ar||!ob)throw Error('请从所选原文中逐字填写动作和对象')
    return {id,propositionScopeIds:[...scopeIds],action:{scopeId:ar.id,surface:action},object:{scopeId:ob.id,surface:object},actionType:'other',effect,
      semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:old?'past':'present',status:old?'cancelled':'pending',validity:old?'superseded':'active',modality:'required'},
      inferenceLevel:'explicit',detail:{parentTempId:null,hierarchyType:'task',title:action+object,description:note,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],confidence:0,userConfirmationRequired:true},
      condition:{value:'not_applicable',conditionScopeIds:[],factScopeIds:[]},coverage:{time:'not_stated',material:'not_stated',event:'not_stated'},eventTempIds:[]}
  }
  async function save(){
    if(!state||!facts||!checked||!scopeIds.length||!note.trim())throw Error('请选择原文、填写核对说明并确认本次修改')
    let change:FactChange
    if(mode==='event')change={kind:'event',taskId:taskId!,scopeIds,note,value:{coverage:value==='attach'?'present':value as SemanticTask['coverage']['event'],event:value==='attach'?{
      tempId:'user-'+crypto.randomUUID(),title:eventTitle,description:note,location:null,startTimePointTempId:null,endTimePointTempId:null,scopeIds,confidence:0,inferenceLevel:'explicit',relatedTaskTempIds:[taskId!]}:null}}
    else if(mode==='condition')change={kind:'condition',taskId:taskId!,scopeIds,note,value:{value:value as SemanticTask['condition']['value'],conditionScopeIds:value==='not_applicable'?[]:[conditionScope].filter(Boolean),factScopeIds:['true','false'].includes(value)?[factScope].filter(Boolean):[]}}
    else if(mode==='add_task')change={kind:'add_task',value:newTask('user-'+crypto.randomUUID(),false),scopeIds,note}
    else {const addedTask=newTarget?newTask('user-'+crypto.randomUUID(),true):null
      change={kind:'revision',index:relationIndex,value:{addedTask,relation:{type:from?'supersedes':'cancels',targetDirectiveId:addedTask?.id??target,fromDirectiveId:from||null,effective:value as 'true'|'false'|'unknown',scopeIds}},scopeIds,note}}
    await correctSemanticFact(repo,{draftId,revision,operationId:crypto.randomUUID(),change})
  }
  return <section aria-label={task?'条件与事件纠正：'+task.detail.title:'通知漏项与新旧要求纠正'}>
    {!ready?<><p>模型原回答有关系错误，不能直接确认。可保留失败记录，依据完整原文人工纠正；这不会重新调用模型。</p>
      <blockquote>{workspace.sourceVersions.find(v=>v.id===workspace.recognitionRuns.find(r=>r.id===draft.recognitionRunId)?.sourceVersionId)?.rawText}</blockquote>
      <button type="button" disabled={Boolean(blocked)} onClick={()=>void run(()=>openFailedForCorrection(repo,draftId,semanticRevision(workspace)))}>保留失败原答，进入人工纠错</button></>
      :<><p>{state?.version===REAL_STATE_VERSION&&state.recovery?'原模型识别失败仍保留；以下为人工纠正。':'人工纠正单独保存，不改变模型原回答。'}</p>
      {!mode&&(task?<><button type="button" disabled={Boolean(blocked)} onClick={()=>start('condition')}>核对执行条件</button><button type="button" disabled={Boolean(blocked)} onClick={()=>start('event')}>核对活动关联</button></>
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
        {mode==='revision'&&<><label>要纠正的关系<select value={relationIndex} onChange={e=>setRelationIndex(Number(e.target.value))}>{facts!.revisions.map((r,i)=><option key={i} value={i}>关系 {i+1}：{r.type} / {r.targetDirectiveId}</option>)}<option value={facts!.revisions.length}>补充一条关系</option></select></label>
          <label><input type="checkbox" checked={newTarget} onChange={e=>setNewTarget(e.target.checked)}/>旧要求漏提取，依据原文补充</label>
          {!newTarget&&<label>作废的旧要求<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">请选择</option>{facts!.tasks.map(t=><option key={t.id} value={t.id}>{t.detail.title}</option>)}</select></label>}
          <label>替代它的新要求<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">只取消，没有替代要求</option>{facts!.tasks.map(t=><option key={t.id} value={t.id}>{t.detail.title}</option>)}</select></label>
          <label>修订是否生效<select value={value} onChange={e=>setValue(e.target.value)}><option value="">请选择</option><option value="true">原文明确生效</option><option value="false">原文明确未生效</option><option value="unknown">尚不确定</option></select></label></>}
        {(mode==='add_task'||(mode==='revision'&&newTarget))&&<><label>原文动作<input value={action} onChange={e=>setAction(e.target.value)}/></label><label>原文对象<input value={object} onChange={e=>setObject(e.target.value)}/></label>
          <label>动作影响<select value={effect} onChange={e=>setEffect(e.target.value as SemanticTask['effect'])}><option value="unknown">未确定</option><option value="local_change">仅本机</option><option value="physical_action">线下操作</option><option value="external_transfer">对外提交</option></select></label>
          <p>本次补项仅适用于原文明示要求、没有额外时间/材料/活动/条件的任务；旧要求作为已作废历史保留，不创建待办。</p></>}
        <label>核对理由或用户补充说明<textarea value={note} onChange={e=>setNote(e.target.value)}/></label>
        <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>我已对照完整原文，确认上述关系及补项范围；说明属于人工核对，不是模型预测</label>
        <button type="button" disabled={!checked||!note.trim()||!scopeIds.length||(!value&&mode!=='add_task')} onClick={()=>void run(save)}>保存关系纠正</button>
        <button type="button" onClick={()=>setMode('')}>放弃未保存关系纠正</button>
      </fieldset>}</>}
    {error&&<p role="alert">未保存：{error}。原回答和已确认内容没有改变。</p>}
  </section>
}
