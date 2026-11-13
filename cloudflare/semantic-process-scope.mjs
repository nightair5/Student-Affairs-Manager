import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>String(value??'').normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')

/** Recognise a cited item as a phase of one explicitly structured process,
 * rather than assuming every dated phase is a personal calendar appointment.
 * Unclear or genuinely participatory phases are never moved by this helper. */
export function applyProcessScope({source,result,pending,evidence,note,audit}) {
 const headings=[...source.matchAll(/(?:^|\n)\s*[（(][一二三四五六七八九十\d]+[）)]\s*([^\n。；;]{2,60}?(?:阶段|流程|环节))\s*(?=\n|$)/gu)]
 const tasks=pending.filter(record=>record.kind==='task'&&result.standaloneTasks.includes(record.entity))
 for(const record of pending.filter(value=>value.kind==='event'&&result.events.includes(value.entity))){
  const item=record.item,entity=record.entity,title=compact(item.title)
  if(!title)continue
  if(['audience','conditional'].includes(item.assignment?.scope))continue
  const refs=(Array.isArray(item.evidence)?item.evidence:[]).map(quote=>typeof quote==='string'?locateSourceQuote(quote,source):null).filter(Boolean)
  if(!refs.length)continue
  if(result.conflicts.some(conflict=>conflict.entityTempIds?.includes(entity.tempId)))continue
  let owners=[],anchor=null
  const assignment=item.assignment
  if(assignment?.scope==='other'&&typeof assignment.actor==='string'&&typeof assignment.evidence==='string'&&typeof assignment.relatedTo==='string'){
   const role=locateSourceQuote(assignment.evidence,source),actor=compact(assignment.actor)
   const actorText=compact(role?.literal),startsAsSubject=actor&&new RegExp('^(?:由)?'+actor.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')+'(?!的|之|证|卡|号|名单|材料|资料|信息|被)').test(actorText)
   owners=tasks.filter(task=>task.item.key===assignment.relatedTo&&['交给','提交给','递交给','报送给','发送给','交至'].some(link=>compact(task.ownText).includes(link+actor)))
   if(role&&startsAsSubject&&owners.length===1&&!/参加|参与|出席|到场|入场/u.test(actorText))anchor=role
  }else if(headings.length>=2&&/(?:阶段|流程|环节)$/u.test(title)){
   const matches=headings.map((heading,index)=>({heading,index})).filter(value=>compact(value.heading[1])===title)
   if(matches.length!==1)continue
   const {heading,index}=matches[0],start=heading.index??0,end=headings[index+1]?.index??source.length
   if(refs.some(ref=>ref.start<start||ref.end>end))continue
   const section=source.slice(start,end)
   // A phase with attendance, training or a live public programme is not a
   // passive administrative stage. Never infer non-participation from a name.
   if(/参加|参与|出席|到场|入场|参观|答辩|面试|培训|讲座|会议|展览|演出|开幕|欢迎|邀请|(?:请|须|需|应).{0,16}(?:评审|展示)/u.test(section))continue
   // The phase heading alone is not enough: there must also be a separate
   // source sentence saying that the submitted object is processed. A timed
   // final, performance or public programme must not disappear just because
   // its heading happens to end in “阶段”.
   const phase=title.replace(/(?:阶段|流程|环节)$/u,''),action=/(?:评审|审核|审查|评选|选拔|公示|公布|展示|展出|颁发|发放)$/u.exec(phase)?.[0]
   const object=action?phase.slice(0,-action.length):''
   if(!action||object.length<2)continue
   const supported=source.split(/[。；;\n]/u).some(clause=>{
    const value=compact(clause)
    return value.includes(object)&&value.includes(action)&&/(?:对|将|把|由|组织|统一|选出|按照|进行)/u.test(value)
   })
   if(!supported)continue
   // Without an explicit target, only one actionable matter permits a safe
   // contextual projection. Other cases retain the original event unchanged.
   owners=tasks
   const headingSpan=locateSourceQuote(heading[1],source)
   if(headingSpan&&headingSpan.start>=start&&headingSpan.end<=end)anchor=headingSpan
  }
  if(!anchor||owners.length!==1)continue
  const owner=owners[0].entity
  const fragments=[anchor.literal,...refs.map(ref=>ref.literal)]
  const line='后续流程：'+[...new Set(fragments)].join('；')
  if(owner.description.length+line.length+1>800||new Set([...owner.evidenceIds,...entity.evidenceIds]).size+1>20){
   note('ROLE',item.key,'PROCESS_CONTEXT_CAPACITY');continue
  }
  const id=evidence(anchor.literal,'description',item.key,anchor.start)
  if(!id)continue
  owner.description=[owner.description,line].filter(Boolean).join('\n')
  owner.evidenceIds=[...new Set([...owner.evidenceIds,...entity.evidenceIds,id])]
  result.events=result.events.filter(event=>event.tempId!==entity.tempId)
  const removed=new Set([entity.startTimePointTempId,entity.endTimePointTempId].filter(Boolean))
  result.timePoints=result.timePoints.filter(point=>!removed.has(point.tempId)||point.relatedTaskTempIds.length||point.relatedMaterialTempIds.length||result.events.some(event=>event.startTimePointTempId===point.tempId||event.endTimePointTempId===point.tempId))
  audit.facts.push({role:'source_process_context',owner:owner.tempId,item:entity.tempId,sourceEvidenceId:id})
 }
}
