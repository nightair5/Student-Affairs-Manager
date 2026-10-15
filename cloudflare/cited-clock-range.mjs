import {parseChineseTimeAst} from './chinese-time-ast.generated.mjs'
export const CITED_CLOCK_RANGE_VERSION='cited-clock-range-role-1.0.0'
const unique=values=>[...new Set(values)]

/** Select a side of one literal clock interval only for an existing, cited
 * owner and a declared start/end role. An interval is never a scalar cutoff.
 * No entity, missing endpoint, owner or deadline is inferred here. */
export function projectCitedClockRanges(input,source,referenceTime,timezone='Asia/Shanghai'){
  const decisions=[]
  if(!input||!Array.isArray(input.timePoints))return {result:input,audit:{version:CITED_CLOCK_RANGE_VERSION,decisions}}
  const tasks=[...(input.standaloneTasks??[]),...(input.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
  const timePoints=input.timePoints.map(point=>{
    if(!point||typeof point.rawText!=='string'||!['event_start','event_end','registration_deadline','submission_deadline','task_deadline'].includes(point.type))return point
    const literal=point.rawText.replace(/\s+/gu,'')
    const match=/^((?:(\d{4})年)?(\d{1,2})月\d{1,2}日)(\d{1,2}:[0-5]\d)[—–至到-]((?:(\d{4})年)?(?:(\d{1,2})月)?\d{1,2}日)?(\d{1,2}:[0-5]\d)$/u.exec(literal)
    if(!match)return point
    // The existing cited-window assembler already handles single-day action
    // intervals, including a legacy point labelled as a deadline. Do not add
    // an earlier conflict that would survive its proven window conversion.
    if(!match[5]&&point.type.endsWith('_deadline'))return point
    const cited=(input.evidence??[]).filter(e=>point.evidenceIds?.includes(e.id)&&typeof e.quote==='string'&&source.includes(e.quote)&&e.quote.includes(point.rawText))
    const quotes=unique(cited.map(e=>e.quote))
    if(quotes.length!==1||source.indexOf(point.rawText)!==source.lastIndexOf(point.rawText))return point
    const left=match[1]+match[4],start=parseChineseTimeAst(left,{referenceTime,timezone,type:'event_start'})
    const rightDate=match[5]?`${match[6]??start.normalizedValue?.slice(0,4)}年${match[7]??match[3]}月${match[5].match(/(\d{1,2})日$/u)[1]}日`:match[1]
    const right=rightDate+match[8],end=parseChineseTimeAst(right,{referenceTime,timezone,type:'event_end'})
    const eventOwners=(input.events??[]).filter(e=>e[point.type==='event_end'?'endTimePointTempId':'startTimePointTempId']===point.tempId)
    // Existing single-day event handling already selects its two endpoints.
    // Keep that path and its selection decisions byte-for-byte in this repair.
    if(!match[5]&&!point.type.endsWith('_deadline')&&eventOwners.length)return point
    const taskOwners=tasks.filter(t=>point.relatedTaskTempIds?.includes(t.tempId)&&t.timePointTempIds?.includes(point.tempId))
    const owners=eventOwners.length?eventOwners:taskOwners
    const closed=eventOwners.length===1||!eventOwners.length&&taskOwners.length>0&&taskOwners.length===unique(point.relatedTaskTempIds??[]).length
    const supported=closed&&owners.every(o=>cited.some(e=>o.evidenceIds?.includes(e.id)))
    let reason=point.type.endsWith('_deadline')?'INTERVAL_IS_NOT_SCALAR_DEADLINE':!supported?'RANGE_OWNER_NOT_CLOSED':/取消|作废|如果|假如|若|暂定|待定|另行通知/u.test(quotes[0])?'RANGE_NOT_UNCONDITIONALLY_CURRENT':null
    if(!start.normalizedValue||!end.normalizedValue||start.needsConfirmation||end.needsConfirmation||end.normalizedValue<=start.normalizedValue)reason='RANGE_ENDPOINTS_NOT_UNAMBIGUOUS'
    const ownerIds=unique(owners.map(o=>o.tempId)),before={normalizedValue:point.normalizedValue??null,needsConfirmation:Boolean(point.needsConfirmation),selected:point.selected!==false}
    const endpoint=point.type==='event_end'?right:left,chosen=point.type==='event_end'?end:start
    const next=reason?{...point,normalizedValue:null,isAllDay:false,precision:'vague',needsConfirmation:true,selected:false}:{...point,normalizedValue:chosen.normalizedValue,timezone:chosen.timezone,isAllDay:chosen.isAllDay,precision:chosen.precision,needsConfirmation:false,selected:point.selected!==false}
    decisions.push({pointId:point.tempId,rawText:point.rawText,role:point.type,ownerIds,evidenceIds:cited.map(e=>e.id),quote:quotes[0],before,after:{normalizedValue:next.normalizedValue,needsConfirmation:next.needsConfirmation,selected:next.selected},endpoint:reason?null:endpoint,reason:reason??'EXISTING_CITED_RANGE_ENDPOINT',blocked:Boolean(reason)})
    return next
  })
  const blocked=decisions.filter(d=>d.blocked),conflicts=[...(input.conflicts??[])]
  for(const d of blocked){const id='cited-clock-range:'+d.pointId;if(!conflicts.some(c=>c.id===id))conflicts.push({id,type:'other',message:d.reason==='INTERVAL_IS_NOT_SCALAR_DEADLINE'?'这段原文是起止区间，不能直接当成一个截止；原文和原回答已保留，请核对该时间角色。':'这段起止时间的归属或当前状态不明确，请核对；其他事项可单独保存。',entityTempIds:[d.pointId,...d.ownerIds],evidenceIds:d.evidenceIds,requiresDecision:true})}
  return {result:decisions.length?{...input,timePoints,conflicts,...(blocked.length&&input.quality?{quality:{...input.quality,needsHumanReview:true,reviewReasons:unique([...(input.quality.reviewReasons??[]),'有一段起止时间需要核对其用途或归属。'])}}:{})}:input,audit:{version:CITED_CLOCK_RANGE_VERSION,decisions}}
}
