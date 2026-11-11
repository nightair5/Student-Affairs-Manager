import type {Task} from '../types'
import {localDateKey,type CalendarTimelineItem} from './calendar'

export interface MatterGroup {id:string;title:string;members:Task[]}

/** Shared, read-only projection: only an already saved source-backed relation
 * creates a matter. Dates, titles and common sources do not infer one. */
export function projectMatterGroups(tasks:readonly Task[],excludedIds:ReadonlySet<string>=new Set()):Map<string,MatterGroup>{
 const byId=new Map(tasks.map(task=>[task.id,task])),groups=new Map<string,MatterGroup>()
 for(const task of tasks){
  const goal=task.sourceGoal
  if(!goal||groups.has(goal.id))continue
  const members=goal.taskIds.flatMap(id=>{const member=byId.get(id);return member?[member]:[]})
  if(members.length!==goal.taskIds.length||members.length<2||members.some(member=>member.sourceGoal?.id!==goal.id||excludedIds.has(member.id)))continue
  groups.set(goal.id,{id:goal.id,title:goal.title,members})
 }
 return groups
}

/** A plain 待确认 may concern a date and does not imply eligibility. */
export function isConditionalMatterTask(task:Task):boolean {
 return Boolean(task.directTags?.includes('如符合条件'))
}

type AgendaTask=Extract<CalendarTimelineItem,{kind:'task'}>
export type MatterAgendaEntry=CalendarTimelineItem|{kind:'matter';id:string;title:string;day:string;items:AgendaTask[]}

/** Group only the visible entries of one saved matter on the same calendar day.
 * Every actual time role and task remains available inside that entry. */
export function groupMatterAgenda(items:readonly CalendarTimelineItem[],allTasks:readonly Task[],timeZone='Asia/Shanghai'):MatterAgendaEntry[]{
 const goals=projectMatterGroups(allTasks),out:MatterAgendaEntry[]=[],seen=new Map<string,Extract<MatterAgendaEntry,{kind:'matter'}>>()
 for(const item of items){
  const goal=item.kind==='task'&&item.task.sourceGoal?goals.get(item.task.sourceGoal.id):undefined
  if(!goal||item.kind!=='task'){out.push(item);continue}
  const day=localDateKey(item.at,timeZone),key=`${goal.id}:${day}`
  const existing=seen.get(key)
  if(existing)existing.items.push(item)
  else{const group:Extract<MatterAgendaEntry,{kind:'matter'}>={kind:'matter',id:goal.id,title:goal.title,day,items:[item]};seen.set(key,group);out.push(group)}
 }
 return out
}

/** Month cells show one summary per matter per day. The earliest displayed task
 * supplies its real date role; all member risk labels remain represented. */
export function matterDaySummaryTasks(dayTasks:readonly Task[],allTasks:readonly Task[]):Task[]{
 const goals=projectMatterGroups(allTasks),result:Task[]=[],positions=new Map<string,number>()
 for(const task of dayTasks){
  const goal=task.sourceGoal&&goals.get(task.sourceGoal.id)
  if(!goal){result.push(task);continue}
  const position=positions.get(goal.id)
  if(position===undefined){positions.set(goal.id,result.length);result.push({...task,title:goal.title})}
  else {
   const prior=result[position],representative=prior.status==='已完成'&&task.status!=='已完成'?task:prior
   result[position]={...representative,title:goal.title,riskFlags:[...new Set([...prior.riskFlags,...task.riskFlags])]}
  }
 }
 return result
}
