import type {Task} from '../types'
import {MaterialFactsList} from './MaterialFactsList'

export function UnassignedSourceMaterials({task}:{task:Task}) {
  const materials=task.sourceUnassignedMaterials??[]
  if(!materials.length)return null
  const goal=materials.filter(material=>material.goalScope),unresolved=materials.filter(material=>!material.goalScope)
  const counts=new Map<string,number>()
  for(const material of materials)for(const value of new Set(material.requirements??[])){
    if(value!=='适用事项待关联')counts.set(value,(counts.get(value)??0)+1)
  }
  const shared=[...counts].filter(([,count])=>count>1).map(([value])=>value)
  const display=materials.map(material=>({...material,requirements:material.requirements?.filter(value=>!shared.includes(value))}))
  return <section>{goal.length>0&&<><h3>本办理事项的条件材料</h3><p>以下要求适用于整个办理事项，具体步骤请参照原通知。</p><MaterialFactsList materials={display.filter(material=>material.goalScope)}/></>}{unresolved.length>0&&<><h3>本通知中待关联的材料</h3><p>以下材料已保留，适用步骤尚未确定，请按原通知中的条件准备。</p><MaterialFactsList materials={display.filter(material=>!material.goalScope)}/></>}{shared.length>0&&<div><h4>原通知说明</h4>{shared.map(value=><p key={value}>{value}</p>)}</div>}</section>
}
