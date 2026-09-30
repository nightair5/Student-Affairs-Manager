import type {WorkspaceV8} from '../../domain/v2/types'
import {effectiveStateFacts,stateOfRuntime} from '../mainline05/semanticState'
import type {SemanticOperation} from '../mainline05/semanticState'

/** A concurrent save may consume only edits of the facts it actually changed. */
export function d22EditBelongsToCommit(key:string|undefined,fields:readonly string[],workspace:WorkspaceV8,draftId:string,operations:readonly SemanticOperation[]=[]){
  if(!key)return false
  const observation=/^task:([^:]+):material-review:([^:]+)$/.exec(key)
  if(observation)return operations.some(op=>op.kind==='review_material'&&op.taskIds.includes(observation[1])&&op.materialReview?.materialId===observation[2])
  const facts=effectiveStateFacts(stateOfRuntime(workspace,draftId)).facts
  const relation=/^relation:(.+):edit$/.exec(key)
  if(relation)return fields.some(value=>value==='revisions'||value==='task:'+relation[1]+':relation'||value.startsWith('task:'+relation[1]+':'))
  const task=/^(?:task|relation):.*?([^:]+):(title|deadline|facts|[^:]+)$/.exec(key)
  if(task){
    const id=task[1],field=task[2]
    const related=facts.tasks.find(row=>row.id===id)
    return fields.some(value=>value.startsWith('task:'+id+':')&&(field==='facts'||field!=='title'&&field!=='deadline'||value==='task:'+id+':'+field)
      ||field!=='title'&&(field==='facts'||field==='deadline')&&(related?.detail.timePointTempIds.some(point=>value.startsWith('time:'+point+':'))
        ||field==='facts'&&related?.detail.materialTempIds.some(material=>value.startsWith('material:'+material+':'))))
  }
  const entity=/^(event|time|material):([^:]+):/.exec(key)
  if(entity)return fields.some(value=>value.startsWith(entity[1]+':'+entity[2]+':')||entity[2]==='new'&&value.startsWith(entity[1]+':'))
  return key.startsWith('disposition.reject.')&&fields.includes(key)
}
