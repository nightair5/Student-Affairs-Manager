import type {MaterialSuggestionV2,RecognitionResult,TaskSuggestionV2} from './types'

const explicitFormats=/^(.*?)(PDF|DOCX?|WORD|PPTX?|XLSX?)$/iu
const tasksOf=(r:RecognitionResult)=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
const fold=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').toLowerCase()

/** Correct local parser material ownership only when the verb, object and
 * format are literal, independently attributable source facts. Ambiguous or
 * explicitly shared requirements are preserved for user inspection. */
export function localMaterialOwnership(input:RecognitionResult,source:string):RecognitionResult {
 const r=structuredClone(input),tasks=tasksOf(r)
 const actionSpan=(task:TaskSuggestionV2)=>{
  const action=task.actionVerb+task.actionObject,at=source.indexOf(action)
  if(!task.actionObject||at<0||at!==source.lastIndexOf(action))return null
  const after=source.slice(at),end=after.search(/[，,。；;！？\n]/u)
  return end<0?after:after.slice(0,end)
 }
 const make=(task:TaskSuggestionV2,name:string,format:string,id:string,channel:string|null):MaterialSuggestionV2=>({tempId:id,name,required:true,formatRequirements:[format],namingRequirements:[],quantity:null,submissionChannel:channel,relatedTaskTempIds:[task.tempId],evidenceIds:[...task.evidenceIds],confidence:task.confidence,selected:true})
 const immediateRequirement=(task:TaskSuggestionV2)=>{
  const action=task.actionVerb+task.actionObject,at=source.indexOf(action)
  if(at<0||at!==source.lastIndexOf(action))return null
  const after=source.slice(at+action.length),requirement=/^[，,]\s*((?:该)?(?:文件|材料|文档)[^，,。；;！？\n]{0,30}?(?:不超过|不少于|至少|最多|以上|以下)[^，,。；;！？\n]{1,20})/u.exec(after)?.[1]
  return requirement&&task.evidenceIds.some(eid=>{const quote=r.evidence.find(e=>e.id===eid)?.quote??'';return quote.includes(action)&&quote.includes(requirement)})?requirement:null
 }

 // A conjoined document in the same instruction is a requirement of that
 // action, not a new independent top-level task. Only attach it when the
 // literal quotation has one owner and no separate time, choice or condition.
 for(const task of tasks){
  for(const eid of task.evidenceIds){
   const quote=r.evidence.find(ref=>ref.id===eid)?.quote??''
   if(!quote||!source.includes(quote)||tasks.some(other=>other!==task&&other.evidenceIds.includes(eid)))continue
   for(const match of quote.matchAll(/(?:同时|并)(?:请)?(?:提交|递交|提供|上传)([^，,。；;！？\n]{2,50})/gu)){
    const name=match[1].trim(),before=quote.slice(0,match.index),actionAt=before.lastIndexOf(task.actionVerb)
    if(actionAt<0||!before.slice(actionAt).includes(task.actionObject)||/^(?:至|到|给|向|所有|上述)/u.test(name)||/(?:发送至|上传至|提交至|递交至|https?:|@)/u.test(name)
     ||/(?:任选|二选一|或者|或|如果|如需|若|委托|可选|无需|不必|不得)/u.test(before.slice(Math.max(0,before.lastIndexOf('。')+1)))
     ||/(?:\d{1,2}月\d{1,2}[日号]|截止|截至|另行通知)/u.test(name)
     ||r.materials.some(m=>m.relatedTaskTempIds.includes(task.tempId)&&fold(m.name)===fold(name)))continue
    const id=`local-conjoined:${task.tempId}:${match.index}`
    r.materials.push({tempId:id,name,required:true,formatRequirements:[],namingRequirements:[],requirements:[match[0]],quantity:null,submissionChannel:null,relatedTaskTempIds:[task.tempId],evidenceIds:[eid],confidence:task.confidence,selected:true})
    task.materialTempIds.push(id)
   }
  }
 }

 // The document being collected is the result of the action, not something
 // the user must already possess. Preserve a separately stated prerequisite.
 for(const task of tasks){
  if(!/^(?:领取|取回|领回)$/u.test(task.actionVerb)||!actionSpan(task))continue
  for(const material of [...r.materials]){
   if(!material.relatedTaskTempIds.includes(task.tempId)||fold(material.name)!==fold(task.actionObject))continue
   const prerequisite=source.split(/[。；;！？\n]/u).some(clause=>clause.includes(material.name)&&/(?:携带|出示|提供|提交|上传)/u.test(clause.slice(0,clause.indexOf(material.name))))
   if(prerequisite)continue
   material.relatedTaskTempIds=material.relatedTaskTempIds.filter(id=>id!==task.tempId)
   task.materialTempIds=task.materialTempIds.filter(id=>id!==material.tempId)
   task.completionCriteria=task.completionCriteria.filter(c=>c!==`所需材料已准备：${material.name}`)
   if(!material.relatedTaskTempIds.length)r.materials=r.materials.filter(m=>m.tempId!==material.tempId)
  }
 }

 for(const task of tasks){
  const action=actionSpan(task)
  if(!action||task.tempId.length>70||/任选|二选一|或者|或/u.test(task.actionObject))continue
  const pieces=task.actionObject.split(/和|以及|与|、/u),parsed=pieces.map(p=>explicitFormats.exec(p.trim()))
  if(pieces.length<2||pieces.length>5||parsed.some(m=>!m||m[1].trim().length<2))continue
  const owned=r.materials.filter(m=>m.relatedTaskTempIds.includes(task.tempId))
  // Do not throw away richer, separately attributed material requirements.
  if(owned.length!==1||owned[0].relatedTaskTempIds.length!==1||owned[0].quantity!==null||owned[0].namingRequirements.length||owned[0].requirements?.length)continue
  const previous=owned[0]
  r.materials=r.materials.filter(m=>m.tempId!==previous.tempId)
  const next=parsed.map((m,i)=>make(task,m![1].trim(),m![2],`local-material:${task.tempId}:${i}`,previous.submissionChannel))
  r.materials.push(...next);task.materialTempIds=[...task.materialTempIds.filter(id=>id!==previous.tempId),...next.map(m=>m.tempId)]
 }

 for(const material of [...r.materials]){
  if(material.relatedTaskTempIds.length<2)continue
  const owners=material.relatedTaskTempIds.map(id=>tasks.find(t=>t.tempId===id)).filter((t):t is TaskSuggestionV2=>Boolean(t))
  if(owners.length!==material.relatedTaskTempIds.length)continue
  const supported=owners.filter(t=>fold(t.actionObject).includes(fold(material.name)))
  const other=owners.filter(t=>!supported.includes(t))
  if(supported.length!==1||!other.length||!actionSpan(supported[0])||other.some(t=>t.tempId.length>70||!actionSpan(t)||!explicitFormats.test(t.actionObject)))continue
  // A shared material explicitly required by several steps stays shared.
  const expresslyShared=source.split(/[。；;\n]/u).some(clause=>{
   const at=clause.indexOf(material.name);if(at<0)return false
   return /(?:均|都|共同|共享)[^，,]{0,18}(?:需要|提交|提供|使用|上交)\s*$/u.test(clause.slice(Math.max(0,at-24),at))||/^(?:[^，,]{0,18})(?:均|都)(?:需要|提交|提供|使用|上交)/u.test(clause.slice(at+material.name.length,at+material.name.length+24))
  })
  if(expresslyShared)continue
  const supportedTask=supported[0],supportedSpan=actionSpan(supportedTask)!
  const unsupportedFormats=new Set(other.flatMap(t=>explicitFormats.exec(t.actionObject)?.[2].toLowerCase()??[]))
  material.formatRequirements=material.formatRequirements.filter(f=>!unsupportedFormats.has(f.toLowerCase())||supportedSpan.toLowerCase().includes(f.toLowerCase()))
  material.relatedTaskTempIds=[supportedTask.tempId]
  const ownEvidence=material.evidenceIds.filter(id=>supportedTask.evidenceIds.includes(id))
  if(ownEvidence.length)material.evidenceIds=ownEvidence
  for(const task of other){
   const match=explicitFormats.exec(task.actionObject)!,name=match[1].trim()
   if(name.length<2)continue
   const id=`local-material:${task.tempId}:object`,next=make(task,name,match[2],id,null)
   const requirement=immediateRequirement(task)
   if(requirement)next.requirements=[requirement]
   r.materials.push(next);task.materialTempIds=[...task.materialTempIds.filter(x=>x!==material.tempId),id]
  }
 }
 for(const task of tasks){
  const match=explicitFormats.exec(task.actionObject)
  if(!match||!actionSpan(task))continue
  const owned=r.materials.filter(m=>m.relatedTaskTempIds.length===1&&m.relatedTaskTempIds[0]===task.tempId&&fold(m.name)===fold(task.actionObject))
  if(owned.length!==1)continue
  const material=owned[0],requirement=immediateRequirement(task),name=match[1].trim()
  // A format-only literal such as PDF is not an independently named document.
  // Keep the source-backed value and mark its owner unresolved; never strip it
  // to an empty material name and make the entire transaction invalid.
  if(!name){
   const reason='材料仅识别到文件格式，具体提交对象请查看原通知。'
   material.formatRequirements=[...new Set([...material.formatRequirements,match[2]])]
   material.requirements=[...new Set([...(material.requirements??[]),reason])].slice(0,20)
   r.quality.needsHumanReview=true;r.quality.reviewReasons=[...new Set([...r.quality.reviewReasons,reason])].slice(-20)
   continue
  }
  material.name=name;material.formatRequirements=[...new Set([...material.formatRequirements,match[2]])]
  if(requirement)material.requirements=[...new Set([...(material.requirements??[]),requirement])]
 }
 return r
}
