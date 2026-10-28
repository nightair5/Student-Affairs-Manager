import type {RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2} from './types'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {cleanDirectTopic} from './directRetention'
import {localActionNeedsDecision} from './localNoticeFacts'
import {sameWeekdayTime,structuredOptionalEvent} from './directStructuredEvent'

const compact=(value:string)=>value.replace(/\s/gu,'')
const eventName=(value:string)=>value.replace(/^(?:参加|出席|举行|召开)/u,'').trim()
const revisionCue=/(?:现)?(?:改为|调整为|更正为|变更为|改至|调整至)/u

/** One named event followed by a correction in the same sentence. This is a
 * source relation, not a title similarity guess or a reference to another notice. */
export function directEventRevision(text:string,name?:string){
  const sentences=[...text.matchAll(/[^。！？\n]+/gu)]
  const matches=sentences.flatMap((span,index)=>{
    const sentence=span[0]
    const cue=revisionCue.exec(sentence)
    if(!cue)return []
    const before=sentence.slice(0,cue.index),after=sentence.slice(cue.index+cue[0].length)
    if(!/原定|原安排/u.test(before))return []
    const named=[...before.matchAll(/(?:举行|举办|召开)的?([^，,；;]{2,45}?)(?:取消|作废|[，,；;]|$)/gu)]
    if(!named.length){
      const withoutVerb=/的([^，,；;]{2,45}(?:会议|说明会|答疑会|交流会|讲座|培训|研讨会|宣讲会|活动|报告会|开幕式|答辩|考试))\s*$/u.exec(before)
      if(withoutVerb)named.push(withoutVerb)
    }
    if(named.length!==1)return []
    const title=named[0][1].trim()
    if(name&&eventName(name)!==eventName(title))return []
    const newName=/(?:举行|举办|召开)([^，,；;]*)/u.exec(after)?.[1].trim()
    if(newName&&newName!==title)return []
    if(/取消|作废|禁止|不再/u.test(after.replace(/(?:原|旧)(?:时间|安排|地点)(?:已)?(?:作废|取消)/gu,'')))return []
    const location=/在\s*([^，,；;]{1,40}?)\s*(?:举行|举办|召开)/u.exec(after)?.[1]
      ??/地点[：:]?\s*([^，,；;]{1,40})/u.exec(after)?.[1]??null
    const next=sentences[index+1]
    // An adjacent invitation repeating the exact event name belongs to the
    // corrected event; no other sentence or similarly named event is borrowed.
    const invitation=next&&next[0].includes(title)&&/请[^。；]{0,40}(?:参加|出席)/u.test(next[0])&&!/\d{1,2}[月日号:点]/u.test(next[0])
    const quote=invitation?text.slice(span.index,next.index+next[0].length):sentence
    return [{sentence:quote,title,after:invitation?text.slice(span.index+cue.index+cue[0].length,next.index+next[0].length):after,location}]
  })
  return matches.length===1?matches[0]:null
}

/** Extra source-backed local facts. Runs only in direct mode; historical model
 * answers and the legacy recognition parser stay byte-for-byte unchanged. */
export function completeDirectLocalFacts(input:RecognitionResult,source:string):RecognitionResult{
  const r=structuredClone(input),sourceId=r.evidence[0]?.sourceId??'source'
  // “参加者” describes recipients, not an invitation or a named activity.
  if(/仅供知悉|无需办理|无需操作/u.test(source)&&!/请[^。；]{0,30}(?:参加|出席)|(?:于|时间)[^。；]{0,40}(?:举行|召开)/u.test(source)){
    r.events=r.events.filter(e=>!/^参加(?:者|人员|资格|条件|对象)/u.test(e.title))
  }
  const evidence=(quote:string,field:'description'|'deadline')=>{
    const at=source.indexOf(quote)
    if(at<0||at!==source.lastIndexOf(quote))return null
    const id=`direct-local-fact:${field}:${at}`
    if(!r.evidence.some(e=>e.id===id))r.evidence.push({id,sourceId,quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field,extractionMethod:'parser',confidence:1})
    return id
  }
  const addTime=(id:string,type:TimePointSuggestionV2['type'],quote:string,value:string|null,owner:string|null)=>{
    const eid=evidence(quote,'deadline');if(!eid||!value)return null
    const p=parseDirectSourceTime(quote,{type,referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
    if(p.needsConfirmation)return null
    const point:TimePointSuggestionV2={tempId:id,type,rawText:quote,normalizedValue:value,timezone:'Asia/Shanghai',precision:value.includes('T')?'exact':'date_only',isAllDay:!value.includes('T'),needsConfirmation:false,relatedTaskTempIds:owner?[owner]:[],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true}
    r.timePoints=r.timePoints.filter(p=>p.tempId!==id);r.timePoints.push(point);return id
  }
  const revision=directEventRevision(source)
  const structured=structuredOptionalEvent(source)
  const onlyPlaceholderEvents=r.events.every(e=>/^(?:参加|出席)(?:的同学|者|人员|对象)/u.test(e.title))
  const explanatoryCompletion=/为[^。！？\n]{0,60}帮助[^。！？\n]{0,80}顺利完成/u.test(source)
  if(structured&&onlyPlaceholderEvents&&r.standaloneTasks.every(t=>t.actionVerb==='核对'||t.actionVerb==='准备'&&/^(?:材料|资料)$/u.test(t.actionObject)||t.actionVerb==='完成'&&explanatoryCompletion)){
    const eid=evidence(source,'description'),teid=evidence(structured.time,'deadline'),parsed=sameWeekdayTime(structured.time,r.createdAt)
    if(eid&&teid&&parsed?.normalizedValue){
      const taskId='local-direct-optional-attendance',eventId='local-direct-optional-event',timeId=eventId+':start'
      r.standaloneTasks=[];r.milestones=[];r.materials=[];r.timePoints=[];r.events=[]
      r.standaloneTasks.push({tempId:taskId,parentTempId:null,hierarchyType:'task',title:'参加'+structured.title,actionVerb:'参加',actionObject:structured.title,description:'建议有意向的同学到场，适用情况待确认。',completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[timeId],evidenceIds:[eid],confidence:0.8,inferenceLevel:'strong_inference',userConfirmationRequired:true,selected:false})
      r.timePoints.push({tempId:timeId,type:'event_start',rawText:structured.time,normalizedValue:parsed.normalizedValue,timezone:'Asia/Shanghai',precision:'exact',isAllDay:false,needsConfirmation:true,relatedTaskTempIds:[taskId],relatedMaterialTempIds:[],evidenceIds:[teid],confidence:0.8,selected:false})
      r.events.push({tempId:eventId,title:structured.title,description:'建议有意向的同学到场，星期日期按接收日期推算，请确认。',location:structured.location,startTimePointTempId:timeId,endTimePointTempId:null,evidenceIds:[eid],confidence:0.8,inferenceLevel:'strong_inference',selected:false,relatedTaskTempIds:[taskId]})
    }
  }
  if(revision){
    const eid=evidence(revision.sentence,'description'),parsed=parseDirectSourceTime(revision.after,{type:'event_start',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
    if(eid&&parsed.normalizedValue&&!parsed.needsConfirmation){
      const oldEvents=r.events.filter(e=>e.evidenceIds.some(id=>{const q=r.evidence.find(x=>x.id===id)?.quote;return q&&revision.sentence.includes(q)}))
      const oldPoints=new Set(oldEvents.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]))
      r.events=r.events.filter(e=>!oldEvents.includes(e));r.timePoints=r.timePoints.filter(p=>!oldPoints.has(p.tempId)||p.relatedTaskTempIds.length>0)
      const id='direct-local-revised-event',start=addTime(id+':start','event_start',revision.after,parsed.normalizedValue,null),end=addTime(id+':end','event_end',revision.after,parsed.rangeEndNormalizedValue,null)
      r.events.push({tempId:id,title:revision.title,description:'',location:revision.location,startTimePointTempId:start,endTimePointTempId:end,evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',selected:true,relatedTaskTempIds:[]})
      r.standaloneTasks=r.standaloneTasks.filter(t=>!(t.actionVerb==='核对'&&t.evidenceIds.some(id=>{const q=r.evidence.find(e=>e.id===id)?.quote;return q&&revision.sentence.includes(q)})))
    }
  }
  // Fill an explicitly stated event end without guessing duration.
  for(const event of r.events){
    if(event.endTimePointTempId||!event.startTimePointTempId)continue
    const candidates=r.evidence.filter(e=>event.evidenceIds.includes(e.id)).map(e=>e.quotedText||e.quote).filter((q):q is string=>Boolean(q&&source.includes(q)))
    const q=candidates.find(q=>q.includes(eventName(event.title))&&/至|到|—|-/u.test(q))
    if(!q)continue
    const parsed=parseDirectSourceTime(q,{type:'event_start',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
    const start=r.timePoints.find(p=>p.tempId===event.startTimePointTempId)
    if(parsed.normalizedValue===start?.normalizedValue&&parsed.rangeEndNormalizedValue&&!parsed.needsConfirmation){event.endTimePointTempId=addTime(event.tempId+':local-end','event_end',q,parsed.rangeEndNormalizedValue,null)}
  }
  // Subject-first delivery: “纸质报告请于…在办公室递交”. A window has
  // start/end facts, never a synthetic submission deadline.
  for(const match of source.matchAll(/[^。！？\n]+/gu)){
    const q=match[0],m=/^\s*([^，,；;]{2,30}?)(?:请|须|需|应)(?:于|在)([^。！？]*?)(?:递交|提交|交到|送交|报送)(?:[，,；;]|$)/u.exec(q)
    if(!m||!/报告|论文|材料|表|申请书|作品|证明/u.test(m[1])||localActionNeedsDecision(q)||/任选|备选|可选择/u.test(q))continue
    const object=m[1].trim(),verb=/(递交|提交|交到|送交|报送)(?:[，,；;]|$)/u.exec(q)![1]
    if(r.standaloneTasks.some(t=>compact(t.actionObject)===compact(object)&&t.actionVerb!=='核对'))continue
    const eid=evidence(q,'description');if(!eid)continue
    const id=`local-direct-delivery-${match.index}`,task:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:verb+object,actionVerb:verb,actionObject:object,description:q,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true}
    const deadline=/截止|截至|之前|以前|(?:日|号|分|\d)前/u.test(q),parsed=parseDirectSourceTime(q,{type:deadline?'task_deadline':'event_start',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
    if(parsed.normalizedValue&&!parsed.needsConfirmation){
      if(deadline){const tid=addTime(id+':deadline','task_deadline',q,parsed.normalizedValue,id);if(tid)task.timePointTempIds.push(tid)}
      else if(parsed.rangeEndNormalizedValue){for(const[type,value]of [['event_start',parsed.normalizedValue],['event_end',parsed.rangeEndNormalizedValue]] as const){const tid=addTime(id+':'+type,type,q,value,id);if(tid){task.timePointTempIds.push(tid);const timeText=m[2].split('在')[0].trim();if(timeText&&q.includes(timeText))r.timePoints.find(p=>p.tempId===tid)!.rawText=timeText}}}
    }
    const channel=/在([^，,；;]{1,35}?)(?:递交|提交|送交|报送)/u.exec(q)?.[1]
    if(channel){const mid=id+':material';task.materialTempIds.push(mid);r.materials.push({tempId:mid,name:object,required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:channel,relatedTaskTempIds:[id],evidenceIds:[eid],confidence:1,selected:true})}
    r.standaloneTasks=r.standaloneTasks.filter(t=>!(t.actionVerb==='核对'&&t.description.includes(q)));r.standaloneTasks.push(task)
  }
  // A parser placeholder is not a user action. Keep real imperatives intact.
  if(!r.events.length&&r.standaloneTasks.length&&r.standaloneTasks.every(t=>t.actionVerb==='核对')&&!/(?:请|需|须|应|要|可以|可)[^。；]{0,30}(?:提交|报名|申请|参加|填写|登记|领取|缴费|上传|核对|查看|完成)|(?:^|[，。])(?:提交|报名|申请|参加|填写|登记|领取|缴费|上传)/u.test(source)){
    r.standaloneTasks=[];r.milestones=[];r.materials=[];r.timePoints=[]
    r.sourceSummary.title=cleanDirectTopic(source.split(/[。！？\n]/u)[0])
  }
  return r
}
