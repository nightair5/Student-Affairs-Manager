import type {RecognitionResult} from './types'

/** A separate sentence may name a deliverable and state its requirements.
 * Link only by an unambiguous literal object in the same paragraph, never by
 * proximity, shared date, or a generic pronoun. Preserve the whole requirement
 * quotation so a local parser does not flatten a condition into a boolean. */
export function retainLocalNamedRequirements(input:RecognitionResult,source:string):RecognitionResult {
 if(input.modelName!=='local-rules')return input
 const result=structuredClone(input)
 const tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 for(const span of source.matchAll(/[^，,。；;！？\n]+/gu)){
  let quote=span[0].trim()
  const at=span.index!+span[0].indexOf(quote)
  // Numeric/format continuations have no new subject. Keep them with the
  // named requirement; a new action, object or condition ends this scope.
  const continuation=/^(?:[，,]\s*(?:最多|至少|不超过|不少于|限)\s*\d+\s*(?:页|份|张|字)){1,3}/u.exec(source.slice(at+quote.length))
  if(continuation)quote+=continuation[0]
  if(!quote||quote.length>160||result.evidence.length>=120)continue
  const owners=tasks.filter(task=>{
   if(!/^(?:提交|上传|发送|递交|填写|交)$/u.test(task.actionVerb))return false
   const name=task.actionObject.replace(/(?:PDF|DOCX?|WORD|PPTX?|XLSX?)$/iu,'').trim()
   if(name.length<2||!quote.startsWith(name))return false
   const rest=quote.slice(name.length)
   if(!/^(?:须|需|必须|限|最多|至少|不超过|不少于|格式(?:为|要求)|文件名)/u.test(rest))return false
   // A separately stated conditional requirement belongs to that condition;
   // it must go through the dedicated conditional-material path instead.
   if(/(?:如|若|时|可选|任选|二选一|或者|无需|无须)/u.test(rest))return false
   return task.evidenceIds.some(id=>{
    const ref=result.evidence.find(e=>e.id===id)
    if(!ref||ref.textStart===undefined||ref.textEnd===undefined||ref.textStart>at)return false
    return source.slice(ref.textStart,ref.textEnd)===ref.quote
     &&!source.slice(ref.textStart,at).includes('\n\n')
     &&source.slice(ref.textStart,at).split('\n').length<=3
   })
  })
  if(owners.length!==1)continue
  const task=owners[0],name=task.actionObject.replace(/(?:PDF|DOCX?|WORD|PPTX?|XLSX?)$/iu,'').trim()
  const materials=result.materials.filter(m=>m.relatedTaskTempIds.length===1&&m.relatedTaskTempIds[0]===task.tempId&&(m.name===name||name.endsWith(m.name)))
  if(materials.length>1||task.evidenceIds.length>=20||task.description.length+quote.length+5>800)continue
  const eid=`local-named-requirement:${at}`
  if(!result.evidence.some(e=>e.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field:'materials',extractionMethod:'parser',confidence:1})
  if(!task.description.includes(quote))task.description+='\n要求：'+quote
  task.evidenceIds=[...new Set([...task.evidenceIds,eid])]
  if(materials.length){
   const material=materials[0]
   if((material.requirements?.length??0)<20&&material.evidenceIds.length<20){material.requirements=[...new Set([...(material.requirements??[]),quote])];material.evidenceIds=[...new Set([...material.evidenceIds,eid])]}
  }else if(result.materials.length<60&&task.materialTempIds.length<20){
   const id=`local-named-material:${at}`
   result.materials.push({tempId:id,name,required:true,formatRequirements:[],namingRequirements:[],requirements:[quote],quantity:null,submissionChannel:null,relatedTaskTempIds:[task.tempId],evidenceIds:[...task.evidenceIds],confidence:1,selected:true})
   task.materialTempIds.push(id)
  }
 }
 return result
}
