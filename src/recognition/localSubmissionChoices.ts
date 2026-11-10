import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {MaterialSuggestionV2,RecognitionResult,TaskSuggestionV2,TimePointSuggestionV2} from './types'
import {localMaterialRequirements,localSubmissionChannel} from './localNoticeFacts'

/** An explicit choice introduction plus two separately labelled branches is
 * one delivery choice, not two independent obligations. This conservative
 * local fallback does not invent unlabelled alternatives or deadlines. */
export function localSubmissionChoices(input:RecognitionResult,source:string):RecognitionResult {
 const sentences=[...source.matchAll(/[^。！？\n]+/gu)].map(m=>({text:m[0].trim(),at:m.index!+m[0].indexOf(m[0].trim())}))
 const markers=sentences.flatMap(s=>{
  const m=/(?:任选|可选)([^，,；;。\n]{1,12}?)(?:或者|或)([^，,；;。\n]{1,12}?)(?:之一|一种)/u.exec(s.text)
  const target=/(?:请|须|需|应)[^，,；;]{0,15}?(提交|递交|上传|报送)([^，,；;]{2,35})/u.exec(s.text)
  return m&&target?[{sentence:s,marker:m[0],labels:[m[1].trim(),m[2].trim()],verb:target[1],object:target[2].trim()}]:[]
 })
 if(markers.length!==1)return input
 const {sentence,marker,labels,verb,object}=markers[0]
 if(sentence.text.length>500||labels[0]===labels[1]||source.indexOf(marker)!==source.lastIndexOf(marker))return input
 const branches=labels.map(label=>sentences.filter(s=>s!==sentence&&s.text.includes(label)&&/^(?:选择|采用|使用)/u.test(s.text)))
 if(branches.some(b=>b.length!==1)||branches[0][0]===branches[1][0])return input
 const choices=branches.map(b=>{
  const quote=b[0].text,span=/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]\s*(?:(?:上午|中午|下午|晚上)\s*)?\d{1,2}[:：]\d{2}\s*(?:前|之前|以前)/u.exec(quote)?.[0]
  const parsed=span?parseDirectSourceTime(span,{type:'task_deadline',referenceTime:input.createdAt,timezone:'Asia/Shanghai'}):null
  const channel=localSubmissionChannel(quote)??/(?:上传|发送)(?:到|至)?\s*([^，,；;。！？\n]{2,35}?(?:平台|系统|邮箱|网站))/u.exec(quote)?.[1]??null
  const action=/(?:交到|交至|提交|递交|上传|发送|报送)/u.test(quote)
  return quote.length<=500&&quote.split(/[，,]/u).slice(2).filter(s=>s.trim()).length<=12&&span&&parsed?.normalizedValue&&!parsed.needsConfirmation&&channel&&action?{quote,span,parsed,channel,at:b[0].at}:null
 })
 if(choices.some(x=>!x))return input
 // These cases must really say one option suffices, rather than both branches
 // being mandatory despite the appearance of an earlier example choice.
 if(/(?:均须|均需|都要|都须|同时提交|必须全部)/u.test(source.replace(/(?:不必|无需|不需要|不要求)[^。；\n]{0,8}(?:都要|都须|同时提交|必须全部)/gu,'')))return input
 const r=structuredClone(input),old=[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 const channels=choices.map(x=>x!.channel)
 const spans=[sentence,...branches.map(b=>b[0])].map(s=>({start:s.at,end:s.at+s.text.length}))
 const redundant=new Set(old.filter(t=>{
  if(/^[\p{P}\p{S}]+$/u.test(t.actionObject))return true
  if(!(t.actionObject===object||object.includes(t.actionObject)&&t.actionObject.length>=2||channels.includes(t.actionObject)))return false
  const action=t.actionVerb+t.actionObject,at=source.indexOf(action)
  return at>=0&&at===source.lastIndexOf(action)&&spans.some(s=>at>=s.start&&at+action.length<=s.end)
 }).map(t=>t.tempId))
 const evidence=(id:string,quote:string,at:number,field:'description'|'deadline')=>({id,sourceId:r.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field,extractionMethod:'parser' as const,confidence:1})
 const introId='local-choice:intro',choiceId='local-choice:marker',choiceAt=source.indexOf(marker)
 r.evidence.push(evidence(introId,sentence.text,sentence.at,'description'),evidence(choiceId,marker,choiceAt,'description'))
 const newTasks:TaskSuggestionV2[]=[],newMaterials:MaterialSuggestionV2[]=[],newPoints:TimePointSuggestionV2[]=[]
 for(let i=0;i<2;i++){
  const branch=choices[i]!,id=`local-choice:${i}`,eid=id+':evidence',tid=id+':deadline',mid=id+':material',requirements=localMaterialRequirements(branch.quote)
  r.evidence.push(evidence(eid,branch.quote,branch.at,'description'))
  const details=branch.quote.split(/[，,]/u).slice(2).map(s=>s.trim()).filter(Boolean)
  newTasks.push({tempId:id,parentTempId:null,hierarchyType:'task',title:`${verb}${labels[i]}${object}`,actionVerb:verb,actionObject:object,description:`${marker}。${branch.quote}`,completionCriteria:details,estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[mid],timePointTempIds:[tid],evidenceIds:[introId,eid,choiceId],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true})
  newMaterials.push({tempId:mid,name:object,required:true,formatRequirements:[labels[i],...requirements.formats],namingRequirements:requirements.naming,requirements:details,quantity:null,submissionChannel:branch.channel,relatedTaskTempIds:[id],evidenceIds:[introId,eid],confidence:1,selected:true})
  newPoints.push({tempId:tid,type:'task_deadline',rawText:branch.span,normalizedValue:branch.parsed!.normalizedValue,timezone:branch.parsed!.timezone,isAllDay:branch.parsed!.isAllDay,precision:branch.parsed!.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[mid],evidenceIds:[eid],confidence:1,selected:true})
 }
 const keep=(list:TaskSuggestionV2[])=>list.filter(t=>!redundant.has(t.tempId)).map(t=>({...t,dependencyTempIds:t.dependencyTempIds.filter(id=>!redundant.has(id))}))
 r.standaloneTasks=[...keep(r.standaloneTasks),...newTasks];r.milestones=r.milestones.map(m=>({...m,tasks:keep(m.tasks),workPackages:m.workPackages.map(w=>({...w,tasks:keep(w.tasks)}))}))
 r.materials=r.materials.flatMap(m=>{if(!m.relatedTaskTempIds.some(id=>redundant.has(id)))return [m];const owners=m.relatedTaskTempIds.filter(id=>!redundant.has(id));return owners.length?[{...m,relatedTaskTempIds:owners}]:[]}).concat(newMaterials)
 const eventTimes=new Set(r.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]))
 r.timePoints=r.timePoints.flatMap(p=>{if(!p.relatedTaskTempIds.some(id=>redundant.has(id)))return [p];const owners=p.relatedTaskTempIds.filter(id=>!redundant.has(id));return owners.length||p.relatedMaterialTempIds.length||eventTimes.has(p.tempId)?[{...p,relatedTaskTempIds:owners}]:[]}).concat(newPoints)
 r.conflicts.push({id:'sem-choice-local:'+choiceAt,type:'other',message:marker,entityTempIds:newTasks.map(t=>t.tempId),evidenceIds:[choiceId],requiresDecision:false})
 return r
}
