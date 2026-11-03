import type {CanonicalWorkspaceRepository} from './repository'
import type {JsonValue,WorkspaceV8} from './types'

type CanonicalTask=WorkspaceV8['tasks'][number]
type Field='title'|'description'|'status'|'estimatedMinutes'
export type TaskCommandValues=Partial<Pick<CanonicalTask,Field>>
export interface TaskCommand {
 operationId:string; taskId:string; expected:TaskCommandValues; changes:TaskCommandValues; changedAt:string
}
const labels:Record<Field,string>={title:'任务名称',description:'任务说明',status:'状态',estimatedMinutes:'预计耗时'}
const fields:Field[]=['title','description','status','estimatedMinutes']
const equal=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right)

/** Completion must wait for a queued blur-save and for its form to clear the
 * matching draft. A failed or newly changed draft remains available to edit. */
export async function ensureTaskEditsSettled(pending:Promise<unknown>,hasDraft:()=>boolean):Promise<void>{
 await pending
 await new Promise<void>(resolve=>setTimeout(resolve,0))
 if(hasDraft())throw Error('这项待办还有未保存的修改，请先保存或取消修改。')
}

/** One source of truth, a field-level compare-and-set, and an idempotent receipt.
 * An unrelated concurrent edit survives because the transaction patches only
 * the fields the user actually changed. */
export async function commitTaskCommand(repo:Pick<CanonicalWorkspaceRepository,'transaction'>,command:TaskCommand):Promise<{workspace:WorkspaceV8;changed:boolean}> {
 if(!command.operationId||!command.taskId)throw Error('TASK_COMMAND_ID_REQUIRED')
 const changedFields=fields.filter(field=>Object.hasOwn(command.changes,field))
 if(!changedFields.length)throw Error('TASK_COMMAND_EMPTY')
 let changed=false
 const workspace=await repo.transaction(current=>{
  const task=current.tasks.find(item=>item.id===command.taskId)
  if(!task)throw Error('TASK_COMMAND_NOT_FOUND')
  const prefix=`task-command:${command.operationId}:`
  const previous=current.historyRecords.filter(record=>record.id.startsWith(prefix))
  if(previous.length){
   if(previous.some(record=>record.entityId!==task.id||!equal(record.legacyData?.commandChanges,command.changes)))throw Error('TASK_COMMAND_ID_REUSED')
   return current
  }
  for(const field of changedFields){
   if(!Object.hasOwn(command.expected,field))throw Error('TASK_COMMAND_BASE_REQUIRED')
   if(!equal(task[field],command.expected[field])&&!equal(task[field],command.changes[field]))throw Error('TASK_COMMAND_FIELD_CONFLICT')
  }
  if(command.changes.title!==undefined&&!command.changes.title.trim())throw Error('TASK_COMMAND_TITLE_REQUIRED')
  if(command.changes.estimatedMinutes!==undefined&&command.changes.estimatedMinutes!==null&&(!Number.isInteger(command.changes.estimatedMinutes)||command.changes.estimatedMinutes<5))throw Error('TASK_COMMAND_DURATION_INVALID')
  const actual=changedFields.filter(field=>!equal(task[field],command.changes[field]))
  if(!actual.length)return current
  changed=true
  const syncNextAction=actual.includes('title')&&task.nextAction===task.title&&typeof command.changes.title==='string'
  const updated={...task,...command.changes,...(syncNextAction?{nextAction:command.changes.title!}:{}),updatedAt:command.changedAt,version:task.version+1}
  const history=actual.map(field=>({id:prefix+field,entityType:'task' as const,entityId:task.id,action:field==='status'&&command.changes.status==='completed'?'completed':'updated',fieldName:labels[field],before:task[field] as JsonValue,after:command.changes[field] as JsonValue,actor:'user' as const,reason:'用户修改事项',sourceVersionId:null,changedAt:command.changedAt,legacyData:{commandChanges:JSON.parse(JSON.stringify(command.changes)) as JsonValue}}))
  if(syncNextAction)history.push({id:prefix+'nextAction',entityType:'task',entityId:task.id,action:'updated',fieldName:'下一步',before:task.nextAction,after:command.changes.title!,actor:'user',reason:'任务名称与原下一步一致，保持同步',sourceVersionId:null,changedAt:command.changedAt,legacyData:{commandChanges:JSON.parse(JSON.stringify(command.changes)) as JsonValue}})
  return {...current,tasks:current.tasks.map(item=>item.id===task.id?updated:item),historyRecords:[...current.historyRecords,...history]}
 })
 return {workspace,changed}
}
