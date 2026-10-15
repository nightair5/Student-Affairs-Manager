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

export function citedSplitEventRange(point,events,points,evidence,source){
 if(!['event_start','event_end'].includes(point.type))return null
 const m=/^(\d{4}年\d{1,2}月\d{1,2}日)\s+(\d{1,2}:[0-5]\d)\s*[-—–至到]\s*(\d{1,2}:[0-5]\d)$/u.exec(point.rawText)
 if(!m)return null
 const owners=events.filter(e=>e[point.type==='event_start'?'startTimePointTempId':'endTimePointTempId']===point.tempId);if(owners.length!==1)return null
 const owner=owners[0],start=points.find(p=>p.tempId===owner.startTimePointTempId),end=points.find(p=>p.tempId===owner.endTimePointTempId)
 if(!start||!end||start.type!=='event_start'||end.type!=='event_end'||start.rawText!==point.rawText||end.rawText!==point.rawText)return null
 const common=evidence.filter(e=>owner.evidenceIds?.includes(e.id)&&start.evidenceIds?.includes(e.id)&&end.evidenceIds?.includes(e.id)&&typeof e.quote==='string'&&source.includes(e.quote)&&source.indexOf(e.quote)===source.lastIndexOf(e.quote))
 const date=common.filter(e=>e.quote===m[1]),clock=common.filter(e=>{const c=/^(\d{1,2}:[0-5]\d)\s*[-—–至到]\s*(\d{1,2}:[0-5]\d)$/u.exec(e.quote);return c&&c[1]===m[2]&&c[2]===m[3]})
 if(date.length!==1||clock.length!==1)return null
 const a=source.indexOf(date[0].quote),b=source.indexOf(clock[0].quote),minutes=c=>{const[h,n]=c.split(':').map(Number);return h<24?h*60+n:null},x=minutes(m[2]),y=minutes(m[3])
 if(b<a+date[0].quote.length||!/^\s*$/u.test(source.slice(a+date[0].quote.length,b))||x===null||y===null||y<=x)return null
 return {dateLiteral:m[1],endpoint:m[1]+(point.type==='event_start'?m[2]:m[3]),context:source.slice(a,b+clock[0].quote.length),evidenceIds:[date[0].id,clock[0].id],rule:'EXISTING_CITED_WHITESPACE_EVENT_RANGE'}
}

// A shared task window is already represented by both endpoints and reciprocal
// task owners. Select its literal side; never add an endpoint or infer an owner.
export function citedTaskDateRange(point,tasks,points,evidence,source){
 if(!['event_start','event_end'].includes(point.type))return null
 const m=/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?\s*[-—–至到]\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日$/u.exec(point.rawText)
 if(!m)return null
 const owners=tasks.filter(t=>point.relatedTaskTempIds?.includes(t.tempId)&&t.timePointTempIds?.includes(point.tempId))
 if(!owners.length||owners.length!==new Set(point.relatedTaskTempIds).size)return null
 const ids=owners.map(t=>t.tempId).sort(),sameIds=p=>JSON.stringify([...(p.relatedTaskTempIds??[])].sort())===JSON.stringify(ids)
 const starts=points.filter(p=>p.type==='event_start'&&p.rawText===point.rawText&&sameIds(p)),ends=points.filter(p=>p.type==='event_end'&&p.rawText===point.rawText&&sameIds(p))
 if(starts.length!==1||ends.length!==1||starts[0].tempId===ends[0].tempId||owners.some(t=>!t.timePointTempIds.includes(starts[0].tempId)||!t.timePointTempIds.includes(ends[0].tempId)))return null
 const leftYear=m[1],rightYear=m[4]??leftYear,lm=+m[2],rm=+(m[5]??m[2]),ld=+m[3],rd=+m[6]
 if(lm<1||lm>12||rm<1||rm>12||ld<1||ld>31||rd<1||rd>31||(rightYear&&leftYear?+rightYear*10000+rm*100+rd<+leftYear*10000+lm*100+ld:rm*100+rd<lm*100+ld))return null
 const proof=evidence.filter(e=>starts[0].evidenceIds?.includes(e.id)&&ends[0].evidenceIds?.includes(e.id)&&owners.some(t=>t.evidenceIds?.includes(e.id))&&typeof e.quote==='string'&&e.quote.includes(point.rawText)&&source.includes(e.quote)&&source.indexOf(e.quote)===source.lastIndexOf(e.quote)&&!/[旧原]截止|取消|作废|如果|假如|例如|若/u.test(e.quote))
 const clauses=[...new Set(proof.map(e=>e.quote))];if(clauses.length!==1)return null
 const left=(leftYear?leftYear+'年':'')+lm+'月'+ld+'日',right=(rightYear?rightYear+'年':'')+rm+'月'+rd+'日'
 return {dateLiteral:left,endpoint:point.type==='event_start'?left:right,context:clauses[0],evidenceIds:proof.map(e=>e.id),rule:'EXISTING_SHARED_TASK_DATE_RANGE'}
}
