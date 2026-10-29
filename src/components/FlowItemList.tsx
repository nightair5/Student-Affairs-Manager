import {directCardTitle,visibleDirectTags} from '../lib/directCardPresentation'
import {CalendarDays,CheckCircle2,Circle,ChevronRight,Clock3} from 'lucide-react'
import {TaskScheduleButton} from './TaskScheduleButton'
import {useEffect,useState} from 'react'
import type {Event,Task} from '../types'
import {flowEventDate,flowTaskDate,planAfterDeadline} from '../lib/flowPresentation'
import {formatDuration} from '../lib/taskLogic'
import {displayMaterialRequirement,materialSummary} from '../lib/materialPresentation'
import {suggestedTaskDuration} from '../lib/taskDurationSuggestion'

/** Display a unique explicitly labelled registration site from this task's own
 * description. This is not a new material, channel, or stored source fact. */
function registrationSite(task:Task):string | undefined {
  if (!/报名/u.test(task.title) || /^(?:查看|取消|禁止|停止|无需)/u.test(task.title) || /材料|申请表|PPT|汇报|审核|咨询|通知|培训/iu.test(task.title)) return undefined
  const domain='(?:https?:\\/\\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}(?:\\/[a-z0-9._~!$&\'()*+,;=:@%/?#-]*)?'
  const urls=[...task.description.matchAll(new RegExp(domain,'giu'))].map(match=>match[0])
  const labelled=[...task.description.matchAll(new RegExp(`(?:^|[\\n（(])\\s*网址\\s*[:：]\\s*(${domain})`,'gimu'))].map(match=>match[1])
  return urls.length===1&&labelled.length===1&&urls[0]===labelled[0]?labelled[0]:undefined
}

export function FlowTaskList({tasks,onOpen,onComplete,onSchedule,highlightIds=[],channels={},linkedEvents={},eventTimeHints={},onOpenEvent}:{tasks:Task[];onOpen:(t:Task)=>void;onComplete:(id:string)=>void;onSchedule?:(id:string,date:string)=>Promise<void>;highlightIds?:readonly string[];channels?:Readonly<Record<string,string[]>>;linkedEvents?:Readonly<Record<string,Event>>;eventTimeHints?:Readonly<Record<string,string>>;onOpenEvent?:(event:Event)=>void}){
  const key=highlightIds.join('|'),[expired,setExpired]=useState(''),recent=expired===key?'':key
  useEffect(()=>{const timer=setTimeout(()=>setExpired(key),5000);return()=>clearTimeout(timer)},[key])
  return <ul className="flow-item-list">{tasks.map(task=>{
    const linked=linkedEvents[task.id], taskDate=flowTaskDate(task), hint=linked&&eventTimeHints[linked.id]
    const eventDate=linked?(flowEventDate(linked,hint)==='时间待定'?'日程时间待定':flowEventDate(linked,hint)):'日程时间待定'
    const displayedDate=linked&&taskDate==='未设日期'?eventDate:taskDate
    const taskChannels=channels[task.id]??[]
    const tags=visibleDirectTags(task.directTags,displayedDate,task.title)
    const durationHint=suggestedTaskDuration(task)
    const site=registrationSite(task)
    const naming=[...new Set(task.materials.flatMap(m=>m.namingRequirements??[]))]
    return <li className="flow-task-row" key={task.id} data-task-id={task.id} data-new={recent.split('|').includes(task.id)||undefined}>
      <button className="flow-complete icon-button" type="button" disabled={task.status==='已完成'} onClick={()=>onComplete(task.id)} aria-label={`${task.status==='已完成'?'已完成':'完成'}${task.title}`}>{task.status==='已完成'?<CheckCircle2 size={21}/>:<Circle size={21}/>}</button>
      <div className="flow-item-content">
      <button className="flow-item-main" type="button" onClick={()=>onOpen(task)}>
        <h3 data-task-title title={task.title}>{directCardTitle(task.title)}</h3>
        <span className="flow-item-facts"><span className="flow-item-time"><Clock3 size={14} aria-hidden="true"/>{displayedDate}</span>
          {linked&&taskDate!=='未设日期'&&<small>{eventDate}</small>}
          {linked?.location&&<small>{linked.location}</small>}
          {task.materials.length>0&&<small className="flow-material-summary">材料：{materialSummary(task.materials)}</small>}
          {task.estimatedMinutesKnown===true&&Number.isFinite(task.estimatedMinutes)&&task.estimatedMinutes>0&&<small className="flow-item-duration">预计耗时 {formatDuration(task.estimatedMinutes)}</small>}
          {durationHint&&<small className="flow-item-duration">建议约 {durationHint}（估计而非原文，可在详情修改，不自动安排）</small>}
          {taskChannels.length>0&&<small className="flow-task-channel" title={taskChannels.join('、')}>提交：{taskChannels.join('、')}</small>}
          {site&&!taskChannels.some(channel=>channel.includes(site))&&<small className="flow-task-channel">报名网址：{site}</small>}
          {planAfterDeadline(task.plannedStart||task.directDate,task.deadline)&&<small className="flow-deadline-warning">计划晚于截止</small>}
          {tags.map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}
        </span>
      </button>
      {task.materials.length>0&&<details className="flow-material-details"><summary>材料与要求</summary><ul>{task.materials.map(m=><li key={m.id}><strong>{m.name}</strong>{(m.formatRequirements??[]).map(requirement=><span key={requirement}>{displayMaterialRequirement(requirement)}</span>)}</li>)}</ul>{naming.length>0&&<div><strong>命名或标注</strong>{naming.map(value=><p key={value}>{value}</p>)}</div>}</details>}
      </div>
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
