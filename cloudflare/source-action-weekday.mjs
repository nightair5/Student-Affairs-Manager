import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>typeof value==='string'?value.normalize('NFKC').toLowerCase().replace(/[\s的，,。；;：:（）()]/gu,''):''
const dayPattern=/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]/gu
const dayPeriod=/^(?:\s*(?:凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里))?(?:\s*(?:\d{1,2}\s*[:：]\s*\d{2}|[\d一二两三四五六七八九十]{1,3}\s*[点时](?:\s*[\d一二两三四五六七八九十]{1,3}\s*分?|\s*半)?))?/u

/** Extract a single, source-cited action date; never infer ownership from a
 * neighboring sentence, or treat a material choice as a date choice. */
export function sourceActionWeekday(source,item){
 const action=compact(item?.action??item?.actionVerb),target=compact(item?.object??item?.actionObject)
 if(!action||!target||target.length<2)return null
 const found=[]
 for(const quote of Array.isArray(item.evidence)?item.evidence:[]){
  if(typeof quote!=='string')continue
  const citation=locateSourceQuote(quote,source)
  if(!citation)continue
  for(const part of source.matchAll(/[^，,。；;！？\n]+/gu)){
   if(part.index>=citation.end||part.index+part[0].length<=citation.start)continue
   const clause=part[0],norm=compact(clause),days=[...clause.matchAll(dayPattern)]
   if(days.length!==1||!norm.includes(action)||!norm.includes(target))continue
   if(/(?:每(?:个|一)?|逢)(?:周|星期|礼拜)|暂定|可能|原定|取消|另行|无需|无须|不必|不要|不得|禁止|请勿/u.test(clause))continue
   const day=days[0],after=clause.slice(day.index+day[0].length),period=dayPeriod.exec(after)?.[0]??''
   const literal=day[0]+period,tail=after.slice(period.length),actionIndex=tail.normalize('NFKC').toLowerCase().indexOf(action)
   if(actionIndex<0||/(?:截止|截至|最迟|之前|以前|前|之后|以后|后|由|让|通知|委托)/u.test(tail.slice(0,actionIndex)))continue
   if(!/(?:请|须|需|应|务必|要求)/u.test(clause.slice(0,day.index)))continue
   const start=part.index+day.index
   found.push({raw:source.slice(start,start+literal.length),start,end:start+literal.length})
  }
 }
 const unique=[...new Map(found.map(value=>[`${value.start}:${value.end}`,value])).values()]
 return unique.length===1?unique[0]:null
}

/** Alternative weekdays are a note, not a confirmed calendar booking. */
export function sourceWeekdayAlternatives(source,item){
 const target=compact(item?.object??item?.actionObject)
 if(target.length<2)return null
 const found=[]
 for(const quote of Array.isArray(item.evidence)?item.evidence:[]){
  if(typeof quote!=='string')continue
  const citation=locateSourceQuote(quote,source)
  if(!citation)continue
  for(const part of source.matchAll(/[^，,。；;！？\n]+/gu)){
   if(part.index>=citation.end||part.index+part[0].length<=citation.start)continue
   const clause=part[0],days=[...clause.matchAll(dayPattern)]
   if(days.length!==2||!compact(clause).includes(target)||/(?:每(?:个|一)?|逢)(?:周|星期|礼拜)|原定|取消|不再/u.test(clause))continue
   const between=clause.slice(days[0].index+days[0][0].length,days[1].index)
   if(!/^\s*(?:或|或者|还是)\s*$/u.test(between))continue
   const start=part.index+days[0].index,end=part.index+days[1].index+days[1][0].length
   found.push({raw:source.slice(start,end),days:days.map(day=>day[0]),start,end})
  }
 }
 const unique=[...new Map(found.map(value=>[`${value.start}:${value.end}`,value])).values()]
 return unique.length===1?unique[0]:null
}
