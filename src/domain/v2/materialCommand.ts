import type {CanonicalWorkspaceRepository} from './repository'
import type {JsonValue,WorkspaceV8} from './types'
import {goalMaterialBelongsToTask,goalMaterialScope,materialOwnerIds} from './materialScope'

type Material=WorkspaceV8['materials'][number]
type MaterialField='name'|'quantity'|'formatRequirements'|'namingRequirements'|'requirements'|'submissionChannel'|'status'
type Field=MaterialField|'goalCondition'|'goalRequirement'
export type MaterialCommandValues=Partial<Pick<Material,MaterialField>>&{goalCondition?:string;goalRequirement?:'required'|'optional'}
export interface MaterialCommand {operationId:string;materialId:string;taskId:string;expected:MaterialCommandValues;expectedOwnerIds:string[];changes:MaterialCommandValues;changedAt:string}
const fields:Field[]=['name','quantity','formatRequirements','namingRequirements','requirements','submissionChannel','status','goalCondition','goalRequirement']
const labels:Record<Field,string>={name:'材料名称',quantity:'数量',formatRequirements:'格式',namingRequirements:'命名要求',requirements:'材料要求',submissionChannel:'提交渠道',status:'准备状态',goalCondition:'适用条件',goalRequirement:'条件下的材料要求'}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const valueOf=(material:Material,field:Field)=>field==='goalCondition'?goalMaterialScope(material)?.condition:field==='goalRequirement'?goalMaterialScope(material)?.requirement:material[field]

/** A user edits the existing canonical material, including any explicitly
 * shared owners. Field-level compare-and-set keeps unrelated edits intact. */
export async function commitMaterialCommand(repo:Pick<CanonicalWorkspaceRepository,'transaction'>,command:MaterialCommand):Promise<{workspace:WorkspaceV8;changed:boolean}>{
 if(!command.operationId||!command.materialId||!command.taskId)throw Error('MATERIAL_COMMAND_ID_REQUIRED')
 const changedFields=fields.filter(field=>Object.hasOwn(command.changes,field))
 if(!changedFields.length)throw Error('MATERIAL_COMMAND_EMPTY')
 let changed=false
 const workspace=await repo.transaction(current=>{
  const material=current.materials.find(item=>item.id===command.materialId)
  if(!material||!materialOwnerIds(material).includes(command.taskId))throw Error('MATERIAL_COMMAND_NOT_FOUND')
  const goal=goalMaterialScope(material)
  if(goal&&!goalMaterialBelongsToTask(material,current.tasks.find(item=>item.id===command.taskId)))throw Error('MATERIAL_COMMAND_NOT_FOUND')
  if(!equal([...materialOwnerIds(material)].sort(),[...command.expectedOwnerIds].sort()))throw Error('MATERIAL_COMMAND_FIELD_CONFLICT')
  if((command.changes.goalCondition!==undefined||command.changes.goalRequirement!==undefined)&&!goal)throw Error('MATERIAL_COMMAND_SCOPE_INVALID')
  const prefix=`material-command:${command.operationId}:`
  const previous=current.historyRecords.filter(record=>record.id.startsWith(prefix))
  if(previous.length){
   if(previous.some(record=>record.entityId!==material.id||!equal(record.legacyData?.commandChanges,command.changes)||!changedFields.some(field=>record.id===prefix+field&&equal(record.after,command.changes[field]))))throw Error('MATERIAL_COMMAND_ID_REUSED')
   return current
  }
  for(const field of changedFields){
   if(!Object.hasOwn(command.expected,field))throw Error('MATERIAL_COMMAND_BASE_REQUIRED')
   if(!equal(valueOf(material,field),command.expected[field])&&!equal(valueOf(material,field),command.changes[field]))throw Error('MATERIAL_COMMAND_FIELD_CONFLICT')
  }
  if(command.changes.name!==undefined&&!command.changes.name.trim())throw Error('MATERIAL_COMMAND_NAME_REQUIRED')
  if(command.changes.quantity!==undefined&&command.changes.quantity!==null&&(!Number.isSafeInteger(command.changes.quantity)||command.changes.quantity<0))throw Error('MATERIAL_COMMAND_QUANTITY_INVALID')
  if(command.changes.goalCondition!==undefined&&(!command.changes.goalCondition.trim()||command.changes.goalCondition.length>300))throw Error('MATERIAL_COMMAND_SCOPE_INVALID')
  if(command.changes.goalRequirement!==undefined&&command.changes.goalRequirement!=='required'&&command.changes.goalRequirement!=='optional')throw Error('MATERIAL_COMMAND_SCOPE_INVALID')
  const actual=changedFields.filter(field=>!equal(valueOf(material,field),command.changes[field]))
  if(!actual.length)return current
  changed=true
  const {goalCondition,goalRequirement,...changes}=command.changes
  const updated:Material={...material,...changes,...(goal?{legacyData:{...material.legacyData,goalMaterialScope:{...goal,condition:goalCondition??goal.condition,requirement:goalRequirement??goal.requirement}}}:{}),updatedAt:command.changedAt,version:material.version+1}
  const history=actual.map(field=>({id:prefix+field,entityType:'material' as const,entityId:material.id,action:'updated' as const,fieldName:labels[field],before:valueOf(material,field) as JsonValue,after:command.changes[field] as JsonValue,actor:'user' as const,reason:'用户修改材料要求',sourceVersionId:null,changedAt:command.changedAt,legacyData:{commandChanges:JSON.parse(JSON.stringify(command.changes)) as JsonValue}}))
  return {...current,materials:current.materials.map(item=>item.id===material.id?updated:item),historyRecords:[...current.historyRecords,...history]}
 })
 return {workspace,changed}
}
