import {canonical, normalize, validateCandidate15Reference, CANDIDATE15_REFERENCE_VERSION} from './candidate15-reference-contract.mjs'

export const REFERENCE_V7 = 'recognition-reference-7.0.0'
export const SCORER_V7 = 'recognition-semantic-scoring-7.0.0'
const list = value => value === 'N/A' ? [] : value
const eq = (value, field) => [field.canonical, ...field.aliases].some(x => normalize(x) === normalize(value))
const same = (a,b) => canonical(a) === canonical(b)
const setEqual = (a,b) => same([...a].sort(), [...b].sort())
const factsEqual = (a,b) => setEqual(a.map(normalize),b.map(normalize))
const check = (v,code) => { if(!v) throw Error('V7_REFERENCE_' + code) }
export const currentnessV7 = t => t.semantics.status === 'cancelled' ? 'cancelled' : t.semantics.validity === 'superseded' ? 'superseded' : t.semantics.tense === 'past' || t.semantics.status === 'completed' ? 'historical' : t.semantics.validity === 'uncertain' ? 'unknown' : 'current'
export const actionabilityV7 = t => currentnessV7(t) !== 'current' || t.semantics.polarity === 'negative' || t.semantics.modality === 'prohibited' || t.condition.value === 'false' ? 'not_actionable' : t.condition.value === 'unknown' ? 'needs_confirmation' : t.semantics.modality === 'informational' ? 'not_actionable' : 'actionable'

/** Reference alternatives are predeclared, complete semantic representations, never answer-dependent patches. */
export function validateReferenceV7(ref) {
  check(ref?.version === REFERENCE_V7 && ['complete','partial','unresolved'].includes(ref.completeness),'IDENTITY')
  check(ref.truthStatus === 'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL' && Array.isArray(ref.representations) && ref.representations.length > 0,'PROVENANCE')
  check(Array.isArray(ref.forbiddenActions) && Array.isArray(ref.unresolved),'ANNOTATIONS')
  check(ref.completeness !== 'complete' || ref.unresolved.length === 0,'UNRESOLVED_COMPLETE')
  for(const variant of ref.representations) {
    validateCandidate15Reference({...variant, version:CANDIDATE15_REFERENCE_VERSION, completeness:'complete'})
    check(variant.sourceId === ref.sourceId,'SOURCE')
    for(const task of variant.tasks) for(const key of ['proposition','condition','fact']) {
      const p = task.evidencePolicy?.[key]
      check(p && Array.isArray(p.requiredAnyOf) && Array.isArray(p.allowed) && Array.isArray(p.contradictory),'POLICY')
      check([...p.allowed,...p.contradictory,...p.requiredAnyOf.flat()].every(id => id in variant.scopeTextById),'POLICY_SCOPE')
      check(p.requiredAnyOf.every(group => group.length && group.every(id => p.allowed.includes(id))),'POLICY_REQUIRED')
      check(!p.allowed.some(id => p.contradictory.includes(id)),'POLICY_CONTRADICTION')
    }
  }
  return ref
}
export function scopeSupport(policy, ids) {
  const duplicates = new Set(ids).size !== ids.length
  return {pass:!duplicates && policy.requiredAnyOf.every(group => group.some(id => ids.includes(id))) && ids.every(id => policy.allowed.includes(id)) && !ids.some(id => policy.contradictory.includes(id)),
    missing:policy.requiredAnyOf.filter(group => !group.some(id => ids.includes(id))), unrelated:ids.filter(id => !policy.allowed.includes(id) && !policy.contradictory.includes(id)), contradictory:ids.filter(id => policy.contradictory.includes(id))}
}
const timeSignature = t => ({type:t.type,rawText:normalize(t.rawText),normalizedValue:t.normalizedValue,timezone:t.timezone,isAllDay:t.isAllDay,precision:t.precision,needsConfirmation:t.needsConfirmation})
const timesEqual = (a,b) => setEqual(a.map(t => canonical(timeSignature(t))),b.map(t => canonical(timeSignature(t))))
const compare = (expected,actual) => ({pass:same(expected,actual),expected,actual})
function taskFields(e,a,result,mapping,ref) {
  const materialIds = a.detail.materialTempIds, timeIds = a.detail.timePointTempIds
  const materials = result.materials.filter(m => materialIds.includes(m.tempId))
  const actualMaterial = materials.flatMap(m => [...(eq(m.name,e.object)?[]:[m.name]),...m.formatRequirements,...m.namingRequirements,...(m.submissionChannel?[m.submissionChannel]:[])])
  const surface = (field,actual) => eq(actual.surface,field) && typeof ref.scopeTextById[actual.scopeId] === 'string' && ref.scopeTextById[actual.scopeId].includes(actual.surface)
  const materialDetailsPass=materials.length===e.materialDetails.length&&e.materialDetails.every(expected=>materials.some(actual=>normalize(actual.name)===normalize(expected.name)&&actual.required===expected.required&&actual.quantity===expected.quantity&&factsEqual(actual.formatRequirements,expected.formatRequirements)&&factsEqual(actual.namingRequirements,expected.namingRequirements)&&normalize(actual.submissionChannel)===normalize(expected.submissionChannel)&&setEqual(actual.relatedTaskTempIds,expected.relatedTaskTempIds.map(id=>mapping.get(id)))&&scopeSupport(expected.evidencePolicy,actual.scopeIds).pass))
  return {
    action:{pass:surface(e.action,a.action)},object:{pass:surface(e.object,a.object)},
    actor:compare(e.actor,a.semantics.actor),speechAct:compare('directive',a.semantics.speechAct),
    currentness:compare(e.currentness,currentnessV7(a)),condition:compare(e.condition,a.condition.value),
    actionability:compare(e.actionability,actionabilityV7(a)),confirmation:compare(true,a.detail.userConfirmationRequired),
    modality:{pass:e.actionability === 'actionable' ? a.semantics.modality === 'required' : ['required','informational'].includes(a.semantics.modality)},
    propositionScopes:scopeSupport(e.evidencePolicy.proposition,a.propositionScopeIds),
    conditionScopes:scopeSupport(e.evidencePolicy.condition,a.condition.conditionScopeIds),
    factScopes:scopeSupport(e.evidencePolicy.fact,a.condition.factScopeIds),
    materials:{pass:materials.length === materialIds.length && factsEqual(list(e.materials),actualMaterial)},
    materialDetails:{pass:materialDetailsPass},
    times:{pass:timesEqual(list(e.times),result.timePoints.filter(t => timeIds.includes(t.tempId)))&&e.timeEvidence.every(t=>result.timePoints.some(p=>timeIds.includes(p.tempId)&&normalize(p.rawText)===normalize(t.rawText)&&p.type===t.type&&setEqual(p.relatedTaskTempIds,t.relatedTaskTempIds.map(id=>mapping.get(id)))&&scopeSupport(t.evidencePolicy,p.scopeIds).pass))},
    completionStandards:{pass:factsEqual(list(e.completionStandards),a.detail.completionCriteria)},
    dependencies:{pass:list(e.dependencies).every(id => mapping.has(id)) && setEqual(list(e.dependencies).map(id=>mapping.get(id)),a.detail.dependencyTempIds)},
    hierarchy:{pass:a.detail.hierarchyType===e.hierarchyType&&a.detail.parentTempId===(e.parentTaskId===null?null:mapping.get(e.parentTaskId))},
  }
}
function independentFacts(ref,result) {
  const checks = [], actualEvents = result.events, expectedEvents = ref.noTaskFacts.filter(f => f.kind === 'event')
  const independentTimes = result.timePoints.filter(t => !t.relatedTaskTempIds.length), expectedTimes = ref.noTaskFacts.filter(f => f.kind === 'time')
  const coverage = new Set([...result.informationScopeIds,...actualEvents.flatMap(e=>e.scopeIds),...independentTimes.flatMap(t=>t.scopeIds)])
  const valueMatch = (value,f) => [f.value,...f.aliases].some(v=>normalize(v)===normalize(value))
  const scopeMatch = (actual,f) => f.scopeIds.every(id=>actual.includes(id)) && actual.every(id=>f.scopeIds.includes(id))
  const timeMatch = (actual,f) => actual && valueMatch(actual.rawText,f) && same(timeSignature(actual),timeSignature(f.time)) && scopeMatch(actual.scopeIds,f)
  for(const f of ref.noTaskFacts) {
    let pass = f.scopeIds.every(id=>coverage.has(id))
    if(f.kind==='information') pass = pass && f.scopeIds.every(id=>result.informationScopeIds.includes(id))
    if(f.kind==='time') pass = pass && independentTimes.some(t=>timeMatch(t,f))
    if(f.kind==='event') pass = pass && actualEvents.some(e=> {
      const times=f.timeFactIds.map(id=>ref.noTaskFacts.find(t=>t.id===id))
      const start=times.find(t=>t.time.type==='event_start'),end=times.find(t=>t.time.type==='event_end')
      const locations=f.locationFactIds.map(id=>ref.noTaskFacts.find(t=>t.id===id))
      return valueMatch(e.title,f) && scopeMatch(e.scopeIds,f) && !normalize(e.description) && !e.relatedTaskTempIds.length
        && (start?timeMatch(result.timePoints.find(t=>t.tempId===e.startTimePointTempId),start):e.startTimePointTempId===null)
        && (end?timeMatch(result.timePoints.find(t=>t.tempId===e.endTimePointTempId),end):e.endTimePointTempId===null)
        && (locations.length?locations.some(l=>valueMatch(e.location,l)):!normalize(e.location))
    })
    if(f.kind==='location') pass = pass && actualEvents.some(e=>valueMatch(e.location,f))
    checks.push({id:f.id,pass})
  }
  const allowedInformation = new Set([...ref.noTaskFacts.flatMap(f=>f.scopeIds),...ref.tasks.filter(t=>t.actionability!=='actionable').flatMap(t=>t.scopeIds)])
  const unresolvedAllowed = new Set(ref.tasks.filter(t=>t.condition==='unknown').flatMap(t=>t.scopeIds))
  const materialIds = new Set(result.tasks.flatMap(t=>t.detail.materialTempIds)), timeIds=new Set(result.tasks.flatMap(t=>t.detail.timePointTempIds))
  const extraEntities = result.materials.filter(m=>!materialIds.has(m.tempId)).length + result.timePoints.filter(t=>!timeIds.has(t.tempId)&&!expectedTimes.some(f=>timeMatch(t,f))).length
  return {pass:checks.every(c=>c.pass) && actualEvents.length===expectedEvents.length && independentTimes.length===expectedTimes.length && result.informationScopeIds.every(id=>allowedInformation.has(id)) && result.unresolvedScopeIds.every(id=>unresolvedAllowed.has(id)) && !result.conflicts.length && !extraEntities,checks,extraEntities}
}
// Presence matching is intentionally distinct from atomic-action field quality.
const presenceMatch = (e,a) => eq(a.object.surface,e.object) && (eq(a.action.surface,e.action) || normalize(a.action.surface).includes(normalize(e.action.canonical)))
function mappings(expected,actual,i=0,used=new Set(),map=[],out=[]) {
  if(out.length>=10000)throw Error('MATCHING_SEARCH_BOUND_EXCEEDED')
  if(i===expected.length){out.push([...map]);return out}
  map.push(null);mappings(expected,actual,i+1,used,map,out);map.pop()
  for(let j=0;j<actual.length;j++) if(!used.has(j)&&presenceMatch(expected[i],actual[j])){used.add(j);map.push(j);mappings(expected,actual,i+1,used,map,out);map.pop();used.delete(j)}
  return out
}
function scoreVariant(ref,result,prohibited) {
  // Bounded by the frozen small Development references, not an unbounded combinatorial production matcher.
  if(ref.tasks.length>8 || result.tasks.length>20) return {status:'MEASUREMENT_ERROR',complete:false,reason:'MATCHING_BOUND_EXCEEDED'}
  let assignments
  try{assignments=mappings(ref.tasks,result.tasks)}catch(error){return {status:'MEASUREMENT_ERROR',complete:false,reason:error.message}}
  const possibilities = assignments.map(indices=> {
    const mapped=new Map(ref.tasks.flatMap((t,i)=>indices[i]===null?[]:[[t.id,result.tasks[indices[i]].id]]))
    const matches=ref.tasks.map((t,i)=>({expectedId:t.id,actualId:indices[i]===null?null:result.tasks[indices[i]].id,fields:indices[i]===null?null:taskFields(t,result.tasks[indices[i]],result,mapped,ref)}))
    const tp=indices.filter(x=>x!==null).length,fn=ref.tasks.length-tp,fp=result.tasks.length-tp
    const fieldErrors=matches.flatMap(m=>m.fields?Object.entries(m.fields).filter(([,v])=>!v.pass).map(([field,details])=>({expectedId:m.expectedId,actualId:m.actualId,field,...details})):[])
    const relation=r=>({type:r.type,target:mapped.get(r.targetTaskId),from:r.fromTaskId===null?null:mapped.get(r.fromTaskId),effective:r.effective})
    const relationActual=r=>({type:r.type,target:r.targetDirectiveId,from:r.fromDirectiveId,effective:r.effective})
    const relationsPass=setEqual(ref.relations.map(r=>canonical(relation(r))),result.revisions.map(r=>canonical(relationActual(r))))&&ref.relations.every(r=>result.revisions.some(a=>same(relation(r),relationActual(a))&&scopeSupport(r.evidencePolicy,a.scopeIds).pass))
    const forbiddenTasks=result.tasks.filter(t=>actionabilityV7(t)==='actionable'&&prohibited.some(p=>eq(t.action.surface,p.action)&&eq(t.object.surface,p.object)))
    const currentFn=ref.tasks.filter((t,i)=>t.actionability==='actionable'&&indices[i]===null).length
    const currentFp=result.tasks.filter((t,j)=>actionabilityV7(t)==='actionable'&&!indices.includes(j)).length
    const auxiliary=independentFacts(ref,result),keyMajor=fieldErrors.filter(e=>!e.field.endsWith('Scopes')).length+Number(!relationsPass)+Number(!auxiliary.pass)
    const severe=forbiddenTasks.length+Number(!relationsPass)+fieldErrors.filter(e=>['times','currentness','condition','actionability','dependencies'].includes(e.field)).length
    return {status:'SCORED',complete:!fn&&!fp&&!fieldErrors.length&&relationsPass&&auxiliary.pass&&!forbiddenTasks.length,
      taskPresence:{tp,fp,fn,expected:ref.tasks.length,actual:result.tasks.length},currentTaskRisk:{fn:currentFn,unsupportedActionable:currentFp},
      fullyCorrectTasks:matches.filter(m=>m.fields&&Object.values(m.fields).every(f=>f.pass)).length,
      severity:{severe,major:fieldErrors.length+Number(!relationsPass)+Number(!auxiliary.pass),forbidden:forbiddenTasks.length,keyMajor},forbiddenTaskIds:forbiddenTasks.map(t=>t.id),relationsPass,auxiliary,matches,fieldErrors}
  })
  possibilities.sort((a,b)=>b.taskPresence.tp-a.taskPresence.tp || a.severity.major-b.severity.major)
  return possibilities[0]
}
export function scoreSemanticV7(reference,result,{schemaValid=true,referenceValid=true}={}) {
  try { validateReferenceV7(reference) } catch(error) {return {version:SCORER_V7,status:'REFERENCE_INVALID',complete:false,reason:error.message}}
  if(!schemaValid || !result) return {version:SCORER_V7,status:'SCHEMA_FAILURE',complete:false}
  if(!referenceValid) return {version:SCORER_V7,status:'REFERENCE_LINK_FAILURE',complete:false}
  const scores=reference.representations.map(v=>scoreVariant(v,result,reference.forbiddenActions))
  if(scores.some(s=>s.status==='MEASUREMENT_ERROR'))return {version:SCORER_V7,...scores.find(s=>s.status==='MEASUREMENT_ERROR')}
  scores.sort((a,b)=>Number(b.complete)-Number(a.complete) || a.taskPresence.fn+a.taskPresence.fp-b.taskPresence.fn-b.taskPresence.fp || a.severity.major-b.severity.major)
  const best=scores[0]
  return {version:SCORER_V7,...best,status:reference.completeness==='complete'?best.status:'REFERENCE_'+reference.completeness.toUpperCase(),complete:reference.completeness==='complete'&&best.complete,referenceCompleteness:reference.completeness,referenceTruth:reference.truthStatus}
}
