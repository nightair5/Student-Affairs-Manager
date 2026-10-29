import type {TaskSuggestionV2} from './types'

const normalize=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'')
const withoutDeliveryMedium=(s:string)=>normalize(s).replace(/线上|在线|网上|网络|系统|平台/gu,'')

/** Resolve an explicitly stated completion-before relationship only when its
 * predecessor is unique among the current source's retained actions. */
export function linkExplicitDependencies(tasks:TaskSuggestionV2[],source:string):void {
  for(const task of tasks){
    const clauses=[...task.description.matchAll(/完成([^，,。；;\n]{2,30}?)后[，,]/gu)]
    for(const clause of clauses){
      if(!source.includes(clause[0]))continue
      const antecedent=withoutDeliveryMedium(clause[1])
      if(/或者|或|任一|任意/u.test(antecedent))continue
      const candidates=tasks.filter(other=>{
        if(other.tempId===task.tempId||!other.actionVerb)return false
        const action=withoutDeliveryMedium(other.actionVerb)
        if(!action||!antecedent.includes(action))return false
        const otherObject=withoutDeliveryMedium(other.actionObject)
        const remaining=antecedent.replace(action,'')
        // A bare action such as “报名” is linkable only if unique below.
        return !remaining || Boolean(otherObject&&(remaining.includes(otherObject)||otherObject.includes(remaining)))
      })
      if(candidates.length!==1)continue
      const prerequisite=candidates[0]
      const reaches=(from:TaskSuggestionV2,target:string,visited:Set<string>):boolean=>{
        if(from.tempId===target)return true
        if(visited.has(from.tempId))return false
        visited.add(from.tempId)
        return from.dependencyTempIds.some(id=>{const next=tasks.find(t=>t.tempId===id);return next?reaches(next,target,visited):false})
      }
      if(reaches(prerequisite,task.tempId,new Set()))continue
      if(!task.dependencyTempIds.includes(prerequisite.tempId))task.dependencyTempIds.push(prerequisite.tempId)
    }
  }
}
