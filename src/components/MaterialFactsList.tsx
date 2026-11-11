import {displayMaterialRequirement,materialOptionalLabel} from '../lib/materialPresentation'

export interface DisplayMaterial {
 id:string; name:string; quantity?:number|null; submissionChannel?:string|null; required?:boolean; status?:string
 requirements?:readonly string[]; formatRequirements?:readonly string[]; namingRequirements?:readonly string[]
}

/** One presentation for the same canonical materials in timeline and details. */
export function MaterialFactsList({materials}:{materials:readonly DisplayMaterial[]}) {
 const distinctChannels=new Set(materials.flatMap(material=>material.submissionChannel?[material.submissionChannel]:[]))
 return <ul className="compact-materials">{materials.map(material=>{
  const requirements=[...new Set([...(material.requirements??[]),...(material.formatRequirements??[]),...(material.namingRequirements??[])])].filter(value=>value&&value!==material.name&&value!=='是否必交待确认'&&value!=='适用事项待关联')
  const quantityAlreadyShown=material.quantity!=null&&requirements.some(value=>new RegExp(`(^|[^0-9])${material.quantity}(?![0-9])`,'u').test(value))
  const optionalLabel=materialOptionalLabel(material)
  return <li key={material.id}><strong>{material.name}</strong>{optionalLabel&&<span>{optionalLabel}</span>}{material.required===false&&material.status==='not_required'&&<span>已从准备清单移除（可恢复）</span>}{material.required===false&&material.status==='ready'&&<span>已准备</span>}{material.quantity!=null&&!quantityAlreadyShown&&<span>数量：{material.quantity}</span>}{requirements.map(value=><span key={value}>{displayMaterialRequirement(value)}</span>)}{distinctChannels.size>1&&material.submissionChannel&&<span>提交：{material.submissionChannel}</span>}</li>
 })}</ul>
}
