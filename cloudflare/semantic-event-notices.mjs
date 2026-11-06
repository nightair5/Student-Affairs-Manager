import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''
const standaloneAction=/(?:报名|申请|预约|注册|缴费|付款|支付|上传|提交|交付|领取|办理|递交|登记|购买)/u
const independentDeadline=/(?:截止|截至|最迟|不晚于)|(?:\d{1,4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号)?[^。；;\n]{0,18}(?:前|之前|以前)/u

/** Fold only a model-declared, source-cited event hint that has no separate
 * delivery, time, dependency, choice, or material to complete independently. */
export function applyEventIncidentalNotices({result,pending,source,evidence,note,audit}){
 const events=pending.filter(record=>record.kind==='event'&&result.events.includes(record.entity))
 const tasks=pending.filter(record=>record.kind==='task'&&result.standaloneTasks.includes(record.entity))
 for(const task of tasks){
  const relation=task.item.eventRelation
  if(!relation||relation.kind!=='incidental'||typeof relation.eventKey!=='string'||typeof relation.evidence!=='string')continue
  const event=events.find(record=>record.item.key===relation.eventKey)
  if(!event||event.entity.sourceStatus==='alternative'||event.entity.sourceStatus==='uncertain')continue
  const quote=locateSourceQuote(relation.evidence,source)
  if(!quote||quote.literal.length>500)continue
  const taskSpans=task.entity.evidenceIds.flatMap(id=>{const ref=result.evidence.find(item=>item.id===id);return ref?[ref]:[]})
  const actionSpan=taskSpans.find(ref=>ref.textStart>=quote.start&&ref.textEnd<=quote.end||quote.start>=ref.textStart&&quote.end<=ref.textEnd)
  if(!actionSpan)continue
  if(events.length>1){
   const overlapped=events.filter(candidate=>candidate.entity.evidenceIds.some(id=>{
    const ref=result.evidence.find(item=>item.id===id)
    return ref&&ref.textStart>=quote.start&&ref.textEnd<=quote.end
   }))
   if(overlapped.length!==1||overlapped[0]!==event)continue
  }
  const id=task.entity.tempId
  if(standaloneAction.test((task.item.action??'')+(task.item.object??''))||independentDeadline.test(task.ownText))continue
  if((Array.isArray(task.item.times)&&task.item.times.length)||(Array.isArray(task.item.materials)&&task.item.materials.length))continue
  if(result.timePoints.some(point=>point.relatedTaskTempIds.includes(id))||result.materials.some(material=>material.relatedTaskTempIds.includes(id)))continue
  if(task.entity.dependencyTempIds.length||result.standaloneTasks.some(other=>other.dependencyTempIds.includes(id)))continue
  if(result.conflicts.some(conflict=>conflict.entityTempIds?.includes(id))||result.events.some(other=>other.relatedTaskTempIds?.includes(id)))continue
  const details=[...task.entity.completionCriteria,...task.entity.description.split('\n').map(line=>line.replace(/^[^：:\n]{1,18}[：:]/u,''))].map(compact).filter(Boolean)
  const visible=actionSpan.textStart>=quote.start&&actionSpan.textEnd<=quote.end?source.slice(actionSpan.textStart,actionSpan.textEnd):quote.literal
  const quoted=compact(visible)
  // A relation must not discard an extra link, requirement, or cited fact.
  // A faithful paraphrase must not force a second top-level item. Carry the
  // already compiled detail into the parent, rather than dropping its facts
  // or demanding that the display text be a verbatim substring.
  if(task.item.channel&&!quoted.includes(compact(task.item.channel)))continue
  if(taskSpans.some(ref=>!quoted.includes(compact(ref.quote))))continue
  const extra=[...task.entity.completionCriteria,...task.entity.description.split('\n').map(value=>value.replace(/^[^：:\n]{1,18}[：:]/u,''))]
   .filter(value=>value&&details.includes(compact(value))&&!quoted.includes(compact(value)))
  const line=[...new Set([visible,...extra])].filter(value=>!compact(event.entity.description).includes(compact(value))).map(value=>'参加须知：'+value).join('\n')
  if((line&&event.entity.description.length+line.length+1>2400)||event.entity.evidenceIds.length>=20){note('RELATION',task.item.key,'EVENT_NOTICE_CAPACITY');continue}
  const ref=evidence(quote.literal,'event',task.item.key,quote.start)
  if(!ref)continue
  if(line)event.entity.description=[event.entity.description,line].filter(Boolean).join('\n')
  event.entity.evidenceIds=[...new Set([...event.entity.evidenceIds,ref])]
  result.standaloneTasks=result.standaloneTasks.filter(item=>item.tempId!==id)
  audit.facts.push({role:'event_incidental_notice',event:event.entity.tempId,item:id,sourceEvidenceId:ref})
 }
}
