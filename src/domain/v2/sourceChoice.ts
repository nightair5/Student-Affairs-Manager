import type {CanonicalWorkspaceRepository} from './repository'
import {workspaceSnapshotHash} from './migration'

/** Persist a personal choice without changing any source-backed branch fact. */
export async function selectSourceChoice(repository:Pick<CanonicalWorkspaceRepository,'transaction'>,taskId:string,expectedSelected:string|null,now=new Date().toISOString()):Promise<void> {
 await repository.transaction(workspace=>{
  const task=workspace.tasks.find(value=>value.id===taskId)
  if(!task)throw Error('这项提交方式已不存在。')
  const ownerId=typeof task.legacyData?.sourceChoiceOwnerId==='string'?task.legacyData.sourceChoiceOwnerId:task.id
  const owner=workspace.tasks.find(value=>value.id===ownerId),group=owner?.legacyData?.sourceChoiceGroup
  if(!owner||!group||typeof group!=='object'||Array.isArray(group)||group.version!=='source-choice-group-1.0.0'||!Array.isArray(group.optionTaskIds)||typeof group.sourceVersionId!=='string'||typeof group.quotation!=='string')throw Error('提交方式的关联已变化，请重新读取。')
  const ids=group.optionTaskIds.filter((value):value is string=>typeof value==='string')
  const version=workspace.sourceVersions.find(value=>value.id===group.sourceVersionId)
  if(ids.length<2||ids.length>6||new Set(ids).size!==ids.length||!ids.includes(taskId)||!ids.includes(ownerId)||!version?.rawText?.includes(group.quotation)||ids.some(id=>!workspace.tasks.some(value=>value.id===id&&value.legacyData?.sourceId===version.sourceId)))throw Error('提交方式的关联已变化，请重新读取。')
  const previous=typeof group.selectedTaskId==='string'&&ids.includes(group.selectedTaskId)?group.selectedTaskId:null
  if(previous===taskId)return workspace
  if(previous!==expectedSelected)throw Error('提交方式已在其他页面修改，请重新读取。')
  const historyId=`history:source-choice:${workspaceSnapshotHash({ownerId,taskId,now,revision:owner.version})}`
  return {...workspace,tasks:workspace.tasks.map(value=>value.id===ownerId?{...value,version:value.version+1,updatedAt:now,legacyData:{...value.legacyData,sourceChoiceGroup:{...group,selectedTaskId:taskId}}}:value),historyRecords:[...workspace.historyRecords,{id:historyId,entityType:'task' as const,entityId:ownerId,action:'updated' as const,fieldName:'sourceChoice',before:previous,after:taskId,actor:'user' as const,reason:'用户选择或更换提交方式，原文各分支保持不变',sourceVersionId:version.id,changedAt:now}]}
 })
}
