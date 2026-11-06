import {useMemo,useRef,useState} from 'react'
import {CalendarDays,CheckCircle2,Circle,Clock3,MapPin} from 'lucide-react'
import type {Event,Task} from '../types'
import {sortTimeline,timelineDate,timelineGroupLabel} from '../lib/flowTimelineDates'
import {flowEventDate,flowTaskDate,planAfterDeadline,taskRelativeTimeHint} from '../lib/flowPresentation'
import {eventDescriptionSections,eventDurationLabel} from '../lib/eventPresentation'
import {materialSummary} from '../lib/materialPresentation'
import {directCardTitle,visibleDirectTags} from '../lib/directCardPresentation'
import {suggestedTaskDuration} from '../lib/taskDurationSuggestion'
import {formatDuration} from '../lib/taskLogic'
import {TaskScheduleButton} from './TaskScheduleButton'
import {TextWithLinks} from './TextWithLinks'
import {taskPublicSummary} from '../lib/taskContentPresentation'
import {sourceWindowActive} from '../lib/sourceWindowActive'
import {MaterialFactsList} from './MaterialFactsList'
import {linearTaskWorkflows} from '../lib/taskWorkflow'
import {isEventInNextThreeDays} from '../lib/upcomingEvent'
import {eventTimingState,localDateKey} from '../lib/calendar'
import {isDateOnly} from '../lib/timeSemantics'
import {useCurrentTime} from '../lib/useCurrentTime'
import './FlowTimeline.css'

type Entry={kind:'task';task:Task;date:string;linked?:Event;reason?:string;alternatives?:Task[];steps?:Task[]}|{kind:'event';event:Event;date:string}|{kind:'day';day:string;events:Event[];date:string}
interface Props {tasks:Task[];allTasks?:Task[];events:Event[];deferred:{task:Task;reason:string}[];linked:Readonly<Record<string,Event>>;eventTimeHints:Readonly<Record<string,string>>;channels:Readonly<Record<string,string[]>>;highlightIds:readonly string[];timeZone?:string;onOpenTask:(task:Task)=>void;onOpenEvent?:(event:Event)=>void;onComplete:(id:string)=>void;onSetEventCompletion?:(id:string,completed:boolean)=>Promise<void>;onSchedule?:(id:string,date:string)=>Promise<void>;onSelectChoice?:(id:string,expectedSelected:string|null)=>Promise<void>}
const key=(entry:Entry)=>`${entry.kind}:${entry.kind==='task'?entry.task.id:entry.kind==='event'?entry.event.id:entry.day}`

export function FlowTimeline({tasks,allTasks,events,deferred,linked,eventTimeHints,channels,highlightIds,timeZone='Asia/Shanghai',onOpenTask,onOpenEvent,onComplete,onSetEventCompletion,onSchedule,onSelectChoice}:Props){
 const [chosen,setChosen]=useState<{id:string;batch:string}>({id:'',batch:''})
 const clock=useCurrentTime().getTime()
 const [choiceBusy,setChoiceBusy]=useState(false),[choiceError,setChoiceError]=useState('')
 const [eventBusy,setEventBusy]=useState(''),[eventError,setEventError]=useState('')
 const updateEvent=async(id:string,completed:boolean)=>{if(!onSetEventCompletion||eventBusy)return;setEventBusy(id);setEventError('');try{await onSetEventCompletion(id,completed)}catch(error){setEventError(error instanceof Error?error.message:'日程状态未保存，请重试。')}finally{setEventBusy('')}}
 const detailRef=useRef<HTMLElement>(null)
 const items=useMemo<Entry[]>(()=>{
   const now=new Date(clock)
   const taskDate=(task:Task)=>timelineDate([task.plannedStart||task.directDate,task.deadline,sourceWindowActive(task,now)?now.toISOString():task.sourceWindowEnd,linked[task.id]?.startAt],timeZone)
   const visibleIds=new Set([...tasks.map(task=>task.id),...deferred.map(({task})=>task.id)])
   const workflows=linearTaskWorkflows(allTasks??[...tasks,...deferred.map(({task})=>task)],visibleIds,new Set(Object.keys(linked)),now)
   const workflowByTask=new Map(workflows.flatMap(steps=>steps.map(task=>[task.id,steps] as const)))
   const seen=new Set<string>(),seenWorkflows=new Set<string>(),taskEntries:Entry[]=[],waitingEntries:Entry[]=[]
   const workflowEntry=(steps:Task[],reason?:string):Entry=>{const next=steps.find(step=>step.status!=='已完成'&&tasks.some(task=>task.id===step.id))??steps.find(step=>step.status!=='已完成');return {kind:'task',task:steps[0],steps,reason,date:reason||!next?'':taskDate(next)}}
   for(const task of tasks){
     const steps=workflowByTask.get(task.id)
     if(steps){if(!seenWorkflows.has(steps[0].id)){seenWorkflows.add(steps[0].id);taskEntries.push(workflowEntry(steps))}continue}
     const group=task.sourceChoice,options=group?.optionTaskIds.map(id=>tasks.find(value=>value.id===id)).filter((value):value is Task=>Boolean(value))??[]
     if(group&&options.length>=2&&options.length<=6&&options.length===group.optionTaskIds.length&&options.every(option=>option.sourceChoice?.id===group.id&&!linked[option.id])){
       if(seen.has(group.id))continue
       seen.add(group.id);taskEntries.push({kind:'task',task:options[0],alternatives:options,date:timelineDate(options.map(taskDate),timeZone)})
     }else taskEntries.push({kind:'task',task,linked:linked[task.id],date:taskDate(task)})
   }
   for(const {task,reason} of deferred){
     const steps=workflowByTask.get(task.id)
     if(steps){if(!seenWorkflows.has(steps[0].id)){seenWorkflows.add(steps[0].id);waitingEntries.push(workflowEntry(steps,reason))}continue}
     waitingEntries.push({kind:'task',task,date:'',reason,linked:linked[task.id]})
   }
   const eventRows=sortTimeline(events.map(event=>({event,date:event.startAt&&eventTimingState(event,now,timeZone)==='ongoing'&&localDateKey(event.startAt,timeZone)<localDateKey(now,timeZone)?now.toISOString():timelineDate([event.startAt],timeZone)})),timeZone)
   const byDay=new Map<string,typeof eventRows>()
   for(const row of eventRows){
     // An unknown date cannot establish a same-day relationship.
     if(!row.date)continue
     const day=localDateKey(row.date,timeZone),same=byDay.get(day)??[]
     same.push(row);byDay.set(day,same)
   }
   const emitted=new Set<string>(),eventEntries:Entry[]=[]
   for(const row of eventRows){
     const day=row.date?localDateKey(row.date,timeZone):'',same=day?byDay.get(day):undefined
     if(same&&same.length>1){
       if(!emitted.has(day)){emitted.add(day);eventEntries.push({kind:'day',day,date:same[0].date,events:same.map(value=>value.event)})}
     }else eventEntries.push({kind:'event',...row})
   }
   const active:Entry[]=[...taskEntries,...eventEntries]
   return [...sortTimeline(active,timeZone),...waitingEntries]
 },[tasks,allTasks,events,deferred,linked,clock,timeZone])
 const highlightKey=highlightIds.join('|')
 const select=(item:Entry)=>{setChosen({id:key(item),batch:highlightKey});if(window.matchMedia('(max-width: 700px)').matches)requestAnimationFrame(()=>detailRef.current?.scrollIntoView({block:'nearest',behavior:'instant'}))}
 // A new batch gets attention unless a dialog is open. User selection belongs
 // to the current batch and remains stable through unrelated re-renders.
 const editing=typeof document!=='undefined'&&Boolean(document.querySelector('[role=dialog],dialog[open]'))
 const batchChanged=Boolean(highlightKey&&chosen.batch!==highlightKey&&!editing)
 const chosenItem=items.find(item=>key(item)===chosen.id)
 const newest=items.find(item=>item.kind==='task'?(item.steps??item.alternatives??[item.task]).some(task=>highlightIds.includes(task.id)):item.kind==='day'?item.events.some(event=>highlightIds.includes(event.id)):highlightIds.includes(item.event.id))
 const selected=(batchChanged?newest:chosenItem)??chosenItem??(editing?items[0]:newest)??items[0]
 let previous=''
 return <div className="flow-timeline-layout"><div className="flow-timeline-list" aria-label="按时间排列的待办和日程"><h2>待办与日程 <small>{items.length} 项</small></h2>{eventError&&<p role="alert">{eventError}</p>}{items.map(item=>{
   const label=item.kind==='task'&&item.reason?'稍后再做':timelineGroupLabel(item.date,timeZone), show=label!==previous;previous=label
   const currentStep=item.kind==='task'&&item.steps?item.steps.find(step=>step.status!=='已完成'&&tasks.some(task=>task.id===step.id)):undefined
   const id=item.kind==='task'?item.task.id:item.kind==='event'?item.event.id:item.day,title=item.kind==='task'?(item.alternatives?`任选一项：${item.alternatives.map(task=>task.title).join(' / ')}`:item.steps&&currentStep?`下一步 · ${currentStep.title}`:item.task.title):item.kind==='day'?`当天 ${item.events.length} 项日程`:item.event.title
   const taskTime=item.kind==='task'?flowTaskDate(currentStep??item.task,timeZone):''
   const linkedTime=item.kind==='task'&&item.linked?flowEventDate(item.linked,eventTimeHints[item.linked.id],timeZone):''
   const time=item.kind==='task'?(item.alternatives?'任选一种 · 各自时间见详情':taskTime==='未设日期'&&item.linked?(linkedTime==='时间待定'?'日程时间待定':linkedTime):`${sourceWindowActive(item.task,new Date(clock))?(item.task.sourceWindowChoiceBranch?`方式${item.task.sourceWindowChoiceBranch}办理中 · `:'办理中 · '):''}${taskTime}`):item.kind==='day'?timelineGroupLabel(item.date,timeZone):flowEventDate(item.event,eventTimeHints[id],timeZone)
   const taskDetails=item.kind==='task'?taskPublicSummary(item.task,{channels:channels[id]??[]}):undefined
   const place=item.kind==='event'?item.event.location:item.kind==='day'?undefined:item.alternatives||item.steps?undefined:item.linked?.location||taskDetails?.location||taskDetails?.channels.join('、')
   const duration=item.kind==='task'&&!item.alternatives&&!item.steps?suggestedTaskDuration(item.task):undefined
   const materials=item.kind==='task'&&!item.alternatives&&!item.steps?materialSummary(item.task.materials):''
   const isNew=item.kind==='task'?(item.steps??item.alternatives??[item.task]).some(task=>highlightIds.includes(task.id)):item.kind==='day'?item.events.some(event=>highlightIds.includes(event.id)):highlightIds.includes(id)
   const representedEvents=item.kind==='day'?item.events:item.kind==='event'?[item.event]:item.linked?[item.linked]:[]
   const near=representedEvents.some(event=>isEventInNextThreeDays(event,new Date(clock),timeZone))
   const ongoing=representedEvents.some(event=>Boolean(event.startAt&&!isDateOnly(event.startAt)&&eventTimingState(event,new Date(clock),timeZone)==='ongoing'))
   const displayTime=near&&item.kind==='task'&&item.linked?`日程：${linkedTime}`:time
   return <div key={key(item)}>{show&&<h3 className="flow-timeline-day">{label}</h3>}<div className="flow-timeline-node" {...(item.kind==='task'?{'data-task-id':id}:item.kind==='event'?{'data-event-id':id}:{'data-event-day':id})} data-new={isNew||undefined} data-near-event={near||undefined}>
    <button type="button" className={`flow-timeline-choice ${selected&&key(selected)===key(item)?'is-selected':''}`} aria-current={selected&&key(selected)===key(item)?'true':undefined} onClick={()=>select(item)}><span className="flow-timeline-time"><Clock3 size={15}/>{displayTime}</span>{near&&<span className="flow-near-badge">{ongoing?'进行中':'3天内'}</span>}<strong title={title}>{directCardTitle(title)}</strong>{item.kind==='day'&&item.events.map(event=><span className="flow-timeline-brief" key={event.id}>{flowEventDate(event,eventTimeHints[event.id],timeZone)} · {event.title}{event.location?` · ${event.location}`:''}</span>)}{near&&item.kind==='task'&&item.linked&&taskTime!=='未设日期'&&<span className="flow-timeline-brief">{taskTime}</span>}{item.kind==='task'&&item.steps&&<span className="flow-timeline-brief">{item.steps.length} 个步骤 · 已完成 {item.steps.filter(step=>step.status==='已完成').length}/{item.steps.length}</span>}{place&&<span className="flow-timeline-place"><MapPin size={15}/>{place}</span>}{item.kind==='task'&&item.reason&&<span>{item.reason}</span>}{materials&&<span className="flow-timeline-brief">材料与要求：{materials}</span>}{duration&&<span className="flow-timeline-brief">建议约 {duration}（估计）</span>}</button>
    {item.kind==='task'&&!item.alternatives&&<div className="flow-timeline-row-actions">{item.steps?(currentStep&&<button className="flow-timeline-complete" type="button" onClick={()=>onComplete(currentStep.id)} aria-label={`完成当前步骤：${currentStep.title}`}><Circle size={16}/>完成当前步骤</button>):<button className="flow-timeline-complete" type="button" disabled={item.task.status==='已完成'} onClick={()=>onComplete(item.task.id)} aria-label={`${item.task.status==='已完成'?'已完成':'完成'}${item.task.title}`}><Circle size={16}/>完成</button>}{item.linked&&onOpenEvent&&<button className="text-button" type="button" data-event-id={item.linked.id} onClick={()=>onOpenEvent(item.linked!)} aria-label={`查看${item.linked.title}日程`}>日程</button>}</div>}
    {item.kind==='event'&&onSetEventCompletion&&<div className="flow-timeline-row-actions"><button className="flow-timeline-complete" type="button" disabled={Boolean(eventBusy)} onClick={()=>void updateEvent(item.event.id,true)} aria-label={`完成${item.event.title}`}><Circle size={16}/>{eventBusy===item.event.id?'保存中…':'完成'}</button></div>}
   </div></div>
 })}</div>
 <aside ref={detailRef} onClickCapture={()=>{if(selected)setChosen({id:key(selected),batch:highlightKey})}} className="flow-timeline-detail" aria-label="事项详情" aria-live="polite">
  {selected&&(selected.kind==='task'?(selected.steps?<>
    <div className="timeline-kind">关联步骤 · 已完成 {selected.steps.filter(task=>task.status==='已完成').length}/{selected.steps.length}</div>
    <p className="flow-workflow-intro">按顺序完成，每一步的时间和材料单独保留。</p>
    {selected.steps.map((task,index)=><section key={task.id} className="flow-workflow-step" data-workflow-step-id={task.id}>
      <div className="flow-workflow-step-number">第 {index+1} 步</div>
      <TaskFacts timeZone={timeZone} task={task} channels={channels[task.id]??[]} canComplete={tasks.some(ready=>ready.id===task.id)} blockedReason="等待前一步完成" onOpenTask={onOpenTask} onComplete={onComplete} onSchedule={onSchedule}/>
    </section>)}
  </>:selected.alternatives?<><p>以下方式任选一项完成</p>{choiceError&&<p role="alert" className="inline-error">{choiceError}</p>}{selected.alternatives.map(task=><section key={task.id} className="flow-choice-option">{onSelectChoice&&<button type="button" className="secondary-button" aria-pressed={task.sourceChoice?.selectedTaskId===task.id} disabled={choiceBusy} onClick={()=>{setChoiceBusy(true);setChoiceError('');void onSelectChoice(task.id,task.sourceChoice?.selectedTaskId??null).catch(error=>setChoiceError(error instanceof Error?error.message:'选择未能保存，请重试。')).finally(()=>setChoiceBusy(false))}}>{task.sourceChoice?.selectedTaskId===task.id?'已选择此方式':'选择此方式'}</button>}<TaskFacts timeZone={timeZone} task={task} canComplete={!task.sourceChoice?.selectedTaskId||task.sourceChoice.selectedTaskId===task.id} channels={channels[task.id]??[]} onOpenTask={onOpenTask} onComplete={onComplete} onSchedule={onSchedule}/></section>)}</>:<TaskFacts timeZone={timeZone} task={selected.task} linked={selected.linked} linkedHint={selected.linked?eventTimeHints[selected.linked.id]:undefined} channels={channels[selected.task.id]??[]} onOpenTask={onOpenTask} onOpenEvent={onOpenEvent} onComplete={onComplete} onSchedule={onSchedule}/>):selected.kind==='day'?<><div className="timeline-kind">当天的日程 · 各自完成</div>{selected.events.map(event=><section className="flow-day-event-detail" key={event.id} data-grouped-event-id={event.id}><EventFacts event={event} hint={eventTimeHints[event.id]} near={isEventInNextThreeDays(event,new Date(clock),timeZone)} timeZone={timeZone} now={new Date(clock)} onOpenEvent={onOpenEvent} onComplete={onSetEventCompletion?()=>void updateEvent(event.id,true):undefined} busy={Boolean(eventBusy)}/></section>)}</>:<EventFacts event={selected.event} hint={eventTimeHints[selected.event.id]} near={isEventInNextThreeDays(selected.event,new Date(clock),timeZone)} timeZone={timeZone} now={new Date(clock)} onOpenEvent={onOpenEvent} onComplete={onSetEventCompletion?()=>void updateEvent(selected.event.id,true):undefined} busy={Boolean(eventBusy)}/>)}</aside></div>
}
function TaskFacts({task,linked,linkedHint,channels,timeZone,onOpenTask,onOpenEvent,onComplete,onSchedule,canComplete=true,blockedReason}:{task:Task;linked?:Event;linkedHint?:string;channels:string[];timeZone:string;onOpenTask:(task:Task)=>void;onOpenEvent?:(event:Event)=>void;onComplete:(id:string)=>void;onSchedule?:Props['onSchedule'];canComplete?:boolean;blockedReason?:string}){
 const {description:publicDescription,location,channels:visibleChannels}=taskPublicSummary(task,{dateLabel:flowTaskDate(task,timeZone),channels})
 const hint=suggestedTaskDuration(task),relative=taskRelativeTimeHint(task),linkedSections=linked?eventDescriptionSections(linked.description):[],linkedDuration=linked?eventDurationLabel(linked):undefined
 const linkedNear=Boolean(linked&&isEventInNextThreeDays(linked,new Date(),timeZone))
 return <><div className="timeline-kind">待办详情</div><h2>{task.title}</h2><div className="timeline-key">
  {(flowTaskDate(task,timeZone)!=='未设日期'||!linked)&&<p><Clock3 size={16}/><strong>{flowTaskDate(task,timeZone)}</strong></p>}
  {linked&&<p className="timeline-linked-event" data-near-event={linkedNear||undefined}><CalendarDays size={17}/><span><small>日程时间</small><strong>{flowEventDate(linked,linkedHint,timeZone)}</strong></span></p>}
  {linked?.location&&<p className="timeline-linked-event" data-near-event={linkedNear||undefined}><MapPin size={17}/><span><small>地点</small><strong>{linked.location}</strong></span></p>}
  {location&&location!==linked?.location&&<p><MapPin size={16}/><strong>{location}</strong></p>}
  {visibleChannels.length>0&&<p><strong>提交：<TextWithLinks text={visibleChannels.join('、')}/></strong></p>}{linkedDuration&&<p><Clock3 size={16}/>{linkedDuration}</p>}
 </div>{planAfterDeadline(task.plannedStart||task.directDate,task.deadline,timeZone)&&<p className="flow-deadline-warning">计划晚于截止</p>}{visibleDirectTags(task.directTags,flowTaskDate(task,timeZone),task.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}{relative&&<p>{relative}</p>}{publicDescription&&<section><h3>内容与须知</h3><p><TextWithLinks text={publicDescription}/></p></section>}{linkedSections.filter(section=>!publicDescription.includes(section.content)).map((section,index)=><section key={`linked-${section.label}-${index}`}><h3>{section.label}</h3><p><TextWithLinks text={section.content}/></p></section>)}{task.materials.length>0&&<section><h3>材料与要求</h3><MaterialFactsList materials={task.materials}/></section>}{task.estimatedMinutesKnown&&task.estimatedMinutes>0?<p>预计耗时 {formatDuration(task.estimatedMinutes)}</p>:hint?<p>建议约 {hint}（可修改的估计）</p>:null}<div className="timeline-actions"><button type="button" className="primary-button" disabled={task.status==='已完成'||!canComplete} onClick={()=>onComplete(task.id)}>{task.status==='已完成'?<CheckCircle2 size={17}/>:<Circle size={17}/>} {task.status==='已完成'?'已完成':canComplete?'完成':blockedReason??'先选择此方式'}</button>{onSchedule&&task.status!=='已完成'&&<TaskScheduleButton task={task} onSchedule={onSchedule}/>}<button type="button" className="secondary-button" onClick={()=>onOpenTask(task)}>编辑与更多</button>{linked&&onOpenEvent&&<button type="button" className="text-button" onClick={()=>onOpenEvent(linked)}>查看关联日程</button>}</div></>
}
function EventFacts({event,hint,near,timeZone,now,onOpenEvent,onComplete,busy}:{event:Event;hint?:string;near:boolean;timeZone:string;now:Date;onOpenEvent?:Props['onOpenEvent'];onComplete?:()=>void;busy:boolean}){
 const sections=eventDescriptionSections(event.description).filter(section=>!(section.label==='时间说明'&&section.content===flowEventDate(event,hint,timeZone))),duration=eventDurationLabel(event)
  return <><div className="timeline-kind">日程详情 {near&&<span className="flow-near-badge">{event.startAt&&!isDateOnly(event.startAt)&&eventTimingState(event,now,timeZone)==='ongoing'?'进行中':'3天内'}</span>}</div><h2>{event.title}</h2><div className="timeline-key timeline-event-key" data-near-event={near||undefined}><p><CalendarDays size={18}/><span><small>时间</small><strong>{flowEventDate(event,hint,timeZone)}</strong></span></p>{event.location&&<p><MapPin size={18}/><span><small>地点</small><strong>{event.location}</strong></span></p>}{duration&&<p><Clock3 size={16}/>{duration}</p>}</div>{visibleDirectTags(event.directTags,flowEventDate(event,hint,timeZone),event.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}{sections.map((section,index)=><section key={`${section.label}-${index}`}><h3>{section.label}</h3><p><TextWithLinks text={section.content}/></p></section>)}<div className="timeline-actions">{onComplete&&<button type="button" className="primary-button" disabled={busy} onClick={onComplete}><Circle size={17}/>{busy?'保存中…':'完成'}</button>}{onOpenEvent&&<button type="button" className="secondary-button" onClick={()=>onOpenEvent(event)}>编辑与更多</button>}</div></>
}
