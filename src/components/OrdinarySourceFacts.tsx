import {useEffect,useRef,useState} from 'react'
import type {ExtractionDraft,Source} from '../types'
import type {RecognitionResult,TimePointSuggestionV2} from '../recognition/types'
import type {WorkspaceV8} from '../domain/v2/types'
import type {D20ReviewSessionRepository,ReviewField} from '../experiments/candidate16/d20ReviewSession'
import {interpretTimeD26} from '../lib/timeSemanticsD26'
import {MATERIAL_CHANNEL_GROUNDING_VERSION,type MaterialChannelAudit} from '../recognition/materialChannelGrounding'
import {eventDisposition,type EventDisposition} from '../domain/v2/eventDisposition'

type Props={draft:ExtractionDraft;source:Source|null;workspace:WorkspaceV8|null;session:D20ReviewSessionRepository;onDirty:(dirty:boolean)=>void;onSave:(result:RecognitionResult,decision?:{eventId:string;before:EventDisposition;after:EventDisposition})=>Promise<void>}
type Buffer={kind?:'event'|'task';action?:string;object?:string;eventId:string;title:string;location:string;start:string;end:string}
const blank:Buffer={eventId:'',title:'',location:'',start:'',end:''}
function eventTimeSummary(point:TimePointSuggestionV2):string {
  if(point.needsConfirmation||!point.normalizedValue)return point.rawText+'（具体时刻未知，不创建确定日程）'
  const match=point.normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?$/u)
  if(!match)return point.rawText
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日${match[4]?' '+match[4]:''}（原文：${point.rawText}）`
}
/** Uses the ordinary result + persistent ReviewSession and the parent's real repository save. */
export function OrdinarySourceFacts({draft,source,workspace,session,onDirty,onSave}:Props){
  const result=draft.recognitionResult
  const [buffer,setBuffer]=useState<Buffer|null>(null)
  const [field,setField]=useState<ReviewField|null>(null)
  const [status,setStatus]=useState('')
  const [busy,setBusy]=useState(false)
  const [pendingChoice,setPendingChoice]=useState<{eventId:string;decision:EventDisposition;field:ReviewField|null}|null>(null)
  const queue=useRef(Promise.resolve())
  const key='event:source:ordinary-buffer'
  const writer=session.writer
  const storedAudit=workspace?.extractionDrafts.find(d=>d.id===draft.id)?.legacyData?.materialChannelGrounding
  const channelAudit=storedAudit&&typeof storedAudit==='object'&&!Array.isArray(storedAudit)&&storedAudit.version===MATERIAL_CHANNEL_GROUNDING_VERSION
    ? storedAudit as unknown as MaterialChannelAudit : null
  const sidecar=workspace?.extractionDrafts.find(d=>d.id===draft.id)?.legacyData?.semanticSidecar,authority=sidecar&&typeof sidecar==='object'&&!Array.isArray(sidecar)?sidecar.singleAuthorityAudit:null
  const windows=authority&&typeof authority==='object'&&!Array.isArray(authority)&&Array.isArray(authority.sourceWindows)?authority.sourceWindows:[]
  useEffect(()=>{onDirty(Boolean(buffer)||Boolean(pendingChoice))},[buffer,pendingChoice,onDirty])
  useEffect(()=>{
    if(!workspace)return
    let live=true
    void session.load(workspace,draft.id).then(record=>{if(!live)return;const stored=record.fields[key];if(stored){setField(stored);setBuffer(previous=>previous ?? stored.mine as Buffer);setStatus(stored.conflict?'另一页面修改了事件，请先选择。':'发现尚未正式确认的事件输入。')}const choice=Object.entries(record.fields).find(([k])=>k.startsWith('event:')&&k.endsWith(':disposition'));if(choice){const value=choice[1].mine as {eventId:string;decision:EventDisposition};setPendingChoice(previous=>previous??{...value,field:choice[1]});setStatus('发现未完成的事件选择，请恢复或处理冲突。')}}).catch(error=>{if(live)setStatus(String(error))})
    return()=>{live=false}
  },[draft.id,workspace,session])
  if(!result)return null
  const applyChoice=async(eventId:string,decision:EventDisposition,stored?:ReviewField)=>{
    if(!workspace)return
    setBusy(true)
    const choiceKey=`event:${eventId}:disposition`,mine={eventId,decision}
    setPendingChoice({...mine,field:stored??null})
    try{
      const base=eventDisposition(workspace,draft.id,eventId)
      const current=stored??(await session.stage(workspace,draft.id,choiceKey,base,mine,writer,decision!==base)).fields[choiceKey]
      setPendingChoice({...mine,field:current})
      if(current.conflict||current.writer!==writer)throw Error('事件选择需接管或解决冲突，双方选择均保留。')
      const next={...result,events:result.events.map(e=>e.tempId===eventId?{...e,selected:decision==='keep'}:e)}
      await session.withFreshField(workspace,draft.id,choiceKey,writer,current.revision,mine,()=>onSave(next,{eventId,before:base,after:decision}))
      await session.clear(workspace,draft.id,choiceKey,writer,current.revision)
      setPendingChoice(null);setStatus(decision==='reject'?'事件拒绝已存入草稿；原始首次建议不变。正式确认时只保存保留的事实。':decision==='defer'?'这项事件暂缓；正确项仍可确认。':'事件已保留，等待正式确认。')
    }catch(error){setStatus(`事件选择尚未完成，输入保留，可手动重试：${String(error)}`)}finally{setBusy(false)}
  }
  const edit=(next:Buffer,changed=true)=>{
    setBuffer(next)
    if(!workspace)return
    setStatus('正在保存未确认输入…')
    queue.current=queue.current.catch(()=>undefined).then(async()=>{
      const record=await session.stage(workspace,draft.id,key,blank,next,writer,changed)
      setField(record.fields[key]);setStatus(record.fields[key].conflict?'另一页面修改了事件，请先选择。':'未确认输入已保存；尚未创建正式事件。')
    }).catch(error=>setStatus(`检查点未保存，输入仍在本页：${String(error)}`))
  }
  const save=async()=>{
    if(!buffer||!workspace)return
    setBusy(true)
    try{
      await queue.current
      const current=(await session.load(workspace,draft.id)).fields[key]
      if(!current||current.writer!==writer||current.conflict)throw Error('请先接管恢复输入或处理冲突。')
      if(buffer.kind!=='task'&&!buffer.title.trim())throw Error('请填写事件名称。')
      const text=source?.content ?? source?.rawText ?? ''
      if(buffer.kind==='task'){
        const action=(buffer.action??'').trim(),object=(buffer.object??'').trim()
        const clause=text.split(/[。；\n]/u).find(line=>line.includes(action)&&line.includes(object))
        if(!action||!object||!clause||/无需|不必|不要|已取消/u.test(clause))throw Error('动作与对象需要同一原文依据；否定或已取消的要求不能补为当前待办。')
        const tempId=`user-task:${crypto.randomUUID()}`,evidenceId=`user-evidence:${tempId}`
        const task={tempId,parentTempId:null,hierarchyType:'task' as const,title:action+object,actionVerb:action,actionObject:object,description:'',completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo' as const,prioritySuggestion:'medium' as const,dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[evidenceId],confidence:1,inferenceLevel:'explicit' as const,userConfirmationRequired:true,selected:true}
        const next={...result,sourceSummary:{...result.sourceSummary,requiresAction:true,notificationType:'uncertain' as const},projectMatch:{...result.projectMatch,decision:'standalone_task' as const},standaloneTasks:[...result.standaloneTasks,task],evidence:[...result.evidence,{id:evidenceId,sourceId:draft.sourceId,field:'title' as const,quote:clause,extractionMethod:'manual' as const}]}
        await session.withFreshField(workspace,draft.id,key,writer,current.revision,buffer,()=>onSave(next))
        await session.clear(workspace,draft.id,key,writer,current.revision)
        setBuffer(null);setField(null);setStatus('遗漏任务已补到同一来源草稿；原首次回答不变，等待正式确认。');return
      }
      if(!text.includes(buffer.title.trim())||[buffer.location,buffer.start,buffer.end].some(raw=>raw&&!text.includes(raw)))throw Error('事件名称、地点和时间原文必须有当前通知依据；不会替你猜日期。')
      const eventId=buffer.eventId||`user-event:${crypto.randomUUID()}`
      const evidenceId=`user-evidence:${eventId}`
      const old=result.events.find(e=>e.tempId===eventId)
      const event={...old,tempId:eventId,title:buffer.title.trim(),description:old?.description??'',location:buffer.location.trim()||null,startTimePointTempId:null as string|null,endTimePointTempId:null as string|null,evidenceIds:[...new Set([...(old?.evidenceIds??[]),evidenceId])],confidence:1,inferenceLevel:'explicit' as const,selected:old?.selected??true}
      let startDate:string|undefined
      const points=([['start',buffer.start],['end',buffer.end]] as const).filter(([,raw])=>raw).map(([part,raw])=>{
        const existingEvent=result.events.find(e=>e.tempId===eventId),existing=result.timePoints.find(p=>p.tempId===(part==='start'?existingEvent?.startTimePointTempId:existingEvent?.endTimePointTempId))
        if(existing?.rawText===raw){if(part==='start')startDate=existing.normalizedValue?.slice(0,10);return existing}
        const type=part==='start'?'event_start' as const:'event_end' as const,timezone=result.timePoints[0]?.timezone||'Asia/Shanghai'
        const interpreted=interpretTimeD26(raw,{type,timezone,referenceTime:result.createdAt,sourceContext:text.split(/[。；\n]/u).find(line=>line.includes(buffer.title)&&line.includes(raw))??raw,inheritedDate:part==='end'?startDate:undefined})
        if(part==='start')startDate=interpreted.knownDate??undefined
        return {tempId:`${eventId}:${part}`,type,rawText:raw,normalizedValue:interpreted.point.normalizedValue,timezone,isAllDay:interpreted.point.isAllDay,precision:interpreted.point.precision,needsConfirmation:interpreted.point.needsConfirmation,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[evidenceId],confidence:1,selected:true}
      })
      event.startTimePointTempId=buffer.start?points.find(p=>p.rawText===buffer.start&&p.type==='event_start')?.tempId??null:null
      event.endTimePointTempId=buffer.end?points.find(p=>p.rawText===buffer.end&&p.type==='event_end')?.tempId??null:null
      const removed=new Set([old?.startTimePointTempId,old?.endTimePointTempId,`${eventId}:start`,`${eventId}:end`])
      const shared=new Set(result.events.filter(e=>e.tempId!==eventId).flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]))
      const retained=result.timePoints.filter(p=>!removed.has(p.tempId)||shared.has(p.tempId)||p.relatedTaskTempIds.length>0||p.relatedMaterialTempIds.length>0)
      const next={...result,events:result.events.map(e=>e.tempId===eventId?event:e).concat(old?[]:[event]),timePoints:[...retained.filter(p=>!points.some(next=>next.tempId===p.tempId)),...points],evidence:[...result.evidence.filter(e=>e.id!==evidenceId),{id:evidenceId,sourceId:draft.sourceId,field:'event' as const,quotedText:text,quote:text,extractionMethod:'manual' as const}]}
      await session.withFreshField(workspace,draft.id,key,writer,current.revision,buffer,()=>onSave(next))
      await session.clear(workspace,draft.id,key,writer,current.revision)
      setBuffer(null);setField(null);setStatus('事件草稿纠正已保存，等待本来源正式确认。')
    }catch(error){setStatus(String(error))}finally{setBusy(false)}
  }
  return <section aria-label="同一通知的独立事件与信息">
    {windows.length>0&&<section aria-label="原文办理窗口"><h3>原文办理窗口（不是截止或个人计划）</h3>{windows.map((v,i)=>{if(!v||typeof v!=='object'||Array.isArray(v))return null;const p=result.timePoints.find(p=>p.tempId===v.id);return p?<p key={i}>{v.role==='window_start'?'开放开始':'开放结束'}：{eventTimeSummary(p)}</p>:null})}</section>}
    {channelAudit?.decisions.length ? <section aria-label="材料渠道与办结标准"><h3>材料与办结标准</h3>
      {channelAudit.decisions.map(d=><div key={d.materialId}><strong>{d.materialName}</strong><p>{d.status==='EXPLICIT_CHANNEL'?`提交渠道：${d.displayedValue}`:d.status==='RECEIPT_CONTEXT_UNRESOLVED'?`提交渠道尚未明确。首次模型推测“${d.originalValue}”，原文只用它说明办结回执；不作为确定提交渠道保存。`:`首次模型的渠道“${d.originalValue}”缺少同对象依据，关联事项需要核对。`}</p>
        <details><summary>查看渠道原文依据</summary>{d.evidence.map(e=><blockquote key={e.id}>{e.quote}</blockquote>)}</details></div>)}
      {result.standaloneTasks.flatMap(t=>t.completionCriteria.map((c,i)=><p key={t.tempId+':'+i}>完成标准：{c}</p>))}
    </section>:null}
    <h3>{result.events.length?'同一通知的事件':'信息与独立事件'}</h3>
    {result.events.map(event=>{const handled=workspace?.extractionDrafts.find(d=>d.id===draft.id)?.acceptedEntityTempIds.includes(event.tempId)||workspace?.extractionDrafts.find(d=>d.id===draft.id)?.rejectedEntityTempIds.includes(event.tempId);return <article className="recognition-entity-row" key={event.tempId}><div><strong>{event.title}</strong><p>{event.location||'地点未说明'}；{[event.startTimePointTempId,event.endTimePointTempId].filter(Boolean).map(id=>{const p=result.timePoints.find(t=>t.tempId===id);return p?eventTimeSummary(p):''}).join(' → ')||'原文未说明时间'}</p>{event.description && <p>{event.description}</p>}<p>{handled?'已正式处置':eventDisposition(workspace,draft.id,event.tempId)==='reject'?'已拒绝（草稿）':event.selected===false?'暂缓确认':'保留，待正式确认'}</p><label>处置“{event.title}”<select disabled={busy||Boolean(buffer)||Boolean(pendingChoice)||Boolean(handled)} value={eventDisposition(workspace,draft.id,event.tempId)} onChange={e=>void applyChoice(event.tempId,e.target.value as EventDisposition)}><option value="keep">保留</option><option value="defer">暂缓</option><option value="reject">拒绝多余事件</option></select></label></div><button type="button" disabled={busy||Boolean(buffer)||Boolean(pendingChoice)||Boolean(handled)} onClick={()=>edit({eventId:event.tempId,title:event.title,location:event.location||'',start:result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.rawText||'',end:result.timePoints.find(p=>p.tempId===event.endTimePointTempId)?.rawText||''},false)}>编辑事件</button></article>})}
    {pendingChoice&&<div role="alert"><p>{pendingChoice.field?'事件选择检查点保留，尚未完成草稿保存。':'事件选择仍在本页，检查点尚未保存；刷新可能丢失，请手动重试。'}</p>{pendingChoice.field?.conflict?<>{(['latest','incoming'] as const).map(choice=><button key={choice} disabled={busy} onClick={()=>{if(workspace&&pendingChoice.field)void session.resolve(workspace,draft.id,`event:${pendingChoice.eventId}:disposition`,choice,writer,pendingChoice.field.revision).then(r=>{const f=r.fields[`event:${pendingChoice.eventId}:disposition`],value=f.mine as {eventId:string;decision:EventDisposition};setPendingChoice({...value,field:f})}).catch(e=>setStatus(String(e)))}}>采用{choice==='latest'?'最新选择':'我的选择'}</button>)}</>:<button disabled={busy} onClick={()=>{if(!workspace)return;const p=pendingChoice;if(p.field&&p.field.writer!==writer)void session.recover(workspace,draft.id,writer,{[`event:${p.eventId}:disposition`]:p.field.revision}).then(r=>applyChoice(p.eventId,p.decision,r.fields[`event:${p.eventId}:disposition`])).catch(e=>setStatus(String(e)));else void applyChoice(p.eventId,p.decision,p.field??undefined)}}>恢复并保存事件选择</button>}</div>}
    <p>没有待办也可以保存停机、维护等事件。纯信息可直接标记已核对，不创建任务或空项目。</p>
    <button type="button" disabled={Boolean(buffer)} onClick={()=>edit(blank,false)}>依据原文补充遗漏事件</button>
    <button type="button" disabled={Boolean(buffer)} onClick={()=>edit({...blank,kind:'task',action:'',object:''},false)}>依据原文补充遗漏任务</button>
    {buffer&&<fieldset><legend>{buffer.kind==='task'?'未确认任务输入':'未确认事件输入'}</legend>
      <p>请先保存或明确放弃这份输入，再编辑其他事项；恢复的输入不会被重新打开编辑覆盖。</p>
      {field?.writer!==writer&&!field?.conflict&&<button type="button" onClick={()=>{if(workspace&&field)void session.recover(workspace,draft.id,writer,{[key]:field.revision}).then(r=>{setField(r.fields[key]);setStatus('已接管，可以直接保存，无需改字。')})}}>恢复我的输入并继续</button>}
      {field?.conflict&&<div role="alert"><p>编辑前、最新和我的事件输入发生冲突，原输入都保留。</p>{(['latest','incoming'] as const).map(choice=><button type="button" key={choice} onClick={()=>{if(workspace&&field)void session.resolve(workspace,draft.id,key,choice,writer,field.revision).then(r=>{setField(r.fields[key]);setBuffer(r.fields[key].mine as Buffer)})}}>采用{choice==='latest'?'最新事件':'我的事件输入'}</button>)}</div>}
      <div className="form-grid">{(buffer.kind==='task'?([['action','做什么（原文动作）'],['object','对什么做（原文对象）']] as const):([['title','事件名称（原文）'],['location','地点（没有可留空）'],['start','开始时间原文（没有可留空）'],['end','结束时间原文（没有可留空）']] as const)).map(([name,label])=><label className="field" key={name}><span>{label}</span><input value={buffer[name]??''} onChange={e=>edit({...buffer,[name]:e.target.value})}/></label>)}</div>
      <p>这里只保留原文时间；模糊或未公布时刻保持未知，不编造日历日期。</p><button type="button" disabled={busy||Boolean(field?.conflict)} onClick={()=>void save()}>{buffer.kind==='task'?'保存遗漏任务草稿':'保存事件草稿纠正'}</button>
      <button type="button" disabled={busy||Boolean(field?.conflict)} onClick={()=>edit(buffer,false)}>手动重试未确认输入保存</button>
      <button type="button" disabled={busy||Boolean(field?.conflict)} onClick={()=>{if(workspace&&field)void session.clear(workspace,draft.id,key,writer,field.revision).then(()=>{setBuffer(null);setField(null);setStatus('已放弃未保存事件输入；原始建议保留。')})}}>放弃未保存事件输入</button>
    </fieldset>}
    {status&&<p role="status">{status}</p>}
  </section>
}
