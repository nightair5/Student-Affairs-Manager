import type {CanonicalWorkspaceRepository} from './repository'
import type {JsonValue,WorkspaceV8} from './types'

type Material=WorkspaceV8['materials'][number]
type Field='name'|'quantity'|'formatRequirements'|'namingRequirements'|'requirements'|'submissionChannel'|'status'
export type MaterialCommandValues=Partial<Pick<Material,Field>>
export interface MaterialCommand {operationId:string;materialId:string;taskId:string;expected:MaterialCommandValues;expectedOwnerIds:string[];changes:MaterialCommandValues;changedAt:string}
const fields:Field[]=['name','quantity','formatRequirements','namingRequirements','requirements','submissionChannel','status']
const labels:Record<Field,string>={name:'材料名称',quantity:'数量',formatRequirements:'格式',namingRequirements:'命名要求',requirements:'材料要求',submissionChannel:'提交渠道',status:'准备状态'}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)

/** A user edits the existing canonical material, including any explicitly
 * shared owners. Field-level compare-and-set keeps unrelated edits intact. */
export async function commitMaterialCommand(repo:Pick<CanonicalWorkspaceRepository,'transaction'>,command:MaterialCommand):Promise<{workspace:WorkspaceV8;changed:boolean}>{
 if(!command.operationId||!command.materialId||!command.taskId)throw Error('MATERIAL_COMMAND_ID_REQUIRED')
 const changedFields=fields.filter(field=>Object.hasOwn(command.changes,field))
 if(!changedFields.length)throw Error('MATERIAL_COMMAND_EMPTY')
 let changed=false
 const workspace=await repo.transaction(current=>{
  const material=current.materials.find(item=>item.id===command.materialId)
  if(!material||!material.relatedTaskIds.includes(command.taskId))throw Error('MATERIAL_COMMAND_NOT_FOUND')
  if(!equal([...material.relatedTaskIds].sort(),[...command.expectedOwnerIds].sort()))throw Error('MATERIAL_COMMAND_FIELD_CONFLICT')
  const prefix=`material-command:${command.operationId}:`
  const previous=current.historyRecords.filter(record=>record.id.startsWith(prefix))
  if(previous.length){
   if(previous.some(record=>record.entityId!==material.id||!equal(record.legacyData?.commandChanges,command.changes)||!changedFields.some(field=>record.id===prefix+field&&equal(record.after,command.changes[field]))))throw Error('MATERIAL_COMMAND_ID_REUSED')
   return current
  }
  for(const field of changedFields){
   if(!Object.hasOwn(command.expected,field))throw Error('MATERIAL_COMMAND_BASE_REQUIRED')
   if(!equal(material[field],command.expected[field])&&!equal(material[field],command.changes[field]))throw Error('MATERIAL_COMMAND_FIELD_CONFLICT')
  }
  if(command.changes.name!==undefined&&!command.changes.name.trim())throw Error('MATERIAL_COMMAND_NAME_REQUIRED')
  if(command.changes.quantity!==undefined&&command.changes.quantity!==null&&(!Number.isSafeInteger(command.changes.quantity)||command.changes.quantity<0))throw Error('MATERIAL_COMMAND_QUANTITY_INVALID')
  const actual=changedFields.filter(field=>!equal(material[field],command.changes[field]))
  if(!actual.length)return current
  changed=true
  const updated={...material,...command.changes,updatedAt:command.changedAt,version:material.version+1}
  const history=actual.map(field=>({id:prefix+field,entityType:'material' as const,entityId:material.id,action:'updated' as const,fieldName:labels[field],before:material[field] as JsonValue,after:command.changes[field] as JsonValue,actor:'user' as const,reason:'用户修改材料要求',sourceVersionId:null,changedAt:command.changedAt,legacyData:{commandChanges:JSON.parse(JSON.stringify(command.changes)) as JsonValue}}))
  return {...current,materials:current.materials.map(item=>item.id===material.id?updated:item),historyRecords:[...current.historyRecords,...history]}
 })
 return {workspace,changed}
}
