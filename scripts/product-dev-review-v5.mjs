// Source-first Development interpretation. Original v4 evaluator and reports stay immutable.
import {grade as reviewV4} from './mature-product.mjs'
export const PRODUCT_REVIEW_V5_VERSION='product-development-review-5.0.0'
export const PRODUCT_REVIEW_V5_RULES={
 version:PRODUCT_REVIEW_V5_VERSION,author:'Codex / model-assisted / provisional',
 material:'A cited action object need not be duplicated as a separate material unless it is a distinct attachment, has separate ownership, or required constraints would disappear. ZIP components and their quantities must remain explicit and owned.',
 phase:'Adjacent assembly/departure may share an event only when both phase labels and source times remain explicit; departure is not an event end.',
 date:'A bare 于某日交 preserves the stated date and unknown clock; no inferred earlier cutoff, opening window, or permission to submit early.',
 advice:'Generic arrange work without a concrete deliverable is advice; only an unselected optional suggestion can be equivalent to information.',
 safety:'Never waive severe findings, invalid evidence, wrong value/type/owner, cancellation or missing independent obligations.',
 scope:'Development diagnostics, not independent truth or population accuracy; v4 remains alongside v5.'
}
const compact=v=>String(v??'').replace(/\s/gu,'')
const has=(v,k)=>!!k&&compact(v).includes(compact(k))
const tasksOf=r=>[...(r?.standaloneTasks??[]),...(r?.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
const quotes=(entity,result,source)=>{
 const evidence=new Map((result?.evidence??[]).map(e=>[e.id,e.quote??e.quotedText]))
 const values=(entity?.evidenceIds??[]).map(id=>evidence.get(id))
 return values.length&&values.every(v=>typeof v==='string'&&v.length&&source.text.includes(v))?values.join('\n'):''
}
const owned=(m,t)=>m.relatedTaskTempIds?.includes(t.tempId)||t.materialTempIds?.includes(m.tempId)
function phaseRepresentation(issue,result,source){
 if(issue.code!=='MISSING_EVENT')return null
 const expected=issue.detail
 if(!/^(?:集合|出发|签到|入场)$/u.test(expected.object)||!expected.start||expected.end||expected.endUnknown)return null
 for(const e of result.events??[]){
  const q=quotes(e,result,source),start=(result.timePoints??[]).find(p=>p.tempId===e.startTimePointTempId)
  if(!q||!has(q,expected.object)||/另一场|另行|不同活动/u.test(q)||!start?.normalizedValue)continue
  const p=(result.timePoints??[]).find(p=>p.type==='event_start'&&p.relatedEventTempIds?.includes(e.tempId)&&p.normalizedValue===expected.start&&has(p.rawText,expected.object)&&quotes(p,result,source))
  if(!p||start.normalizedValue.slice(0,10)!==p.normalizedValue.slice(0,10))continue
  if(expected.location&&!has(e.location,expected.location))continue
  if(Math.abs(Date.parse(p.normalizedValue)-Date.parse(start.normalizedValue))>2*3600000)continue
  return 'OWNED_ADJACENT_PHASE_START_PRESERVED'
 }
 return null
}
function appointedDateRepresentation(issue,result,source){
 if(issue.code!=='WRONG_OR_MISSING_OWNED_DEADLINE')return null
 const e=issue.detail
 if(e.precision!=='date_only'||!/^\d{4}-\d{2}-\d{2}$/u.test(e.deadline??''))return null
 const [,month,day]=e.deadline.split('-').map(Number),literal=new RegExp(`(?:${month}月0?${day}日|${e.deadline})`,'u')
 for(const t of tasksOf(result)){
  const q=quotes(t,result,source)
  if(!has(t.actionObject,e.object)||!q||!literal.test(q)||/日前|日之前|日以前|最晚|截止|不晚于/u.test(q))continue
  const p=(result.timePoints??[]).find(p=>(p.relatedTaskTempIds?.includes(t.tempId)||t.timePointTempIds?.includes(p.tempId))&&p.type==='planned_start'&&p.normalizedValue===e.deadline&&p.precision==='date_only'&&p.isAllDay===true&&quotes(p,result,source))
  if(p)return 'STATED_APPOINTED_DATE_UNKNOWN_CLOCK'
 }
 return null
}
function materialRepresentation(issue,result,source){
 if(issue.code!=='MISSING_OWNED_MATERIAL')return null
 const expected=issue.detail,tasks=tasksOf(result)
 for(const t of tasks){
  const q=quotes(t,result,source),object=t.actionObject??'',criteria=(t.completionCriteria??[]).join('\n')
  if(!q||!has(object,expected)||!has(q,expected))continue
  if(/压缩包|打包文件|归档包/u.test(expected)){
   const components=(source.reference.criteria??[]).filter(k=>has(source.text,k))
   if(components.length<2||!has(criteria,expected)||!/合并|打包|压缩/u.test(criteria))continue
   if(!components.every(k=>(result.materials??[]).some(m=>owned(m,t)&&has(m.name,k)&&quotes(m,result,source))))continue
   // Quantity is source content, not an interchangeable packaging detail.
   const quantities=[...source.text.matchAll(/(\d+[张份页])([^，。；和]+?)(?=和|，|。|；)/gu)]
   if(quantities.some(([,count,name])=>!has([object,criteria,...(result.materials??[]).filter(m=>owned(m,t)).map(m=>m.name)].join(' '),count+name)))continue
   return 'OWNED_ZIP_COMPONENTS_AND_PACKAGING_PRESERVED'
  }
  if(!has(criteria,expected)||!/准备|撰写|制作|完成|提交|上传|携带|带/u.test(t.actionVerb??''))continue
  // Distinct attachments are not absorbed into the parent action object.
  if(new RegExp(`(?:附上|附带|附件|另交|另附)[^。；]{0,12}${expected.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')}`,'u').test(source.text))continue
  return 'CITED_ACTION_OBJECT_AND_COMPLETION_PRESERVED'
 }
 return null
}
export function reviewV5(result,source,{audit=null,rawGrade=null}={}){
 const v4=reviewV4(result,source,audit,rawGrade),out=structuredClone(v4),equivalence=[]
 if(!result)return {...out,reviewVersion:PRODUCT_REVIEW_V5_VERSION,equivalence}
 out.issues=out.issues.filter(issue=>{
  const reason=materialRepresentation(issue,result,source)??phaseRepresentation(issue,result,source)??appointedDateRepresentation(issue,result,source)
  if(!reason)return true
  equivalence.push({code:issue.code,detail:issue.detail,rule:reason});out.matched++;return false
 })
 // A generic advice card is not an independently actionable obligation.
 for(const issue of out.issues){
  if(issue.code!=='EXTRA_ACTION_REQUIRES_ADJUDICATION')continue
  const t=tasksOf(result).find(t=>t.title===issue.detail)
  if(t&&/安排/u.test(t.actionVerb??'')&&/^(?:工作|安排)$/u.test(compact(t.actionObject))&&quotes(t,result,source)){
   if(t.selected===false&&t.inferenceLevel==='optional_suggestion'){
    equivalence.push({code:issue.code,detail:issue.detail,rule:'UNSELECTED_OPTIONAL_ADVICE'});issue._optionalAdvice=true
   }else{issue.code='GENERIC_ADVICE_AS_EXECUTABLE_TASK';issue.failure_layer='DOMAIN_RULE'}
  }
 }
 out.issues=out.issues.filter(i=>!i._optionalAdvice)
 if(out.severe.length)out.status='错'
 else if(!out.issues.length)out.status='完整'
 else if(out.issues.every(i=>i.failure_layer==='REFERENCE'))out.status='未知'
 else if(v4.status!=='错'||equivalence.length)out.status=out.matched>0?'部分':'错'
 return {...out,reviewVersion:PRODUCT_REVIEW_V5_VERSION,equivalence,v4Status:v4.status}
}
