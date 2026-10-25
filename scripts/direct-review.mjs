export const DIRECT_REVIEW_VERSION='direct-1.0'
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const has=(s,q)=>q&&norm(s).includes(norm(q))
const tasksOf=r=>[...(r?.standaloneTasks??[]),...(r?.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
const local=(v,zone)=>!v?null:!/[Zz]|[+-]\d\d:\d\d$/u.test(v)?v.slice(0,16):new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replace(' ','T')
/** Frozen source-authored direct references. Selection is not a truth signal:
 * auto-added conditional actions are safe only with an explicit visible tag. */
export function reviewDirect(conversion,source,reference){
 const r=conversion?.result??null,ref=reference?.reference??reference,issues=[],severe=[],edits=new Set(),ts=tasksOf(r),es=r?.events??[],points=r?.timePoints??[],zone=source.timezone??'Asia/Shanghai',matched=new Set(),me=new Set()
 const issue=(code,id,detail,serious=false)=>{const v={code,id,detail};issues.push(v);edits.add(id);if(serious)severe.push(v)}
 if(!r)return{version:DIRECT_REVIEW_VERSION,noEdit:false,changes:null,bin:'无法判定',issues:[{code:'NO_RESULT'}],severe:[],signature:null}
 const supports=e=>e.evidenceIds?.length&&e.evidenceIds.every(id=>{const v=r.evidence.find(v=>v.id===id),q=v?.quotedText??v?.quote;return q&&source.text.includes(q)&&(v.textStart===undefined||source.text.slice(v.textStart,v.textEnd)===q)})
 const own=t=>points.filter(p=>p.relatedTaskTempIds?.includes(t.tempId)||t.timePointTempIds?.includes(p.tempId))
 for(const [i,e]of(ref.tasks??[]).entries()){
  const readerExpected=ref.informationOnly&&(e.verbs??e.actions??[]).includes('查看')
  const t=ts.find(t=>!matched.has(t.tempId)&&(readerExpected||!/^查看[：:]/u.test(t.title))&&[e.object,...(e.aliases??[])].some(o=>has(t.actionObject+' '+t.title,o))&&(e.verbs??e.actions??[]).some(v=>has(t.actionVerb,v)||has(t.title,v)))
  if(!t){issue('MISSING_TASK','task:'+i,e);continue}matched.add(t.tempId)
  const ps=own(t),p=ps.find(p=>/deadline$/u.test(p.type)&&p.normalizedValue)
  if(e.deadline&&(local(p?.normalizedValue,zone)!==e.deadline||p?.precision!==(e.precision??(e.deadline.length===10?'date_only':'exact'))))issue('TASK_DEADLINE','task:'+i+':time',{expected:e.deadline,actual:p??null},Boolean(p?.normalizedValue))
  if(e.deadlineUnknown&&p)issue('INVENTED_DEADLINE','task:'+i+':time',p,true)
  if(e.date&&!ps.some(p=>p.type==='planned_start'&&local(p.normalizedValue,zone)===e.date))issue('TASK_DATE','task:'+i+':time',e.date)
  for(const w of e.windows??(e.window&&typeof e.window==='object'?[e.window]:[]))for(const role of ['start','end'])if(w[role]&&!ps.some(p=>p.type==='event_'+role&&local(p.normalizedValue,zone)===w[role]))issue('TASK_WINDOW','task:'+i+':window:'+role,{expected:w[role]})
  if(!supports(t))issue('SOURCE_LOSS','task:'+i+':source',t.title,true)
  if(e.condition||e.conditional||e.unknownEligibility){const tags=conversion.items?.find(x=>x.tempId===t.tempId)?.tags??[];if(!tags.includes('如符合条件')&&!tags.includes('待确认'))issue('CONDITION_SHOWN_MANDATORY','task:'+i+':condition',e,true)}
 }
 if(ref.readingFallback||ref.informationOnly){const reader=ts.find(t=>t.actionVerb==='查看'&&/^查看[：:]/u.test(t.title));if(reader)matched.add(reader.tempId);else issue('MISSING_READING_TASK','reading',null)}
 for(const[i,e]of(ref.events??[]).entries()){
  const a=es.find(a=>!me.has(a.tempId)&&[e.object,...(e.aliases??[])].some(o=>has(a.title,o)))
  if(!a){issue('MISSING_EVENT','event:'+i,e);continue}me.add(a.tempId)
  if(e.condition||e.conditional||e.unknownEligibility){const tags=conversion.items?.find(x=>x.tempId===a.tempId)?.tags??[];if(!tags.includes('如符合条件')&&!tags.includes('待确认'))issue('CONDITION_SHOWN_MANDATORY','event:'+i+':condition',e,true)}
  for(const role of ['start','end']){const p=points.find(p=>p.tempId===a[role+'TimePointTempId']);if(e[role]&&(local(p?.normalizedValue,zone)!==e[role]||p?.precision!==(e[role].length===10?'date_only':'exact')))issue('EVENT_'+role.toUpperCase(),'event:'+i+':'+role,{expected:e[role],actual:p??null},Boolean(p?.normalizedValue));if(e[role+'Unknown']&&p?.normalizedValue)issue('INVENTED_EVENT_TIME','event:'+i+':'+role,p,true)}
  if(e.location&&!has(a.location,e.location))issue('EVENT_LOCATION','event:'+i+':location',{expected:e.location,actual:a.location},Boolean(a.location))
  if(!supports(a))issue('SOURCE_LOSS','event:'+i+':source',a.title,true)
 }
 for(const t of ts.filter(t=>!matched.has(t.tempId))){
  // R1 same-object delivery steps can be equivalent, but a reading item cannot replace an action.
  const same=(ref.tasks??[]).some(e=>has(t.actionObject,e.object)&&(e.verbs??e.actions??[]).some(v=>has(t.actionVerb,v)))
  if(!same)issue('EXTRA_TASK','extra-task:'+t.tempId,t.title,!supports(t)&&t.actionVerb!=='查看')
 }
 for(const e of es.filter(e=>!me.has(e.tempId)))issue('EXTRA_EVENT','extra-event:'+e.tempId,e.title,!supports(e))
 for(const f of ref.forbidden??[])for(const t of ts)if(t.actionVerb!=='查看'&&has(t.actionObject+' '+t.title,f.object)&&f.verbs.some(v=>has(t.actionVerb,v)))issue('CANCELLED_OR_PROHIBITED','forbidden:'+t.tempId,f,true)
 for(const p of points)if(p.normalizedValue&&(ref.obsoleteDates??ref.obsoleteTimes??[]).some(d=>local(p.normalizedValue,zone)?.startsWith(d)))issue('OBSOLETE_TIME','time:'+p.tempId,p,true)
 const signature={tasks:ts.map(t=>[t.actionVerb,t.actionObject,own(t).filter(p=>p.normalizedValue).map(p=>[p.type,local(p.normalizedValue,zone),p.precision]).sort()]).sort(),events:es.map(e=>[e.title,...['start','end'].map(role=>{const p=points.find(p=>p.tempId===e[role+'TimePointTempId']);return p?[p.type,local(p.normalizedValue,zone),p.precision]:null}),e.location]).sort()}
 return{version:DIRECT_REVIEW_VERSION,noEdit:issues.length===0,changes:edits.size,bin:edits.size===0?'0':edits.size<=2?'1–2':'3+',issues,severe,signature}
}
