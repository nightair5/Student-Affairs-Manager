import type {Event,Task} from '../types'
import {calculateTaskPriority,getBlockedAndWaitingTasks,getExecutableTasks} from './taskLogic'
import {getUndatedCalendarEvents,localDateKey} from './calendar'
import {isDateOnly,parseBusinessDateTime} from './timeSemantics'
import type {WorkspaceV8} from '../domain/v2/types'

/** Only show channels already associated with a task in the canonical workspace. */
export function workspaceTaskChannels(workspace:WorkspaceV8|null|undefined):Record<string,string[]> {
  const channels:Record<string,string[]>={}
  for(const material of workspace?.materials??[]){
    const channel=material.submissionChannel?.trim()
    if(!channel)continue
    for(const taskId of material.relatedTaskIds){
      const values=channels[taskId]??[]
      if(!values.includes(channel))values.push(channel)
      channels[taskId]=values
    }
  }
  return channels
}

/** A short relative-time hint is shown only when the exact words still exist
 * in the event's source. It never supplies a calendar date or clock time. */
export function workspaceEventTimeHints(workspace:WorkspaceV8|null|undefined):Record<string,string> {
  const hints:Record<string,string>={}
  if(!workspace)return hints
  const points=new Map(workspace.timePoints.map(point=>[point.id,point]))
  const sources=new Map(workspace.sources.map(source=>[source.id,source]))
  const versions=new Map(workspace.sourceVersions.map(version=>[version.id,version]))
  const eventsBySource=new Map<string,typeof workspace.events>()
  for(const event of workspace.events){const sourceId=event.legacyData?.sourceId;if(typeof sourceId==='string'){const list=eventsBySource.get(sourceId)??[];list.push(event);eventsBySource.set(sourceId,list)}}
  for(const event of workspace.events){
    const point=event.startTimePointId?points.get(event.startTimePointId):undefined
    const sourceId=event.legacyData?.sourceId
    if(!point||point.type!=='event_start'||point.normalizedValue||!point.rawText||typeof sourceId!=='string')continue
    const source=sources.get(sourceId)
    const original=source?versions.get(source.currentVersionId)?.rawText:null
    if(!original)continue
    const matches=[...point.rawText.matchAll(/(?:本周|这周|下周)[^，,。；;！!\n]{0,24}?(?:下课后|课程结束后|课结束后|课后)/gu)].map(match=>match[0])
    if(matches.length!==1)continue
    const at=original.indexOf(matches[0])
    if(at<0||at!==original.lastIndexOf(matches[0]))continue
    const before=original.slice(0,at),after=original.slice(at+matches[0].length)
    const left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('！'),before.lastIndexOf('？'),before.lastIndexOf('\n'))+1
    const end=after.search(/[。！？\n]/u),sentence=original.slice(left,at+matches[0].length+(end<0?after.length:end))
    if(/取消|作废|不再|禁止|改为|改至|延期|调整至/u.test(sentence))continue
    const owners=(eventsBySource.get(sourceId)??[]).filter(item=>item.title&&sentence.includes(item.title))
    if(owners.length===1&&owners[0].id===event.id)hints[event.id]=matches[0]
  }
  return hints
}

/** Group a task and an undated event only for display when the same source and
 * exact title identify a unique pair. Both saved entities remain accessible. */
export function pairUndatedEvents(tasks:Task[],events:Event[],workspace:WorkspaceV8|null|undefined):{linked:Record<string,Event>;unpaired:Event[]} {
  const storedEvents=new Map((workspace?.events??[]).map(event=>[event.id,event]))
  const tasksBySourceAndTitle=new Map<string,Task[]>()
  for(const task of tasks)if(task.status!=='已完成')for(const sourceId of new Set(task.sourceIds)){
    const key=JSON.stringify([sourceId,task.title]),matches=tasksBySourceAndTitle.get(key)??[]
    matches.push(task);tasksBySourceAndTitle.set(key,matches)
  }
  const proposals=events.flatMap(event=>{
    if(event.startAt||event.endAt||event.location)return []
    const sourceId=storedEvents.get(event.id)?.legacyData?.sourceId
    if(typeof sourceId!=='string')return []
    const matches=(tasksBySourceAndTitle.get(JSON.stringify([sourceId,event.title]))??[]).filter(task=>
      (event.directTags??[]).every(tag=>tag==='时间待定'||task.directTags?.includes(tag)))
    return matches.length===1?[{taskId:matches[0].id,event}]:[]
  })
  const proposalCounts=new Map<string,number>()
  for(const pair of proposals)proposalCounts.set(pair.taskId,(proposalCounts.get(pair.taskId)??0)+1)
  const linked:Record<string,Event>={}
  for(const pair of proposals)if(proposalCounts.get(pair.taskId)===1)linked[pair.taskId]=pair.event
  const linkedIds=new Set(Object.values(linked).map(event=>event.id))
  return {linked,unpaired:events.filter(event=>!linkedIds.has(event.id))}
}

/** Explicit stored attendance relations also pair dated events. Never infer a
 * relation from a similar title, date, or two unrelated sources. */
export function pairFlowEvents(tasks:Task[],events:Event[],workspace:WorkspaceV8|null|undefined){
  const fallback=pairUndatedEvents(tasks,events,workspace),linked={...fallback.linked}
  const proposed=new Map<string,Event[]>()
  for(const event of events){
    const stored=workspace?.events.find(e=>e.id===event.id),relation=stored?.legacyData?.sourceTaskRelations
    if(!relation||typeof relation!=='object'||Array.isArray(relation)||relation.version!=='source-event-task-relations-1'||typeof relation.draftId!=='string'||!Array.isArray(relation.taskTempIds)||relation.taskTempIds.length!==1)continue
    const formalId=`task:${relation.draftId}:${relation.taskTempIds[0]}`
    const task=tasks.find(t=>t.id===formalId&&t.status!=='已完成')
    if(!task||typeof stored?.legacyData?.sourceId!=='string'||!task.sourceIds.includes(stored.legacyData.sourceId))continue
    const canonical=workspace?.tasks.find(t=>t.id===task.id)
    if(canonical?.legacyData?.actionVerb!=='参加')continue
    const list=proposed.get(task.id)??[];list.push(event);proposed.set(task.id,list)
  }
  for(const [id,matches] of proposed)if(matches.length===1)linked[id]=matches[0]
  const ids=new Set(Object.values(linked).map(e=>e.id))
  return {linked,unpaired:events.filter(e=>!ids.has(e.id))}
}

export function homeFlow(tasks:Task[],events:Event[],now=new Date(),linked:Readonly<Record<string,Event>>={}){
  const relatedDate=(t:Task)=>t.sourceWindowLabel?t.sourceWindowEnd:linked[t.id]?.startAt
  const ready=getExecutableTasks(tasks,now),dated=(t:Task)=>Boolean(t.deadline||t.plannedStart||t.directDate||relatedDate(t))
  const priorityDifference=(a:Task,b:Task)=>calculateTaskPriority(b,tasks,now).score-calculateTaskPriority(a,tasks,now).score
  const byPriority=(a:Task,b:Task)=>priorityDifference(a,b)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)
  const today=localDateKey(now),next=new Date(now);next.setDate(next.getDate()+7);const end=localDateKey(next)
  // A later personal plan must not hide a deadline which falls today.
  const firstDate=(t:Task)=>[t.plannedStart||t.directDate,t.deadline,relatedDate(t)].filter((value):value is string=>Boolean(value)).map(localDateKey).sort()[0]??''
  // For a day with incomplete precision, preserve its existing priority slot.
  // Never interpret an unspecified clock time as midnight. Sort only the
  // clock-bearing slots amongst themselves, avoiding a non-transitive comparator.
  const firstTime=(t:Task):number|null=>{
    const day=firstDate(t)
    const values=[t.plannedStart||t.directDate,t.deadline,relatedDate(t)].filter((value):value is string=>Boolean(value)&&localDateKey(value!)===day)
    if(!values.length||values.some(isDateOnly))return null
    const dates=values.map(value=>parseBusinessDateTime(value))
    if(dates.some(value=>!value))return null
    return Math.min(...dates.map(value=>value!.getTime()))
  }
  const sortUpcoming=(items:Task[])=>{
    const result=items.sort((a,b)=>firstDate(a).localeCompare(firstDate(b))||byPriority(a,b))
    for(let start=0;start<result.length;){
      let end=start+1
      while(end<result.length&&firstDate(result[end])===firstDate(result[start]))end++
      const positions:number[]=[],precise:Task[]=[]
      for(let i=start;i<end;i++)if(firstTime(result[i])!==null){positions.push(i);precise.push(result[i])}
      precise.sort((a,b)=>firstTime(a)!-firstTime(b)!||byPriority(a,b))
      positions.forEach((position,index)=>{result[position]=precise[index]})
      start=end
    }
    return result
  }
  const isToday=(t:Task)=>{
    const plan=t.plannedStart||t.directDate
    // Preserve existing placement for old overdue tasks with a future plan,
    // while ensuring an actual deadline today remains visible today.
    if(plan)return localDateKey(plan)<=today||Boolean(t.deadline&&localDateKey(t.deadline)===today)
    const date=t.deadline||relatedDate(t)
    return Boolean(date&&localDateKey(date)<=today)
  }
  const upcoming=events.filter(e=>e.startAt&&Number.isFinite(Date.parse(e.startAt))&&localDateKey(e.endAt&&Number.isFinite(Date.parse(e.endAt))?e.endAt:e.startAt)>=today).sort((a,b)=>(a.startAt??'').localeCompare(b.startAt??'')||a.id.localeCompare(b.id))
  return {dated:ready.filter(dated).sort(byPriority),today:ready.filter(t=>dated(t)&&isToday(t)).sort(byPriority),next:sortUpcoming(ready.filter(t=>dated(t)&&!isToday(t))),undated:ready.filter(t=>!dated(t)).sort((a,b)=>priorityDifference(a,b)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)),deferred:getBlockedAndWaitingTasks(tasks,now),
    events:upcoming.filter(e=>localDateKey(e.startAt!)<=end),
    todayEvents:upcoming.filter(e=>localDateKey(e.startAt!)<=today),
    upcomingEvents:upcoming.filter(e=>localDateKey(e.startAt!)>today),
    undatedEvents:getUndatedCalendarEvents(events)}
}

export function historicalDirectDraftIds(w:WorkspaceV8):string[]{
  const ignored=new Set(Array.isArray(w.preferences.legacyData?.ignoredHistoricalDraftIds)?w.preferences.legacyData.ignoredHistoricalDraftIds:[])
  const activeSources=new Set(w.extractionDrafts.flatMap(d=>{const batch=d.legacyData?.directBatch;return batch&&typeof batch==='object'&&!Array.isArray(batch)&&batch.status==='active'&&typeof batch.sourceId==='string'?[batch.sourceId]:[]}))
  return w.extractionDrafts.filter(d=>{
    if(ignored.has(d.id)||d.legacyData?.directBatch||!['needs_review','failed','partially_confirmed'].includes(d.status))return false
    const recovery=d.legacyData?.storedDraftRecovery
    if(recovery&&typeof recovery==='object'&&!Array.isArray(recovery)&&recovery.mode==='isolated_historical_result')return false
    const run=w.recognitionRuns.find(r=>r.id===d.recognitionRunId),v=run&&w.sourceVersions.find(x=>x.id===run.sourceVersionId)
    return Boolean(v?.rawText&&!activeSources.has(v.sourceId)&&run?.pipelineVersion!=='direct-ai-retry-v1'&&w.sources.some(s=>s.id===v.sourceId&&s.currentVersionId===v.id))
  }).map(d=>d.id)
}
