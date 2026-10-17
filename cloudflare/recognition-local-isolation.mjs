import {validateRecognitionResult} from './recognition-contract.generated.mjs'

export const LOCAL_ISOLATION_VERSION='recognition-local-isolation-1.0.0'
export const LOCAL_ISOLATION_NOTE_PREFIX='local-isolation:'
const record=v=>v&&typeof v==='object'&&!Array.isArray(v)
const array=v=>Array.isArray(v)?v:[]
const tasksOf=r=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
export const hasLocalIsolationPending=r=>(r?.ambiguities??[]).some(a=>a.id?.startsWith(LOCAL_ISOLATION_NOTE_PREFIX))
export const unanchoredAcademicWeek=text=>typeof text==='string'&&/第\s*[一二三四五六七八九十\d]+\s*(?:[-—–至到]\s*[一二三四五六七八九十\d]+\s*)?周/u.test(text)&&!/(?:\d{4}[年/-])?\d{1,2}\s*月\s*\d{1,2}\s*日|\d{4}-\d{2}-\d{2}/u.test(text)
export function retainUnanchoredWeekTimes(result){for(const p of result.timePoints)if(unanchoredAcademicWeek(p.rawText))Object.assign(p,{normalizedValue:null,isAllDay:false,precision:'vague',needsConfirmation:true,selected:false});return result}

/** Quarantine untrusted items outside the accept-able fact graph. Their exact
 * model values remain in audit and ordinary clarification notes. No evidence,
 * owner, missing action, date or material is fabricated; strict schema remains. */
export function isolateRecognitionItems(input,sourceText,{sourceId,structural=true,allowNoUsableSubset=false}={}){
 const audit={version:LOCAL_ISOLATION_VERSION,inferredFacts:0,quarantined:[],structure:[],relations:[]}
 if(!record(input)||input.schemaVersion!=='2.0'||!Array.isArray(input.evidence)||!['standaloneTasks','milestones','materials','timePoints','events'].every(k=>Array.isArray(input[k])))return {result:null,audit,rootFailure:true}
 const result=structuredClone(input),blocked=new Set(),removed=new Set(),notes=[]
 const note=(kind,path,value,reason)=>{
  const entry={kind,path,id:typeof value?.tempId==='string'?value.tempId:null,reason,original:structuredClone(value)};audit.quarantined.push(entry)
  if(entry.id)removed.add(entry.id)
  const label=String(value?.title??value?.name??value?.rawText??'模型返回的事项').slice(0,130)
  notes.push({id:LOCAL_ISOLATION_NOTE_PREFIX+notes.length,field:'source_reference',message:`“${label}”：${reason==='INVALID_SOURCE'?'这一项在原文中找不到可靠依据':'这一项的结构不完整'}，未作为可直接接受的事实；请核对原文。`,options:['保留待核对','依据原文补录或拒绝'],evidenceIds:[]})
 }
 const evidenceCounts=new Map();for(const e of result.evidence)evidenceCounts.set(e?.id,(evidenceCounts.get(e?.id)??0)+1)
 const validEvidence=result.evidence.filter(e=>record(e)&&typeof e.id==='string'&&evidenceCounts.get(e.id)===1&&typeof(e.quote??e.quotedText)==='string'&&(e.quote??e.quotedText).trim()&&sourceText.includes(e.quote??e.quotedText)&&(!sourceId||e.sourceId===sourceId))
 const validIds=new Set(validEvidence.map(e=>e.id))
 for(const e of result.evidence)if(!validEvidence.includes(e))audit.quarantined.push({kind:'evidence',path:'evidence',id:e?.id??null,reason:'INVALID_SOURCE',original:structuredClone(e)})
 result.evidence=validEvidence
 const rootShell={...result,projectSuggestion:null,milestones:[],standaloneTasks:[],materials:[],timePoints:[],events:[],conflicts:[],ambiguities:[],ignoredContent:[]}
 const shape=(kind,item)=>{
  const probe={...rootShell};if(kind==='task')probe.standaloneTasks=[item];else if(kind==='milestone')probe.milestones=[item];else if(kind==='workPackage')probe.milestones=[{tempId:'isolation-container',title:'容器校验',objective:'',order:0,evidenceIds:[],tasks:[],workPackages:[item]}];else probe[kind]=[item]
  return validateRecognitionResult(probe).failureCategory!=='schema'
 }
 const ids=new Map();const countItem=e=>{if(record(e)&&typeof e.tempId==='string')ids.set(e.tempId,(ids.get(e.tempId)??0)+1)}
 for(const e of [...result.standaloneTasks,...result.materials,...result.timePoints,...result.events])countItem(e)
 for(const m of result.milestones){countItem(m);for(const t of array(m?.tasks))countItem(t);for(const w of array(m?.workPackages)){countItem(w);for(const t of array(w?.tasks))countItem(t)}}
 if([...ids.values()].some(n=>n>1)||[...evidenceCounts.values()].some(n=>n>1))return {result:null,audit,rootFailure:true,reason:'ROOT_IDENTITY_AMBIGUOUS'}
 const kept=(kind,item,path)=>{
  if(!record(item)||(structural&&!shape(kind,item))||ids.get(item.tempId)!==1){note(kind,path,item,'INVALID_ITEM_STRUCTURE');return false}
  if(!Array.isArray(item.evidenceIds)||!item.evidenceIds.length||item.evidenceIds.some(id=>!validIds.has(id))){note(kind,path,item,'INVALID_SOURCE');return false}
  return true
 }
 const missingArray=(obj,key,path)=>{if(!Array.isArray(obj[key])){audit.structure.push({path:path+'.'+key,original:obj[key]??null,status:'NOT_PROVIDED_NOT_KNOWN_EMPTY'});obj[key]=[];notes.push({id:LOCAL_ISOLATION_NOTE_PREFIX+notes.length,field:'structure',message:'部分模型结构未完整返回，其他有依据的事项仍可处理；请核对原文是否还有遗漏。',options:[],evidenceIds:[]})}}
 result.standaloneTasks=result.standaloneTasks.filter((t,i)=>kept('task',t,`standaloneTasks[${i}]`))
 result.materials=result.materials.filter((m,i)=>kept('materials',m,`materials[${i}]`))
 result.timePoints=result.timePoints.filter((p,i)=>kept('timePoints',p,`timePoints[${i}]`))
 result.events=result.events.filter((e,i)=>kept('events',e,`events[${i}]`))
 result.milestones=result.milestones.flatMap((m,i)=>{
  if(!record(m)){note('milestone',`milestones[${i}]`,m,'INVALID_ITEM_STRUCTURE');return []}
  missingArray(m,'tasks',`milestones[${i}]`);missingArray(m,'workPackages',`milestones[${i}]`)
  m.tasks=m.tasks.filter((t,j)=>kept('task',t,`milestones[${i}].tasks[${j}]`))
  m.workPackages=m.workPackages.flatMap((w,j)=>{if(!record(w)){note('workPackage',`milestones[${i}].workPackages[${j}]`,w,'INVALID_ITEM_STRUCTURE');return []}missingArray(w,'tasks',`milestones[${i}].workPackages[${j}]`);w.tasks=w.tasks.filter((t,k)=>kept('task',t,`milestones[${i}].workPackages[${j}].tasks[${k}]`));if(!kept('workPackage',w,`milestones[${i}].workPackages[${j}]`)){result.standaloneTasks.push(...w.tasks);return []}return [w]})
  if(!kept('milestone',m,`milestones[${i}]`)){result.standaloneTasks.push(...m.tasks,...m.workPackages.flatMap(w=>w.tasks));return []}return [m]
 })
 const tasks=tasksOf(result),taskIds=new Set(tasks.map(t=>t.tempId)),materialIds=new Set(result.materials.map(m=>m.tempId)),pointIds=new Set(result.timePoints.map(p=>p.tempId)),entityIds=new Set([...taskIds,...materialIds,...pointIds,...result.events.map(e=>e.tempId),...result.milestones.flatMap(m=>[m.tempId,...m.workPackages.map(w=>w.tempId)])])
 const references=(owner,key,allowed,needsOwner)=>{const missing=owner[key].filter(id=>!allowed.has(id));if(!missing.length)return;audit.relations.push({ownerId:owner.tempId,field:key,original:structuredClone(owner[key]),quarantinedTargets:missing});owner[key]=owner[key].filter(id=>allowed.has(id));if(needsOwner===true||(needsOwner==='unknown'&&missing.some(id=>!removed.has(id))))blocked.add(owner.tempId)}
 for(const t of tasks){references(t,'dependencyTempIds',taskIds,true);references(t,'materialTempIds',materialIds,true);references(t,'timePointTempIds',pointIds,true);if(t.parentTempId&&!taskIds.has(t.parentTempId)){audit.relations.push({ownerId:t.tempId,field:'parentTempId',original:t.parentTempId});t.parentTempId=null;blocked.add(t.tempId)}}
 for(const m of result.materials)references(m,'relatedTaskTempIds',taskIds,'unknown')
 for(const p of result.timePoints){references(p,'relatedTaskTempIds',taskIds,'unknown');references(p,'relatedMaterialTempIds',materialIds,'unknown')}
 for(const e of result.events){if(Array.isArray(e.relatedTaskTempIds))references(e,'relatedTaskTempIds',taskIds,true);for(const k of ['startTimePointTempId','endTimePointTempId'])if(e[k]&&!pointIds.has(e[k])){audit.relations.push({ownerId:e.tempId,field:k,original:e[k]});e[k]=null;blocked.add(e.tempId)}}
 for(const t of tasks)if([...t.materialTempIds,...t.timePointTempIds].some(id=>blocked.has(id)))blocked.add(t.tempId)
 for(const e of result.events)if([e.startTimePointTempId,e.endTimePointTempId].some(id=>blocked.has(id)))blocked.add(e.tempId)
 result.conflicts=(Array.isArray(result.conflicts)?result.conflicts:[]).filter(record).map(c=>({...c,entityTempIds:(c.entityTempIds??[]).filter(id=>entityIds.has(id)),evidenceIds:(c.evidenceIds??[]).filter(id=>validIds.has(id))}))
 result.ambiguities=(Array.isArray(result.ambiguities)?result.ambiguities:[]).filter(record).map(a=>({...a,evidenceIds:(a.evidenceIds??[]).filter(id=>validIds.has(id))}))
 if(result.projectSuggestion&&Object.values(result.projectSuggestion).some(f=>!record(f)||!Array.isArray(f.evidenceIds)||f.evidenceIds.some(id=>!validIds.has(id)))){audit.structure.push({path:'projectSuggestion',original:structuredClone(result.projectSuggestion)});result.projectSuggestion=null;result.projectMatch={...result.projectMatch,decision:'standalone_task',matchedProjectId:null}}
 for(const id of blocked){const item=[...tasks,...result.materials,...result.timePoints,...result.events].find(e=>e.tempId===id);if(item)item.selected=false;result.conflicts.push({id:LOCAL_ISOLATION_NOTE_PREFIX+'relation:'+id,type:'other',message:'这一项关联的事实或依据不完整，不能直接接受；其他有依据的事项可单独保存。',entityTempIds:[id],evidenceIds:[],requiresDecision:true})}
 result.ambiguities.push(...notes)
 if(notes.length||blocked.size){result.quality={...result.quality,needsHumanReview:true,reviewReasons:[...new Set([...(result.quality?.reviewReasons??[]),'部分模型项已单独保留待核对；其他有依据的事实仍可处理。'])]}}
 if(!tasks.length&&!result.events.length&&notes.length)result.conflicts.push({id:LOCAL_ISOLATION_NOTE_PREFIX+'no-grounded-items',type:'other',message:'尚无可确认的行动或事件，请先核对保留的模型项；不会创建空项目。',entityTempIds:[],evidenceIds:[],requiresDecision:true})
 if(!audit.quarantined.length&&!audit.structure.length&&!audit.relations.length)return {result:input,audit,rootFailure:false}
 // No verified actionable subset exists in these cases. Preserve the strict
 // unusable-response boundary instead of replacing it with empty suggestions.
 const originallyActionable=tasksOf({...input,milestones:input.milestones.map(m=>({...m,tasks:array(m?.tasks),workPackages:array(m?.workPackages).map(w=>({...w,tasks:array(w?.tasks)}))}))}).length>0||input.events.length>0
 if(!allowNoUsableSubset&&!tasks.some(t=>!blocked.has(t.tempId))&&!result.events.some(e=>!blocked.has(e.tempId))&&originallyActionable&&!hasLocalIsolationPending(input))return {result:null,audit,rootFailure:false,noUsableSubset:true}
 const validation=validateRecognitionResult(result,{sourceContent:sourceText});if(!validation.valid)return {result:null,audit,rootFailure:true,validation}
 return {result,audit,rootFailure:false}
}
