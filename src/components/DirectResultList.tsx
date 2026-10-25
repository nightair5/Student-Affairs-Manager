import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Check, CheckCircle2, MapPin, PencilLine, RotateCcw, Trash2 } from 'lucide-react'
import type { DirectBatch, DirectEdit } from '../domain/v2/directIntake'
import type { WorkspaceV8, TimePoint } from '../domain/v2/types'
import { parseBusinessDateTime } from '../lib/timeSemantics'

function displayTime(point:TimePoint|undefined):string {
  if(!point?.normalizedValue)return '时间待定'
  const text=point.normalizedValue,match=/^(\d{4})-(\d{2})-(\d{2})$/u.exec(text)
  const label=match?`${Number(match[2])}月${Number(match[3])}日`:new Intl.DateTimeFormat('zh-CN',{timeZone:point.timezone||'Asia/Shanghai',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(parseBusinessDateTime(text,point.timezone||'Asia/Shanghai')??new Date(text))
  return `${label}${/_deadline$/u.test(point.type)?' 截止':''}`
}
function editFields(point:TimePoint|undefined){
  if(!point?.normalizedValue)return {date:'',time:''}
  if(/^\d{4}-\d{2}-\d{2}$/u.test(point.normalizedValue))return {date:point.normalizedValue,time:''}
  const instant=parseBusinessDateTime(point.normalizedValue,point.timezone||'Asia/Shanghai')
  if(!instant)return {date:'',time:''}
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:point.timezone||'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant),part=(type:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===type)?.value??''
  return {date:`${part('year')}-${part('month')}-${part('day')}`,time:`${part('hour')}:${part('minute')}`}
}
interface Props {workspace:WorkspaceV8;batch:DirectBatch;onClose:()=>void;onUndo:()=>Promise<void>;onDelete:(id:string)=>Promise<void>;onEdit:(id:string,edit:DirectEdit)=>Promise<void>;onDetail:(id:string,kind:'task'|'event')=>void}
export function DirectResultList({workspace,batch,onClose,onUndo,onDelete,onEdit,onDetail}:Props){
  const heading=useRef<HTMLHeadingElement>(null)
  useEffect(()=>{heading.current?.focus()},[])
  const [editing,setEditing]=useState<string|null>(null),[title,setTitle]=useState(''),[date,setDate]=useState(''),[time,setTime]=useState(''),[location,setLocation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const items=batch.items.flatMap(item=>{const entity=item.kind==='task'?workspace.tasks.find(t=>t.id===item.id):workspace.events.find(e=>e.id===item.id);if(!entity)return [];const event=workspace.events.find(e=>e.id===item.id),point=item.kind==='task'?workspace.timePoints.find(p=>(p.taskId===item.id||p.relatedTaskIds.includes(item.id))&&/_deadline$/u.test(p.type))??workspace.timePoints.find(p=>p.type==='planned_start'&&p.relatedTaskIds.includes(item.id)):workspace.timePoints.find(p=>p.id===event?.startTimePointId);const end=event?.endTimePointId?workspace.timePoints.find(p=>p.id===event.endTimePointId):undefined;const windows=item.kind==='task'?workspace.timePoints.filter(p=>p.relatedTaskIds.includes(item.id)&&['event_start','event_end'].includes(p.type)&&p.normalizedValue):[];return [{...item,entity,event,point,end,windows}]})
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action()}catch{setError('这次修改未能保存，原有内容保留。请重试。')}finally{setBusy(false)}}
  const save=(event:FormEvent)=>{event.preventDefault();if(editing)void run(async()=>{await onEdit(editing,{title,date:date?date+(time?'T'+time:''):'',location});setEditing(null)})}
  return <main className="page direct-result-page" aria-labelledby="direct-title">
    <header className="direct-result-heading"><span className="direct-success-mark"><CheckCircle2 size={24}/></span><div><h1 id="direct-title" ref={heading} tabIndex={-1}>已添加 {items.length} 项</h1><p>已加入待办和日历。需要调整时，直接修改即可。</p></div><button className="text-button" type="button" disabled={busy} onClick={()=>void run(onUndo)}><RotateCcw size={16}/>撤销本次添加</button></header>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <ul className="direct-result-list">{items.map(item=><li key={item.id} data-direct-kind={item.kind}>
      <span className="direct-item-icon">{item.kind==='event'?<CalendarDays size={21}/>:<Check size={21}/>}</span>
      <div className="direct-item-copy"><button type="button" className="direct-item-title" onClick={()=>onDetail(item.id,item.kind)}>{item.entity.title}</button><div className="direct-item-meta">{item.point?.normalizedValue||!item.windows.length?<span>{displayTime(item.point)}{item.end?.normalizedValue?` · 结束 ${displayTime(item.end)}`:''}</span>:item.windows.map(p=><span key={p.id}>{p.type==='event_start'?'办理开始：':'办理结束：'}{displayTime(p)}</span>)}{item.event?.location&&<span><MapPin size={14}/>{item.event.location}</span>}{item.tags.map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}</div>
        {editing===item.id&&<form className="direct-item-editor" onSubmit={save}><label>名称<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={300}/></label><div><label>日期<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>时间（可留空）<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></div>{item.kind==='event'&&<label>地点<input value={location} onChange={e=>setLocation(e.target.value)}/></label>}<button type="submit" className="primary-button" disabled={busy}>保存修改</button><button type="button" className="text-button" onClick={()=>setEditing(null)}>取消修改</button></form>}
      </div><div className="direct-item-actions"><button type="button" className="icon-button" aria-label={`编辑${item.entity.title}`} disabled={busy} onClick={()=>{const fields=editFields(item.point);setEditing(item.id);setTitle(item.entity.title);setDate(fields.date);setTime(fields.time);setLocation(item.event?.location??'')}}><PencilLine size={17}/></button><button type="button" className="icon-button" aria-label={`删除${item.entity.title}`} disabled={busy} onClick={()=>void run(()=>onDelete(item.id))}><Trash2 size={17}/></button></div>
    </li>)}</ul>
    <footer className="direct-result-footer"><button className="primary-button" type="button" onClick={onClose}>完成</button></footer>
  </main>
}

export function RecentDirectAdditions({workspace,batches,onUndo,onOpen}:{workspace:WorkspaceV8;batches:DirectBatch[];onUndo:(id:string)=>Promise<void>;onOpen:(id:string)=>void}){
  const [error,setError]=useState('')
  if(!batches.length)return null
  return <section className="recent-direct-additions" aria-label="最近添加"><h2>最近添加</h2>{error&&<p role="alert">{error}</p>}<ul>{batches.slice(0,8).map(b=><li key={b.id}><button type="button" className="text-button" disabled={b.status==='undone'} onClick={()=>onOpen(b.id)}>{workspace.sources.find(s=>s.id===b.sourceId)?.title.slice(0,60)??'通知'}<small>{b.status==='undone'?'已撤销':`${b.items.filter(i=>[...workspace.tasks,...workspace.events].some(e=>e.id===i.id)).length} 项`}</small></button>{b.status==='active'&&<button className="text-button" type="button" onClick={()=>{setError('');void onUndo(b.id).catch(()=>setError('未能撤销，原有内容保留。请重试。'))}}>撤销</button>}</li>)}</ul></section>
}
