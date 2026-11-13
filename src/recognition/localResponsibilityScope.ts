import type {RecognitionResult,TaskSuggestionV2} from './types'

/** Local fallback: keep a clearly attributed later-party operation as source
 * context of the single preceding reader action. An unfamiliar role, multiple
 * possible parents, personal participation, and unresolved references are left
 * untouched. This never executes on an AI result. */
export function scopeLocalOtherPartyActions(input:RecognitionResult,source:string):RecognitionResult {
 if(input.modelName!=='local-rules')return input
 const result=structuredClone(input)
 const lists=[result.standaloneTasks,...result.milestones.flatMap(stage=>[stage.tasks,...stage.workPackages.map(group=>group.tasks)])]
 const all=lists.flat()
 const quote=(task:TaskSuggestionV2)=>task.evidenceIds.map(id=>result.evidence.find(ref=>ref.id===id)?.quote??'').find(Boolean)??''
 const position=(text:string)=>text&&source.indexOf(text)===source.lastIndexOf(text)?source.indexOf(text):-1
 const readerAction=/(?:(?<![申邀])请(?:各位|同学|学生|申请人|申请者|大家)?|(?:同学|学生|申请人|申请者|报名者)(?:须|需|应))[^。；;\n]{0,55}(?:提交|递交|填写|办理|申请(?!人|者|条件|对象|资格)|报名(?!者|人|条件)|上传|交(?!流|换|通|接|易|往)|登记|领取|预约)/u
 const process=/(?:审核|评审|复核|汇总|报送|上报|受理|发放|发证|公布结果)/u
 const mightBeReader=/(?:本人|自己|学生|同学|申请人|报名者|志愿者|入围者|评委|专家|工作人员)/u
 const explicitParticipation=/(?:请|须|需|应|必须)[^。；;\n]{0,30}(?:参加|出席|担任|进行答辩|面试)|取消|改期|延期|原定/u
 const candidates=all.filter(task=>{
  const text=quote(task)
  return position(text)>=0&&readerAction.test(text)
 })
 if(candidates.length!==1)return input
 const parent=candidates[0],parentQuote=quote(parent),parentAt=position(parentQuote)
 const recipient=/(?:提交给|交给|发给|递交给|给)([^，,。；;\s]{1,12})/u.exec(parentQuote)?.[1]
 const removed=new Set<string>()
 for(const child of all){
  if(child.tempId===parent.tempId)continue
  const text=quote(child),at=position(text)
  if(at<0||Math.abs(at-parentAt)>240||!process.test(text)||explicitParticipation.test(text)||child.materialTempIds.length||child.dependencyTempIds.length)continue
  const by=/由([^，,。；;\s]{1,12}?)(?:负责|统一|进行)?(?:审核|评审|复核|汇总|报送|上报|受理|发放|发证|公布结果)/u.exec(text)
  const subjectText=text.includes('由')?text.slice(text.lastIndexOf('由')+1):text
  const datedSubject=/^\s*([^，,。；;\s\d]{1,12}?)(?:于|在)?(?=(?:\d{4}年)?\d{1,2}月)/u.exec(subjectText)?.[1]
  const audience=/(?:申请人|申请者|报名者|报名人|学生|同学)/u.exec(text)?.[0]
  // A prior administrative sentence is scoped only when it names the same
  // applicant as the direct action, rather than by proximity alone.
  const scopedPrior=at<parentAt&&datedSubject&&audience&&parentQuote.includes(audience)?datedSubject:null
  if(at<=parentAt&&!scopedPrior)continue
  const actor=by?.[1]??(at>parentAt&&recipient&&text.trim().startsWith(recipient)?recipient:scopedPrior)
  if(!actor||mightBeReader.test(actor))continue
  // A recipient match or a grammatical "by X" plus a single prior direct
  // action supports ownership; the mere existence of an institutional name
  // or date does not. All related facts must be otherwise unreferenced.
  if(all.some(task=>task.tempId!==child.tempId&&(task.parentTempId===child.tempId||task.dependencyTempIds.includes(child.tempId)))
   ||result.materials.some(material=>material.relatedTaskTempIds.includes(child.tempId)||material.goalScope?.taskTempIds.includes(child.tempId))
   ||result.events.some(event=>event.relatedTaskTempIds?.includes(child.tempId))
   ||result.goalGroups?.some(group=>group.taskTempIds.includes(child.tempId))
   ||result.conflicts.some(conflict=>conflict.entityTempIds.includes(child.tempId)))continue
  const description=`${parent.description}\n后续办理（原文）：${text}`
  const evidence=[...new Set([...parent.evidenceIds,...child.evidenceIds])]
  if(description.length>800||evidence.length>20)continue
  // The old local title parser sometimes labels “交材料给收件人” as
  // “核对”. Correct it only when the same cited recipient is explicitly the
  // subsequent actor; words such as “交流、交换” alone cannot establish it.
  if(parent.actionVerb==='核对'&&recipient===actor){
   const handoff=/(?<![提递上移转])交([^，,。；;\n]{2,30}?)给([^，,。；;\s]{1,12})/u.exec(parentQuote)
   if(handoff&&handoff[2]===actor){
    const object=handoff[1].trim()
    parent.actionVerb='交';parent.actionObject=object;parent.title=`交${object}`;parent.inferenceLevel='explicit';parent.selected=true
    for(const material of result.materials)if(material.name===object&&material.relatedTaskTempIds.length===1&&material.relatedTaskTempIds[0]===parent.tempId&&!material.submissionChannel)material.submissionChannel=actor
   }
  }
  if(parent.actionVerb==='核对'){
   const delivery=/(?<![不无禁])递交([^，,。；;\n]{2,35})/u.exec(parentQuote)
   if(delivery&&!/(?:不必|不用|不得|禁止|无需|无须|不再|请勿)[^，,。；;\n]{0,18}递交/u.test(parentQuote)){
    const object=delivery[1].trim()
    parent.actionVerb='递交';parent.actionObject=object;parent.title=`递交${object}`;parent.inferenceLevel='explicit';parent.selected=true
   }
  }
  parent.description=description;parent.evidenceIds=evidence;removed.add(child.tempId)
 }
 if(!removed.size)return input
 for(const list of lists)for(let index=list.length-1;index>=0;index--)if(removed.has(list[index].tempId))list.splice(index,1)
 const eventPoints=new Set(result.events.flatMap(event=>[event.startTimePointTempId,event.endTimePointTempId]).filter(Boolean))
 result.timePoints=result.timePoints.filter(point=>!point.relatedTaskTempIds.some(id=>removed.has(id))||point.relatedTaskTempIds.some(id=>!removed.has(id))||point.relatedMaterialTempIds.length>0||eventPoints.has(point.tempId))
  .map(point=>({...point,relatedTaskTempIds:point.relatedTaskTempIds.filter(id=>!removed.has(id))}))
 return result
}
