import type {RecognitionResult} from './types'

export const NATIVE_QUALIFICATION_REVIEW_VERSION='native-cited-qualification-1.0.0' as const
export interface NativeQualificationReview {
 version:typeof NATIVE_QUALIFICATION_REVIEW_VERSION
 role:'PROGRAM_REVIEW_OF_EXISTING_MODEL_AMBIGUITY'
 taskId:string
 ambiguityId:string
 ruleEvidenceIds:string[]
 factEvidenceIds:string[]
 ruleQuotes:string[]
 factQuotes:string[]
 required:boolean
 ambiguityMessage:string
 blockedReason:string|null
 qualificationReviewReasons:string[]
}
/** No new eligibility fact: retain an existing, cited personal-status ambiguity.
 * Voluntary participation and unfinished predecessor actions are not eligibility.
 * The rule must be cited. An existing personal-status ambiguity can correctly
 * mean no personal fact was supplied; that absence is not a fabricated quote. */
export function nativeQualificationReviews(result:RecognitionResult,sourceText:string):NativeQualificationReview[]{
 const tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])],rows:NativeQualificationReview[]=[]
 const cited=(ids:string[])=>result.evidence.filter(e=>ids.includes(e.id)&&!!e.quote&&sourceText.includes(e.quote))
 const unknown=/(?:未(?:提供|公布|知晓|明确)|没有提供|尚不清楚|未知|尚未确认|无法确定|无法确认)/u
 const person=/(?:你|本人|个人|我|当前)/u,qualification=/(?:审核|录取|入选|资格|考核|获批|名单)/u
 for(const ambiguity of result.ambiguities){
  if(!qualification.test(ambiguity.field+' '+ambiguity.message)||!person.test(ambiguity.message)||!unknown.test(ambiguity.message))continue
  const evidence=cited(ambiguity.evidenceIds),facts=evidence.filter(e=>person.test(e.quote)&&qualification.test(e.quote)&&unknown.test(e.quote))
  for(const task of tasks){
   const rules=evidence.filter(e=>task.evidenceIds.includes(e.id)&&e.quote.includes(task.actionObject)&&/(?:只有|仅限|才(?:须|需|能|可)|获批者|入选者|审核通过者)/u.test(e.quote)&&qualification.test(e.quote)&&!/(?:自愿|有意参加|是否参赛由本人决定)/u.test(e.quote))
   if(!rules.length)continue
   const contradicted=evidence.some(e=>/(?:你|本人|个人|我)/u.test(e.quote)&&qualification.test(e.quote)&&/(?:未通过|未被录取|未录取|未入选|不符合|不具备|不在名单)/u.test(e.quote)&&!unknown.test(e.quote))
   const qualificationReviewReasons=result.quality.reviewReasons.filter(r=>qualification.test(r)&&unknown.test(r)&&!/(?:材料|渠道|时间|截止|地点|冲突|依据|格式|版本|附件|关系|项目|前置|依赖|遗漏|不完整)/u.test(r))
   rows.push({version:NATIVE_QUALIFICATION_REVIEW_VERSION,role:'PROGRAM_REVIEW_OF_EXISTING_MODEL_AMBIGUITY',taskId:task.tempId,ambiguityId:ambiguity.id,ambiguityMessage:ambiguity.message,ruleEvidenceIds:rules.map(e=>e.id),factEvidenceIds:facts.map(e=>e.id),ruleQuotes:rules.map(e=>e.quote),factQuotes:facts.map(e=>e.quote),required:rules.some(e=>/(?:须|必须|应当|需要|才需)/u.test(e.quote)),blockedReason:contradicted?'原文已说明个人未满足条件，不能用一次勾选覆盖；请保留待核对，或依据新事实纠正来源。':null,qualificationReviewReasons})
  }
 }
 return rows
}
