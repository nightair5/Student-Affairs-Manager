import type {CanonicalWorkspaceRepository} from './repository'
import type {JsonValue,WorkspaceV8} from './types'
import {workspaceSnapshotHash} from './migration'
import {sourceGoalForTask,workspaceV8ToLegacyView} from './legacyView'
import {eventActionGroups,pairFlowEvents} from '../../lib/homeFlow'

export interface MatterGroupCommand {
 operationId:string;draftId:string;sourceVersionId:string;taskIds:string[];title:string
 expectedRevision:string|null;expectedTasks:Record<string,string>;changedAt:string
 removeGroupId?:string
}
const record=(value:unknown):Record<string,unknown>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as JsonValue
export const matterTaskRevision=(task:WorkspaceV8['tasks'][number])=>workspaceSnapshotHash(task)

/** A user's explicit choice changes only a same-capture display relationship.
 * Facts and task revisions are compared inside the existing atomic transaction. */
export async function setSourceMatterGroup(repository:Pick<CanonicalWorkspaceRepository,'transaction'>,command:MatterGroupCommand):Promise<{changed:boolean;entityId:string}>{
 if(!command.operationId||!command.draftId||command.taskIds.length<2||command.taskIds.length>20||new Set(command.taskIds).size!==command.taskIds.length)throw Error('请选择同一通知中至少两项待办。')
 const title=command.title.trim()
 if(!command.removeGroupId&&(!title||title.length>80))throw Error('请填写不超过80字的事项名称。')
 let changed=false
 const entityId=command.taskIds[0],historyId=`task-command:${command.operationId}:matter-group`
 await repository.transaction(workspace=>{
  const previous=workspace.historyRecords.find(item=>item.id===historyId)
  const request={draftId:command.draftId,taskIds:command.taskIds,title,removeGroupId:command.removeGroupId??null}
  if(previous){if(previous.entityId!==entityId||JSON.stringify(previous.after)!==JSON.stringify(request))throw Error('组织操作标识已被使用。');return workspace}
  const draft=workspace.extractionDrafts.find(value=>value.id===command.draftId),batch=record(draft?.legacyData?.directBatch)
  const run=draft&&workspace.recognitionRuns.find(value=>value.id===draft.recognitionRunId)
  const version=run&&workspace.sourceVersions.find(value=>value.id===run.sourceVersionId)
  const source=version&&workspace.sources.find(value=>value.id===version.sourceId)
  if(!draft||batch?.status!=='active'||!version?.rawText||source?.currentVersionId!==version.id||version.id!==command.sourceVersionId)throw Error('通知来源已变化，请重新读取。')
  const revision=typeof draft.legacyData?.directGoalRevision==='string'?draft.legacyData.directGoalRevision:null
  if(revision!==command.expectedRevision)throw Error('事项组织已在其他页面更改，请重新读取。')
  const batchIds=new Set(Array.isArray(batch.items)?batch.items.flatMap(value=>{const item=record(value);return typeof item?.id==='string'?[item.id]:[]}):[])
  const tasks=command.taskIds.map(id=>workspace.tasks.find(task=>task.id===id))
  if(tasks.some(task=>!task||!batchIds.has(task.id)||task.legacyData?.sourceId!==version.sourceId))throw Error('只能组织同一批通知中的现有待办。')
  if(tasks.some(task=>task&&matterTaskRevision(task)!==command.expectedTasks[task.id]))throw Error('待办已在其他页面修改，请重新读取。')
  const existing=draft.legacyData?.directGoalGroups
  if(existing!==undefined&&!Array.isArray(existing))throw Error('现有事项关系无法确认，未做修改。')
  const groups=Array.isArray(existing)?existing:[]
  let next:JsonValue[]
  if(command.removeGroupId){
   const target=groups.map(record).find(group=>group?.id===command.removeGroupId)
   const liveIds=Array.isArray(target?.taskIds)?target.taskIds.filter((id):id is string=>typeof id==='string'&&workspace.tasks.some(task=>task.id===id)):[]
   if(!target||target.createdBy!=='user'||JSON.stringify(liveIds)!==JSON.stringify(command.taskIds))throw Error('这项组织关系已变化，请重新读取。')
   next=groups.filter(value=>record(value)?.id!==command.removeGroupId)
  }else{
   if(tasks.some(task=>task&&sourceGoalForTask(workspace,task)))throw Error('所选待办已属于其他事项，请先取消原关联。')
   const view=workspaceV8ToLegacyView(workspace),eventGroups=eventActionGroups(view.tasks,view.events,workspace),paired=pairFlowEvents(view.tasks,view.events,workspace)
   if(command.taskIds.some(id=>paired.linked[id]||Object.values(eventGroups).some(members=>members.some(task=>task.id===id))))throw Error('所选待办已关联日程，请在该日程中管理。')
   if(view.tasks.some(task=>command.taskIds.includes(task.id)&&task.sourceChoice?.optionTaskIds.some(id=>!command.taskIds.includes(id))))throw Error('任选方式需要整组一起组织。')
   const quote=version.rawText.split(/\r?\n/u).map(line=>line.trim()).find(Boolean)?.slice(0,200)
   if(!quote||!version.rawText.includes(quote))throw Error('通知原文不可用，未改变事项。')
   next=[...groups,{version:'source-goal-group-1.0.0',id:`${draft.id}:manual:${workspaceSnapshotHash(command.operationId)}`,title,sourceVersionId:version.id,quotations:[quote],taskIds:command.taskIds,createdBy:'user'}]
  }
  changed=true
  return {...workspace,extractionDrafts:workspace.extractionDrafts.map(value=>value.id===draft.id?{...value,updatedAt:command.changedAt,legacyData:{...value.legacyData,directGoalGroups:json(next),directGoalRevision:command.operationId}}:value),historyRecords:[...workspace.historyRecords,{id:historyId,entityType:'task' as const,entityId,action:'updated',fieldName:'事项组织',before:json(groups),after:json(request),actor:'user' as const,reason:'用户调整同一通知的显示组织，原事项与时间不变',sourceVersionId:version.id,changedAt:command.changedAt}],savedAt:command.changedAt}
 })
 return {changed,entityId}
}
