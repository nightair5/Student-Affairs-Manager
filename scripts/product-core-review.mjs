// Owner-authorized core-1.0. Whole-grade v5.1/v6 is intentionally unchanged.
import {measureQuality,tasksOf,aggregateQuality} from './product-quality-metrics.mjs'
export const CORE_REVIEW_VERSION='core-1.0'
const norm=v=>String(v??'').replace(/\s/gu,''),has=(v,k)=>!!k&&norm(v).includes(norm(k))
const local=(v,zone)=>!v?null:!/[Zz]|[+-]\d\d:\d\d$/u.test(v)?String(v).slice(0,16):new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replace(' ','T')

// Source support need not repeat a display name as one contiguous phrase.
// Every substantive component must occur in this entity's own real citation.
function citedComponents(value,quote){let rest=norm(value).replace(/[《》“”'、，,（）()·：:]/gu,''),q=norm(quote).replace(/[《》“”'、，,（）()·：:]/gu,'');while(rest){if(/^[的和与及并]/u.test(rest)){rest=rest.slice(1);continue}let n=rest.length;while(n>=2&&!q.includes(rest.slice(0,n)))n--;if(n<2)return false;rest=rest.slice(n)}return true}
const verbInQuote=(v,q)=>has(q,v)||({撰写:['写'],提交:['交','递交'],扫码:['扫以下二维码','扫描二维码'],登录:['登陆'],缴纳:['缴费','支付']}[v]??[]).some(a=>has(q,a))

export function reviewCore(result,source,{coreReference,legacyGrade=null,audit=null}={}){
 const ref=coreReference?.core;if(!ref)throw Error('FROZEN_CORE_REFERENCE_REQUIRED')
 const tasks=tasksOf(result),events=result?.events??[],points=result?.timePoints??[],zone=source.timezone??'Asia/Shanghai',issues=[],severe=[],edits=new Set(),decisions=new Set(),ev=new Map((result?.evidence??[]).map(e=>[e.id,e]))
 const supported=e=>!!e?.evidenceIds?.length&&e.evidenceIds.every(id=>{const q=ev.get(id);if(!q?.quote||!source.text.includes(q.quote))return false;return q.textStart===undefined&&q.textEnd===undefined||Number.isInteger(q.textStart)&&Number.isInteger(q.textEnd)&&source.text.slice(q.textStart,q.textEnd)===q.quote})
 const metric=measureQuality(result,source,{referenceV6:{reference:ref},grade:legacyGrade,audit})
 const missing=new Set(metric.rows.filter(r=>['task','event'].includes(r.category)&&!r.entity).map(r=>r.key))
 const category=new Set(['task','taskObject','deadline','event','eventTime','locationChannel'])
 for(const row of metric.rows.filter(r=>category.has(r.category)&&r.status!=='TP')){issues.push({code:'CORE_'+row.category.toUpperCase(),field:row.key,expected:row.expected,actual:row.actual,entity:row.entity});edits.add([...missing].find(k=>row.key===k||row.key.startsWith(k+':'))?([...missing].find(k=>row.key===k||row.key.startsWith(k+':'))+':add'):row.key.replace(/:object$/u,'').replace(/:deadlineUnknown$/u,':deadline'))}
 const secondary=measureQuality(result,source,{referenceV6:{reference:coreReference.secondary??source.reference,preservedRequirements:coreReference.preservedRequirements??[]},grade:legacyGrade,audit})
 const secondaryFields={categories:Object.fromEntries(Object.entries(secondary.categories).filter(([k])=>['material','locationChannel','condition','requirement'].includes(k))),unadjudicated:secondary.unadjudicated}
 if(!result){issues.push({code:'NO_USABLE_FIRST_RESULT'});return{version:CORE_REVIEW_VERSION,status:'不可用',usable:false,direct:false,afterReview:false,issues,severe,coreChanges:null,coreEditBin:'无法判定',decisionCount:null,signature:null,secondary:secondaryFields}}
 const taskRows=metric.rows.filter(r=>r.category==='task'),eventRows=metric.rows.filter(r=>r.category==='event'),matchedTasks=new Set(taskRows.map(r=>r.entity).filter(Boolean)),matchedEvents=new Set(eventRows.map(r=>r.entity).filter(Boolean))
 const problem=(code,entity,key,detail,serious=false)=>{issues.push({code,entity,detail});edits.add(key);if(serious)severe.push({code,entity,detail})}
 for(const[i,e]of(ref.tasks??[]).entries()){
  const t=tasks.find(t=>t.tempId===taskRows[i]?.entity);if(!t)continue
  const own=points.filter(p=>t.timePointTempIds?.includes(p.tempId)||p.relatedTaskTempIds?.includes(t.tempId))
  if((e.unknownEligibility||e.condition)&&t.selected!==false)problem('UNDETERMINED_CONDITION_SHOWN_MANDATORY',t.tempId,'task:'+i+':selection',e.condition??'unknown eligibility',true)
  if(t.selected===false)decisions.add(t.tempId)
  if(e.deadline){const p=own.find(p=>/deadline$/u.test(p.type)),precision=e.precision??(e.deadline.length===10?'date_only':'exact');if(p&&p.precision!==precision)problem('CORE_DEADLINE_PRECISION',p.tempId,'task:'+i+':deadline',{expected:precision,actual:p.precision});if(p?.normalizedValue&&local(p.normalizedValue,zone)!==e.deadline&&precision==='exact')problem('CORE_WRONG_DEADLINE',p.tempId,'task:'+i+':deadline',{expected:e.deadline,actual:local(p.normalizedValue,zone)},true)}
  if(e.deadlineUnknown&&own.some(p=>/deadline$/u.test(p.type)&&p.normalizedValue))problem('CORE_INVENTED_DEADLINE',t.tempId,'task:'+i+':deadline',own.filter(p=>/deadline$/u.test(p.type)),true)
  if((e.window||e.windows)&&!e.deadline&&own.some(p=>/deadline$/u.test(p.type)&&p.normalizedValue))problem('WINDOW_PROMOTED_TO_DEADLINE',t.tempId,'task:'+i+':window','Only a handling opportunity is stated',true)
  for(const [w,range]of(e.windows??[]).entries())for(const role of ['start','end']){const expected=range[role],p=own.find(p=>p.type==='event_'+role&&(expected.length===10?local(p.normalizedValue,zone)?.slice(0,10):local(p.normalizedValue,zone))===expected);if(!p||!supported(p)||p.precision!==(expected.length===10?'date_only':'exact'))problem('CORE_WINDOW_ENDPOINT',t.tempId,'task:'+i+':window:'+w+':'+role,{expected,actual:own.map(p=>[p.type,p.normalizedValue,p.precision])});}
  if(e.alternativeDates){const quoted=(t.evidenceIds??[]).map(id=>ev.get(id)?.quote??'').join(' '),description=[t.description,...(t.completionCriteria??[])].join(' ');if(!e.alternativeDates.every(d=>{const [,m,day]=d.split('-').map(Number);return new RegExp(m+'\\s*月\\s*'+day+'\\s*日','u').test(quoted+' '+description)}))problem('CORE_ALTERNATIVE_OPTIONS_MISSING',t.tempId,'task:'+i+':options',e.alternativeDates);if(own.some(p=>/deadline$/u.test(p.type)&&p.normalizedValue))problem('ALTERNATIVE_DATES_PROMOTED_TO_DEADLINE',t.tempId,'task:'+i+':deadline',null,true);}
  if(!citedComponents(e.object,(t.evidenceIds??[]).map(id=>ev.get(id)?.quote??'').join(' ')))problem('CORE_OBJECT_EVIDENCE_MISMATCH',t.tempId,'task:'+i+':source',e.object);
  if(!supported(t))problem('CORE_SOURCE_EVIDENCE_LOSS',t.tempId,'task:'+i+':source',null,true)
 }
 for(const[i,e]of(ref.events??[]).entries()){
  const a=events.find(a=>a.tempId===eventRows[i]?.entity);if(!a)continue
  if((e.unknownEligibility||e.condition)&&a.selected!==false)problem('UNDETERMINED_CONDITION_SHOWN_MANDATORY',a.tempId,'event:'+i+':selection',e.condition??'unknown eligibility',true)
  if(a.selected===false)decisions.add(a.tempId)
  if(!citedComponents(e.object,(a.evidenceIds??[]).map(id=>ev.get(id)?.quote??'').join(' ')))problem('CORE_OBJECT_EVIDENCE_MISMATCH',a.tempId,'event:'+i+':source',e.object);
  if(!supported(a))problem('CORE_SOURCE_EVIDENCE_LOSS',a.tempId,'event:'+i+':source',null,true)
  for(const role of ['start','end']){const p=points.find(p=>p.tempId===a[role+'TimePointTempId']);if(e[role]&&p){const precision=e[role].length===10?'date_only':'exact';if(p.precision!==precision)problem('CORE_EVENT_PRECISION',p.tempId,'event:'+i+':'+role,{expected:precision,actual:p.precision});if(e[role+'Tentative']&&(!p.needsConfirmation||p.selected!==false))problem('TENTATIVE_EVENT_SHOWN_FIXED',p.tempId,'event:'+i+':'+role,{expected:'tentative source date, not fixed attendance'});if(!supported(p))problem('CORE_TIME_EVIDENCE_LOSS',p.tempId,'event:'+i+':'+role,null,true)}}
 }
 for(const f of ref.forbidden??[])for(const t of tasks)if(has([t.title,t.actionObject,t.description].join(' '),f.object)&&f.verbs.some(v=>has(t.actionVerb||t.title,v)))problem('CANCELLED_OR_PROHIBITED_ACTION',t.tempId,'extra:'+t.tempId,f,true)
 for(const p of points)if(/deadline$/u.test(p.type)&&p.normalizedValue&&(ref.obsoleteDates??[]).some(d=>(local(p.normalizedValue,zone)??'').startsWith(d))&&p.selected!==false)problem('OBSOLETE_DEADLINE_REACTIVATED',p.tempId,'time:'+p.tempId,p.normalizedValue,true)
 // Minimum refs do not enumerate every legal step. Extra items are allowed
 // only with their own literal action/object support; R1–R5 do not waive source.
 for(const t of tasks.filter(t=>!matchedTasks.has(t.tempId))){const qs=(t.evidenceIds??[]).map(id=>ev.get(id)?.quote??''),declared=citedComponents(t.actionObject,qs.join(' '))&&verbInQuote(t.actionVerb,qs.join(' '));if(!supported(t)||!declared)problem('UNSUPPORTED_EXTRA_TASK',t.tempId,'extra:'+t.tempId,t.title,t.selected!==false)}
 for(const e of events.filter(e=>!matchedEvents.has(e.tempId))){const qs=(e.evidenceIds??[]).map(id=>ev.get(id)?.quote??'');if(!supported(e)||!citedComponents(e.title,qs.join(' ')))problem('UNSUPPORTED_EXTRA_EVENT',e.tempId,'extra:'+e.tempId,e.title,e.selected!==false)}
 const coreIds=new Set([...matchedTasks,...matchedEvents,...points.filter(p=>events.some(e=>matchedEvents.has(e.tempId)&&[e.startTimePointTempId,e.endTimePointTempId].includes(p.tempId))||tasks.some(t=>matchedTasks.has(t.tempId)&&(t.timePointTempIds?.includes(p.tempId)||p.relatedTaskTempIds?.includes(t.tempId)))).map(p=>p.tempId)])
 for(const u of audit?.unresolved??[])if(coreIds.has(u.entityId))problem('CORE_SUPPORT_BLOCKED',u.entityId,'support:'+u.entityId,u.reason)
 for(const c of result.conflicts??[])if(c.requiresDecision&&(c.entityTempIds??[]).some(id=>coreIds.has(id)))for(const id of c.entityTempIds.filter(id=>coreIds.has(id)))decisions.add(id)
 for(const p of points.filter(p=>coreIds.has(p.tempId)&&p.needsConfirmation))decisions.add((events.find(e=>[e.startTimePointTempId,e.endTimePointTempId].includes(p.tempId))??tasks.find(t=>t.timePointTempIds?.includes(p.tempId)))?.tempId??p.tempId)
 const usable=issues.length===0&&decisions.size<=2,status=!usable?'不可用':decisions.size?'核对后可用':'直接可用'
 const pointSignature=p=>p?[p.type,local(p.normalizedValue,zone),p.precision]:null
 const signature=JSON.stringify({tasks:tasks.map(t=>({object:ref.tasks[taskRows.findIndex(r=>r.entity===t.tempId)]?.object??norm(t.actionObject||t.title),times:points.filter(p=>t.timePointTempIds?.includes(p.tempId)||p.relatedTaskTempIds?.includes(t.tempId)).map(pointSignature).sort()})).sort((a,b)=>a.object.localeCompare(b.object)),events:events.map(a=>({object:ref.events[eventRows.findIndex(r=>r.entity===a.tempId)]?.object??norm(a.title),start:pointSignature(points.find(p=>p.tempId===a.startTimePointTempId)),end:pointSignature(points.find(p=>p.tempId===a.endTimePointTempId)),location:norm(a.location)})).sort((a,b)=>a.object.localeCompare(b.object))})
 return{version:CORE_REVIEW_VERSION,status,usable,direct:status==='直接可用',afterReview:status==='核对后可用',issues,severe,coreChanges:edits.size,coreEditBin:edits.size===0?'0':edits.size<=2?'1–2':'3+',decisionCount:decisions.size,signature,secondary:secondaryFields,scope:'Owner core-1.0 Development diagnostic, provisional reference; not whole completeness or observed human acceptance'}
}
export function summarizeCore(rows){const measured=rows.filter(r=>r.coreChanges!==null);return{denominator:rows.length,direct:rows.filter(r=>r.direct).length,afterReview:rows.filter(r=>r.afterReview).length,usable:rows.filter(r=>r.usable).length,unusable:rows.filter(r=>!r.usable).length,coreEditBins:Object.fromEntries(['0','1–2','3+','无法判定'].map(k=>[k,rows.filter(r=>r.coreEditBin===k).length])),seriousFindings:rows.reduce((n,r)=>n+r.severe.length,0),measured:measured.length,secondary:aggregateQuality(rows.map(r=>({categories:r.secondary?.categories??{},editBin:'无法测定',minimumKnownEdits:null,unadjudicated:r.secondary?.unadjudicated??[]}))).categories}}
