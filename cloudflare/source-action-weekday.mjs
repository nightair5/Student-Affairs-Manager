import {locateSourceQuote} from './source-text-index.mjs'
import {parseDirectSourceTime} from './direct-source-time.mjs'

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

/** Never show inferred candidate dates that precede an explicitly linked
 * submission. The weekday words remain available when chronology is unclear. */
export function formatSourceWeekdayAlternatives(source,choice,items,referenceTime,timezone){
 const dates=choice.days.map(day=>parseDirectSourceTime(day,{type:'event_start',referenceTime,timezone}))
 if(!dates.every(day=>day.normalizedValue&&!day.needsConfirmation))return null
 const context=source.slice(Math.max(0,choice.start-160),choice.start).split(/[。；;\n]/u).at(-1)??''
 if(/(?:根据|依据|按照)[^。；;\n]{0,50}(?:提交|递交|报送|报名|申请)[^。；;\n]{0,20}(?:材料|资料|名单|结果)/u.test(context)){
  const previous=[...new Set((Array.isArray(items)?items:[]).flatMap(item=>{
   const prior=sourceActionWeekday(source,item)
   if(!prior||prior.start>=choice.start)return []
   const parsed=parseDirectSourceTime(prior.raw,{type:'event_start',referenceTime,timezone})
   return parsed.normalizedValue&&!parsed.needsConfirmation?[parsed.normalizedValue.slice(0,10)]:[]
  }))]
  if(previous.length===1&&dates.some(day=>day.normalizedValue.slice(0,10)<previous[0]))return `${choice.raw}（与前续事项的先后日期尚不明确，请确认）`
 }
 return `${choice.days.map((day,index)=>`${day}（${dates[index].normalizedValue}）`).join('或')}（按整理日期推算，尚未确定）`
}

/** A model can describe a conditional later activity in its summary and mark
 * its time unresolved without emitting a separate personal task. Preserve the
 * uniquely source-backed note instead of inventing an obligation or event. */
export function sourceUnassignedWeekdayAlternative(source,summary,unresolved,represented){
 if(typeof summary!=='string')return null
 const targets=(Array.isArray(unresolved)?unresolved:[]).flatMap(value=>{
  if(typeof value!=='string')return []
  const match=/^\s*([^，,。；;“”"\n]{2,24}?)(?:的)?(?:具体)?(?:日期|时间|时段|地点)/u.exec(value)
  const target=match?.[1]?.replace(/的$/u,'').trim()
  return target&&compact(summary).includes(compact(target))&&source.includes(target)?[target]:[]
 })
 // A well-formed summary may retain a later conditional activity even when
 // the model did not list it as unresolved. Confirm its object in both the
 // literal clause and that summary before treating it as useful context.
 for(const part of source.matchAll(/[^，,。；;！？\n]+/gu)){
  const clause=part[0],days=[...clause.matchAll(dayPattern)]
  if(days.length!==2||!/(?:筛选|入选|获选|录取|受邀|被选中|通过(?:初审|审核|筛选))/u.test(clause))continue
  const suffix=clause.slice(days[1].index+days[1][0].length)
  const match=/(?:进行|参加|出席|接受|安排)\s*([^，,。；;！？\n]{2,24})/u.exec(suffix)
  const target=match?.[1]?.trim()
  if(target&&compact(summary).includes(compact(target)))targets.push(target)
 }
 const found=[]
 for(const target of [...new Set(targets)]){
  if(represented.some(value=>compact(value).includes(compact(target))))continue
  for(const part of source.matchAll(/[^，,。；;！？\n]+/gu)){
   const quote=part[0].trim()
   if(!quote.includes(target)||!/(?:筛选|入选|获选|录取|受邀|被选中|通过(?:初审|审核|筛选))/u.test(quote))continue
   const choice=sourceWeekdayAlternatives(source,{object:target,evidence:[quote]})
   if(choice)found.push({...choice,quote,startQuote:part.index+part[0].indexOf(quote)})
  }
 }
 return found.length===1?found[0]:null
}
