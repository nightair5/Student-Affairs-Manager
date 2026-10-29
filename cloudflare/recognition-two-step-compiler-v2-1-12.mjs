import {compileTwoStep as compileBase} from './recognition-two-step-compiler-v2-1-11.mjs'
import {alignSourceQuote,sourceScopes} from './two-step-source-alignment.mjs'
import {isEventEligibility,normalizeEventPolarity} from './event-eligibility.mjs'
import {parseDirectSourceTime} from './direct-source-time.mjs'

const detailTypes=new Set(['主讲人','主持人','活动内容','参加须知','嘉宾简介','原文时长'])
function checkedHint(hint,quote,source){
 if(!hint||!Number.isInteger(hint.start)||!Number.isInteger(hint.end)||hint.start<0||hint.end<=hint.start||source.slice(hint.start,hint.end)!==hint.literal)return null
 const aligned=alignSourceQuote(quote,hint.literal)
 return aligned&&aligned.start===0&&aligned.end===hint.literal.length?hint:null
}
const conditionPattern=/(?:仅(?:对|供|面向|限)|通过审核|审核通过|符合.{0,12}条件|入选后|录取后|若|如果)/u
const eventPolarity=normalizeEventPolarity
function isEventRevision(clause){
 const active=eventPolarity(clause)
 return /(?:取消|作废|不再举办|改期|延期)/u.test(active)||/(?:调整至|变更为|改为)(?=[^。；;\n]{0,30}(?:\d|[一二三四五六七八九十]+月|周[一二三四五六日天]|下周|明天|另行通知))/u.test(active)
}
function eventRevision(item,raw,options){
 const span=checkedHint(options.alignmentHints?.items?.find(h=>h.id===item.id)?.span,item.quote,options.source)??alignSourceQuote(item.quote,options.source)
 if(!span)return null
 const literal=span.literal.replace(/^(?:活动名称|活动主题|讲座主题)[：:]\s*/u,'').trim()
 for(const scope of sourceScopes(span,options.source)){
  const neighbours=raw.items.filter(candidate=>candidate.kind==='活动').flatMap(candidate=>{const s=checkedHint(options.alignmentHints?.items?.find(h=>h.id===candidate.id)?.span,candidate.quote,options.source)??alignSourceQuote(candidate.quote,options.source);return s&&s.start>=scope.start&&s.end<=scope.end?[candidate.id]:[]})
  const clauses=scope.text.split(/[。；;！？!?\n]/u)
  const isRevision=isEventRevision
  const named=clauses.find(clause=>isRevision(clause)&&clause.includes(literal))
  if(named)return {scope:scope.level,text:named,start:scope.start,end:scope.end}
  if(neighbours.length>1)break
  const reference=clauses.find(clause=>isRevision(clause)&&/(?:该|本|此次|原定的?)(?:活动|讲座|培训|报告会|会议|论坛|实训)/u.test(clause))
  if(reference)return {scope:scope.level,text:reference,start:scope.start,end:scope.end}
 }
 return null
}
// All new content remains human-readable in the existing event description;
// the older contract, storage shape and compiler remain byte-for-byte intact.
export function compileTwoStep(raw,options){
 const retained=[],detail=[],indexes=new Map()
 for(const [index,fact] of raw.facts.entries()){
  if(detailTypes.has(fact?.type))detail.push({fact,index})
  else {indexes.set(index,retained.length);retained.push(fact)}
 }
 const alignmentHints=options.alignmentHints?{...options.alignmentHints,facts:(options.alignmentHints.facts??[]).filter(h=>indexes.has(h.index)).map(h=>({...h,index:indexes.get(h.index)}))}:null
 const first=compileBase({...raw,facts:retained},{...options,alignmentHints,polarityNormalizer:eventPolarity})
 if(!first.result)return first
 const restoredNames=[]
 const items=raw.items.map((item,index)=>{
  if(item.kind!=='活动'||typeof item.quote!=='string'||typeof item.name!=='string')return item
  if(first.result.events.some(event=>event.tempId==='g2-'+(index+1)))return item
  const itemHint=checkedHint(options.alignmentHints?.items?.find(h=>h.id===item.id)?.span,item.quote,options.source)
  const span=itemHint??alignSourceQuote(item.quote,options.source)
  if(!span)return item
  const literal=span.literal.replace(/^(?:活动名称|活动主题|讲座主题)[：:]\s*/u,'').trim()
  const isSpecificName=literal.length>=4&&literal.length<=60&&!/[\n。；;！？!?]|\d{1,4}年|\d{1,2}月|(?:举办|举行|召开|取消|作废|不再|禁止)/u.test(literal)&&/(?:讲座|培训|报告会|说明会|演讲|活动|论坛|研讨会|会议|实训|答辩|面试|展览|考试)$/u.test(literal)
  const sourceScope=sourceScopes(span,options.source)[0].text.normalize('NFKC').replace(/\s/gu,'')
  let revised=false
  if(isSpecificName)for(const scope of sourceScopes(span,options.source)){
   const neighbours=raw.items.filter(candidate=>candidate.kind==='活动').flatMap(candidate=>{const s=checkedHint(options.alignmentHints?.items?.find(h=>h.id===candidate.id)?.span,candidate.quote,options.source)??alignSourceQuote(candidate.quote,options.source);return s&&s.start>=scope.start&&s.end<=scope.end?[candidate.id]:[]})
   if(neighbours.length>1)break
   const clauses=scope.text.split(/[。；;！？!?\n]/u)
   if(clauses.some(clause=>isEventRevision(clause)&&(clause.includes(literal)||/(?:该|本|此次|原定的?)(?:活动|讲座|培训|报告会|会议|论坛|实训)/u.test(clause)))){revised=true;break}
  }
  if(isSpecificName&&!revised&&!sourceScope.includes(item.name.normalize('NFKC').replace(/\s/gu,''))){restoredNames.push({id:item.id,before:item.name,after:literal});return {...item,name:literal}}
  return item
 })
 const base=restoredNames.length?compileBase({...raw,items,facts:retained},{...options,alignmentHints,polarityNormalizer:eventPolarity}):first
 if(!base.result)return base
 base.audit.compilerVersion='two-step-compiler-2.1.12'
 for(const name of restoredNames)base.audit.items.push({...name,rule:'EVENT_TITLE_FROM_EXPLICIT_LITERAL_QUOTE'})
 for(const [i,item] of raw.items.entries()){
  const event=base.result.events.find(e=>e.tempId==='g2-'+(i+1))
  if(!event)continue
  const revision=eventRevision(item,raw,options)
  if(!revision)continue
  const change=/(?:改期至|延期至|延期到|调整至|变更为|改为)\s*(.+)$/u.exec(revision.text)
  if(change||/(?:改期|延期|调整至|变更为|改为)/u.test(revision.text)){
   const rawTime=change?.[1]?.trim()??'',clauseAt=options.source.indexOf(revision.text,revision.start),at=clauseAt<0||!rawTime?-1:options.source.indexOf(rawTime,clauseAt),parsed=rawTime?parseDirectSourceTime(rawTime,{type:'event_start',referenceTime:options.referenceTime,timezone:options.timezone??'Asia/Shanghai'}):null
   const oldIds=new Set([event.startTimePointTempId,event.endTimePointTempId].filter(Boolean)),otherIds=new Set(base.result.events.filter(e=>e!==event).flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]).filter(Boolean))
   base.result.timePoints=base.result.timePoints.filter(p=>!oldIds.has(p.tempId)||otherIds.has(p.tempId)||p.relatedTaskTempIds.length>0)
   event.startTimePointTempId=null;event.endTimePointTempId=null
   if(at>=0&&at+rawTime.length<=revision.end&&parsed?.normalizedValue&&!parsed.needsConfirmation){
    const evidenceId='g2-revision-e'+i
    base.result.evidence.push({id:evidenceId,sourceId:'pending-source',quote:rawTime,quotedText:rawTime,textStart:at,textEnd:at+rawTime.length,field:'deadline',extractionMethod:'parser',confidence:1});event.evidenceIds.push(evidenceId)
    const point=(id,type,value)=>({tempId:id,type,rawText:rawTime,normalizedValue:value,timezone:options.timezone??'Asia/Shanghai',isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[evidenceId],confidence:1,selected:true})
    event.startTimePointTempId='g2-revised-start-'+i;base.result.timePoints.push(point(event.startTimePointTempId,'event_start',parsed.normalizedValue))
    if(parsed.rangeEndNormalizedValue){event.endTimePointTempId='g2-revised-end-'+i;base.result.timePoints.push(point(event.endTimePointTempId,'event_end',parsed.rangeEndNormalizedValue))}
   }else{event.selected=false;base.result.quality.needsHumanReview=true}
   const line='参加须知：'+revision.text.trim();if(event.description.length+line.length+1<=800&&!event.description.includes(line))event.description+='\n'+line
   base.audit.losses.push({layer:'REVISION',id:item.id,reason:parsed?.normalizedValue&&!parsed.needsConfirmation?'SOURCE_EVENT_REVISED_TIME_RESTORED':'SOURCE_EVENT_REVISED_TIME_UNKNOWN',scope:revision.scope,quote:revision.text})
   continue
  }
  const compact=value=>String(value??'').normalize('NFKC').replace(/[\s《》“”‘’（）()、，,：:]/gu,'')
  const name=compact(event.title),quote=compact(item.quote)
  const neighbours=raw.items.filter(candidate=>candidate.kind==='活动').flatMap(candidate=>{const s=checkedHint(options.alignmentHints?.items?.find(h=>h.id===candidate.id)?.span,candidate.quote,options.source)??alignSourceQuote(candidate.quote,options.source);return s&&s.start>=revision.start&&s.end<=revision.end?[candidate.id]:[]})
  const removedTaskIds=new Set(base.result.standaloneTasks.filter(task=>{
   if(!/^(?:参加|出席|报名)$/u.test(task.actionVerb))return false
   const object=compact(task.actionObject)
   if(object&&((name.length>=2&&object.includes(name))||(quote.length>=2&&object.includes(quote))))return true
   const generic=/^(?:该|本|此|此次|本次)(?:活动|讲座|培训|报告会|会议|论坛|实训)$/u.test(object)
   const inScope=task.evidenceIds.some(id=>{const e=base.result.evidence.find(ref=>ref.id===id);return Number.isInteger(e?.textStart)&&Number.isInteger(e?.textEnd)&&e.textStart>=revision.start&&e.textEnd<=revision.end})
   return generic&&inScope&&neighbours.length===1
  }).map(task=>task.tempId))
  base.result.standaloneTasks=base.result.standaloneTasks.filter(task=>!removedTaskIds.has(task.tempId)).map(task=>({...task,dependencyTempIds:task.dependencyTempIds.filter(id=>!removedTaskIds.has(id))}))
  base.result.materials=base.result.materials.flatMap(material=>{const retained=material.relatedTaskTempIds.filter(id=>!removedTaskIds.has(id));return retained.length||!material.relatedTaskTempIds.some(id=>removedTaskIds.has(id))?[{...material,relatedTaskTempIds:retained}]:[]})
  const possiblyUnused=new Set([event.startTimePointTempId,event.endTimePointTempId].filter(Boolean))
  base.result.events=base.result.events.filter(e=>e!==event)
  const stillUsed=new Set(base.result.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]).filter(Boolean))
  base.result.timePoints=base.result.timePoints.flatMap(point=>{const retained=point.relatedTaskTempIds.filter(id=>!removedTaskIds.has(id)),removedOnly=point.relatedTaskTempIds.some(id=>removedTaskIds.has(id))&&!retained.length&&!stillUsed.has(point.tempId);return !removedOnly&&(!possiblyUnused.has(point.tempId)||stillUsed.has(point.tempId)||retained.length)?[{...point,relatedTaskTempIds:retained}]:[]})
  base.result.ignoredContent.push({text:revision.text,reason:'policy'})
  base.audit.losses.push({layer:'REVISION',id:item.id,reason:'SOURCE_EVENT_REVISION_ISOLATED',scope:revision.scope,quote:revision.text,removedTaskIds:[...removedTaskIds]})
 }
 for(const [i,item] of raw.items.entries()){
  const event=base.result.events.find(e=>e.tempId==='g2-'+(i+1))
  if(!event)continue
  const itemAudit=base.audit.items.filter(a=>a.id===item.id)
  const ownerSpan=checkedHint(options.alignmentHints?.items?.find(h=>h.id===item.id)?.span,item.quote,options.source)??alignSourceQuote(item.quote,options.source)
  let localCondition=false
  if(ownerSpan)for(const scope of sourceScopes(ownerSpan,options.source)){
   const neighbours=raw.items.filter(candidate=>candidate.kind==='活动').flatMap(candidate=>{const candidateSpan=checkedHint(options.alignmentHints?.items?.find(h=>h.id===candidate.id)?.span,candidate.quote,options.source)??alignSourceQuote(candidate.quote,options.source);return candidateSpan&&candidateSpan.start>=scope.start&&candidateSpan.end<=scope.end?[candidate.id]:[]})
   if(neighbours.length>1)break
   if(conditionPattern.test(scope.text)){localCondition=true;break}
  }
  const hasActualCondition=base.audit.facts.some(f=>f.item===item.id&&f.type==='条件'&&f.status==='ALIGNED_AND_OWNED'&&isEventEligibility(f.literal))||localCondition
  const hasItemLoss=base.audit.losses.some(l=>l.id===item.id&&['TIME','REVISION','POLARITY'].includes(l.layer))
  const voluntary=itemAudit.some(a=>a.rule==='SOURCE_PARTICIPANT_SCOPE_UNKNOWN'||a.rule==='PUBLIC_ATTENDANCE_SCHEDULE_NOT_PERSONAL_MANDATE')
  if(voluntary&&!hasActualCondition&&!hasItemLoss){
   event.description=event.description.replace(/\n适用条件待确认：(?:原文公布了活动或考试安排，是否由本人参加尚未确认。|[^\n]*(?:有意|感兴趣|欢迎|自愿)[^\n]*)/gu,'')
   event.selected=true
  }
 }
 const priority={'主讲人':0,'主持人':1,'参加须知':2,'活动内容':3,'原文时长':4,'嘉宾简介':5}
 for(const {index,fact} of detail.toSorted((a,b)=>priority[a.fact.type]-priority[b.fact.type]||a.index-b.index)){
  const ownerIndex=raw.items.findIndex(item=>item.id===fact.item&&item.kind==='活动')
  const event=base.result.events.find(item=>item.tempId==='g2-'+(ownerIndex+1))
  const hint=options.alignmentHints?.facts?.find(h=>h.index===index)?.span
  const span=checkedHint(hint,fact.quote,options.source)??alignSourceQuote(fact.quote,options.source)
  if(!event||!span){base.audit.losses.push({layer:!span?'ALIGNMENT':'OWNERSHIP',id:String(index),reason:!span?'EVENT_DETAIL_UNALIGNED':'EVENT_DETAIL_OWNER_MISSING',quote:fact.quote});continue}
  let conflictingScope=null
  const scopes=sourceScopes(span,options.source),sentence=scopes[0],before=options.source.slice(sentence.start,span.start),after=options.source.slice(span.end,sentence.end)
  const comma=Math.max(before.lastIndexOf('，'),before.lastIndexOf(',')),nextComma=after.search(/[，,]/u)
  const clause={level:'CLAUSE',start:comma<0?sentence.start:sentence.start+comma+1,end:nextComma<0?sentence.end:span.end+nextComma}
  for(const scope of [clause,...scopes]){
   const neighbours=raw.items.filter(item=>item.kind==='活动').flatMap(item=>{const s=checkedHint(options.alignmentHints?.items?.find(h=>h.id===item.id)?.span,item.quote,options.source)??alignSourceQuote(item.quote,options.source);return s&&s.start>=scope.start&&s.end<=scope.end?[item.id]:[]})
   if(neighbours.length===1){if(neighbours[0]!==fact.item)conflictingScope=scope.level;break}
   // A scope containing several activities cannot prove either ownership.
   if(neighbours.length>1){
    if(scope.level==='SENTENCE'){
     const mentioned=raw.items.filter(candidate=>neighbours.includes(candidate.id)&&typeof candidate.quote==='string'&&span.literal.includes(candidate.quote)).map(candidate=>candidate.id)
     if(mentioned.length!==1||mentioned[0]!==fact.item)conflictingScope=scope.level
    }
    break
   }
  }
  if(conflictingScope){base.audit.losses.push({layer:'OWNERSHIP',id:String(index),reason:'EVENT_DETAIL_CONTRADICTS_SOURCE_SCOPE',scope:conflictingScope,quote:fact.quote});continue}
  const value=span.literal.replace(new RegExp('^'+fact.type+'[：:]\\s*','u'),'').trim()
  const line=fact.type+'：'+value
  if(!value||event.description.split('\n').includes(line))continue
  if(event.description.length+1+line.length>800){base.audit.losses.push({layer:'FACT_STRUCTURE',id:String(index),reason:'EVENT_DETAIL_EXCEEDS_DESCRIPTION_LIMIT',quote:fact.quote});base.result.quality.needsHumanReview=true;continue}
  const evidenceId='g2-detail-e'+(index+1)
  base.result.evidence.push({id:evidenceId,sourceId:'pending-source',quote:span.literal,quotedText:span.literal,textStart:span.start,textEnd:span.end,field:'description',extractionMethod:'parser',confidence:1})
  event.description+='\n'+line
  event.evidenceIds.push(evidenceId)
  base.audit.facts.push({type:fact.type,item:fact.item,start:span.start,end:span.end,literal:span.literal,status:'ALIGNED_AND_OWNED'})
 }
 return base
}
