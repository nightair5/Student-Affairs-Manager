import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import { ROLE_AUTHORITY_SCHEMA, ROLE_AUTHORITY_VERSION, ROLE_AUTHORITY_SYSTEM, buildRoleAuthorityRequest, decodeRoleProductRecording, projectRoleAuthority, type RoleAuthorityFacts } from './sourceContractV7'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'
import { MAX_REQUEST_BYTES } from '../experiments/realInput01/modelWire'

export const TASK_REQUIREMENTS_VERSION = 'task-requirements-source-contract-1.0.0'
export const TASK_REQUIREMENTS_CANDIDATE = 'task-requirements-generation-1.0.0'
export const TASK_REQUIREMENTS_PROMPT = 'recognition-task-requirements-1.0.0'
type Requirement = { ownerTaskId: string; text: string; scopeIds: string[]; conditionScopeIds: string[] }
export type TaskRequirementsFacts = Omit<RoleAuthorityFacts,'schemaVersion'> & { schemaVersion: typeof TASK_REQUIREMENTS_VERSION; requirements: Requirement[] }
export const TASK_REQUIREMENTS_SCHEMA=structuredClone(ROLE_AUTHORITY_SCHEMA)
TASK_REQUIREMENTS_SCHEMA.properties!.schemaVersion={type:'string',const:TASK_REQUIREMENTS_VERSION}
const ids={type:'array',minItems:0,maxItems:200,uniqueItems:true,items:{type:'string',minLength:1,maxLength:4000}}
TASK_REQUIREMENTS_SCHEMA.properties!.requirements=Object.assign({type:'array',maxItems:32,items:{type:'object',additionalProperties:false,required:['ownerTaskId','text','scopeIds','conditionScopeIds'],properties:{ownerTaskId:ids.items,text:{type:'string',minLength:1,maxLength:4000},scopeIds:{...ids,minItems:1},conditionScopeIds:ids}}},{description:'现有动作的填写字段、格式及办结要求，独立于task。ownerTaskId是真实task；text逐字包含条件与要求。条件仅影响本条要求，不改变核心任务资格。程序派生任务的依据和完成标准。另须领取/缴费/准备等独立完成动作仍须单列task。'})
TASK_REQUIREMENTS_SCHEMA.required!.push('requirements')
Object.assign(TASK_REQUIREMENTS_SCHEMA.properties!.tasks,{description:'仅可独立完成的动作+业务对象。一份登记表的填写字段和条件下字段放requirements，不能增加重复登记待办。独立缴费、领取、准备设备保留task，不吞为requirements。'})
const check=(v:unknown,c:string)=>{if(!v)throw Error('TASK_REQUIREMENTS_'+c)}

/** Preserve an explicitly owned literal requirement as ordinary task details.
 * Does not decide whether a missing independent action should have been output. */
export function projectTaskRequirements(input:unknown,context:WireContext){
  const original=plainJson(input) as TaskRequirementsFacts
  check(original.schemaVersion===TASK_REQUIREMENTS_VERSION&&Array.isArray(original.requirements)&&original.requirements.length<=32,'SHAPE')
  const {requirements,...rest}=original
  const projected:RoleAuthorityFacts={...rest,schemaVersion:ROLE_AUTHORITY_VERSION}
  projectRoleAuthority(projected,context,true) // Validate every existing wire field, not a mirror schema.
  for(const r of requirements){
    check(r&&Object.keys(r).sort().join(',')==='conditionScopeIds,ownerTaskId,scopeIds,text'
      &&typeof r.ownerTaskId==='string'&&typeof r.text==='string'&&r.text.trim().length>0&&r.text.length<=4000
      &&Array.isArray(r.scopeIds)&&r.scopeIds.length>0&&r.scopeIds.length<=200
      &&Array.isArray(r.conditionScopeIds)&&r.conditionScopeIds.length<=200
      &&new Set(r.scopeIds).size===r.scopeIds.length&&new Set(r.conditionScopeIds).size===r.conditionScopeIds.length,'SHAPE')
    const t=projected.tasks.find(t=>t.id===r.ownerTaskId)
    check(t,'OWNER')
    check(hasLiteralScopeSpan(r.text,r.scopeIds,context)&&r.conditionScopeIds.every(id=>r.scopeIds.includes(id)),'EVIDENCE')
    t!.propositionScopeIds=[...new Set([...t!.propositionScopeIds,...r.scopeIds])]
    t!.detail.description=[t!.detail.description,r.text].filter((s,i,a)=>!!s&&a.indexOf(s)===i).join('\n')
    t!.detail.completionCriteria=[...new Set([...t!.detail.completionCriteria,r.text])]
  }
  return {projected,audit:{version:TASK_REQUIREMENTS_VERSION,inferredFacts:0,operation:'EXPLICIT_REQUIREMENT_OWNER_TO_TASK_DETAILS',original,requirements}}
}
export function decodeTaskRequirementsRecording(raw:string,context:WireContext,role:'EngineeringFixture'|'SingleAuthority'='EngineeringFixture'){
  check(new TextEncoder().encode(raw).byteLength<=524288,'SIZE')
  const envelope=JSON.parse(raw),texts=Array.isArray(envelope.output)?envelope.output.filter((v:{type?:string})=>v.type==='message').flatMap((v:{content?:Array<{type?:string;text?:string}>})=>v.content?.filter(c=>c.type==='output_text')??[]):[]
  check(texts.length===1&&typeof texts[0].text==='string','RESPONSE_TEXT')
  const p=projectTaskRequirements(JSON.parse(texts[0].text),context);texts[0].text=JSON.stringify(p.projected)
  const d=decodeRoleProductRecording(JSON.stringify(envelope),context,role,true,true)
  return {...d,result:{...d.result,promptVersion:TASK_REQUIREMENTS_PROMPT,modelName:role==='EngineeringFixture'?'条件字段工程夹具（非模型输出）':'TaskRequirements 固定录制（非实时调用）'},sidecar:{...d.sidecar,originalResponse:raw,taskRequirementsAudit:p.audit}}
}
export async function buildTaskRequirementsRequest(context:WireContext){
  const base=await buildRoleAuthorityRequest(context),body=structuredClone(base.body)
  body.input[0].content[0].text=ROLE_AUTHORITY_SYSTEM+'\n本版先区分独立完成动作与同一动作的填写要求：tasks只放前者，requirements显式声明后者的ownerTaskId和逐字原文。条件下填写去向、姓名等仍是原登记的要求，不能新造登记task；局部字段条件不扩成整个登记的资格。领取、缴费、准备设备等真正独立动作仍单列。requirements的依据和条件不再复制到task，由程序派生；scopeAccounting引用真实ownerTaskId，不造requirement业务实体。所有时间/材料/活动及真实关系沿原契约。'
  body.text.format.schema=TASK_REQUIREMENTS_SCHEMA
  const serialized=JSON.stringify(body)
  check(new TextEncoder().encode(serialized).byteLength<=MAX_REQUEST_BYTES,'REQUEST_SIZE')
  return {...base,body,serialized,candidateVersion:TASK_REQUIREMENTS_CANDIDATE,promptVersion:TASK_REQUIREMENTS_PROMPT,componentVersion:TASK_REQUIREMENTS_VERSION}
}
