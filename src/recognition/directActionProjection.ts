import type {RecognitionResult,TaskSuggestionV2} from './types'
import {parseChineseTimeAst} from '../lib/timeSemantics'
import {localDelivery,localMaterialRequirements,localSubmissionChannel} from './localNoticeFacts'

export const DIRECT_ACTION_PROJECTION_VERSION='direct-action-projection-1.0.0'
const norm=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const noAction=/无需|无须|不必|不用|不要|请勿|不得|禁止|不再|取消|作废/u
const dateAlternatives=/任选|备选|可选择|任一|(?:日|号|\d)\s*(?:或|、).{0,18}(?:日|号)/u
const verbs='报名|申请|提交|填写|登记|预约|选课|缴费|领取|上传|参加|出席|下载|归还|关闭|储水'
const cleanObject=(s:string)=>s.replace(/[（(][^（）()]*[）)]/gu,'').replace(/^(?:本次|此次|该项)\s*/u,'').split(/(?:提交至|提交到|上传至|发送至|交到|交至|发至|至邮箱|到邮箱|，|,|；|;|。|！|？|\n|并|后|前)/u)[0].replace(/(?:的同学|的学生|的师生|的考生|的人员).*$/u,'').replace(/(?:具体|相关)?(?:事宜|事项|工作)$/u,'').trim()
const tasksOf=(r:RecognitionResult)=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]

/** Optional source-based projection. It is deliberately separate from model
 * extraction and preserves its bytes. Every new action has a literal source span;
 * no generic notice title, host action, or unowned date becomes a student task. */
export function projectDirectActions(input:RecognitionResult,text:string):RecognitionResult{
 const r=structuredClone(input),tasks=tasksOf(r),sourceId=r.evidence[0]?.sourceId??'source'
 const spans=[...text.matchAll(/[^。！？\n]+/gu)].map(m=>({quote:m[0],at:m.index!})).filter(s=>s.quote.trim())
 const evidence=(quote:string,at:number,field:RecognitionResult['evidence'][number]['field'])=>{const id=`direct-action:${field}:${at}`;if(!r.evidence.some(e=>e.id===id))r.evidence.push({id,sourceId,quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field,extractionMethod:'parser',confidence:1});return id}
 const known=tasks.filter(t=>!/^查看[：:]/u.test(t.title)&&!noAction.test(t.actionVerb)&&!/^无需|^无须|^不必/u.test(t.title))
 if(known.length===tasks.length&&known.length)return r
 const additions:{task:TaskSuggestionV2;span:typeof spans[number]}[]=[]
 for(const span of spans){
  if(span.quote.length>500||additions.length>=20)continue
  // This first projection recovers information-only omissions. It does not
  // expand a notice which already has grounded actions into many extra steps.
  if(known.length)break
  // Do not promote an institution announcing/hosting something into student work.
  // An affirmative instruction may follow a qualification clause, but never a prohibition.
  const local=span.quote.split(/[，,；;]/u).find(c=>new RegExp(`(?:请|须|需|应|可|有意).{0,36}(?:${verbs})`,'u').test(c)&&!noAction.test(c))??span.quote
  if(noAction.test(local)||/仅供(?:知悉|参考)|无需(?:办理|操作)/u.test(span.quote)||!/(?:请|须|需|应当|务必|可以|可申请|可报名|可领取|有意)/u.test(local))continue
  const delivery=localDelivery(span.quote)
  let verb=delivery?.verb,object=delivery?.object
  if(!verb){const m=new RegExp(`(?:请(?:大家|各位同学|同学们)?|须|需|可以|可|应当|务必)\\s*(?:于[^，,。；;]{0,45}?(?:前|之前)\\s*)?(?:及时|准时|按时)?\\s*(${verbs})\\s*([^，,。；;！？”“\\n]{1,70})`,'u').exec(local);if(m){verb=m[1];object=cleanObject(m[2])}}
  if(!verb||!object||object.length<2||object.length>60||!norm(span.quote).includes(norm(object))||/^(?:至|到|在|于|后|前|的|同学|学生|师生|考生|方式|时间|截止|要求|信息|通知|补办$|换发$)|[:：]|\d{4}年/u.test(object))continue
  if(known.some(t=>norm(t.actionObject).includes(norm(object))||norm(object).includes(norm(t.actionObject))))continue
  if(additions.some(a=>norm(a.task.actionObject)===norm(object)))continue
  const id=`direct-action-${span.at}`,eid=evidence(span.quote,span.at,'title')
  const t:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:verb+object,actionVerb:verb,actionObject:object,description:span.quote,completionCriteria:[verb+object],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:false}
  additions.push({task:t,span})
  const channel=localSubmissionChannel(span.quote)
  if(channel){const requirements=localMaterialRequirements(span.quote),mid=id+'-material';r.materials.push({tempId:mid,name:object,required:true,formatRequirements:requirements.formats,namingRequirements:requirements.naming,quantity:null,submissionChannel:channel,relatedTaskTempIds:[id],evidenceIds:[eid],confidence:1,selected:true});t.materialTempIds.push(mid)}
 }
 for(const {task,span}of additions){
  // Never borrow a nearby event date or the first of several actions' deadlines.
  const sameSpanActions=additions.filter(a=>a.span.at===span.at)
  const q=span.quote
  if(sameSpanActions.length!==1||dateAlternatives.test(q)||/办理时段|开放时间|领取时段/u.test(q)||!/(?:截止|最迟|不晚于|之前|[日号点分:：\d]\s*前)/u.test(q))continue
  const parsed=parseChineseTimeAst(q,{type:'task_deadline',referenceTime:r.createdAt,timezone:r.timePoints[0]?.timezone??'Asia/Shanghai'})
  if(!parsed.normalizedValue||parsed.needsConfirmation||parsed.rangeEndNormalizedValue)continue
  const tid=task.tempId+'-deadline',eid=evidence(q,span.at,'deadline')
  r.timePoints.push({tempId:tid,type:'task_deadline',rawText:q,normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[task.tempId],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true});task.timePointTempIds.push(tid)
 }
 const real=[...known,...additions.map(a=>a.task)]
 if(!additions.length&&tasks.some(t=>/^查看[：:]/u.test(t.title)))return r
 r.standaloneTasks=real;r.milestones=[]
 const ids=new Set(real.map(t=>t.tempId));r.timePoints=r.timePoints.map(p=>({...p,relatedTaskTempIds:p.relatedTaskTempIds.filter(id=>ids.has(id))}));r.materials=r.materials.map(m=>({...m,relatedTaskTempIds:m.relatedTaskTempIds.filter(id=>ids.has(id))}))
 return r
}
