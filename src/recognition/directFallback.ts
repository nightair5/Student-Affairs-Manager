import type {RecognitionResult,TaskSuggestionV2} from './types'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {cleanDirectTopic} from './directRetention'
import {localDelivery,localSubmissionChannel,localMaterialRequirements} from './localNoticeFacts'

/** Used only after local-rules recognition. No cloud answer is rewritten here. */
export function improveDirectFallback(input:RecognitionResult,source:string):RecognitionResult {
 const existing=[...input.standaloneTasks,...input.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 const grounded=existing.filter(t=>t.actionVerb&&t.actionObject&&source.includes(t.actionObject)&&!/^查看|^无需|^无须|^不必|待核对/u.test(t.title))
 // Preserve independently grounded multi-action notices and their owner IDs.
 if(grounded.length>1)return structuredClone(input)
 const r=structuredClone(input),heading=source.split(/[\n。]/u)[0],tasks:TaskSuggestionV2[]=[],sourceId=r.evidence[0]?.sourceId??'source'
 const award=/[“《]([^”》]{2,35}(?:奖学金|助学金)[^”》]{0,12})[”》]/u.exec(source)?.[1]
 const subject=(award&&heading.includes(award)?award:null)??(/《([^》]{2,50})》/u.exec(heading)?.[1]??/([^\s，。；：:]{2,45}(?:奖学金|助学金|项目|招募|报名|申请))/u.exec(heading)?.[1]??'').replace(/^(?:关于开展|关于|各位同学[：:]?)/u,'').replace(/(?:评审工作|评选工作|评定|申请|申报|招募|报名|通知)$/u,'').replace(/系统$/u,'')
 const spans=[...source.matchAll(/[^。！？\n]+/gu)].map(m=>({text:m[0],at:m.index!}))
 const cutoff=(q:string)=>{
  const c=q.normalize('NFKC').replace(/\s/gu,'')
  const applicationEnd=/申请|申报|报名/u.test(q)&&/逾期[^。；]{0,20}(?:不再受理|不予受理|不受理)/u.test(source)
  if(/任选|备选|可选择|\d日或/u.test(c)||(!/截止|截至|之前|以前|[日号点分\d]前/u.test(c)&&!applicationEnd))return null
  const parsed=parseDirectSourceTime(applicationEnd?q+'。逾期不再受理':q,{type:'task_deadline',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
  return parsed.normalizedValue&&!parsed.needsConfirmation?parsed:null
 }
 const allCutoffs=spans.flatMap(s=>{const p=cutoff(s.text);return p?[{...s,p}]:[]})
 const evidence=(text:string,at:number,field:'description'|'deadline')=>{const id=`local-direct:${field}:${at}`;if(!r.evidence.some(e=>e.id===id))r.evidence.push({id,sourceId,quote:text,quotedText:text,textStart:at,textEnd:at+text.length,field,extractionMethod:'parser',confidence:1});return id}
 for(const span of spans){
  const q=span.text,plain=q.replace(/[（(][^）)]*[）)]/gu,'')
  if(/仅供知悉|无需办理|无需操作/u.test(q))continue
  const delivery=localDelivery(q)
  let verb=delivery?.verb,object=delivery?.object
  if(!verb){const m=/(?:请|须|需|应|可|有意|自愿|学生|同学)[^。；]{0,40}?(申请|申报|报名|提交|报送|上传|填写|登记|预约|缴费|领取)\s*([^，,；;：:]{1,55})/u.exec(plain);if(m){verb=m[1];object=m[2].replace(/[（(][^）)]*[）)]/gu,'').replace(/^(?:本次|此次|该项)/u,'').split(/至|到|并|后|前|进行|即可/u)[0].trim()}}
  if(/申请者须|^申请截止|^材料截止|^三、申请截止/u.test(q))continue
  if(!verb&&subject&&/申请|申报|报名/u.test(q)&&/系统|平台|截止|提交|填写|自愿/u.test(q)){verb=/申报/u.test(q)?'申报':'申请';object=subject}
  if(!verb||!object)continue
  const actionClause=q.split(/[，,；;]/u).find(c=>c.includes(verb!))??q
  if(/取消|作废|禁止|不得|无需|无须|不必|不再|请勿/u.test(actionClause.replace(/取消[^，。；]{0,10}资格|不得兼得/gu,'')))continue
  if(/^(?:至|到|在|于|所需|相关|以下|的材料|申请$|材料$|表$)|系统|[（(]/u.test(object)&&subject){object=subject}
  object=object.replace(/(?:截止时间|截止日期|时间为|时间：).*$/u,'').replace(/(?:的通知|有关事项|相关事宜)$/u,'').trim()
  if(object.length<2||object.length>70||!source.includes(object))continue
  if(/^(?:申请|申报|报名)$/u.test(verb)&&subject&&(/^(?:申请|申报|报名|资料|材料|信息|所需)/u.test(object)||object.length>26))object=subject
  if(tasks.some(t=>(t.actionVerb===verb||/申请|申报/u.test(t.actionVerb)&&/申请|申报/u.test(verb!))&&t.actionObject===object))continue
  const id=`local-direct-${span.at}`,eids=[evidence(q,span.at,'description')]
  if(!q.includes(object)&&heading.includes(object))eids.push(evidence(heading,0,'description'))
  const isConditional=/符合|参评|面向|对象|申请条件|自愿|有意|仅限|推荐名额|申请者/u.test(source)
  const eligibility=spans.find(s=>/符合|面向|对象|申请条件|自愿|仅限|申请者/u.test(s.text));if(isConditional&&eligibility)eids.push(evidence(eligibility.text,eligibility.at,'description'))
  const t:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:cleanDirectTopic(verb+object+(/提交|报送|上传/u.test(verb)&&/奖学金$|助学金$/u.test(object)?'申请材料':'')),actionVerb:verb,actionObject:object,description:q+(isConditional?'\n适用条件待确认：'+(spans.find(s=>/符合|面向|对象|申请条件|自愿|仅限|申请者/u.test(s.text))?.text??q):''),completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:eids,confidence:1,inferenceLevel:'strong_inference',userConfirmationRequired:true,selected:!isConditional}
  const own=cutoff(q),chosen=own?{...span,p:own}:allCutoffs.length===1?allCutoffs[0]:null
  if(chosen&&/申请|申报|报名/u.test(chosen.text)&&!/截止|截至|[日号点分\d]前/u.test(chosen.text)&&/逾期[^。；]{0,20}(?:不再受理|不予受理|不受理)/u.test(source)){chosen.text=source;chosen.at=0}
  if(chosen){const p=chosen.p,tid=id+'-deadline',eid=evidence(chosen.text,chosen.at,'deadline');r.timePoints.push({tempId:tid,type:'task_deadline',rawText:chosen.text,normalizedValue:p.normalizedValue,timezone:p.timezone,isAllDay:p.isAllDay,precision:p.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true});t.timePointTempIds.push(tid)}
  const channel=delivery?.channel??localSubmissionChannel(q)
  if(channel){const mid=id+'-material',req=localMaterialRequirements(q);r.materials.push({tempId:mid,name:object,required:true,formatRequirements:req.formats,namingRequirements:req.naming,quantity:null,submissionChannel:channel,relatedTaskTempIds:[id],evidenceIds:eids,confidence:1,selected:true});t.materialTempIds.push(mid)}
  tasks.push(t)
 }
 if(tasks.length){r.standaloneTasks=tasks.filter(t=>!subject||!tasks.some(other=>other!==t&&/申请|申报/u.test(other.actionVerb)&&other.actionObject===subject&&t.actionVerb==='填写'&&!/表|报告|论文/u.test(t.actionObject)));r.milestones=[];const ids=new Set(tasks.map(t=>t.tempId));r.materials=r.materials.filter(m=>m.relatedTaskTempIds.some(id=>ids.has(id)));const eventTimes=new Set(r.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]));r.timePoints=r.timePoints.filter(p=>eventTimes.has(p.tempId)||p.relatedTaskTempIds.some(id=>ids.has(id)));r.sourceSummary.title=tasks[0].title}
 r.standaloneTasks=r.standaloneTasks.filter(t=>!/^无需|^无须|^不必|^不要/u.test(t.title));r.milestones=r.milestones.map(m=>({...m,tasks:m.tasks.filter(t=>!/^无需|^无须|^不必/u.test(t.title))}))
 return r
}
