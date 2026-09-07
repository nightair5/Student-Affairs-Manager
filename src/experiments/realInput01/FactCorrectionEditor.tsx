import { useEffect, useRef, useState } from 'react'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { SemanticRepository } from '../mainline05/semanticRepository'
import { correctSemanticFact, reviewSemanticFact, reviewSemanticMaterial } from '../mainline05/semanticConfirmation'
import { REAL_STATE_VERSION, stateOfRuntime, effectiveStateFacts, life, canAct, isCurrentDraft, liveReviewIdentity, semanticRevision, titleReviewProblem, materialReviewEnabled, materialDecision, materialReviewProblem } from '../mainline05/semanticState'
import { materialEdit, factAssets, materialStatusLabels, validateMaterialDecision, type FactChange, type MaterialEdit } from './factCorrections'

export function FactCorrectionEditor({ repo, workspace, draftId, taskId, busy, onDirty, onSaved }: {
  repo: SemanticRepository; workspace: WorkspaceV8; draftId: string; taskId: string; busy: boolean;
  onDirty: (dirty: boolean) => void; onSaved: () => Promise<void>
}) {
  const state = stateOfRuntime(workspace,draftId)
  if (state.version !== REAL_STATE_VERSION) throw Error('REAL_INPUT_EDITOR_PROFILE')
  const facts = effectiveStateFacts(state).facts, task = facts.tasks.find(t => t.id === taskId)!, current = life(state)
  const [change,setChange] = useState<FactChange | null>(null), [working,setWorking] = useState(false), [error,setError] = useState('')
  const [materialBuffer,setMaterialBuffer]=useState<{id:string;required:string;status:string}|null>(null)
  const savedRevision = semanticRevision(workspace), [bufferRevision,setBufferRevision] = useState(savedRevision)
  const notify = useRef(onDirty)
  useEffect(() => { notify.current=onDirty },[onDirty])
  useEffect(() => { notify.current(Boolean(change||materialBuffer) || working); return () => notify.current(false) },[change,materialBuffer,working])
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
      <button type="button" disabled={blocked||Boolean(change||materialBuffer)} onClick={()=>{
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
    <button type="button" disabled={blocked || Boolean(change||materialBuffer) || !canAct(state,taskId) || reviewed || Boolean(titleReviewProblem(current.values[taskId].title))}
      onClick={() => void run(() => reviewSemanticFact(repo,{draftId,taskId,revision:savedRevision,operationId:crypto.randomUUID()}))}>
      {reviewed ? '本项已核对（已保存）' : '本项事实已核对'}</button>
    <details><summary>修正动作、对象或材料</summary>
      <p>仅修正未确认内容；手动材料会独立标记，不冒充原文。时间和标题请使用任务卡中的编辑与保存按钮。</p>
      {(['action','object'] as const).map(field => <button type="button" key={field} disabled={blocked || Boolean(change||materialBuffer)}
        onClick={() => choose({kind:'surface',taskId,field,value:{...task[field]}})}>修改{field==='action'?'动作':'对象'}</button>)}
      {facts.materials.filter(m => assets.materials.has(m.tempId)).map(m => <button type="button" key={m.tempId} disabled={blocked || Boolean(change||materialBuffer)}
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
    {error && <p role="alert">{error}。未宣称保存成功。</p>}
  </section>
}
