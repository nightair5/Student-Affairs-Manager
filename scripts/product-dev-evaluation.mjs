// Source-authored references live separately in notifications.json and never enter a request.
// This Development diagnostic is provisional, not independent human truth or a Holdout.
import {recognitionSystemPrompt,applyDeterministicTimeAst,normalizeRecognitionResult,RECOGNITION_PROMPT_VERSION} from '../cloudflare/recognition.mjs'
import {validateRecognitionResult} from '../cloudflare/recognition-contract.generated.mjs'
import {parseRecognitionJson} from '../cloudflare/recognition-json.mjs'
import {build} from 'esbuild'
export const EVALUATION_VERSION='product-development-facts-1.0.0'
export const PARAMETERS={temperature:.1,maxOutputTokens:6000}
export function buildProductRequest(s,{productContract=false}={}){return {model:'deepseek-flash',temperature:PARAMETERS.temperature,reasoning:{effort:'none'},stream:false,max_output_tokens:PARAMETERS.maxOutputTokens,input:[{role:'system',content:[{type:'input_text',text:recognitionSystemPrompt({productContract})}]},{role:'user',content:[{type:'input_text',text:`参考时间：${s.referenceTime}\n时区：${s.timezone}\n来源类型：text\n来源标题：${s.id}\n来源正文：\n${s.text}`}]}]}}
let api
export async function productApi(){if(!api){const r=await build({stdin:{contents:"export {bindOrdinaryProviderSupport,ordinaryWorkflowMaterialSupportFromSidecar} from './src/recognition/ordinaryProviderSupport';export {assembleCurrentFirstSuggestion} from './src/recognition/materialChannelGrounding';export {parseRecognitionResult} from './src/recognition/schema';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});api=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'))}return api}
export function modelJson(raw){const e=JSON.parse(raw);const text=e.output?.flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');if(!text)throw Error('MODEL_WIRE_NO_OUTPUT');return parseRecognitionJson(text)}
export async function productFirst(raw,s){
 const upstream=modelJson(raw),candidate=applyDeterministicTimeAst({...upstream,promptVersion:RECOGNITION_PROMPT_VERSION,modelName:'deepseek-v4-flash',createdAt:s.referenceTime},s.referenceTime,s.timezone)
 const validation=validateRecognitionResult(candidate,{sourceContent:s.text});if(!validation.valid)return {upstream,validation,result:null,failureLayer:validation.failureCategory==='schema'?'SCHEMA':'MODEL_WIRE'}
 const normalized=normalizeRecognitionResult(candidate,s.text,s.referenceTime,'deepseek-v4-flash',RECOGNITION_PROMPT_VERSION,true,s.timezone)
 const valid=validateRecognitionResult(normalized,{sourceContent:s.text});if(!valid.valid)return {upstream,validation:valid,result:null,failureLayer:'SEMANTIC_COMPOSER'}
 const x=await productApi(),bound=x.bindOrdinaryProviderSupport(x.parseRecognitionResult(normalized),{sourceId:s.id,sourceVersionId:s.id+'-v1',sourceText:s.text,referenceTime:s.referenceTime,timezone:s.timezone},JSON.stringify({result:normalized}))
 const first=x.assembleCurrentFirstSuggestion(bound.result,{sourceText:s.text,referenceTime:s.referenceTime,timezone:s.timezone,workflowMaterialSupport:x.ordinaryWorkflowMaterialSupportFromSidecar(bound.sidecar)})
 return {upstream,validation:valid,result:first.result,serverNormalized:normalized,programAudit:first.audit,channelAudit:first.materialChannelAudit,sidecar:bound.sidecar}
}
const compact=v=>String(v??'').replace(/\s/gu,'')
const includes=(v,k)=>compact(v).includes(compact(k))
const tasksOf=r=>[...(r?.standaloneTasks??[]),...(r?.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
const surface=t=>[t.title,t.actionObject,t.description].join(' ')
function localTime(v){if(!v)return null;const d=new Date(v);if(!Number.isFinite(d.getTime()))return String(v);if(!/[Zz]|[+-]\d\d:\d\d$/u.test(v))return v.slice(0,16);const p=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);return p.replace(' ','T')}
/** Minimum obligations are authored before output. Known free prose / date-boundary
 * disputes are reported rather than silently relaxing references after a result. */
export function reviewFacts(r,s){
 if(!r)return {status:'未知',issues:[{failure_layer:'MODEL_WIRE',code:'NO_USABLE_RESPONSE'}],severe:[],matched:0,required:0}
 const ref=s.reference,tasks=tasksOf(r),points=r.timePoints??[],materials=r.materials??[],events=r.events??[],issues=[],severe=[],used=new Set();let matched=0,required=0
 const issue=(code,detail,layer='MODEL_SEMANTIC')=>issues.push({failure_layer:layer,code,detail})
 const fulfill=(ok,code,detail)=>{required++;if(ok)matched++;else issue(code,detail)}
 const deadline=(t,expected)=>points.filter(p=>p.relatedTaskTempIds?.includes(t.tempId)||t.timePointTempIds?.includes(p.tempId)).find(p=>['submission_deadline','registration_deadline','task_deadline'].includes(p.type)&&(expected.precision==='date_only'?localTime(p.normalizedValue)?.slice(0,10)===expected.deadline:localTime(p.normalizedValue)===expected.deadline))
 for(const expected of ref.tasks){
  const candidates=tasks.filter(t=>!used.has(t.tempId)&&includes(surface(t),expected.object)&&expected.verbs.some(v=>includes(t.actionVerb||t.title,v)))
  const t=candidates.find(t=>!expected.deadline||deadline(t,expected))??candidates[0];fulfill(!!t,'MISSING_ACTION',expected);if(!t)continue;used.add(t.tempId)
  if(expected.deadline)fulfill(!!deadline(t,expected),'WRONG_OR_MISSING_OWNED_DEADLINE',expected)
  if(expected.material)fulfill(materials.some(m=>includes(m.name,expected.material)&&(m.relatedTaskTempIds?.includes(t.tempId)||t.materialTempIds?.includes(m.tempId))),'MISSING_OWNED_MATERIAL',expected.material)
  if(expected.channel)fulfill(materials.some(m=>includes(m.submissionChannel,expected.channel)&&(m.relatedTaskTempIds?.includes(t.tempId)||t.materialTempIds?.includes(m.tempId)))||includes(t.description,expected.channel),'MISSING_CHANNEL',expected.channel)
  if(expected.criteria)fulfill((t.completionCriteria??[]).some(c=>includes(c,expected.criteria)),'MISSING_COMPLETION_CRITERION',expected.criteria)
  if(expected.condition)fulfill(includes([t.description,...(t.completionCriteria??[])].join(' '),expected.condition),'MISSING_APPLICABILITY',expected.condition)
  if(expected.unknownEligibility)fulfill(t.selected!==true,'UNKNOWN_ELIGIBILITY_PRESELECTED',expected.object)
  if(expected.predecessor)fulfill((t.dependencyTempIds??[]).some(id=>tasks.some(p=>p.tempId===id&&includes(surface(p),expected.predecessor))),'MISSING_PREDECESSOR',expected.predecessor)
  if(expected.channelUnknown)fulfill(!materials.some(m=>m.relatedTaskTempIds?.includes(t.tempId)&&m.submissionChannel!==null),'UNSUPPORTED_CHANNEL',expected.object)
  if(expected.deadlineUnknown)fulfill(!points.some(p=>p.relatedTaskTempIds?.includes(t.tempId)&&/deadline/u.test(p.type)&&p.normalizedValue!==null),'INVENTED_DEADLINE',expected.object)
  if(expected.window){const [day,clocks]=expected.window.split('T'),[start,end]=clocks.split('/');fulfill(points.some(p=>localTime(p.normalizedValue)===day+'T'+start)&&points.some(p=>localTime(p.normalizedValue)===day+'T'+end),'MISSING_WINDOW_ENDPOINTS',expected.window)}
 }
 const matchedEvents=new Set()
 for(const expected of ref.events){const e=events.find(e=>!matchedEvents.has(e.tempId)&&includes([e.title,e.description].join(' '),expected.object));fulfill(!!e,'MISSING_EVENT',expected);if(!e)continue;matchedEvents.add(e.tempId)
  for(const [role,key]of [['start','startTimePointTempId'],['end','endTimePointTempId']]){const p=points.find(p=>p.tempId===e[key]);if(expected[role])fulfill(!!p&&(expected[role].length===10?localTime(p.normalizedValue)?.slice(0,10)===expected[role]:localTime(p.normalizedValue)===expected[role])&&p.type==='event_'+role,'EVENT_TIME_ROLE_OR_VALUE',{expected,role});if(expected[role+'Unknown'])fulfill(!p||p.normalizedValue===null,'GUESSED_UNPUBLISHED_EVENT_TIME',{expected,role})}
  if(expected.location)fulfill(includes(e.location,expected.location),'MISSING_EVENT_LOCATION',expected.location)
 }
 for(const k of ref.materials??[])fulfill(materials.some(m=>includes(m.name,k)),'MISSING_MATERIAL',k)
 if(ref.sharedMaterial)fulfill(materials.some(m=>new Set(m.relatedTaskTempIds??[]).size>=2&&m.relatedTaskTempIds.every(id=>tasks.some(t=>t.tempId===id))),'SHARED_MATERIAL_RELATION_MISSING',ref.materials)
 if(ref.window){const dates=ref.window.split('/');for(const date of dates)fulfill(points.some(p=>localTime(p.normalizedValue)?.slice(0,10)===date&&!/deadline/u.test(p.type)),'MISSING_DECLARED_WINDOW',date)}
 for(const [field,keys]of [['formatRequirements',ref.formats],['namingRequirements',ref.naming]])for(const k of keys??[])fulfill(materials.some(m=>(m[field]??[]).some(v=>includes(v,k))),'MISSING_MATERIAL_REQUIREMENT',k)
 for(const k of ref.information??[])fulfill(includes([r.sourceSummary?.summary,r.sourceSummary?.actionReason,...tasks.map(t=>t.description),...events.map(e=>e.description),...(r.ignoredContent??[]).map(i=>typeof i==='string'?i:JSON.stringify(i))].join(' '),k),'MISSING_INFORMATION',k)
 for(const k of ref.criteria??[])fulfill(tasks.some(t=>(t.completionCriteria??[]).some(v=>includes(v,k)))||materials.some(m=>[...(m.formatRequirements??[]),...(m.namingRequirements??[])].some(v=>includes(v,k))),'MISSING_REQUIREMENT',k)
 if(ref.materialCount!==undefined)fulfill(materials.length===ref.materialCount,'UNSUPPORTED_MATERIAL',materials.length)
 for(const f of ref.forbidden??[])for(const t of tasks)if(includes(surface(t),f.object)&&f.verbs.some(v=>includes(t.actionVerb||t.title,v))){severe.push({code:'FORBIDDEN_ACTION_AS_TASK',task:t.tempId,object:f.object});issue('FORBIDDEN_ACTION_AS_TASK',t.title)}
 for(const p of points)if(/deadline/u.test(p.type)&&p.normalizedValue){const date=localTime(p.normalizedValue)?.slice(0,10);if(!s.text.includes(date?.slice(5,7).replace(/^0/u,'')+'月')&&!s.text.includes(date?.slice(5,7)+'月')&&!s.text.includes(date)&&!s.text.includes('当日')&&!/明日|下周/u.test(s.text)){severe.push({code:'UNSUPPORTED_DEADLINE',time:p.tempId});issue('UNSUPPORTED_DEADLINE',p)}}
 for(const date of ref.obsoleteDates??[])for(const p of points)if(/deadline/u.test(p.type)&&localTime(p.normalizedValue)?.startsWith(date)){severe.push({code:'OBSOLETE_DEADLINE',time:p.tempId});issue('OBSOLETE_DEADLINE',date)}
 // Exact tasks can be split only when there is a distinct explicit obligation.
 // Nonmatched extra actions are disputes until source adjudication, not automatic passes.
 for(const t of tasks.filter(t=>!used.has(t.tempId)))issue('EXTRA_ACTION_REQUIRES_ADJUDICATION',t.title,'REFERENCE')
 for(const e of events.filter(e=>!matchedEvents.has(e.tempId)))issue('EXTRA_EVENT_REQUIRES_ADJUDICATION',e.title,'REFERENCE')
 const ev=new Map((r.evidence??[]).map(e=>[e.id,e]));for(const entity of [...tasks,...events,...materials,...points])if(!entity.evidenceIds?.length||entity.evidenceIds.some(id=>{const e=ev.get(id);return !e||!s.text.includes(e.quote??e.quotedText??'')})){issue('MISSING_OR_INVALID_SOURCE',entity.tempId,'MODEL_WIRE');severe.push({code:'SOURCE_EVIDENCE_LOSS',entity:entity.tempId})}
 const factual=issues.filter(i=>i.failure_layer!=='REFERENCE');const status=severe.length?'错':issues.length===0?'完整':factual.length===0?'未知':matched>0?'部分':'错'
 return {status,issues,severe,matched,required,provisional:true,freeProse:'NOT_INDEPENDENTLY_ADJUDICATED',userModified:'NOT_RUN'}
}
