import{resolveLiteralSourceSpan}from'./recognition-literal-evidence.mjs'
export const CITED_TIME_LITERAL_VERSION='cited-time-literal-projection-1.0.0'
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
    const owners=[...tasks.filter(t=>includes(point.relatedTaskTempIds,t.tempId)||includes(t.timePointTempIds,point.tempId)).map(t=>({id:t.tempId,name:t.actionObject})),...records(input.events).filter(e=>e.startTimePointTempId===point.tempId||e.endTimePointTempId===point.tempId).map(e=>({id:e.tempId,name:e.title}))]
    // A bare administrative heading or an ownerless date must not activate
    // a student's cutoff just because its typography can be repaired.
    if(!owners.length||owners.some(o=>typeof o.name!=='string'||!o.name))return point
    const matches=records(input.evidence).flatMap(e=>{
      if(!includes(point.evidenceIds,e.id))return[]
      if(e.quote&&e.quotedText&&e.quote!==e.quotedText)return[]
      const quote=e.quotedText||e.quote;if(typeof quote!=='string'||!quote)return[]
      const at=source.indexOf(quote);if(at<0||source.indexOf(quote,at+1)>=0)return[]
      if(!owners.every(o=>resolveLiteralSourceSpan(o.name,quote)))return[]
      const span=resolveLiteralSourceSpan(point.rawText,quote)
      return span?[{evidenceId:e.id,literal:span.literal,start:at+span.start,end:at+span.end}]:[]
    })
    if(!matches.length||new Set(matches.map(m=>m.start+':'+m.end)).size!==1)return point
    const match=matches[0]
    audit.decisions.push({pointId:point.tempId,before:point.rawText,after:match.literal,start:match.start,end:match.end,evidenceIds:matches.map(m=>m.evidenceId),rule:'UNIQUE_TIME_LITERAL_INSIDE_OWN_CITATION'})
    return{...point,rawText:match.literal}
  })
  return{result:audit.decisions.length?{...input,timePoints:points}:input,audit}
}
