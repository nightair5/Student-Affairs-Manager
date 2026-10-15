// Closed sequence of two already declared events. Returns a literal endpoint,
// never a new point/event/owner, and never a value supplied by model metadata.
export function citedEventSequence(point,events,points,evidence,source){
 if(!['event_start','event_end'].includes(point.type)||!/^\d{1,2}:[0-5]\d(?:\s*[-—–]\s*\d{1,2}:[0-5]\d)?(?:同地(?:有)?[^\d。；\n]{1,20})?$/u.test(point.rawText))return null
 const owners=events.filter(e=>e.startTimePointTempId===point.tempId||e.endTimePointTempId===point.tempId)
 if(owners.length!==1)return null
 const qs=ids=>[...new Set(evidence.filter(e=>ids?.includes(e.id)&&typeof e.quote==='string'&&source.includes(e.quote)).map(e=>e.quote))]
 const current=owners[0],mine=qs(current.evidenceIds),rows=qs(point.evidenceIds).filter(q=>mine.includes(q)&&q.includes(point.rawText)&&(/^(?:随后|同日|当天)\s*\d{1,2}:[0-5]\d/u.test(q)||/^\d{1,2}:[0-5]\d\s*[-—–]\s*\d{1,2}:[0-5]\d同地/u.test(q)))
 if(rows.length!==1)return null
 const q=rows[0],at=source.indexOf(q)
 if(at<0||source.indexOf(q,at+1)>=0||/次日|明日|翌日|另行|待定|取消|延期|如果|若/u.test(q))return null
 const preceding=events.filter(e=>e!==current).flatMap(e=>qs(e.evidenceIds).filter(p=>{const pos=source.indexOf(p);return pos>=0&&source.indexOf(p,pos+1)<0&&pos+p.length<=at&&/^[。；;\s]*$/u.test(source.slice(pos+p.length,at))}).map(p=>({event:e,quote:p})))
 if(preceding.length!==1)return null
 const previous=preceding[0],start=points.find(p=>p.tempId===previous.event.startTimePointTempId),end=points.find(p=>p.tempId===previous.event.endTimePointTempId)
 if(!start||!end||start.type!=='event_start'||end.type!=='event_end'||!qs(start.evidenceIds).includes(previous.quote)||!qs(end.evidenceIds).includes(previous.quote)||/取消|延期|若|如果|假如/u.test(previous.quote))return null
 // 同地 specifies location, not a date across a paragraph. Explicit 同日/随后
 // can cross a full stop; bare 同地 needs the same semicolon-linked sentence.
 const gap=source.slice(source.indexOf(previous.quote)+previous.quote.length,at)
 if(!/^(?:随后|同日|当天)/u.test(q)&&/[。\n]/u.test(gap))return null
 const dates=[...previous.quote.matchAll(/\d{4}年\d{1,2}月\d{1,2}日/gu)],clocks=[...previous.quote.matchAll(/(\d{1,2}):([0-5]\d)/gu)],now=/^(?:(?:随后|同日|当天)\s*)?(\d{1,2}):([0-5]\d)(?:\s*[-—–]\s*(\d{1,2}):([0-5]\d))?/u.exec(q)
 if(dates.length!==1||clocks.length!==2||!now||+now[1]>23||+now[1]*60+ +now[2]<+clocks[1][1]*60+ +clocks[1][2])return null
 if(now[3]&&(+now[3]>23||+now[3]*60+ +now[4]<=+now[1]*60+ +now[2]))return null
 if(+clocks[0][1]>23||+clocks[1][1]>23||+clocks[1][1]*60+ +clocks[1][2]<=+clocks[0][1]*60+ +clocks[0][2])return null
 const clock=point.type==='event_end'&&now[3]?now[3]+':'+now[4]:now[1]+':'+now[2]
 const scalar=/^\d{1,2}:[0-5]\d$/u.test(point.rawText)
 if(scalar&&point.rawText!==clock)return null
 const pair=/^(\d{1,2}:[0-5]\d)\s*[-—–]\s*(\d{1,2}:[0-5]\d)/u.exec(point.rawText)
 if(pair&&(!now[3]||pair[1]!==now[1]+':'+now[2]||pair[2]!==now[3]+':'+now[4]))return null
 return {dateLiteral:dates[0][0],endpoint:dates[0][0]+clock,context:previous.quote+'\n'+q,evidenceIds:[...new Set([...(point.evidenceIds??[]),...(start.evidenceIds??[]),...(end.evidenceIds??[])])],rule:'EXISTING_SEQUENTIAL_EVENT_SOURCE_DATE'}
}
