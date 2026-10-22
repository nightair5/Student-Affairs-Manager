// Personal applicability is separate from whether a source declares a real action.
// Scope only literal recipient/participation text. Never invent a relationship.
import {alignSourceQuote} from './two-step-source-alignment.mjs'
const compact=s=>s.replace(/\s/gu,'')
function sentenceSpan(span,source){
 const before=source.slice(0,span.start),left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('！'))+1
 const tail=source.slice(span.end).search(/[。；;！]/u),end=tail<0?source.length:span.end+tail+1
 return {start:left,end,text:source.slice(left,end)}
}
function boundedConditionBefore(span,source){
 // A recipient introduced with an explicit personal intention governs following
 // steps, until a new section or an explicitly different recipient is introduced.
 const prefix=source.slice(0,span.start),matches=[...prefix.matchAll(/(?:请)?(?:有\s*意\s*向|有\s*意|决\s*定\s*放\s*弃|已\s*缴\s*费)[^。；;！]{0,40}?(?:团\s*队|同\s*学|学\s*生|人\s*员|者)/gu)]
 const match=matches.at(-1);if(!match)return null
 const from=match.index,to=from+match[0].length,between=source.slice(to,span.start)
 if(between.length>1000||/\n\s*\n|(?:^|\n)\s*[一二三四五六七八九十]+[、．.]|(?:^|[。；;！])\s*请(?:所有|全体|各位|相关)?(?:同学|学生|教师|工作人员)/u.test(between))return null
 return {start:from,end:to,literal:match[0],rule:'LITERAL_INTENTION_RECIPIENT_CONTINUING_STEPS'}
}
export function applyScopedApplicability({records,source,result,audit,evidence}){
 for(const record of records){
  if(!record.entity||record.kind!=='任务')continue
  const scope=sentenceSpan(record.span,source),text=compact(scope.text),name=compact(record.entity.title),reasons=[]
  // A school's service entitlement is not evidence that this user belongs to it.
  const role=/(?:本校|学校|本院|本学院)(?:的)?(?:师生|学生|教职工|教师|同学)/u.exec(text)
  if(role){const span=alignSourceQuote(role[0],scope.text);if(span)reasons.push({...span,start:span.start+scope.start,end:span.end+scope.start,rule:'LITERAL_LOCAL_MEMBERSHIP_UNKNOWN'})}
  const branch=boundedConditionBefore(record.span,source);if(branch)reasons.push(branch)
  // Registration is a participation decision unless the source itself commands
  // this specific action. A quota across lectures does not choose this lecture.
  const registration=/报名|预约|选课|选修|申报/u.test(name)
  const mandatory=/(?:必须|务必|须|应当|要求|需要)[^。；;，]{0,16}(?:报名|预约|选课|选修|申报)/u.test(text)
  if(registration&&!mandatory)reasons.push({...record.span,rule:'PARTICIPATION_ACTION_REQUIRES_USER_CHOICE'})
  if(!reasons.length)continue
  record.entity.selected=false
  const literalReasons=[...new Set(reasons.map(r=>r.literal))]
  if(!record.entity.description.includes('适用条件待确认'))record.entity.description+='\n适用条件待确认：'+(registration&&!mandatory?'是否参与这项报名或申请尚未确认。':'当前是否符合原文所述对象或条件尚未确认。')
  for(const reason of reasons){const eid=evidence(reason,'requirement');if(!record.entity.evidenceIds.includes(eid))record.entity.evidenceIds.push(eid);audit.items.push({id:record.id,rule:reason.rule,quote:reason.literal,start:reason.start,end:reason.end,selection:'UNKNOWN_NOT_MANDATORY'})}
  for(const m of result.materials.filter(m=>m.relatedTaskTempIds.includes(record.entity.tempId)))m.selected=false
  audit.facts.push({rule:'APPLICABILITY_ONLY_NO_FACT_OR_RELATION_CREATED',item:record.id,literalReasons})
 }
}
