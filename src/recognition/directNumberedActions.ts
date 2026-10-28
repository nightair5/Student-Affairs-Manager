import type { RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2 } from './types'
import { parseDirectSourceTime } from '../../cloudflare/direct-source-time.mjs'
import { localDelivery } from './localNoticeFacts'

type Section={heading:string;body:string;start:number;end:number;verb:string;object:string;title:string}
const compact=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').replace(/^(?:线上|在线|网上|完成|请|进行)/u,'')
/** Only explicit numbered headings with a named action participate. A date on
 * one heading belongs to that section; it is never a global notice deadline. */
export function numberedNoticeSections(source:string):Section[]{
 const matches=[...source.matchAll(/(?:^|\n)[ \t]*(\d{1,2})[.、．][ \t]*([^\n]+)/gu)]
 if(matches.length<2||matches.length>20)return []
 const sections=matches.flatMap((m,i)=>{
  const heading=m[2].trim(),label=heading.split(/[|｜]/u)[0].trim(),end=matches[i+1]?.index??source.length,start=m.index!+(m[0].startsWith('\n')?1:0),body=source.slice(start,end)
  if(/取消|作废|禁止|不再|无需|不得|不要|请勿/u.test(label))return []
  const match=/^(.*?)\s*(报名|申请|申报|提交|报送|上传|登记|领取|缴费)\s*$/u.exec(label)
  if(!match)return []
  const object=match[1].trim(),verb=match[2]
  const negatives=new RegExp(`(?:取消|作废|无需|无须|不必|不再|不得|禁止|请勿|不要)[^。！？\\n]{0,15}${verb}`,'u')
  const revoked=new RegExp(`${verb}[^。！？\\n]{0,12}(?:取消|作废|停止)`,'u')
  if(negatives.test(body)||revoked.test(body))return []
  if(object.length<2||object.length>45||!source.includes(object))return []
  const title=verb==='报名'?object+'报名':verb+object
  return [{heading,body,start,end,verb,object,title}]
 })
 return sections.length>=2?sections:[]
}

/** A generic system registration may use a single explicit event name from the
 * source heading; the heading remains separately cited as source evidence. */
function namedRegistrationContext(source:string):{quote:string;name:string;at:number}|null{
 const line=source.split(/\r?\n/u).find(s=>s.trim());if(!line)return null
 const quote=line.trim(),raw=quote.replace(/^[【[《]|[】\]》]$/gu,'').trim()
 if(!/^关于/u.test(raw)||!/通知$/u.test(raw))return null
 const name=raw.replace(/^关于(?:开展|举办)?/u,'').replace(/(?:的)?(?:报名|注册)(?:工作|事项)?通知$/u,'').replace(/(?:的)?通知$/u,'').trim()
 if(name.length<4||name.length>40||/[、,，&＆/\\]|以及|或者|和|与|或|及/u.test(name))return null
 if(!/(?:大赛|竞赛|比赛|考试|讲座|论坛|培训会)$/u.test(name)||[...name.matchAll(/大赛|竞赛|比赛|考试|讲座|论坛|培训会/gu)].length!==1)return null
 const at=source.indexOf(quote);return at>=0&&at===source.lastIndexOf(quote)?{quote,name,at}:null
}
/** Source-section completion for the current direct workflow. An existing AI
 * task is associated only when its verb and object identify one section. */
export function completeNumberedActions(input:RecognitionResult,source:string):RecognitionResult{
 const sections=numberedNoticeSections(source);if(!sections.length)return input
 const r=structuredClone(input),sourceId=r.evidence[0]?.sourceId??'source',registrationContext=namedRegistrationContext(source)
 const existing=[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 const matchSection=(task:TaskSuggestionV2)=>{
  const byEvidence=sections.filter(section=>section.verb===task.actionVerb&&task.evidenceIds.some(id=>{const e=r.evidence.find(ref=>ref.id===id);const quote=e?.quotedText||e?.quote;if(!quote)return false;const at=typeof e?.textStart==='number'&&source.slice(e.textStart,e.textStart+quote.length)===quote?e.textStart:source.indexOf(quote)===source.lastIndexOf(quote)?source.indexOf(quote):-1;return at>=section.start&&at<section.end}))
  if(byEvidence.length===1)return byEvidence
  const obj=compact(task.actionObject||task.title).replace(/报名|提交|报送|上传|申请|申报|登记|领取|缴费/gu,'')
  if(obj.length<2)return []
  return sections.filter(s=>s.verb===task.actionVerb&&(compact(s.object).includes(obj)||obj.includes(compact(s.object))))
 }
 const assigned=new Map<Section,TaskSuggestionV2>(),order=new Map<string,number>()
 for(const task of existing){
  if(task.actionVerb==='查看')continue
  const matches=matchSection(task)
  if(matches.length>1||matches.length===1&&assigned.has(matches[0]))return input
  if(matches.length===1)assigned.set(matches[0],task)
 }
 for(const s of sections){
  const id=assigned.get(s)?.tempId??`numbered-direct:${s.start}`,headingAt=source.indexOf(s.heading,s.start),eid=`numbered-direct:evidence:${s.start}`
  if(headingAt<0||headingAt>=s.end)continue
  order.set(id,s.start)
  if(!r.evidence.some(e=>e.id===eid))r.evidence.push({id:eid,sourceId,quote:s.body,quotedText:s.body,textStart:s.start,textEnd:s.end,field:'description',extractionMethod:'parser',confidence:1})
  let task=assigned.get(s)
  if(!task){task={tempId:id,parentTempId:null,hierarchyType:'task',title:s.title,actionVerb:s.verb,actionObject:s.object,description:s.body,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true};r.standaloneTasks.push(task)}
  else {task.evidenceIds=[...new Set([...task.evidenceIds,eid])];task.description=s.body;task.title=s.title;task.actionObject=s.object}
  if(s.verb==='报名'&&/^(?:线上|在线|网上)?(?:系统|平台)$/u.test(s.object)&&registrationContext){
   const hid=`numbered-direct:heading:${registrationContext.at}`
   if(!r.evidence.some(e=>e.id===hid))r.evidence.push({id:hid,sourceId,quote:registrationContext.quote,quotedText:registrationContext.quote,textStart:registrationContext.at,textEnd:registrationContext.at+registrationContext.quote.length,field:'description',extractionMethod:'parser',confidence:1})
   task.title=registrationContext.name+s.object+s.verb;task.evidenceIds=[...new Set([...task.evidenceIds,hid])]
  }
  // A destination belongs to this section only if the source explicitly names
  // a material in both the heading and the sole delivery statement. A web
  // registration URL is not itself a material and is kept in the description.
  const materialName=/(?:报名|申请|申报)?材料$/u.exec(s.object)?.[0],delivery=localDelivery(s.body)
  const existingMaterials=r.materials.filter(m=>m.relatedTaskTempIds.includes(id))
  if(materialName&&delivery&&delivery.verb===s.verb&&delivery.object.includes(materialName)&&!existingMaterials.length){
   const mid=`numbered-direct:material:${s.start}`
   r.materials.push({tempId:mid,name:materialName,required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:delivery.channel,relatedTaskTempIds:[id],evidenceIds:[eid],confidence:1,selected:task.selected!==false})
   task.materialTempIds.push(mid)
  }
  // Discard only a deadline demonstrably sourced from a different numbered
  // section; uncertainty is never assigned to another task or guessed.
  for(const p of r.timePoints.filter(p=>p.relatedTaskTempIds.includes(id)&&p.type.endsWith('_deadline'))){
   const raw=p.rawText?.trim();if(!raw)continue
   const hits=sections.filter(x=>x.body.includes(raw));if(hits.length===1&&hits[0]!==s){p.relatedTaskTempIds=p.relatedTaskTempIds.filter(x=>x!==id);task.timePointTempIds=task.timePointTempIds.filter(x=>x!==p.tempId)}
  }
  const date=/截止\s*[：:]\s*([^|｜\n]{3,55})/u.exec(s.heading)?.[1]?.trim()
  if(!date||/任选|备选|或|取消|作废/u.test(date))continue
  const parsed=parseDirectSourceTime('截止：'+date,{type:'task_deadline',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
  if(!parsed.normalizedValue||parsed.needsConfirmation)continue
  const same=r.timePoints.some(p=>p.relatedTaskTempIds.includes(id)&&p.type.endsWith('_deadline')&&p.normalizedValue===parsed.normalizedValue)
  if(same)continue
  // A conflicting date already attached to this task must be resolved before
  // adding another, unless it was explicitly shown to belong elsewhere.
  if(r.timePoints.some(p=>p.relatedTaskTempIds.includes(id)&&p.type.endsWith('_deadline')&&p.normalizedValue))continue
  const tid=`numbered-direct:deadline:${s.start}`,p:TimePointSuggestionV2={tempId:tid,type:'task_deadline',rawText:s.heading,normalizedValue:parsed.normalizedValue,timezone:'Asia/Shanghai',precision:parsed.precision,isAllDay:parsed.isAllDay,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true}
  r.timePoints.push(p);task.timePointTempIds.push(tid)
 }
 // Reading fallback is replaced only when explicit actions were recovered.
 r.standaloneTasks=r.standaloneTasks.filter(t=>t.actionVerb!=='查看'||!t.tempId.startsWith('direct-read-notice'))
 r.standaloneTasks.sort((a,b)=>(order.get(a.tempId)??Number.MAX_SAFE_INTEGER)-(order.get(b.tempId)??Number.MAX_SAFE_INTEGER))
 return r
}
