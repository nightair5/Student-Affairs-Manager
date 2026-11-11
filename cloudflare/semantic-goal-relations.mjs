import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>typeof value==='string'?value.normalize('NFKC').replace(/[\s，。；：、（）()【】]/gu,''):''
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):''
const genericAnchors=new Set(['通知','活动','材料','提交','报名','同学','学生','时间','方式'])
const overlaps=(a,b)=>a.start<b.textEnd&&b.textStart<a.end
const sharedAnchor=values=>{
 const texts=values.map(compact)
 if(texts.some(value=>!value))return ''
 const seed=texts.reduce((a,b)=>a.length<=b.length?a:b)
 for(let size=Math.min(seed.length,40);size>=2;size--)for(let start=0;start+size<=seed.length;start++){
  const part=seed.slice(start,start+size)
  if(!genericAnchors.has(part)&&!/^[\d年月日时分:：\-/]+$/u.test(part)&&texts.every(value=>value.includes(part)))return part
 }
 return ''
}

// A specific, uniquely cited heading establishes a bounded source section.
// It does not establish membership by itself: the model must propose a goal,
// each member must cite its own action in that section, and contradictions
// and separately named events are checked below. A date or generic heading is
// never sufficient. A subsequent heading closes the section rather than letting
// evidence from another matter leak into it.
function citedMatterSection(source,span,anchor){
 if(!span||anchor.length<2||genericAnchors.has(anchor)||/^[\d年月日时分:：\-/]+$/u.test(anchor))return null
 if(/^(?:(?:今日|明日|本周|近期|本次|有关|相关|其他|各项|学生|学校))?(?:通知|公告|事项|安排|提醒|任务|活动|材料|办理|提交|报名)$/u.test(anchor))return null
 const start=source.lastIndexOf('\n',span.start-1)+1
 const next=source.indexOf('\n',span.end),lineEnd=next<0?source.length:next
 const line=source.slice(start,lineEnd).trim()
 const heading=/^(?:【[^】]{2,80}】|\[[^\]]{2,80}\]|[^。！？；;\n]{2,80}[:：])\s*$/u.test(line)
 if(!heading||!compact(line).includes(anchor)||!compact(span.literal).includes(anchor))return null
 let end=source.length,at=lineEnd+1
 while(at<source.length){
  const n=source.indexOf('\n',at),to=n<0?source.length:n,following=source.slice(at,to).trim()
  if(/^(?:【[^】]{2,80}】|\[[^\]]{2,80}\]|[^。！？；;\n]{2,80}[:：])\s*$/u.test(following)){end=at;break}
  at=to+1
 }
 return {start:lineEnd,end}
}

// Prose introductions can declare the document's goal just as headings do.
// Require a model-proposed, source-cited scope declaration and a specific
// shared subject; neither an identical action verb nor repeated child titles
// is required. Multiple declared goals keep their own bounded sections.
function citedGoalIntroduction(source,span,goal,raw) {
 if(!span||span.start>500||!Array.isArray(raw.goals)||raw.goals.length!==1)return null
 const before=source.lastIndexOf('\n',span.start-1)+1
 const lineEnd=source.indexOf('\n',span.end)
 const line=source.slice(before,lineEnd<0?source.length:lineEnd)
 if(!/(?:现将|现就|为(?:了)?|关于).{0,120}(?:有关工作|有关事项|办理流程|申请流程|事宜|通知如下|安排如下)/u.test(line))return null
 const subject=sharedAnchor([goal.title,raw.topic,span.literal])
 if(subject.length<4||/^(?:今日|明日|本周|近期|相关|有关|学生|学校|各项|各类|全部|工作|通知|事项|材料|申请|办理)+$/u.test(subject))return null
 let end=source.length
 const tail=source.slice(span.end)
 // A new independently named notice/goal closes a prose scope. Ordinary
 // role headings (conditions, materials, process) remain inside the goal.
 const next=/\n\s*(?:【[^】]+】|\[[^\]]+\]|(?:另外|另有|此外)[^\n。]{0,100}(?:通知|申请|报名|办理))/u.exec(tail)
 if(next)end=span.end+next.index
 return {start:span.end,end}
}

/** Preserve a cited relation as a view grouping. Never delete or merge the
 * actionable task: its independent deadline, materials and status remain. */
export function applySemanticGoalRelations({raw,result,pending,source,evidence,note,audit,allowAdjacentParticipantReference=false,allowAssignmentEvidenceFallback=false,allowScopedMatter=false,allowProseScope=false}){
 const events=pending.filter(row=>row.kind==='event'&&result.events.includes(row.entity)&&!row.entity.sourceStatus)
 const tasks=pending.filter(row=>row.kind==='task'&&result.standaloneTasks.includes(row.entity))
 const eventOwners=new Set()
 for(const task of tasks){
  const relation=task.item.eventRelation
  if(!relation||typeof relation!=='object'||Array.isArray(relation))continue
  const target=events.find(row=>row.item.key===relation.eventKey)
  const quote=text(relation.evidence,500),anchor=compact(text(relation.eventAnchor,100))
  // A model may abbreviate its relation quote with an ellipsis while separately
  // citing the complete participant clause. Use that actual source span only
  // for the guarded adjacent-participant rule below; never invent a quote.
  const directSpan=locateSourceQuote(quote,source)
  const fallbackQuote=text(task.item.assignment?.evidence,500)
  const span=directSpan??(allowAssignmentEvidenceFallback?locateSourceQuote(fallbackQuote,source):null)
  const ownRefs=task.entity.evidenceIds.map(id=>result.evidence.find(ref=>ref.id===id)).filter(Boolean)
  const anchoredEvents=anchor?events.filter(row=>compact(row.entity.title).includes(anchor)||row.entity.evidenceIds.some(id=>compact(result.evidence.find(ref=>ref.id===id)?.quote).includes(anchor))):[]
  const named=Boolean(directSpan)&&anchor.length>=2&&target&&anchoredEvents.length===1&&anchoredEvents[0]===target&&compact(span?.literal).includes(anchor)
  // A source can use a shortened name later in the same notice. Accept only
  // a literal shared mention that identifies one extracted event uniquely.
  const shortMention=target&&span?sharedAnchor([target.entity.title,anchor,span.literal]):''
  const shortOwners=shortMention?events.filter(row=>compact(row.entity.title).includes(shortMention)):[]
  const shortened=Boolean(directSpan&&shortMention&&shortOwners.length===1&&shortOwners[0]===target&&!/(?:另一|其他|另有|互不相关|彼此独立)/u.test(span?.literal??'')&&target.entity.evidenceIds.some(id=>compact(result.evidence.find(ref=>ref.id===id)?.quote).includes(shortMention)))
  const contextual=Boolean(directSpan)&&events.length===1&&target===events[0]&&/(?:本次|本场|该)(?:活动|讲座|会议|培训|分享会|工作坊|招聘会)/u.test(span?.literal??'')
  // A following sentence may refer to the sole event as its participants
  // instead of repeating its name. Require the model's relation, a unique
  // source-backed event anchor and immediately adjacent source evidence.
  const previousRefs=target&&span?target.entity.evidenceIds.map(id=>result.evidence.find(ref=>ref.id===id)).filter(ref=>ref&&ref.textEnd<=span.start).sort((a,b)=>b.textEnd-a.textEnd):[]
  const previous=previousRefs[0],rawAnchor=text(relation.eventAnchor,100),anchorAt=rawAnchor?source.indexOf(rawAnchor):-1
  const sourceAnchor=Boolean(previous&&anchorAt>=0&&source.lastIndexOf(rawAnchor)===anchorAt&&(
   compact(previous.quote).includes(anchor)||anchorAt<previous.textStart&&/^[\s】\]）):：]*$/u.test(source.slice(anchorAt+rawAnchor.length,previous.textStart))&&(anchorAt===0||/[\s【\[(（:：]/u.test(source[anchorAt-1]))))
  const participant=/^(?:请)?(?:有意|有意向|希望|拟|计划|愿意)(?:参加|参与)(?:者|的?(?:同学|学生|人员))/u.test(span?.literal??'')
  const adjacent=Boolean(allowAdjacentParticipantReference&&events.length===1&&target===events[0]&&anchoredEvents.length===1&&anchoredEvents[0]===target
   &&Array.isArray(raw.items)&&raw.items.filter(item=>item?.kind==='event'&&item.status!=='cancelled').length===1&&span&&previous&&sourceAnchor&&participant
   &&!/(?:另有|另请|另外|此外|互不相关|彼此独立|与.{0,12}无关)/u.test(span.literal)
   &&/^[\s。！？；;，,]*$/u.test(source.slice(previous.textEnd,span.start)))
  if(!target||!span||(!named&&!shortened&&!contextual&&!adjacent)||!ownRefs.some(ref=>overlaps(span,ref))){
   note('RELATION',task.item.key,'EVENT_GOAL_RELATION_UNCONFIRMED');continue
  }
  if(target.entity.evidenceIds.length>=20){note('RELATION',task.item.key,'EVENT_GOAL_EVIDENCE_OVERFLOW');continue}
  const ref=evidence(span.literal,'event',task.item.key,span.start)
  if(!ref)continue
  target.entity.relatedTaskTempIds=[...new Set([...(target.entity.relatedTaskTempIds??[]),task.entity.tempId])]
  target.entity.evidenceIds=[...new Set([...target.entity.evidenceIds,ref])]
  eventOwners.add(task.entity.tempId)
  audit.facts.push({role:'event_goal_action',event:target.entity.tempId,task:task.entity.tempId,sourceEvidenceId:ref})
 }

 // Goal-only notices (for example different recipients submitting the same
 // kind of report) can group related tasks without inventing an event. The
 // anchor must be shared by every task's cited action, not merely a date.
 const assigned=new Set(),groups=[]
 for(const [index,goal] of (Array.isArray(raw.goals)?raw.goals.slice(0,20):[]).entries()){
  if(!goal||typeof goal!=='object'||Array.isArray(goal))continue
  const title=text(goal.title,80),anchor=compact(text(goal.anchor,80)),quote=text(goal.evidence,500)
  const keys=Array.isArray(goal.taskKeys)?goal.taskKeys.filter(value=>typeof value==='string'&&value.trim()):[]
  const span=locateSourceQuote(quote,source),members=keys.map(key=>tasks.find(task=>task.item.key===key))
  // Do not let a broad surrounding paragraph make an anchor appear to belong
  // to every task. Use each task's own identity instead.
  const memberTexts=members.map(row=>row?[row.item.object,row.item.title].join(' '):'')
  const literalAnchor=anchor.length>=2&&!genericAnchors.has(anchor)&&!/^[\d年月日时分:：\-/]+$/u.test(anchor)
   &&compact(title).includes(anchor)&&compact(span?.literal).includes(anchor)&&memberTexts.every(value=>compact(value).includes(anchor))
  // A heading may summarize several document names instead of appearing
  // verbatim in each one. Require the same explicit action, a shared topic,
  // and a literal heading before making this optional display group.
  const actions=members.map(row=>compact(row?.item.action)),shared=sharedAnchor([title,span?.literal,...memberTexts])
  const lastMemberEnd=Math.max(span?.end??0,...members.flatMap(row=>row?row.entity.evidenceIds.map(id=>result.evidence.find(ref=>ref.id===id)?.textEnd??0):[]))
  const scopedText=span?source.slice(span.start,Math.min(source.length,lastMemberEnd+50)):''
  const unrelated=/(?:互不相关|彼此独立|各不相关|两件独立|分别独立)/u.test(scopedText)
  const heading=Boolean(span&&anchor.length>=2&&!genericAnchors.has(anchor)&&compact(span.literal).includes(anchor)&&/^\s*[:：]/u.test(source.slice(span.end))&&!unrelated)
  const equivalentHeading=heading&&Boolean(shared)&&actions.every(action=>action&&action===actions[0])&&compact(title).includes(actions[0])
  // The heading can name a shared delivery while each branch names a
  // different document (for example a reflection and a summary). Require a
  // model-proposed goal, a specific cited heading/action, nearby owned task
  // citations, and a common object topic; never infer a group from a date.
  const memberRefs=members.map(row=>row?(Array.isArray(row.item.evidence)?row.item.evidence:[]).map(q=>typeof q==='string'?locateSourceQuote(q,source):null).filter(Boolean):[])
  const memberRoot=sharedAnchor(members.map(row=>row?.item.object??''))
  const genericRoot=/^(?:报名|报名表|申请|申请表|登记|登记表|材料|文件|表格|问卷|任务|事项)$/u.test(memberRoot)
  const otherEventKeys=new Set(members.map(row=>row?.item.eventRelation?.eventKey).filter(value=>typeof value==='string'&&value))
  const eventName=value=>value.match(/^(.+?)(工作坊|分享会|交流会|宣讲会|研讨会|讲座|培训|比赛|会议|课程|活动)/u)
  const namedEvents=members.map(row=>{
   const object=compact(row?.item.object),title=compact(row?.item.title),action=compact(row?.item.action)
   const actionAt=action?title.lastIndexOf(action):-1
   return eventName(object)??eventName(actionAt>=0?title.slice(actionAt+action.length):title)
  })
  const differentNamedEvents=namedEvents.length>1&&namedEvents.every(Boolean)&&new Set(namedEvents.map(match=>match[2])).size===1&&new Set(namedEvents.map(match=>match[1])).size>1
  const citedEventKeys=new Set(members.flatMap(row=>{
   const own=(Array.isArray(row?.item.evidence)?row.item.evidence:[]).map(q=>typeof q==='string'?locateSourceQuote(q,source):null).filter(Boolean)
   return events.filter(event=>{
    const name=compact(event.entity.title)
    const eventCited=event.entity.evidenceIds.some(id=>compact(result.evidence.find(ref=>ref.id===id)?.quote).includes(name))
    return name.length>=2&&eventCited&&own.some(ref=>compact(ref.literal).includes(name))
   }).map(event=>event.item.key)
  }))
  const section=span?source.slice(span.end,lastMemberEnd):''
  const commonScope=heading&&compact(title).includes(anchor)&&actions.every(action=>action&&action===actions[0])&&compact(title).includes(actions[0])
   &&otherEventKeys.size<=1&&!/\n\s*\n/u.test(section)&&memberRefs.every(refs=>refs.some(ref=>ref.start>=span.end&&ref.end<=span.end+600))
  const scopedHeading=commonScope&&compact(span.literal).includes(actions[0])&&Boolean(memberRoot)&&!genericRoot
  const documentSubject=anchor.match(/^(.{2,})(?:材料|资料|文件|证明|报告|表单|作品|总结|汇报|作业)$/u)?.[1]??''
  const specificDocumentHeading=commonScope&&Boolean(documentSubject)&&!/^(?:今日|明日|本周|近期|本次|相关|有关|其他|各种|各类|全部|所有|多个|通知|事项)$/u.test(documentSubject)
  const supported=(literalAnchor||equivalentHeading||scopedHeading||specificDocumentHeading)&&!unrelated&&!differentNamedEvents&&otherEventKeys.size<=1&&citedEventKeys.size<=1&&keys.length>=2&&keys.length<=20&&new Set(keys).size===keys.length
   &&members.every(row=>row&&row.entity.evidenceIds.length<20&&!eventOwners.has(row.entity.tempId)&&!assigned.has(row.entity.tempId))
  const bounds=(allowScopedMatter?citedMatterSection(source,span,anchor):null)??(allowProseScope?citedGoalIntroduction(source,span,goal,raw):null)
  const eligible=bounds?members.filter((row,i)=>row&&row.entity.evidenceIds.length<20&&!eventOwners.has(row.entity.tempId)&&!assigned.has(row.entity.tempId)
   &&memberRefs[i].some(ref=>ref.start>=bounds.start&&ref.end<=bounds.end)):[]
  const scoped=Boolean(bounds&&title&&keys.length>=2&&keys.length<=20&&new Set(keys).size===keys.length
   &&eligible.length>=2&&!unrelated&&!differentNamedEvents&&otherEventKeys.size<=1&&citedEventKeys.size<=1)
  if(!supported&&!scoped){note('RELATION',text(goal.key,40)||String(index),'GOAL_RELATION_UNCONFIRMED');continue}
  const accepted=supported?members:eligible
  if(scoped&&!supported&&accepted.length!==members.length)note('RELATION',text(goal.key,40)||String(index),'GOAL_MEMBER_UNRESOLVED')
  const ref=evidence(span.literal,'description','goal-'+index,span.start)
  if(!ref)continue
  const taskTempIds=accepted.map(row=>row.entity.tempId)
  for(const row of accepted)row.entity.evidenceIds=[...new Set([...row.entity.evidenceIds,ref])]
  taskTempIds.forEach(id=>assigned.add(id))
  groups.push({id:'sem-goal-'+ref,title,taskTempIds,evidenceIds:[ref]})
  audit.facts.push({role:'source_goal_group',tasks:taskTempIds,sourceEvidenceId:ref})
 }
 if(allowScopedMatter&&tasks.length>1)for(const task of tasks){
  if(assigned.has(task.entity.tempId)||eventOwners.has(task.entity.tempId))continue
  if(task.item.matterScope!=='independent')note('RELATION',task.item.key,'MATTER_ASSIGNMENT_UNRESOLVED')
 }
 if(groups.length)result.goalGroups=groups
}
