// Corrections discovered during current Development inspection. v5.0 and v4
// remain reproducible; report all three rather than overwriting prior scores.
import {reviewV5} from './product-dev-review-v5.mjs'
export const PRODUCT_REVIEW_V51_VERSION='product-development-review-5.1.0'
export function reviewV51(result,source,options={}){
 const out=reviewV5(result,source,options)
 if(!result)return {...out,reviewVersion:PRODUCT_REVIEW_V51_VERSION}
 // Fix only the v4 month-presence heuristic on line-wrapped calendar dates.
 // A complete cited literal date must equal the value; role, owner, obsolete
 // date and invalid-source checks remain unchanged. Old score files stay put.
 const wrappedDateSupported=id=>{
  const p=result.timePoints?.find(t=>t.tempId===id);if(!p?.normalizedValue)return false
  const date=String(p.normalizedValue).slice(0,10),literal=String(p.rawText??'').replace(/\s/gu,'')
  const supported=p.evidenceIds?.some(eid=>{const e=result.evidence?.find(e=>e.id===eid),q=e?.quote??e?.quotedText;return typeof q==='string'&&source.text.includes(q)&&q.includes(p.rawText)})
  return supported&&[...literal.matchAll(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/gu)].some(m=>{const y=m[1]??date.slice(0,4);return `${y}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`===date})
 }
 const falseMonthFlags=out.severe.filter(s=>s.code==='UNSUPPORTED_DEADLINE'&&wrappedDateSupported(s.time))
 if(falseMonthFlags.length){out.severe=out.severe.filter(s=>!falseMonthFlags.includes(s));out.issues=out.issues.filter(i=>!(i.code==='UNSUPPORTED_DEADLINE'&&wrappedDateSupported(i.detail?.tempId??i.detail?.time)));if(!out.severe.length)out.status=!out.issues.length?'完整':out.issues.every(i=>i.failure_layer==='REFERENCE')?'未知':out.matched>0?'部分':'错';out.scorerBugFix={code:'WRAPPED_LITERAL_MONTH_FALSE_FLAG',removed:falseMonthFlags}}
 const evidence=new Map((result.evidence??[]).map(e=>[e.id,e.quote??e.quotedText])),fields=[]
 for(const[key,value]of Object.entries(result.projectSuggestion??{}))if(value&&typeof value==='object'&&Array.isArray(value.evidenceIds))fields.push({entity:'project.'+key,ids:value.evidenceIds})
 for(const m of result.milestones??[]){fields.push({entity:m.tempId,ids:m.evidenceIds??[]});for(const w of m.workPackages??[])fields.push({entity:w.tempId,ids:w.evidenceIds??[]})}
 for(const field of fields)if(field.ids.length===0||field.ids.some(id=>!evidence.get(id)||!source.text.includes(evidence.get(id)))){
  const detail={code:'SOURCE_EVIDENCE_LOSS',entity:field.entity};out.severe.push(detail);out.issues.push({failure_layer:'MODEL_WIRE',code:'SOURCE_EVIDENCE_LOSS',detail})
 }
 const range=source.reference.window?.split('/')
 if(range?.length===2)for(const p of result.timePoints??[]){
  if(!/deadline/u.test(p.type)||!p.normalizedValue)continue
  const tasks=[...(result.standaloneTasks??[]),...(result.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
  const owners=tasks.filter(t=>p.relatedTaskTempIds?.includes(t.tempId)||t.timePointTempIds?.includes(p.tempId))
  if(p.selected===false&&!owners.length)continue
  // Only a source-authored window reference, with no independent deadline,
  // supplies this rule. A separate real cutoff can coincide with a window.
  const independent=source.reference.tasks.some(t=>t.deadline&&owners.some(o=>[o.actionObject,o.title].join(' ').includes(t.object)))
  if(independent)continue
  const date=String(p.normalizedValue).slice(0,10)
  if(!range.includes(date))continue
  const code=date===range[0]?'WINDOW_START_AS_DEADLINE':'WINDOW_AS_DEADLINE'
  if(!out.severe.some(s=>s.code===code&&s.time===p.tempId)){
   const detail={code,time:p.tempId,owners:owners.map(o=>o.tempId),actual:p.normalizedValue,referenceWindow:range}
   out.severe.push(detail);out.issues.push({failure_layer:'MODEL_SEMANTIC',code,detail})
  }
 }
 if(out.severe.length)out.status='错'
 // Resolving a duplicate-material representation must never hide another
 // unresolved primary source/owner gate in the ordinary assembler.
 if(out.status==='完整'&&options.audit?.unresolved?.length){out.status='未知';out.issues.push({failure_layer:'SEMANTIC_COMPOSER',code:'UNRESOLVED_SOURCE_SUPPORT_NOT_WHOLE_COMPLETE',detail:options.audit.unresolved})}
 return {...out,reviewVersion:PRODUCT_REVIEW_V51_VERSION,v50Status:out.v4Status===undefined?out.status:reviewV5(result,source,options).status}
}
