// Source-authored, object-specific safety checks. No tested adapter creates references.
export const SEVERITY_VERSION='product-development-severity-3.0.0'
const same=(a,b)=>String(a??'').replace(/\s/gu,'').includes(String(b??'').replace(/\s/gu,''))
const tasksOf=r=>[...(r?.standaloneTasks??[]),...(r?.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
function local(v,zone){if(!v)return null;if(!/[Zz]|[+-]\d\d:\d\d$/u.test(v))return String(v).slice(0,16);return new Intl.DateTimeFormat('sv-SE',{timeZone:zone??'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replace(' ','T')}
export function sourceTimeSafety(result,source){
 const findings=[],tasks=tasksOf(result),points=result?.timePoints??[],ref=source.reference
 for(const p of points.filter(p=>/deadline/u.test(p.type)&&p.normalizedValue)){
  const owners=tasks.filter(t=>p.relatedTaskTempIds?.includes(t.tempId)||t.timePointTempIds?.includes(p.tempId))
  // Historical, explicitly unselected and ownerless context is not an active cutoff.
  if(p.selected===false&&!owners.length&&!(result.events??[]).some(e=>e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId))continue
  const actual=local(p.normalizedValue,source.timezone)
  const candidates=ref.tasks.filter(e=>owners.some(t=>same([t.actionObject,t.title,t.description].join(' '),e.object)))
  const exact=candidates.filter(e=>e.deadline&&(e.precision==='date_only'?actual?.slice(0,10)===e.deadline:actual===e.deadline))
  if(exact.length)continue
  let code=null
  for(const e of candidates){
   if(e.window&&!e.deadline){const [date,clocks]=e.window.split('T');const [start,end]=clocks?.split('/')??[];if(actual===date+'T'+start)code='WINDOW_START_AS_DEADLINE';else if(actual===date+'T'+end)code='WINDOW_AS_DEADLINE'}
   if(e.deadlineUnknown)code='INVENTED_DEADLINE'
   if(e.deadline&&(e.precision==='exact'&&actual!==e.deadline))code=code??'WRONG_DEADLINE_VALUE'
  }
  for(const e of ref.events??[]){if(e.start===actual&&!exact.length&&owners.some(t=>same([t.title,t.actionObject,t.description].join(' '),e.object)))code='EVENT_START_AS_DEADLINE'}
  if((ref.obsoleteDates??[]).some(d=>actual?.startsWith(d)))code='OBSOLETE_DEADLINE'
  if(code)findings.push({code,time:p.tempId,owners:owners.map(t=>t.tempId),actual,evidence:p.evidenceIds??[]})
 }
 return findings
}
