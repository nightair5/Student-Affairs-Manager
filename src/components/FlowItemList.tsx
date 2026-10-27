import {directCardTitle,visibleDirectTags} from '../lib/directCardPresentation'
import {CalendarDays,CheckCircle2,Circle,ChevronRight,Clock3} from 'lucide-react'
import {TaskScheduleButton} from './TaskScheduleButton'
import {useEffect,useState} from 'react'
import type {Event,Task} from '../types'
import {flowEventDate,flowTaskDate,planAfterDeadline} from '../lib/flowPresentation'

export function FlowTaskList({tasks,onOpen,onComplete,onSchedule,highlightIds=[],channels={},linkedEvents={},eventTimeHints={},onOpenEvent}:{tasks:Task[];onOpen:(t:Task)=>void;onComplete:(id:string)=>void;onSchedule?:(id:string,date:string)=>Promise<void>;highlightIds?:readonly string[];channels?:Readonly<Record<string,string[]>>;linkedEvents?:Readonly<Record<string,Event>>;eventTimeHints?:Readonly<Record<string,string>>;onOpenEvent?:(event:Event)=>void}){
  const key=highlightIds.join('|'),[expired,setExpired]=useState(''),recent=expired===key?'':key
  useEffect(()=>{const timer=setTimeout(()=>setExpired(key),5000);return()=>clearTimeout(timer)},[key])
  return <ul className="flow-item-list">{tasks.map(task=>{
    const linked=linkedEvents[task.id], taskDate=flowTaskDate(task), hint=linked&&eventTimeHints[linked.id]
    const eventDate=linked?(flowEventDate(linked,hint)==='时间待定'?'日程时间待定':flowEventDate(linked,hint)):'日程时间待定'
    const displayedDate=linked&&taskDate==='未设日期'?eventDate:taskDate
    const taskChannels=channels[task.id]??[]
    const tags=visibleDirectTags(task.directTags,displayedDate,task.title)
    return <li className="flow-task-row" key={task.id} data-task-id={task.id} data-new={recent.split('|').includes(task.id)||undefined}>
      <button className="flow-complete icon-button" type="button" disabled={task.status==='已完成'} onClick={()=>onComplete(task.id)} aria-label={`${task.status==='已完成'?'已完成':'完成'}${task.title}`}>{task.status==='已完成'?<CheckCircle2 size={21}/>:<Circle size={21}/>}</button>
      <button className="flow-item-main" type="button" onClick={()=>onOpen(task)}>
        <h3 data-task-title title={task.title}>{directCardTitle(task.title)}</h3>
        <span className="flow-item-facts"><Clock3 size={14}/>{displayedDate}
          {linked&&taskDate!=='未设日期'&&<small>{eventDate}</small>}
          {linked?.location&&<small>{linked.location}</small>}
          {task.materials.length>0&&<small>{task.materials.length}项材料</small>}
          {taskChannels.length>0&&<small className="flow-task-channel" title={taskChannels.join('、')}>提交：{taskChannels.join('、')}</small>}
          {planAfterDeadline(task.plannedStart||task.directDate,task.deadline)&&<small className="flow-deadline-warning">计划晚于截止</small>}
          {tags.map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}
        </span>
      </button>
      <div className="flow-row-actions">
        {linked&&onOpenEvent&&<button className="flow-linked-event" type="button" data-event-id={linked.id} onClick={()=>onOpenEvent(linked)} aria-label={`查看${linked.title}日程`}>日程</button>}
        {onSchedule&&task.status!=='已完成'&&<TaskScheduleButton task={task} onSchedule={onSchedule}/>}<button className="icon-button" type="button" onClick={()=>onOpen(task)} aria-label={`编辑${task.title}`}><ChevronRight size={17}/></button>
      </div>
    </li>
  })}</ul>
}
export function FlowEventList({events,onOpen,timeHints={},highlightIds=[]}:{events:Event[];onOpen:(e:Event)=>void;timeHints?:Readonly<Record<string,string>>;highlightIds?:readonly string[]}){
  const key=highlightIds.join('|'),[expired,setExpired]=useState(''),recent=expired===key?'':key
  useEffect(()=>{const timer=setTimeout(()=>setExpired(key),5000);return()=>clearTimeout(timer)},[key])
  return <ul className="flow-item-list">{events.map(event=><li className="flow-event-row" key={event.id} data-event-id={event.id} data-new={recent.split('|').includes(event.id)||undefined}><span className="flow-item-icon"><CalendarDays size={20}/></span><button type="button" className="flow-item-main" onClick={()=>onOpen(event)}><h3 title={event.title}>{directCardTitle(event.title)}</h3><span className="flow-item-facts">日程 · {flowEventDate(event,timeHints[event.id])}{event.location&&<small>{event.location}</small>}</span>{Boolean(event.directTags?.length)&&<span className="direct-inline-tags">{visibleDirectTags(event.directTags,flowEventDate(event,timeHints[event.id]),event.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}</span>}</button><ChevronRight size={17}/></li>)}</ul>
}
