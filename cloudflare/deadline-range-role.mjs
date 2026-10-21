// A time interval is not a deadline merely because a model chose that enum.
// No end date or event anchor is manufactured here; keep the original literal.
export const DEADLINE_RANGE_ROLE_VERSION='deadline-range-role-1.0.2'
export function citedDeadlineRoleContext(point,evidence,source){
 if(typeof source!=='string')return ''
 return (evidence??[]).filter(e=>point.evidenceIds?.includes(e.id)).map(e=>e.quote??e.quotedText).filter(q=>typeof q==='string'&&q&&source.includes(q)).join('。')
}
export function deadlineRangeRoleIssue(rawText,type,context=''){
 if(typeof rawText!=='string'||!/^(?:registration|submission|task)_deadline$/u.test(type??''))return null
 const q=rawText.replace(/\s/gu,'')
 const start='(?:\\d{4}年)?\\d{1,2}月\\d{1,2}日?'
 // A choice among on-site dates does not establish a submission cutoff.
 // Only the already cited clause may support this decision, and the point
 // itself must name a member of that date list.
 const date='(?:\\d{4}年)?\\d{1,2}月\\d{1,2}日'
 const groups=(context||rawText).replace(/\s/gu,'').split(/[。；;\n]/u)
 for(const clause of groups){
  if(!/或|任选|备选|可选择/u.test(clause))continue
  for(const list of clause.matchAll(new RegExp(date+'(?:[、，,]|或者|或)(?:'+date+')(?:[、，,或者]*'+date+')*','gu'))){
   const before=clause.slice(0,list.index),after=clause.slice(list.index+list[0].length)
   const dateChoice=/或/u.test(list[0])||/(?:可(?:以)?选择|可选|备选(?:日期|时间)?(?:为)?|任选)[：:]?$/u.test(before)||/^[（(]?(?:任选|任择|可选|可选择|其中)[一1]?(?:个)?(?:天|日|日期|时段)/u.test(after)
   if(!dateChoice)continue
   const dates=[...list[0].matchAll(/(?:\d{4}年)?(\d{1,2})月(\d{1,2})日/gu)].map(m=>[Number(m[1]),Number(m[2])])
   const own=[...q.matchAll(/(?:\d{4}年)?(\d{1,2})月(\d{1,2})日/gu)]
   if(own.length>0&&own.every(o=>dates.some(([m,d])=>m===Number(o[1])&&d===Number(o[2])))&&!/(?:之前|以前|截止|前|为止)/u.test(q))return 'deadline_is_alternative_date_choice'
  }
 }
 // A model may quote only an interval's opening date in rawText. The
 // point's own literal citations, never unrelated source text, can still
 // prove that it is an opening rather than an absolute cutoff.
 const ownDates=[...q.matchAll(/(?:\d{4}年)?(\d{1,2})月(\d{1,2})日/gu)]
 if(ownDates.length===1&&!/(?:之前|以前|截止|前|为止)/u.test(q)){
  for(const clause of groups){
   const starts=[...clause.matchAll(/(?:\d{4}年)?(\d{1,2})月(\d{1,2})日(?:[（(][^）)]{1,8}[）)])?(?:(\d{1,2})[:：]([0-5]\d))?(?:至|到|[-–—])/gu)]
   const own=ownDates[0],ownClock=/^(?:[（(][^）)]{1,8}[）)])?(\d{1,2})[:：]([0-5]\d)/u.exec(q.slice(own.index+own[0].length))
   const same=starts.filter(m=>{
    // "09:00到设备室" names a destination, not an interval. A range
    // must also name a temporal endpoint, even if that endpoint is unresolved.
    const end=clause.slice(m.index+m[0].length)
    const temporalEnd=/^(?:(?:\d{4}年)?(?:\d{1,2}月)?\d{1,2}日|\d{1,2}[:：][0-5]\d|[^，。；;]{0,40}(?:开场|开始|开考|结束|完成|举行)前|另行通知|待定|未公布)/u.test(end)
    return temporalEnd&&Number(m[1])===Number(own[1])&&Number(m[2])===Number(own[2])&&(!ownClock||m[3]&&Number(m[3])===Number(ownClock[1])&&Number(m[4])===Number(ownClock[2]))
   })
   if(!same.length)continue
   const literal=own[0].replace(/^\d{4}年/u,'')
   const hasOwnExplicitCutoff=clause.includes(literal+'前')||clause.includes(literal+'之前')||clause.includes('截止'+literal)||clause.includes('截止时间为'+literal)||clause.includes('截止时间：'+literal)
   if(!hasOwnExplicitCutoff)return 'deadline_is_cited_window_start'
  }
 }
 const finite=new RegExp(start+'(?:至|到|[-–—])(?:\\d{4}年)?(?:\\d{1,2}月)?\\d{1,2}日','u').exec(q)
 // A separately explicit "...日17:00前" is not rejected by this range guard.
 // Single cutoffs and event/window endpoints continue through their old path.
 if(finite&&!/^(?:\d{1,2}[:：][0-5]\d)?(?:之前|以前|前|为止)/u.test(q.slice(finite.index+finite[0].length)))return 'deadline_is_unqualified_date_range'
 const relative=new RegExp(start+'(?:至|到)(?!\\d)[^，。；]{0,40}(?:(?:开场|开始|开考|结束|完成|举行)前|另行通知|待定|未公布)','u')
 return relative.test(q)?'deadline_range_end_unresolved':null
}
