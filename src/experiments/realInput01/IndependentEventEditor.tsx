import {useEffect,useRef,useState} from 'react'
import type {WorkspaceV8} from '../../domain/v2/types'
import type {SemanticRepository} from '../mainline05/semanticRepository'
import {correctSemanticFact} from '../mainline05/semanticConfirmation'
import {effectiveStateFacts,life,semanticRevision,stateOfRuntime} from '../mainline05/semanticState'
import type {FactChange} from './factCorrections'

/** Explicit, source-linked user corrections. The model response remains immutable. */
export function IndependentEventEditor({repo,workspace,draftId,busy,onDirty,onSaved}:{repo:SemanticRepository;workspace:WorkspaceV8;draftId:string;busy:boolean;onDirty:(dirty:boolean)=>void;onSaved:()=>Promise<void>}){
  const state=stateOfRuntime(workspace,draftId),facts=effectiveStateFacts(state).facts
  const [change,setChange]=useState<FactChange|null>(null),[revision,setRevision]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState('')
  const [adding,setAdding]=useState(false),[scopes,setScopes]=useState<string[]>([]),[title,setTitle]=useState(''),[location,setLocation]=useState(''),[rawTime,setRawTime]=useState(''),[normalized,setNormalized]=useState(''),[precision,setPrecision]=useState<'vague'|'relative'|'date_only'|'exact'>('vague'),[note,setNote]=useState('')
  const notify=useRef(onDirty);useEffect(()=>{notify.current=onDirty},[onDirty])
  useEffect(()=>{notify.current(Boolean(change)||adding||working);return()=>notify.current(false)},[change,adding,working])
  const blocked=busy||working||life(state).informationReviewed||facts.tasks.length>0
  const select=(next:FactChange)=>{setChange(next);setRevision(semanticRevision(workspace));setError('')}
  const update=(value:FactChange['value'])=>{if(change)setChange({...change,value} as FactChange)}
  const save=async()=>{
    if(!change||blocked)return
    setWorking(true);setError('')
    try{await correctSemanticFact(repo,{draftId,revision,operationId:crypto.randomUUID(),change});setChange(null);await onSaved()}
    catch(cause){setError(cause instanceof Error?cause.message:'保存失败；编辑仍保留，请手动重试。')}
    finally{setWorking(false)}
  }
  const saveAdd=async()=>{
    if(blocked||!adding)return
    setWorking(true);setError('')
    try{
      const eventId='user-'+crypto.randomUUID(),timeId=rawTime.trim()?'user-'+crypto.randomUUID():null
      const change:FactChange={kind:'add_independent_event',scopeIds:scopes,note,value:{
        event:{tempId:eventId,title:title.trim(),description:'',location:location.trim()||null,startTimePointTempId:timeId,endTimePointTempId:null,scopeIds:scopes,confidence:1,inferenceLevel:'explicit',relatedTaskTempIds:[]},
        time:timeId?{tempId:timeId,type:'event_start',rawText:rawTime.trim(),normalizedValue:normalized.trim()||null,timezone:state.context.timezone,isAllDay:precision==='date_only',precision,needsConfirmation:!normalized.trim(),relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:scopes,confidence:1}:null}}
      await correctSemanticFact(repo,{draftId,revision,operationId:crypto.randomUUID(),change})
      setAdding(false);await onSaved()
    }catch(cause){setError(cause instanceof Error?cause.message:'保存失败；编辑仍保留，请手动重试。')}
    finally{setWorking(false)}
  }
  const events=facts.events.filter(event=>!event.relatedTaskTempIds.length)
  const times=facts.timePoints.filter(time=>!time.relatedTaskTempIds.length&&!time.relatedMaterialTempIds.length&&events.some(event=>[event.startTimePointTempId,event.endTimePointTempId].includes(time.tempId)))
  return <section aria-label="独立事件人工核对"><h3>核对独立事件</h3><p>此处编辑是你的纠正，原模型回答和首次建议不变。原文依据仍可在上方定位；时间不确定时不生成日程。</p>
    {!change&&!adding&&<button type="button" disabled={blocked} onClick={()=>{setAdding(true);setRevision(semanticRevision(workspace));setError('')}}>依据原文补充独立事件</button>}
    {adding&&<fieldset disabled={blocked}><legend>人工补录独立事件及可选开始时间</legend>
      <p>逐项选择原文依据；事件名称和时间原文必须逐字出现在所选片段中。未知日期留空，不猜测具体日程。</p>
      {state.context.index.scopes.map(s=><label key={s.id}><input type="checkbox" checked={scopes.includes(s.id)} onChange={e=>setScopes(e.target.checked?[...scopes,s.id]:scopes.filter(id=>id!==s.id))}/>{s.text}</label>)}
      <label>原文事件名称<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>地点（原文有则填写）<input value={location} onChange={e=>setLocation(e.target.value)}/></label>
      <label>开始时间原文（没有则留空）<input value={rawTime} onChange={e=>setRawTime(e.target.value)}/></label>
      {rawTime&&<><label>时间精度<select value={precision} onChange={e=>setPrecision(e.target.value as typeof precision)}><option value="vague">模糊</option><option value="relative">相对时间</option><option value="date_only">仅日期</option><option value="exact">具体时刻</option></select></label>
        <label>确定的日期或时刻（未知留空）<input value={normalized} onChange={e=>setNormalized(e.target.value)} placeholder="YYYY-MM-DD 或 YYYY-MM-DDTHH:mm"/></label></>}
      <label>核对说明<textarea value={note} onChange={e=>setNote(e.target.value)}/></label>
      <button type="button" disabled={working||!scopes.length||!title.trim()||!note.trim()} onClick={()=>void saveAdd()}>保存人工事件</button>
      <button type="button" disabled={working} onClick={()=>setAdding(false)}>放弃未保存补录</button>
    </fieldset>}
    {events.map(event=><div key={event.tempId}><p>事件：{event.title}；地点：{event.location??'未说明'}</p><button type="button" disabled={blocked||Boolean(change)} onClick={()=>select({kind:'independent_event',eventId:event.tempId,value:{...event},scopeIds:[...event.scopeIds],note:'用户核对独立事件字段。'})}>编辑事件字段</button></div>)}
    {times.map(time=><div key={time.tempId}><p>{time.type==='event_start'?'开始':'结束'}：{time.rawText}；{time.normalizedValue??'时间尚未确定'}；{time.precision}；{time.needsConfirmation?'需确认':'已核对'}</p><button type="button" disabled={blocked||Boolean(change)} onClick={()=>select({kind:'independent_time',timeId:time.tempId,value:{...time},scopeIds:[...time.scopeIds],note:'用户核对独立事件时间。'})}>编辑事件时间</button></div>)}
    {change?.kind==='independent_event'&&<fieldset disabled={busy||working}><legend>编辑事件字段</legend>
      <label>事件名称<input value={change.value.title} onChange={e=>update({...change.value,title:e.target.value})}/></label>
      <label>地点<input value={change.value.location??''} onChange={e=>update({...change.value,location:e.target.value||null})}/></label>
      <label>说明<textarea value={change.value.description} onChange={e=>update({...change.value,description:e.target.value})}/></label>
      {(['startTimePointTempId','endTimePointTempId'] as const).map(field=><label key={field}>{field==='startTimePointTempId'?'开始时间':'结束时间'}<select value={change.value[field]??''} onChange={e=>update({...change.value,[field]:e.target.value||null})}><option value="">未说明</option>{times.filter(t=>t.type===(field==='startTimePointTempId'?'event_start':'event_end')).map(t=><option key={t.tempId} value={t.tempId}>{t.rawText}</option>)}</select></label>)}
    </fieldset>}
    {change?.kind==='independent_time'&&<fieldset disabled={busy||working}><legend>编辑事件时间</legend>
      <label>时间类型<select value={change.value.type} onChange={e=>update({...change.value,type:e.target.value as typeof change.value.type})}><option value="event_start">活动开始</option><option value="event_end">活动结束</option></select></label>
      <label>原文时间或人工纠正<input value={change.value.rawText} onChange={e=>update({...change.value,rawText:e.target.value})}/></label>
      <label>时间精度<select value={change.value.precision} onChange={e=>update({...change.value,precision:e.target.value as typeof change.value.precision})}><option value="vague">模糊</option><option value="relative">相对时间</option><option value="date_only">仅日期</option><option value="exact">具体时刻</option></select></label>
      <label>确定的日期或时刻（未知请留空）<input value={change.value.normalizedValue??''} onChange={e=>update({...change.value,normalizedValue:e.target.value||null,needsConfirmation:!e.target.value})} placeholder="YYYY-MM-DD 或 YYYY-MM-DDTHH:mm"/></label>
      <label><input type="checkbox" checked={change.value.needsConfirmation} onChange={e=>update({...change.value,needsConfirmation:e.target.checked,normalizedValue:e.target.checked?null:change.value.normalizedValue})}/>时间仍需确认</label>
      <p>原模型的 rawText 与来源定位会保留在修改历史。没有确切日期时只能留空，不能猜测。</p>
    </fieldset>}
    {change&&<><p>编辑尚未保存，不能直接标记已核对。</p><button type="button" disabled={busy||working} onClick={()=>void save()}>保存事件纠正</button><button type="button" disabled={working} onClick={()=>{setChange(null);setError('')}}>放弃未保存修改</button></>}
    {error&&<p role="alert">{error}。未宣称保存成功。</p>}
  </section>
}
