import {createHash} from 'node:crypto'

export const CANDIDATE14_REFERENCE_VERSION='candidate14-reference-contract-5.3.0'
export const CANDIDATE14_SCORER_VERSION='candidate14-scoring-5.3.0'
export const sha256=value=>createHash('sha256').update(value).digest('hex')
export const canonical=value=>JSON.stringify(sort(value))
const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sort(v)])):value
// Punctuation and spacing are presentation differences. Mathematical/currency symbols carry meaning.
export const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]+/gu,'')
const allowed={actor:['addressee','addressed_group','issuer','third_party','unknown'],currentness:['current','historical','cancelled','superseded','unknown'],condition:['true','false','unknown','not_applicable'],actionability:['actionable','not_actionable','needs_confirmation'],defaultSelection:['selected','not_selected','not_applicable'],confirmation:['required']}
const timeTypes=['registration_deadline','submission_deadline','task_deadline','event_start','event_end','result_announcement','planned_start']
const timePrecision=['exact','date_only','relative','vague']
const check=(v,c)=>{if(!v)throw Error('CANDIDATE14_REFERENCE_'+c)}
const uniqueStrings=(value,code)=>{check(value==='N/A'||Array.isArray(value),code);if(value==='N/A')return;check(value.every(row=>typeof row==='string'&&normalize(row))&&new Set(value.map(normalize)).size===value.length,code)}

export function validateCandidate14Reference(reference){
  check(reference?.version===CANDIDATE14_REFERENCE_VERSION,'VERSION')
  check(typeof reference.sourceId==='string'&&reference.sourceId&&['complete','partial'].includes(reference.completeness),'IDENTITY')
  check(typeof reference.referenceTime==='string'&&Number.isFinite(Date.parse(reference.referenceTime))&&typeof reference.timezone==='string'&&reference.timezone,'CLOCK')
  check(Array.isArray(reference.tasks)&&Array.isArray(reference.relations)&&Array.isArray(reference.noTaskFacts)&&Array.isArray(reference.allowedAliases)&&reference.scopeTextById&&typeof reference.scopeTextById==='object'&&!Array.isArray(reference.scopeTextById),'ARRAYS')
  const aliases=new Map();for(const row of reference.allowedAliases){check(row&&typeof row.canonical==='string'&&Array.isArray(row.aliases),'ALIAS_SHAPE');for(const value of [row.canonical,...row.aliases]){const n=normalize(value);check(n&&!aliases.has(n),'ALIAS_COLLISION');aliases.set(n,normalize(row.canonical))}}
  const ids=new Set();for(const task of reference.tasks){
    check(task&&typeof task.id==='string'&&!ids.has(task.id),'TASK_ID');ids.add(task.id)
    for(const key of Object.keys(allowed))check(allowed[key].includes(task[key]),'ENUM_'+key.toUpperCase())
    for(const key of ['action','object'])check(task[key]&&typeof task[key].canonical==='string'&&Array.isArray(task[key].aliases)&&[task[key].canonical,...task[key].aliases].every(value=>typeof value==='string'&&normalize(value)),'FIELD_'+key.toUpperCase())
    uniqueStrings(task.materials,'FIELD_MATERIALS');uniqueStrings(task.completionStandards,'FIELD_COMPLETIONSTANDARDS');uniqueStrings(task.dependencies,'FIELD_DEPENDENCIES')
    check(task.times==='N/A'||Array.isArray(task.times),'FIELD_TIMES')
    if(task.times!=='N/A')for(const time of task.times)check(time&&timeTypes.includes(time.type)&&typeof time.rawText==='string'&&normalize(time.rawText)&&typeof time.normalizedValue==='string'&&time.normalizedValue&&time.timezone===reference.timezone&&typeof time.isAllDay==='boolean'&&timePrecision.includes(time.precision)&&typeof time.needsConfirmation==='boolean','TIME_FACT')
    check(Array.isArray(task.scopeIds)&&task.scopeIds.length&&task.scopeIds.every(id=>typeof id==='string'&&id&&typeof reference.scopeTextById[id]==='string')&&new Set(task.scopeIds).size===task.scopeIds.length,'SCOPES')
    if(task.condition==='false')check(task.actionability==='not_actionable'&&task.defaultSelection==='not_selected','FALSE_REACHABILITY')
    if(task.condition==='unknown')check(task.actionability==='needs_confirmation'&&task.defaultSelection==='not_selected','UNKNOWN_REACHABILITY')
    if(['historical','cancelled','superseded'].includes(task.currentness))check(task.actionability==='not_actionable'&&task.defaultSelection==='not_selected','CURRENTNESS_REACHABILITY')
    if(task.actionability==='actionable')check(task.currentness==='current'&&['true','not_applicable'].includes(task.condition)&&task.defaultSelection==='selected','ACTIONABLE_REACHABILITY')
    if(task.actionability!=='actionable')check(task.defaultSelection==='not_selected','SELECTION_REACHABILITY')
  }
  const taskById=new Map(reference.tasks.map(task=>[task.id,task]))
  for(const task of reference.tasks)if(task.dependencies!=='N/A')for(const id of task.dependencies)check(ids.has(id)&&id!==task.id,'DEPENDENCY')
  const visiting=new Set(),visited=new Set();const visit=id=>{if(visiting.has(id))throw Error('CANDIDATE14_REFERENCE_DEPENDENCY_CYCLE');if(visited.has(id))return;visiting.add(id);const task=taskById.get(id);for(const dependency of task.dependencies==='N/A'?[]:task.dependencies)visit(dependency);visiting.delete(id);visited.add(id)};for(const id of ids)visit(id)
  const relationKeys=new Set();for(const relation of reference.relations){check(['supersedes','cancels','amends'].includes(relation.type)&&ids.has(relation.targetTaskId)&&(relation.fromTaskId===null||ids.has(relation.fromTaskId))&&relation.fromTaskId!==relation.targetTaskId&&['true','false','unknown'].includes(relation.effective),'RELATION');const key=canonical([relation.type,relation.fromTaskId,relation.targetTaskId,relation.effective]);check(!relationKeys.has(key),'RELATION_DUPLICATE');relationKeys.add(key);if(Object.hasOwn(relation,'continuitySlot'))check(typeof relation.continuitySlot==='string'&&relation.continuitySlot,'RELATION_SLOT');if(relation.effective==='true'){const target=taskById.get(relation.targetTaskId),from=relation.fromTaskId===null?null:taskById.get(relation.fromTaskId);if(relation.type==='supersedes')check(target.currentness==='superseded'&&from?.currentness==='current','RELATION_STATE');if(relation.type==='cancels')check(target.currentness==='cancelled','RELATION_STATE')}}
  check(reference.noTaskFacts.every(row=>row&&['event','time','location','prohibition','quoted_third_party_directive','pending_announcement','information'].includes(row.kind)&&typeof row.value==='string'&&normalize(row.value)&&Array.isArray(row.scopeIds)&&row.scopeIds.length&&new Set(row.scopeIds).size===row.scopeIds.length&&row.scopeIds.every(id=>typeof reference.scopeTextById[id]==='string')&&row.scopeIds.some(id=>normalize(reference.scopeTextById[id]).includes(normalize(row.value))||normalize(row.value).includes(normalize(reference.scopeTextById[id])))),'NO_TASK_FACT')
  if(reference.noTaskFacts.some(row=>row.kind==='location'))check(reference.noTaskFacts.some(row=>row.kind==='event'),'NO_TASK_LOCATION_WITHOUT_EVENT')
  return structuredClone(reference)
}

export function legalWireOracle(reference){
  const checked=validateCandidate14Reference(reference)
  return {tasks:checked.tasks.map(task=>({id:task.id,semantics:{actor:task.actor,speechAct:'directive',polarity:task.actionability==='not_actionable'?'negative':'affirmative',tense:task.currentness==='historical'?'past':'future',status:task.currentness==='cancelled'?'cancelled':task.currentness==='historical'?'completed':'pending',validity:task.currentness==='superseded'?'superseded':task.currentness==='unknown'?'uncertain':'active',modality:task.actionability==='actionable'?'required':'informational'},condition:task.condition,selected:task.defaultSelection==='selected',needsConfirmation:task.confirmation==='required'})),relations:checked.relations}
}

export function referenceFingerprint(reference){return sha256(canonical(validateCandidate14Reference(reference)))}
