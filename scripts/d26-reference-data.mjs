import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {d26Components} from './d26-components.mjs'
import {validateReferenceV7} from './recognition-semantic-v7.mjs'

// Source-authored assertions. Never imported from or overwritten by a parser result.
export const D26_SOURCE_TIME_ASSERTIONS=[
  {sourceId:'D26-S01',rawText:'周三晚',type:'event_start',normalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true,reason:'Weekday and evening are retained verbatim; the week and clock are not asserted.'},
  {sourceId:'D26-S02',rawText:'周四晚',type:'event_start',normalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true,reason:'Weekday and evening remain partial; no invented clock.'},
  {sourceId:'D26-S05',rawText:'暂定下周二下午办理',type:'planned_start',normalizedValue:'2026-09-29',precision:'vague',isAllDay:false,needsConfirmation:true,reason:'Reference Tuesday September 22; next Tuesday September 29, tentative afternoon without exact clock.'},
  {sourceId:'D26-S06',rawText:'暂定下周四上午办理',type:'planned_start',normalizedValue:'2026-10-01',precision:'vague',isAllDay:false,needsConfirmation:true,reason:'Reference Tuesday September 22; next Thursday October 1, tentative morning without exact clock.'},
  {sourceId:'D26-S07',rawText:'2026年10月19日16:30前',type:'submission_deadline',normalizedValue:'2026-10-19T16:30',precision:'exact',isAllDay:false,needsConfirmation:false,reason:'The source explicitly states the complete date and 24-hour clock.'},
  {sourceId:'D26-S08',rawText:'10月20日前',type:'task_deadline',normalizedValue:'2026-10-20',precision:'date_only',isAllDay:true,needsConfirmation:false,reason:'Date-only deadline in the reference year; no clock or uncertainty marker.'},
  {sourceId:'D26-S08',rawText:'10月22日前',type:'submission_deadline',normalizedValue:'2026-10-22',precision:'date_only',isAllDay:true,needsConfirmation:false,reason:'Second independent date-only deadline; not the first task endpoint.'},
]
const read=name=>JSON.parse(readFileSync('docs/recognition-optimization/d25-accuracy/'+name+'.json','utf8'))
const sha=text=>createHash('sha256').update(text).digest('hex')
const remap=(value,ids)=>typeof value==='string'?ids.get(value)??value:Array.isArray(value)?value.map(row=>remap(row,ids)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,row])=>[ids.get(key)??key,remap(row,ids)])):value
export async function makeD26ReferenceData(){
  const oldSources=read('SOURCES').sources,oldReferences=read('REFERENCES').references,oldOracles=read('LEGAL_WIRE_ORACLES').oracles,x=await d26Components()
  const sources=[],references=[],oracles=[]
  for(const [ordinal,old] of oldSources.entries()){
    const sourceId='D26-S'+String(ordinal+1).padStart(2,'0'),sourceVersionId=sourceId+'-v1'
    const source={...old,sourceId,sourceVersionId,sourceSha256:sha(old.sourceText),reusedSourceId:old.sourceId,referenceProvenance:'SOURCE_AUTHORED_TIME_ASSERTIONS; MECHANICAL_SCOPE_MAPPING_ONLY'}
    const before=await x.indexImmutableScopesV11(old.sourceId,old.sourceVersionId,old.sourceText),after=await x.indexImmutableScopesV11(sourceId,sourceVersionId,old.sourceText)
    const ids=new Map(before.scopes.map((scope,i)=>[scope.id,after.scopes[i].id]));ids.set(old.sourceId,sourceId);ids.set(old.sourceVersionId,sourceVersionId)
    const reference=remap(oldReferences.find(row=>row.sourceId===old.sourceId),ids),oracle=remap(oldOracles.find(row=>row.sourceId===old.sourceId),ids)
    reference.author='Codex / D26 single-author model-assisted provisional source assertions'
    reference.d26ReferenceVersion='source-semantics-reference-1.0.0'
    reference.d26DisplayPolicy={eventContradictions:source.target==='S09_EVENT'?(ordinal===0?['不会停机','不停机','正常运行','无需停机']:['不会维护','不维护','正常运行','无需维护']):[]}
    const assertions=D26_SOURCE_TIME_ASSERTIONS.filter(row=>row.sourceId===sourceId)
    for(const rep of reference.representations){
      const replace=point=>{const assertion=assertions.find(row=>row.rawText===point.rawText&&row.type===point.type);if(!assertion)throw Error('D26_SOURCE_TIME_ASSERTION_MISSING:'+sourceId+':'+point.rawText);return {...point,...Object.fromEntries(['normalizedValue','precision','isAllDay','needsConfirmation'].map(key=>[key,assertion[key]])),timezone:source.timezone}}
      for(const task of rep.tasks)if(task.times!=='N/A')task.times=task.times.map(replace)
      for(const fact of rep.noTaskFacts)if(fact.kind==='time')fact.time=replace(fact.time)
    }
    if(assertions.length!==oracle.wire.timePoints.length)throw Error('D26_SOURCE_TIME_ASSERTION_COUNT:'+sourceId)
    validateReferenceV7(reference)
    sources.push(source);references.push(reference);oracles.push({...oracle,sourceId,role:'ENGINEERING_ORACLE_NOT_MODEL_OUTPUT'})
  }
  return {'SOURCES.json':{sources},'REFERENCES.json':{references},'LEGAL_WIRE_ORACLES.json':{oracles},'SOURCE_TIME_ASSERTIONS.json':{version:'source-time-assertions-1',role:'PROVISIONAL_SOURCE_AUTHORED_NOT_PARSER_DERIVED',referenceTime:'2026-09-22T09:00:00+08:00',timezone:'Asia/Shanghai',assertions:D26_SOURCE_TIME_ASSERTIONS}}
}
