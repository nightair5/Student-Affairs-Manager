import {useEffect,useMemo,useRef,useState} from 'react'
import type {WorkspaceV8} from '../../domain/v2/types'
import type {SemanticRepository} from '../mainline05/semanticRepository'
import {correctSemanticFact} from '../mainline05/semanticConfirmation'
import {effectiveStateFacts,life,semanticRevision,stateOfRuntime} from '../mainline05/semanticState'
import type {FactChange} from './factCorrections'
import type {D20ReviewSessionRepository} from '../candidate16/d20ReviewSession'
import type {ReviewField} from '../candidate16/d20ReviewSession'
import {stableJson} from '../mainline04/semanticContract'

function eventEditSummary(input:unknown){
  if(!input||typeof input!=='object')return '无原值'
  const item=input as Record<string,unknown>,change=item.change&&typeof item.change==='object'?item.change as Record<string,unknown>:null
  const fact=(change?.value&&typeof change.value==='object'?change.value:item) as Record<string,unknown>
  const values=[fact.title, fact.rawText, fact.location, fact.normalizedValue]
    .filter(value=>typeof value==='string'&&value.trim()).map(String)
  return values.length?values.join(' / '):'未填写事件名称或时间'
}

/** Explicit, source-linked user corrections. The model response remains immutable. */
export function IndependentEventEditor({repo,workspace,draftId,busy,onDirty,onSaved,reviewSession}:{repo:SemanticRepository;workspace:WorkspaceV8;draftId:string;busy:boolean;onDirty:(dirty:boolean)=>void;onSaved:()=>Promise<void>;reviewSession?:D20ReviewSessionRepository}){
  const state=stateOfRuntime(workspace,draftId),facts=effectiveStateFacts(state).facts
  const [change,setChange]=useState<FactChange|null>(null),[revision,setRevision]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState('')
  const [adding,setAdding]=useState(false),[addIdentity,setAddIdentity]=useState(''),[scopes,setScopes]=useState<string[]>([]),[title,setTitle]=useState(''),[location,setLocation]=useState(''),[rawTime,setRawTime]=useState(''),[normalized,setNormalized]=useState(''),[precision,setPrecision]=useState<'vague'|'relative'|'date_only'|'exact'>('vague'),[rawEnd,setRawEnd]=useState(''),[normalizedEnd,setNormalizedEnd]=useState(''),[precisionEnd,setPrecisionEnd]=useState<'vague'|'relative'|'date_only'|'exact'>('vague'),[note,setNote]=useState('')
  const [checkpointReady,setCheckpointReady]=useState(!reviewSession),[checkpointStatus,setCheckpointStatus]=useState(''),[checkpointError,setCheckpointError]=useState('')
  const [checkpointPhase,setCheckpointPhase]=useState<'idle'|'saving'|'saved'|'failed'|'conflict'|'foreign'>('idle')
  const checkpointVersion=useRef('')
  const [checkpointEntry,setCheckpointEntry]=useState<ReviewField|null>(null)
  const [baselineChanged,setBaselineChanged]=useState(false)
  const loadStarted=useRef(false)
  const lastCheckpoint=useRef(''),checkpointQueue=useRef(Promise.resolve()),checkpointEpoch=useRef(0)
  const [retryCheckpoint,setRetryCheckpoint]=useState(0)
  const changeKey=change?.kind==='independent_event'?`event:${change.eventId}:edit`:change?.kind==='independent_time'?`time:${change.timeId}:edit`:''
  const baselineFor=(value:FactChange|null,creating:boolean)=>stableJson(creating?{sourceVersion:workspace.sources.find(source=>source.id===workspace.sourceVersions.find(version=>version.id===workspace.recognitionRuns.find(run=>run.id===workspace.extractionDrafts.find(draft=>draft.id===draftId)?.recognitionRunId)?.sourceVersionId)?.sourceId)?.currentVersionId}:
    value?.kind==='independent_event'?{event:facts.events.find(item=>item.tempId===value.eventId),times:facts.timePoints.filter(item=>{const current=facts.events.find(event=>event.tempId===value.eventId);return [current?.startTimePointTempId,current?.endTimePointTempId].includes(item.tempId)})}:
    value?.kind==='independent_time'?{time:facts.timePoints.find(item=>item.tempId===value.timeId)}:null)
  const [inputBaseline,setInputBaseline]=useState('')
  const snapshot=useMemo(()=>adding?{adding,addIdentity,scopes,title,location,rawTime,normalized,precision,rawEnd,normalizedEnd,precisionEnd,note,baseline:inputBaseline}
    :change?{change,baseline:inputBaseline}:null,[adding,addIdentity,scopes,title,location,rawTime,normalized,precision,rawEnd,normalizedEnd,precisionEnd,note,inputBaseline,change])
  const restoreSnapshot=(saved:typeof snapshot)=>{
    if(!saved)return
    if('adding' in saved&&saved.adding){setAdding(true);setAddIdentity(saved.addIdentity||crypto.randomUUID());setScopes(saved.scopes);setTitle(saved.title);setLocation(saved.location);setRawTime(saved.rawTime);setNormalized(saved.normalized);setPrecision(saved.precision);setRawEnd(saved.rawEnd);setNormalizedEnd(saved.normalizedEnd);setPrecisionEnd(saved.precisionEnd);setNote(saved.note)}
    else if('change' in saved)setChange(saved.change)
    setInputBaseline(saved.baseline);setRevision(semanticRevision(workspace));setBaselineChanged(saved.baseline!==baselineFor('change' in saved?saved.change??null:null,Boolean('adding' in saved&&saved.adding)))
  }
  useEffect(()=>{
    if(!reviewSession||checkpointReady||loadStarted.current)return
    loadStarted.current=true
    let live=true
    void reviewSession.load(workspace,draftId).then(session=>{
      if(!live)return
      const entry=Object.entries(session.fields).find(([key])=>key==='event:new:add'||/^event:[^:]+:edit$/.test(key)||/^time:[^:]+:edit$/.test(key))
      if(entry){const saved=entry[1].mine as typeof snapshot
        restoreSnapshot(saved)
        lastCheckpoint.current=JSON.stringify(saved);checkpointVersion.current=entry[1].revision
        setCheckpointEntry(entry[1])
        setCheckpointPhase(entry[1].conflict?'conflict':entry[1].writer!==reviewSession.writer?'foreign':'saved');setCheckpointStatus(entry[1].conflict?'事件编辑存在冲突，请先处理':'恢复的未确认事件编辑，尚未正式确认')
      }
      setCheckpointReady(true)
    }).catch(error=>{if(live){setCheckpointError(String(error));setCheckpointReady(true)}})
    return()=>{live=false;loadStarted.current=false}
  },[reviewSession,draftId,workspace,checkpointReady,restoreSnapshot])
  useEffect(()=>{
    if(!reviewSession||!checkpointReady||!snapshot||checkpointPhase==='foreign'||checkpointPhase==='conflict')return
    const serialized=JSON.stringify(snapshot)
    if(serialized===lastCheckpoint.current&&!retryCheckpoint)return
    lastCheckpoint.current=serialized
    const epoch=++checkpointEpoch.current
    const key=adding?'event:new:add':changeKey
    const base=adding?null:change?.kind==='independent_event'?facts.events.find(item=>item.tempId===change.eventId)
      :change?.kind==='independent_time'?facts.timePoints.find(item=>item.tempId===change.timeId):null
    setCheckpointPhase('saving');setCheckpointStatus('正在保存事件检查点');setCheckpointError('')
    checkpointQueue.current=checkpointQueue.current.catch(()=>undefined).then(async()=>{
      const saved=await reviewSession.stage(workspace,draftId,key,base,snapshot,reviewSession.writer)
      const field=saved.fields[key]
      if(epoch===checkpointEpoch.current){checkpointVersion.current=field?.revision??'';setCheckpointEntry(field);setCheckpointPhase(field?.conflict?'conflict':'saved');setCheckpointStatus(field?.conflict?'事件编辑冲突：请选择版本':'事件检查点已保存，尚未正式确认');setRetryCheckpoint(0)}
    }).catch(error=>{if(epoch===checkpointEpoch.current){setCheckpointPhase('failed');setCheckpointStatus('事件检查点保存失败');setCheckpointError(String(error));setRetryCheckpoint(0)}})
  },[reviewSession,checkpointReady,snapshot,adding,change,changeKey,workspace,draftId,facts.events,facts.timePoints,retryCheckpoint,checkpointPhase])
  const notify=useRef(onDirty);useEffect(()=>{notify.current=onDirty},[onDirty])
  useEffect(()=>{notify.current(Boolean(change)||adding||working);return()=>notify.current(false)},[change,adding,working])
  const blocked=busy||working||life(state).informationReviewed||Boolean(life(state).independentEventsReviewedAt)
  const resetAdd=()=>{setAddIdentity('');setScopes([]);setTitle('');setLocation('');setRawTime('');setNormalized('');setPrecision('vague');setRawEnd('');setNormalizedEnd('');setPrecisionEnd('vague');setNote('')}
  const select=(next:FactChange)=>{const baseline=baselineFor(next,false);lastCheckpoint.current=JSON.stringify({change:next,baseline});checkpointVersion.current='';setCheckpointPhase('saved');setChange(next);setRevision(semanticRevision(workspace));setInputBaseline(baseline);setBaselineChanged(false);setError('')}
  const update=(value:FactChange['value'])=>{if(change)setChange({...change,value} as FactChange)}
  const save=async()=>{
    if(!change||blocked||baselineChanged||reviewSession&&checkpointPhase!=='saved')return
    setWorking(true);setError('')
    const pending=change,key=changeKey,expectedCheckpointRevision=checkpointVersion.current
    let changed=false
    try{
      const latest=await repo.load()
      const currentFacts=effectiveStateFacts(stateOfRuntime(latest,draftId)).facts
      const current=pending.kind==='independent_event'
        ? currentFacts.events.find(item=>item.tempId===pending.eventId)
        :pending.kind==='independent_time'?currentFacts.timePoints.find(item=>item.tempId===pending.timeId):null
      // A recovered checkpoint may already have been applied before the tab
      // reloaded. Closing it is not a second correction and needs no text edit.
      if(!current||stableJson(current)!==stableJson(pending.value)){
        await correctSemanticFact(repo,{draftId,revision,operationId:crypto.randomUUID(),change:pending})
        changed=true
      }
    }
    catch(cause){setError(cause instanceof Error?cause.message:'保存失败；编辑仍保留，请手动重试。');setWorking(false);return}
    // Clear before the parent reloads. Otherwise a remounted editor can see
    // the applied checkpoint and offer to apply the same correction again.
    if(reviewSession&&expectedCheckpointRevision)try{await reviewSession.clear(workspace,draftId,key,reviewSession.writer,expectedCheckpointRevision)}
    catch{setError('人工草稿纠正已保存，但检查点清理失败；请核对未确认编辑，尚未确认正式事件。');setWorking(false);return}
    setCheckpointPhase('idle');setCheckpointStatus(changed?'草稿纠正已保存，尚未正式确认':'已核对现有草稿，无新增纠正；尚未正式确认')
    setChange(null)
    try{await onSaved()}catch{setError('人工草稿纠正已写入，但读回失败；尚未确认正式事件，请重新打开来源核对。');setWorking(false);return}
    setWorking(false)
  }
  const saveAdd=async()=>{
    if(blocked||!adding||baselineChanged||reviewSession&&checkpointPhase!=='saved')return
    if((normalized.trim()&& !['exact','date_only'].includes(precision))||(normalizedEnd.trim()&&!['exact','date_only'].includes(precisionEnd))){setError('模糊或相对时间不能沿用确定时刻；请清空确定时间，或核实后改为具体时刻。');return}
    setWorking(true);setError('')
    try{
      if(!addIdentity)throw Error('D21_EVENT_IDENTITY_MISSING')
      const eventId='user-'+addIdentity,timeId=rawTime.trim()?eventId+'-start':null,endId=rawEnd.trim()?eventId+'-end':null
      const change:FactChange={kind:'add_independent_event',scopeIds:scopes,note,value:{
        event:{tempId:eventId,title:title.trim(),description:'',location:location.trim()||null,startTimePointTempId:timeId,endTimePointTempId:endId,scopeIds:scopes,confidence:1,inferenceLevel:'explicit',relatedTaskTempIds:[]},
        time:timeId?{tempId:timeId,type:'event_start',rawText:rawTime.trim(),normalizedValue:normalized.trim()||null,timezone:state.context.timezone,isAllDay:precision==='date_only',precision,needsConfirmation:!normalized.trim(),relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:scopes,confidence:1}:null,
        endTime:endId?{tempId:endId,type:'event_end',rawText:rawEnd.trim(),normalizedValue:normalizedEnd.trim()||null,timezone:state.context.timezone,isAllDay:precisionEnd==='date_only',precision:precisionEnd,needsConfirmation:!normalizedEnd.trim(),relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:scopes,confidence:1}:null}}
      await correctSemanticFact(repo,{draftId,revision,operationId:addIdentity,change})
    }catch(cause){setError(cause instanceof Error?cause.message:'保存失败；编辑仍保留，请手动重试。');setWorking(false);return}
    if(reviewSession)try{await reviewSession.clear(workspace,draftId,'event:new:add',reviewSession.writer,checkpointVersion.current)}
    catch{setError('人工草稿纠正已保存，但检查点清理失败；请核对未确认编辑，尚未确认正式事件。');setWorking(false);return}
    setCheckpointPhase('idle');setCheckpointStatus('草稿事件已保存，尚未正式确认')
    setAdding(false);resetAdd()
    try{await onSaved()}catch{setError('人工草稿纠正已写入，但读回失败；尚未确认正式事件，请重新打开来源核对。');setWorking(false);return}
    setWorking(false)
  }
  const events=facts.events.filter(event=>!event.relatedTaskTempIds.length)
  const times=facts.timePoints.filter(time=>!time.relatedTaskTempIds.length&&!time.relatedMaterialTempIds.length&&events.some(event=>[event.startTimePointTempId,event.endTimePointTempId].includes(time.tempId)))
  return <section aria-label="独立事件人工核对"><h3>核对独立事件</h3><p>此处编辑是你的纠正，原模型回答和首次建议不变。原文依据仍可在上方定位；时间不确定时不生成日程。</p>
    {reviewSession&&<p role="status">{checkpointStatus||'当前没有未保存的事件输入'}。{baselineChanged&&<strong role="alert">相关事件或时间已变化；保留了你的输入，请重新核对，不能直接覆盖。</strong>}
      {checkpointPhase==='foreign'&&checkpointEntry&&<button type="button" onClick={()=>{const key=adding?'event:new:add':changeKey;void reviewSession.recover(workspace,draftId,reviewSession.writer,{[key]:checkpointEntry.revision}).then(saved=>{const entry=saved.fields[key];setCheckpointEntry(entry);checkpointVersion.current=entry.revision;setCheckpointPhase('saved');setCheckpointStatus('已接管未确认输入，仍需核对')}).catch(cause=>setCheckpointError(String(cause)))}}>接管未确认事件输入</button>}
      {checkpointPhase==='conflict'&&checkpointEntry?.conflict&&<><span>编辑前：{eventEditSummary(checkpointEntry.base)}；最新已保存：{eventEditSummary(checkpointEntry.conflict.latest)}；我的输入：{eventEditSummary(checkpointEntry.conflict.incoming)}</span>
        {(['latest','incoming'] as const).map(choice=><button type="button" key={choice} onClick={()=>{const key=adding?'event:new:add':changeKey;void reviewSession.resolve(workspace,draftId,key,choice,reviewSession.writer,checkpointEntry.revision).then(saved=>{const entry=saved.fields[key];restoreSnapshot(entry.mine as typeof snapshot);setCheckpointEntry(entry);checkpointVersion.current=entry.revision;lastCheckpoint.current=JSON.stringify(entry.mine);setCheckpointPhase('saved');setCheckpointStatus('已选择冲突版本，仍须核对后保存')}).catch(cause=>setCheckpointError(String(cause)))}}>采用{choice==='latest'?'最新已保存':'我的输入'}</button>)}</>}
      {checkpointError&&<><strong role="alert">{checkpointError}；当前输入仅在本页，刷新可能丢失。</strong><button type="button" onClick={()=>setRetryCheckpoint(value=>value+1)}>重试保存事件检查点</button></>}</p>}
    {!change&&!adding&&<button type="button" disabled={blocked} onClick={()=>{resetAdd();setAddIdentity(crypto.randomUUID());setAdding(true);setInputBaseline(baselineFor(null,true));setBaselineChanged(false);setRevision(semanticRevision(workspace));setError('')}}>依据原文补充独立事件</button>}
    {adding&&<fieldset disabled={blocked}><legend>人工补录独立事件及可选起止时间</legend>
      <p>逐项选择原文依据；事件名称和时间原文必须逐字出现在所选片段中。未知日期留空，不猜测具体日程。</p>
      {state.context.index.scopes.map(s=><label key={s.id}><input type="checkbox" checked={scopes.includes(s.id)} onChange={e=>setScopes(e.target.checked?[...scopes,s.id]:scopes.filter(id=>id!==s.id))}/>{s.text}</label>)}
      <label>原文事件名称<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>地点（原文有则填写）<input value={location} onChange={e=>setLocation(e.target.value)}/></label>
      <label>开始时间原文（没有则留空）<input value={rawTime} onChange={e=>{setRawTime(e.target.value);setNormalized('');setPrecision('vague')}}/></label>
      {rawTime&&<><label>时间精度<select value={precision} onChange={e=>{setPrecision(e.target.value as typeof precision);setNormalized('')}}><option value="vague">模糊</option><option value="relative">相对时间</option><option value="date_only">仅日期</option><option value="exact">具体时刻</option></select></label>
        <label>确定的日期或时刻（未知留空）<input value={normalized} onChange={e=>setNormalized(e.target.value)} placeholder="YYYY-MM-DD 或 YYYY-MM-DDTHH:mm"/></label></>}
      <label>结束时间原文（没有则留空）<input value={rawEnd} onChange={e=>{setRawEnd(e.target.value);setNormalizedEnd('');setPrecisionEnd('vague')}}/></label>
      {rawEnd&&<><label>结束时间精度<select value={precisionEnd} onChange={e=>{setPrecisionEnd(e.target.value as typeof precisionEnd);setNormalizedEnd('')}}><option value="vague">模糊</option><option value="relative">相对时间</option><option value="date_only">仅日期</option><option value="exact">具体时刻</option></select></label>
        <label>确定的结束日期或时刻（未知留空）<input value={normalizedEnd} onChange={e=>setNormalizedEnd(e.target.value)} placeholder="YYYY-MM-DD 或 YYYY-MM-DDTHH:mm"/></label></>}
      <label>核对说明<textarea value={note} onChange={e=>setNote(e.target.value)}/></label>
      <button type="button" disabled={working||baselineChanged||reviewSession&&checkpointPhase!=='saved'||!scopes.length||!title.trim()||!note.trim()} onClick={()=>void saveAdd()}>保存人工事件</button>
      <button type="button" disabled={working} onClick={()=>{setAdding(false);resetAdd()}}>放弃未保存补录</button>
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
    {change&&<><p>编辑尚未保存，不能直接标记已核对。</p><button type="button" disabled={busy||working||baselineChanged||reviewSession&&checkpointPhase!=='saved'} onClick={()=>void save()}>保存事件纠正</button><button type="button" disabled={working} onClick={()=>{setChange(null);setError('')}}>放弃未保存修改</button></>}
    {error&&<p role="alert">{error}。未宣称保存成功。</p>}
  </section>
}
