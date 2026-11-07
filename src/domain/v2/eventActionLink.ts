import type {CanonicalWorkspaceRepository} from './repository'
import type {JsonValue} from './types'

/** An explicit user choice only changes a display relationship. The task and
 * event remain independent canonical entities and retain their own facts. */
export async function setEventActionLink(repository:Pick<CanonicalWorkspaceRepository,'transaction'>,command:{operationId:string;eventId:string;taskIds:string[];linked:boolean;expectedRevision:string|null;changedAt:string}):Promise<{changed:boolean}>{
 if(!command.operationId||!command.eventId||!command.taskIds.length||new Set(command.taskIds).size!==command.taskIds.length)throw Error('关联参数不完整。')
 let changed=false
 await repository.transaction(workspace=>{
  const event=workspace.events.find(item=>item.id===command.eventId),historyId=`event-command:${command.operationId}:action-link`
  const previous=workspace.historyRecords.find(item=>item.id===historyId)
  if(previous){if(previous.entityId!==command.eventId||JSON.stringify(previous.after)!==JSON.stringify({taskIds:command.taskIds,linked:command.linked}))throw Error('关联操作标识已被使用。');return workspace}
  if(!event)throw Error('这项日程已不存在，请重新读取。')
  const sourceId=event.legacyData?.sourceId,metadata=event.legacyData?.manualActionLinksV1
  if(typeof sourceId!=='string'||!metadata&&command.expectedRevision!==null)throw Error('通知来源或关联状态已变化，请重新读取。')
  const state=metadata&&typeof metadata==='object'&&!Array.isArray(metadata)?metadata:null
  if(metadata&&(!state||state.version!=='event-action-links-1'||!Array.isArray(state.taskIds)||!Array.isArray(state.excludedTaskIds)||typeof state.revision!=='string'))throw Error('现有关联信息无法确认，未做修改。')
  if((typeof state?.revision==='string'?state.revision:null)!==command.expectedRevision)throw Error('关联已在其他页面更改，请重新读取。')
  const tasks=command.taskIds.map(id=>workspace.tasks.find(item=>item.id===id))
  if(tasks.some(task=>!task||task.legacyData?.sourceId!==sourceId))throw Error('只能关联同一份通知中的已有待办。')
  const taskIds=Array.isArray(state?.taskIds)?state.taskIds.filter((id):id is string=>typeof id==='string'):[]
  const excluded=Array.isArray(state?.excludedTaskIds)?state.excludedTaskIds.filter((id):id is string=>typeof id==='string'):[]
  if(command.linked&&workspace.events.some(item=>{
   if(item.id===event.id)return false
   const other=item.legacyData?.manualActionLinksV1
   return Boolean(other&&typeof other==='object'&&!Array.isArray(other)&&Array.isArray(other.taskIds)&&other.taskIds.some(id=>typeof id==='string'&&command.taskIds.includes(id)))
  }))throw Error('这项待办已由你关联到其他日程，请先取消原关联。')
  const nextIds=command.linked?[...new Set([...taskIds,...command.taskIds])]:taskIds.filter(id=>!command.taskIds.includes(id))
  const nextExcluded=command.linked?excluded.filter(id=>!command.taskIds.includes(id)):[...new Set([...excluded,...command.taskIds])]
  if(JSON.stringify(nextIds)===JSON.stringify(taskIds)&&JSON.stringify(nextExcluded)===JSON.stringify(excluded))return workspace
  changed=true
  return {...workspace,events:workspace.events.map(item=>item.id===event.id?{...item,updatedAt:command.changedAt,legacyData:{...item.legacyData,manualActionLinksV1:{version:'event-action-links-1',taskIds:nextIds,excludedTaskIds:nextExcluded,revision:command.operationId}}}:item),historyRecords:[...workspace.historyRecords,{id:historyId,entityType:'event' as const,entityId:event.id,action:'updated',fieldName:'关联待办',before:{taskIds,excludedTaskIds:excluded} as JsonValue,after:{taskIds:command.taskIds,linked:command.linked} as JsonValue,actor:'user' as const,reason:'用户调整日程与待办的显示关联，原事项与时间不变',sourceVersionId:null,changedAt:command.changedAt}]}
 })
 return {changed}
}
