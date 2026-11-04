import type {CanonicalWorkspaceRepository} from './repository'

/** Personal handling is independent from the source's event/cancellation facts. */
export async function commitEventCompletion(
  repository: Pick<CanonicalWorkspaceRepository, 'transaction'>,
  command: {operationId:string; eventId:string; expected:boolean; expectedRevision?:string|null; completed:boolean; changedAt:string},
): Promise<{changed:boolean}> {
  if(!command.operationId||!command.eventId)throw Error('EVENT_COMMAND_ID_REQUIRED')
  let changed=false
  await repository.transaction(workspace=>{
    const event=workspace.events.find(item=>item.id===command.eventId)
    if(!event)throw Error('EVENT_COMMAND_NOT_FOUND')
    const historyId=`event-command:${command.operationId}:personalCompletion`
    const previous=workspace.historyRecords.find(record=>record.id===historyId)
    if(previous){
      if(previous.entityId!==event.id||previous.after!==command.completed)throw Error('EVENT_COMMAND_ID_REUSED')
      return workspace
    }
    const value=event.legacyData?.personalCompletionV1
    if(value!==undefined&&typeof value!=='boolean')throw Error('EVENT_COMMAND_STATE_INVALID')
    const current=value===true
    const revision=event.legacyData?.personalCompletionRevisionV1
    if(revision!==undefined&&typeof revision!=='string')throw Error('EVENT_COMMAND_STATE_INVALID')
    if(current!==command.expected||(revision??null)!==(command.expectedRevision??null))throw Error('EVENT_COMMAND_FIELD_CONFLICT')
    if(current===command.completed)return workspace
    changed=true
    return {...workspace,
      events:workspace.events.map(item=>item.id===event.id?{...item,updatedAt:command.changedAt,legacyData:{...item.legacyData,personalCompletionV1:command.completed,personalCompletionRevisionV1:command.operationId}}:item),
      historyRecords:[...workspace.historyRecords,{id:historyId,entityType:'event' as const,entityId:event.id,action:'updated',fieldName:'个人完成状态',before:current,after:command.completed,actor:'user' as const,reason:'用户标记或恢复个人日程，原文活动状态不变',sourceVersionId:null,changedAt:command.changedAt}],
    }
  })
  return {changed}
}
