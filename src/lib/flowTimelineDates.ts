import {localDateKey} from './calendar'
import {isDateOnly,parseBusinessDateTime} from './timeSemantics'

/** Keep date-only values as dates, never inventing a clock time. */
export function timelineDate(values:(string|null|undefined)[]):string {
 const valid=values.filter((value):value is string=>Boolean(value)).filter(value=>isDateOnly(value)||Boolean(parseBusinessDateTime(value,'Asia/Shanghai')))
 if(!valid.length)return ''
 const firstDay=valid.map(localDateKey).sort()[0],sameDay=valid.filter(value=>localDateKey(value)===firstDay)
 const timed=sameDay.filter(value=>!isDateOnly(value))
 if(sameDay.some(isDateOnly))return sameDay.find(isDateOnly)!
 return timed.sort((a,b)=>parseBusinessDateTime(a,'Asia/Shanghai')!.getTime()-parseBusinessDateTime(b,'Asia/Shanghai')!.getTime())[0]??''
}
export function timelineGroupLabel(date:string):string {
 if(!date)return '未安排'
 const parsed=parseBusinessDateTime(isDateOnly(date)?`${date}T12:00`:date,'Asia/Shanghai')
 if(!parsed)return '未安排'
 return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(parsed)
}
/** Sort within each date using instants, while preserving the position of dates without a clock time. */
export function sortTimeline<T extends {date:string}>(items:T[]):T[] {
 const result=[...items].sort((a,b)=>!a.date&&!b.date?0:!a.date?1:!b.date?-1:localDateKey(a.date).localeCompare(localDateKey(b.date)))
 for(let start=0;start<result.length&&result[start].date;){
  let end=start+1
  while(end<result.length&&result[end].date&&localDateKey(result[end].date)===localDateKey(result[start].date))end++
  const slots:number[]=[],timed:T[]=[]
  for(let i=start;i<end;i++)if(!isDateOnly(result[i].date)){slots.push(i);timed.push(result[i])}
  timed.sort((a,b)=>parseBusinessDateTime(a.date,'Asia/Shanghai')!.getTime()-parseBusinessDateTime(b.date,'Asia/Shanghai')!.getTime())
  slots.forEach((slot,index)=>{result[slot]=timed[index]})
  start=end
 }
 return result
}
