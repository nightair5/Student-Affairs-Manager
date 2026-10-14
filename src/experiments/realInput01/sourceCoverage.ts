import type {SemanticInput} from '../mainline04/semanticContract'
import type {ImmutableScopeIndex} from '../../recognition/scopeReferenceContract'

/** Same evidence edges as the composer. Unresolved evidence is covered, but not decided. */
export function sourceCoverageGaps(input:SemanticInput,index:ImmutableScopeIndex){
  const covered=new Set([
    ...input.tasks.flatMap(t=>[...t.propositionScopeIds,...t.condition.conditionScopeIds,...t.condition.factScopeIds]),
    ...input.materials.flatMap(m=>m.scopeIds),...input.timePoints.flatMap(t=>t.scopeIds),
    ...input.events.flatMap(e=>e.scopeIds),...input.revisions.flatMap(r=>r.scopeIds),
    ...input.conflicts.flatMap(c=>c.scopeIds),...input.informationScopeIds,...input.unresolvedScopeIds,
  ])
  return index.scopes.filter(s=>!covered.has(s.id)||input.unresolvedScopeIds.includes(s.id))
    .map(s=>({...s,reason:input.unresolvedScopeIds.includes(s.id)?'首次回答标为未决，尚需人工判断':'首次回答没有交代这个原文片段'}))
}
