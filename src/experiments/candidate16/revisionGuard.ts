import type {SemanticInput} from '../mainline04/semanticContract'

export interface RevisionProblem {code:string;relationIndex:number;taskIds:string[];unbound:boolean}
/** Structural validation only: a dangling endpoint is never replaced with a guessed ID. */
export function inspectRevisionLinks(input:SemanticInput):RevisionProblem[]{
  const byId=new Map(input.tasks.map(t=>[t.id,t])),scopeIds=new Set(input.tasks.flatMap(t=>[...t.propositionScopeIds,t.action.scopeId,t.object.scopeId]))
  const problems:RevisionProblem[]=[]
  input.revisions.forEach((r,i)=>{
    const ids=[r.targetDirectiveId,...(r.fromDirectiveId?[r.fromDirectiveId]:[])],present=ids.filter(id=>byId.has(id))
    const invalid=ids.some(id=>!byId.has(id)) || r.targetDirectiveId===r.fromDirectiveId || (r.type==='cancels'?r.fromDirectiveId!==null:r.fromDirectiveId===null)
    const target=byId.get(r.targetDirectiveId)
    const unsafeState=r.effective==='true'&&target&&(r.type==='cancels'?target.semantics.status!=='cancelled':r.type==='supersedes'?target.semantics.validity!=='superseded':false)
    if(invalid||unsafeState)problems.push({code:ids.some(id=>scopeIds.has(id)&&!byId.has(id))?'SCOPE_USED_AS_TASK':invalid?'MISSING_OR_INVALID_ENDPOINT':'OLD_ENDPOINT_STILL_ACTIVE',relationIndex:i,taskIds:present,unbound:present.length===0})
  })
  // Propagate only through explicit relationship/dependency edges. No matching by title.
  for(const p of problems){const affected=new Set(p.taskIds);let prior=-1
    while(prior!==affected.size){prior=affected.size
      for(const r of input.revisions)if(affected.has(r.targetDirectiveId)||(r.fromDirectiveId&&affected.has(r.fromDirectiveId))){if(byId.has(r.targetDirectiveId))affected.add(r.targetDirectiveId);if(r.fromDirectiveId&&byId.has(r.fromDirectiveId))affected.add(r.fromDirectiveId)}
      for(const t of input.tasks)if(t.detail.dependencyTempIds.some(id=>affected.has(id))||(t.detail.parentTempId&&affected.has(t.detail.parentTempId)))affected.add(t.id)
    }p.taskIds=[...affected].sort()
  }
  return problems
}
export function assertRevisionSelection(input:SemanticInput,selected:readonly string[]){
  const problems=inspectRevisionLinks(input)
  if(problems.some(p=>p.unbound||p.taskIds.some(id=>selected.includes(id))))throw Error('D13_REVISION_CONFIRMATION_BLOCKED')
}
