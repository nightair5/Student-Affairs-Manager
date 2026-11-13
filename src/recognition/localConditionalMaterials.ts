import type {RecognitionResult} from './types'

/** Recover only an explicit source-backed conditional list for one handling
 * goal. Unknown owners and alternative lists stay in the original source. */
export function retainLocalConditionalMaterials(input:RecognitionResult,source:string):RecognitionResult {
 if(input.modelName!=='local-rules')return input
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 if(tasks.length!==1||input.events.length)return input
 const task=tasks[0],own=task.evidenceIds.map(id=>input.evidence.find(ref=>ref.id===id)?.quote??'').join('\n')
 const patterns:[RegExp,'required'|'optional'][]=[
  [/(?:^|[。；;\n])\s*((?:若|如果|如)?[^，,。；;\n]{2,24}?(?:时|情况下))\s*(?:必须|须|应当|需要|需)\s*(?:提供|出示|提交|携带|出具)([^。；;\n]{2,140})/gu,'required'],
  [/(?:^|[。；;\n])\s*((?:若|如果|如)[^，,。；;\n]{2,24})[，,]\s*(?:必须|须|应当|需要|需)\s*(?:提供|出示|提交|携带|出具)([^。；;\n]{2,140})/gu,'required'],
  [/(?:^|[。；;\n])\s*([^，,。；;\n]{2,24}?(?:办理|时|情况下))\s*(?:可选择|可以选择|可自愿|自愿选择|可以|可)\s*(?:提供|出示|提交|携带|出具)([^。；;\n]{2,140})/gu,'optional'],
 ]
 const matches=patterns.flatMap(([pattern,requirement])=>[...source.matchAll(pattern)].map(match=>({match,requirement})))
 if(!matches.length)return input
 const result=structuredClone(input),target=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])][0]
 const documentEnding=/(?:证|书|表|单|信|档|件|照|照片|图片|简历|作品|附件|材料)$/u
 let unresolved=false
 for(const {match,requirement} of matches){
  const condition=match[1].replace(/(?:时|情况下)$/u,'').replace(/^(?:若|如果|如)/u,'').trim()
  const action=/(?:办理|代办|申请|报名|领取|报送|提交|参加)/u.exec(condition)?.[0],raw=match[2].trim()
  if(!action||!own.includes(action)||/或者|(?:^|[^所])或|二选一|任选|例如|包括|无需|不必/u.test(raw)){unresolved=true;continue}
  const names=raw.split(/、|以及|和|与|及/u).map(name=>name.trim()).filter(Boolean)
  if(!names.length||names.length>8||new Set(names).size!==names.length||names.some(name=>name.length<2||name.length>36||!documentEnding.test(name))){unresolved=true;continue}
  const literal=match[0].replace(/^[。；;\n]\s*/u,''),at=source.indexOf(literal)
  const anchor=task.actionVerb+task.actionObject,anchorAt=source.indexOf(anchor)
  if(at<0||at!==source.lastIndexOf(literal)||anchorAt<0||anchorAt!==source.lastIndexOf(anchor)||anchorAt+anchor.length>at||at-anchorAt>250){unresolved=true;continue}
  const bridge=source.slice(anchorAt+anchor.length,at).split(/[。；;\n]/u).map(value=>value.trim()).filter(Boolean)
  // Only an explicit same-workflow optional-material statement can intervene;
  // another paragraph or independent process does not establish ownership.
  if(bridge.some(value=>!/^(?:本人|自行)(?:办理|申请)[^。；;\n]{0,70}(?:可选择|可以选择|可自愿|自愿选择|可以|可)(?:提供|出示|提交|携带|出具)/u.test(value))){unresolved=true;continue}
  const id=`local-condition:${at}`,sourceId=result.evidence[0]?.sourceId??'source'
  const pending=names.filter(name=>!result.materials.some(material=>material.goalScope?.condition===condition&&material.name===name))
  if(!pending.length)continue
  if(result.materials.length+pending.length>60||result.evidence.length>=120){
   result.quality.needsHumanReview=true
   result.quality.reviewReasons=[...new Set([...result.quality.reviewReasons,'部分条件材料尚未完整整理，请查看原通知。'])]
   continue
  }
  if(!result.evidence.some(ref=>ref.id===id))result.evidence.push({id,sourceId,quote:literal,quotedText:literal,textStart:at,textEnd:at+literal.length,field:'requirement',extractionMethod:'parser',confidence:1})
  pending.forEach((name,index)=>{
   const short=name.replace(/^(?:电子版|纸质版|电子|纸质)/u,'')
   const existing=result.materials.filter(material=>!material.goalScope&&(material.name===name||material.name===short)&&material.relatedTaskTempIds.length===1&&material.relatedTaskTempIds[0]===task.tempId)
   // Do not reclassify a document mentioned elsewhere: it might have an
   // independent unconditional requirement in another part of the notice.
   const uniqueMention=source.indexOf(short)===source.lastIndexOf(short)
   if(existing.length===1&&uniqueMention&&existing[0].evidenceIds.length<20){
    const material=existing[0]
    material.required=false;material.relatedTaskTempIds=[];material.evidenceIds=[...new Set([...material.evidenceIds,id])]
    material.goalScope={taskTempIds:[task.tempId],condition,requirement}
    if(name!==short&&/^(?:电子版|纸质版|电子|纸质)/u.test(name))material.formatRequirements=[...new Set([...material.formatRequirements,name.slice(0,name.length-short.length)])]
    target.materialTempIds=target.materialTempIds.filter(value=>value!==material.tempId)
    target.completionCriteria=target.completionCriteria.filter(value=>value!==`所需材料已准备：${material.name}`)
   }else if(!existing.length){
    result.materials.push({tempId:`${id}:material:${index}`,name,required:false,formatRequirements:[],namingRequirements:[],requirements:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[],evidenceIds:[id],confidence:1,selected:true,goalScope:{taskTempIds:[task.tempId],condition,requirement}})
   }else{
    result.quality.needsHumanReview=true
    result.quality.reviewReasons=[...new Set([...result.quality.reviewReasons,'部分条件材料归属尚未完整整理，请查看原通知。'])]
   }
  })
 }
 if(unresolved){
  result.quality.needsHumanReview=true
  result.quality.reviewReasons=[...new Set([...result.quality.reviewReasons,'部分条件材料归属尚未完整整理，请查看原通知。'])]
 }
 return result
}
