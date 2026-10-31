import {useMemo,useRef,useState} from 'react'
import {CalendarDays,CheckCircle2,Circle,Clock3,MapPin} from 'lucide-react'
import type {Event,Task} from '../types'
import {sortTimeline,timelineDate,timelineGroupLabel} from '../lib/flowTimelineDates'
import {flowEventDate,flowTaskDate,planAfterDeadline,taskRelativeTimeHint} from '../lib/flowPresentation'
import {eventDescriptionSections,eventDurationLabel} from '../lib/eventPresentation'
import {displayMaterialRequirement,materialSummary} from '../lib/materialPresentation'
import {directCardTitle,visibleDirectTags} from '../lib/directCardPresentation'
import {suggestedTaskDuration} from '../lib/taskDurationSuggestion'
import {formatDuration} from '../lib/taskLogic'
import {TaskScheduleButton} from './TaskScheduleButton'
import {TextWithLinks} from './TextWithLinks'
import './FlowTimeline.css'

type Entry={kind:'task';task:Task;date:string;linked?:Event;reason?:string}|{kind:'event';event:Event;date:string}
interface Props {tasks:Task[];events:Event[];deferred:{task:Task;reason:string}[];linked:Readonly<Record<string,Event>>;eventTimeHints:Readonly<Record<string,string>>;channels:Readonly<Record<string,string[]>>;highlightIds:readonly string[];onOpenTask:(task:Task)=>void;onOpenEvent?:(event:Event)=>void;onComplete:(id:string)=>void;onSchedule?:(id:string,date:string)=>Promise<void>}
const key=(entry:Entry)=>`${entry.kind}:${entry.kind==='task'?entry.task.id:entry.event.id}`

export function FlowTimeline({tasks,events,deferred,linked,eventTimeHints,channels,highlightIds,onOpenTask,onOpenEvent,onComplete,onSchedule}:Props){
 const [chosen,setChosen]=useState<{id:string;batch:string}>({id:'',batch:''})
 const detailRef=useRef<HTMLElement>(null)
 const items=useMemo<Entry[]>(()=>{
   const active:Entry[]=[...tasks.map(task=>({kind:'task' as const,task,linked:linked[task.id],date:timelineDate([task.plannedStart||task.directDate,task.deadline,task.sourceWindowEnd,linked[task.id]?.startAt])})),...events.map(event=>({kind:'event' as const,event,date:timelineDate([event.startAt])}))]
   return [...sortTimeline(active),...deferred.map(({task,reason})=>({kind:'task' as const,task,date:'',reason,linked:linked[task.id]}))]
 },[tasks,events,deferred,linked])
 const highlightKey=highlightIds.join('|')
 const select=(item:Entry)=>{setChosen({id:key(item),batch:highlightKey});if(window.matchMedia('(max-width: 700px)').matches)requestAnimationFrame(()=>detailRef.current?.scrollIntoView({block:'nearest',behavior:'instant'}))}
 // A new batch gets attention unless a dialog is open. User selection belongs
 // to the current batch and remains stable through unrelated re-renders.
 const editing=typeof document!=='undefined'&&Boolean(document.querySelector('[role=dialog],dialog[open]'))
 const batchChanged=Boolean(highlightKey&&chosen.batch!==highlightKey&&!editing)
 const chosenItem=items.find(item=>key(item)===chosen.id)
 const newest=items.find(item=>highlightIds.includes(item.kind==='task'?item.task.id:item.event.id))
 const selected=(batchChanged?newest:chosenItem)??chosenItem??(editing?items[0]:newest)??items[0]
 let previous=''
 return <div className="flow-timeline-layout"><div className="flow-timeline-list" aria-label="按时间排列的待办和日程"><h2>待办与日程 <small>{items.length} 项</small></h2>{items.map(item=>{
   const label=item.kind==='task'&&item.reason?'稍后再做':timelineGroupLabel(item.date), show=label!==previous;previous=label
   const id=item.kind==='task'?item.task.id:item.event.id,title=item.kind==='task'?item.task.title:item.event.title
   const taskTime=item.kind==='task'?flowTaskDate(item.task):''
   const linkedTime=item.kind==='task'&&item.linked?flowEventDate(item.linked,eventTimeHints[item.linked.id]):''
   const time=item.kind==='task'?(taskTime==='未设日期'&&item.linked?(linkedTime==='时间待定'?'日程时间待定':linkedTime):taskTime):flowEventDate(item.event,eventTimeHints[id])
   const place=item.kind==='event'?item.event.location:item.linked?.location||channels[id]?.join('、')
   const duration=item.kind==='task'?suggestedTaskDuration(item.task):undefined
   return <div key={key(item)}>{show&&<h3 className="flow-timeline-day">{label}</h3>}<div className="flow-timeline-node" {...(item.kind==='task'?{'data-task-id':id}:{'data-event-id':id})} data-new={highlightIds.includes(id)||undefined}><button type="button" className={`flow-timeline-choice ${selected&&key(selected)===key(item)?'is-selected':''}`} aria-current={selected&&key(selected)===key(item)?'true':undefined} onClick={()=>select(item)}><span className="flow-timeline-time"><Clock3 size={15}/>{time}</span><strong title={title}>{directCardTitle(title)}</strong>{place&&<span className="flow-timeline-place"><MapPin size={15}/>{place}</span>}{item.kind==='task'&&item.reason&&<span>{item.reason}</span>}{item.kind==='task'&&item.task.materials.length>0&&<span className="flow-timeline-brief">材料与要求：{materialSummary(item.task.materials)}</span>}{duration&&<span className="flow-timeline-brief">建议约 {duration}（估计）</span>}</button>{item.kind==='task'&&<div className="flow-timeline-row-actions"><button className="flow-timeline-complete" type="button" disabled={item.task.status==='已完成'} onClick={()=>onComplete(item.task.id)} aria-label={`${item.task.status==='已完成'?'已完成':'完成'}${item.task.title}`}><Circle size={16}/>完成</button>{item.linked&&onOpenEvent&&<button className="text-button" type="button" data-event-id={item.linked.id} onClick={()=>onOpenEvent(item.linked!)} aria-label={`查看${item.linked.title}日程`}>日程</button>}</div>}</div></div>
 })}</div><aside ref={detailRef} onClickCapture={()=>{if(selected)setChosen({id:key(selected),batch:highlightKey})}} className="flow-timeline-detail" aria-label="事项详情" aria-live="polite">{selected&&(selected.kind==='task'?<TaskFacts task={selected.task} linked={selected.linked} linkedHint={selected.linked?eventTimeHints[selected.linked.id]:undefined} channels={channels[selected.task.id]??[]} onOpenTask={onOpenTask} onOpenEvent={onOpenEvent} onComplete={onComplete} onSchedule={onSchedule}/>:<EventFacts event={selected.event} hint={eventTimeHints[selected.event.id]} onOpenEvent={onOpenEvent}/>)}</aside></div>
}
function TaskFacts({task,linked,linkedHint,channels,onOpenTask,onOpenEvent,onComplete,onSchedule}:{task:Task;linked?:Event;linkedHint?:string;channels:string[];onOpenTask:(task:Task)=>void;onOpenEvent?:(event:Event)=>void;onComplete:(id:string)=>void;onSchedule?:Props['onSchedule']}){
 const hint=suggestedTaskDuration(task),relative=taskRelativeTimeHint(task),linkedSections=linked?eventDescriptionSections(linked.description):[],linkedDuration=linked?eventDurationLabel(linked):undefined
 return <><div className="timeline-kind">待办详情</div><h2>{task.title}</h2><div className="timeline-key">{(flowTaskDate(task)!=='未设日期'||!linked)&&<p><Clock3 size={16}/><strong>{flowTaskDate(task)}</strong></p>}{linked&&<p><CalendarDays size={16}/><strong>{flowEventDate(linked,linkedHint)}</strong></p>}{linked?.location&&<p><MapPin size={16}/><strong>{linked.location}</strong></p>}{channels.length>0&&<p><strong>提交：{channels.join('、')}</strong></p>}{linkedDuration&&<p><Clock3 size={16}/>{linkedDuration}</p>}</div>{planAfterDeadline(task.plannedStart||task.directDate,task.deadline)&&<p className="flow-deadline-warning">计划晚于截止</p>}{visibleDirectTags(task.directTags,flowTaskDate(task),task.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}{relative&&<p>{relative}</p>}{task.description&&<section><h3>内容与须知</h3><p><TextWithLinks text={task.description}/></p></section>}{linkedSections.filter(section=>!task.description.includes(section.content)).map((section,index)=><section key={`linked-${section.label}-${index}`}><h3>{section.label}</h3><p><TextWithLinks text={section.content}/></p></section>)}{task.materials.length>0&&<section><h3>材料与要求</h3><ul>{task.materials.map(m=><li key={m.id}><strong>{m.name}</strong>{m.quantity!=null&&<span> · 数量：{m.quantity}</span>}{[...(m.formatRequirements??[]),...(m.namingRequirements??[])].map((v,i)=><span key={i}> · {displayMaterialRequirement(v)}</span>)}</li>)}</ul></section>}{task.estimatedMinutesKnown&&task.estimatedMinutes>0?<p>预计耗时 {formatDuration(task.estimatedMinutes)}</p>:hint?<p>建议约 {hint}（可修改的估计）</p>:null}<div className="timeline-actions"><button type="button" className="primary-button" disabled={task.status==='已完成'} onClick={()=>onComplete(task.id)}>{task.status==='已完成'?<CheckCircle2 size={17}/>:<Circle size={17}/>} {task.status==='已完成'?'已完成':'完成'}</button>{onSchedule&&task.status!=='已完成'&&<TaskScheduleButton task={task} onSchedule={onSchedule}/>}<button type="button" className="secondary-button" onClick={()=>onOpenTask(task)}>编辑与更多</button>{linked&&onOpenEvent&&<button type="button" className="text-button" onClick={()=>onOpenEvent(linked)}>查看关联日程</button>}</div></>
}
function EventFacts({event,hint,onOpenEvent}:{event:Event;hint?:string;onOpenEvent?:Props['onOpenEvent']}){
 const sections=eventDescriptionSections(event.description),duration=eventDurationLabel(event)
 return <><div className="timeline-kind">日程详情</div><h2>{event.title}</h2><div className="timeline-key"><p><CalendarDays size={16}/><strong>{flowEventDate(event,hint)}</strong></p>{event.location&&<p><MapPin size={16}/><strong>{event.location}</strong></p>}{duration&&<p><Clock3 size={16}/>{duration}</p>}</div>{visibleDirectTags(event.directTags,flowEventDate(event,hint),event.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}{sections.map((section,index)=><section key={`${section.label}-${index}`}><h3>{section.label}</h3><p><TextWithLinks text={section.content}/></p></section>)}{onOpenEvent&&<div className="timeline-actions"><button type="button" className="secondary-button" onClick={()=>onOpenEvent(event)}>编辑与更多</button></div>}</>
}
