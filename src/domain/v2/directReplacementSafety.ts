import type {WorkspaceV8} from './types'

const key=(value:unknown)=>typeof value==='string'?value.replace(/\s/gu,'').replace(/^如符合条件/u,''):''
const requirementKey=(value:string)=>key(value.normalize('NFKC')).replace(/[“”‘’「」『』"']/gu,'').toLocaleLowerCase()
function preservesRequirement(before:string,after:string):boolean {
  const previous=requirementKey(before),next=requirementKey(after)
  if(previous===next)return true
  // A combined label may preserve several requirements, but a prohibition
  // mentioning the old format is not equivalent to requesting that format.
  if(/禁止|不得|不接受|不能|无需|不需要|不必|不允许|非/u.test(next))return false
  return next.includes(previous)
}

/** Replacement is conservative and owner-specific: a date on another task is
 * not preservation. No source or existing entity is changed by this check. */
export function directReplacementPreserves(before:WorkspaceV8,after:WorkspaceV8,oldIds:Set<string>,newIds:Set<string>):boolean {
  const oldTasks=before.tasks.filter(t=>oldIds.has(t.id)&&!/^查看[：:]/u.test(t.title))
  const newTasks=after.tasks.filter(t=>newIds.has(t.id))
  const sameTimes=(oldOwner:string,newOwner:string,event=false)=>before.timePoints.filter(p=>p.normalizedValue&&(event?p.eventId===oldOwner:p.relatedTaskIds.includes(oldOwner)))
    .every(p=>after.timePoints.some(n=>n.normalizedValue===p.normalizedValue&&n.type===p.type&&n.precision===p.precision&&(event?n.eventId===newOwner:n.relatedTaskIds.includes(newOwner))))
  for(const old of oldTasks){
    const object=key(old.legacyData?.actionObject)
    const matches=newTasks.filter(t=>key(t.title)===key(old.title)||Boolean(object&&object===key(t.legacyData?.actionObject)))
    if(matches.length!==1||!sameTimes(old.id,matches[0].id))return false
    const next=matches[0]
    for(const material of before.materials.filter(m=>m.relatedTaskIds.includes(old.id))){
      const candidates=after.materials.filter(m=>{
        if(!m.relatedTaskIds.includes(next.id))return false
        if(key(m.name)===key(material.name))return true
        // Some extractors label a material with its format/naming requirements.
        // Accept that representation only when the deliverable itself is still
        // the same task object and the label is an actual material requirement.
        return Boolean(object&&key(material.name)===object&&key(next.legacyData?.actionObject)===object
          &&[...m.requirements,...m.formatRequirements,...m.namingRequirements].some(r=>requirementKey(r)===requirementKey(m.name)))
      })
      const preserved=candidates.some(m=>{
        if(material.submissionChannel&&key(m.submissionChannel)!==key(material.submissionChannel))return false
        const existing=[...material.requirements,...material.formatRequirements,...material.namingRequirements]
        const replacement=[...m.requirements,...m.formatRequirements,...m.namingRequirements]
        return existing.every(r=>replacement.some(n=>preservesRequirement(r,n)))
      })
      if(!preserved)return false
    }
  }
  for(const old of before.events.filter(e=>oldIds.has(e.id))){
    const matches=after.events.filter(e=>newIds.has(e.id)&&key(e.title)===key(old.title))
    if(matches.length!==1||!sameTimes(old.id,matches[0].id,true)||old.location&&key(old.location)!==key(matches[0].location))return false
  }
  return true
}
