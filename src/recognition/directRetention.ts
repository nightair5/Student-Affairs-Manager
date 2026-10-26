import type { RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2 } from './types'
import type { DirectConversion, DirectItem, DirectTag } from './directResult'
import { parseChineseTimeAst } from '../lib/timeSemantics'
import { projectDirectActions } from './directActionProjection'
import { directTimeSafetyReason, inactiveSourceTime, simpleTimeSafetyReason } from './directTimeSafety'

export const DIRECT_RETENTION_VERSION = 'direct-retention-1.0.2'
const norm=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const action=/申请退费|申请|申报|报名|提交|报送|填写|登记|预约|选课|缴费|领取|上传|参加|归还|学习|完成|发送|准备|打印|下载/u
const timeWords=/\d{1,4}\s*[年/月日号:：.-]|今天|明天|后天|周[一二三四五六日天]|星期|月底|月末|即日起|上午|下午|晚上/u
const deadlineCue=/截止|截至|最迟|之前|以前|[日号点分\d]\s*前/u
const alternative=/任选|备选|可选择|任一|(?:日|号|\d)\s*或.{0,20}(?:日|号)/u
const qualification=/若|如果|如需|如已|符合.{0,20}条件|参评对象|申请对象|申请条件|仅限|入选后|录取后|有意|自愿|适用条件待确认|资格待确认/u
const flatten=(r:RecognitionResult)=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]

/** Presentation cleanup only. The complete model/source wording stays in description/audit. */
export function cleanDirectTopic(text:string):string {
  return text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'')
    .replace(/[【[][^】\]]{0,24}(?:提醒|通知|公告|消息|资讯|申报)[】\]]/gu,'')
    .replace(/[【】[\]]/gu,'').replace(/^(?:各位同学[：:,，]?|同学们[：:,，]?|关于开展|关于|通知[：:])/u,'')
    .replace(/(?:的通知|通知|公告)[。！!：:]*$/u,'').replace(/\s+/gu,'').trim().slice(0,24)||'通知内容'
}

function cancelled(title:string,text:string):boolean {
  const object=title.replace(/^(?:如符合条件\s*)?(?:参加|申请|报名|提交|填写|领取)/u,'')
  return text.split(/[。；;\n]/u).some(s=>{
    const p=s.replace(/取消(?:其)?(?:申请|参评|获奖|评选)?资格|逾期[^，。；]{0,12}(?:不再受理|不予受理|不得补交)|不得(?:缺席|迟到|早退)/gu,'')
    return /取消|作废|废止|不再举办|禁止|请勿|无需提交|不得提交/u.test(p)&&object.length>1&&norm(p).includes(norm(object))&&!/改为|调整为|更正为|延期至/u.test(p)
  })
}

export function convertRetainedDirectResult(input:RecognitionResult,source:string,original?:RecognitionResult):DirectConversion {
  const usable=original&&Array.isArray(original.standaloneTasks)&&Array.isArray(original.evidence)&&Array.isArray(original.timePoints)
  let result=structuredClone(usable?original:input)
  const omitted:DirectConversion['omitted']=[],items:DirectItem[]=[],sourceId=result.evidence[0]?.sourceId??'source'
  const tags=new Map<string,DirectTag[]>(),addTag=(id:string,tag:DirectTag)=>tags.set(id,[...new Set([...(tags.get(id)??[]),tag])])
  const literal=(ids:string[])=>ids.flatMap(id=>{const e=result.evidence.find(e=>e.id===id),q=e?.quotedText??e?.quote;return q&&source.includes(q)?[q]:[]}).join('\n')
  let tasks=flatten(result).filter(t=>!/^查看[：:]/u.test(t.title))
  // Recover actions which the model placed in information, without replacing the recorded answer.
  if(!tasks.length){const projected=projectDirectActions({...result,standaloneTasks:[],milestones:[]},source);if(projected.standaloneTasks.length){result=projected;tasks=projected.standaloneTasks}}
  tasks=tasks.filter(t=>{
    const context=literal(t.evidenceIds)||source
    if(cancelled(t.title,context)){omitted.push({id:t.tempId,reason:'CANCELLED_OR_PROHIBITED'});return false}
    if(/待(?:另行)?通知|另行通知|尚未公布/u.test(t.title)&&(/^(通知|公布|安排|等待|查看)$/u.test(t.actionVerb)||/^(?:待|另行|后续)?通知$/u.test(t.actionObject))){
      result.ignoredContent.push({text:context.slice(0,1000),reason:'other'});omitted.push({id:t.tempId,reason:'FUTURE_STATUS_KEPT_AS_INFORMATION'});return false
    }
    return true
  }).map(t=>{
    const context=literal(t.evidenceIds)||source
    const uncertain=!t.selected||!t.actionObject||!norm(context).includes(norm(t.actionObject))||!t.evidenceIds.length||/待核对/u.test(t.title)
    if(uncertain)addTag(t.tempId,'待确认')
    const conditioned=qualification.test(context)||qualification.test(t.description)||qualification.test(source)&&/申请|报名|申报/u.test(t.actionVerb)
    if(conditioned){addTag(t.tempId,'如符合条件');addTag(t.tempId,'待确认')}
    const base=t.title.replace(/^如符合条件\s*/u,'').trim()
    return {...t,title:(conditioned?'如符合条件 ':'')+base,description:t.description+(base.length>24?'\n完整名称：'+base:''),selected:true,parentTempId:null,hierarchyType:'task' as const}
  })
  const events=result.events.filter(e=>{if(cancelled(e.title,literal(e.evidenceIds)||source)){omitted.push({id:e.tempId,reason:'CANCELLED_OR_PROHIBITED'});return false}return true}).map(e=>{
    if(!e.selected||!e.evidenceIds.length)addTag(e.tempId,'待确认')
    if(qualification.test(literal(e.evidenceIds))||qualification.test(e.description)){addTag(e.tempId,'如符合条件');addTag(e.tempId,'待确认')}
    return {...e,selected:true}
  })
  // A declared event's own end quote may state the complete range. Use that
  // range to refine its date-only start; never borrow a different event's time.
  for(const e of events){
    const start=result.timePoints.find(p=>p.tempId===e.startTimePointTempId),end=result.timePoints.find(p=>p.tempId===e.endTimePointTempId)
    if(!start?.normalizedValue||start.precision!=='date_only'||!end?.normalizedValue||end.needsConfirmation||!literal(end.evidenceIds))continue
    const parsed=parseChineseTimeAst(end.rawText,{type:'event_start',referenceTime:result.createdAt,timezone:end.timezone})
    if(parsed.needsConfirmation||!parsed.normalizedValue?.includes('T')||!parsed.rangeEndNormalizedValue||parsed.normalizedValue.slice(0,10)!==start.normalizedValue||parsed.rangeEndNormalizedValue!==end.normalizedValue)continue
    Object.assign(start,{rawText:end.rawText,normalizedValue:parsed.normalizedValue,precision:parsed.precision,isAllDay:false,needsConfirmation:false,evidenceIds:[...end.evidenceIds]})
  }
  const ids=new Set([...tasks,...events].map(e=>e.tempId)),eventTimes=new Set(events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]).filter(Boolean))
  const points:TimePointSuggestionV2[]=result.timePoints.filter(p=>p.relatedTaskTempIds.some(id=>ids.has(id))||eventTimes.has(p.tempId)).map(p=>{
    const q=literal(p.evidenceIds)||p.rawText,ownerIds=p.relatedTaskTempIds.filter(id=>ids.has(id)),isDeadline=/_deadline$/u.test(p.type)
    const affected=[...ownerIds,...events.filter(e=>e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId).map(e=>e.tempId)]
    let value=p.normalizedValue,type=p.type
    const invalid=!value||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?)?$/u.test(value)||!Number.isFinite(Date.parse(value))
    if(invalid||!timeWords.test(source)){value=null;affected.forEach(id=>addTag(id,'时间待定'))}
    if(isDeadline&&(!timeWords.test(q)||alternative.test(q))){value=null;affected.forEach(id=>addTag(id,'待确认'))}
    if(isDeadline&&/办理时段|开放时间|领取时段|办理窗口/u.test(q)&&!deadlineCue.test(q)){type='event_start';affected.forEach(id=>addTag(id,'待确认'))}
    const safetyReason=(result.promptVersion==='recognition-simple-1.0.0'?simpleTimeSafetyReason:directTimeSafetyReason)({...p,type},source,result.createdAt)
    if(safetyReason&&value){value=null;affected.forEach(id=>addTag(id,'待确认'));omitted.push({id:p.tempId,reason:safetyReason})}
    if(p.needsConfirmation||!literal(p.evidenceIds))affected.forEach(id=>addTag(id,'待确认'))
    if(!value)for(const t of tasks.filter(t=>ownerIds.includes(t.tempId)))if(p.rawText&&!t.description.includes(p.rawText))t.description+='\n原文时间：'+p.rawText
    return {...p,type,normalizedValue:value,relatedTaskTempIds:ownerIds,selected:!!value,needsConfirmation:p.needsConfirmation||!value,precision:value?p.precision:'vague' as const,isAllDay:value?p.isAllDay:false}
  })
  const taskIds=new Set(tasks.map(t=>t.tempId))
  result.materials=result.materials.filter(m=>m.relatedTaskTempIds.some(id=>taskIds.has(id))).map(m=>({...m,selected:true,relatedTaskTempIds:m.relatedTaskTempIds.filter(id=>taskIds.has(id))}))
  const materialIds=new Set(result.materials.map(m=>m.tempId))
  for(const p of points)p.relatedMaterialTempIds=p.relatedMaterialTempIds.filter(id=>materialIds.has(id))
  for(const e of events)e.relatedTaskTempIds=(e.relatedTaskTempIds??[]).filter(id=>taskIds.has(id))
  for(const t of tasks){t.dependencyTempIds=t.dependencyTempIds.filter(id=>taskIds.has(id));t.timePointTempIds=points.filter(p=>p.relatedTaskTempIds.includes(t.tempId)).map(p=>p.tempId);t.materialTempIds=result.materials.filter(m=>m.relatedTaskTempIds.includes(t.tempId)).map(m=>m.tempId);if(!points.some(p=>p.relatedTaskTempIds.includes(t.tempId)&&p.normalizedValue))addTag(t.tempId,'时间待定')}
  for(const e of events)if(!points.some(p=>p.tempId===e.startTimePointTempId&&p.normalizedValue))addTag(e.tempId,'时间待定')
  if(!tasks.length){
    const declared=result.sourceSummary.title
    const proposed=declared&&!/^(?:通知资料|通知建议|通知内容|通知|未命名)$/u.test(declared)?declared:source.split(/[\n。]/u).find(s=>s.trim())||'通知',topic=cleanDirectTopic(proposed)
    const id='direct-read-notice',eid='direct-source-notice',quote=source.slice(0,500)
    result.evidence.push({id:eid,sourceId,quote,quotedText:quote,textStart:0,textEnd:quote.length,field:'description',extractionMethod:'parser',confidence:1})
    const reader:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:'查看：'+topic,actionVerb:'查看',actionObject:topic,description:'按直达规则保留的阅读待办\n完整通知主题：'+proposed,completionCriteria:['查看通知内容'],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'low',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'optional_suggestion',userConfirmationRequired:false,selected:true}
    tasks.push(reader)
    const spans=[...source.matchAll(/(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日号](?:[^。；\n]{0,22}?(?:\d{1,2}[：:]\d{2}|\d{1,2}点(?:半|\d{1,2}分)?))?/gu)].map(m=>{const context=source.slice(Math.max(0,m.index-18),Math.min(source.length,m.index+m[0].length+14));const parsed=parseChineseTimeAst(m[0],{type:'planned_start',referenceTime:result.createdAt,timezone:result.timePoints[0]?.timezone??'Asia/Shanghai'});return {quote:m[0],at:m.index,context,parsed}}).filter(s=>s.parsed.normalizedValue&&!s.parsed.needsConfirmation&&!inactiveSourceTime(source,s.quote))
    const dated=spans.filter(s=>deadlineCue.test(s.context)&&!alternative.test(s.context))
    const future=spans.filter(s=>s.parsed.normalizedValue!.slice(0,10)>=result.createdAt.slice(0,10)).sort((a,b)=>a.parsed.normalizedValue!.localeCompare(b.parsed.normalizedValue!))
    const picked=dated[0]??future[0]??spans[0]
    if(picked&&!alternative.test(picked.context)){
      const did='direct-reading-date-evidence';result.evidence.push({id:did,sourceId,quote:picked.quote,quotedText:picked.quote,textStart:picked.at,textEnd:picked.at+picked.quote.length,field:'deadline',extractionMethod:'parser',confidence:1})
      // A suggested reading date is not a submission deadline, even when selected from one.
      const p:TimePointSuggestionV2={tempId:'direct-reading-date',type:'planned_start',rawText:picked.quote,normalizedValue:picked.parsed.normalizedValue,timezone:picked.parsed.timezone,isAllDay:picked.parsed.isAllDay,precision:picked.parsed.precision,needsConfirmation:spans.length>1,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[did],confidence:1,selected:true}
      points.push(p);reader.timePointTempIds.push(p.tempId);if(spans.length>1){addTag(id,'待确认');reader.description+='\n原文时间：'+spans.map(s=>s.quote).join('；')}
    }else addTag(id,'时间待定')
    if(action.test(source)&&!/无需办理|无需操作|仅供参考/u.test(source)){addTag(id,'待确认');reader.description+='\n原文可能包含行动，尚未形成可靠的动作与对象。'}
  }
  for(const e of events)items.push({tempId:e.tempId,kind:'event',tags:tags.get(e.tempId)??[]})
  for(const t of tasks)items.push({tempId:t.tempId,kind:'task',tags:tags.get(t.tempId)??[]})
  result.milestones=[];result.standaloneTasks=tasks;result.events=events;result.timePoints=points
  const retained=new Set([...tasks,...events,...points,...result.materials].map(e=>e.tempId));result.conflicts=result.conflicts.map(c=>({...c,entityTempIds:c.entityTempIds.filter(id=>retained.has(id))}))
  result.projectMatch={decision:'standalone_task',matchedProjectId:null,suggestedProjectTitle:null,confidence:1,reasons:['直达保留：不确定内容标记，不覆盖既有事项']}
  return {result,items,omitted}
}
