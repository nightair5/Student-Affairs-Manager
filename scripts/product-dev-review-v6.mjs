// Owner-provisional task granularity defaults. Historical references and v5.1
// remain intact and must be reported alongside this explicit policy change.
import {reviewV51} from './product-dev-review-v5-1.mjs'
export const PRODUCT_REVIEW_V6_VERSION='product-development-review-6.0.0'
export const OWNER_DEFAULTS_V6={author:'Product owner, explicit Quality R8 message; reference interpretation by Codex / model-assisted / provisional',R1:'One registration delivery; split only independent deadline, place or dependency',R2:'Reading/following is reference unless a timed subsequent action is required',R3:'Material production/signature/eligibility is a requirement unless separately delivered or timed',R4:'One object and delivery; return-for-correction is conditional information',R5:'Attend/test/publicize only for an explicitly required current role; otherwise optional or pending',safety:'No equivalence for wrong value, object, source, owner, cancellation or time role'}
const compact=v=>String(v??'').replace(/\s/gu,'')
const has=(a,b)=>!!b&&compact(a).includes(compact(b))
const tasksOf=r=>[...(r?.standaloneTasks??[]),...(r?.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
const quotes=(e,r,s)=>{const a=(e.evidenceIds??[]).map(id=>r.evidence?.find(x=>x.id===id)?.quote);return a.length&&a.every(q=>q&&s.text.includes(q))?a.join('\n'):null}
export function reviewV6(result,source,{referenceV6=null,...options}={}){
 const next={...source,reference:referenceV6?.reference??source.reference},out=reviewV51(result,next,options),equivalence=[]
 if(!result)return {...out,reviewVersion:PRODUCT_REVIEW_V6_VERSION,referenceRevision:referenceV6?.version??'V6_POLICY_UNCHANGED_MINIMUM',equivalence}
 const tasks=tasksOf(result)
 // The source-authored minimum may keep a requirement in a description or
 // material field. It is not required to be duplicated as an executable task.
 for(const req of referenceV6?.preservedRequirements??[]){
  const fields=[...tasks.map(t=>({entity:t,text:[t.title,t.actionObject,t.description,...(t.completionCriteria??[])].join('\n')})),...(result.materials??[]).map(m=>({entity:m,text:[m.name,...(m.formatRequirements??[]),...(m.namingRequirements??[])].join('\n')})),...(result.ignoredContent??[]).filter(i=>i&&typeof i==='object').map(i=>({entity:i,text:JSON.stringify(i)}))]
  const ok=fields.some(({entity,text})=>req.tokens.every(token=>has(text,token))&&quotes(entity,result,source))
  out.required++;if(ok)out.matched++;else out.issues.push({failure_layer:'MODEL_SEMANTIC',code:'MISSING_V6_RETAINED_REQUIREMENT',detail:req})
 }
 out.issues=out.issues.filter(i=>{
  if(i.code!=='EXTRA_ACTION_REQUIRES_ADJUDICATION')return true
  const t=tasks.find(t=>t.title===i.detail),q=t&&quotes(t,result,source)
  if(!t||!q)return true
  const verb=compact(t.actionVerb),object=compact(t.actionObject)
  // Apply R2/R4/R5 only to an explicitly unselected reference/conditional
  // representation. An executable reading/correction action remains a cost.
  const referenceOnly=/^(?:关注|查阅|查看|查询|熟悉|阅读)$/u.test(verb)
  const conditionalCorrection=/退回|补正/u.test(verb+object)&&/退回|如需|若|如果/u.test(q)
  const optionalParticipation=/^(?:参加|测试|宣传)$/u.test(verb)&&/自愿|可选|有意|如需|有兴趣|报名者/u.test(q)
  if((referenceOnly||conditionalCorrection||optionalParticipation)&&t.selected===false){equivalence.push({task:t.tempId,rule:referenceOnly?'R2':conditionalCorrection?'R4':'R5',status:'OPTIONAL_OR_REFERENCE_RETAINED'});return false}
  // R1 permits a multi-step representation of the same delivery, not extra
  // objects. Require literal evidence, a matched object and no new cutoff.
  if(/^(?:报名|预约|注册|选课|确认|提交|填报|填写|申请)$/u.test(verb)){
   const expected=next.reference.tasks.filter(e=>has(object,e.object)&&e.verbs.some(v=>/报名|预约|注册|选课|确认|提交|填报|填写|申请/u.test(v)))
   const points=(result.timePoints??[]).filter(p=>p.relatedTaskTempIds?.includes(t.tempId)||t.timePointTempIds?.includes(p.tempId))
   if(expected.length===1&&points.every(p=>!/deadline/u.test(p.type)||!p.normalizedValue||expected[0].deadline&&String(p.normalizedValue).startsWith(expected[0].deadline))){equivalence.push({task:t.tempId,rule:'R1_R4',status:'SAME_OBJECT_DELIVERY_STEPS'});return false}
  }
  return true
 })
 // A newer interpretation cannot erase an existing serious finding. Updated
 // references retain every critical date/object/owner/cancellation obligation.
 const legacy=reviewV51(result,source,options)
 for(const s of legacy.severe)if(!out.severe.some(x=>JSON.stringify(x)===JSON.stringify(s)))out.severe.push(s)
 out.status=out.severe.length?'错':!out.issues.length?'完整':out.issues.every(i=>i.failure_layer==='REFERENCE')?'未知':out.matched>0?'部分':'错'
 return {...out,reviewVersion:PRODUCT_REVIEW_V6_VERSION,referenceRevision:referenceV6?.version??'V6_POLICY_UNCHANGED_MINIMUM',equivalence,v51Status:legacy.status}
}
