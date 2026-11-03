import type {Material} from '../types'

/** Normalize familiar file-format labels for reading; stored facts stay intact. */
export const displayMaterialRequirement=(value:string):string=>value.replace(/\bpdf\b/giu,'PDF').replace(/\bword\b/giu,'Word')

/** Compact presentation of saved facts; it never changes material status or
 * turns a format, page count, or naming instruction into a new task. */
export function materialSummary(materials:readonly Material[]):string {
  const visible=materials.slice(0,3).map(material=>{
    const text=[...(material.formatRequirements??[]),...(material.requirements??[])].join(' ')
    const page=/\d+\s*页(?:及以上|以上|以内|以下)?/u.exec(text)?.[0]?.replace(/\s/gu,'')
    const format=[...text.matchAll(/\b(PDF|WORD|DOCX?|PPTX?|XLSX?)\b/giu)].map(match=>/^word|^doc/iu.test(match[1])?'Word':match[1].toUpperCase()).filter((value,index,all)=>all.indexOf(value)===index).join(' + ')
    const parts=[material.name,page,format].filter((part):part is string=>Boolean(part))
    return [...new Set(parts)].join(' ')
  })
  return visible.join(' · ')+(materials.length>visible.length?` 等${materials.length}项`:'')
}
