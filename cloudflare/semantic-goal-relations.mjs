import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>typeof value==='string'?value.normalize('NFKC').replace(/[\s，。；：、（）()【】]/gu,''):''
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):''
const genericAnchors=new Set(['通知','活动','材料','提交','报名','同学','学生','时间','方式'])
const overlaps=(a,b)=>a.start<b.textEnd&&b.textStart<a.end

/** Preserve a cited relation as a view grouping. Never delete or merge the
 * actionable task: its independent deadline, materials and status remain. */
export function applySemanticGoalRelations({raw,result,pending,source,evidence,note,audit}){
 const events=pending.filter(row=>row.kind==='event'&&result.events.includes(row.entity)&&!row.entity.sourceStatus)
 const tasks=pending.filter(row=>row.kind==='task'&&result.standaloneTasks.includes(row.entity))
 const eventOwners=new Set()
 for(const task of tasks){
  const relation=task.item.eventRelation
  if(!relation||typeof relation!=='object'||Array.isArray(relation))continue
  const target=events.find(row=>row.item.key===relation.eventKey)
  const quote=text(relation.evidence,500),anchor=compact(text(relation.eventAnchor,100))
  const span=locateSourceQuote(quote,source)
  const ownRefs=task.entity.evidenceIds.map(id=>result.evidence.find(ref=>ref.id===id)).filter(Boolean)
  const anchoredEvents=anchor?events.filter(row=>compact(row.entity.title).includes(anchor)||row.entity.evidenceIds.some(id=>compact(result.evidence.find(ref=>ref.id===id)?.quote).includes(anchor))):[]
  const named=anchor.length>=2&&target&&anchoredEvents.length===1&&anchoredEvents[0]===target&&compact(span?.literal).includes(anchor)
  const contextual=events.length===1&&target===events[0]&&/(?:本次|本场|该)(?:活动|讲座|会议|培训|分享会|工作坊|招聘会)/u.test(span?.literal??'')
  if(!target||!span||(!named&&!contextual)||!ownRefs.some(ref=>overlaps(span,ref))){
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
  const supported=anchor.length>=2&&!genericAnchors.has(anchor)&&!/^[\d年月日时分:：\-/]+$/u.test(anchor)
   &&compact(title).includes(anchor)&&compact(span?.literal).includes(anchor)
   &&keys.length>=2&&keys.length<=20&&new Set(keys).size===keys.length
   &&members.every(row=>row&&row.entity.evidenceIds.length<20&&!eventOwners.has(row.entity.tempId)&&!assigned.has(row.entity.tempId)
     &&compact([row.item.object,row.item.title,row.ownText].join(' ')).includes(anchor))
  if(!supported){note('RELATION',text(goal.key,40)||String(index),'GOAL_RELATION_UNCONFIRMED');continue}
  const ref=evidence(span.literal,'description','goal-'+index,span.start)
  if(!ref)continue
  const taskTempIds=members.map(row=>row.entity.tempId)
  for(const row of members)row.entity.evidenceIds=[...new Set([...row.entity.evidenceIds,ref])]
  taskTempIds.forEach(id=>assigned.add(id))
  groups.push({id:'sem-goal-'+ref,title,taskTempIds,evidenceIds:[ref]})
  audit.facts.push({role:'source_goal_group',tasks:taskTempIds,sourceEvidenceId:ref})
 }
 if(groups.length)result.goalGroups=groups
}
