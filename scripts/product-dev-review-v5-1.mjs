// Corrections discovered during current Development inspection. v5.0 and v4
// remain reproducible; report all three rather than overwriting prior scores.
import {reviewV5} from './product-dev-review-v5.mjs'
import {projectLiteralSourceEvidence,resolveLiteralSourceSpan} from '../cloudflare/recognition-literal-evidence.mjs'
import {citedRelativeCutoff} from '../cloudflare/cited-relative-cutoff.mjs'
export const PRODUCT_REVIEW_V51_VERSION='product-development-review-5.1.0'
export function reviewV51(result,source,options={}){
 const out=reviewV5(result,source,options)
 if(!result)return {...out,reviewVersion:PRODUCT_REVIEW_V51_VERSION}
 // Fix a determined matching bug, not the reference: several events may
 // share an object name. A complete one-to-one endpoint match must be used
 // before the old first-title lookup can call a correct endpoint wrong.
 const expectedEvents=source.reference.events??[],events=result.events??[],points=result.timePoints??[]
 const stamp=v=>{if(!v)return null;if(!/[Zz]|[+-]\d\d:\d\d$/u.test(v))return String(v).slice(0,16);return new Intl.DateTimeFormat('sv-SE',{timeZone:source.timezone??'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replace(' ','T')}
 const contains=(a,b)=>!!b&&String(a??'').replace(/\s/gu,'').includes(String(b).replace(/\s/gu,''))
 const compatible=(e,x)=>contains(e.title+' '+(e.description??''),x.object)&&(!x.location||contains(e.location,x.location))&&['start','end'].every(role=>{const p=points.find(p=>p.tempId===e[role+'TimePointTempId']);return(!x[role]||!!p&&p.type==='event_'+role&&(x[role].length===10?stamp(p.normalizedValue)?.slice(0,10):stamp(p.normalizedValue))===x[role])&&(!x[role+'Unknown']||!p||p.normalizedValue===null)})
 const allocation=new Map(),assign=(index,seen)=>{for(let n=0;n<events.length;n++){if(seen.has(n)||!compatible(events[n],expectedEvents[index]))continue;seen.add(n);if(!allocation.has(n)||assign(allocation.get(n),seen)){allocation.set(n,index);return true}}return false}
 if(expectedEvents.length>1&&expectedEvents.every((_,i)=>assign(i,new Set()))){
  const removed=out.issues.filter(i=>['MISSING_EVENT','EVENT_TIME_ROLE_OR_VALUE','MISSING_EVENT_LOCATION'].includes(i.code))
  if(removed.length){for(const i of removed){out.matched++;if(i.code==='MISSING_EVENT'){const x=i.detail,more=['start','end'].filter(role=>x[role]||x[role+'Unknown']).length+(x.location?1:0);out.required+=more;out.matched+=more}}
   out.issues=out.issues.filter(i=>!removed.includes(i)&&i.code!=='EXTRA_EVENT_REQUIRES_ADJUDICATION');for(let n=0;n<events.length;n++)if(!allocation.has(n))out.issues.push({failure_layer:'REFERENCE',code:'EXTRA_EVENT_REQUIRES_ADJUDICATION',detail:events[n].title})
   out.scorerEventMatchingBugFix={code:'ONE_TO_ONE_SAME_OBJECT_ENDPOINT_MATCH',removed,assignment:[...allocation].map(([actual,expected])=>({eventId:events[actual].tempId,expected}))}
  }
 }
 // Severity bug fix, not a change to the literal wire contract: a uniquely
 // reversible citation-format mismatch is still a wire issue, but does not
 // demonstrate loss of its original source. Keep the issue and partial grade.
 const projected=projectLiteralSourceEvidence(result,source.text),validLiteral=id=>{const e=projected.result.evidence?.find(e=>e.id===id);return typeof e?.quote==='string'&&e.quote.length>0&&source.text.includes(e.quote)}
 const entities=[...(result.standaloneTasks??[]),...(result.milestones??[]).flatMap(m=>[...m.tasks??[],...(m.workPackages??[]).flatMap(w=>w.tasks??[])]),...result.materials??[],...result.timePoints??[],...result.events??[],...result.milestones??[],...(result.milestones??[]).flatMap(m=>m.workPackages??[])]
 const recoveredSourceFlags=out.severe.filter(s=>s.code==='SOURCE_EVIDENCE_LOSS'&&entities.some(e=>e.tempId===s.entity&&e.evidenceIds?.length&&e.evidenceIds.every(validLiteral)))
 if(recoveredSourceFlags.length){out.severe=out.severe.filter(s=>!recoveredSourceFlags.includes(s));out.scorerSeverityAudit={code:'RECOVERABLE_LITERAL_FORMAT_IS_NOT_LOST_SOURCE',removed:recoveredSourceFlags,wireIssuesRetained:true}}
 // A source-authored relative formula is not an invented date. Keep an
 // incomplete older reference visibly disputed; wrong arithmetic still fails.
 const local=v=>/[Zz]|[+-]\d\d:\d\d$/u.test(v??'')?new Intl.DateTimeFormat('sv-SE',{timeZone:source.timezone??'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replace(' ','T'):String(v??'').slice(0,16)
 const verifiedRelative=new Set((projected.result.timePoints??[]).filter(p=>{const c=citedRelativeCutoff(p,projected.result,projected.result.evidence,source.text,{referenceTime:source.referenceTime,timezone:source.timezone});return c&&local(p.normalizedValue)===c.expectedLocal}).map(p=>p.tempId))
 const relativeFlags=out.severe.filter(s=>s.code==='INVENTED_DEADLINE'&&verifiedRelative.has(s.time))
 if(relativeFlags.length){out.severe=out.severe.filter(s=>!relativeFlags.includes(s));out.issues=out.issues.filter(i=>{if(i.code!=='INVENTED_DEADLINE')return true;if(verifiedRelative.has(i.detail?.time))return false;const owners=entities.filter(t=>t.actionObject&&String(t.actionObject).includes(String(i.detail)));return !owners.some(t=>{const ps=(result.timePoints??[]).filter(p=>/deadline/u.test(p.type)&&(p.relatedTaskTempIds?.includes(t.tempId)||t.timePointTempIds?.includes(p.tempId)));return ps.length&&ps.every(p=>verifiedRelative.has(p.tempId))})});out.issues.push({failure_layer:'REFERENCE',code:'REFERENCE_OMITS_EXPLICIT_RELATIVE_CUTOFF',detail:[...verifiedRelative]});out.relativeDeadlineScorerBugFix={removed:relativeFlags,referenceDisputePreserved:true}}
 // Fix only the v4 month-presence heuristic on line-wrapped calendar dates
 // and literal 24:00 month-end rollover, which already denotes next midnight.
 // A complete cited literal date must equal the value; role, owner, obsolete
 // date and invalid-source checks remain unchanged. Old score files stay put.
 const wrappedDateSupported=id=>{
  const p=result.timePoints?.find(t=>t.tempId===id);if(!p?.normalizedValue)return false
  const date=String(p.normalizedValue).slice(0,10),literal=String(p.rawText??'').replace(/\s/gu,'')
  const supported=p.evidenceIds?.some(eid=>{const e=projected.result.evidence?.find(e=>e.id===eid),q=e?.quote??e?.quotedText;return typeof q==='string'&&source.text.includes(q)&&!!resolveLiteralSourceSpan(p.rawText,q)})
  return supported&&[...literal.matchAll(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/gu)].some(m=>{const y=m[1]??date.slice(0,4),day=`${y}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;if(day===date)return true;if(!/24[:：]00/u.test(literal)||!String(p.normalizedValue).startsWith(date+'T00:00'))return false;const ms=Date.parse(day+'T00:00:00Z');return Number.isFinite(ms)&&new Date(ms+86400000).toISOString().slice(0,10)===date})
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
 else out.status=!out.issues.length?'完整':out.issues.every(i=>i.failure_layer==='REFERENCE')?'未知':out.matched>0?'部分':'错'
 // Resolving a duplicate-material representation must never hide another
 // unresolved primary source/owner gate in the ordinary assembler.
 if(out.status==='完整'&&options.audit?.unresolved?.length){out.status='未知';out.issues.push({failure_layer:'SEMANTIC_COMPOSER',code:'UNRESOLVED_SOURCE_SUPPORT_NOT_WHOLE_COMPLETE',detail:options.audit.unresolved})}
 return {...out,reviewVersion:PRODUCT_REVIEW_V51_VERSION,v50Status:out.v4Status===undefined?out.status:reviewV5(result,source,options).status}
}
