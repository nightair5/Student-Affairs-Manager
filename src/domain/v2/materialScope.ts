import type {Material,Task} from './types'

export interface GoalMaterialScope {
  taskIds: string[]
  condition: string
  requirement: 'required'|'optional'
}

/** Goal materials are shared only by the explicitly recorded members of this
 * source and recognition run. An unresolved material has no inferred owner. */
export function goalMaterialScope(material:Material):GoalMaterialScope|null {
  if(material.legacyData?.assignment!=='goal')return null
  const value=material.legacyData.goalMaterialScope
  if(!value||typeof value!=='object'||Array.isArray(value))return null
  const {taskIds,condition,requirement}=value
  if(!Array.isArray(taskIds)||!taskIds.length||!taskIds.every((id):id is string=>typeof id==='string'&&id.length>0)||typeof condition!=='string'||!condition.trim()||(requirement!=='required'&&requirement!=='optional'))return null
  return {taskIds:[...new Set(taskIds)],condition,requirement}
}

export function materialOwnerIds(material:Material):string[] {
  return material.relatedTaskIds.length?material.relatedTaskIds:goalMaterialScope(material)?.taskIds??[]
}

export function goalMaterialBelongsToTask(material:Material,task:Task|undefined):boolean {
  const scope=goalMaterialScope(material)
  return Boolean(task&&scope?.taskIds.includes(task.id)&&material.legacyData?.sourceId&&material.legacyData?.recognitionRunId&&task.legacyData?.sourceId===material.legacyData.sourceId&&task.legacyData?.recognitionRunId===material.legacyData.recognitionRunId)
}
