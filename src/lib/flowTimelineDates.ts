import {localDateKey} from './calendar'
import {isDateOnly,parseBusinessDateTime} from './timeSemantics'

/** Keep date-only values as dates, never inventing a clock time. */
export function timelineDate(values:(string|null|undefined)[],timeZone='Asia/Shanghai'):string {
 const valid=values.filter((value):value is string=>Boolean(value)).filter(value=>isDateOnly(value)||Boolean(parseBusinessDateTime(value,timeZone)))
 if(!valid.length)return ''
 const firstDay=valid.map(value=>localDateKey(value,timeZone)).sort()[0],sameDay=valid.filter(value=>localDateKey(value,timeZone)===firstDay)
 const timed=sameDay.filter(value=>!isDateOnly(value))
 if(sameDay.some(isDateOnly))return sameDay.find(isDateOnly)!
 return timed.sort((a,b)=>parseBusinessDateTime(a,timeZone)!.getTime()-parseBusinessDateTime(b,timeZone)!.getTime())[0]??''
}
export function timelineGroupLabel(date:string,timeZone='Asia/Shanghai'):string {
 if(!date)return '未安排'
 const parsed=parseBusinessDateTime(isDateOnly(date)?`${date}T12:00`:date,timeZone)
 if(!parsed)return '未安排'
 return new Intl.DateTimeFormat('zh-CN',{timeZone,year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(parsed)
}
/** Sort within each date using instants, while preserving the position of dates without a clock time. */
export function sortTimeline<T extends {date:string}>(items:T[],timeZone='Asia/Shanghai'):T[] {
 const result=[...items].sort((a,b)=>!a.date&&!b.date?0:!a.date?1:!b.date?-1:localDateKey(a.date,timeZone).localeCompare(localDateKey(b.date,timeZone)))
 for(let start=0;start<result.length&&result[start].date;){
  let end=start+1
  while(end<result.length&&result[end].date&&localDateKey(result[end].date,timeZone)===localDateKey(result[start].date,timeZone))end++
  const slots:number[]=[],timed:T[]=[]
  for(let i=start;i<end;i++)if(!isDateOnly(result[i].date)){slots.push(i);timed.push(result[i])}
  timed.sort((a,b)=>parseBusinessDateTime(a.date,timeZone)!.getTime()-parseBusinessDateTime(b.date,timeZone)!.getTime())
  slots.forEach((slot,index)=>{result[slot]=timed[index]})
  start=end
 }
 return result
}
