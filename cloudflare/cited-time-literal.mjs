import{resolveLiteralSourceSpan}from'./recognition-literal-evidence.mjs'
export const CITED_TIME_LITERAL_VERSION='cited-time-literal-projection-1.0.1'
const records=value=>Array.isArray(value)?value.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)):[]
const includes=(value,id)=>Array.isArray(value)&&value.includes(id)

/** Bind an existing time field to its own existing source citation. No new
 * time, owner, evidence ID or normalized value is supplied here. */
export function projectCitedTimeLiterals(input,source){
  const audit={version:CITED_TIME_LITERAL_VERSION,inferredFacts:0,decisions:[]}
  if(!input||typeof source!=='string'||!Array.isArray(input.timePoints)||!Array.isArray(input.evidence))return{result:input,audit}
  const tasks=[...records(input.standaloneTasks),...records(input.milestones).flatMap(m=>[...records(m.tasks),...records(m.workPackages).flatMap(w=>records(w.tasks))])]
  const points=input.timePoints.map(point=>{
    if(!point||typeof point.rawText!=='string'||source.includes(point.rawText))return point
    const eventOwners=records(input.events).filter(e=>e.startTimePointTempId===point.tempId||e.endTimePointTempId===point.tempId).map(e=>({id:e.tempId,name:e.title,action:null,evidenceIds:e.evidenceIds}))
    const taskOwners=tasks.filter(t=>includes(point.relatedTaskTempIds,t.tempId)||includes(t.timePointTempIds,point.tempId)).map(t=>({id:t.tempId,name:t.actionObject,action:t.actionVerb,evidenceIds:t.evidenceIds}))
    const owners=['event_start','event_end'].includes(point.type)&&eventOwners.length?eventOwners:[...taskOwners,...eventOwners]
    // A bare administrative heading or an ownerless date must not activate
    // a student's cutoff just because its typography can be repaired.
    if(!owners.length||owners.some(o=>typeof o.name!=='string'||!o.name))return point
    const matches=records(input.evidence).flatMap(e=>{
      if(!includes(point.evidenceIds,e.id))return[]
      if(e.quote&&e.quotedText&&e.quote!==e.quotedText)return[]
      const quote=e.quotedText||e.quote;if(typeof quote!=='string'||!quote)return[]
      const at=source.indexOf(quote);if(at<0||source.indexOf(quote,at+1)>=0)return[]
      const span=resolveLiteralSourceSpan(point.rawText,quote)
      if(!span)return[]
      const left=quote.slice(0,span.start).search(/[^，,。；;！!？?]*$/u)
      const right=quote.slice(span.end).search(/[，,。；;！!？?]/u)
      const clause=quote.slice(left,right<0?quote.length:span.end+right)
      // The same object may have a student submission and a later staff
      // review. Repair only a date whose own clause states this owner's
      // action, with an existing shared citation; never bind by noun alone.
      if(!owners.every(o=>includes(o.evidenceIds,e.id)&&resolveLiteralSourceSpan(o.name,clause)
        &&(o.action===null||typeof o.action==='string'&&o.action&&resolveLiteralSourceSpan(o.action,clause))))return[]
      return span?[{evidenceId:e.id,literal:span.literal,start:at+span.start,end:at+span.end}]:[]
    })
    if(!matches.length||new Set(matches.map(m=>m.start+':'+m.end)).size!==1)return point
    const match=matches[0]
    audit.decisions.push({pointId:point.tempId,before:point.rawText,after:match.literal,start:match.start,end:match.end,evidenceIds:matches.map(m=>m.evidenceId),rule:'UNIQUE_TIME_LITERAL_INSIDE_OWN_CITATION'})
    return{...point,rawText:match.literal}
  })
  return{result:audit.decisions.length?{...input,timePoints:points}:input,audit}
}
