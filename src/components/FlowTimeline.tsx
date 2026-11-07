import {useMemo,useRef,useState,type ReactNode} from 'react'
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
import {pendingGroupedTask} from '../lib/homeFlow'
import './FlowTimeline.css'

type Entry={kind:'task';task:Task;date:string;linked?:Event;reason?:string;alternatives?:Task[];steps?:Task[]}|{kind:'goal';id:string;title:string;members:Task[];date:string;reason?:string}|{kind:'event';event:Event;date:string}|{kind:'day';day:string;events:Event[];date:string}
interface Props {tasks:Task[];allTasks?:Task[];events:Event[];eventActions?:Readonly<Record<string,Task[]>>;eventActionCandidates?:Readonly<Record<string,Task[]>>;deferred:{task:Task;reason:string}[];linked:Readonly<Record<string,Event>>;eventTimeHints:Readonly<Record<string,string>>;channels:Readonly<Record<string,string[]>>;highlightIds:readonly string[];timeZone?:string;onOpenTask:(task:Task)=>void;onOpenEvent?:(event:Event)=>void;onComplete:(id:string)=>void;onRestoreTask?:(id:string)=>void;onSetEventCompletion?:(id:string,completed:boolean)=>Promise<void>;onSetEventTaskLink?:(eventId:string,taskIds:string[],linked:boolean)=>Promise<void>;onSchedule?:(id:string,date:string)=>Promise<void>;onSelectChoice?:(id:string,expectedSelected:string|null)=>Promise<void>}
const key=(entry:Entry)=>`${entry.kind}:${entry.kind==='task'?entry.task.id:entry.kind==='goal'?entry.id:entry.kind==='event'?entry.event.id:entry.day}`

export function FlowTimeline({tasks,allTasks,events,eventActions={},eventActionCandidates={},deferred,linked,eventTimeHints,channels,highlightIds,timeZone='Asia/Shanghai',onOpenTask,onOpenEvent,onComplete,onRestoreTask,onSetEventCompletion,onSetEventTaskLink,onSchedule,onSelectChoice}:Props){
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
   const all=allTasks??[...tasks,...deferred.map(({task})=>task)]
   const eventIds=new Set(events.map(event=>event.id))
   const eventTaskIds=new Set(Object.entries(eventActions).filter(([id])=>eventIds.has(id)).flatMap(([,members])=>members.map(task=>task.id)))
   const goals=new Map<string,{title:string;members:Task[]}>()
   for(const task of all){
     const goal=task.sourceGoal
     if(!goal||goals.has(goal.id))continue
     const members=goal.taskIds.map(id=>all.find(value=>value.id===id)).filter((value):value is Task=>Boolean(value))
     if(members.length!==goal.taskIds.length||members.length<2||members.some(value=>value.sourceGoal?.id!==goal.id||eventTaskIds.has(value.id)||linked[value.id]))continue
     goals.set(goal.id,{title:goal.title,members})
   }
   const goalByTask=new Map([...goals.entries()].flatMap(([id,goal])=>goal.members.map(task=>[task.id,{id,...goal}] as const)))
   const workflows=linearTaskWorkflows(all,visibleIds,new Set([...Object.keys(linked),...eventTaskIds,...goalByTask.keys()]),now)
   const workflowByTask=new Map(workflows.flatMap(steps=>steps.map(task=>[task.id,steps] as const)))
   const seen=new Set<string>(),seenWorkflows=new Set<string>(),seenGoals=new Set<string>(),taskEntries:Entry[]=[],waitingEntries:Entry[]=[]
   const workflowEntry=(steps:Task[],reason?:string):Entry=>{const next=steps.find(step=>step.status!=='已完成'&&tasks.some(task=>task.id===step.id))??steps.find(step=>step.status!=='已完成');return {kind:'task',task:steps[0],steps,reason,date:reason||!next?'':taskDate(next)}}
   const goalEntry=(goal:{id:string;title:string;members:Task[]},reason?:string):Entry=>({kind:'goal',...goal,reason,date:timelineDate(goal.members.filter(task=>pendingGroupedTask(task,goal.members)).map(taskDate),timeZone)})
   for(const task of tasks){
     if(eventTaskIds.has(task.id))continue
     const goal=goalByTask.get(task.id)
     if(goal){if(!seenGoals.has(goal.id)){seenGoals.add(goal.id);taskEntries.push(goalEntry(goal))}continue}
     const steps=workflowByTask.get(task.id)
     if(steps){if(!seenWorkflows.has(steps[0].id)){seenWorkflows.add(steps[0].id);taskEntries.push(workflowEntry(steps))}continue}
     const group=task.sourceChoice,options=group?.optionTaskIds.map(id=>tasks.find(value=>value.id===id)).filter((value):value is Task=>Boolean(value))??[]
     if(group&&options.length>=2&&options.length<=6&&options.length===group.optionTaskIds.length&&options.every(option=>option.sourceChoice?.id===group.id&&!linked[option.id])){
       if(seen.has(group.id))continue
       seen.add(group.id);taskEntries.push({kind:'task',task:options[0],alternatives:options,date:timelineDate(options.map(taskDate),timeZone)})
     }else taskEntries.push({kind:'task',task,linked:linked[task.id],date:taskDate(task)})
   }
   for(const {task,reason} of deferred){
     if(eventTaskIds.has(task.id))continue
     const goal=goalByTask.get(task.id)
     if(goal){if(!seenGoals.has(goal.id)){seenGoals.add(goal.id);waitingEntries.push(goalEntry(goal,reason))}continue}
     const steps=workflowByTask.get(task.id)
     if(steps){if(!seenWorkflows.has(steps[0].id)){seenWorkflows.add(steps[0].id);waitingEntries.push(workflowEntry(steps,reason))}continue}
     waitingEntries.push({kind:'task',task,date:'',reason,linked:linked[task.id]})
   }
   const eventRows=sortTimeline(events.map(event=>({event,date:timelineDate([...(eventActions[event.id]??[]).filter(task=>pendingGroupedTask(task,eventActions[event.id])).map(taskDate),event.personalCompleted?'':event.startAt&&eventTimingState(event,now,timeZone)==='ongoing'&&localDateKey(event.startAt,timeZone)<localDateKey(now,timeZone)?now.toISOString():event.startAt],timeZone)})),timeZone)
   const byDay=new Map<string,typeof eventRows>()
   for(const row of eventRows){
     // An unknown date cannot establish a same-day relationship.
     if(!row.event.startAt)continue
     const day=localDateKey(row.event.startAt,timeZone),same=byDay.get(day)??[]
     same.push(row);byDay.set(day,same)
   }
   const emitted=new Set<string>(),eventEntries:Entry[]=[]
   for(const row of eventRows){
     const day=row.event.startAt?localDateKey(row.event.startAt,timeZone):'',same=day?byDay.get(day):undefined
     if(same&&same.length>1){
       if(!emitted.has(day)){emitted.add(day);eventEntries.push({kind:'day',day,date:timelineDate(same.map(value=>value.date),timeZone),events:same.map(value=>value.event).sort((a,b)=>(a.startAt??'').localeCompare(b.startAt??''))})}
     }else eventEntries.push({kind:'event',...row})
   }
   const active:Entry[]=[...taskEntries,...eventEntries]
   return [...sortTimeline(active,timeZone),...waitingEntries]
 },[tasks,allTasks,events,eventActions,deferred,linked,clock,timeZone])
 const highlightKey=highlightIds.join('|')
 const select=(item:Entry)=>{setChosen({id:key(item),batch:highlightKey});if(window.matchMedia('(max-width: 700px)').matches)requestAnimationFrame(()=>detailRef.current?.scrollIntoView({block:'nearest',behavior:'instant'}))}
 // A new batch gets attention unless a dialog is open. User selection belongs
 // to the current batch and remains stable through unrelated re-renders.
 const editing=typeof document!=='undefined'&&Boolean(document.querySelector('[role=dialog],dialog[open]'))
 const batchChanged=Boolean(highlightKey&&chosen.batch!==highlightKey&&!editing)
 const chosenItem=items.find(item=>key(item)===chosen.id)
 const newest=items.find(item=>item.kind==='task'?(item.steps??item.alternatives??[item.task]).some(task=>highlightIds.includes(task.id)):item.kind==='goal'?item.members.some(task=>highlightIds.includes(task.id)):item.kind==='day'?item.events.some(event=>highlightIds.includes(event.id)||(eventActions[event.id]??[]).some(task=>highlightIds.includes(task.id))):highlightIds.includes(item.event.id)||(eventActions[item.event.id]??[]).some(task=>highlightIds.includes(task.id)))
 const selected=(batchChanged?newest:chosenItem)??chosenItem??(editing?items[0]:newest)??items[0]
 const related=(members:Task[],eventId?:string)=>members.length?<RelatedTasks members={members} ready={tasks} deferred={deferred} channels={channels} timeZone={timeZone} onOpenTask={onOpenTask} onComplete={onComplete} onRestoreTask={onRestoreTask} onSchedule={onSchedule} onSelectChoice={onSelectChoice} onUnlink={eventId&&onSetEventTaskLink?(ids=>onSetEventTaskLink(eventId,ids,false)):undefined}/>:null
 const eventContents=(event:Event)=><>{related(eventActions[event.id]??[],event.id)}{onSetEventTaskLink&&Boolean(eventActionCandidates[event.id]?.length)&&<EventActionPicker tasks={eventActionCandidates[event.id]} onLink={ids=>onSetEventTaskLink(event.id,ids,true)}/>}</>
 let previous=''
 return <div className="flow-timeline-layout"><div className="flow-timeline-list" aria-label="按时间排列的待办和日程"><h2>待办与日程 <small>{items.length} 项</small></h2>{eventError&&<p role="alert">{eventError}</p>}{items.map(item=>{
   const label=(item.kind==='task'||item.kind==='goal')&&item.reason?'稍后再做':timelineGroupLabel(item.date,timeZone), show=label!==previous;previous=label
   const currentStep=item.kind==='task'&&item.steps?item.steps.find(step=>step.status!=='已完成'&&tasks.some(task=>task.id===step.id)):undefined
   const id=item.kind==='task'?item.task.id:item.kind==='goal'?item.id:item.kind==='event'?item.event.id:item.day,title=item.kind==='task'?(item.alternatives?`任选一项：${item.alternatives.map(task=>task.title).join(' / ')}`:item.steps&&currentStep?`下一步 · ${currentStep.title}`:item.task.title):item.kind==='goal'?item.title:item.kind==='day'?`当天 ${item.events.length} 项日程`:item.event.title
   const taskTime=item.kind==='task'?flowTaskDate(currentStep??item.task,timeZone):''
   const linkedTime=item.kind==='task'&&item.linked?flowEventDate(item.linked,eventTimeHints[item.linked.id],timeZone):''
   const members=item.kind==='goal'?item.members:item.kind==='event'?eventActions[item.event.id]??[]:item.kind==='day'?item.events.flatMap(event=>eventActions[event.id]??[]):[]
   const pending=members.filter(task=>pendingGroupedTask(task,members))
   const pendingCount=new Set(pending.map(task=>task.sourceChoice?`choice:${task.sourceChoice.id}`:`task:${task.id}`)).size
   const nearest=sortTimeline(pending.map(task=>({task,date:timelineDate([task.plannedStart||task.directDate,task.deadline,sourceWindowActive(task,new Date(clock))?new Date(clock).toISOString():task.sourceWindowEnd],timeZone)})),timeZone)[0]
   const time=item.kind==='task'?(item.alternatives?'任选一种 · 各自时间见详情':taskTime==='未设日期'&&item.linked?(linkedTime==='时间待定'?'日程时间待定':linkedTime):`${sourceWindowActive(item.task,new Date(clock))?(item.task.sourceWindowChoiceBranch?`方式${item.task.sourceWindowChoiceBranch}办理中 · `:'办理中 · '):''}${taskTime}`):item.kind==='goal'?(nearest?flowTaskDate(nearest.task,timeZone):'未设日期'):item.kind==='day'?timelineGroupLabel(item.day,timeZone):flowEventDate(item.event,eventTimeHints[id],timeZone)
   const taskDetails=item.kind==='task'?taskPublicSummary(item.task,{channels:channels[id]??[]}):undefined
   const place=item.kind==='event'?item.event.location:item.kind==='day'||item.kind==='goal'?undefined:item.alternatives||item.steps?undefined:item.linked?.location||taskDetails?.location||taskDetails?.channels.join('、')
   const duration=item.kind==='task'&&!item.alternatives&&!item.steps?suggestedTaskDuration(item.task):undefined
   const materials=item.kind==='task'&&!item.alternatives&&!item.steps?materialSummary(item.task.materials):''
   const isNew=item.kind==='task'?(item.steps??item.alternatives??[item.task]).some(task=>highlightIds.includes(task.id)):item.kind==='goal'?item.members.some(task=>highlightIds.includes(task.id)):item.kind==='day'?item.events.some(event=>highlightIds.includes(event.id)):highlightIds.includes(id)||members.some(task=>highlightIds.includes(task.id))
   const representedEvents=item.kind==='day'?item.events:item.kind==='event'?[item.event]:item.kind==='task'&&item.linked?[item.linked]:[]
   const near=representedEvents.some(event=>!event.personalCompleted&&isEventInNextThreeDays(event,new Date(clock),timeZone))
   const ongoing=representedEvents.some(event=>Boolean(!event.personalCompleted&&event.startAt&&!isDateOnly(event.startAt)&&eventTimingState(event,new Date(clock),timeZone)==='ongoing'))
   const displayTime=nearest?.date&&nearest.date===item.date&&(item.kind==='event'||item.kind==='day')?`待办 · ${flowTaskDate(nearest.task,timeZone)}`:near&&item.kind==='task'&&item.linked?`日程：${linkedTime}`:time
   return <div key={key(item)}>{show&&<h3 className="flow-timeline-day">{label}</h3>}<div className="flow-timeline-node" {...(item.kind==='task'?{'data-task-id':id}:item.kind==='goal'?{'data-goal-id':id}:item.kind==='event'?{'data-event-id':id}:{'data-event-day':id})} data-new={isNew||undefined} data-near-event={near||undefined}>
    <button type="button" className={`flow-timeline-choice ${selected&&key(selected)===key(item)?'is-selected':''}`} aria-current={selected&&key(selected)===key(item)?'true':undefined} onClick={()=>select(item)}><span className="flow-timeline-time"><Clock3 size={15}/>{displayTime}</span>{near&&<span className="flow-near-badge">{ongoing?'进行中':'3天内'}</span>}<strong title={title}>{directCardTitle(title)}</strong>{item.kind==='event'&&nearest?.date&&nearest.date===item.date&&<span className="flow-timeline-brief">活动：{flowEventDate(item.event,eventTimeHints[id],timeZone)}</span>}{item.kind==='day'&&item.events.map(event=><span className="flow-timeline-brief" key={event.id}>{flowEventDate(event,eventTimeHints[event.id],timeZone)} · {event.title}{event.location?` · ${event.location}`:''}</span>)}{near&&item.kind==='task'&&item.linked&&taskTime!=='未设日期'&&<span className="flow-timeline-brief">{taskTime}</span>}{item.kind==='task'&&item.steps&&<span className="flow-timeline-brief">{item.steps.length} 个步骤 · 已完成 {item.steps.filter(step=>step.status==='已完成').length}/{item.steps.length}</span>}{pendingCount>0&&<span className="flow-related-badge">需要准备 · {pendingCount} 项</span>}{place&&<span className="flow-timeline-place"><MapPin size={15}/>{place}</span>}{(item.kind==='task'||item.kind==='goal')&&item.reason&&<span>{item.reason}</span>}{materials&&<span className="flow-timeline-brief">材料与要求：{materials}</span>}{duration&&<span className="flow-timeline-brief">建议约 {duration}（估计）</span>}</button>
    {item.kind==='task'&&!item.alternatives&&<div className="flow-timeline-row-actions">{item.steps?(currentStep&&<button className="flow-timeline-complete" type="button" onClick={()=>onComplete(currentStep.id)} aria-label={`完成当前步骤：${currentStep.title}`}><Circle size={16}/>完成当前步骤</button>):<button className="flow-timeline-complete" type="button" disabled={item.task.status==='已完成'} onClick={()=>onComplete(item.task.id)} aria-label={`${item.task.status==='已完成'?'已完成':'完成'}${item.task.title}`}><Circle size={16}/>完成</button>}{item.linked&&onOpenEvent&&<button className="text-button" type="button" data-event-id={item.linked.id} onClick={()=>onOpenEvent(item.linked!)} aria-label={`查看${item.linked.title}日程`}>日程</button>}</div>}
    {item.kind==='event'&&onSetEventCompletion&&!item.event.personalCompleted&&<div className="flow-timeline-row-actions"><button className="flow-timeline-complete" type="button" disabled={Boolean(eventBusy)} onClick={()=>void updateEvent(item.event.id,true)} aria-label={`完成${item.event.title}`}><Circle size={16}/>{eventBusy===item.event.id?'保存中…':'完成'}</button></div>}
   </div></div>
 })}</div>
 <aside ref={detailRef} onClickCapture={()=>{if(selected)setChosen({id:key(selected),batch:highlightKey})}} className="flow-timeline-detail" aria-label="事项详情" aria-live="polite">
  {selected&&(selected.kind==='task'?(selected.steps?<>
    <div className="timeline-kind">关联步骤 · 已完成 {selected.steps.filter(task=>task.status==='已完成').length}/{selected.steps.length}</div>
    <p className="flow-workflow-intro">按顺序完成，每一步的时间和材料单独保留。</p>
    {selected.steps.map((task,index)=><section key={task.id} className="flow-workflow-step" data-workflow-step-id={task.id}>
      <div className="flow-workflow-step-number">第 {index+1} 步</div>
      <TaskFacts timeZone={timeZone} task={task} channels={channels[task.id]??[]} canComplete={tasks.some(ready=>ready.id===task.id)} blockedReason="等待前一步完成" onOpenTask={onOpenTask} onComplete={onComplete} onRestoreTask={onRestoreTask} onSchedule={onSchedule}/>
    </section>)}
  </>:selected.alternatives?<><p>以下方式任选一项完成</p>{choiceError&&<p role="alert" className="inline-error">{choiceError}</p>}{selected.alternatives.map(task=><section key={task.id} className="flow-choice-option">{onSelectChoice&&<button type="button" className="secondary-button" aria-pressed={task.sourceChoice?.selectedTaskId===task.id} disabled={choiceBusy} onClick={()=>{setChoiceBusy(true);setChoiceError('');void onSelectChoice(task.id,task.sourceChoice?.selectedTaskId??null).catch(error=>setChoiceError(error instanceof Error?error.message:'选择未能保存，请重试。')).finally(()=>setChoiceBusy(false))}}>{task.sourceChoice?.selectedTaskId===task.id?'已选择此方式':'选择此方式'}</button>}<TaskFacts timeZone={timeZone} task={task} canComplete={!task.sourceChoice?.selectedTaskId||task.sourceChoice.selectedTaskId===task.id} channels={channels[task.id]??[]} onOpenTask={onOpenTask} onComplete={onComplete} onRestoreTask={onRestoreTask} onSchedule={onSchedule}/></section>)}</>:<TaskFacts timeZone={timeZone} task={selected.task} linked={selected.linked} linkedHint={selected.linked?eventTimeHints[selected.linked.id]:undefined} channels={channels[selected.task.id]??[]} onOpenTask={onOpenTask} onOpenEvent={onOpenEvent} onComplete={onComplete} onRestoreTask={onRestoreTask} onSchedule={onSchedule}/>):selected.kind==='goal'?<><div className="timeline-kind">事项详情</div><h2>{selected.title}</h2>{related(selected.members)}</>:selected.kind==='day'?<><div className="timeline-kind">当天的日程 · 各自完成</div>{selected.events.map(event=><section className="flow-day-event-detail" key={event.id} data-grouped-event-id={event.id}><EventFacts event={event} hint={eventTimeHints[event.id]} near={!event.personalCompleted&&isEventInNextThreeDays(event,new Date(clock),timeZone)} timeZone={timeZone} now={new Date(clock)} onOpenEvent={onOpenEvent} onComplete={onSetEventCompletion?()=>void updateEvent(event.id,!event.personalCompleted):undefined} busy={Boolean(eventBusy)}>{eventContents(event)}</EventFacts></section>)}</>:<EventFacts event={selected.event} hint={eventTimeHints[selected.event.id]} near={!selected.event.personalCompleted&&isEventInNextThreeDays(selected.event,new Date(clock),timeZone)} timeZone={timeZone} now={new Date(clock)} onOpenEvent={onOpenEvent} onComplete={onSetEventCompletion?()=>void updateEvent(selected.event.id,!selected.event.personalCompleted):undefined} busy={Boolean(eventBusy)}>{eventContents(selected.event)}</EventFacts>)}</aside></div>
}
function RelatedTasks({members,ready,deferred,channels,timeZone,onOpenTask,onComplete,onRestoreTask,onSchedule,onSelectChoice,onUnlink}:{members:Task[];ready:Task[];deferred:Props['deferred'];channels:Props['channels'];timeZone:string;onOpenTask:Props['onOpenTask'];onComplete:Props['onComplete'];onRestoreTask?:Props['onRestoreTask'];onSchedule?:Props['onSchedule'];onSelectChoice?:Props['onSelectChoice'];onUnlink?:(ids:string[])=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const seen=new Set<string>()
 const facts=(task:Task,choiceDone=false)=><TaskFacts task={task} channels={channels[task.id]??[]} timeZone={timeZone} onOpenTask={onOpenTask} onComplete={onComplete} onRestoreTask={onRestoreTask} onSchedule={onSchedule} canComplete={ready.some(item=>item.id===task.id)&&!choiceDone} blockedReason={choiceDone?'另一方式已完成':deferred.find(item=>item.task.id===task.id)?.reason??'等待前置事项'}/>
 return <section className="flow-related-actions" aria-label="需要准备"><h3>需要准备</h3>{error&&<p role="alert">{error}</p>}{members.map(task=>{
   const choice=task.sourceChoice,options=choice?.optionTaskIds.map(id=>members.find(item=>item.id===id)).filter((item):item is Task=>Boolean(item))??[]
   if(choice&&options.length===choice.optionTaskIds.length&&options.length>1&&options.every(item=>item.sourceChoice?.id===choice.id)){
     if(seen.has(choice.id))return null
     seen.add(choice.id)
     const completed=options.some(item=>item.status==='已完成')
     return <div className="flow-related-choice" key={choice.id}><strong>以下方式任选一项完成</strong>{onUnlink&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setBusy(true);setError('');void onUnlink(options.map(item=>item.id)).catch(reason=>setError(reason instanceof Error?reason.message:'关联未能保存，请重试。')).finally(()=>setBusy(false))}}>取消关联整组选项</button>}{options.map(option=><section className="flow-related-task" key={option.id} data-related-task-id={option.id}>{onSelectChoice&&!completed&&<button type="button" className="secondary-button" disabled={busy} aria-pressed={option.sourceChoice?.selectedTaskId===option.id} onClick={()=>{setBusy(true);setError('');void onSelectChoice(option.id,option.sourceChoice?.selectedTaskId??null).catch(reason=>setError(reason instanceof Error?reason.message:'选择未能保存，请重试。')).finally(()=>setBusy(false))}}>{option.sourceChoice?.selectedTaskId===option.id?'已选择此方式':'选择此方式'}</button>}{facts(option,completed&&option.status!=='已完成')}</section>)}</div>
   }
   return <section className="flow-related-task" key={task.id} data-related-task-id={task.id}>{facts(task)}{onUnlink&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setBusy(true);setError('');void onUnlink([task.id]).catch(reason=>setError(reason instanceof Error?reason.message:'关联未能保存，请重试。')).finally(()=>setBusy(false))}}>取消关联</button>}</section>
 })}</section>
}
function EventActionPicker({tasks,onLink}:{tasks:Task[];onLink:(ids:string[])=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),seen=new Set<string>()
 return <details className="flow-action-picker"><summary>关联同一通知的待办</summary><p>只调整显示位置，不改变截止或完成状态。</p>{error&&<p role="alert">{error}</p>}{tasks.map(task=>{
   const choice=task.sourceChoice,options=choice?.optionTaskIds.map(id=>tasks.find(item=>item.id===id)).filter((item):item is Task=>Boolean(item))??[]
   if(choice&&options.length!==choice.optionTaskIds.length)return null
   if(choice&&seen.has(choice.id))return null
   if(choice)seen.add(choice.id)
   const ids=choice?options.map(item=>item.id):[task.id],title=choice?options.map(item=>item.title).join(' / '):task.title
   return <button key={choice?.id??task.id} type="button" className="text-button" disabled={busy} onClick={()=>{setBusy(true);setError('');void onLink(ids).catch(reason=>setError(reason instanceof Error?reason.message:'关联未能保存，请重试。')).finally(()=>setBusy(false))}}>关联：{title}{choice?'（任选一项）':''}</button>
 })}</details>
}
function TaskFacts({task,linked,linkedHint,channels,timeZone,onOpenTask,onOpenEvent,onComplete,onRestoreTask,onSchedule,canComplete=true,blockedReason}:{task:Task;linked?:Event;linkedHint?:string;channels:string[];timeZone:string;onOpenTask:(task:Task)=>void;onOpenEvent?:(event:Event)=>void;onComplete:(id:string)=>void;onRestoreTask?:Props['onRestoreTask'];onSchedule?:Props['onSchedule'];canComplete?:boolean;blockedReason?:string}){
 const {description:publicDescription,location,channels:visibleChannels}=taskPublicSummary(task,{dateLabel:flowTaskDate(task,timeZone),channels})
 const hint=suggestedTaskDuration(task),relative=taskRelativeTimeHint(task),linkedSections=linked?eventDescriptionSections(linked.description):[],linkedDuration=linked?eventDurationLabel(linked):undefined
 const linkedNear=Boolean(linked&&isEventInNextThreeDays(linked,new Date(),timeZone))
 return <><div className="timeline-kind">待办详情</div><h2>{task.title}</h2><div className="timeline-key">
  {(flowTaskDate(task,timeZone)!=='未设日期'||!linked)&&<p><Clock3 size={16}/><strong>{flowTaskDate(task,timeZone)}</strong></p>}
  {linked&&<p className="timeline-linked-event" data-near-event={linkedNear||undefined}><CalendarDays size={17}/><span><small>日程时间</small><strong>{flowEventDate(linked,linkedHint,timeZone)}</strong></span></p>}
  {linked?.location&&<p className="timeline-linked-event" data-near-event={linkedNear||undefined}><MapPin size={17}/><span><small>地点</small><strong>{linked.location}</strong></span></p>}
  {location&&location!==linked?.location&&<p><MapPin size={16}/><strong>{location}</strong></p>}
  {visibleChannels.length>0&&<p><strong>提交：<TextWithLinks text={visibleChannels.join('、')}/></strong></p>}{linkedDuration&&<p><Clock3 size={16}/>{linkedDuration}</p>}
 </div>{planAfterDeadline(task.plannedStart||task.directDate,task.deadline,timeZone)&&<p className="flow-deadline-warning">计划晚于截止</p>}{visibleDirectTags(task.directTags,flowTaskDate(task,timeZone),task.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}{relative&&<p>{relative}</p>}{publicDescription&&<section><h3>内容与须知</h3><p><TextWithLinks text={publicDescription}/></p></section>}{linkedSections.filter(section=>!publicDescription.includes(section.content)).map((section,index)=><section key={`linked-${section.label}-${index}`}><h3>{section.label}</h3><p><TextWithLinks text={section.content}/></p></section>)}{task.materials.length>0&&<section><h3>材料与要求</h3><MaterialFactsList materials={task.materials}/></section>}{task.estimatedMinutesKnown&&task.estimatedMinutes>0?<p>预计耗时 {formatDuration(task.estimatedMinutes)}</p>:hint?<p>建议约 {hint}（可修改的估计）</p>:null}<div className="timeline-actions">{task.status==='已完成'&&onRestoreTask?<button type="button" className="secondary-button" onClick={()=>onRestoreTask(task.id)} aria-label={`恢复未完成：${task.title}`}><CheckCircle2 size={17}/>恢复未完成</button>:<button type="button" className="primary-button" disabled={task.status==='已完成'||!canComplete} onClick={()=>onComplete(task.id)} aria-label={`${task.status==='已完成'?'已完成':'完成'}${task.title}`}>{task.status==='已完成'?<CheckCircle2 size={17}/>:<Circle size={17}/>} {task.status==='已完成'?'已完成':canComplete?'完成':blockedReason??'先选择此方式'}</button>}{onSchedule&&task.status!=='已完成'&&<TaskScheduleButton task={task} onSchedule={onSchedule}/>}<button type="button" className="secondary-button" onClick={()=>onOpenTask(task)}>编辑与更多</button>{linked&&onOpenEvent&&<button type="button" className="text-button" onClick={()=>onOpenEvent(linked)}>查看关联日程</button>}</div></>
}
function EventFacts({event,hint,near,timeZone,now,onOpenEvent,onComplete,busy,children}:{event:Event;hint?:string;near:boolean;timeZone:string;now:Date;onOpenEvent?:Props['onOpenEvent'];onComplete?:()=>void;busy:boolean;children?:ReactNode}){
 const sections=eventDescriptionSections(event.description).filter(section=>!(section.label==='时间说明'&&section.content===flowEventDate(event,hint,timeZone))),duration=eventDurationLabel(event)
  return <><div className="timeline-kind">日程详情 {near&&<span className="flow-near-badge">{event.startAt&&!isDateOnly(event.startAt)&&eventTimingState(event,now,timeZone)==='ongoing'?'进行中':'3天内'}</span>}{event.personalCompleted&&<span> · 已完成</span>}</div><h2>{event.title}</h2><div className="timeline-key timeline-event-key" data-near-event={near||undefined}><p><CalendarDays size={18}/><span><small>时间</small><strong>{flowEventDate(event,hint,timeZone)}</strong></span></p>{event.location&&<p><MapPin size={18}/><span><small>地点</small><strong>{event.location}</strong></span></p>}{duration&&<p><Clock3 size={16}/>{duration}</p>}</div>{visibleDirectTags(event.directTags,flowEventDate(event,hint,timeZone),event.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}{sections.map((section,index)=><section className={/参加须知|准备要求/u.test(section.label)?'flow-related-note':undefined} key={`${section.label}-${index}`}><h3>{section.label}</h3><p><TextWithLinks text={section.content}/></p></section>)}{children}<div className="timeline-actions">{onComplete&&<button type="button" className={event.personalCompleted?'secondary-button':'primary-button'} disabled={busy} onClick={onComplete}><Circle size={17}/>{busy?'保存中…':event.personalCompleted?'恢复未完成':'完成'}</button>}{onOpenEvent&&<button type="button" className="secondary-button" onClick={()=>onOpenEvent(event)}>编辑与更多</button>}</div></>
}
