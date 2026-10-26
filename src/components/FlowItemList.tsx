import {directCardTitle,visibleDirectTags} from '../lib/directCardPresentation'
import {CalendarDays,CheckCircle2,ChevronRight,Clock3} from 'lucide-react'
import type {Event,Task} from '../types'
import {flowEventDate,flowTaskDate} from '../lib/flowPresentation'

export function FlowTaskList({tasks,onOpen,onComplete}:{tasks:Task[];onOpen:(t:Task)=>void;onComplete:(id:string)=>void}){
  return <ul className="flow-item-list">{tasks.map(task=><li className="flow-task-row task-card" key={task.id} data-task-id={task.id}>
    <button className="flow-complete icon-button" type="button" onClick={()=>onComplete(task.id)} aria-label={`完成${task.title}`}><CheckCircle2 size={20}/></button>
    <button className="flow-item-main" type="button" onClick={()=>onOpen(task)}><h3 data-task-title title={task.title}>{directCardTitle(task.title)}</h3><span className="flow-item-facts"><Clock3 size={14}/>{flowTaskDate(task)}{task.materials.length>0&&<small>{task.materials.length}项材料</small>}</span>{Boolean(task.directTags?.length)&&<span className="direct-inline-tags">{visibleDirectTags(task.directTags,flowTaskDate(task),task.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}</span>}</button>
    <button className="icon-button" type="button" onClick={()=>onOpen(task)} aria-label={`打开${task.title}`}><ChevronRight size={17}/></button>
  </li>)}</ul>
}
export function FlowEventList({events,onOpen}:{events:Event[];onOpen:(e:Event)=>void}){
  return <ul className="flow-item-list">{events.map(event=><li className="flow-event-row" key={event.id} data-event-id={event.id}><span className="flow-item-icon"><CalendarDays size={20}/></span><button type="button" className="flow-item-main" onClick={()=>onOpen(event)}><h3 title={event.title}>{directCardTitle(event.title)}</h3><span className="flow-item-facts">{flowEventDate(event)}{event.location&&<small>{event.location}</small>}</span>{Boolean(event.directTags?.length)&&<span className="direct-inline-tags">{visibleDirectTags(event.directTags,flowEventDate(event),event.title).map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}</span>}</button><ChevronRight size={17}/></li>)}</ul>
}
