import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {MaterialSuggestionV2,RecognitionResult,TaskSuggestionV2,TimePointSuggestionV2} from './types'
import {localDelivery,localMaterialRequirements,localSubmissionChannel} from './localNoticeFacts'

type Span={text:string;at:number}
type Branch=Span&{label:string;deadline:string|null;channel:string|null;verb:string}
const taskLists=(r:RecognitionResult)=>[r.standaloneTasks,...r.milestones.flatMap(m=>[m.tasks,...m.workPackages.map(w=>w.tasks)])]

/** Recognise a choice by its explicit relation and its independently described
 * branches. Source spans, rather than matching words in generated titles,
 * determine which time and channel belong to each branch. If scope or the
 * common object is unclear the existing result stays untouched and partial. */
export function localSubmissionChoices(input:RecognitionResult,source:string,options:{inlineSharedObject?:boolean;timezone?:string}={}):RecognitionResult {
 const pair=/(?:可)?任选\s*([\p{Script=Han}]{1,12}?(?:版|材料|渠道|方式|途径)|线上|线下|现场|邮寄)\s*(?:或者|或)\s*([\p{Script=Han}]{1,12}?(?:版|材料|渠道|方式|途径)|线上|线下|现场|邮寄)(?:之一|一种)?/u.exec(source)
 const markers=[...source.matchAll(/(?:上述|以上|两种|两项|两者)?(?:方式|途径|材料)?(?:可)?(?:任选(?:一种|其一)|二选一|择一)/gu)]
 const marker=pair??(markers.length===1?markers[0]:null)
 if(!marker||markers.length>1||source.indexOf(marker[0])!==source.lastIndexOf(marker[0]))return input
 const optionName=(value:string)=>value.replace(/^(线上|线下|现场|邮寄)方式$/u,'$1')
 const announced=[...source.matchAll(/(?:选择|可选|采用|使用)\s*(电子版|纸质版)\s*(?:或者|或)\s*(电子版|纸质版)/gu)]
 const optionNames=pair?[optionName(pair[1]),optionName(pair[2])]:announced.length===1?[announced[0][1],announced[0][2]]:null
 // An explicit instruction to submit both contradicts an optional choice.
 // Do not resolve that contradiction by silently making either one optional.
 const affirmative=source.replace(/(?:不必|无需|无须|不需要|不要求)[^。；\n]{0,12}(?:两种|两份|两版)?(?:都|均|同时)(?:要|须|需|必须)?(?:提交|上交|交)?/gu,'')
 if(/(?:两种|两份|两版|两种材料)(?:都|均|同时)(?:要|须|需|必须)?(?:提交|上交|交)/u.test(affirmative))return input
 let labels=[...source.matchAll(/(?:^|[：:，,；;\n。！？])\s*(?:选择|采用|使用)?([\p{Script=Han}]{1,10}?(?:版|材料|渠道|方式|途径)|线上|线下|现场|邮寄)(?:者)?(?=[：:]|可|须|需|应|于|在|\d|[，,]|$)/gu)]
  .map(m=>({label:m[1],at:m.index!+m[0].lastIndexOf(m[1])}))
  .filter(m=>!optionNames||optionNames.includes(m.label))
 // Two formats can name the same deliverable inline rather than before the
 // choice marker. Accept this only when the source explicitly states a
 // choice and both independently described branches name the same object.
 let inlineGoal=''
 if(options.inlineSharedObject&&labels.length!==2){
  const inline=[...source.matchAll(/(?:^|[：:，,；;\n。！？])\s*(电子版|纸质版)([\p{Script=Han}]{2,18}?)(?=于|在|可|须|需|应|\d)/gu)]
   .map(m=>({label:m[1],object:m[2],at:m.index!+m[0].lastIndexOf(m[1])}))
   .filter(m=>!optionNames||optionNames.includes(m.label))
  if(inline.length===2&&inline[0].label!==inline[1].label&&inline[0].object===inline[1].object){labels=inline;inlineGoal=inline[0].object}
 }
 if(labels.length!==2||labels[0].label===labels[1].label||optionNames&&(!optionNames.includes(labels[0].label)||!optionNames.includes(labels[1].label)))return input
 const markerAt=marker.index!,firstAt=labels[0].at
 if(Math.max(markerAt,labels[1].at)-Math.min(markerAt,firstAt)>800)return input
 const branches:Branch[]=labels.map((item,index)=>{
  const after=source.slice(item.at),stop=after.search(/[。！？；;\n]/u)
  let end=stop<0?source.length:item.at+stop
  if(labels[index+1])end=Math.min(end,labels[index+1].at)
  if(markerAt>item.at)end=Math.min(end,markerAt)
  const text=source.slice(item.at,end).replace(/[，,\s]+$/u,'')
  const deadline=/(?:(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]\s*(?:[（(][^）)]{1,8}[）)]\s*)?|(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天])\s*(?:(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜间)\s*)?(?:\d{1,2}\s*[:：]\s*\d{2})?\s*(?:之前|以前|前)/u.exec(text)?.[0]??null
  const channel=localSubmissionChannel(text)??localDelivery(text)?.channel??/(?:上传|发送)(?:到|至)?\s*([^，,；;。！？\n]{1,35}?(?:平台|系统|邮箱|网站))/u.exec(text)?.[1]??null
  const verb=/(?:上传|发送|递交|提交|报送|邮寄|交到|交至)/u.exec(text)?.[0]??''
  return {label:item.label,at:item.at,text,deadline,channel,verb}
 })
 // A mention without an actual branch action is not evidence that a second
 // delivery exists (for example, “另一方式另行通知”).
 if(branches.some(b=>!b.verb||!b.text||b.text.length>500||b.text.split(/[，,]/u).slice(2).filter(s=>s.trim()).length>12))return input
 const leading=source.slice(0,Math.min(markerAt,firstAt))
 const prefixAt=Math.max(leading.lastIndexOf('。'),leading.lastIndexOf('！'),leading.lastIndexOf('？'),leading.lastIndexOf('\n'))+1
 const prefix=source.slice(prefixAt,firstAt)
 const directive=[...prefix.matchAll(/(?:提交|递交|报送|上传|发送)([^，,；;。！？：:\n【】]{2,40})/gu)].at(-1)
 const heading=/([^【】\n，,。；;：:]{2,40}?)(?:提交|递交|报送|上传)\s*[：:]\s*$/u.exec(prefix)
 const choiceGoal=/([^【】\n，,。；;：:]{2,40}?)(?:二选一|任选(?:一种|其一)|择一)\s*[：:]?\s*$/u.exec(prefix)
 const topic=pair&&/^\s*【([^】]{3,40})】/u.exec(prefix)
 const goalMatch=directive??heading??choiceGoal??topic
 // A complete choice declaration may precede the two branch clauses in a
 // different sentence. Use its own stated deliverable, never just a shared date.
 const intros=[...source.slice(0,firstAt).matchAll(/(?:^|[【】。；;\n])\s*(?:本次|此次|该)?([^，,。；;：:\n【】]{2,24}?)(?:(?:可以|可)?选择|可选)\s*(电子版|纸质版)\s*(?:或者|或)\s*(电子版|纸质版)/gu)]
  .filter(match=>new Set([match[2],match[3]]).size===2&&branches.every(branch=>[match[2],match[3]].includes(branch.label)))
 const introduction=intros.length===1?intros[0]:null
 // An explicit deliverable in the choice declaration is stronger than a
 // surrounding heading such as “submission instructions”.
 const useIntroduction=Boolean(introduction&&!inlineGoal)
 const goal=(useIntroduction?introduction![1]:directive?.[1]??heading?.[1]??choiceGoal?.[1]??topic?.[1]??inlineGoal).trim()
 if((!goalMatch&&!inlineGoal&&!introduction)||goal.length<2||goal.length>40||!source.includes(goal))return input
 const goalText=useIntroduction?introduction![0].trim().replace(/^[【】。；;]\s*/u,''):goalMatch?goalMatch[0]:goal
 const goalAt=useIntroduction?source.indexOf(goalText,introduction!.index!):goalMatch?prefixAt+goalMatch.index!:labels[0].at+labels[0].label.length
 if(goalAt<0||source.slice(goalAt,goalAt+goalText.length)!==goalText||useIntroduction&&source.indexOf(goalText)!==source.lastIndexOf(goalText))return input
 const anchor=Math.min(goalAt,markerAt,firstAt)
 const preceding=source.slice(0,anchor),rangeStart=Math.max(preceding.lastIndexOf('。'),preceding.lastIndexOf('！'),preceding.lastIndexOf('？'),preceding.lastIndexOf('\n'))+1
 const rangeEnd=Math.max(markerAt+marker[0].length,...branches.map(b=>b.at+b.text.length))
 const old=taskLists(input).flat()
 const contained=(task:TaskSuggestionV2)=>task.evidenceIds.some(id=>{
  const ref=input.evidence.find(e=>e.id===id),quote=ref?.quotedText??ref?.quote??''
  const at=typeof ref?.textStart==='number'&&source.slice(ref.textStart,ref.textStart+quote.length)===quote?ref.textStart:source.indexOf(quote)===source.lastIndexOf(quote)?source.indexOf(quote):-1
  const inBranch=branches.some(b=>at>=b.at&&at+quote.length<=b.at+b.text.length
   &&Boolean(b.channel&&task.actionObject===b.channel))
  return Boolean(quote&&at>=rangeStart&&at+quote.length<=rangeEnd&&(task.actionObject===goal||branches.some(b=>quote.includes(b.label))||inBranch))
 })
 const redundant=new Set(old.filter(contained).map(t=>t.tempId))
 // Do not silently replace a referenced dependency, existing source choice,
 // related event, or an independently organised action.
 if(old.some(t=>!redundant.has(t.tempId)&&(t.parentTempId&&redundant.has(t.parentTempId)||t.dependencyTempIds.some(id=>redundant.has(id))))
  ||input.events.some(e=>e.relatedTaskTempIds?.some(id=>redundant.has(id)))
  ||input.materials.some(m=>m.goalScope?.taskTempIds.some(id=>redundant.has(id)))
  ||input.conflicts.some(c=>c.entityTempIds.some(id=>redundant.has(id)))
  ||input.goalGroups?.some(g=>g.taskTempIds.some(id=>redundant.has(id))))return input
 const r=structuredClone(input),sourceId=r.evidence[0]?.sourceId??'source',timezone=options.timezone??r.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'
 const evidence=(id:string,quote:string,at:number,field:'description'|'deadline')=>({id,sourceId,quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field,extractionMethod:'parser' as const,confidence:1})
 const goalId='local-choice:goal',choiceId='local-choice:marker'
 r.evidence.push(evidence(goalId,goalText,goalAt,'description'),evidence(choiceId,marker[0],markerAt,'description'))
 const shared=[...source.matchAll(/[^。；;\n]*(?:无论|不论)[^。；;\n]*(?:哪种|两种|任一)(?:方式|形式|版本)[^。；;\n]*(?:均需|都需|均须|都须|均应|都应)[^。；;\n]*/gu)].map(match=>({text:match[0].trim(),at:match.index!+match[0].indexOf(match[0].trim())}))
 if(shared.length>1||shared.some(item=>item.text.length>500||source.indexOf(item.text)!==source.lastIndexOf(item.text)))return input
 const common=shared[0],commonId='local-choice:shared'
 if(common)r.evidence.push(evidence(commonId,common.text,common.at,'description'))
 const newTasks:TaskSuggestionV2[]=[],newMaterials:MaterialSuggestionV2[]=[],newPoints:TimePointSuggestionV2[]=[]
 for(let i=0;i<branches.length;i++){
  const branch=branches[i],id=`local-choice:${i}`,eid=id+':evidence',tid=id+':deadline',mid=id+':material',requirements=localMaterialRequirements(branch.text)
  const parsed=branch.deadline?parseDirectSourceTime(branch.deadline,{type:'task_deadline',referenceTime:input.createdAt,timezone}):null
  r.evidence.push(evidence(eid,branch.text,branch.at,'description'))
  const verb=/^(?:交到|交至)$/u.test(branch.verb)?'交':branch.verb
  const point=parsed?.normalizedValue&&!parsed.needsConfirmation?tid:null
  const material=!/^(?:线上|线下|现场|邮寄)$/u.test(branch.label)
  const details=branch.text.split(/[，,]/u).slice(2).map(s=>s.trim()).filter(Boolean)
  newTasks.push({tempId:id,parentTempId:null,hierarchyType:'task',title:`${verb}${branch.label}${goal}`,actionVerb:verb,actionObject:goal,description:`${marker[0]}。${branch.text}${!material&&branch.channel?`\n提交渠道：${branch.channel}`:''}${common?`\n共同要求：${common.text}`:''}`,completionCriteria:details,estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:material?[mid]:[],timePointTempIds:point?[tid]:[],evidenceIds:[goalId,eid,choiceId,...(common?[commonId]:[])],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true})
  if(material)newMaterials.push({tempId:mid,name:goal,required:true,formatRequirements:[...new Set([branch.label,...requirements.formats])],namingRequirements:requirements.naming,requirements:[...details,...(common?[common.text]:[])],quantity:null,submissionChannel:branch.channel,relatedTaskTempIds:[id],evidenceIds:[goalId,eid,...(common?[commonId]:[])],confidence:1,selected:true})
  if(point&&branch.deadline)newPoints.push({tempId:tid,type:'task_deadline',rawText:branch.deadline,normalizedValue:parsed!.normalizedValue,timezone:parsed!.timezone,isAllDay:parsed!.isAllDay,precision:parsed!.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:material?[mid]:[],evidenceIds:[eid],confidence:1,selected:true})
 }
 // A document explicitly attached to every branch is one shared material,
 // with its source scope and quantity retained; neither branch is required
 // in addition to the other merely because the material is shared.
 if(common){
  const attachments=[...common.text.matchAll(/(?:并|同时)?附(?:上)?\s*(?:(\d+|一|二|两)\s*(页|份|张|本))?([\p{Script=Han}]{2,24})(?=$|[，,])/gu)]
  if(attachments.length===1){
   const match=attachments[0],name=match[3],quantity=match[1]?({'一':1,'二':2,'两':2}[match[1]]??Number(match[1])):null
   const id='local-choice:shared-material'
   if(name&&source.includes(name)&&(!quantity||Number.isSafeInteger(quantity))){
    newMaterials.push({tempId:id,name,required:true,formatRequirements:[],namingRequirements:[],requirements:[match[0]],quantity,submissionChannel:null,relatedTaskTempIds:newTasks.map(task=>task.tempId),evidenceIds:[commonId],confidence:1,selected:true})
    for(const task of newTasks)task.materialTempIds.push(id)
   }
  }
 }
 const keep=(list:TaskSuggestionV2[])=>list.filter(t=>!redundant.has(t.tempId)).map(t=>({...t,dependencyTempIds:t.dependencyTempIds.filter(id=>!redundant.has(id))}))
 r.standaloneTasks=[...keep(r.standaloneTasks),...newTasks]
 r.milestones=r.milestones.map(m=>({...m,tasks:keep(m.tasks),workPackages:m.workPackages.map(w=>({...w,tasks:keep(w.tasks)}))}))
 r.materials=r.materials.flatMap(m=>{if(!m.relatedTaskTempIds.some(id=>redundant.has(id)))return [m];const owners=m.relatedTaskTempIds.filter(id=>!redundant.has(id));return owners.length?[{...m,relatedTaskTempIds:owners}]:[]}).concat(newMaterials)
 const materialIds=new Set(r.materials.map(m=>m.tempId)),eventTimes=new Set(r.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]))
 r.timePoints=r.timePoints.flatMap(p=>{
  const owners=p.relatedTaskTempIds.filter(id=>!redundant.has(id)),materials=p.relatedMaterialTempIds.filter(id=>materialIds.has(id))
  if(p.relatedTaskTempIds.some(id=>redundant.has(id))&&!owners.length&&!materials.length&&!eventTimes.has(p.tempId))return []
  return [{...p,relatedTaskTempIds:owners,relatedMaterialTempIds:materials}]
 }).concat(newPoints)
 r.conflicts.push({id:'sem-choice-local:'+markerAt,type:'other',message:marker[0],entityTempIds:newTasks.map(t=>t.tempId),evidenceIds:[choiceId],requiresDecision:false})
 return r
}
