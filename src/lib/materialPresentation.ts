import type {Material} from '../types'

/** Normalize familiar file-format labels for reading; stored facts stay intact. */
export const displayMaterialRequirement=(value:string):string=>value.replace(/\bpdf\b/giu,'PDF').replace(/\bword\b/giu,'Word')

/** A non-required material can be genuinely optional or required only under
 * the source's condition. Keep that distinction visible without changing the
 * canonical material or treating either as an unconditional obligation. */
export function materialOptionalLabel(material:{required?:boolean;requirements?:readonly string[]}):string|undefined {
  if(material.required!==false)return undefined
  if((material.requirements??[]).includes('是否必交待确认'))return '必交与否待确认'
  const conditional=(material.requirements??[]).some(value=>/(?:若|如果|仅当|只有|除非).{0,36}(?:须|必须|需要)/u.test(value))
  return conditional?'按条件或需要准备':'可选'
}

/** Compact presentation of saved facts; it never changes material status or
 * turns a format, page count, or naming instruction into a new task. */
export function materialSummary(materials:readonly Material[]):string {
  const active=materials.filter(material=>!(material.required===false&&material.status==='not_required'))
  const visible=active.slice(0,3).map(material=>{
    const text=[...(material.formatRequirements??[]),...(material.requirements??[])].join(' ')
    const page=/\d+\s*页(?:及以上|以上|以内|以下)?/u.exec(text)?.[0]?.replace(/\s/gu,'')
    const format=[...text.matchAll(/\b(PDF|WORD|DOCX?|PPTX?|XLSX?)\b/giu)].map(match=>/^word|^doc/iu.test(match[1])?'Word':match[1].toUpperCase()).filter((value,index,all)=>all.indexOf(value)===index).join(' + ')
    const parts=[material.name,materialOptionalLabel(material),page,format].filter((part):part is string=>Boolean(part))
    return [...new Set(parts)].join(' ')
  })
  return visible.join(' · ')+(active.length>visible.length?` 等${active.length}项`:'')
}
