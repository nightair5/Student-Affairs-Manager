import type {Event,Task} from '../types'
import {projectMatterGroups} from '../lib/matterProjection'
import {FlowTaskList} from './FlowItemList'
import './MatterTaskList.css'

/** A task center view of the same persisted matters used by the timeline.
 * The underlying task actions, deadlines and completion states remain separate. */
export function MatterTaskList({tasks,allTasks,onOpen,onComplete,onSchedule,channels,linkedEvents,eventTimeHints,completedChoiceGroups,onOpenEvent}:{tasks:Task[];allTasks:Task[];onOpen:(task:Task)=>void;onComplete:(id:string)=>void;onSchedule?:(id:string,date:string)=>Promise<void>;channels?:Readonly<Record<string,string[]>>;linkedEvents?:Readonly<Record<string,Event>>;eventTimeHints?:Readonly<Record<string,string>>;completedChoiceGroups?:readonly string[];onOpenEvent?:(event:Event)=>void}){
 const goals=projectMatterGroups(allTasks,new Set(Object.keys(linkedEvents??{})))
 const byTask=new Map([...goals.values()].flatMap(goal=>goal.members.map(task=>[task.id,goal] as const)))
 const seen=new Set<string>()
 const props={onOpen,onComplete,onSchedule,channels,linkedEvents,eventTimeHints,completedChoiceGroups,onOpenEvent}
 return <div className="matter-task-list">{tasks.map(task=>{
  const goal=byTask.get(task.id)
  if(!goal)return <FlowTaskList key={task.id} tasks={[task]} {...props}/>
  if(seen.has(goal.id))return null
  seen.add(goal.id)
  const visible=tasks.filter(value=>goal.members.some(member=>member.id===value.id))
  return <details className="matter-task-group" key={goal.id} data-goal-id={goal.id}><summary><strong>{goal.title}</strong><span>{visible.length} 项行动</span></summary><FlowTaskList tasks={visible} {...props}/></details>
 })}</div>
}
