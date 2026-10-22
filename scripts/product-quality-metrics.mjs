// Auxiliary, reference-bounded Development measurements. Never changes v5.1/v6.
// The reference is a minimum, so unmatched predictions are UNADJUDICATED, not FP.
export const AUXILIARY_METRICS_VERSION='product-quality-fields-and-edits-1.0.0'
const text=v=>String(v??'').replace(/\s/gu,'')
const has=(v,k)=>!!k&&text(v).includes(text(k))
export const tasksOf=r=>[...(r?.standaloneTasks??[]),...(r?.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
const local=(v,zone)=>!v?null:!/[Zz]|[+-]\d\d:\d\d$/u.test(v)?String(v).slice(0,16):new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replace(' ','T')
const owned=(entity,t,key)=>entity?.relatedTaskTempIds?.includes(t?.tempId)||t?.[key]?.includes(entity?.tempId)
function allocate(expected,actual,cost){
  // Maximum cardinality first, then fewest differing semantic fields. A greedy
  // first-title lookup can assign two same-named events to the wrong endpoints.
  const edges=expected.map(e=>actual.map((a,i)=>({i,c:cost(e,a)})).filter(x=>Number.isFinite(x.c)).sort((a,b)=>a.c-b.c||a.i-b.i))
  const owner=new Map(),assign=(e,seen)=>{for(const {i}of edges[e]){if(seen.has(i))continue;seen.add(i);if(!owner.has(i)||assign(owner.get(i),seen)){owner.set(i,e);return true}}return false}
  expected.map((_,i)=>i).sort((a,b)=>edges[a].length-edges[b].length).forEach(i=>assign(i,new Set()))
  return new Map([...owner].map(([a,e])=>[e,a]))
}
export function measureQuality(result,source,{referenceV6=null,grade=null,audit=null}={}){
  const ref=referenceV6?.reference??source.reference,zone=source.timezone??'Asia/Shanghai',tasks=tasksOf(result),events=result?.events??[],points=result?.timePoints??[],materials=result?.materials??[],evidence=new Map((result?.evidence??[]).map(e=>[e.id,e])),rows=[],edits=new Set(),unknown=new Set()
  const valid=e=>!!e?.evidenceIds?.length&&e.evidenceIds.every(id=>{const q=evidence.get(id)?.quote;return typeof q==='string'&&q.length>0&&source.text.includes(q)})
  const field=(category,key,ok,present,entity,expected,actual,editKey=key)=>{const status=ok?'TP':present?'FP':'FN';rows.push({category,key,status,entity:entity?.tempId??null,expected,actual:actual??null});if(!ok)edits.add(editKey)}
  const deadline=(t,e)=>points.filter(p=>owned(p,t,'timePointTempIds')&&/deadline$/u.test(p.type)).sort((a,b)=>Number((local(b.normalizedValue,zone)??'').startsWith(e.deadline??''))-Number((local(a.normalizedValue,zone)??'').startsWith(e.deadline??'')))[0]
  const surface=t=>[t.title,t.actionObject,t.description].join(' ')
  const taskMatch=allocate(ref.tasks??[],tasks,(e,t)=>has(surface(t),e.object)&&e.verbs.some(v=>has(t.actionVerb||t.title,v))?Number(!!e.deadline&&!(local(deadline(t,e)?.normalizedValue,zone)??'').startsWith(e.deadline)):Infinity)
  for(const [i,e]of(ref.tasks??[]).entries()){
    const t=tasks[taskMatch.get(i)],root='task:'+i,missing=root+':add'
    field('task',root,!!t&&valid(t),!!t,t,e.object,t?.actionObject,missing)
    if(!t){field('taskObject',root+':object',false,false,null,e.object,null,missing);for(const [k,c]of[['deadline','deadline'],['deadlineUnknown','deadline'],['material','material'],['channel','locationChannel'],['channelUnknown','locationChannel'],['condition','condition'],['unknownEligibility','condition'],['predecessor','relation'],['criteria','requirement'],['window','eventTime']])if(e[k])field(c,root+':'+k,false,false,null,e[k],null,missing);continue}
    field('taskObject',root+':object',has(surface(t),e.object)&&valid(t),true,t,e.object,t.actionObject,root+':object')
    if(e.deadline){const p=deadline(t,e),value=local(p?.normalizedValue,zone),match=e.precision==='date_only'?value?.slice(0,10)===e.deadline:value===e.deadline;field('deadline',root+':deadline',!!p&&match&&valid(p)&&(!e.precision||p.precision===e.precision),!!p,p,e.deadline,value,root+':deadline')}
    if(e.deadlineUnknown){const p=deadline(t,e);field('deadline',root+':deadlineUnknown',!p?.normalizedValue,true,t,'unknown',p?.normalizedValue,root+':deadline')}
    if(e.material){const m=materials.find(m=>owned(m,t,'materialTempIds')&&has(m.name,e.material));const equivalent=grade?.equivalence?.some(x=>x.code==='MISSING_OWNED_MATERIAL'&&x.detail===e.material);field('material',root+':material',!!m&&valid(m)||!!equivalent,!!m,m,e.material,m?.name,root+':material')}
    if(e.channel){const m=materials.find(m=>owned(m,t,'materialTempIds')&&has(m.submissionChannel,e.channel));field('locationChannel',root+':channel',!!m&&valid(m)||has(t.description,e.channel)&&valid(t),!!m||!!t.description,t,e.channel,m?.submissionChannel??t.description,root+':channel')}
    if(e.channelUnknown){const ms=materials.filter(m=>owned(m,t,'materialTempIds'));field('locationChannel',root+':channelUnknown',ms.every(m=>!m.submissionChannel),true,t,'unknown',ms.map(m=>m.submissionChannel),root+':channel')}
    if(e.condition)field('condition',root+':condition',has([t.description,...(t.completionCriteria??[])].join(' '),e.condition)&&valid(t),true,t,e.condition,t.description,root+':condition')
    if(e.unknownEligibility)field('condition',root+':selection',t.selected!==true,true,t,'not preselected',t.selected,root+':selection')
    if(e.criteria)field('requirement',root+':criteria',(t.completionCriteria??[]).some(c=>has(c,e.criteria)),true,t,e.criteria,t.completionCriteria,root+':criteria')
    if(e.predecessor)field('relation',root+':predecessor',(t.dependencyTempIds??[]).some(id=>tasks.some(p=>p.tempId===id&&has(surface(p),e.predecessor))),true,t,e.predecessor,t.dependencyTempIds,root+':relation')
    if(e.window){const ps=points.filter(p=>owned(p,t,'timePointTempIds'));let ok=false
      if(typeof e.window==='string'){const [day,clocks]=e.window.split('T'),[start,end]=(clocks??'').split('/');ok=!!start&&!!end&&ps.some(p=>local(p.normalizedValue,zone)===day+'T'+start&&valid(p))&&ps.some(p=>local(p.normalizedValue,zone)===day+'T'+end&&valid(p))}
      else if(e.window&&typeof e.window==='object'){ok=['start','end'].every(role=>{const expected=e.window[role];return typeof expected==='string'&&ps.some(p=>p.type==='event_'+role&&valid(p)&&p.precision===(expected.length===10?'date_only':'exact')&&local(p.normalizedValue,zone)===expected)})}
      field('eventTime',root+':window',ok,ps.length>0,t,e.window,ps.map(p=>[p.type,p.normalizedValue,p.precision]),root+':window')}

  }
  const eventMatch=allocate(ref.events??[],events,(e,a)=>has([a.title,a.description].join(' '),e.object)?['start','end'].reduce((n,k)=>n+Number(!!e[k]&&!(local(points.find(p=>p.tempId===a[k+'TimePointTempId'])?.normalizedValue,zone)??'').startsWith(e[k])),0):Infinity)
  for(const[i,e]of(ref.events??[]).entries()){
    const a=events[eventMatch.get(i)],root='event:'+i,missing=root+':add'
    field('event',root,!!a&&valid(a),!!a,a,e.object,a?.title,missing)
    for(const role of['start','end']){if(!e[role]&&!e[role+'Unknown'])continue;const p=points.find(p=>p.tempId===a?.[role+'TimePointTempId']),v=local(p?.normalizedValue,zone),forecast=grade?.scorerForecastBugFix?.removed?.some(i=>i.detail?.role===role&&i.detail?.expected?.object===e.object)&&p?.needsConfirmation===true&&p.selected===false&&valid(p),ok=e[role]?!!p&&p.type==='event_'+role&&(e[role].length===10?v?.slice(0,10):v)===e[role]&&valid(p):!p?.normalizedValue||forecast;field('eventTime',root+':'+role,!!a&&ok,!!p,p,e[role]??'unknown',v,a?root+':'+role:missing)}
    if(e.location)field('locationChannel',root+':location',!!a&&has(a.location,e.location)&&valid(a),!!a?.location,a,e.location,a?.location,a?root+':location':missing)
  }
  const visible=JSON.stringify([result?.sourceSummary,...tasks.map(t=>[t.title,t.actionObject,t.description,t.completionCriteria]),...events.map(e=>[e.title,e.description,e.location]),...materials.map(m=>[m.name,m.formatRequirements,m.namingRequirements,m.submissionChannel]),...(result?.ignoredContent??[]).map(i=>i.text)])
  // Several missing tokens in one description/format field can be fixed by one
  // semantic edit. These lower bounds must not count each token as another click.
  for(const[kind,category]of[['information','information'],['criteria','requirement'],['formats','requirement'],['naming','requirement']])for(const[k,i]of(ref[kind]??[]).map((v,i)=>[v,i]))field(category,kind+':'+i,has(visible,k),false,null,k,null,'source:'+kind)
  for(const[i,r]of(referenceV6?.preservedRequirements??[]).entries()){const candidates=[...tasks,...events,...materials],good=candidates.some(e=>r.tokens.every(t=>has(JSON.stringify(e),t))&&(!r.condition||has(JSON.stringify(e),r.condition))&&(!r.unknownEligibility||e.selected!==true)&&valid(e));field('requirement','retained:'+i,good,!!result,null,r,null,'retained:'+i)}
  // Unmatched predictions may be legal extra facts: expose them for adjudication.
  for(const [kind,actual,used]of[['task',tasks,new Set(taskMatch.values())],['event',events,new Set(eventMatch.values())]])actual.forEach((e,i)=>{if(!used.has(i)&&!grade)unknown.add(kind+':'+e.tempId)})
  for(const issue of grade?.issues??[]){if(issue.failure_layer==='REFERENCE')unknown.add('reference:'+issue.code+':'+JSON.stringify(issue.detail));if(issue.failure_layer==='MODEL_WIRE')unknown.add('wire:'+JSON.stringify(issue.detail))}
  for(const u of audit?.unresolved??[])unknown.add('support:'+u.entityId+':'+u.reason)
  if(!result)unknown.add('NO_USABLE_FIRST_RESULT')
  if(grade?.status==='完整'&&unknown.size===0&&edits.size>0)unknown.add('METRIC_EQUIVALENCE_REQUIRES_REVIEW')
  const categories={};for(const r of rows){const c=categories[r.category]??={TP:0,FP:0,FN:0};c[r.status]++}
  for(const c of Object.values(categories)){c.referenceDenominator=c.TP+c.FP+c.FN;c.recall=c.referenceDenominator?c.TP/c.referenceDenominator:null;c.precisionOnAdjudicatedReferenceFields=c.TP+c.FP?c.TP/(c.TP+c.FP):null}
  return {version:AUXILIARY_METRICS_VERSION,scope:'Development minimum-reference field diagnostic; not population accuracy or observed human edit time',categories,rows,unadjudicated:[...unknown],minimumKnownEdits:result?edits.size:null,editKeys:[...edits],editBin:!result||unknown.size?'无法测定':edits.size===0?'0':edits.size<=2?'1–2':'3+',wholeGrade:grade?.status??null,precisionBoundary:'Only matched reference fields adjudicated; unmatched entities explicitly unadjudicated, never silently counted correct or wrong'}
}
export function aggregateQuality(items){const out={denominator:items.length,categories:{},editBins:{'0':0,'1–2':0,'3+':0,'无法测定':0},knownEditLowerBounds:[],unadjudicatedItems:0};for(const x of items){out.editBins[x.editBin]++;if(x.minimumKnownEdits!==null)out.knownEditLowerBounds.push(x.minimumKnownEdits);if(x.unadjudicated.length)out.unadjudicatedItems++;for(const[k,c]of Object.entries(x.categories)){const a=out.categories[k]??={TP:0,FP:0,FN:0};for(const t of['TP','FP','FN'])a[t]+=c[t]}}for(const a of Object.values(out.categories)){a.referenceDenominator=a.TP+a.FP+a.FN;a.recall=a.referenceDenominator?a.TP/a.referenceDenominator:null;a.precisionOnAdjudicatedReferenceFields=a.TP+a.FP?a.TP/(a.TP+a.FP):null}return out}
