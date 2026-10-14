import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import { MAX_REQUEST_BYTES } from '../experiments/realInput01/modelWire'
import { buildTaskRequirementsRequest, decodeTaskRequirementsRecording, TASK_REQUIREMENTS_SCHEMA, TASK_REQUIREMENTS_VERSION, type TaskRequirementsFacts } from './taskRequirementsContract'

export const FACT_ROLE_VERSION = 'fact-role-authority-source-contract-1.0.0'
export const FACT_ROLE_CANDIDATE = 'fact-role-authority-generation-1.0.0'
export const FACT_ROLE_PROMPT = 'recognition-fact-role-authority-1.0.0'
export const FACT_ROLE_PROJECTION = 'fact-role-authority-projection-1.0.0'
type Category='time'|'material'|'event'
type Absence={category:Category;status:'explicit_none'|'unknown';scopeIds:string[]}
export type FactRoleFacts=Omit<TaskRequirementsFacts,'schemaVersion'|'tasks'|'timePoints'> & {
  schemaVersion:typeof FACT_ROLE_VERSION
  tasks:Array<Omit<TaskRequirementsFacts['tasks'][number],'coverage'> & {absences:Absence[]}>
  timePoints:Array<Omit<TaskRequirementsFacts['timePoints'][number],'type'> & {type:TaskRequirementsFacts['timePoints'][number]['type']|'task_action_time'}>
}
export const FACT_ROLE_SCHEMA=structuredClone(TASK_REQUIREMENTS_SCHEMA)
FACT_ROLE_SCHEMA.properties!.schemaVersion={type:'string',const:FACT_ROLE_VERSION}
const t=FACT_ROLE_SCHEMA.properties!.tasks.items!
delete t.properties!.coverage;t.required=t.required!.filter(k=>k!=='coverage');t.required.push('absences')
t.properties!.absences=Object.assign({
  type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['category','status','scopeIds'],properties:{
    category:{type:'string',enum:['time','material','event']},status:{type:'string',enum:['explicit_none','unknown']},
    scopeIds:{type:'array',minItems:1,maxItems:200,uniqueItems:true,items:{type:'string',minLength:1,maxLength:4000}},
  }},
},{description:'只声明原文明示没有或尚未确定的类别。已有实体及owner自动派生present；无实体且无本声明表示未提，遗漏仍由原文完整性参照判错。不要重复声明present。'})
FACT_ROLE_SCHEMA.properties!.timePoints.items!.properties!.type.enum=[...FACT_ROLE_SCHEMA.properties!.timePoints.items!.properties!.type.enum!,'task_action_time']
Object.assign(FACT_ROLE_SCHEMA.properties!.timePoints,{description:'原文指定办理时刻task_action_time，截止task_deadline/registration_deadline/submission_deadline，活动起止event_start/end，开放窗口window_start/end；不得生成个人planned_start。值由公共时间解析，owner仅声明一次。'})
Object.assign(FACT_ROLE_SCHEMA.properties!.materials,{description:'真实需准备/提交的材料及其owner。表单的年级/电话/型号是requirements。领取后获得的卡是动作对象，不伪造领取前需交材料；准备相机的相机是该独立准备动作的真实对象/材料。PDF/命名/完成标准完整保留。'})
const check=(v:unknown,c:string)=>{if(!v)throw Error('FACT_ROLE_'+c)}
export function projectFactRole(input:unknown,context:WireContext){
  const original=plainJson(input) as FactRoleFacts
  check(original.schemaVersion===FACT_ROLE_VERSION&&Array.isArray(original.tasks)&&Array.isArray(original.timePoints),'SHAPE')
  const actionTimes=original.timePoints.filter(p=>p.type==='task_action_time').map(p=>{
    check(p.owners.length>0&&p.owners.every(o=>o.kind==='task'&&original.tasks.some(t=>t.id===o.entityId)),'ACTION_TIME_OWNER')
    return {id:p.tempId,owners:p.owners as Array<{kind:'task';entityId:string}>}
  })
  const projected:TaskRequirementsFacts={...original,schemaVersion:TASK_REQUIREMENTS_VERSION,timePoints:original.timePoints.map(p=>({...p,type:p.type==='task_action_time'?'window_start':p.type})),tasks:original.tasks.map(t=>{
    check(Array.isArray(t.absences)&&t.absences.length<=3&&new Set(t.absences.map(a=>a.category)).size===t.absences.length,'ABSENCES')
    check(t.absences.every(a=>a&&['time','material','event'].includes(a.category)&&Object.keys(a).sort().join(',')==='category,scopeIds,status'),'ABSENCES')
    const ms=original.materials.filter(m=>m.relatedTaskTempIds.includes(t.id)),es=original.events.filter(e=>t.eventLinks.some(l=>l.eventId===e.tempId))
    const owns=(category:Category)=>category==='material'?ms.length>0:category==='event'?es.length>0:original.timePoints.some(p=>p.owners.some(o=>o.kind==='task'&&o.entityId===t.id||o.kind==='material'&&ms.some(m=>m.tempId===o.entityId)||['event_start','event_end'].includes(o.kind)&&es.some(e=>e.tempId===o.entityId)))
    const coverage=Object.fromEntries((['time','material','event'] as Category[]).map(category=>{
      const a=t.absences.find(a=>a.category===category)
      if(a)check(Object.keys(a).sort().join(',')==='category,scopeIds,status'&&['explicit_none','unknown'].includes(a.status)&&Array.isArray(a.scopeIds)&&a.scopeIds.length>0&&a.scopeIds.every(id=>context.index.scopes.some(s=>s.id===id))&&!owns(category),'ABSENCE_CONTRADICTION')
      return [category,{status:owns(category)?'present':a?.status??'not_stated',absenceScopeIds:a?.scopeIds??[]}]
    })) as TaskRequirementsFacts['tasks'][number]['coverage']
    const task={...t} as Partial<FactRoleFacts['tasks'][number]>;delete task.absences;return {...task,coverage} as TaskRequirementsFacts['tasks'][number]
  })}
  return {projected,audit:{version:FACT_ROLE_PROJECTION,operation:'DECLARED_ENTITIES_AND_OWNERS_TO_PRESENCE',inferredFacts:0,original,actionTimes}}
}
export function decodeFactRoleRecording(raw:string,context:WireContext,role:'EngineeringFixture'|'SingleAuthority'='EngineeringFixture'){
  check(new TextEncoder().encode(raw).byteLength<=524288,'SIZE')
  const envelope=JSON.parse(raw),texts=envelope.output?.filter((m:{type?:string})=>m.type==='message').flatMap((m:{content:Array<{type:string;text:string}>})=>m.content.filter(c=>c.type==='output_text'))
  check(texts?.length===1&&typeof texts[0].text==='string','RESPONSE')
  const p=projectFactRole(JSON.parse(texts[0].text),context);texts[0].text=JSON.stringify(p.projected)
  const d=decodeTaskRequirementsRecording(JSON.stringify(envelope),context,role)
  // Canonical v8 start vocabulary is retained; the appointment role is separate.
  d.sidecar.singleAuthorityAudit.sourceWindows=d.sidecar.singleAuthorityAudit.sourceWindows.filter(w=>!p.audit.actionTimes.some(a=>a.id===w.id))
  return {...d,result:{...d.result,promptVersion:FACT_ROLE_PROMPT,modelName:role==='EngineeringFixture'?'事实角色工程夹具（非模型输出）':'FactRoleAuthority 固定录制（非实时调用）'},sidecar:{...d.sidecar,originalResponse:raw,factRoleAudit:p.audit}}
}
export async function buildFactRoleRequest(context:WireContext){
  const base=await buildTaskRequirementsRequest(context),body=structuredClone(base.body)
  body.input[0].content[0].text=body.input[0].content[0].text.replace('coverage present必须有真实实体及关联，没提、明确没有、未知不混淆。','已有事实由真实实体及owner派生，没提、明确没有、未知不混淆。')+'\n本版以实体和唯一owner为权威，不生成task.coverage：自动派生已有事实。tasks.absences只列明确没有/未知及其原文；无实体无声明表示未提，但不能借此遗漏事实。task_action_time是原文指定动作时刻（例如于具体时刻到地点领取），不是deadline或个人计划。字段不是材料，独立领取对象不是领取前材料；真实准备设备、提交证明仍保留材料。所有原文义务、未公布起止、格式/命名/办结要求仍须完整。'
  body.text.format.schema=FACT_ROLE_SCHEMA
  const serialized=JSON.stringify(body);check(new TextEncoder().encode(serialized).byteLength<=MAX_REQUEST_BYTES,'REQUEST_SIZE')
  return {...base,body,serialized,candidateVersion:FACT_ROLE_CANDIDATE,promptVersion:FACT_ROLE_PROMPT,componentVersion:FACT_ROLE_VERSION}
}
