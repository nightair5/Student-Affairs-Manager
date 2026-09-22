import {createHash} from 'node:crypto'

export const CANDIDATE14_REFERENCE_VERSION='candidate14-reference-contract-5.0.0'
export const CANDIDATE14_SCORER_VERSION='candidate14-scoring-5.0.0'
export const sha256=value=>createHash('sha256').update(value).digest('hex')
export const canonical=value=>JSON.stringify(sort(value))
const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sort(v)])):value
export const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'')
const allowed={actor:['addressee','addressed_group','issuer','third_party','unknown'],currentness:['current','historical','cancelled','superseded','unknown'],condition:['true','false','unknown','not_applicable'],actionability:['actionable','not_actionable','needs_confirmation'],defaultSelection:['selected','not_selected','not_applicable'],confirmation:['required','not_required','not_applicable']}
const check=(v,c)=>{if(!v)throw Error('CANDIDATE14_REFERENCE_'+c)}

export function validateCandidate14Reference(reference){
  check(reference?.version===CANDIDATE14_REFERENCE_VERSION,'VERSION')
  check(typeof reference.sourceId==='string'&&reference.sourceId&&['complete','partial'].includes(reference.completeness),'IDENTITY')
  check(Array.isArray(reference.tasks)&&Array.isArray(reference.noTaskFacts)&&Array.isArray(reference.allowedAliases),'ARRAYS')
  const aliases=new Map();for(const row of reference.allowedAliases){check(row&&typeof row.canonical==='string'&&Array.isArray(row.aliases),'ALIAS_SHAPE');for(const value of [row.canonical,...row.aliases]){const n=normalize(value);check(n&&!aliases.has(n),'ALIAS_COLLISION');aliases.set(n,normalize(row.canonical))}}
  const ids=new Set();for(const task of reference.tasks){
    check(task&&typeof task.id==='string'&&!ids.has(task.id),'TASK_ID');ids.add(task.id)
    for(const key of Object.keys(allowed))check(allowed[key].includes(task[key]),'ENUM_'+key.toUpperCase())
    for(const key of ['action','object'])check(task[key]&&typeof task[key].canonical==='string'&&Array.isArray(task[key].aliases),'FIELD_'+key.toUpperCase())
    for(const key of ['materials','times','completionStandards','dependencies'])check(task[key]==='N/A'||Array.isArray(task[key]),'FIELD_'+key.toUpperCase())
    check(Array.isArray(task.scopeIds)&&task.scopeIds.length,'SCOPES')
  }
  for(const task of reference.tasks)if(Array.isArray(task.dependencies))for(const id of task.dependencies)check(ids.has(id),'DEPENDENCY')
  check(reference.noTaskFacts.every(row=>row&&typeof row.kind==='string'&&Array.isArray(row.scopeIds)&&row.scopeIds.length),'NO_TASK_FACT')
  return structuredClone(reference)
}

export function legalWireOracle(reference){
  const checked=validateCandidate14Reference(reference)
  return checked.tasks.map(task=>({id:task.id,semantics:{actor:task.actor,speechAct:'directive',polarity:task.actionability==='not_actionable'?'negative':'affirmative',tense:task.currentness==='historical'?'past':'future',status:task.currentness==='cancelled'?'cancelled':task.currentness==='historical'?'completed':'pending',validity:task.currentness==='superseded'?'superseded':task.currentness==='unknown'?'uncertain':'active',modality:task.actionability==='actionable'?'required':'informational'},condition:task.condition,selected:task.defaultSelection==='selected',needsConfirmation:task.confirmation==='required'}))
}

export function referenceFingerprint(reference){return sha256(canonical(validateCandidate14Reference(reference)))}
